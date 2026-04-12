"""
orchestrator/orchestrator.py
Central Orchestration Layer — Multi-Agent System Hub.

Patterns:
  - Ch.1  Prompt Chaining   : sequential procurement pipeline (RFQ → Bid → PO)
  - Ch.2  Routing           : intent-based agent dispatch
  - Ch.7  Multi-Agent       : squadron coordination
  - Ch.11 Goal Setting      : workflow lifecycle goal tracking
  - Ch.12 Exception Handling: cross-agent error recovery
  - Ch.13 HITL              : human oversight gateway
  - Ch.16 Resource Optimization: task prioritization and model selection
  - Ch.20 Prioritization    : task queue ordering
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import uuid4

from agents.bid_eval_agent import BidEvaluationAgent
from agents.contract_agent import ContractIntelligenceAgent  # type: ignore
from agents.po_exec_agent import POExecutionAgent
from agents.sourcing_agent import SourcingIntelligenceAgent
from agents.vendor_mgmt_agent import VendorManagementAgent   # type: ignore
from config.settings import settings
from guardrails.threshold_guard import ThresholdGuard
from state.event_bus import EventTypes, get_event_bus, LocalEventBus
from state.models import AgentID, PriorityLevel, WorkflowEvent, WorkflowStatus

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Task / intent definitions
# ---------------------------------------------------------------------------

class TaskIntent(str, Enum):
    # Procurement lifecycle
    ISSUE_RFQ              = "issue_rfq"
    EVALUATE_BIDS          = "evaluate_bids"
    APPROVE_AWARD          = "approve_award"
    EXECUTE_PO             = "execute_po"

    # Monitoring loops
    SCAN_INVENTORY         = "scan_inventory"
    MONITOR_CONTRACTS      = "monitor_contracts"
    GENERATE_SCORECARDS    = "generate_scorecards"
    DISCOVER_VENDORS       = "discover_vendors"

    # Human responses
    HUMAN_APPROVED         = "human_approved"
    HUMAN_REJECTED         = "human_rejected"

    # System
    HEALTH_CHECK           = "health_check"


@dataclass
class OrchestratorTask:
    intent: TaskIntent
    payload: Dict[str, Any]
    priority: PriorityLevel = PriorityLevel.MEDIUM
    trace_id: str = field(default_factory=lambda: str(uuid4()))
    created_at: datetime = field(default_factory=datetime.utcnow)
    assigned_agent: Optional[AgentID] = None
    status: WorkflowStatus = WorkflowStatus.PENDING


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

class ProcurementOrchestrator:
    """
    Central brain of the Procurement Agent Squadron.
    Routes tasks, manages workflow state, enforces oversight.
    """

    def __init__(self) -> None:
        # Agent instances — Ch.7 Multi-Agent
        self._agents = {
            AgentID.SOURCING:    SourcingIntelligenceAgent(),
            AgentID.BID_EVAL:    BidEvaluationAgent(),
            AgentID.PO_EXEC:     POExecutionAgent(),
            AgentID.CONTRACT:    ContractIntelligenceAgent(),
            AgentID.VENDOR_MGMT: VendorManagementAgent(),
        }
        self._guard = ThresholdGuard()
        self._bus: LocalEventBus = get_event_bus()

        # Priority task queue — Ch.20 Prioritization
        self._task_queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        self._pending_hitl: Dict[str, OrchestratorTask] = {}
        self._running = False

        # Workflow goal tracking — Ch.11 Goal Setting
        self._active_workflows: Dict[str, Dict[str, Any]] = {}

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        await self._bus.start()
        self._subscribe_to_events()
        self._running = True
        logger.info("ProcurementOrchestrator started")

        # Start concurrent loops
        await asyncio.gather(
            self._task_dispatch_loop(),
            self._monitoring_loop(),
        )

    async def stop(self) -> None:
        self._running = False
        await self._bus.stop()
        logger.info("ProcurementOrchestrator stopped")

    # ------------------------------------------------------------------
    # Event subscriptions (A2A — Ch.15)
    # ------------------------------------------------------------------

    def _subscribe_to_events(self) -> None:
        bus = self._bus
        bus.subscribe(EventTypes.RFQ_ISSUED, self._on_rfq_issued)
        bus.subscribe(EventTypes.BID_RECEIVED, self._on_bid_received)
        bus.subscribe(EventTypes.AWARD_RECOMMENDED, self._on_award_recommended)
        bus.subscribe(EventTypes.AWARD_APPROVED, self._on_award_approved)
        bus.subscribe(EventTypes.PO_ISSUED, self._on_po_issued)
        bus.subscribe(EventTypes.HITL_RESOLVED, self._on_hitl_resolved)
        bus.subscribe(EventTypes.CONTRACT_EXPIRING, self._on_contract_expiring)
        bus.subscribe(EventTypes.AGENT_ERROR, self._on_agent_error)

    # ------------------------------------------------------------------
    # Public entry points
    # ------------------------------------------------------------------

    async def submit(
        self,
        intent: TaskIntent,
        payload: Dict[str, Any],
        priority: PriorityLevel = PriorityLevel.MEDIUM,
    ) -> str:
        """Submit a task to the orchestrator queue."""
        task = OrchestratorTask(intent=intent, payload=payload, priority=priority)

        # Priority mapping for asyncio.PriorityQueue (lower = higher priority)
        priority_map = {
            PriorityLevel.CRITICAL: 0,
            PriorityLevel.HIGH: 1,
            PriorityLevel.MEDIUM: 2,
            PriorityLevel.LOW: 3,
        }
        await self._task_queue.put((priority_map[priority], task))
        logger.info("TASK QUEUED | intent=%s | trace=%s | priority=%s",
                    intent, task.trace_id, priority)
        return task.trace_id

    async def human_decision(
        self, hitl_request_id: str, approved: bool, actor: str, notes: str = ""
    ) -> None:
        """Human resolves a HITL request — continue or cancel workflow."""
        task = self._pending_hitl.pop(hitl_request_id, None)
        if not task:
            logger.warning("HITL resolution for unknown request: %s", hitl_request_id)
            return

        event_type = EventTypes.HITL_RESOLVED
        await self._bus.publish_raw(
            event_type=event_type,
            source_agent=AgentID.ORCHESTRATOR,
            payload={
                "hitl_request_id": hitl_request_id,
                "approved": approved,
                "actor": actor,
                "notes": notes,
                "original_task": {
                    "intent": task.intent.value,
                    "payload": task.payload,
                },
            },
            priority=PriorityLevel.HIGH,
            trace_id=task.trace_id,
        )

    # ------------------------------------------------------------------
    # Task dispatch loop — Ch.2 Routing, Ch.20 Prioritization
    # ------------------------------------------------------------------

    async def _task_dispatch_loop(self) -> None:
        while self._running:
            try:
                _, task = await asyncio.wait_for(
                    self._task_queue.get(), timeout=1.0
                )
                await self._dispatch(task)
                self._task_queue.task_done()
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.exception("Task dispatch error: %s", exc)

    async def _dispatch(self, task: OrchestratorTask) -> None:
        """
        Ch.2 Routing: route task to the appropriate agent.
        Ch.1 Prompt Chaining: each step triggers the next via events.
        """
        intent = task.intent
        p = task.payload
        tid = task.trace_id

        logger.info("DISPATCH | intent=%s | trace=%s", intent, tid)

        route_map = {
            TaskIntent.SCAN_INVENTORY:     self._handle_scan_inventory,
            TaskIntent.ISSUE_RFQ:          self._handle_issue_rfq,
            TaskIntent.EVALUATE_BIDS:      self._handle_evaluate_bids,
            TaskIntent.EXECUTE_PO:         self._handle_execute_po,
            TaskIntent.MONITOR_CONTRACTS:  self._handle_monitor_contracts,
            TaskIntent.GENERATE_SCORECARDS: self._handle_generate_scorecards,
            TaskIntent.DISCOVER_VENDORS:   self._handle_discover_vendors,
        }

        handler = route_map.get(intent)
        if not handler:
            logger.warning("No handler for intent: %s", intent)
            return

        try:
            await handler(p, tid)
        except Exception as exc:
            logger.exception("Handler failed for %s: %s", intent, exc)
            await self._bus.publish_raw(
                EventTypes.AGENT_ERROR,
                AgentID.ORCHESTRATOR,
                payload={"intent": intent.value, "error": str(exc), "trace_id": tid},
                priority=PriorityLevel.HIGH,
                trace_id=tid,
            )

    # ------------------------------------------------------------------
    # Handlers — Ch.1 Prompt Chaining (procurement pipeline)
    # ------------------------------------------------------------------

    async def _handle_scan_inventory(self, p: Dict, tid: str) -> None:
        agent = self._agents[AgentID.SOURCING]
        await agent.scan_and_trigger_rfqs()  # type: ignore

    async def _handle_issue_rfq(self, p: Dict, tid: str) -> None:
        value = Decimal(str(p.get("estimated_value", 0)))
        gate = await self._guard.gate(
            "issue_rfq", value, p, AgentID.SOURCING,
            confidence=p.get("confidence", 1.0),
        )
        if gate["requires_hitl"]:
            self._pending_hitl[gate["hitl_request_id"]] = OrchestratorTask(
                intent=TaskIntent.ISSUE_RFQ, payload=p, trace_id=tid
            )
            return
        agent = self._agents[AgentID.SOURCING]
        await agent.issue_rfq_for_requisition(p, tid)  # type: ignore

    async def _handle_evaluate_bids(self, p: Dict, tid: str) -> None:
        agent = self._agents[AgentID.BID_EVAL]
        await agent.evaluate_bids(  # type: ignore
            rfq_id=p["rfq_id"],
            bids=p.get("bids", []),
            trace_id=tid,
        )

    async def _handle_execute_po(self, p: Dict, tid: str) -> None:
        value = Decimal(str(p.get("total_award_value", 0)))
        gate = await self._guard.gate(
            "issue_po", value, p, AgentID.PO_EXEC,
            confidence=p.get("confidence", 1.0),
            flags=p.get("flags", []),
        )
        if gate["requires_hitl"]:
            self._pending_hitl[gate["hitl_request_id"]] = OrchestratorTask(
                intent=TaskIntent.EXECUTE_PO, payload=p, trace_id=tid
            )
            return
        agent = self._agents[AgentID.PO_EXEC]
        await agent.execute_award(p, tid)  # type: ignore

    async def _handle_monitor_contracts(self, p: Dict, tid: str) -> None:
        agent = self._agents[AgentID.CONTRACT]
        await agent.monitor_contracts(p.get("contracts", []), tid)  # type: ignore

    async def _handle_generate_scorecards(self, p: Dict, tid: str) -> None:
        agent = self._agents[AgentID.VENDOR_MGMT]
        await agent.generate_scorecards(  # type: ignore
            vendors=p.get("vendors", []),
            period=p.get("period", ""),
            trace_id=tid,
        )

    async def _handle_discover_vendors(self, p: Dict, tid: str) -> None:
        agent = self._agents[AgentID.VENDOR_MGMT]
        await agent.discover_new_vendors(p.get("category", ""), tid)  # type: ignore

    # ------------------------------------------------------------------
    # Event handlers — Ch.1 Chaining: each event triggers next step
    # ------------------------------------------------------------------

    async def _on_rfq_issued(self, event: WorkflowEvent) -> None:
        logger.info("EVENT | rfq.issued | trace=%s", event.trace_id)
        # Chaining: RFQ issued → await bids → trigger evaluation

    async def _on_bid_received(self, event: WorkflowEvent) -> None:
        rfq_id = event.payload.get("rfq_id")
        bids = event.payload.get("bids", [])
        if bids:
            await self.submit(
                TaskIntent.EVALUATE_BIDS,
                {"rfq_id": rfq_id, "bids": bids},
                PriorityLevel.HIGH,
            )

    async def _on_award_recommended(self, event: WorkflowEvent) -> None:
        p = event.payload
        if p.get("requires_human_review"):
            logger.info("HITL: Award recommendation requires human review")
        else:
            # Chain: auto-approved award → execute PO
            await self.submit(TaskIntent.EXECUTE_PO, p, PriorityLevel.HIGH)

    async def _on_award_approved(self, event: WorkflowEvent) -> None:
        await self.submit(TaskIntent.EXECUTE_PO, event.payload, PriorityLevel.HIGH)

    async def _on_po_issued(self, event: WorkflowEvent) -> None:
        logger.info("WORKFLOW COMPLETE | PO issued | trace=%s", event.trace_id)

    async def _on_hitl_resolved(self, event: WorkflowEvent) -> None:
        approved = event.payload.get("approved", False)
        original = event.payload.get("original_task", {})
        if approved and original:
            intent = TaskIntent(original["intent"])
            await self.submit(intent, original["payload"], PriorityLevel.HIGH)
        else:
            logger.info("HITL: Task rejected by human — workflow cancelled")

    async def _on_contract_expiring(self, event: WorkflowEvent) -> None:
        await self.submit(
            TaskIntent.MONITOR_CONTRACTS,
            {"contracts": [event.payload]},
            PriorityLevel.HIGH,
        )

    async def _on_agent_error(self, event: WorkflowEvent) -> None:
        logger.error("AGENT ERROR | %s", event.payload)
        # Ch.12 Exception Handling: could retry, escalate, or alert

    # ------------------------------------------------------------------
    # Monitoring loops — Ch.11 Goal Setting & Monitoring
    # ------------------------------------------------------------------

    async def _monitoring_loop(self) -> None:
        """Periodic background monitoring tasks."""
        while self._running:
            await asyncio.sleep(3600)  # Run hourly
            if not self._running:
                break
            logger.info("Monitoring loop tick")
            await self.submit(TaskIntent.SCAN_INVENTORY, {}, PriorityLevel.LOW)
            await self.submit(TaskIntent.MONITOR_CONTRACTS, {}, PriorityLevel.LOW)
