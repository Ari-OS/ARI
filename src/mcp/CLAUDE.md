# MCP Server Layer

Model Context Protocol server for Claude integration.

## Components

| Component | Purpose |
|-----------|---------|
| server.ts | MCP server implementation with tool definitions |
| index.ts | Module exports |

## MCP Tools

ARI exposes these tools to Claude via MCP:

| Tool | Description |
|------|-------------|
| ari_message | Send message to ARI |
| ari_memory_search | Search ARI memory |
| ari_memory_store | Store to memory |
| ari_context | Load context by name |
| ari_governance | Submit governance proposal |

## Configuration

```typescript
// Claude Desktop config.json
{
  "mcpServers": {
    "ari": {
      "command": "npx",
      "args": ["ari", "mcp"]
    }
  }
}
```

## Security

- MCP server inherits loopback-only policy
- All operations go through sanitizer
- Audit trail for all MCP calls

Skills: `/plugin-dev:mcp-integration`
