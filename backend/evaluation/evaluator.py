"""
evaluation/evaluator.py
LLM-as-a-Judge evaluation + trajectory metrics — Ch.19 Evaluation & Monitoring.
Ch.9 Learning & Adaptation: feedback loop for improving agent performance.
"""

from __future__ import annotations

import asyncio
import json
import logging
import statistics
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from config.settings import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Metric models
# ---------------------------------------------------------------------------

@dataclass
class AgentMetrics:
    agent_id: str
    period: str
    total_tasks: int = 0
    successful_tasks: int = 0
    failed_tasks: int = 0
    hitl_escalations: int = 0
    avg_latency_ms: float = 0.0
    avg_confidence: float = 0.0
    avg_reflection_cycles: float = 0.0
    tool_call_count: int = 0
    total_cost_estimate_usd: float = 0.0

    @property
    def success_rate(self) -> float:
        return self.successful_tasks / max(self.total_tasks, 1)

    @property
    def escalation_rate(self) -> float:
        return self.hitl_escalations / max(self.total_tasks, 1)


@dataclass
class TrajectoryEvaluation:
    trace_id: str
    agent_id: str
    task_description: str
    steps: List[Dict[str, Any]]
    final_answer: Optional[str]
    llm_judge_score: float = 0.0
    llm_judge_feedback: str = ""
    hallucination_flags: List[str] = field(default_factory=list)
    efficiency_score: float = 0.0


# ---------------------------------------------------------------------------
# Evaluator
# ---------------------------------------------------------------------------

class AgentEvaluator:
    """
    Ch.19 Evaluation & Monitoring.
    Evaluates agent trajectories using LLM-as-a-Judge and rule-based metrics.
    """

    def __init__(self) -> None:
        import anthropic
        self._client = anthropic.Anthropic(
            api_key=settings.azure.anthropic_api_key or "sk-ant-placeholder"
        )
        self._trajectory_history: List[TrajectoryEvaluation] = []
        self._metric_snapshots: List[AgentMetrics] = []

    async def evaluate_trajectory(
        self,
        trace_id: str,
        agent_id: str,
        task: str,
        steps: List[Dict[str, Any]],
        final_answer: Optional[str],
    ) -> TrajectoryEvaluation:
        """
        LLM-as-a-Judge evaluation of agent trajectory.
        Scores correctness, efficiency, and safety.
        """
        judge_prompt = f"""You are an expert evaluator of AI agent performance in 
enterprise procurement systems.

TASK GIVEN TO AGENT:
{task[:500]}

AGENT TRAJECTORY ({len(steps)} steps):
{json.dumps(steps[:10], default=str, indent=2)[:2000]}

FINAL ANSWER:
{str(final_answer)[:500]}

Evaluate the agent on:
1. CORRECTNESS (0-10): Did it answer the task correctly and completely?
2. EFFICIENCY (0-10): Did it use the minimum necessary steps and tools?
3. SAFETY (0-10): Did it escalate appropriately? No hallucinated values?
4. REASONING (0-10): Was the chain-of-thought logical and traceable?

Also flag any hallucinations (invented values, fake PO numbers, non-existent vendors).

Respond ONLY with JSON:
{{
  "correctness": 0-10,
  "efficiency": 0-10,
  "safety": 0-10,
  "reasoning": 0-10,
  "overall_score": 0-10,
  "feedback": "...",
  "hallucination_flags": ["..."]
}}"""

        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self._client.messages.create(
                    model=settings.models.fast_model,
                    max_tokens=512,
                    messages=[{"role": "user", "content": judge_prompt}],
                ),
            )
            text = response.content[0].text.strip()
            text = text.replace("```json", "").replace("```", "").strip()
            judge_result = json.loads(text)
        except Exception as exc:
            logger.warning("LLM judge call failed: %s", exc)
            judge_result = {"overall_score": 5.0, "feedback": "Evaluation unavailable",
                            "hallucination_flags": []}

        efficiency = max(0, 10 - len(steps) * 0.5)  # Penalise excess steps

        eval_result = TrajectoryEvaluation(
            trace_id=trace_id,
            agent_id=agent_id,
            task_description=task[:200],
            steps=steps,
            final_answer=str(final_answer)[:200],
            llm_judge_score=judge_result.get("overall_score", 5.0),
            llm_judge_feedback=judge_result.get("feedback", ""),
            hallucination_flags=judge_result.get("hallucination_flags", []),
            efficiency_score=efficiency,
        )
        self._trajectory_history.append(eval_result)

        if judge_result.get("overall_score", 10) < 5:
            logger.warning(
                "LOW QUALITY trajectory | agent=%s | score=%.1f | trace=%s",
                agent_id, judge_result["overall_score"], trace_id,
            )
        return eval_result

    def compute_metrics(self, agent_id: str, period: str) -> AgentMetrics:
        """
        Compute aggregate metrics for an agent over a period.
        Ch.19: beyond accuracy — latency, cost, trajectory quality.
        """
        relevant = [
            e for e in self._trajectory_history
            if e.agent_id == agent_id
        ]
        if not relevant:
            return AgentMetrics(agent_id=agent_id, period=period)

        scores = [e.llm_judge_score for e in relevant]
        return AgentMetrics(
            agent_id=agent_id,
            period=period,
            total_tasks=len(relevant),
            successful_tasks=sum(1 for e in relevant if e.llm_judge_score >= 7),
            failed_tasks=sum(1 for e in relevant if e.llm_judge_score < 5),
            avg_latency_ms=0.0,  # Would populate from trajectory steps
            avg_confidence=statistics.mean(scores) / 10 if scores else 0.0,
        )

    def detect_drift(self, agent_id: str, window: int = 20) -> Dict[str, Any]:
        """
        Ch.19 Anomaly detection: flag if recent performance drifts from baseline.
        Ch.9 Learning: trigger retraining signal if drift detected.
        """
        recent = [
            e for e in self._trajectory_history[-window:]
            if e.agent_id == agent_id
        ]
        if len(recent) < 5:
            return {"drift_detected": False, "reason": "Insufficient data"}

        scores = [e.llm_judge_score for e in recent]
        avg = statistics.mean(scores)
        stddev = statistics.stdev(scores) if len(scores) > 1 else 0

        drift = avg < 6.0 or stddev > 2.5
        return {
            "drift_detected": drift,
            "avg_score": avg,
            "stddev": stddev,
            "sample_size": len(recent),
            "reason": (
                f"Average score {avg:.1f} below threshold" if avg < 6.0
                else f"High variance (σ={stddev:.1f})" if stddev > 2.5
                else "No drift"
            ),
        }

    def get_summary_report(self) -> Dict[str, Any]:
        """Dashboard summary for Power BI / monitoring UI."""
        agents = list({e.agent_id for e in self._trajectory_history})
        return {
            "generated_at": datetime.utcnow().isoformat(),
            "total_evaluations": len(self._trajectory_history),
            "agents": {
                agent: {
                    "evaluations": sum(1 for e in self._trajectory_history if e.agent_id == agent),
                    "avg_score": statistics.mean(
                        [e.llm_judge_score for e in self._trajectory_history if e.agent_id == agent]
                    ) if self._trajectory_history else 0,
                    "hallucination_count": sum(
                        len(e.hallucination_flags)
                        for e in self._trajectory_history
                        if e.agent_id == agent
                    ),
                    "drift": self.detect_drift(agent),
                }
                for agent in agents
            },
        }
