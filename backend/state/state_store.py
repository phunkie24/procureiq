"""
state/state_store.py
Shared workflow state store and audit log writer — Ch.11 Goal Setting.
"""
from __future__ import annotations
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from state.models import AuditRecord, WorkflowStatus

logger = logging.getLogger(__name__)


class WorkflowStateStore:
    """In-memory state store (production: Azure Cosmos DB or Table Storage)."""

    def __init__(self) -> None:
        self._workflows: Dict[str, Dict[str, Any]] = {}
        self._audit_log: List[AuditRecord] = []

    def set_workflow(self, trace_id: str, state: Dict[str, Any]) -> None:
        self._workflows[trace_id] = {**state, "updated_at": datetime.utcnow().isoformat()}

    def get_workflow(self, trace_id: str) -> Optional[Dict[str, Any]]:
        return self._workflows.get(trace_id)

    def update_status(self, trace_id: str, status: WorkflowStatus) -> None:
        if trace_id in self._workflows:
            self._workflows[trace_id]["status"] = status.value
            self._workflows[trace_id]["updated_at"] = datetime.utcnow().isoformat()

    def append_audit(self, record: AuditRecord) -> None:
        self._audit_log.append(record)
        logger.info("AUDIT | %s", record.model_dump_json())

    def get_audit_log(self, agent_id: Optional[str] = None) -> List[Dict]:
        records = self._audit_log
        if agent_id:
            records = [r for r in records if r.agent_id == agent_id]
        return [r.model_dump() for r in records]

    def stats(self) -> Dict[str, Any]:
        return {
            "total_workflows": len(self._workflows),
            "total_audit_records": len(self._audit_log),
            "workflows_by_status": {},
        }


_store: Optional[WorkflowStateStore] = None

def get_state_store() -> WorkflowStateStore:
    global _store
    if _store is None:
        _store = WorkflowStateStore()
    return _store
