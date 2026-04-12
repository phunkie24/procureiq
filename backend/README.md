# Procurement Agent Squadron
### Enterprise Multi-Agent System

A production-grade multi-agent procurement system implementing all 21 agentic AI design
patterns from the reference book, applied to the 5-agent Procurement Squadron.

---

## Architecture

```
orchestrator/
  orchestrator.py        — Central task router & human oversight gateway
  workflow.py            — Durable workflow state machine (prompt chaining + routing)

agents/
  base_agent.py          — Abstract base with tool-use, reflection, memory hooks
  sourcing_agent.py      — Agent 1: RFQ generation & vendor pre-qualification
  bid_eval_agent.py      — Agent 2: Bid scoring & award recommendation
  po_exec_agent.py       — Agent 3: PO generation & ERP write
  contract_agent.py      — Agent 4: Contract monitoring & amendment drafting
  vendor_mgmt_agent.py   — Agent 5: Vendor scorecards & relationship management

tools/
  erp_tool.py            — SAP ECC / ERP read-write integration
  email_tool.py          — Email & vendor portal dispatch
  document_tool.py       — RFQ / PO / contract document generation
  market_data_tool.py    — Market benchmarking & compliance checks
  tool_registry.py       — MCP-style tool registry & discovery

memory/
  short_term.py          — Context window management per agent
  long_term.py           — Azure AI Search vector store wrapper
  memory_manager.py      — Unified memory API (ADK-inspired)

state/
  event_bus.py           — Azure Service Bus event queue abstraction
  state_store.py         — Shared workflow state & audit log writer
  models.py              — Pydantic data models for all procurement entities

guardrails/
  threshold_guard.py     — Autonomous/human delegation threshold enforcement
  output_validator.py    — Structured output validation (schema enforcement)
  safety_checker.py      — Input/output safety & compliance screening

evaluation/
  evaluator.py           — LLM-as-a-Judge agent performance evaluation
  metrics.py             — Latency, cost, accuracy, trajectory metrics
  monitor.py             — Continuous monitoring & anomaly detection

config/
  settings.py            — Central config (Azure endpoints, thresholds, models)
  logging_config.py      — Structured JSON logging setup

tests/
  test_orchestrator.py
  test_agents.py
  test_tools.py
  test_guardrails.py

docs/
  design_patterns.md     — Pattern-to-agent mapping reference
```

---

## Design Patterns Applied

| Pattern (Chapter) | Where Applied |
|---|---|
| Prompt Chaining (Ch.1) | `workflow.py` — sequential procurement pipeline |
| Routing (Ch.2) | `orchestrator.py` — intent-based agent dispatch |
| Parallelization (Ch.3) | `bid_eval_agent.py` — concurrent bid scoring |
| Reflection (Ch.4) | `base_agent.py` — producer/critic self-correction loop |
| Tool Use (Ch.5) | `tool_registry.py` + all `tools/` |
| Planning (Ch.6) | `sourcing_agent.py` — multi-step RFQ planning |
| Multi-Agent (Ch.7) | `orchestrator.py` — squadron coordination |
| Memory Management (Ch.8) | `memory/` — short + long term per agent |
| Learning & Adaptation (Ch.9) | `evaluator.py` — feedback-driven improvement |
| MCP (Ch.10) | `tool_registry.py` — standardized tool discovery |
| Goal Setting (Ch.11) | `workflow.py` — goal-driven procurement lifecycle |
| Exception Handling (Ch.12) | `base_agent.py` — retry, fallback, escalation |
| Human-in-the-Loop (Ch.13) | `threshold_guard.py` + `orchestrator.py` |
| RAG / Knowledge Retrieval (Ch.14) | `long_term.py` — vendor/contract vector search |
| A2A Communication (Ch.15) | `event_bus.py` — inter-agent event protocol |
| Resource-Aware Optimization (Ch.16) | `orchestrator.py` — model tier selection |
| Reasoning Techniques (Ch.17) | `base_agent.py` — CoT + ReAct loop |
| Guardrails (Ch.18) | `guardrails/` — layered safety enforcement |
| Evaluation & Monitoring (Ch.19) | `evaluation/` — trajectory & metric tracking |
| Prioritization (Ch.20) | `orchestrator.py` — task queue prioritization |
| Exploration & Discovery (Ch.21) | `vendor_mgmt_agent.py` — opportunity scanning |

---

## Quick Start

```bash
pip install -r requirements.txt

# Copy and configure
cp config/settings.py.example config/settings.py

# Run orchestrator
python -m orchestrator.orchestrator

# Run tests
pytest tests/ -v
```

---

## Requirements
- Python 3.11+
- Azure OpenAI or Anthropic API key
- Azure Service Bus (or local mock)
- Azure AI Search (or local ChromaDB fallback)
- SAP S/4HANA API access (or mock mode)
