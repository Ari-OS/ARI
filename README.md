<div align="center">

```
        ██████╗ ██████╗ ██╗
       ██╔══██╗██╔══██╗██║
       ███████║██████╔╝██║
       ██╔══██║██╔══██╗██║
       ██║  ██║██║  ██║██║
       ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝
```

### 🖤 Artificial Reasoning Intelligence

**The system that watches while you sleep.**

<br>

[![CI](https://github.com/ARI-OS/ARI/actions/workflows/ci.yml/badge.svg)](https://github.com/ARI-OS/ARI/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-000?logo=typescript&logoColor=3178C6)
![Node](https://img.shields.io/badge/Node.js_20+-000?logo=node.js&logoColor=5FA04E)
[![License](https://img.shields.io/badge/License-ARI_License-000)](LICENSE)

---

*No cloud. No subscriptions. No trust required.*

</div>

<br>

## 🔮 What is this?

ARI is your personal autonomous agent. It runs locally, makes decisions on your behalf, and keeps a tamper-proof record of everything it does.

Think of it as an AI assistant that actually works *for* you—not for some company harvesting your data.

```
📍 127.0.0.1:3141 — the only address that matters
```

<br>

## 🧠 Philosophy

Three principles, stolen from people smarter than me:

| | |
|:---:|---|
| 🌑 | **Shadow Integration** *(Jung)* — Don't suppress what's suspicious. Log it. Understand it. The shadow reveals truth. |
| 👁️ | **Radical Transparency** *(Dalio)* — Every operation audited. Every decision traceable. No hidden state. |
| ⚔️ | **Ruthless Simplicity** *(Musashi)* — Every line must justify its existence. Obvious over clever. Always. |

<br>

## 🏗️ Architecture

Six layers. Strict boundaries. Everything flows through the kernel.

```
┌─────────────────────────────────────────────────────────────────┐
│  🖥️  INTERFACES      CLI · Dashboard · SMS · Pushover          │
├─────────────────────────────────────────────────────────────────┤
│  ⚙️  EXECUTION       Daemon (macOS launchd)                     │
├─────────────────────────────────────────────────────────────────┤
│  ⚖️  STRATEGIC       Council (13) · Arbiter (5) · Overseer      │
├─────────────────────────────────────────────────────────────────┤
│  🤖 CORE             Guardian · Planner · Executor · Memory     │
├─────────────────────────────────────────────────────────────────┤
│  🔀 SYSTEM           Router · Storage                           │
├─────────────────────────────────────────────────────────────────┤
│  🔐 KERNEL           Gateway · Sanitizer · Audit · EventBus     │
└─────────────────────────────────────────────────────────────────┘
                         ↑ trust no one above this line
```

<br>

## 🛡️ Security

Not a feature. The foundation.

| | Invariant | Reality |
|:---:|---|---|
| 🔒 | **Loopback Only** | Gateway binds to `127.0.0.1`. No exceptions. Ever. |
| 📝 | **Content ≠ Command** | Your messages are data. Never instructions. |
| ⛓️ | **Immutable Audit** | SHA-256 hash chain. Tamper = break everything. |
| 🚫 | **Least Privilege** | Three checks before any tool executes. |
| 👤 | **Trust Levels** | Six tiers. Hostile sources get 2x risk multiplier. |

<br>

## 🚀 Quick Start

```bash
# Clone it
git clone https://github.com/ARI-OS/ARI.git
cd ARI

# Build it
npm install && npm run build

# Initialize
npx ari onboard init     # 🏠 Create ~/.ari/
npx ari doctor           # 🩺 Health check
npx ari gateway start    # 🚀 Launch (127.0.0.1:3141)
```

<br>

## 💬 Talk to ARI

```bash
# 💓 Check pulse
curl http://127.0.0.1:3141/health

# 📨 Send a message
curl -X POST http://127.0.0.1:3141/message \
  -H "Content-Type: application/json" \
  -d '{"content": "What needs my attention?", "source": "operator"}'

# 🔍 Verify nothing was tampered with
curl http://127.0.0.1:3141/api/audit/verify
```

<br>

## 📱 Notifications

ARI reaches you through multiple channels based on urgency:

| Priority | Channels | Behavior |
|:---:|---|---|
| 🔴 **P0** Critical | Pushover + SMS | Always. Even at 3am. |
| 🟠 **P1** High | Pushover | Errors, failures, things breaking |
| 🟡 **P2** Normal | Pushover | During waking hours only |
| 🟢 **P3** Low | Notion | Logged quietly |
| ⚪ **P4** Minimal | Notion (batched) | Background noise, batched every 30min |

> 😴 Quiet hours: 10 PM – 7 AM (configurable)
> 🚦 Rate limited: 10 pushes/hour max
> 💤 Your sleep matters.

<br>

## 📁 Project Structure

```
src/
├── 🔐 kernel/         Security boundary. The foundation.
├── 🔀 system/         Message routing and storage.
├── 🤖 agents/         Guardian, Planner, Executor, Memory.
├── ⚖️  governance/     Council, Arbiter, Overseer.
├── 🔌 integrations/   Pushover, Notion, SMS, Claude.
├── ⚙️  ops/            macOS daemon.
└── 💻 cli/            Command line interface.

scripts/
└── 🧠 ari-daemon.ts   The always-on brain.
```

<br>

## 🛠️ Development

```bash
npm run build          # 🔨 Compile TypeScript
npm run dev            # 👀 Watch mode
npm test               # 🧪 187 tests
npm run lint           # ✨ Check style
npm run typecheck      # 📋 Type check
```

<br>

## 📚 Docs

| | Doc | What's inside |
|:---:|---|---|
| 🤖 | [CLAUDE.md](CLAUDE.md) | Context for AI assistants working on ARI |
| 🛡️ | [SECURITY.md](docs/SECURITY.md) | Threat model, invariants, paranoia |
| 🏗️ | [ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) | How it all fits together |
| 🤝 | [CONTRIBUTING.md](CONTRIBUTING.md) | Want to help? Start here |

<br>

---

<div align="center">

<br>

```
        ┌──────────────────────────────────────┐
        │                                      │
        │    "The shadow reveals truth."       │
        │                                      │
        └──────────────────────────────────────┘
```

<br>

🖤

**Created by [Pryce Hedrick](https://github.com/PryceHedrick)**

*with [Claude](https://anthropic.com) — proving humans and AI can build something real together*

<br>

```
One machine. One owner. Full autonomy.
```

<br>

[ARI License](LICENSE) · 2024–2026

<br>

*Your life. Your rules. Fully auditable.* ✨

</div>
