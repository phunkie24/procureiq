"""
orchestrator/workflow.py
Procurement pipeline workflow — Ch.1 Prompt Chaining, Ch.11 Goal Setting.
Defines the end-to-end procurement lifecycle as a typed state machine.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import uuid4


class ProcurementStage(str, Enum):
    REQUISITION_RECEIVED = "requisition_received"
    RFQ_PLANNING         = "rfq_planning"
    RFQ_ISSUED           = "rfq_issued"
    BIDS_OPEN            = "bids_open"
    BIDS_EVALUATING      = "bids_evaluating"
    AWARD_RECOMMENDED    = "award_recommended"
    AWARD_APPROVED       = "award_approved"
    PO_GENERATING        = "po_generating"
    PO_ISSUED            = "po_issued"
    PO_ACKNOWLEDGED      = "po_acknowledged"
    COMPLETED            = "completed"
    CANCELLED            = "cancelled"
    FAILED               = "failed"


# Stage transitions — prompt chaining sequence
STAGE_TRANSITIONS: Dict[ProcurementStage, List[ProcurementStage]] = {
    ProcurementStage.REQUISITION_RECEIVED: [ProcurementStage.RFQ_PLANNING],
    ProcurementStage.RFQ_PLANNING:         [ProcurementStage.RFQ_ISSUED, ProcurementStage.CANCELLED],
    ProcurementStage.RFQ_ISSUED:           [ProcurementStage.BIDS_OPEN],
    ProcurementStage.BIDS_OPEN:            [ProcurementStage.BIDS_EVALUATING],
    ProcurementStage.BIDS_EVALUATING:      [ProcurementStage.AWARD_RECOMMENDED, ProcurementStage.FAILED],
    ProcurementStage.AWARD_RECOMMENDED:    [ProcurementStage.AWARD_APPROVED, ProcurementStage.CANCELLED],
    ProcurementStage.AWARD_APPROVED:       [ProcurementStage.PO_GENERATING],
    ProcurementStage.PO_GENERATING:        [ProcurementStage.PO_ISSUED, ProcurementStage.FAILED],
    ProcurementStage.PO_ISSUED:            [ProcurementStage.PO_ACKNOWLEDGED, ProcurementStage.COMPLETED],
    ProcurementStage.PO_ACKNOWLEDGED:      [ProcurementStage.COMPLETED],
}


@dataclass
class ProcurementWorkflow:
    """State machine for a single procurement lifecycle."""
    workflow_id: str = field(default_factory=lambda: str(uuid4()))
    stage: ProcurementStage = ProcurementStage.REQUISITION_RECEIVED
    requisition: Dict[str, Any] = field(default_factory=dict)
    rfq_ref: Optional[str] = None
    bids: List[Dict] = field(default_factory=list)
    award_ref: Optional[str] = None
    po_ref: Optional[str] = None
    history: List[Dict] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def transition(self, target: ProcurementStage, context: Dict[str, Any] = None) -> bool:
        allowed = STAGE_TRANSITIONS.get(self.stage, [])
        if target not in allowed:
            return False
        self.history.append({
            "from": self.stage.value,
            "to": target.value,
            "at": datetime.utcnow().isoformat(),
            "context": context or {},
        })
        self.stage = target
        self.updated_at = datetime.utcnow()
        return True

    def is_terminal(self) -> bool:
        return self.stage in (
            ProcurementStage.COMPLETED,
            ProcurementStage.CANCELLED,
            ProcurementStage.FAILED,
        )
