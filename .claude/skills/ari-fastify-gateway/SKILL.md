---
name: ari-fastify-gateway
description: Fastify gateway patterns for ARI's loopback-only security boundary
triggers:
  - "gateway setup"
  - "fastify route"
  - "api endpoint"
  - "loopback server"
---

# ARI Fastify Gateway

## Purpose

Manage ARI's Fastify-based gateway with enforced loopback-only binding (ADR-001).

## Core Constraint

**Gateway MUST bind to 127.0.0.1 exclusively. This is HARDCODED and non-configurable.**

## Gateway Configuration

```typescript
// src/kernel/gateway.ts
import fastify from 'fastify';

const gateway = fastify({
  logger: pinoLogger,
});

// HARDCODED - DO NOT CHANGE
const HOST = '127.0.0.1';
const PORT = config.gateway?.port ?? 3141;

await gateway.listen({ host: HOST, port: PORT });
```

## Route Patterns

### Message Ingestion
```typescript
gateway.post('/message', {
  schema: {
    body: MessageSchema,
    response: { 200: ResponseSchema }
  },
  preHandler: [sanitizeMiddleware, auditMiddleware],
  handler: async (request, reply) => {
    const sanitized = sanitizer.sanitize(request.body);
    await eventBus.emit('message:accepted', sanitized);
    return { status: 'accepted', id: sanitized.id };
  }
});
```

### Health Check
```typescript
gateway.get('/health', async () => ({
  status: 'healthy',
  version: config.version,
  uptime: process.uptime()
}));
```

### Audit Verification
```typescript
gateway.get('/audit/verify', async () => {
  const result = await audit.verifyChain();
  return { valid: result.valid, events: result.eventCount };
});
```

## Security Middleware

### Request Sanitization
```typescript
const sanitizeMiddleware = async (request) => {
  const risk = sanitizer.assessRisk(request.body);
  if (risk >= 0.8) {
    throw new SecurityError('Request blocked: high risk score');
  }
};
```

### Audit Logging
```typescript
const auditMiddleware = async (request) => {
  await eventBus.emit('audit:log', {
    action: 'request_received',
    method: request.method,
    path: request.url,
    timestamp: new Date().toISOString()
  });
};
```

## Error Handling

```typescript
gateway.setErrorHandler(async (error, request, reply) => {
  await eventBus.emit('audit:log', {
    action: 'request_error',
    error: error.message,
    statusCode: error.statusCode || 500
  });

  reply.status(error.statusCode || 500).send({
    error: 'Internal Server Error',
    // Never expose internal error details
  });
});
```

## Testing

```bash
# Start gateway
npm run gateway:start

# Test health
curl http://127.0.0.1:3141/health

# Test message (will be sanitized)
curl -X POST http://127.0.0.1:3141/message \
  -H "Content-Type: application/json" \
  -d '{"content": "test message"}'
```

## Why Loopback-Only?

- Eliminates entire classes of remote attacks
- No network exposure = no network vulnerabilities
- All external access must go through local processes
- Simplifies security model dramatically
