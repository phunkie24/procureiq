"""
agents/vendor_mgmt_agent.py
Agent 1.5 — Vendor Relationship Management Agent.
Patterns: Exploration & Discovery (Ch.21), Memory (Ch.8), Parallelization (Ch.3),
          Learning & Adaptation (Ch.9).
Open-source stack: Anthropic SDK, Pydantic, httpx, asyncio.
"""
from __future__ import annotations
import asyncio
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from agents.base_agent import BaseAgent
from config.settings import settings
from state.models import AgentID, PriorityLevel
from state.event_bus import EventTypes, get_event_bus

logger = logging.getLogger(__name__)


class VendorManagementAgent(BaseAgent):

    AGENT_ID = AgentID.VENDOR_MGMT

    SYSTEM_PROMPT = """You are the Vendor Relationship Management Agent for Seplat Energy.
You build and maintain a comprehensive, data-driven picture of every vendor relationship.

Responsibilities:
1. Generate monthly/quarterly performance scorecards (100-point weighted scale)
2. Conduct sentiment analysis on vendor email communication history
3. Identify collaboration opportunities: VMI, consignment, frame agreements, JV
4. Recommend targeted vendor development programs for strategic underperformers
5. Manage vendor onboarding workflows end-to-end
6. Proactively explore the market for new vendors in thin/strategic categories (Ch.21)
7. Detect vendor relationship risks before they become contractual issues

Scorecard weights:
  Delivery on-time rate     : 30%
  Quality acceptance rate   : 25%
  Price competitiveness     : 20%
  Responsiveness/comms      : 15%
  HSE compliance record     : 10%

Nigerian Content requirements tracked separately (regulatory mandate).
Output structured JSON only in your final answer."""

    def _tool_tags(self) -> List[str]:
        return ["erp", "document", "email", "market_data"]

    async def generate_scorecards(
        self,
        vendors: List[Dict[str, Any]],
        period: str,
        trace_id: str,
    ) -> Dict[str, Any]:
        """
        Ch.3 Parallelization: score all vendors concurrently.
        Ch.9 Learning: store scores in long-term memory for trend tracking.
        """
        if not vendors:
            return {"success": True, "scorecards": [], "period": period}

        logger.info(
            "VendorMgmtAgent: generating %d scorecards for %s", len(vendors), period
        )

        tasks = [self._score_vendor(v, period, trace_id) for v in vendors]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        scorecards = []
        alerts = []
        for vendor, result in zip(vendors, results):
            if isinstance(result, Exception):
                logger.error("Scorecard failed for %s: %s", vendor.get("name"), result)
                continue
            scorecards.append(result)

            # Store in long-term memory for trend analysis (Ch.8 + Ch.9)
            await self._memory.store(
                doc_id=f"scorecard-{vendor.get('vendor_code','unknown')}-{period}",
                content=json.dumps(result, default=str)[:1500],
                vendor_id=vendor.get("vendor_code"),
                period=period,
                doc_type="scorecard",
            )

            score = result.get("overall_score", 0)
            if score < 60:
                alerts.append({
                    "vendor": vendor.get("name"),
                    "score": score,
                    "action": "development_plan" if score >= 40 else "probation_review",
                })

            # Send scorecard to vendor
            await self._registry.call(
                "email",
                to=[vendor.get("email", f"{vendor.get('vendor_code')}@vendor.com")],
                subject=f"Performance Scorecard — {period}",
                body=f"Dear {vendor.get('name')}, please find your Q performance scorecard attached.",
                email_type="feedback",
            )

        await get_event_bus().publish_raw(
            EventTypes.SCORECARD_GENERATED,
            self.AGENT_ID,
            payload={
                "period": period,
                "count": len(scorecards),
                "alerts": alerts,
            },
            trace_id=trace_id,
        )

        return {
            "success": True,
            "scorecards": scorecards,
            "period": period,
            "total_vendors": len(vendors),
            "alerts_raised": len(alerts),
            "alerts": alerts,
        }

    async def _score_vendor(
        self, vendor: Dict[str, Any], period: str, trace_id: str
    ) -> Dict[str, Any]:
        """Score a single vendor using ERP data + LLM analysis."""
        # Recall historical scores from memory for trend context
        history = await self._memory.recall(
            f"scorecard {vendor.get('vendor_code', '')} performance",
            top_k=3,
        )

        task = f"""
Generate a performance scorecard for this vendor:

VENDOR: {json.dumps(vendor, default=str)}
PERIOD: {period}
HISTORICAL CONTEXT: {json.dumps([h['content'][:200] for h in history])}

Steps:
1. Use ERP tool (get_inventory action) to fetch delivery and quality data
2. Use market_data tool (price_benchmark) to assess price competitiveness
3. Apply weighted scorecard formula:
   - Delivery on-time rate × 0.30
   - Quality acceptance rate × 0.25
   - Price competitiveness × 0.20
   - Responsiveness score × 0.15
   - HSE compliance × 0.10
4. Compare to previous period (use historical context)
5. Write actionable commentary

Return JSON:
{{
  "vendor_id": "...",
  "vendor_name": "...",
  "period": "{period}",
  "delivery_score": 0-100,
  "quality_score": 0-100,
  "price_score": 0-100,
  "responsiveness_score": 0-100,
  "hse_score": 0-100,
  "overall_score": 0-100,
  "trend": "improving/stable/declining",
  "nigerian_content_pct": 0-100,
  "commentary": "...",
  "improvement_actions": [],
  "collaboration_opportunities": [],
  "confidence": 0.0-1.0
}}
"""
        result = await self.run(task=task, context=vendor, trace_id=trace_id)
        return result.get("result", result)

    async def discover_new_vendors(
        self, category: str, trace_id: str
    ) -> Dict[str, Any]:
        """
        Ch.21 Exploration & Discovery: proactively search for new vendors
        in strategic categories where current panel is thin or underperforming.
        """
        logger.info("VendorMgmtAgent: discovering vendors for category=%s", category)

        task = f"""
Explore the market for new qualified vendors in category: {category}

Ch.21 Exploration approach — go beyond the known vendor panel:
1. Use market_data tool (vendor_search) to search industry directories
2. Use market_data tool (compliance_check) for top 3 candidates
3. Use market_data tool (financial_rating) to assess financial stability
4. Use market_data tool (nc_verification) to verify Nigerian Content capability

Pre-qualification criteria (Seplat minimum):
  ✓ Nigerian Content ≥ 30%
  ✓ Financial rating ≥ B
  ✓ DPR / NUPRC registered
  ✓ Safety LTIR ≤ 2.0
  ✓ Minimum 3 years O&G experience

Return JSON with:
{{
  "category": "{category}",
  "candidates": [
    {{
      "name": "...",
      "code": "...",
      "pre_qual_score": 0-100,
      "nigerian_content_pct": 0-100,
      "financial_rating": "...",
      "recommended_for_onboarding": true/false,
      "fast_track": true/false,
      "rationale": "..."
    }}
  ],
  "market_summary": "...",
  "recommended_action": "..."
}}
"""
        result = await self.run(task=task, trace_id=trace_id)

        await get_event_bus().publish_raw(
            EventTypes.VENDOR_ALERT,
            self.AGENT_ID,
            payload={"type": "new_vendor_discovery", "category": category, "result": result},
            trace_id=trace_id,
        )
        return result

    async def onboard_vendor(
        self, vendor_data: Dict[str, Any], trace_id: str
    ) -> Dict[str, Any]:
        """Full vendor onboarding workflow — document collection to portal access."""
        task = f"""
Execute the complete vendor onboarding workflow for:
{json.dumps(vendor_data, default=str)}

Onboarding steps:
1. Validate all required documents are present (CAC, TIN, DPR, NCDMB, banking details)
2. Run compliance check via market_data tool
3. Run financial rating check
4. Verify Nigerian Content declaration
5. Generate vendor welcome pack document
6. Send welcome email with portal access instructions
7. Create vendor record in ERP (erp tool: create_po action with vendor setup payload)
8. Schedule 30-day onboarding review

Return JSON with onboarding status, missing documents list, and next actions.
"""
        return await self.run(task=task, trace_id=trace_id)

    async def analyse_sentiment(
        self, vendor_id: str, email_threads: List[str], trace_id: str
    ) -> Dict[str, Any]:
        """
        Sentiment analysis on vendor email communications.
        Detects relationship deterioration before it becomes a contractual issue.
        """
        task = f"""
Analyse the sentiment and relationship health from these vendor email threads:

VENDOR: {vendor_id}
EMAIL THREADS (last 90 days):
{json.dumps(email_threads[:5], indent=2)[:2000]}

Assess:
1. Overall sentiment: positive/neutral/negative/deteriorating
2. Key concerns raised by vendor (payment delays, scope disputes, etc.)
3. Response time patterns (are we responding promptly?)
4. Risk signals: escalation language, legal references, withdrawal threats
5. Collaboration signals: proactive suggestions, partnership interest

Return JSON with sentiment scores, risk flags, and recommended relationship actions.
"""
        return await self.run(task=task, trace_id=trace_id)
