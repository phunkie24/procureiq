"""
tests/test_orchestrator.py
Integration tests for the Procurement Orchestrator.
"""

import asyncio
import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

from orchestrator.orchestrator import ProcurementOrchestrator, TaskIntent
from state.models import PriorityLevel
from state.event_bus import LocalEventBus, get_event_bus


@pytest.fixture
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def orchestrator():
    orch = ProcurementOrchestrator()
    # Use local event bus for tests
    yield orch


@pytest.mark.asyncio
async def test_submit_task_returns_trace_id(orchestrator):
    """Tasks submitted to the queue return a trace ID."""
    trace_id = await orchestrator.submit(
        intent=TaskIntent.SCAN_INVENTORY,
        payload={},
        priority=PriorityLevel.LOW,
    )
    assert trace_id is not None
    assert len(trace_id) == 36  # UUID format


@pytest.mark.asyncio
async def test_high_value_rfq_triggers_hitl(orchestrator):
    """RFQ above threshold must raise HITL, not proceed autonomously."""
    from guardrails.threshold_guard import ThresholdGuard
    guard = ThresholdGuard()

    result = await guard.gate(
        action_type="issue_rfq",
        estimated_value=Decimal("600_000_000"),  # Above 500M strategic threshold
        context={"rfq_number": "RFQ-TEST-001"},
        requesting_agent="agent_1_1_sourcing",
        confidence=0.95,
    )
    assert result["requires_hitl"] is True
    assert result["autonomy"] != "autonomous"


@pytest.mark.asyncio
async def test_low_value_rfq_proceeds_autonomously(orchestrator):
    """RFQ below threshold proceeds without human input."""
    from guardrails.threshold_guard import ThresholdGuard
    from config.settings import settings

    # Temporarily disable shadow mode for this test
    original = settings.shadow_mode
    settings.shadow_mode = False

    guard = ThresholdGuard()
    result = await guard.gate(
        action_type="issue_rfq",
        estimated_value=Decimal("10_000_000"),  # Well below 50M threshold
        context={},
        requesting_agent="agent_1_1_sourcing",
        confidence=0.95,
    )
    assert result["proceed"] is True
    assert result["autonomy"] == "autonomous"

    settings.shadow_mode = original


@pytest.mark.asyncio
async def test_low_confidence_triggers_hitl():
    """Low confidence score must escalate regardless of value."""
    from guardrails.threshold_guard import ThresholdGuard
    guard = ThresholdGuard()

    result = await guard.gate(
        action_type="issue_rfq",
        estimated_value=Decimal("1_000_000"),  # Low value
        context={},
        requesting_agent="agent_1_1_sourcing",
        confidence=0.4,  # Below 0.75 threshold
    )
    assert result["requires_hitl"] is True


"""
tests/test_agents.py
Unit tests for individual agents.
"""

import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_bid_completeness_check():
    """Incomplete bids are flagged correctly."""
    from agents.bid_eval_agent import BidEvaluationAgent

    agent = BidEvaluationAgent()
    complete_bid = {
        "vendor_id": "V001",
        "bid_number": "BID-001",
        "items": [{"line_no": 1, "unit_price": 100, "total_price": 1000,
                   "delivery_days": 14}],
        "total_value": 1000,
        "delivery_lead_time_days": 14,
        "validity_days": 60,
    }
    result = await agent._check_bid_completeness(complete_bid)
    assert result["is_complete"] is True
    assert result["missing_fields"] == []


@pytest.mark.asyncio
async def test_bid_completeness_missing_fields():
    from agents.bid_eval_agent import BidEvaluationAgent

    agent = BidEvaluationAgent()
    incomplete_bid = {"vendor_id": "V001"}
    result = await agent._check_bid_completeness(incomplete_bid)
    assert result["is_complete"] is False
    assert "bid_number" in result["missing_fields"]


"""
tests/test_tools.py
Unit tests for tool layer.
"""

import pytest


@pytest.mark.asyncio
async def test_erp_tool_mock_inventory():
    from tools.erp_tool import ERPTool

    tool = ERPTool(base_url="http://localhost", api_key="", mock_mode=True)
    result = await tool.run(
        action="get_inventory",
        payload={"material_code": "MAT-TEST-001"},
    )
    assert result.success is True
    assert "stock_on_hand" in result.data


@pytest.mark.asyncio
async def test_erp_tool_mock_budget_check():
    from tools.erp_tool import ERPTool

    tool = ERPTool(base_url="http://localhost", api_key="", mock_mode=True)
    result = await tool.run(
        action="check_budget",
        payload={"cost_center": "CC-1000", "amount": 50_000_000},
    )
    assert result.success is True
    assert "is_available" in result.data


@pytest.mark.asyncio
async def test_erp_tool_mock_create_po():
    from tools.erp_tool import ERPTool

    tool = ERPTool(base_url="http://localhost", api_key="", mock_mode=True)
    result = await tool.run(
        action="create_po",
        payload={
            "vendor_id": "V001",
            "lines": [{"line_no": 1, "total_price": 100_000}],
        },
    )
    assert result.success is True
    assert result.data["po_number"].startswith("PO-")


@pytest.mark.asyncio
async def test_email_tool_mock():
    from tools.email_tool import EmailTool

    tool = EmailTool(smtp_host="localhost", smtp_port=25,
                     from_addr="test@test.com", mock_mode=True)
    result = await tool.run(
        to=["vendor@test.com"],
        subject="Test RFQ",
        body="Please submit your offer",
        email_type="rfq",
    )
    assert result.success is True
    assert len(tool.sent_log) == 1
    assert tool.sent_log[0]["email_type"] == "rfq"


@pytest.mark.asyncio
async def test_document_tool_rfq():
    from tools.email_tool import DocumentTool

    tool = DocumentTool()
    result = await tool.run(
        document_type="rfq",
        data={
            "rfq_number": "RFQ-2025-001",
            "category": "Mechanical",
            "submission_deadline": "2025-06-01",
            "items": [
                {"line_no": 1, "description": "Pump seal", "quantity": 10,
                 "unit_of_measure": "EA"},
            ],
        },
    )
    assert result.success is True
    assert "RFQ-2025-001" in result.data["content"]


"""
tests/test_guardrails.py
Guardrail and threshold enforcement tests.
"""

import pytest
from decimal import Decimal


@pytest.mark.asyncio
async def test_first_time_vendor_always_escalates():
    from guardrails.threshold_guard import ThresholdGuard

    guard = ThresholdGuard()
    result = await guard.gate(
        action_type="award",
        estimated_value=Decimal("5_000_000"),  # Low value
        context={},
        requesting_agent="agent_1_2_bid_eval",
        confidence=0.99,
        flags=["first_time_vendor"],  # Should force HITL
    )
    assert result["requires_hitl"] is True


@pytest.mark.asyncio
async def test_blacklisted_vendor_blocked():
    from guardrails.threshold_guard import ThresholdGuard

    guard = ThresholdGuard()
    result = await guard.gate(
        action_type="award",
        estimated_value=Decimal("1_000_000"),
        context={},
        requesting_agent="agent_1_2_bid_eval",
        confidence=0.99,
        flags=["blacklisted_vendor"],
    )
    assert result["requires_hitl"] is True
    assert "blacklisted" in result["reason"].lower()


def test_output_validator_rfq():
    from guardrails.threshold_guard import OutputValidator

    validator = OutputValidator()

    valid, errors = validator.validate_rfq_output({
        "rfq_number": "RFQ-001",
        "items": [{"line_no": 1}],
        "invited_vendors": ["V001"],
        "submission_deadline": "2025-06-01",
    })
    assert valid is True
    assert errors == []

    valid, errors = validator.validate_rfq_output({})
    assert valid is False
    assert len(errors) > 0
