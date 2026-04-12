"""
tools/erp_tool.py
ERP / SAP ECC integration tool — Ch.5 Tool Use.
Supports mock mode for development (settings.erp_mock_mode = True).
All write operations are idempotent (Ch.12 Exception Handling).
"""

from __future__ import annotations

import logging
import random
import string
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID

import httpx

from tools.tool_registry import BaseTool, ToolDefinition, ToolParameter, register_tool

logger = logging.getLogger(__name__)


class ERPTool(BaseTool):

    definition = ToolDefinition(
        name="erp",
        description=(
            "Read and write to the SAP ECC ERP system. Supports inventory queries, "
            "budget checks, PO creation, GL code lookup, and cost center validation."
        ),
        parameters=[
            ToolParameter("action", "string", "ERP action to perform",
                          enum=["get_inventory", "check_budget", "create_po",
                                "get_gl_codes", "get_cost_centers", "get_po_status",
                                "reserve_budget"]),
            ToolParameter("payload", "object", "Action-specific parameters"),
        ],
        tags=["erp", "sap", "finance", "inventory"],
    )

    def __init__(self, base_url: str, api_key: str, mock_mode: bool = True) -> None:
        super().__init__(max_retries=3, backoff=2.0)
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._mock = mock_mode

    async def _execute(self, action: str, payload: Dict[str, Any] = None) -> Any:
        payload = payload or {}
        if self._mock:
            return await self._mock_execute(action, payload)
        return await self._real_execute(action, payload)

    # ------------------------------------------------------------------
    # Real ERP calls
    # ------------------------------------------------------------------

    async def _real_execute(self, action: str, payload: Dict[str, Any]) -> Any:
        async with httpx.AsyncClient(
            base_url=self._base_url,
            headers={"X-API-Key": self._api_key, "Content-Type": "application/json"},
            timeout=30.0,
        ) as client:
            endpoint_map = {
                "get_inventory":   ("GET",  "/inventory"),
                "check_budget":    ("GET",  "/budget/check"),
                "create_po":       ("POST", "/purchase-orders"),
                "get_gl_codes":    ("GET",  "/gl-codes"),
                "get_cost_centers": ("GET", "/cost-centers"),
                "get_po_status":   ("GET",  f"/purchase-orders/{payload.get('po_number')}"),
                "reserve_budget":  ("POST", "/budget/reserve"),
            }
            method, path = endpoint_map[action]
            if method == "GET":
                resp = await client.get(path, params=payload)
            else:
                resp = await client.post(path, json=payload)
            resp.raise_for_status()
            return resp.json()

    # ------------------------------------------------------------------
    # Mock ERP (development / CI)
    # ------------------------------------------------------------------

    async def _mock_execute(self, action: str, payload: Dict[str, Any]) -> Any:
        logger.debug("MOCK ERP | action=%s | payload=%s", action, payload)

        if action == "get_inventory":
            material = payload.get("material_code", "MAT-001")
            return {
                "material_code": material,
                "description": f"Mock material {material}",
                "stock_on_hand": random.randint(0, 500),
                "reorder_point": 50,
                "unit_of_measure": "EA",
                "last_updated": datetime.utcnow().isoformat(),
            }

        elif action == "check_budget":
            cost_center = payload.get("cost_center", "CC-1000")
            amount = Decimal(str(payload.get("amount", 0)))
            available = Decimal(str(random.randint(1_000_000, 100_000_000)))
            return {
                "cost_center": cost_center,
                "requested_amount": float(amount),
                "available_budget": float(available),
                "is_available": amount <= available,
                "fiscal_year": datetime.utcnow().year,
            }

        elif action == "create_po":
            po_number = "PO-" + "".join(random.choices(string.digits, k=8))
            return {
                "po_number": po_number,
                "sap_document_number": "45" + "".join(random.choices(string.digits, k=8)),
                "status": "created",
                "created_at": datetime.utcnow().isoformat(),
                "lines_created": len(payload.get("lines", [])),
            }

        elif action == "get_gl_codes":
            category = payload.get("category", "general")
            return {
                "category": category,
                "gl_codes": [
                    {"code": "6100100", "description": "Materials & Consumables"},
                    {"code": "6200200", "description": "Services & Contractors"},
                    {"code": "6300300", "description": "Maintenance & Repair"},
                    {"code": "6400400", "description": "IT & Communications"},
                ],
            }

        elif action == "get_cost_centers":
            return {
                "cost_centers": [
                    {"code": "CC-1000", "description": "Production Operations"},
                    {"code": "CC-2000", "description": "Maintenance"},
                    {"code": "CC-3000", "description": "Administration"},
                    {"code": "CC-4000", "description": "IT"},
                ],
            }

        elif action == "get_po_status":
            return {
                "po_number": payload.get("po_number"),
                "status": random.choice(["open", "partially_delivered", "completed"]),
                "delivery_date": (datetime.utcnow() + timedelta(days=14)).isoformat(),
            }

        elif action == "reserve_budget":
            return {
                "reservation_id": "BR-" + "".join(random.choices(string.digits, k=6)),
                "cost_center": payload.get("cost_center"),
                "amount_reserved": payload.get("amount"),
                "reserved_at": datetime.utcnow().isoformat(),
                "valid_until": (datetime.utcnow() + timedelta(days=30)).isoformat(),
            }

        raise ValueError(f"Unknown ERP action: {action}")
