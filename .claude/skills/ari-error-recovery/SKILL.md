---
name: ari-error-recovery
description: Error handling, recovery, and resilience patterns for ARI
triggers:
  - "error handling"
  - "error recovery"
  - "resilience"
  - "failure handling"
---

# ARI Error Recovery

## Purpose

Ensure ARI handles errors gracefully, recovers from failures, and maintains system stability.

## Error Philosophy

Per ARI's philosophy: **Don't suppress errors silently. Log, understand, integrate.**

```typescript
// ❌ WRONG: Silent suppression
try {
  await operation();
} catch (error) {
  // Silent failure - NEVER DO THIS
}

// ✅ CORRECT: Log and integrate
try {
  await operation();
} catch (error) {
  await eventBus.emit('audit:log', {
    action: 'operation_failed',
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
  throw error; // Re-throw after logging
}
```

## Error Categories

### 1. Security Errors (Critical)

```typescript
class SecurityError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly riskScore: number
  ) {
    super(message);
    this.name = 'SecurityError';
  }
}

// Usage
throw new SecurityError('Injection detected', 'SEC001', 0.95);
```

### 2. Validation Errors

```typescript
class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

### 3. Agent Errors

```typescript
class AgentError extends Error {
  constructor(
    message: string,
    public readonly agent: string,
    public readonly taskId: string
  ) {
    super(message);
    this.name = 'AgentError';
  }
}
```

### 4. Governance Errors

```typescript
class GovernanceError extends Error {
  constructor(
    message: string,
    public readonly rule: string,
    public readonly proposal: unknown
  ) {
    super(message);
    this.name = 'GovernanceError';
  }
}
```

## Recovery Strategies

### Retry with Backoff

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const delay = baseDelay * Math.pow(2, attempt - 1);
      await sleep(delay);

      eventBus.emit('audit:log', {
        action: 'retry_attempt',
        attempt,
        maxRetries,
        delay
      });
    }
  }
  throw new Error('Unreachable');
}
```

### Circuit Breaker

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
}
```

### Fallback

```typescript
async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>
): Promise<T> {
  try {
    return await primary();
  } catch (primaryError) {
    eventBus.emit('audit:log', {
      action: 'fallback_triggered',
      primaryError: primaryError.message
    });
    return await fallback();
  }
}
```

## Agent Failure Handling

```typescript
eventBus.on('agent:error', async (event) => {
  const { agent, error, taskId } = event;

  // Log the failure
  await eventBus.emit('audit:log', {
    action: 'agent_failure',
    agent,
    error: error.message,
    taskId
  });

  // Attempt recovery based on agent type
  switch (agent) {
    case 'guardian':
      // Security agent failure = block operation
      await eventBus.emit('security:guardian_offline', { taskId });
      break;

    case 'planner':
      // Retry with simpler decomposition
      await eventBus.emit('planner:retry_simple', { taskId });
      break;

    case 'executor':
      // Rollback and retry
      await eventBus.emit('executor:rollback', { taskId });
      break;
  }
});
```

## Graceful Degradation

```typescript
// If memory manager fails, use temporary storage
if (!memoryManager.isAvailable()) {
  logger.warn('Memory manager unavailable, using temporary storage');
  return tempStorage.store(data);
}

// If governance is slow, use cached decisions
if (await governanceTimeout()) {
  const cached = await getCachedDecision(proposal);
  if (cached && cached.age < MAX_CACHE_AGE) {
    return cached.decision;
  }
  throw new GovernanceError('Governance timeout', 'GOV001');
}
```

## Health Checks

```typescript
interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    gateway: boolean;
    agents: Record<string, boolean>;
    governance: boolean;
    audit: boolean;
  };
  lastCheck: string;
}

async function checkHealth(): Promise<HealthStatus> {
  const components = {
    gateway: await pingGateway(),
    agents: await checkAllAgents(),
    governance: await checkGovernance(),
    audit: await verifyAuditChain()
  };

  return {
    overall: calculateOverallHealth(components),
    components,
    lastCheck: new Date().toISOString()
  };
}
```
