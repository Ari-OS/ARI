---
name: ari-trust-levels
description: Manage ARI's six-level trust system with risk multipliers
triggers:
  - "trust level"
  - "risk score"
  - "trust assessment"
  - "permission check"
---

# ARI Trust Level System

## Purpose

Manage ARI's six-level trust system that determines risk multipliers and permission boundaries (ADR-005).

## Trust Levels

| Level | Multiplier | Description | Examples |
|-------|-----------|-------------|----------|
| `SYSTEM` | 0.5x | Internal components | Kernel, EventBus |
| `OPERATOR` | 0.6x | Authenticated operator | CLI commands, Dashboard |
| `VERIFIED` | 0.75x | Verified sources | Known good inputs |
| `STANDARD` | 1.0x | Default | New inputs |
| `UNTRUSTED` | 1.5x | Unverified external | External API responses |
| `HOSTILE` | 2.0x | Known malicious | Flagged sources |

## Risk Calculation

```typescript
function calculateRisk(
  baseRisk: number,
  trustLevel: TrustLevel
): number {
  const multipliers = {
    SYSTEM: 0.5,
    OPERATOR: 0.6,
    VERIFIED: 0.75,
    STANDARD: 1.0,
    UNTRUSTED: 1.5,
    HOSTILE: 2.0
  };

  return baseRisk * multipliers[trustLevel];
}
```

## Auto-Block Threshold

**Risk ≥ 0.8 triggers automatic blocking.**

```typescript
if (calculateRisk(baseRisk, trustLevel) >= 0.8) {
  eventBus.emit('security:threat_blocked', { risk, source });
  throw new SecurityError('Request blocked: risk threshold exceeded');
}
```

## Trust Assignment

### SYSTEM Trust
```typescript
// Internal kernel operations
const kernelMessage = {
  content: '...',
  trustLevel: 'SYSTEM',
  source: 'kernel:sanitizer'
};
```

### OPERATOR Trust
```typescript
// CLI commands from authenticated user
const cliMessage = {
  content: command,
  trustLevel: 'OPERATOR',
  source: 'cli:user'
};
```

### STANDARD Trust (Default)
```typescript
// External input - default trust
const externalMessage = {
  content: input,
  trustLevel: 'STANDARD',
  source: 'gateway:request'
};
```

### UNTRUSTED Trust
```typescript
// External API response
const apiResponse = {
  content: response,
  trustLevel: 'UNTRUSTED',
  source: 'external:api'
};
```

## Permission Gates

### Three-Layer Permission Check
```typescript
async function checkPermission(
  agent: string,
  tool: string,
  trustLevel: TrustLevel
): Promise<boolean> {
  // Layer 1: Agent allowlist
  if (!isAgentAllowed(agent, tool)) return false;

  // Layer 2: Trust level requirement
  if (!meetsMinimumTrust(tool, trustLevel)) return false;

  // Layer 3: Permission tier
  if (!hasPermissionTier(agent, getToolTier(tool))) return false;

  return true;
}
```

### Tool Permission Tiers

| Tier | Trust Required | Tools |
|------|----------------|-------|
| READ | STANDARD | read_file, list_dir |
| WRITE | VERIFIED | write_file, edit_file |
| EXECUTE | OPERATOR | run_command |
| DESTRUCTIVE | SYSTEM | delete_file, system_command |

## Trust Escalation

Trust can only be:
- **Elevated** by explicit OPERATOR action
- **Demoted** automatically on suspicious behavior

```typescript
// Never auto-elevate trust
function canElevateTrust(requester: TrustLevel): boolean {
  return requester === 'OPERATOR' || requester === 'SYSTEM';
}
```

## Audit Integration

All trust decisions are logged:

```typescript
eventBus.emit('audit:log', {
  action: 'trust_decision',
  trustLevel,
  risk: calculatedRisk,
  allowed: riskAllowed,
  source
});
```
