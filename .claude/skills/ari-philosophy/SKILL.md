---
name: ari-philosophy
description: Philosophical foundations guiding ARI's design and behavior
triggers: ["/ari-philosophy", "architectural decisions", "design philosophy"]
---

# ARI Philosophy

Four philosophical frameworks guide every ARI decision.

## 1. Radical Transparency (Ray Dalio)

Every decision is traceable and auditable. No hidden state.

**Principles**:
- All operations logged with full context
- No unexplained actions
- Honest feedback, even when uncomfortable

**Code Pattern**:
```typescript
// ✅ CORRECT: Audit state changes
this.eventBus.emit('audit:log', {
  action: 'task_start',
  taskId: task.id,
  timestamp: new Date().toISOString(),
});

// ❌ WRONG: Silent state mutation
this.state = newState;
```

## 2. Shadow Integration (Carl Jung)

Acknowledge and integrate difficult information. Don't suppress.

**Principles**:
- Surface potential risks proactively
- Don't suppress warnings or concerns
- Learn from failures without shame

**Code Pattern**:
```typescript
// ✅ CORRECT: Log and integrate threats
if (riskScore > 0.8) {
  this.eventBus.emit('security:threat_detected', { risk: riskScore });
  throw new SecurityError('Threat detected');
}

// ❌ WRONG: Silent suppression
if (riskScore > 0.8) return;
```

## 3. Ruthless Simplicity (Miyamoto Musashi)

Every action must justify its existence. Prefer clarity over cleverness.

**Principles**:
- One correct solution over many mediocre ones
- Eliminate waste in thought and action
- Every line of code earns its place

**Code Pattern**:
```typescript
// ✅ CORRECT: Clear and straightforward
async processMessage(msg: Message): Promise<void> {
  const sanitized = this.sanitizer.sanitize(msg);
  await this.router.route(sanitized);
}

// ❌ WRONG: Over-engineered
const processMessage = pipe(sanitize, validate, transform, route);
```

## 4. Antifragile Design (Nassim Taleb)

Gain strength from adversity. Embrace controlled chaos for growth.

**Principles**:
- Build redundancy where failure is catastrophic
- Learn faster from small failures than large successes
- Use stress tests to strengthen the system

**Code Pattern**:
```typescript
// ✅ CORRECT: Circuit breaker with learning
if (failureCount > threshold) {
  this.eventBus.emit('resilience:circuit_open', { service, failures });
  await this.fallback();
} else {
  await this.attemptWithRetry();
}

// ❌ WRONG: Brittle without fallback
await this.externalService.call();
```

## Decision Framework

When making architectural decisions:

1. **Can this action be audited?** (Dalio)
2. **Are we hiding any uncomfortable truths?** (Jung)
3. **Is this the simplest solution?** (Musashi)
4. **Will this fail gracefully under stress?** (Taleb)

## Operational Directives

| Principle | Action |
|-----------|--------|
| Prioritize safety | Never compromise security for convenience |
| Think in systems | Consider second and third-order effects |
| Bias toward action | Better to move and correct than wait |
| Preserve optionality | Avoid irreversible decisions without approval |
