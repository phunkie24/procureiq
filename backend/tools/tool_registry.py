"""
tools/tool_registry.py
MCP-style tool registry — Ch.10 Model Context Protocol, Ch.5 Tool Use.

Tools are self-describing (name, description, parameters schema).
The registry supports dynamic discovery, exactly as MCP specifies.
Agents call tools by name; the registry handles dispatch and audit.
"""

from __future__ import annotations

import asyncio
import inspect
import json
import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Type

from pydantic import BaseModel

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tool definition
# ---------------------------------------------------------------------------

@dataclass
class ToolParameter:
    name: str
    type: str           # "string" | "number" | "boolean" | "object" | "array"
    description: str
    required: bool = True
    enum: Optional[List[Any]] = None
    default: Any = None


@dataclass
class ToolDefinition:
    """MCP-compatible tool descriptor. Sent to the LLM for function calling."""
    name: str
    description: str
    parameters: List[ToolParameter] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)   # for filtering/discovery

    def to_anthropic_tool(self) -> Dict[str, Any]:
        """Serialise in Anthropic tool_use format."""
        properties: Dict[str, Any] = {}
        required: List[str] = []
        for p in self.parameters:
            prop: Dict[str, Any] = {"type": p.type, "description": p.description}
            if p.enum:
                prop["enum"] = p.enum
            if p.default is not None:
                prop["default"] = p.default
            properties[p.name] = prop
            if p.required:
                required.append(p.name)
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": {
                "type": "object",
                "properties": properties,
                "required": required,
            },
        }

    def to_openai_tool(self) -> Dict[str, Any]:
        """Serialise in OpenAI function-calling format."""
        anthropic = self.to_anthropic_tool()
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": anthropic["input_schema"],
            },
        }


# ---------------------------------------------------------------------------
# Base tool class
# ---------------------------------------------------------------------------

@dataclass
class ToolResult:
    success: bool
    data: Any
    error: Optional[str] = None
    latency_ms: float = 0.0

    def to_json(self) -> str:
        return json.dumps(
            {"success": self.success, "data": self.data, "error": self.error},
            default=str,
        )


class BaseTool(ABC):
    """
    Abstract base for all procurement tools.
    Implements retry + idempotency (Ch.12 Exception Handling).
    """

    definition: ToolDefinition  # Class-level, set by subclass

    def __init__(self, max_retries: int = 3, backoff: float = 2.0) -> None:
        self._max_retries = max_retries
        self._backoff = backoff

    @abstractmethod
    async def _execute(self, **kwargs: Any) -> Any:
        """Core tool logic — implement in subclass."""

    async def run(self, **kwargs: Any) -> ToolResult:
        """
        Public entry point with retry, timing, and error handling.
        Ch.12 Exception Handling & Recovery.
        """
        start = time.perf_counter()
        last_error: Optional[Exception] = None

        for attempt in range(1, self._max_retries + 1):
            try:
                data = await self._execute(**kwargs)
                latency = (time.perf_counter() - start) * 1000
                logger.info(
                    "TOOL OK | %s | attempt=%d | latency=%.1fms",
                    self.definition.name, attempt, latency,
                )
                return ToolResult(success=True, data=data, latency_ms=latency)
            except Exception as exc:
                last_error = exc
                logger.warning(
                    "TOOL FAIL | %s | attempt=%d/%d | error=%s",
                    self.definition.name, attempt, self._max_retries, exc,
                )
                if attempt < self._max_retries:
                    await asyncio.sleep(self._backoff ** (attempt - 1))

        latency = (time.perf_counter() - start) * 1000
        return ToolResult(
            success=False,
            data=None,
            error=str(last_error),
            latency_ms=latency,
        )


# ---------------------------------------------------------------------------
# Tool Registry (MCP Server analogue)
# ---------------------------------------------------------------------------

class ToolRegistry:
    """
    Central tool registry — MCP Server pattern (Ch.10).
    Supports dynamic discovery: agents query available tools by tag/name.
    """

    def __init__(self) -> None:
        self._tools: Dict[str, BaseTool] = {}

    def register(self, tool: BaseTool) -> None:
        name = tool.definition.name
        self._tools[name] = tool
        logger.info("Tool registered: %s", name)

    def get(self, name: str) -> Optional[BaseTool]:
        return self._tools.get(name)

    def discover(self, tags: Optional[List[str]] = None) -> List[ToolDefinition]:
        """
        MCP-style discovery — returns tool definitions, optionally filtered by tags.
        """
        defs = []
        for tool in self._tools.values():
            if tags is None or any(t in tool.definition.tags for t in tags):
                defs.append(tool.definition)
        return defs

    def as_anthropic_tools(self, tags: Optional[List[str]] = None) -> List[Dict]:
        return [d.to_anthropic_tool() for d in self.discover(tags)]

    async def call(self, name: str, **kwargs: Any) -> ToolResult:
        tool = self.get(name)
        if not tool:
            return ToolResult(success=False, data=None, error=f"Unknown tool: {name}")
        return await tool.run(**kwargs)


# ---------------------------------------------------------------------------
# Global registry singleton
# ---------------------------------------------------------------------------

_registry: Optional[ToolRegistry] = None


def get_registry() -> ToolRegistry:
    global _registry
    if _registry is None:
        _registry = ToolRegistry()
    return _registry


def register_tool(tool: BaseTool) -> BaseTool:
    """Decorator / call to register a tool instance."""
    get_registry().register(tool)
    return tool
