---
name: ari-pino-logging
description: Pino structured logging patterns for ARI
triggers:
  - "logging"
  - "pino logger"
  - "log format"
  - "structured logs"
---

# ARI Pino Logging

## Purpose

Structured logging with Pino for ARI's observability and debugging needs.

## Logger Configuration

```typescript
// src/kernel/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.ARI_LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  }
});
```

## Log Levels

| Level | When to Use |
|-------|-------------|
| `fatal` | System crash, unrecoverable |
| `error` | Operation failed, needs attention |
| `warn` | Unexpected but handled |
| `info` | Normal operations (default) |
| `debug` | Development details |
| `trace` | Very detailed tracing |

## Structured Logging Patterns

### Request Logging

```typescript
logger.info({
  event: 'request_received',
  method: 'POST',
  path: '/message',
  requestId: 'uuid',
  trustLevel: 'STANDARD'
}, 'Incoming request');
```

### Security Events

```typescript
logger.warn({
  event: 'injection_detected',
  category: 'sql',
  riskScore: 0.65,
  source: 'gateway'
}, 'Potential injection attempt');
```

### Agent Operations

```typescript
logger.info({
  event: 'agent_task',
  agent: 'planner',
  taskId: 'uuid',
  action: 'decompose'
}, 'Agent processing task');
```

### Error Logging

```typescript
logger.error({
  event: 'operation_failed',
  error: error.message,
  stack: error.stack,
  context: { taskId, agent }
}, 'Operation failed');
```

## Child Loggers

Create context-specific loggers:

```typescript
// Per-agent logger
const guardianLogger = logger.child({ agent: 'guardian' });
guardianLogger.info({ risk: 0.3 }, 'Threat assessment complete');

// Per-request logger
const requestLogger = logger.child({ requestId: 'uuid' });
requestLogger.info('Processing started');
```

## Integration with Audit

Pino logs and audit trail serve different purposes:

| Pino Logs | Audit Trail |
|-----------|-------------|
| Operational debugging | Legal compliance |
| Can be rotated | Immutable forever |
| Human readable | Hash-chained |
| Debug/development | Security evidence |

```typescript
// Log for debugging
logger.debug({ taskId }, 'Task starting');

// Audit for compliance
eventBus.emit('audit:log', {
  action: 'task_started',
  taskId,
  timestamp: new Date().toISOString()
});
```

## Performance

Pino is designed for high performance:

```typescript
// Use lazy evaluation for expensive operations
logger.debug({
  data: () => expensiveComputation()
}, 'Debug data');

// Avoid in hot paths
if (logger.isLevelEnabled('trace')) {
  logger.trace({ details: getDetails() }, 'Trace');
}
```

## Production Configuration

```typescript
// Production: JSON output, no pretty printing
const logger = pino({
  level: 'info',
  formatters: {
    level: (label) => ({ level: label })
  },
  timestamp: pino.stdTimeFunctions.isoTime
});
```
