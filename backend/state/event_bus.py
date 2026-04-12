"""
state/event_bus.py
Inter-agent event bus — Ch.15 A2A Communication, Ch.3 Parallelization.

Abstracts Azure Service Bus (production) with an in-process asyncio queue
fallback for local development / testing.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from typing import Any, Callable, Coroutine, Dict, List, Optional
from uuid import uuid4

from state.models import AgentID, PriorityLevel, WorkflowEvent

logger = logging.getLogger(__name__)

# Handler type: async fn(event) -> None
EventHandler = Callable[[WorkflowEvent], Coroutine[Any, Any, None]]


class LocalEventBus:
    """
    In-process async event bus for development / testing.
    Mirrors the Azure Service Bus topic/subscription model.
    """

    def __init__(self) -> None:
        self._subscribers: Dict[str, List[EventHandler]] = defaultdict(list)
        self._queue: asyncio.Queue[WorkflowEvent] = asyncio.Queue()
        self._running = False
        self._dispatch_task: Optional[asyncio.Task] = None

    # ------------------------------------------------------------------
    # Subscription management
    # ------------------------------------------------------------------

    def subscribe(self, event_type: str, handler: EventHandler) -> None:
        """Register a handler for a specific event type or '*' for all."""
        self._subscribers[event_type].append(handler)
        logger.debug("Subscribed %s to event type '%s'", handler.__qualname__, event_type)

    def unsubscribe(self, event_type: str, handler: EventHandler) -> None:
        if handler in self._subscribers[event_type]:
            self._subscribers[event_type].remove(handler)

    # ------------------------------------------------------------------
    # Publishing
    # ------------------------------------------------------------------

    async def publish(self, event: WorkflowEvent) -> None:
        """
        Publish an event. High-priority events jump the queue via
        a priority-aware put (Ch.20 Prioritization).
        """
        logger.info(
            "EVENT PUBLISHED | type=%s | source=%s | priority=%s | trace=%s",
            event.event_type, event.source_agent, event.priority, event.trace_id,
        )
        await self._queue.put(event)

    async def publish_raw(
        self,
        event_type: str,
        source_agent: AgentID,
        payload: Dict[str, Any],
        *,
        target_agent: Optional[AgentID] = None,
        priority: PriorityLevel = PriorityLevel.MEDIUM,
        trace_id: str = "",
    ) -> WorkflowEvent:
        event = WorkflowEvent(
            event_type=event_type,
            source_agent=source_agent,
            target_agent=target_agent,
            payload=payload,
            priority=priority,
            trace_id=trace_id or str(uuid4()),
        )
        await self.publish(event)
        return event

    # ------------------------------------------------------------------
    # Dispatch loop
    # ------------------------------------------------------------------

    async def start(self) -> None:
        self._running = True
        self._dispatch_task = asyncio.create_task(self._dispatch_loop())
        logger.info("EventBus started")

    async def stop(self) -> None:
        self._running = False
        if self._dispatch_task:
            self._dispatch_task.cancel()
        logger.info("EventBus stopped")

    async def _dispatch_loop(self) -> None:
        while self._running:
            try:
                event = await asyncio.wait_for(self._queue.get(), timeout=1.0)
                await self._dispatch(event)
                self._queue.task_done()
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.exception("EventBus dispatch error: %s", exc)

    async def _dispatch(self, event: WorkflowEvent) -> None:
        handlers = (
            self._subscribers.get(event.event_type, [])
            + self._subscribers.get("*", [])
        )
        if not handlers:
            logger.debug("No handlers for event type '%s'", event.event_type)
            return

        # Ch.3 Parallelization — dispatch to all handlers concurrently
        tasks = [asyncio.create_task(h(event)) for h in handlers]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for handler, result in zip(handlers, results):
            if isinstance(result, Exception):
                logger.error(
                    "Handler %s failed for event %s: %s",
                    handler.__qualname__, event.event_type, result,
                )


# ---------------------------------------------------------------------------
# Well-known event types
# ---------------------------------------------------------------------------

class EventTypes:
    # Sourcing
    RFQ_TRIGGERED   = "rfq.triggered"
    RFQ_ISSUED      = "rfq.issued"
    BID_RECEIVED    = "bid.received"

    # Bid Evaluation
    BID_SCORED      = "bid.scored"
    AWARD_RECOMMENDED = "award.recommended"
    AWARD_APPROVED  = "award.approved"
    AWARD_REJECTED  = "award.rejected"

    # PO Execution
    PO_CREATED      = "po.created"
    PO_ISSUED       = "po.issued"
    PO_ACKNOWLEDGED = "po.acknowledged"

    # Contract
    CONTRACT_EXPIRING   = "contract.expiring"
    CONTRACT_RENEWED    = "contract.renewed"
    CONTRACT_RISK_ALERT = "contract.risk_alert"
    AMENDMENT_DRAFTED   = "contract.amendment_drafted"

    # Vendor Management
    SCORECARD_GENERATED = "vendor.scorecard_generated"
    VENDOR_ALERT        = "vendor.alert"

    # Human Oversight
    HITL_REQUESTED  = "hitl.requested"
    HITL_RESOLVED   = "hitl.resolved"

    # System
    AGENT_ERROR     = "agent.error"
    AGENT_STARTED   = "agent.started"
    AGENT_COMPLETED = "agent.completed"


# Singleton for dependency injection
_bus_instance: Optional[LocalEventBus] = None


def get_event_bus() -> LocalEventBus:
    global _bus_instance
    if _bus_instance is None:
        _bus_instance = LocalEventBus()
    return _bus_instance
