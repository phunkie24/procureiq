"""
state/models.py
Pydantic data models for all procurement entities.
Structured output enforcement — Ch.5 Tool Use, Ch.18 Guardrails.
"""

from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class AgentID(str, Enum):
    SOURCING    = "agent_1_1_sourcing"
    BID_EVAL    = "agent_1_2_bid_eval"
    PO_EXEC     = "agent_1_3_po_exec"
    CONTRACT    = "agent_1_4_contract"
    VENDOR_MGMT = "agent_1_5_vendor_mgmt"
    ORCHESTRATOR = "orchestrator"


class WorkflowStatus(str, Enum):
    PENDING          = "pending"
    IN_PROGRESS      = "in_progress"
    AWAITING_HUMAN   = "awaiting_human"
    APPROVED         = "approved"
    REJECTED         = "rejected"
    COMPLETED        = "completed"
    FAILED           = "failed"


class PriorityLevel(str, Enum):
    CRITICAL = "critical"   # Emergency / production stoppage
    HIGH     = "high"       # Strategic / time-sensitive
    MEDIUM   = "medium"     # Routine with deadline
    LOW      = "low"        # Non-urgent replenishment


class Autonomy(str, Enum):
    """Delegation tier — Ch.13 HITL, Ch.18 Guardrails."""
    AUTONOMOUS      = "autonomous"       # No human needed
    RECOMMEND       = "recommend"        # Agent recommends, human confirms
    HUMAN_REQUIRED  = "human_required"   # Full human decision


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------

class AuditableBase(BaseModel):
    """Every entity gets a trace ID and timestamps for the audit log."""
    id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: AgentID = AgentID.ORCHESTRATOR
    trace_id: Optional[str] = None          # Links to parent workflow


# ---------------------------------------------------------------------------
# Vendor
# ---------------------------------------------------------------------------

class VendorStatus(str, Enum):
    ACTIVE      = "active"
    PROBATION   = "probation"
    SUSPENDED   = "suspended"
    BLACKLISTED = "blacklisted"


class Vendor(AuditableBase):
    name: str
    vendor_code: str
    email: str
    phone: Optional[str] = None
    categories: List[str] = Field(default_factory=list)
    nigerian_content_pct: float = Field(ge=0.0, le=100.0, default=0.0)
    financial_stability_score: float = Field(ge=0.0, le=10.0, default=5.0)
    performance_score: float = Field(ge=0.0, le=100.0, default=50.0)
    status: VendorStatus = VendorStatus.ACTIVE
    certifications: List[str] = Field(default_factory=list)
    on_boarded_at: Optional[datetime] = None


class VendorScorecard(AuditableBase):
    vendor_id: UUID
    period: str                             # e.g. "2025-Q1"
    delivery_score: float = Field(ge=0.0, le=100.0)
    quality_score: float = Field(ge=0.0, le=100.0)
    price_competitiveness: float = Field(ge=0.0, le=100.0)
    responsiveness: float = Field(ge=0.0, le=100.0)
    compliance_score: float = Field(ge=0.0, le=100.0)
    overall_score: float = Field(ge=0.0, le=100.0)
    commentary: Optional[str] = None
    generated_by: AgentID = AgentID.VENDOR_MGMT


# ---------------------------------------------------------------------------
# RFQ / Sourcing
# ---------------------------------------------------------------------------

class RFQItem(BaseModel):
    line_no: int
    description: str
    quantity: Decimal
    unit_of_measure: str
    estimated_unit_price: Optional[Decimal] = None
    technical_specs: Optional[str] = None


class RFQ(AuditableBase):
    rfq_number: str
    title: str
    category: str
    items: List[RFQItem]
    invited_vendors: List[UUID] = Field(default_factory=list)
    submission_deadline: datetime
    estimated_value: Decimal
    autonomy_level: Autonomy
    status: WorkflowStatus = WorkflowStatus.PENDING
    issued_by: AgentID = AgentID.SOURCING
    issued_at: Optional[datetime] = None

    @field_validator("estimated_value")
    @classmethod
    def must_be_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("estimated_value must be positive")
        return v


# ---------------------------------------------------------------------------
# Bid
# ---------------------------------------------------------------------------

class BidItem(BaseModel):
    line_no: int
    unit_price: Decimal
    total_price: Decimal
    delivery_days: int
    notes: Optional[str] = None


class Bid(AuditableBase):
    rfq_id: UUID
    vendor_id: UUID
    bid_number: str
    items: List[BidItem]
    total_value: Decimal
    delivery_lead_time_days: int
    validity_days: int
    compliance_declarations: Dict[str, bool] = Field(default_factory=dict)
    received_at: datetime = Field(default_factory=datetime.utcnow)
    is_complete: bool = False


class BidScore(AuditableBase):
    bid_id: UUID
    vendor_id: UUID
    price_score: float = Field(ge=0.0, le=100.0)
    quality_score: float = Field(ge=0.0, le=100.0)
    delivery_score: float = Field(ge=0.0, le=100.0)
    compliance_score: float = Field(ge=0.0, le=100.0)
    nigerian_content_score: float = Field(ge=0.0, le=100.0)
    weighted_total: float = Field(ge=0.0, le=100.0)
    rank: Optional[int] = None
    justification: str = ""
    evaluated_by: AgentID = AgentID.BID_EVAL


class AwardRecommendation(AuditableBase):
    rfq_id: UUID
    recommended_vendor_id: UUID
    bid_id: UUID
    total_award_value: Decimal
    justification: str
    autonomy_level: Autonomy
    status: WorkflowStatus = WorkflowStatus.PENDING
    approved_by: Optional[str] = None       # Human name if HITL
    approved_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Purchase Order
# ---------------------------------------------------------------------------

class POLine(BaseModel):
    line_no: int
    description: str
    quantity: Decimal
    unit_price: Decimal
    total_price: Decimal
    gl_code: str
    cost_center: str
    delivery_date: datetime


class PurchaseOrder(AuditableBase):
    po_number: str
    vendor_id: UUID
    rfq_id: Optional[UUID] = None
    award_id: Optional[UUID] = None
    lines: List[POLine]
    total_value: Decimal
    currency: str = "NGN"
    payment_terms: str = "NET30"
    delivery_address: str
    status: WorkflowStatus = WorkflowStatus.PENDING
    erp_po_id: Optional[str] = None         # SAP document number
    issued_by: AgentID = AgentID.PO_EXEC
    issued_at: Optional[datetime] = None
    vendor_acknowledged_at: Optional[datetime] = None


class ThreeWayMatch(AuditableBase):
    po_id: UUID
    requisition_id: str
    quote_ref: str
    contract_ref: Optional[str] = None
    is_matched: bool = False
    variance_pct: float = 0.0
    discrepancies: List[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Contract
# ---------------------------------------------------------------------------

class ContractStatus(str, Enum):
    DRAFT    = "draft"
    ACTIVE   = "active"
    EXPIRING = "expiring"           # Within 90 days
    EXPIRED  = "expired"
    RENEWED  = "renewed"
    TERMINATED = "terminated"


class Contract(AuditableBase):
    contract_number: str
    vendor_id: UUID
    title: str
    scope: str
    start_date: datetime
    end_date: datetime
    total_value: Decimal
    currency: str = "NGN"
    sla_terms: Dict[str, Any] = Field(default_factory=dict)
    penalty_clauses: Dict[str, Any] = Field(default_factory=dict)
    status: ContractStatus = ContractStatus.DRAFT
    auto_renewal: bool = False
    nlp_risk_score: float = Field(ge=0.0, le=10.0, default=0.0)
    unfavorable_clauses: List[str] = Field(default_factory=list)
    managed_by: AgentID = AgentID.CONTRACT


# ---------------------------------------------------------------------------
# Workflow & Audit Events
# ---------------------------------------------------------------------------

class WorkflowEvent(BaseModel):
    """
    Published to the event bus for inter-agent communication.
    Ch.15 A2A Communication pattern.
    """
    event_id: UUID = Field(default_factory=uuid4)
    event_type: str                         # e.g. "rfq.issued", "bid.scored"
    source_agent: AgentID
    target_agent: Optional[AgentID] = None  # None = broadcast
    payload: Dict[str, Any]
    priority: PriorityLevel = PriorityLevel.MEDIUM
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    trace_id: str = ""
    requires_ack: bool = False


class AuditRecord(BaseModel):
    """Immutable audit log entry written to Synapse / storage."""
    record_id: UUID = Field(default_factory=uuid4)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    agent_id: AgentID
    action: str
    entity_type: str
    entity_id: str
    autonomy_level: Autonomy
    human_actor: Optional[str] = None
    outcome: str                            # "success" | "failure" | "escalated"
    details: Dict[str, Any] = Field(default_factory=dict)
    trace_id: str = ""


class HumanOversightRequest(AuditableBase):
    """Raised by any agent when threshold or confidence triggers HITL."""
    requesting_agent: AgentID
    decision_type: str
    context_summary: str
    recommended_action: str
    entity_type: str
    entity_id: str
    estimated_value: Optional[Decimal] = None
    deadline: Optional[datetime] = None
    status: WorkflowStatus = WorkflowStatus.AWAITING_HUMAN
    resolved_by: Optional[str] = None
    resolution: Optional[str] = None
    resolved_at: Optional[datetime] = None
