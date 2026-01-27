# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 12.0.x  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in ARI, please report it responsibly.

### How to Report

1. **Do NOT open a public issue** for security vulnerabilities
2. **Use GitHub's private security advisory feature**:
   - Go to the repository's Security tab
   - Click "Report a vulnerability"
   - Fill out the advisory form
3. **Include in your report**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Suggested fix (if available)
   - ARI version affected
   - Environment details (OS, Node.js version)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Fix or mitigation**: Depends on severity (critical issues prioritized)
- **Public disclosure**: Coordinated with reporter after fix is released

### Severity Classification

- **Critical**: Loopback bypass, audit chain manipulation, arbitrary code execution
- **High**: Injection detection bypass, privilege escalation, data exfiltration
- **Medium**: Rate limiting bypass, DoS conditions, configuration weaknesses
- **Low**: Information disclosure, minor logic errors

## Security Model

ARI is built on five foundational security principles:

### 1. Loopback-Only Gateway

The gateway binds exclusively to `127.0.0.1:3141`. No external network access.

- **Implementation**: Hardcoded in `src/kernel/gateway.ts`, not configurable
- **Rationale**: Eliminates entire classes of remote attacks
- **Trade-off**: Requires local access, but that's the design intent

### 2. Content ≠ Command Principle

All inbound messages are treated as DATA, never as executable instructions.

- **Implementation**: Sanitizer scans all input before processing
- **Patterns detected**: 21 injection patterns across 6 categories
- **Action**: Log suspicious patterns, block high-risk content (risk ≥ 0.8)

### 3. SHA-256 Hash Chain Audit Trail

Every audit event is cryptographically chained to its predecessor.

- **Genesis block**: `0x00...00` (64 zeros)
- **Chain integrity**: Verified on startup and available via `ari audit verify`
- **Tampering detection**: Any modification breaks the chain
- **Storage**: `~/.ari/audit.json` (append-only)

### 4. Trust-Level Risk Scoring

Risk scores are weighted by the trust level of the message source.

- **SYSTEM**: 0.5x multiplier (trusted internal operations)
- **TRUSTED**: 1.0x multiplier (authenticated known sources)
- **UNTRUSTED**: 1.5x multiplier (external or unverified sources)
- **Auto-block**: Messages with risk ≥ 0.8 are rejected

### 5. Least Privilege Tool Execution

All tool executions require three-layer permission checks:

1. **Agent allowlist**: Only specified agents can use the tool
2. **Trust level**: Source must meet minimum trust requirement
3. **Permission tier**: Tool classified as READ, WRITE, or DESTRUCTIVE

Destructive operations require explicit user approval.

## Security Architecture

### Injection Detection

The sanitizer detects 21 patterns across 6 categories:

1. **Direct Override** (4 patterns): "ignore previous instructions", "disregard all rules", etc.
2. **Role Manipulation** (4 patterns): "you are now a", "pretend you are", etc.
3. **Command Injection** (3 patterns): "execute the following", "run this code", etc.
4. **Prompt Extraction** (3 patterns): "reveal your instructions", "show system prompt", etc.
5. **Authority Claims** (4 patterns): "I am the administrator", "as your supervisor", etc.
6. **Data Exfiltration** (3 patterns): "send all data to", "export context to", etc.

**Location**: `src/kernel/sanitizer.ts`
**Coverage**: 100% (5 tests)

### Audit Trail Structure

Each audit event contains:

```typescript
{
  timestamp: string;        // ISO 8601
  action: string;           // Event type
  agent: string;            // Source agent or 'SYSTEM'
  details: Record<string, unknown>;  // Event-specific data
  previousHash: string;     // SHA-256 of previous event
  hash: string;            // SHA-256 of this event
}
```

**Location**: `src/kernel/audit.ts`
**Coverage**: 100% (3 tests)

### Guardian Threat Assessment

Real-time threat detection with:

- **Rate limiting**: 60 messages per minute per source
- **Pattern detection**: 8 injection patterns
- **Behavioral analysis**: Anomaly detection for unusual patterns
- **Risk scoring**: Weighted by trust level
- **Auto-block**: Prevents high-risk messages from processing

**Location**: `src/agents/guardian.ts`
**Coverage**: 100% (10 tests)

## Contributor Security Checklist

When contributing code, ensure:

- [ ] No secrets or credentials in code or config
- [ ] All user input is sanitized before processing
- [ ] Security-relevant operations are audited
- [ ] Error messages don't leak sensitive information
- [ ] Trust levels are properly enforced
- [ ] Permission checks are applied before tool execution
- [ ] Tests cover security edge cases
- [ ] Layer boundaries are respected (no bypassing kernel)
- [ ] No external network calls from kernel or system layers

## Scope

### In Scope

Security issues in the following areas are valid for reporting:

- Gateway vulnerabilities (loopback bypass, DoS)
- Input sanitization bypasses
- Audit log integrity issues (hash chain manipulation)
- Permission check bypasses
- Trust level enforcement weaknesses
- Configuration security (file permissions, sensitive data)
- Daemon privilege escalation (macOS launchd)
- CLI command injection

### Out of Scope

The following are not considered security vulnerabilities:

- Issues requiring physical access to the machine
- Social engineering attacks against the operator
- Denial of service against localhost services (expected limitation)
- Issues in third-party dependencies (report to upstream maintainers)
- Feature requests disguised as security issues

## Known Limitations

ARI is designed for single-user, local operation. The following are known limitations by design:

1. **Local access required**: No remote access controls (loopback-only is the security boundary)
2. **Single operator**: No multi-user support or role-based access control
3. **File system permissions**: Relies on OS-level file permissions for `~/.ari/` protection
4. **Daemon privileges**: Runs with user-level privileges (no root access)

## Security Updates

Security updates will be released as patch versions (12.0.x). Critical vulnerabilities will be addressed within 7 days of confirmation.

## Contact

For security-related questions or concerns:

- **GitHub**: Use private security advisory feature
- **Maintainer**: @PryceHedrick

---

**Last Updated**: 2026-01-27
**Version**: 12.0.0
