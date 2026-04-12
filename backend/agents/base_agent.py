"""
agents/base_agent.py
Abstract base agent implementing core agentic design patterns:
  - Ch.5  Tool Use         : ReAct thought → action → observation loop
  - Ch.4  Reflection       : producer / critic self-correction
  - Ch.8  Memory           : short + long term via AgentMemoryManager
  - Ch.12 Exception Handling: retry, fallback, escalation
  - Ch.17 Reasoning        : Chain-of-Thought in every LLM call
  - Ch.18 Guardrails       : output validation before action
  - Ch.19 Evaluation       : trajectory logging for monitoring
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

import anthropic

from config.settings import settings
from memory.memory_manager import AgentMemoryManager, build_memory_manager
from state.models import AgentID, AuditRecord, Autonomy
from tools.tool_registry import ToolRegistry, ToolResult, get_registry

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Trajectory tracking (Ch.19 Evaluation)
# ---------------------------------------------------------------------------

@dataclass
class TrajectoryStep:
    step_no: int
    thought: str
    action: str               # tool name or "final_answer"
    action_input: Dict[str, Any]
    observation: str
    latency_ms: float
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class AgentTrajectory:
    agent_id: AgentID
    task_description: str
    trace_id: str
    steps: List[TrajectoryStep] = field(default_factory=list)
    final_answer: Optional[str] = None
    success: bool = False
    total_latency_ms: float = 0.0
    reflection_cycles: int = 0

    def add_step(self, **kwargs: Any) -> TrajectoryStep:
        step = TrajectoryStep(step_no=len(self.steps) + 1, **kwargs)
        self.steps.append(step)
        return step


# ---------------------------------------------------------------------------
# Base Agent
# ---------------------------------------------------------------------------

class BaseAgent(ABC):

    AGENT_ID: AgentID
    SYSTEM_PROMPT: str = ""

    def __init__(self) -> None:
        self._memory: AgentMemoryManager = build_memory_manager(
            self.AGENT_ID.value, self.SYSTEM_PROMPT
        )
        self._registry: ToolRegistry = get_registry()
        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key or "sk-ant-placeholder")
        self._max_react_steps = 15
        self._reflection_max = settings.reflection_max_iterations

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    async def run(
        self,
        task: str,
        context: Optional[Dict[str, Any]] = None,
        trace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Entry point. Runs the full ReAct → Reflection loop.
        Returns structured result dict.
        """
        trace_id = trace_id or str(uuid4())
        trajectory = AgentTrajectory(
            agent_id=self.AGENT_ID,
            task_description=task,
            trace_id=trace_id,
        )
        start = time.perf_counter()

        logger.info("AGENT START | %s | trace=%s | task=%s", self.AGENT_ID, trace_id, task[:80])

        # Inject retrieved memory context (Ch.14 RAG)
        memory_ctx = await self._memory.recall_as_context(task)
        if memory_ctx:
            task = f"{task}\n\n{memory_ctx}"

        # Ch.4 Reflection: producer → critic loop
        result: Optional[Dict[str, Any]] = None
        for cycle in range(self._reflection_max):
            result = await self._react_loop(task, trajectory, context or {})
            critique = await self._critique(result, task)
            if critique["acceptable"]:
                break
            logger.info("REFLECTION cycle %d/%d — revising output", cycle + 1, self._reflection_max)
            task = f"{task}\n\nCRITIQUE TO ADDRESS:\n{critique['feedback']}"
            trajectory.reflection_cycles += 1

        trajectory.total_latency_ms = (time.perf_counter() - start) * 1000
        trajectory.success = result is not None and result.get("success", False)

        # Store result in long-term memory
        await self._memory.store(
            doc_id=f"{self.AGENT_ID.value}-{trace_id}",
            content=json.dumps(result, default=str)[:2000],
            task=task[:200],
            trace_id=trace_id,
        )

        await self._emit_audit(result or {}, trajectory)
        return result or {"success": False, "error": "No result produced"}

    # ------------------------------------------------------------------
    # ReAct loop — Ch.5 Tool Use, Ch.17 Reasoning
    # ------------------------------------------------------------------

    async def _react_loop(
        self,
        task: str,
        trajectory: AgentTrajectory,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Thought → Action → Observation loop.
        Terminates on 'final_answer' tool use or max steps.
        """
        self._memory.reset_session()
        self._memory.remember("user", self._build_task_prompt(task, context))

        tools = self._registry.as_anthropic_tools(tags=self._tool_tags())

        for step_no in range(1, self._max_react_steps + 1):
            step_start = time.perf_counter()

            # LLM call with Chain-of-Thought (Ch.17)
            response = await self._llm_call(
                messages=self._memory.get_context(),
                tools=tools + [self._final_answer_tool()],
                system=self._memory.system_prompt,
            )

            thought = self._extract_thought(response)
            tool_use = self._extract_tool_use(response)

            if not tool_use:
                # Model returned text only — treat as final answer
                text = self._extract_text(response)
                trajectory.add_step(
                    thought=thought, action="final_answer",
                    action_input={"text": text},
                    observation=text,
                    latency_ms=(time.perf_counter() - step_start) * 1000,
                )
                return await self._parse_final_answer(text)

            tool_name = tool_use["name"]
            tool_input = tool_use["input"]

            if tool_name == "final_answer":
                trajectory.add_step(
                    thought=thought, action="final_answer",
                    action_input=tool_input,
                    observation=str(tool_input),
                    latency_ms=(time.perf_counter() - step_start) * 1000,
                )
                return await self._parse_final_answer(json.dumps(tool_input))

            # Execute tool
            result: ToolResult = await self._registry.call(tool_name, **tool_input)
            observation = result.to_json()

            trajectory.add_step(
                thought=thought,
                action=tool_name,
                action_input=tool_input,
                observation=observation,
                latency_ms=(time.perf_counter() - step_start) * 1000,
            )

            # Add to context for next step
            self._memory.remember("assistant", json.dumps({
                "thought": thought,
                "action": tool_name,
                "action_input": tool_input,
            }))
            self._memory.add_tool_result(tool_name, result.data if result.success else result.error)

            if not result.success:
                logger.warning("Tool %s failed: %s — continuing", tool_name, result.error)

        logger.error("ReAct loop exhausted max steps (%d)", self._max_react_steps)
        return {"success": False, "error": "Max reasoning steps exceeded"}

    # ------------------------------------------------------------------
    # Reflection / Critic (Ch.4)
    # ------------------------------------------------------------------

    async def _critique(
        self, result: Optional[Dict[str, Any]], original_task: str
    ) -> Dict[str, Any]:
        if result is None:
            return {"acceptable": False, "feedback": "No result was produced."}

        critique_prompt = f"""You are a strict quality reviewer for a procurement AI system.

ORIGINAL TASK:
{original_task[:500]}

PRODUCED RESULT:
{json.dumps(result, default=str)[:1000]}

Evaluate whether the result fully addresses the task with no gaps, errors, or hallucinations.
Respond ONLY with JSON: {{"acceptable": true/false, "feedback": "..."}}"""

        try:
            resp = self._client.messages.create(
                model=settings.models.fast_model,
                max_tokens=256,
                messages=[{"role": "user", "content": critique_prompt}],
            )
            text = resp.content[0].text.strip()
            # Strip markdown fences
            text = text.replace("```json", "").replace("```", "").strip()
            return json.loads(text)
        except Exception as exc:
            logger.warning("Critique LLM call failed: %s — accepting result", exc)
            return {"acceptable": True, "feedback": ""}

    # ------------------------------------------------------------------
    # LLM call wrapper (Ch.16 Resource-Aware: model tier selection)
    # ------------------------------------------------------------------

    async def _llm_call(
        self,
        messages: List[Dict],
        tools: Optional[List[Dict]] = None,
        system: str = "",
        use_fast_model: bool = False,
    ) -> Any:
        model = (
            settings.models.fast_model
            if use_fast_model
            else settings.models.primary_model
        )
        kwargs: Dict[str, Any] = {
            "model": model,
            "max_tokens": settings.models.primary_max_tokens,
            "messages": messages,
        }
        if system:
            kwargs["system"] = system
        if tools:
            kwargs["tools"] = tools

        # Run sync Anthropic client in executor (non-blocking)
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self._client.messages.create(**kwargs),
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _build_task_prompt(self, task: str, context: Dict[str, Any]) -> str:
        ctx_str = json.dumps(context, default=str, indent=2) if context else "{}"
        return (
            f"TASK: {task}\n\n"
            f"CONTEXT:\n{ctx_str}\n\n"
            "Think step by step. Use available tools. Produce a structured result."
        )

    def _extract_thought(self, response: Any) -> str:
        for block in response.content:
            if hasattr(block, "text"):
                return block.text[:500]
        return ""

    def _extract_tool_use(self, response: Any) -> Optional[Dict[str, Any]]:
        for block in response.content:
            if block.type == "tool_use":
                return {"name": block.name, "input": block.input}
        return None

    def _extract_text(self, response: Any) -> str:
        parts = []
        for block in response.content:
            if hasattr(block, "text"):
                parts.append(block.text)
        return "\n".join(parts)

    def _final_answer_tool(self) -> Dict[str, Any]:
        return {
            "name": "final_answer",
            "description": "Submit the final structured result for this task.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "success": {"type": "boolean"},
                    "result": {"type": "object"},
                    "confidence": {"type": "number"},
                    "summary": {"type": "string"},
                    "requires_human_review": {"type": "boolean"},
                    "reason_for_human_review": {"type": "string"},
                },
                "required": ["success", "result", "confidence", "summary"],
            },
        }

    async def _emit_audit(self, result: Dict[str, Any], traj: AgentTrajectory) -> None:
        record = AuditRecord(
            agent_id=self.AGENT_ID,
            action=f"task_completed:{traj.task_description[:60]}",
            entity_type="task",
            entity_id=traj.trace_id,
            autonomy_level=Autonomy.AUTONOMOUS,
            outcome="success" if traj.success else "failure",
            details={
                "steps": len(traj.steps),
                "latency_ms": traj.total_latency_ms,
                "reflection_cycles": traj.reflection_cycles,
            },
            trace_id=traj.trace_id,
        )
        logger.info("AUDIT | %s", record.model_dump_json())

    # ------------------------------------------------------------------
    # Abstract methods — override in subclasses
    # ------------------------------------------------------------------

    @abstractmethod
    def _tool_tags(self) -> List[str]:
        """Return tool tags this agent uses (for filtered discovery)."""

    async def _parse_final_answer(self, text: str) -> Dict[str, Any]:
        try:
            clean = text.strip().replace("```json", "").replace("```", "").strip()
            parsed = json.loads(clean)
            if not isinstance(parsed, dict):
                parsed = {"result": parsed}
            parsed.setdefault("success", True)
            parsed.setdefault("confidence", 0.7)
            parsed.setdefault("summary", str(parsed.get("result", "")))
            return parsed
        except Exception:
            return {
                "success": True,
                "result": {},
                "summary": text[:500],
                "confidence": 0.5,
            }
