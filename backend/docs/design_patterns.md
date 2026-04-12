# Design Pattern Mapping — Procurement Agent Squadron

This document maps all 21 agentic AI design patterns from the reference book
to their concrete implementations in this codebase.

---

## Pattern Implementations

### Ch.1 — Prompt Chaining
**File**: `orchestrator/orchestrator.py`
**Where**: `_on_rfq_issued → _on_bid_received → _on_award_recommended → _on_po_issued`
The procurement lifecycle is a chain: each event completion triggers the next agent.
RFQ issued → bids collected → bids evaluated → award → PO issued → PO acknowledged.

---

### Ch.2 — Routing
**File**: `orchestrator/orchestrator.py`
**Where**: `_dispatch()` method, `route_map` dict
Intent-based routing dispatches each `TaskIntent` to the correct agent handler.
The orchestrator classifies the task and routes — agents never call each other directly.

---

### Ch.3 — Parallelization
**Files**: `agents/bid_eval_agent.py`, `agents/vendor_mgmt_agent.py`, `agents/sourcing_agent.py`
**Where**: `evaluate_bids()` scores all bids concurrently with `asyncio.gather()`.
`generate_scorecards()` processes all vendors in parallel.
`scan_and_trigger_rfqs()` scans all inventory categories simultaneously.

---

### Ch.4 — Reflection (Producer/Critic)
**File**: `agents/base_agent.py`
**Where**: `run()` method — `_react_loop()` → `_critique()` loop, max `reflection_max_iterations`.
Every agent output is reviewed by a fast-model critic before being returned.
The critic evaluates completeness, accuracy, and constraint adherence.

---

### Ch.5 — Tool Use (Function Calling)
**Files**: `tools/tool_registry.py`, `tools/erp_tool.py`, `tools/email_tool.py`
**Where**: `ToolRegistry.call()`, `ToolDefinition.to_anthropic_tool()`
All tools are self-describing MCP-style descriptors.
Agents call `registry.as_anthropic_tools()` to get the tool list; the LLM decides which to call.

---

### Ch.6 — Planning
**File**: `agents/sourcing_agent.py`
**Where**: `_plan_and_issue_rfq()`, `issue_rfq_for_requisition()`
The sourcing agent decomposes procurement into an explicit multi-step plan:
inventory check → spec drafting → vendor shortlisting → RFQ generation → issuance.
The plan adapts based on autonomy level and category.

---

### Ch.7 — Multi-Agent Collaboration
**File**: `orchestrator/orchestrator.py`
**Where**: `self._agents` dict, event-driven handoffs via `_bus`
Five specialist agents collaborate: Sourcing → Bid Eval → PO → Contract + Vendor Mgmt.
Communication is via events (A2A), not direct calls. Sequential handoffs + parallel loops.

---

### Ch.8 — Memory Management
**File**: `memory/memory_manager.py`
**Where**: `AgentMemoryManager`, `ShortTermMemory`, `AzureAISearchVectorStore`
Short-term: sliding window context per agent session.
Long-term: Azure AI Search vector store, recalled via `recall_as_context()` per task.
ADK-inspired pattern: Session + State + MemoryService.

---

### Ch.9 — Learning & Adaptation
**File**: `evaluation/evaluator.py`
**Where**: `detect_drift()`, `get_summary_report()`
Trajectory scores feed a drift detector. When avg score drops below 6.0 or variance
rises above σ=2.5, a signal is logged for prompt/threshold adjustment.
Human-in-loop review of low-score trajectories enables supervised improvement.

---

### Ch.10 — Model Context Protocol (MCP)
**File**: `tools/tool_registry.py`
**Where**: `ToolRegistry`, `ToolDefinition`, `discover()`
Tools are self-describing with name, description, typed parameters, and tags.
`discover(tags)` enables dynamic, just-in-time tool discovery — exactly MCP's pattern.
`to_anthropic_tool()` / `to_openai_tool()` enable cross-provider interoperability.

---

### Ch.11 — Goal Setting & Monitoring
**File**: `orchestrator/orchestrator.py`
**Where**: `_active_workflows`, `_monitoring_loop()`, `OrchestratorTask` lifecycle
Each workflow has an explicit goal (e.g., "issue PO for approved award").
The monitoring loop runs hourly scanning for inventory reorder and contract expiry.
Goal completion is tracked via workflow status transitions.

---

### Ch.12 — Exception Handling & Recovery
**Files**: `tools/tool_registry.py`, `agents/base_agent.py`, `orchestrator/orchestrator.py`
**Where**: `BaseTool.run()` retry loop, `_react_loop()` error continuation,
`_dispatch()` try/except + `AGENT_ERROR` event.
Tools retry 3× with exponential backoff. Agent failures emit error events.
Orchestrator publishes `agent.error` for monitoring without crashing the loop.

---

### Ch.13 — Human-in-the-Loop (HITL)
**Files**: `guardrails/threshold_guard.py`, `orchestrator/orchestrator.py`
**Where**: `ThresholdGuard.gate()`, `_pending_hitl`, `human_decision()`
Every financial commitment passes through the threshold gate.
HITL requests are queued in `_pending_hitl` and resolved via `human_decision()`.
`HumanOversightRequest` events are published to the bus for Power Apps / UI consumption.

---

### Ch.14 — Knowledge Retrieval (RAG)
**File**: `memory/memory_manager.py`
**Where**: `recall_as_context()`, `AzureAISearchVectorStore`
Before each agent task, relevant history is retrieved from the vector store.
Vendor scorecards, past RFQs, and contract terms are stored and recalled semantically.
Reduces hallucination by grounding agent reasoning in real historical data.

---

### Ch.15 — Inter-Agent Communication (A2A)
**File**: `state/event_bus.py`
**Where**: `LocalEventBus` / `AzureServiceBusEventBus`, `WorkflowEvent`, `EventTypes`
Agents never call each other directly. All coordination is via typed events.
Events carry `trace_id` for end-to-end correlation across the squadron.
Azure Service Bus provides production-grade delivery guarantees.

---

### Ch.16 — Resource-Aware Optimization
**Files**: `config/settings.py`, `agents/base_agent.py`
**Where**: `ModelConfig`, `_llm_call(use_fast_model=True/False)`
Two model tiers: `primary_model` (claude-sonnet) for complex reasoning,
`fast_model` (claude-haiku) for routing, validation, and critique.
Agents pass `use_fast_model=True` for lightweight classification tasks.

---

### Ch.17 — Reasoning Techniques (CoT + ReAct)
**File**: `agents/base_agent.py`
**Where**: `_react_loop()` — Thought → Action → Observation × N steps
System prompts mandate explicit step-by-step reasoning ("Think step by step").
`_final_answer_tool()` forces structured JSON output with `confidence` score.
ReAct: thought is logged before each action; observation updates context.

---

### Ch.18 — Guardrails & Safety
**Files**: `guardrails/threshold_guard.py`, `guardrails/output_validator.py`
**Where**: Multi-layered: financial gates, confidence gates, policy flags, output schema validation
Layers: (1) input confidence check, (2) policy flag check, (3) financial threshold,
(4) Pydantic output schema validation, (5) shadow mode observation before live.
Blacklisted vendors, sole-source, and first-time vendors always escalate.

---

### Ch.19 — Evaluation & Monitoring
**File**: `evaluation/evaluator.py`
**Where**: `evaluate_trajectory()`, `compute_metrics()`, `detect_drift()`, `get_summary_report()`
LLM-as-a-Judge scores every trajectory on correctness, efficiency, safety, reasoning.
Hallucination flags detect invented values. Drift detection alerts on performance decay.
`get_summary_report()` feeds Power BI dashboard with per-agent KPIs.

---

### Ch.20 — Prioritization
**File**: `orchestrator/orchestrator.py`
**Where**: `asyncio.PriorityQueue`, `PriorityLevel`, task `priority_map`
Tasks are prioritised: CRITICAL=0, HIGH=1, MEDIUM=2, LOW=3.
Emergency/production-stoppage purchases get CRITICAL priority and skip the queue.
HITL resolutions are always submitted at HIGH priority.

---

### Ch.21 — Exploration & Discovery
**File**: `agents/po_exec_agent.py` (vendor_mgmt_agent class)
**Where**: `VendorManagementAgent.discover_new_vendors()`
Proactively scans market data sources for new qualified vendors in thin categories.
Evaluates against Seplat pre-qualification criteria (Nigerian Content, LTIR, D&B).
Returns shortlist with fast-track recommendations for onboarding.
