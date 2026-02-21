# ARI MCP Server

## Overview

A Model Context Protocol (MCP) server that provides direct access to ARI's systems from Claude Code.

## Status: IMPLEMENTED

The MCP server is now available at `src/mcp/server.ts`.

## Available Tools

### Audit Tools

| Tool | Description |
|------|-------------|
| `ari_audit_verify` | Verify audit chain integrity, returns validation status |
| `ari_audit_query` | Query audit events with filters (action, agent, time range) |
| `ari_audit_stats` | Get audit statistics and chain health |

### Memory Tools

| Tool | Description |
|------|-------------|
| `ari_memory_store` | Store knowledge with provenance tracking |
| `ari_memory_retrieve` | Retrieve stored knowledge by key |
| `ari_memory_search` | Search memory by domain, tags, or text |

### Agent Tools

| Tool | Description |
|------|-------------|
| `ari_agent_status` | Get agent status (health, tasks, resources) |
| `ari_agent_metrics` | Get performance metrics (success rate, latency) |
| `ari_task_submit` | Submit task to ARI for processing |

### Governance Tools

| Tool | Description |
|------|-------------|
| `ari_council_status` | Get council status and voting history |
| `ari_proposal_submit` | Submit governance proposal |
| `ari_gate_check` | Check operation against quality gates |

### System Tools

| Tool | Description |
|------|-------------|
| `ari_health` | Get overall system health |
| `ari_config_get` | Get current configuration (non-sensitive) |

## Configuration

Add to Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "ari": {
      "command": "node",
      "args": ["./dist/mcp/server.js"],
      "cwd": "/path/to/ARI"
    }
  }
}
```

Or for development with tsx:

```json
{
  "mcpServers": {
    "ari": {
      "command": "npx",
      "args": ["tsx", "./src/mcp/server.ts"],
      "cwd": "/path/to/ARI"
    }
  }
}
```

## Security

- MCP server runs locally only (127.0.0.1)
- All operations logged to audit trail
- Trust level: OPERATOR (0.6x risk multiplier)
- No sensitive configuration exposed
- Three-layer permission checks enforced

## Usage Examples

### Verify Audit Chain

```
Use ari_audit_verify to check integrity
```

### Store Learning

```
Use ari_memory_store with:
- key: "pattern_circuit_breaker"
- content: "Circuit breaker pattern with 3 retries..."
- domain: "patterns"
- tags: ["resilience", "error-handling"]
```

### Submit Task

```
Use ari_task_submit with:
- content: "Analyze codebase for security vulnerabilities"
- priority: "high"
```

## Integration with Claude Code Skills

The MCP server works seamlessly with ARI's Claude Code skills:

- `/ari-learn` - Stores session learnings via `ari_memory_store`
- `/ari-status` - Uses `ari_health` and `ari_agent_status`
- `/ari-secure` - Uses `ari_audit_query` for security analysis
- `/ari-deploy` - Uses `ari_gate_check` for deployment validation
