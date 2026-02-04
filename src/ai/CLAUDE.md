# AI Orchestration Layer

**Layer 2 (System)** — Unified LLM pipeline replacing 5 fragmented systems.

## Architecture

```
AIOrchestrator.execute(request)
  ├── Validate (Zod)
  ├── Classify (ValueScorer)
  ├── Budget Check (CostTracker)
  ├── Circuit Breaker
  ├── Model Selection (ValueScorer + ModelRegistry)
  ├── Governance (AIPolicyGovernor → Council)
  ├── Prompt Assembly (PromptAssembler + cache_control)
  ├── API Call (@anthropic-ai/sdk)
  ├── Emit llm:request_complete ← CRITICAL FIX
  ├── Cost Tracking
  ├── Quality Evaluation (ResponseEvaluator)
  └── Return AIResponse
```

## Components

| File | Purpose |
|------|---------|
| types.ts | All Zod schemas (ADR-006) |
| model-registry.ts | Single source of truth for models + pricing |
| value-scorer.ts | ValueScore algorithm + task classification |
| circuit-breaker.ts | Three-state failure protection |
| response-evaluator.ts | Post-response quality assessment |
| prompt-assembler.ts | Prompt construction with cache_control |
| ai-policy-governor.ts | Council governance bridge |
| orchestrator.ts | THE single entry point |

## Layer Rules

- **CAN import from**: Kernel (Layer 1), Observability (Layer 2)
- **CANNOT import from**: Agents (Layer 3), Governance (Layer 4)
- **Council access**: Via CouncilInterface (dependency injection, not import)
- **Communication**: Via EventBus events

## Key Events

| Event | Purpose |
|-------|---------|
| `ai:request_received` | Request entered pipeline |
| `ai:model_selected` | Model chosen with reasoning |
| `ai:response_evaluated` | Quality score + escalation |
| `ai:circuit_breaker_state_changed` | State transition |
| `llm:request_complete` | Tokens + cost → BudgetTracker |

## Feature Flags

Gradual rollout via `~/.ari/ai-config.json`:
- `AI_ORCHESTRATOR_ENABLED` — Master switch
- `AI_ORCHESTRATOR_ROLLOUT_PERCENT` — 0-100 gradual rollout
- `AI_GOVERNANCE_ENABLED` — Council integration
- `AI_QUALITY_ESCALATION_ENABLED` — Auto-upgrade on low quality
- `AI_PROMPT_CACHING_ENABLED` — cache_control on system blocks

Skills: `/ari-model-selection`
