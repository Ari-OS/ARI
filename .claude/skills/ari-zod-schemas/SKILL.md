---
name: ari-zod-schemas
description: Zod schema management for ARI's type-safe runtime validation
triggers:
  - "create schema"
  - "validate types"
  - "zod schema"
  - "add config validation"
---

# ARI Zod Schema Management

## Purpose

ARI uses Zod for all config and data structure validation (ADR-006). This skill ensures:

- All new types have corresponding Zod schemas
- Runtime validation matches TypeScript types
- Config changes update schemas first
- Environment variables are validated

## ARI's Schema Location

All Zod schemas live in: `src/kernel/types.ts`

## Core Schemas

```typescript
// Trust levels with risk multipliers
const TrustLevelSchema = z.enum([
  'SYSTEM',    // 0.5x
  'OPERATOR',  // 0.6x
  'VERIFIED',  // 0.75x
  'STANDARD',  // 1.0x
  'UNTRUSTED', // 1.5x
  'HOSTILE'    // 2.0x
]);

// Audit event for hash chain
const AuditEventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  action: z.string(),
  agent: z.string().optional(),
  details: z.record(z.unknown()),
  previousHash: z.string(),
  hash: z.string()
});

// Message schema
const MessageSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  trustLevel: TrustLevelSchema,
  timestamp: z.string().datetime(),
  metadata: z.record(z.unknown()).optional()
});
```

## Workflow

### When Adding New Types

1. Define Zod schema FIRST in types.ts
2. Export inferred TypeScript type
3. Use schema for validation at boundaries
4. Add tests for schema validation

```typescript
// 1. Define schema
export const NewFeatureSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  config: z.record(z.string())
});

// 2. Export type
export type NewFeature = z.infer<typeof NewFeatureSchema>;

// 3. Validate at boundary
const validated = NewFeatureSchema.parse(untrustedInput);
```

### When Adding Environment Variables

1. Update env schema in config.ts
2. Update .env.example
3. Update .env
4. Update code

```typescript
const EnvSchema = z.object({
  ARI_PORT: z.coerce.number().default(3141),
  ARI_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  // Add new vars here FIRST
});
```

## Schema Patterns for ARI

### Event Payloads

```typescript
const EventPayloadSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('message'), data: MessageSchema }),
  z.object({ type: z.literal('audit'), data: AuditEventSchema }),
]);
```

### Config Validation

```typescript
const ConfigSchema = z.object({
  gateway: z.object({
    host: z.literal('127.0.0.1'), // Enforces loopback-only
    port: z.number().min(1024).max(65535)
  }),
  security: z.object({
    maxRiskScore: z.number().min(0).max(1).default(0.8)
  })
});
```

## Security Considerations

- Always validate external input with Zod
- Use `.strict()` to reject unknown keys
- Sanitize before validation (injection patterns)
- Log validation failures to audit trail
