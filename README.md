<div align="center">

```
    ░█████╗░██████╗░██╗
    ██╔══██╗██╔══██╗██║
    ███████║██████╔╝██║
    ██╔══██║██╔══██╗██║
    ██║░░██║██║░░██║██║
    ╚═╝░░╚═╝╚═╝░░╚═╝╚═╝
```

**The system that watches while you sleep.**

[![CI](https://github.com/ARI-OS/ARI/actions/workflows/ci.yml/badge.svg)](https://github.com/ARI-OS/ARI/actions/workflows/ci.yml)

</div>

---

ARI is a local-first autonomous agent. It runs on your machine, makes decisions on your behalf, and keeps a cryptographic record of everything it does.

It doesn't phone home. It doesn't harvest your data. It works for you.

```
127.0.0.1:3141
```

That's the only address that matters.

---

## Philosophy

Three ideas, borrowed from better thinkers:

**Shadow Integration** — Don't suppress what seems dangerous. Log it. Study it. The shadow reveals truth. *(Jung)*

**Radical Transparency** — Every operation is audited. Every decision is traceable. No hidden state. *(Dalio)*

**Ruthless Simplicity** — Every line of code must justify its existence. Choose obvious over clever. *(Musashi)*

---

## Architecture

```
┌───────────────────────────────────────────────────────┐
│  INTERFACES       CLI · Dashboard · SMS · Pushover    │
├───────────────────────────────────────────────────────┤
│  EXECUTION        Daemon                              │
├───────────────────────────────────────────────────────┤
│  STRATEGIC        Council · Arbiter · Overseer        │
├───────────────────────────────────────────────────────┤
│  CORE             Guardian · Planner · Executor       │
├───────────────────────────────────────────────────────┤
│  SYSTEM           Router · Storage                    │
├───────────────────────────────────────────────────────┤
│  KERNEL           Gateway · Sanitizer · Audit         │
└───────────────────────────────────────────────────────┘
```

Six layers. Strict boundaries. Everything passes through the kernel.

---

## Security

| Principle | Implementation |
|-----------|----------------|
| Loopback only | Gateway binds to `127.0.0.1`. No exceptions. |
| Content ≠ Command | Messages are data. Never executable. |
| Immutable audit | SHA-256 hash chain from genesis. |
| Least privilege | Three checks before any tool runs. |
| Trust levels | Six tiers. Hostile = 2x risk multiplier. |

---

## Install

```bash
git clone https://github.com/ARI-OS/ARI.git
cd ARI
npm install
npm run build
```

## Initialize

```bash
npx ari onboard init
npx ari doctor
npx ari gateway start
```

## Use

```bash
curl http://127.0.0.1:3141/health

curl -X POST http://127.0.0.1:3141/message \
  -H "Content-Type: application/json" \
  -d '{"content": "What needs my attention?", "source": "operator"}'
```

---

## Notifications

| Level | Channels | When |
|-------|----------|------|
| P0 | Pushover + SMS | Always |
| P1 | Pushover | Errors |
| P2 | Pushover | Waking hours |
| P3 | Notion | Quiet |
| P4 | Notion | Batched |

Quiet hours: 10pm–7am. Rate limited. Your sleep matters.

---

## Development

```bash
npm run build      # compile
npm run dev        # watch
npm test           # 187 tests
npm run lint       # style
```

---

## Documentation

- [CLAUDE.md](CLAUDE.md) — AI context
- [SECURITY.md](docs/SECURITY.md) — Threat model
- [ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) — Design
- [CONTRIBUTING.md](CONTRIBUTING.md) — Help wanted

---

<div align="center">

<br>

*"The shadow reveals truth."*

<br>

**[Pryce Hedrick](https://github.com/PryceHedrick)** — Creator

**[Claude](https://anthropic.com)** — Collaborator

<br>

One machine. One owner. Full autonomy.

<br>

<sub>[ARI License](LICENSE) · 2024–2026</sub>

</div>
