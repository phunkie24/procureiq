"""
agents/contract_agent.py
Agent 1.4 — Contract Intelligence Agent.
Patterns: Planning (Ch.6), Goal Setting/Monitoring (Ch.11), RAG (Ch.14), Exploration (Ch.21).
Open-source LLM stack: Anthropic SDK (MIT-compatible API), Pydantic, httpx.
"""
from __future__ import annotations
import asyncio
import json
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import uuid4

from agents.base_agent import BaseAgent
from config.settings import settings
from state.models import AgentID, PriorityLevel
from state.event_bus import EventTypes, get_event_bus

logger = logging.getLogger(__name__)


class ContractIntelligenceAgent(BaseAgent):

    AGENT_ID = AgentID.CONTRACT

    SYSTEM_PROMPT = """You are the Contract Intelligence Agent for Seplat Energy.
You continuously monitor all active contracts and take proactive action.

Responsibilities:
1. Track contract expiry: alert at 90/60/30 days before end date
2. Monitor SLA performance: score vendors against contractual KPIs monthly
3. Benchmark contract rates against current market data
4. Identify unfavorable or high-risk clauses using NLP analysis (risk score 0-10)
5. Draft minor amendments autonomously: rate escalations per contract formula
6. Flag major renegotiations, disputes, or terminations for human review

Risk scoring criteria:
- Unlimited liability clauses: +3 risk points
- No force majeure: +2 risk points  
- Auto-renewal without cap: +1 risk point
- No dispute resolution mechanism: +2 risk points
- Non-standard payment terms: +1 risk point

Nigerian O&G regulatory requirements (DPR, NUPRC) apply to all contracts.
Output structured JSON only in your final answer."""

    def _tool_tags(self) -> List[str]:
        return ["erp", "document", "email", "market_data"]

    async def monitor_contracts(
        self, contracts: List[Dict[str, Any]], trace_id: str
    ) -> Dict[str, Any]:
        """
        Ch.11 Goal Setting & Monitoring: evaluate all contracts against lifecycle goals.
        Ch.3 Parallelization: analyse all contracts concurrently.
        """
        if not contracts:
            return {"success": True, "message": "No contracts to monitor", "alerts": []}

        logger.info("ContractAgent: monitoring %d contracts | trace=%s", len(contracts), trace_id)

        # Parallel analysis
        tasks = [self._analyse_contract(c, trace_id) for c in contracts]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        alerts = []
        assessments = []
        for contract, result in zip(contracts, results):
            if isinstance(result, Exception):
                logger.error("Contract analysis failed: %s", result)
                continue
            assessments.append(result)
            if result.get("requires_action"):
                alerts.append({
                    "contract_number": contract.get("contract_number"),
                    "alert_type": result.get("alert_type"),
                    "urgency": result.get("urgency"),
                    "recommendation": result.get("recommendation"),
                })
                await get_event_bus().publish_raw(
                    event_type=EventTypes.CONTRACT_EXPIRING,
                    source_agent=self.AGENT_ID,
                    payload=result,
                    priority=PriorityLevel.HIGH,
                    trace_id=trace_id,
                )

        return {
            "success": True,
            "contracts_assessed": len(assessments),
            "alerts_raised": len(alerts),
            "alerts": alerts,
            "assessments": assessments,
        }

    async def _analyse_contract(
        self, contract: Dict[str, Any], trace_id: str
    ) -> Dict[str, Any]:
        """Deep analysis of a single contract."""
        end_date_str = contract.get("end_date", "")
        days_remaining = 365  # default
        try:
            end_date = datetime.fromisoformat(end_date_str)
            days_remaining = (end_date - datetime.utcnow()).days
        except Exception:
            pass

        urgency = (
            "critical" if days_remaining < 30 else
            "high" if days_remaining < 60 else
            "medium" if days_remaining < 90 else
            "low"
        )

        task = f"""
Analyse this contract and produce a monitoring assessment:

CONTRACT DATA:
{json.dumps(contract, default=str, indent=2)}

DAYS REMAINING: {days_remaining}

Perform:
1. Expiry risk assessment (days remaining: {days_remaining})
2. SLA performance score vs targets (use ERP tool to fetch delivery/quality data)
3. Rate benchmarking (use market_data tool: price_benchmark action)
4. NLP risk scoring of clause types mentioned in scope/sla_terms
5. Renewal/renegotiation/terminate recommendation

Return JSON:
{{
  "contract_number": "...",
  "days_remaining": {days_remaining},
  "urgency": "{urgency}",
  "sla_score": 0-100,
  "rate_vs_market": "above/at/below",
  "nlp_risk_score": 0-10,
  "unfavorable_clauses": [],
  "requires_action": true/false,
  "alert_type": "expiry/sla_breach/rate_variance/risk",
  "recommendation": "renew/renegotiate/terminate/monitor",
  "amendment_needed": true/false,
  "amendment_description": "...",
  "confidence": 0.0-1.0
}}
"""
        result = await self.run(task=task, context=contract, trace_id=trace_id)
        return result.get("result", result)

    async def draft_amendment(
        self,
        contract: Dict[str, Any],
        change_description: str,
        trace_id: str,
    ) -> Dict[str, Any]:
        """
        Draft a contract amendment. Autonomous for minor rate adjustments;
        escalates for structural changes.
        """
        task = f"""
Draft a contract amendment for:

CONTRACT: {json.dumps(contract, default=str)}
REQUIRED CHANGE: {change_description}

Steps:
1. Determine if change is within autonomous scope:
   - Minor (autonomous): rate escalation per CPI/formula, date extension ≤90 days,
     administrative corrections
   - Major (human required): scope changes, liability caps, new parties, payment terms
2. If autonomous: use document tool to generate amendment document
3. If major: prepare amendment brief for human review and flag requires_human_review=true
4. Calculate new contract value if financial impact exists

Return JSON with amendment document content and autonomy determination.
"""
        result = await self.run(task=task, trace_id=trace_id)
        if result.get("success"):
            await get_event_bus().publish_raw(
                EventTypes.AMENDMENT_DRAFTED,
                self.AGENT_ID,
                payload=result,
                trace_id=trace_id,
            )
        return result

    async def run_nlp_risk_scan(
        self, contract_text: str, trace_id: str
    ) -> Dict[str, Any]:
        """
        Ch.14 RAG: retrieve known risky clause patterns from memory,
        compare against this contract's text.
        """
        # Recall risky clause patterns from long-term memory
        patterns = await self._memory.recall(
            "risky contract clauses unlimited liability force majeure", top_k=5
        )

        task = f"""
Perform NLP risk analysis on this contract text:

CONTRACT TEXT:
{contract_text[:3000]}

KNOWN RISK PATTERNS FROM MEMORY:
{json.dumps([p['content'] for p in patterns], indent=2)}

Score each of these risk dimensions (0-10, higher = riskier):
- Liability exposure
- Dispute resolution adequacy
- Force majeure coverage
- Termination rights balance
- Payment term risk
- Regulatory compliance risk

Identify specific unfavorable clauses with page/section references.

Return JSON with per-dimension scores, overall risk score, and clause citations.
"""
        return await self.run(task=task, trace_id=trace_id)
