"""
agents/bid_eval_agent.py
Agent 1.2 — Bid Evaluation & Award Agent.
Patterns: Parallelization (Ch.3), Reflection (Ch.4), Tool Use (Ch.5),
          Reasoning/CoT (Ch.17), Guardrails (Ch.18).

Autonomously:
  - Scores bids in parallel across multiple criteria
  - Validates compliance and Nigerian content
  - Generates award recommendations
  - Auto-awards routine purchases (<100M NGN)
"""

from __future__ import annotations

import asyncio
import json
import logging
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from agents.base_agent import BaseAgent
from config.settings import settings
from state.models import (
    AgentID, Autonomy, AwardRecommendation, Bid,
    BidScore, PriorityLevel, WorkflowStatus
)
from state.event_bus import EventTypes, get_event_bus

logger = logging.getLogger(__name__)


class BidEvaluationAgent(BaseAgent):

    AGENT_ID = AgentID.BID_EVAL

    SYSTEM_PROMPT = """You are the Bid Evaluation & Award Agent for Seplat Energy.
Your role is to rigorously and consistently evaluate vendor bids using a weighted 
multi-criteria scoring methodology. You must be objective, auditable, and fair.

Scoring weights (configurable):
  - Price competitiveness : 35%
  - Quality & technical   : 25%
  - Delivery lead time    : 20%
  - Compliance            : 10%
  - Nigerian Content      : 10%

Rules:
- NEVER award to a blacklisted or suspended vendor
- Flag all split awards or non-lowest-price selections for human review
- First-time vendors ALWAYS require human approval regardless of value
- Document every scoring decision with clear justification
- Output structured JSON only in your final answer."""

    def _tool_tags(self) -> List[str]:
        return ["erp", "document", "email", "market_data"]

    # ------------------------------------------------------------------
    # Main evaluation workflow
    # ------------------------------------------------------------------

    async def evaluate_bids(
        self, rfq_id: str, bids: List[Dict[str, Any]], trace_id: str
    ) -> Dict[str, Any]:
        """
        Ch.3 Parallelization: score all bids concurrently.
        Ch.17 Reasoning: CoT scoring with explicit justification per criterion.
        """
        logger.info(
            "BidEvalAgent: evaluating %d bids for RFQ %s", len(bids), rfq_id
        )

        if not bids:
            return {"success": False, "error": "No bids to evaluate"}

        # 1. Parallel completeness checks
        check_tasks = [self._check_bid_completeness(bid) for bid in bids]
        completeness = await asyncio.gather(*check_tasks, return_exceptions=True)

        complete_bids = [
            bid for bid, check in zip(bids, completeness)
            if not isinstance(check, Exception) and check.get("is_complete")
        ]

        if not complete_bids:
            return {
                "success": False,
                "error": "No complete bids received",
                "incomplete_count": len(bids),
            }

        # 2. Parallel scoring
        score_tasks = [self._score_bid(bid, rfq_id) for bid in complete_bids]
        scores = await asyncio.gather(*score_tasks, return_exceptions=True)

        valid_scores = [
            s for s in scores
            if not isinstance(s, Exception) and s.get("success")
        ]

        if not valid_scores:
            return {"success": False, "error": "All bid scoring failed"}

        # 3. Rank and recommend
        ranked = sorted(valid_scores, key=lambda x: x["weighted_total"], reverse=True)
        recommendation = await self._build_recommendation(rfq_id, ranked, bids, trace_id)

        await get_event_bus().publish_raw(
            event_type=EventTypes.AWARD_RECOMMENDED,
            source_agent=self.AGENT_ID,
            payload=recommendation,
            priority=PriorityLevel.HIGH,
            trace_id=trace_id,
        )
        return recommendation

    async def _check_bid_completeness(self, bid: Dict[str, Any]) -> Dict[str, Any]:
        """Fast completeness gate — uses fast model (Ch.16 Resource Optimization)."""
        required_fields = ["vendor_id", "bid_number", "items", "total_value",
                           "delivery_lead_time_days", "validity_days"]
        missing = [f for f in required_fields if not bid.get(f)]
        return {
            "bid_number": bid.get("bid_number"),
            "is_complete": len(missing) == 0,
            "missing_fields": missing,
        }

    async def _score_bid(self, bid: Dict[str, Any], rfq_id: str) -> Dict[str, Any]:
        """
        Score a single bid using LLM-based CoT reasoning (Ch.17).
        Deterministic criteria + LLM narrative justification.
        """
        task = f"""
Score this bid for RFQ {rfq_id} using the weighted criteria.

BID DATA:
{json.dumps(bid, default=str, indent=2)}

For each criterion, reason step by step:
1. PRICE (35%): Compare to market benchmark. Score 0-100.
2. QUALITY (25%): Technical specs, certifications, past quality scores. Score 0-100.
3. DELIVERY (20%): Lead time vs requirement. Shorter = higher score. Score 0-100.
4. COMPLIANCE (10%): All declarations present and valid. Score 0-100.
5. NIGERIAN CONTENT (10%): Local content percentage. Score 0-100.

Compute weighted_total = sum of (score × weight).

Return JSON with:
{{
  "success": true,
  "bid_number": "...",
  "vendor_id": "...",
  "price_score": 0-100,
  "quality_score": 0-100,
  "delivery_score": 0-100,
  "compliance_score": 0-100,
  "nigerian_content_score": 0-100,
  "weighted_total": 0-100,
  "justification": "...",
  "flags": []   // e.g. ["first_time_vendor", "sole_source", "abnormally_low_bid"]
}}
"""
        result = await self.run(
            task=task,
            context={"bid": bid, "rfq_id": rfq_id},
            trace_id=str(uuid4()),
        )
        return result.get("result", result)

    async def _build_recommendation(
        self,
        rfq_id: str,
        ranked_scores: List[Dict[str, Any]],
        original_bids: List[Dict[str, Any]],
        trace_id: str,
    ) -> Dict[str, Any]:
        """Build award recommendation with autonomy determination."""
        if not ranked_scores:
            return {"success": False, "error": "No valid scores to recommend from"}

        top = ranked_scores[0]
        top_bid = next(
            (b for b in original_bids if b.get("bid_number") == top.get("bid_number")),
            {}
        )
        total_value = Decimal(str(top_bid.get("total_value", 0)))

        # Determine autonomy level
        flags = top.get("flags", [])
        is_first_time = "first_time_vendor" in flags
        is_sole_source = len(ranked_scores) == 1
        non_lowest_price = (
            len(ranked_scores) > 1 and
            top.get("price_score", 100) < ranked_scores[1].get("price_score", 0)
        )

        needs_human = (
            is_first_time
            or total_value >= settings.thresholds.award_human_min
            or is_sole_source
            or non_lowest_price
        )

        autonomy = Autonomy.HUMAN_REQUIRED if needs_human else Autonomy.AUTONOMOUS

        reasons_for_review = []
        if is_first_time:
            reasons_for_review.append("First-time vendor requires human approval")
        if total_value >= settings.thresholds.award_human_min:
            reasons_for_review.append(f"Award value {total_value} NGN exceeds autonomous threshold")
        if is_sole_source:
            reasons_for_review.append("Only one bid received — sole-source justification required")
        if non_lowest_price:
            reasons_for_review.append("Recommended vendor is not the lowest price")

        return {
            "success": True,
            "rfq_id": rfq_id,
            "recommended_vendor_id": top.get("vendor_id"),
            "recommended_bid_number": top.get("bid_number"),
            "total_award_value": float(total_value),
            "weighted_score": top.get("weighted_total"),
            "justification": top.get("justification", ""),
            "autonomy": autonomy.value,
            "requires_human_review": needs_human,
            "reasons_for_human_review": reasons_for_review,
            "all_scores": ranked_scores,
            "confidence": top.get("weighted_total", 0) / 100,
        }

    # ------------------------------------------------------------------
    # Unsuccessful bidder notifications
    # ------------------------------------------------------------------

    async def notify_unsuccessful_bidders(
        self, rfq_id: str, awarded_vendor_id: str, all_vendor_ids: List[str]
    ) -> None:
        """
        Ch.3 Parallelization: send all rejection letters concurrently.
        """
        unsuccessful = [v for v in all_vendor_ids if v != awarded_vendor_id]
        if not unsuccessful:
            return

        notify_tasks = [
            self._send_rejection(rfq_id, vendor_id)
            for vendor_id in unsuccessful
        ]
        await asyncio.gather(*notify_tasks, return_exceptions=True)
        logger.info(
            "BidEvalAgent: sent %d unsuccessful notifications for RFQ %s",
            len(unsuccessful), rfq_id,
        )

    async def _send_rejection(self, rfq_id: str, vendor_id: str) -> None:
        await self._registry.call(
            "document",
            document_type="rejection_letter",
            data={"rfq_number": rfq_id, "vendor_name": vendor_id},
        )
        await self._registry.call(
            "email",
            to=[f"{vendor_id}@vendor.com"],
            subject=f"Bid Outcome — {rfq_id}",
            body=f"Dear Vendor {vendor_id}, thank you for participating in {rfq_id}. "
                 f"We regret to inform you that your bid was unsuccessful.",
            email_type="rejection",
        )
