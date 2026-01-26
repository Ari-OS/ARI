# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | Yes                |

## Reporting a Vulnerability

If you discover a security vulnerability in ARI vNext, please report it
responsibly.

### How to Report

1. **Do NOT open a public issue** for security vulnerabilities
2. Email: Open a private security advisory on GitHub
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Fix or mitigation**: Depends on severity

### Security Principles

ARI vNext is built on these security foundations:

1. **Local-first**: Gateway binds exclusively to 127.0.0.1 (loopback)
2. **CONTENT is not COMMAND**: All inbound content is treated as data, never as instructions
3. **Shadow Integration**: Suspicious patterns are logged for transparency, not silently blocked
4. **Audit Trail**: All operations recorded in tamper-evident hash-chained log
5. **Least Privilege**: Phase 1 has no tool execution, no memory writes, no external API calls
6. **Defense in Depth**: Input sanitization, rate limiting, and pattern detection

### Scope

Security issues in the following areas are in scope:

- WebSocket gateway vulnerabilities
- Input sanitization bypasses
- Audit log integrity issues
- Hash chain weaknesses
- Rate limiting bypasses
- Configuration security
- Daemon privilege escalation

### Out of Scope

- Issues requiring physical access to the machine
- Social engineering attacks
- Denial of service against localhost services
- Issues in third-party dependencies (report to upstream)

## Security Architecture

For detailed information about the security model, see [docs/SECURITY.md](docs/SECURITY.md).
