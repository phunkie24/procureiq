"""
agents/sourcing_agent.py
Agent 1.1 — Sourcing Intelligence Agent.
Patterns: Planning (Ch.6), Tool Use (Ch.5), Memory (Ch.8), Parallelization (Ch.3).

Autonomously:
  - Monitors inventory and triggers RFQs at reorder points
  - Plans multi-step sourcing strategy (Ch.6)
  - Drafts RFQ specifications using history (RAG, Ch.14)
  - Issues RFQs to vendor shortlists (<$50M NGN threshold)
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import uuid4

from agents.base_agent import BaseAgent
from config.settings import settings
from state.models import AgentID, Autonomy, PriorityLevel, RFQ, RFQItem, WorkflowStatus
from state.event_bus import EventTypes, get_event_bus

logger = logging.getLogger(__name__)


class SourcingIntelligenceAgent(BaseAgent):

    AGENT_ID = AgentID.SOURCING

    SYSTEM_PROMPT = """You are the Sourcing Intelligence Agent for Seplat Energy's 
procurement system. Your role is to:
1. Monitor inventory levels and identify when reorder points are reached
2. Plan a complete sourcing strategy for each procurement need
3. Draft precise RFQ specifications based on technical requirements and historical data
4. Pre-qualify vendors and build shortlists
5. Issue RFQs to qualified vendors

Always think step by step. Be precise with quantities, specifications, and deadlines.
Flag any unusual patterns (sole-source situations, unusually low inventory, etc.).
Output structured JSON in your final answer.
Nigerian Content requirements must be considered for all procurements."""

    def _tool_tags(self) -> List[str]:
        return ["erp", "inventory", "vendor", "email", "document"]

    # ------------------------------------------------------------------
    # Core sourcing workflows
    # ------------------------------------------------------------------

    async def scan_and_trigger_rfqs(self) -> List[Dict[str, Any]]:
        """
        Ch.3 Parallelization: scan all material categories concurrently,
        trigger RFQs in parallel for those at reorder points.
        Ch.6 Planning: for each trigger, build a full sourcing plan.
        """
        logger.info("SourcingAgent: scanning inventory for reorder triggers")

        # Parallel inventory scan across categories
        categories = ["mechanical", "electrical", "chemicals", "it_equipment", "services"]
        scan_tasks = [
            self._scan_category(cat) for cat in categories
        ]
        scan_results = await asyncio.gather(*scan_tasks, return_exceptions=True)

        triggered_rfqs = []
        for cat, result in zip(categories, scan_results):
            if isinstance(result, Exception):
                logger.error("Scan failed for %s: %s", cat, result)
                continue
            if result.get("requires_rfq"):
                rfq = await self._plan_and_issue_rfq(result)
                if rfq:
                    triggered_rfqs.append(rfq)

        logger.info("SourcingAgent: %d RFQs triggered", len(triggered_rfqs))
        return triggered_rfqs

    async def _scan_category(self, category: str) -> Dict[str, Any]:
        """Check inventory levels for a category via ERP tool."""
        result = await self._registry.call(
            "erp", action="get_inventory",
            payload={"category": category, "check_reorder": True}
        )
        if not result.success:
            raise RuntimeError(f"ERP scan failed for {category}: {result.error}")

        data = result.data
        stock = data.get("stock_on_hand", 999)
        reorder = data.get("reorder_point", 50)

        return {
            "category": category,
            "stock_on_hand": stock,
            "reorder_point": reorder,
            "requires_rfq": stock <= reorder,
            "material_data": data,
        }

    async def _plan_and_issue_rfq(self, scan_result: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Ch.6 Planning: generate a full sourcing plan, then execute it.
        """
        category = scan_result["category"]
        logger.info("SourcingAgent: planning RFQ for category=%s", category)

        # Use the ReAct loop (inherited from BaseAgent)
        task = f"""
Plan and issue an RFQ for category: {category}

Current situation:
- Stock on hand: {scan_result['stock_on_hand']} units
- Reorder point: {scan_result['reorder_point']} units
- Deficit: {max(0, scan_result['reorder_point'] - scan_result['stock_on_hand'])} units

Steps required:
1. Retrieve historical RFQ data for this category from memory
2. Check ERP for GL codes and cost centers
3. Build RFQ specification with items, quantities, and technical requirements
4. Identify qualified vendors using historical performance data
5. Generate the RFQ document
6. Send RFQ to vendor shortlist via email
7. Return structured result with RFQ details

Use the <50M NGN threshold for autonomous issuance.
"""
        result = await self.run(task=task, trace_id=str(uuid4()))

        if result.get("success") and not result.get("requires_human_review"):
            await get_event_bus().publish_raw(
                event_type=EventTypes.RFQ_ISSUED,
                source_agent=self.AGENT_ID,
                payload=result,
                priority=PriorityLevel.MEDIUM,
            )

        return result

    async def issue_rfq_for_requisition(
        self, requisition: Dict[str, Any], trace_id: str
    ) -> Dict[str, Any]:
        """
        Issue an RFQ for a specific purchase requisition.
        Called by the orchestrator when a PR is approved.
        """
        estimated_value = Decimal(str(requisition.get("estimated_value", 0)))
        autonomy = (
            Autonomy.AUTONOMOUS
            if estimated_value < settings.thresholds.rfq_autonomous_max
            else (
                Autonomy.RECOMMEND
                if estimated_value < settings.thresholds.rfq_strategic_min
                else Autonomy.HUMAN_REQUIRED
            )
        )

        task = f"""
Issue an RFQ for the following purchase requisition:
{requisition}

Autonomy level: {autonomy.value}
Estimated value: {estimated_value} NGN

{"AUTONOMOUS: Proceed to issue without human approval." if autonomy == Autonomy.AUTONOMOUS else
 "RECOMMEND: Prepare RFQ for human review before issuance." if autonomy == Autonomy.RECOMMEND else
 "HUMAN REQUIRED: Prepare RFQ package and flag for strategic sourcing team review."}

Use historical vendor data and market benchmarks.
Ensure Nigerian Content compliance documentation is requested.
"""
        return await self.run(task=task, trace_id=trace_id,
                              context={"requisition": requisition,
                                       "autonomy": autonomy.value})
