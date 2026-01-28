# Changelog

All notable changes to ARI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.0.0] - 2026-01-26 — 影武者 Kagemusha Protocol

Complete architectural rebuild from the ground up. The Kagemusha Protocol
discards all prior implementation and delivers a production-grade TypeScript
WebSocket gateway that integrates the shadow rather than fighting it, cuts
with warrior precision, and records everything in radical transparency.

### Added

**Gateway Service**
- WebSocket server bound exclusively to 127.0.0.1 (hardcoded, not configurable)
- Configurable port (default: 18789)
- Health check endpoint
- Session management with heartbeat monitoring
- Graceful shutdown handling

**Input Sanitization**
- 5-stage sanitization pipeline (rate limit, encoding, control chars, size, patterns)
- Shadow pattern detection (log, don't block)
- Suspicious pattern logging to audit trail
- Configurable sanitization rules
- Content vs. command separation enforcement

**Audit System**
- Hash-chained SHA-256 audit log
- Tamper-evident JSONL format
- Append-only log storage in `~/.ari/audit.jsonl`
- Chain verification command
- Real-time tail functionality
- Timestamp indexing

**Event Bus**
- Typed pub/sub event system
- Topic-based subscriptions with wildcard support
- Event type registry
- WebSocket event streaming
- Memory-based implementation

**CLI Interface**
- `ari gateway start` — Start gateway service
- `ari gateway status` — Check gateway status
- `ari audit list` — List audit entries
- `ari audit verify` — Verify hash chain integrity
- `ari audit tail` — Watch audit log in real-time
- `ari onboard init` — Initialize configuration
- `ari onboard install-daemon` — Install macOS launchd daemon
- `ari doctor` — Run system diagnostics
- `ari refine` — Test prompt refiner (pure function)

**Prompt Refiner**
- Pure function implementation (no side effects)
- Input normalization
- Pattern-based refinement
- Testable and deterministic

**macOS Integration**
- launchd plist generation
- Daemon installation and management
- Auto-start on boot support
- Log file management

**Documentation**
- Architecture documentation with version evolution
- Security model and threat analysis
- Operations guide
- Engineering principles guide
- API protocol reference
- Governance framework
- Contributing guidelines
- Code of Conduct
- Security policy

**Development Infrastructure**
- TypeScript strict mode (all flags enabled)
- Vitest test framework — 56 tests passing
- ESLint and Prettier setup
- Build pipeline

### Security Features

- Loopback-only binding (127.0.0.1) — hardcoded
- 5-stage input sanitization with shadow detection
- SHA-256 hash-chained tamper-evident audit trail
- Token-bucket rate limiting per sender
- No remote access capability
- No eval, no command execution, no tool calls

### Architecture Decisions

- Local-first design (no cloud dependencies)
- WebSocket for real-time communication
- JSONL for audit storage (human-readable, append-only)
- Pure functions for core logic (testable, deterministic)
- Event-driven architecture for extensibility
- Zod schemas for runtime type validation

### Known Limitations

- Event bus is memory-based (not persistent across restarts)
- Single-node only (no distributed support)
- macOS-only daemon support (Linux systemd planned)
- No agent execution framework (planned for future phase)

### Breaking Changes

Complete rewrite — no compatibility with v1.x (Sentinel) or v2.x (Aurora).

---

## [2.0.0] — Aurora Protocol (Legacy)

> *Dawn of the Universal Life OS*

The Aurora Protocol expanded ARI from a security-focused agent gateway into a
full personal operating system. Aurora introduced life management contexts,
venture tracking, and broader ambitions for what a local AI assistant could be.

### Highlights

- Expanded scope to "Universal Life OS"
- Added context namespaces (ventures, life, health, finance)
- Multi-domain personal data management
- Early multi-agent coordination patterns

### Retrospective

Aurora's ambition outpaced its architecture. The system grew organically
without strict boundaries, making it difficult to reason about security
properties or test individual components. The Kagemusha Protocol (v3.0.0)
was born from the realization that ARI needed to be rebuilt from scratch
with ruthless simplicity.

---

## [1.0.0] — Sentinel Protocol (Legacy)

> *The watchful guardian*

The Sentinel Protocol was ARI's first incarnation — a security-hardened
multi-agent architecture focused on safe AI interactions.

### Highlights

- First multi-agent interaction framework
- Security-first design philosophy
- Input validation and monitoring
- Foundation of the "CONTENT ≠ COMMAND" principle

### Retrospective

Sentinel proved that a constitutional approach to AI agent security was viable.
Its core insight — that content should never be treated as commands — became
the philosophical bedrock that carried through every subsequent version.

---

## Version History

| Version | Protocol | Date | Summary |
|---------|----------|------|---------|
| v3.0.0 | Kagemusha | 2026-01-26 | Production TypeScript gateway, 56 tests, hash-chained audit |
| v2.0.0 | Aurora | Legacy | Universal Life OS expansion |
| v1.0.0 | Sentinel | Legacy | First security-hardened multi-agent architecture |

[Unreleased]: https://github.com/PryceHedrick/ari-vnext/compare/v3.0.0...HEAD
[3.0.0]: https://github.com/PryceHedrick/ari-vnext/releases/tag/v3.0.0
[2.0.0]: https://github.com/PryceHedrick/ARI/releases/tag/v2.0.0
[1.0.0]: https://github.com/PryceHedrick/ARI/releases/tag/v1.0.0
