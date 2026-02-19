# ARI Roadmap

> *ARI — Artificial Reasoning Intelligence. Personal AI operating system, built for Pryce Hedrick.*

## Status: Active Development

ARI is in active production use on a Mac Mini (24/7 daemon) with Telegram as the primary interface.

---

## Phase Status (as of February 2026)

### Complete ✅
| Phase | Description | Key Deliverable |
|-------|-------------|-----------------|
| 0 | Foundation | 7-layer architecture, security invariants, EventBus |
| 1 | Intelligence | AI orchestration, model routing, 20+ models |
| 2 | Infrastructure | VectorStore, EmbeddingService, HealthMonitor, BackupManager |
| 3 | Knowledge | RAG pipeline, ingestion, temporal memory |
| 3.5 | Hardening | API routes, Notion client consolidation, Zod validation |
| 4 | Market Intelligence | Portfolio tracking, price alerts, opportunity scanner |
| 5 | Autonomous Operations | 45 scheduled tasks, initiative engine, soul evolution |
| 6 | Market Intelligence+ | Perplexity enrichment, Pokemon TCG, BTC/ETH/SOL alerts |
| 7 | Video Automation | HeyGen → AssemblyAI → FFmpeg → YouTube |
| 8 | Observability | Langfuse cost tracking, prompt versioning, latency monitoring |
| 9 | Agent Coordination | Lane queue, autonomy dial (0.0-1.0), parallel dispatch |
| 10 | Voice Interface | ElevenLabs TTS, Whisper STT, voice Telegram messages |
| 11 | Soul Evolution | Weekly SOUL.md proposals, character arc tracking |
| 12 | Self-Improvement | Weekly analysis, capability gap detection, skill synthesis |
| 13 | Governance Council | 15-voice constitutional AI council |
| 14 | Content Engine | Twitter/LinkedIn/YouTube multi-platform content |
| 15 | Knowledge Graph | Entity relationships, cross-domain synthesis |
| 16 | Research Agents | Web research, source validation, citation tracking |
| 17 | Life Monitor | Food journal (USDA API), health patterns |
| 18 | CRM | Contact management, relationship scoring |
| 19 | Email Integration | Gmail IMAP/SMTP, priority classification |
| 20 | Temporal Context | Session continuity, event reconstruction |
| 21-29 | Advanced Phases | SEO engine, geolocation optimizer, session state, analytics |

---

## Near-Term (Q1 2026)

### Stability & Reliability
- [ ] Morning briefing consistent delivery (6:30 AM daily via Telegram)
- [ ] Daemon auto-restart on crash with Telegram alert
- [ ] 99.5%+ uptime target on Mac Mini
- [ ] All 29 phases end-to-end verified (not just committed)

### Intelligence Improvements
- [ ] Market alerts firing correctly on threshold breach
- [ ] Pokemon TCG price monitoring active (TCGPlayer integration)
- [ ] Career tracker scanning 5-10 job opportunities/week
- [ ] RAG query returning relevant results from ingested documents

### Pryceless Solutions Integration
- [ ] CRM tracking first client leads
- [ ] Invoice generation from Telegram command
- [ ] Time tracking integration (Toggl)
- [ ] Client communication templates

---

## Medium-Term (Q2 2026)

### AI Capabilities
- [ ] Claude claude-opus-4.6 for council decisions (quality chain)
- [ ] Batch processing pipeline for non-urgent operations
- [ ] Embedding deduplication for VectorStore efficiency
- [ ] Streaming responses in Telegram (typing indicator)

### Integrations
- [ ] Google Calendar bidirectional sync (read + write)
- [ ] Spotify "focus mode" automation (playlist by task type)
- [ ] Readwise integration (highlight synthesis)
- [ ] Stripe webhook for payment notifications

### Content & Growth
- [ ] PayThePryce content calendar automation
- [ ] YouTube Shorts pipeline fully operational
- [ ] LinkedIn post scheduler with AI-generated content
- [ ] Analytics dashboard (engagement, follower growth)

---

## Long-Term (Q3-Q4 2026)

### AI Job Search
- [ ] Automated application tracking and follow-up
- [ ] Interview preparation with role-specific context
- [ ] Salary negotiation briefings
- [ ] Target: AI role at $75K+

### Platform Evolution
- [ ] iOS companion app (read-only dashboard)
- [ ] Web dashboard (React, loopback-only API)
- [ ] Voice-first interaction (ElevenLabs + Whisper)
- [ ] Multi-device sync (MacBook Air + Mac Mini + iPhone)

### Business Growth
- [ ] Pryceless Solutions: 5+ clients
- [ ] PayThePryce: 1,000+ followers
- [ ] MRR target: $1,000+/month

---

## Architecture Principles (Immutable)

These will not change regardless of feature additions:

1. **Loopback-only gateway** — 127.0.0.1 forever (ADR-001)
2. **SHA-256 hash chain audit** — Immutable, append-only (ADR-002)
3. **EventBus single coupling** — No direct cross-layer imports (ADR-003)
4. **Seven-layer architecture** — L0 through L6 (ADR-004)
5. **Content ≠ Command** — All input is data, never executable (ADR-005)

---

## What ARI Is NOT

ARI will not become:
- A multi-user SaaS product
- A general-purpose chatbot platform
- An autonomous trading bot with real money at risk
- A replacement for human judgment on consequential decisions

ARI is deeply personal — optimized for one person's workflow, values, and goals.

---

*Last updated: February 2026 · Version 2.3.0*
