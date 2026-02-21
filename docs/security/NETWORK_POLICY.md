# ARI Network Policy

How ARI handles network connections — inbound and outbound.

## The Rule, Precisely

**Inbound connections**: Loopback only (`127.0.0.1`). No exceptions. Hardcoded in `src/kernel/gateway.ts`. This means no device on the network can connect to ARI's gateway — only processes running on the same machine.

**Outbound connections**: Allowed to a specific list of services. ARI initiates these calls to deliver notifications, query AI models, and sync data.

These are different directions and different security concerns:

```
INBOUND (blocked)                    OUTBOUND (allowlisted)
─────────────────                    ──────────────────────
Internet ──✖──► ARI Gateway          ARI ──────► Telegram Bot API
LAN      ──✖──► ARI Gateway          ARI ──────► AI Providers
Localhost ──✓──► ARI Gateway          ARI ──────► Notion API
```

## Why This Isn't a Contradiction

"Loopback-only" means ARI's **gateway server** binds to `127.0.0.1`. No external device can send HTTP requests to ARI. This protects against:

- Remote command injection
- Unauthorized message submission
- Network-based attacks

Outbound calls are ARI **initiating** connections as a client to deliver results. The gateway never accepts incoming connections from these services.

## Outbound Allowlist

| Service | Purpose | Protocol | Auth |
|---------|---------|----------|------|
| `api.telegram.org` | Notification delivery | HTTPS | Bot Token |
| `api.anthropic.com` | AI reasoning (Claude) | HTTPS | API Key |
| `api.openai.com` | AI reasoning (GPT) | HTTPS | API Key |
| `api.x.ai` | AI reasoning (Grok) | HTTPS | API Key |
| `openrouter.ai` | AI routing (multi-model) | HTTPS | API Key |
| `api.notion.com` | Knowledge sync | HTTPS | API Key |

All outbound connections:

- Use HTTPS (TLS encrypted)
- Authenticate with API keys stored in environment variables
- Are initiated by ARI, never by the remote service
- Cannot accept inbound data from the remote service (no webhooks)

## Enforcement Points

### Inbound (Gateway) — Hardcoded Constant

Enforced in `src/kernel/gateway.ts:20`:

```typescript
private readonly HOST = '127.0.0.1'; // IMMUTABLE — Constitutional Rule #1
```

Enforced in `src/kernel/constitutional-invariants.ts`:

```typescript
export const RULE_LOOPBACK_ONLY = Object.freeze({
  host: '127.0.0.1',
  validate: (host: string): boolean => host === '127.0.0.1' || host === 'localhost',
});
```

Enforced by pre-commit hook: any file containing `0.0.0.0` binding is blocked.

**Where is this enforced?** In code as a hardcoded constant. Not in config. Not in the PolicyEngine. It's a `private readonly` property — unchangeable at runtime, unchangeable by configuration, blocked at commit time by hooks.

### Outbound (Integration Layer) — Code-Level Per-Integration

Outbound calls happen through specific integration modules:

- `src/integrations/telegram/sender.ts` — Telegram Bot API
- `src/ai/orchestrator.ts` — AI provider routing
- Notion client (when enabled)

**Where is the allowlist enforced?** In code, per integration module. Each module has its API base URL as a constant (e.g., `https://api.telegram.org`). There is no central "allowlist config file" — the allowlist is the set of integration modules that exist in the codebase. Adding a new outbound destination requires writing new code and passing code review.

Each integration:

1. Validates credentials exist before attempting connection
2. Has rate limiting (e.g., Telegram: 30 messages/hour)
3. Logs all outbound calls to the audit trail
4. Fails gracefully if the service is unreachable

### What Happens if a DNS/IP Changes

ARI connects to services by domain name (e.g., `api.telegram.org`), not by IP address. If a service's IP changes:

- **Normal DNS change**: Transparent. Node.js resolves DNS on each connection. No ARI change needed.
- **Domain takeover**: ARI would connect to the new server. Mitigated by TLS — the attacker would need the service's TLS certificate to complete the handshake. API keys provide a second layer (the attacker can't forge valid API responses without them).
- **DNS poisoning on the Mac Mini**: The attacker could redirect ARI to a fake endpoint. Mitigated by TLS certificate validation (Node.js verifies certificates by default). ARI would get a TLS error, log it, and fail gracefully.

## What ARI Cannot Do

- Accept incoming HTTP requests from the network
- Open WebSocket connections from external clients
- Expose any port to the LAN or internet
- Use webhooks (no inbound callback URLs)
- Accept push notifications from services

## What ARI Can Do

- Send notifications via Telegram Bot API
- Query AI providers for reasoning
- Create/update pages in Notion
- All outbound, all HTTPS, all authenticated

## Security Model

```
┌──────────────────────────────────────────────────────────┐
│                    ARI MACHINE                            │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │              ARI PROCESS                           │  │
│  │                                                    │  │
│  │  Gateway ◄── 127.0.0.1 only ──► Local CLI/Dashboard│  │
│  │     │                                              │  │
│  │     ▼                                              │  │
│  │  Sanitizer → Audit → EventBus → Agents            │  │
│  │                                    │               │  │
│  │                                    ▼               │  │
│  │                              Integrations ──────────┼──┼──► Telegram
│  │                                    │               │  │     (outbound)
│  │                              AI Orchestrator ──────┼──┼──► Claude/GPT
│  │                                                    │  │     (outbound)
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ✖ No inbound from network                               │
│  ✓ Outbound to allowlisted HTTPS endpoints               │
└──────────────────────────────────────────────────────────┘
```

## Related

- **Constitutional Rule #1**: Loopback-Only Gateway (`src/kernel/constitutional-invariants.ts`)
- **Gateway Implementation**: `src/kernel/gateway.ts`
- **Threat Model**: `docs/security/THREAT_MODEL.md` (STRIDE analysis)

---

v1.0 · 2026-02-10
