# ARI Networking Architecture

> Security through isolation, accessibility through intention.

---

## The ARI Difference

ARI is not a CLI tool you invoke. ARI is a **persistent cognitive system** — your Life Operating System that runs 24/7, processes information autonomously, and serves as your extended intelligence.

This fundamental difference shapes every networking decision:

| Aspect | CLI Tool (Claude Code) | Life Operating System (ARI) |
|--------|------------------------|----------------------------|
| Lifecycle | Starts/stops with terminal | Runs continuously as daemon |
| Scope | Current project | Your entire digital life |
| Access | Direct invocation | Multiple interfaces (CLI, Dashboard, API, Mobile) |
| Location | Wherever you run it | Fixed infrastructure (Mac Mini) |
| State | Ephemeral | Persistent memory, audit trail, learning |
| Security Model | Process isolation | Network isolation + cryptographic audit |

---

## Three-Zone Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ZONE 3: EXTERNAL                               │
│                                                                          │
│   Public Internet ─── NOT ACCESSIBLE ─── No inbound connections          │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                           ZONE 2: TAILSCALE                              │
│                                                                          │
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐     │
│   │  MacBook Pro    │    │   iPhone/iPad   │    │  Other Devices  │     │
│   │  (Operator)     │◄──►│  (Operator)     │◄──►│  (Operator)     │     │
│   └────────┬────────┘    └────────┬────────┘    └────────┬────────┘     │
│            │                      │                      │               │
│            └──────────────────────┼──────────────────────┘               │
│                                   │                                      │
│                           100.x.x.x (Tailscale)                          │
│                                   │                                      │
├───────────────────────────────────┼─────────────────────────────────────┤
│                           ZONE 1: LOOPBACK                               │
│                                   │                                      │
│   ┌───────────────────────────────▼───────────────────────────────────┐ │
│   │                         MAC MINI                                   │ │
│   │                                                                    │ │
│   │  ┌──────────────────────────────────────────────────────────────┐ │ │
│   │  │                    ARI GATEWAY                                │ │ │
│   │  │                                                               │ │ │
│   │  │   127.0.0.1:3141 ◄─── ONLY THIS ─── Loopback Only             │ │ │
│   │  │                                                               │ │ │
│   │  │   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │ │ │
│   │  │   │ Kernel  │ │ System  │ │ Agents  │ │Governance│           │ │ │
│   │  │   └─────────┘ └─────────┘ └─────────┘ └─────────┘            │ │ │
│   │  │                                                               │ │ │
│   │  └──────────────────────────────────────────────────────────────┘ │ │
│   │                                                                    │ │
│   │  ┌──────────────────────────────────────────────────────────────┐ │ │
│   │  │                    SSH + TAILSCALE                            │ │ │
│   │  │                                                               │ │ │
│   │  │   <MAC_MINI_IP>:22 ◄─── Operator Access Only                 │ │ │
│   │  │                                                               │ │ │
│   │  └──────────────────────────────────────────────────────────────┘ │ │
│   │                                                                    │ │
│   └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Zone Definitions

### Zone 1: Loopback (Core)

**Principle**: The ARI Gateway binds ONLY to `127.0.0.1`. This is immutable.

```typescript
// src/kernel/gateway.ts — This is hardcoded, not configurable
const HOST = '127.0.0.1';  // NEVER change this
const PORT = config.port || 3141;
```

**Why**:
- Eliminates entire classes of remote attacks
- No firewall rules needed — network stack itself blocks external access
- Defense in depth — even if Tailscale were compromised, ARI remains isolated

**Access Pattern**:
```bash
# From Mac Mini itself (local)
curl http://127.0.0.1:3141/health

# From remote via SSH tunnel
ssh <USER>@<MAC_MINI_IP> "curl -s http://127.0.0.1:3141/health"
```

### Zone 2: Tailscale (Operator Network)

**Principle**: Tailscale provides encrypted, authenticated access to the Mac Mini. This is the only way to reach ARI remotely.

**What Tailscale Provides**:
- WireGuard encryption (state-of-the-art)
- Device authentication via identity provider
- No port forwarding required
- Works through NAT/firewalls
- Audit log of all connections

**What We Use**:
- SSH access to Mac Mini: `ssh <USER>@<MAC_MINI_IP>`
- CLI invocation via SSH: `ssh <USER>@<MAC_MINI_IP> "cd ~/ARI && node dist/cli/index.js doctor"`
- Dashboard access via SSH tunnel: `ssh -L 5173:127.0.0.1:5173 <USER>@<MAC_MINI_IP>`

**What We DON'T Use**:
- Tailscale Serve — We don't expose ARI Gateway directly
- Tailscale Funnel — We don't expose anything to the public internet
- Direct API access — All access goes through SSH

### Zone 3: External (Hostile)

**Principle**: The public internet never touches ARI directly.

**Implementation**:
- No ports open to the internet
- Mac Mini behind router NAT (no port forwarding)
- Tailscale ACLs restrict who can access

---

## Access Patterns

### Pattern 1: CLI via SSH

The primary interaction model. SSH into Mac Mini, run CLI commands.

```bash
# Health check
ssh <USER>@<MAC_MINI_IP> "cd ~/ARI && node dist/cli/index.js doctor"

# Gateway operations
ssh <USER>@<MAC_MINI_IP> "cd ~/ARI && node dist/cli/index.js gateway status"

# Submit a message
ssh <USER>@<MAC_MINI_IP> "cd ~/ARI && node dist/cli/index.js message 'Plan my day'"
```

**Security**:
- Requires Tailscale authentication
- Requires SSH key or password
- Runs as local user on Mac Mini
- Full audit trail

### Pattern 2: Dashboard via SSH Tunnel

For visual interface access.

```bash
# From MacBook Pro
ssh -L 5173:127.0.0.1:5173 -L 3141:127.0.0.1:3141 <USER>@<MAC_MINI_IP>

# Then open browser to http://localhost:5173
```

**Security**:
- All traffic encrypted through SSH tunnel
- Appears as loopback on both ends
- No direct network exposure

### Pattern 3: API via SSH Tunnel

For programmatic access from remote devices.

```bash
# Establish tunnel
ssh -L 3141:127.0.0.1:3141 <USER>@<MAC_MINI_IP> -N &

# Use local port
curl http://localhost:3141/health
curl -X POST http://localhost:3141/message -d '{"content": "Hello"}'
```

### Pattern 4: Mobile Access (Future)

For iPhone/iPad access, we'll create an ARI client app that:
1. Establishes Tailscale connection
2. Opens SSH tunnel to Mac Mini
3. Communicates with ARI Gateway through tunnel
4. Provides native UI for key operations

**No Tailscale Serve/Funnel** — The client handles the tunneling.

---

## Why NOT Tailscale Serve?

Tailscale Serve would expose ARI Gateway directly on the Tailscale network:

```bash
# We could do this, but we don't
tailscale serve 3141
# Would make ARI available at https://mac-mini.tailnet-name.ts.net
```

**Why we don't**:

1. **Defense in Depth**: Even within Tailscale, we add SSH as another authentication layer
2. **Audit Granularity**: SSH provides command-level audit logs
3. **Flexibility**: SSH tunnels work with any protocol
4. **Consistency**: Same access pattern from anywhere
5. **Principle of Least Privilege**: Only what's needed, when it's needed

---

## Why NOT Loopback Everywhere?

Some might ask: "Why not just run ARI on each device locally?"

**Answer**: ARI is a Life Operating System with:

| Feature | Why It Needs Centralization |
|---------|----------------------------|
| Persistent Memory | Single source of truth for memories |
| Continuous Learning | 24/7 processing, not just when you invoke |
| Audit Chain | Immutable log that can't be on multiple machines |
| Autonomous Operations | Background tasks run regardless of your devices |
| Context Accumulation | Learns from everything, always |

A distributed ARI would be multiple separate instances. A centralized ARI is one continuous intelligence.

---

## Security Properties

### What's Protected

| Threat | Mitigation |
|--------|------------|
| Remote code execution | Loopback-only Gateway, no external ports |
| Man-in-the-middle | WireGuard encryption (Tailscale) + SSH encryption |
| Unauthorized access | Tailscale auth + SSH auth + ARI trust levels |
| Data interception | All traffic encrypted end-to-end |
| Rogue device | Tailscale device approval + SSH keys |
| Audit tampering | SHA-256 hash chain, append-only log |
| Injection attacks | 27-pattern Sanitizer, Content ≠ Command |

### Attack Surface

The only network attack surface is:
1. Tailscale daemon (audited, well-maintained)
2. SSH daemon (battle-tested, key-only auth recommended)

ARI Gateway itself has **zero network attack surface** — it literally cannot receive external connections.

---

## Configuration

### Mac Mini Tailscale

```bash
# Already configured
tailscale status
# ari-mac-mini  <MAC_MINI_IP>  macOS   -

# ACL recommendations (in Tailscale admin):
{
  "acls": [
    {
      "action": "accept",
      "src": ["tag:operator"],
      "dst": ["tag:ari-server:22"]
    }
  ]
}
```

### SSH Configuration

```bash
# ~/.ssh/config on operator devices
Host ari
    HostName <MAC_MINI_IP>
    User <USER>
    IdentityFile ~/.ssh/ari_ed25519
    LocalForward 3141 127.0.0.1:3141
    LocalForward 5173 127.0.0.1:5173
```

Then simply:
```bash
ssh ari
# Tunnels established automatically
```

### Daemon Configuration

ARI runs as a macOS daemon, restarting on failure:

```bash
# Check daemon status
launchctl list | grep ari

# Logs
tail -f ~/Library/Logs/ari-gateway.log
```

---

## Future: Opening ARI (Commercialization Path)

When/if ARI becomes a product, the architecture scales:

### Phase 1: Personal (Current)
- Single Mac Mini per operator
- Full loopback security model
- Direct SSH/Tailscale access

### Phase 2: Team
- Shared ARI instance for small teams
- Tailscale Teams for access control
- Role-based trust levels in ARI

### Phase 3: Hosted
- Cloud-hosted ARI instances
- Proper API gateway with OAuth
- Tenant isolation
- The loopback principle still applies internally

The loopback-only design isn't a limitation — it's a foundation. The Gateway always binds to loopback; what changes is what sits in front of it.

---

## Summary

| Question | Answer |
|----------|--------|
| Where does ARI Gateway bind? | `127.0.0.1:3141` only, always |
| How do I access remotely? | SSH via Tailscale |
| Should I use Tailscale Serve? | No — SSH tunnels provide better security |
| Should I use Tailscale Funnel? | Never — no public internet exposure |
| Can I run ARI on multiple machines? | No — it's a centralized Life OS |
| Is this more secure than cloud? | Yes — zero network attack surface |
| Can this scale to a product? | Yes — add layers in front, keep loopback core |

---

## Commands Reference

```bash
# Check ARI health remotely
ssh ari "cd ~/ARI && node dist/cli/index.js doctor"

# Start/stop gateway
ssh ari "cd ~/ARI && node dist/cli/index.js gateway start"
ssh ari "cd ~/ARI && node dist/cli/index.js gateway stop"

# Access dashboard (run locally, opens tunnel)
ssh -L 5173:127.0.0.1:5173 -L 3141:127.0.0.1:3141 ari

# Full API access (run locally)
ssh -L 3141:127.0.0.1:3141 ari -N &
curl http://localhost:3141/health
```

---

## ARI vs. OpenClaw vs. Claude Code

ARI exists at a **higher level of abstraction** than both OpenClaw and Claude Code. This is not just marketing — it's architectural reality.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         LEVEL 3: LIFE OPERATING SYSTEM                  │
│                                                                          │
│   ARI — Cognitive Layer, Constitutional Governance, Learning Loop        │
│   • LOGOS (Bayesian reasoning, Kelly criterion, decision trees)          │
│   • ETHOS (Bias detection, emotional state, discipline checks)           │
│   • PATHOS (CBT reframing, Stoic philosophy, wisdom tradition)           │
│   • 15-member Council with voting thresholds                             │
│   • Immutable SHA-256 audit chain                                        │
│   • Autonomous operations (scheduled tasks, learning loops)              │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                         LEVEL 2: PERSONAL AI ASSISTANT                   │
│                                                                          │
│   OpenClaw — Multi-channel messaging, skill modules, Canvas              │
│   • Connects to WhatsApp, Telegram, Slack, Discord, etc.                 │
│   • Tool-first architecture with ClawHub skills                          │
│   • WebSocket Gateway for channel orchestration                          │
│   • Focus: Task execution across messaging platforms                     │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                         LEVEL 1: DEVELOPMENT TOOL                        │
│                                                                          │
│   Claude Code — CLI for software development                             │
│   • Invoked per-session, per-project                                     │
│   • Ephemeral state (no persistent memory)                               │
│   • Focus: Code generation and project assistance                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Differentiators

| Capability | Claude Code | OpenClaw | ARI |
|------------|-------------|----------|-----|
| **Cognitive Layer** | ❌ | ❌ | ✅ LOGOS/ETHOS/PATHOS |
| **Constitutional Governance** | ❌ | ❌ | ✅ Council + Arbiter + Overseer |
| **Immutable Audit** | ❌ | Partial | ✅ SHA-256 hash chain |
| **Trust Levels** | ❌ | DM pairing | ✅ 6-level with risk multipliers |
| **Continuous Learning** | ❌ | ❌ | ✅ 5-stage learning loop |
| **Bias Detection** | ❌ | ❌ | ✅ 10 cognitive biases |
| **Decision Frameworks** | ❌ | ❌ | ✅ Bayesian, Kelly, EV |
| **Philosophical Foundation** | ❌ | ❌ | ✅ Stoic, CBT, Dalio |
| **Multi-Channel Messaging** | ❌ | ✅ | Planned (via integrations) |
| **Messaging Focus** | ❌ | ✅ Primary | Secondary |
| **Development Focus** | ✅ Primary | ❌ | ✅ Part of whole |

### What Makes ARI Different

**1. Cognition, Not Just Execution**

OpenClaw executes tasks. ARI *reasons* about them first:

```
OpenClaw:  User → Gateway → Tool → Response
ARI:       User → Gateway → Cognitive Analysis → Council Vote → Execution → Reflection → Learning
```

Before ARI acts, it asks:
- Is this decision biased? (ETHOS bias detection)
- What's the expected value? (LOGOS EV calculation)
- Does this align with my principles? (PATHOS virtue check)
- Does the Council approve? (Governance vote)

**2. Constitutional Constraints**

ARI has 6 immutable rules that cannot be overridden:
1. Creator Primacy — Serves operator's interests
2. Loopback Only — Security boundary
3. Content ≠ Command — Injection protection
4. Audit Immutable — Tamper-evident logging
5. Least Privilege — Minimal permissions
6. Trust Required — All messages have trust level

OpenClaw has DM pairing for security; ARI has a constitution.

**3. Learning Loop**

ARI runs a 5-stage learning loop:
1. Performance Review (daily)
2. Gap Analysis (weekly)
3. Source Discovery (triggered by gaps)
4. Knowledge Integration (continuous)
5. Self-Assessment (monthly)

This means ARI gets better over time without explicit retraining.

**4. Philosophical Integration**

ARI embeds actual decision-making frameworks:
- **Bayesian reasoning** for belief updating
- **Kelly Criterion** for optimal sizing
- **CBT** for cognitive distortion detection
- **Stoic philosophy** for emotional regulation
- **Dalio's principles** for radical transparency

These aren't marketing terms — they're implemented APIs with tests.

### How They Can Work Together

ARI can *use* OpenClaw as a channel integration layer:

```
┌─────────────────────────────────────────────────────────────┐
│                         ARI                                  │
│   (Cognitive + Governance + Learning)                        │
│                           │                                  │
│                           ▼                                  │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              OpenClaw (Channel Layer)                │   │
│   │   WhatsApp | Telegram | Slack | Discord              │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

Similarly, Claude Code can be invoked *by* ARI for development tasks.

ARI is the orchestrator. OpenClaw and Claude Code are tools in its toolkit.

### The Vision

> **Claude Code** helps you write code.
> **OpenClaw** helps you communicate.
> **ARI** helps you think.

ARI is not competing at the same level — it operates above, providing the cognitive infrastructure that makes AI assistants actually intelligent, not just responsive.

---

*Loopback-only is not a limitation. It's a foundation.*
