"""
agents/po_exec_agent.py
Agent 1.3 — Purchase Order Execution Agent.
Patterns: Tool Use (Ch.5), Exception Handling (Ch.12), Guardrails (Ch.18).
"""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any, Dict, List
from uuid import uuid4

from agents.base_agent import BaseAgent
from state.models import AgentID, Autonomy, PriorityLevel
from state.event_bus import EventTypes, get_event_bus

logger = logging.getLogger(__name__)


class POExecutionAgent(BaseAgent):

    AGENT_ID = AgentID.PO_EXEC

    SYSTEM_PROMPT = """You are the PO Execution Agent for Seplat Energy.
Your responsibilities:
1. Generate Purchase Orders from approved award decisions
2. Validate budget availability via ERP before any write
3. Perform three-way matching (requisition ↔ quote ↔ contract)
4. Assign correct GL codes and cost centers
5. Transmit POs to vendors and track acknowledgement

Rules:
- NEVER create a PO without confirmed budget availability
- All ERP writes must be idempotent (check for existing PO before creating)
- Flag any budget overruns for human review immediately
- Output structured JSON with PO number and ERP confirmation."""

    def _tool_tags(self) -> List[str]:
        return ["erp", "document", "email"]

    async def execute_award(
        self, award: Dict[str, Any], trace_id: str
    ) -> Dict[str, Any]:
        """Convert an approved award into an issued PO."""
        task = f"""
Create and issue a Purchase Order for this approved award:

AWARD: {award}

Steps:
1. Check budget availability in ERP for the cost center
2. Perform three-way match: verify requisition, quote, and contract alignment
3. Look up correct GL code for this category
4. Generate PO document with all line items
5. Create PO in ERP system (idempotent — check if PO already exists first)
6. Transmit PO to vendor via email
7. Set up acknowledgement tracking

Fail fast if budget is unavailable — escalate immediately.
Return JSON with po_number, erp_confirmation, and transmission_status.
"""
        result = await self.run(task=task, context=award, trace_id=trace_id)

        if result.get("success"):
            await get_event_bus().publish_raw(
                event_type=EventTypes.PO_ISSUED,
                source_agent=self.AGENT_ID,
                payload=result,
                priority=PriorityLevel.HIGH,
                trace_id=trace_id,
            )
        return result


"""
agents/contract_agent.py
Agent 1.4 — Contract Intelligence Agent.
Patterns: Planning (Ch.6), Tool Use (Ch.5), Goal Setting/Monitoring (Ch.11),
          RAG (Ch.14) for clause benchmarking, Exploration (Ch.21).
"""

from agents.base_agent import BaseAgent
from state.models import AgentID, PriorityLevel
from state.event_bus import EventTypes, get_event_bus


class ContractIntelligenceAgent(BaseAgent):

    AGENT_ID = AgentID.CONTRACT

    SYSTEM_PROMPT = """You are the Contract Intelligence Agent for Seplat Energy.
You continuously monitor all active contracts and take proactive action.

Responsibilities:
1. Track contract expiry — alert at 90/60/30 days
2. Monitor SLA performance — score vendors monthly
3. Benchmark contract rates against market data
4. Identify unfavorable or high-risk clauses using NLP analysis
5. Draft minor amendments autonomously (rate escalations per contract formula)
6. Flag major renegotiations or disputes for human review

Output structured JSON with risk scores, renewal recommendations, and amendment drafts.
Nigerian regulatory requirements apply to all O&G contracts."""

    def _tool_tags(self) -> List[str]:
        return ["erp", "document", "email", "market_data"]

    async def monitor_contracts(self, contracts: list, trace_id: str) -> Dict[str, Any]:
        task = f"""
Review these contracts and produce a monitoring report:

CONTRACTS: {contracts}

For each contract:
1. Calculate days until expiry — flag if <90 days
2. Score SLA performance for the last quarter
3. Benchmark rates against market data (use market_data tool)
4. Analyse contract text for unfavorable clauses (NLP risk scoring)
5. Recommend: renew / renegotiate / terminate / no action
6. Draft renewal notice if within 90 days

Return JSON with per-contract assessments and overall risk summary.
"""
        return await self.run(task=task, trace_id=trace_id)

    async def draft_amendment(
        self, contract: Dict[str, Any], change_description: str, trace_id: str
    ) -> Dict[str, Any]:
        task = f"""
Draft a contract amendment:
CONTRACT: {contract}
CHANGE: {change_description}

Apply rate escalation formula from the contract. Generate amendment document.
Flag if change is beyond autonomous scope (non-standard terms → human required).
"""
        result = await self.run(task=task, trace_id=trace_id)
        if result.get("success"):
            await get_event_bus().publish_raw(
                EventTypes.AMENDMENT_DRAFTED, self.AGENT_ID,
                payload=result, trace_id=trace_id
            )
        return result


"""
agents/vendor_mgmt_agent.py
Agent 1.5 — Vendor Relationship Management Agent.
Patterns: Exploration & Discovery (Ch.21), Memory (Ch.8), Parallelization (Ch.3).
"""

from agents.base_agent import BaseAgent
from state.models import AgentID, PriorityLevel
from state.event_bus import EventTypes, get_event_bus


class VendorManagementAgent(BaseAgent):

    AGENT_ID = AgentID.VENDOR_MGMT

    SYSTEM_PROMPT = """You are the Vendor Relationship Management Agent for Seplat Energy.
You build and maintain a data-driven picture of every vendor relationship.

Responsibilities:
1. Generate monthly/quarterly performance scorecards for all active vendors
2. Conduct sentiment analysis on email communication history
3. Identify collaboration opportunities (VMI, consignment, frame agreements)
4. Recommend vendor development initiatives for underperforming but strategic vendors
5. Manage vendor onboarding workflows for new vendors
6. Explore market for new vendors in strategic categories (Ch.21 Exploration)

Be proactive — don't just report problems, recommend solutions.
Scores must be backed by ERP data, not estimates. Output structured JSON."""

    def _tool_tags(self) -> List[str]:
        return ["erp", "document", "email", "market_data"]

    async def generate_scorecards(
        self, vendors: list, period: str, trace_id: str
    ) -> Dict[str, Any]:
        """Ch.3 Parallelization: generate scorecards for all vendors concurrently."""
        import asyncio
        tasks = [
            self._score_one_vendor(vendor, period, trace_id)
            for vendor in vendors
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        successful = [r for r in results if not isinstance(r, Exception)]

        await get_event_bus().publish_raw(
            EventTypes.SCORECARD_GENERATED, self.AGENT_ID,
            payload={"period": period, "count": len(successful)},
            trace_id=trace_id,
        )
        return {"success": True, "scorecards": successful, "period": period}

    async def _score_one_vendor(
        self, vendor: Dict, period: str, trace_id: str
    ) -> Dict[str, Any]:
        task = f"""
Generate a performance scorecard for vendor:
{vendor}
Period: {period}

Pull delivery data, quality incidents, price competitiveness, and responsiveness
from ERP. Apply the weighted scorecard formula. Include commentary and
improvement recommendations. Return JSON with scores and narrative.
"""
        return await self.run(task=task, context={"vendor": vendor}, trace_id=trace_id)

    async def discover_new_vendors(
        self, category: str, trace_id: str
    ) -> Dict[str, Any]:
        """
        Ch.21 Exploration & Discovery: proactively search for new vendors
        in strategic categories where current panel is thin.
        """
        task = f"""
Explore the market for new qualified vendors in category: {category}

Use market_data tool to search vendor databases and industry directories.
Evaluate against Seplat prequalification criteria:
  - Nigerian Content compliance
  - Financial stability (minimum D&B rating or equivalent)
  - Technical capability and certifications
  - Safety record (LTIR, TRIR)

Return a shortlist of 3-5 candidates with pre-qualification assessment.
Flag any that should be fast-tracked for onboarding.
"""
        return await self.run(task=task, trace_id=trace_id)
