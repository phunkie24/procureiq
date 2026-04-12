"""
guardrails/threshold_guard.py
Delegation threshold enforcement — Ch.13 HITL, Ch.18 Guardrails.
Central gateway between agent autonomous actions and human approval.
"""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any, Dict, Optional

from config.settings import settings
from state.models import (
    AgentID, Autonomy, HumanOversightRequest, PriorityLevel, WorkflowStatus
)
from state.event_bus import EventTypes, get_event_bus

logger = logging.getLogger(__name__)


class ThresholdGuard:
    """
    Enforces financial and policy thresholds.
    Every agent action that involves money or commitment passes through here.
    Implements Ch.13 HITL pattern and Ch.18 multi-layered guardrails.
    """

    def __init__(self) -> None:
        self._t = settings.thresholds

    async def gate(
        self,
        action_type: str,
        estimated_value: Decimal,
        context: Dict[str, Any],
        requesting_agent: AgentID,
        confidence: float = 1.0,
        flags: Optional[list] = None,
    ) -> Dict[str, Any]:
        """
        Evaluate whether an action can proceed autonomously or requires human approval.

        Returns:
          {
            "proceed": bool,
            "autonomy": Autonomy,
            "requires_hitl": bool,
            "hitl_request_id": str | None,
            "reason": str
          }
        """
        flags = flags or []
        autonomy, reason = self._determine_autonomy(
            action_type, estimated_value, confidence, flags
        )

        if autonomy == Autonomy.AUTONOMOUS and not settings.shadow_mode:
            logger.info(
                "THRESHOLD GATE | PASS | action=%s | value=%s | reason=%s",
                action_type, estimated_value, reason,
            )
            return {
                "proceed": True,
                "autonomy": autonomy,
                "requires_hitl": False,
                "hitl_request_id": None,
                "reason": reason,
            }

        # Shadow mode: log what would have happened but block
        if settings.shadow_mode:
            reason = f"[SHADOW MODE] Would proceed autonomously. {reason}"
            logger.info("SHADOW GATE | action=%s | value=%s", action_type, estimated_value)

        # Raise HITL request
        hitl_req = await self._raise_hitl(
            requesting_agent=requesting_agent,
            action_type=action_type,
            context=context,
            estimated_value=estimated_value,
            autonomy=autonomy,
            reason=reason,
        )

        return {
            "proceed": False,
            "autonomy": autonomy,
            "requires_hitl": True,
            "hitl_request_id": str(hitl_req.id),
            "reason": reason,
        }

    def _determine_autonomy(
        self,
        action_type: str,
        value: Decimal,
        confidence: float,
        flags: list,
    ) -> tuple[Autonomy, str]:

        # Confidence gate — always escalate if unsure (Ch.18)
        if confidence < self._t.min_confidence_score:
            return (
                Autonomy.HUMAN_REQUIRED,
                f"Confidence {confidence:.2f} below threshold {self._t.min_confidence_score}",
            )

        # Policy flags always escalate
        escalation_flags = {
            "first_time_vendor": "First-time vendor requires human approval",
            "sole_source": "Sole-source justification required",
            "non_lowest_price": "Non-lowest-price selection requires approval",
            "budget_overrun": "Budget overrun requires human approval",
            "blacklisted_vendor": "BLOCKED: Vendor is blacklisted",
        }
        for flag in flags:
            if flag in escalation_flags:
                return Autonomy.HUMAN_REQUIRED, escalation_flags[flag]

        # RFQ thresholds
        if action_type == "issue_rfq":
            if value < self._t.rfq_autonomous_max:
                return Autonomy.AUTONOMOUS, f"RFQ value {value} below autonomous limit"
            if value < self._t.rfq_strategic_min:
                return Autonomy.RECOMMEND, f"RFQ value {value} requires recommendation review"
            return Autonomy.HUMAN_REQUIRED, f"Strategic sourcing: value {value} requires approval"

        # Award thresholds
        if action_type in ("award", "auto_award"):
            if value < self._t.award_autonomous_max:
                return Autonomy.AUTONOMOUS, f"Award value {value} below autonomous limit"
            return Autonomy.HUMAN_REQUIRED, f"Award value {value} requires human approval"

        # PO thresholds
        if action_type == "issue_po":
            if value < self._t.po_autonomous_max:
                return Autonomy.AUTONOMOUS, f"PO value {value} within autonomous limit"
            return Autonomy.HUMAN_REQUIRED, f"PO value {value} requires human approval"

        # Default — recommend for anything unknown
        return Autonomy.RECOMMEND, f"Unknown action type '{action_type}' — defaulting to recommend"

    async def _raise_hitl(
        self,
        requesting_agent: AgentID,
        action_type: str,
        context: Dict[str, Any],
        estimated_value: Decimal,
        autonomy: Autonomy,
        reason: str,
    ) -> HumanOversightRequest:
        req = HumanOversightRequest(
            requesting_agent=requesting_agent,
            decision_type=action_type,
            context_summary=str(context)[:1000],
            recommended_action=context.get("recommended_action", "Review and approve or reject"),
            entity_type=context.get("entity_type", "unknown"),
            entity_id=str(context.get("entity_id", "")),
            estimated_value=estimated_value,
            status=WorkflowStatus.AWAITING_HUMAN,
        )

        logger.warning(
            "HITL RAISED | agent=%s | action=%s | value=%s | reason=%s",
            requesting_agent, action_type, estimated_value, reason,
        )

        await get_event_bus().publish_raw(
            event_type=EventTypes.HITL_REQUESTED,
            source_agent=requesting_agent,
            payload=req.model_dump(mode="json"),
            priority=PriorityLevel.HIGH,
        )
        return req


"""
guardrails/output_validator.py
Structured output validation — Ch.18 Guardrails, Ch.5 Tool Use.
Validates agent outputs before they trigger real-world actions.
"""

import json
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ValidationError


class OutputValidator:
    """
    Validates agent outputs against Pydantic schemas before action.
    Prevents malformed data from reaching ERP, email, or other systems.
    """

    def validate_rfq_output(self, output: Dict[str, Any]) -> tuple[bool, List[str]]:
        errors = []
        if not output.get("rfq_number"):
            errors.append("Missing rfq_number")
        if not output.get("items"):
            errors.append("Missing line items")
        if not output.get("invited_vendors"):
            errors.append("No vendors invited")
        if not output.get("submission_deadline"):
            errors.append("Missing submission deadline")
        return len(errors) == 0, errors

    def validate_bid_score_output(self, output: Dict[str, Any]) -> tuple[bool, List[str]]:
        errors = []
        for field in ["price_score", "quality_score", "delivery_score",
                      "compliance_score", "nigerian_content_score", "weighted_total"]:
            val = output.get(field)
            if val is None:
                errors.append(f"Missing {field}")
            elif not (0 <= float(val) <= 100):
                errors.append(f"{field} out of range: {val}")
        return len(errors) == 0, errors

    def validate_po_output(self, output: Dict[str, Any]) -> tuple[bool, List[str]]:
        errors = []
        if not output.get("po_number"):
            errors.append("Missing po_number")
        if not output.get("erp_confirmation"):
            errors.append("Missing ERP confirmation")
        if not output.get("lines"):
            errors.append("No PO line items")
        return len(errors) == 0, errors

    def validate_generic(
        self, output: Dict[str, Any], required_fields: List[str]
    ) -> tuple[bool, List[str]]:
        errors = [f"Missing: {f}" for f in required_fields if not output.get(f)]
        return len(errors) == 0, errors
