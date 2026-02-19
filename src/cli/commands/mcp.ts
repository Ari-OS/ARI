import { Command } from 'commander';

// ═══════════════════════════════════════════════════════════════════════════════
// MCP CLI COMMAND
// Starts the ARI MCP server for Claude Code integration.
// Run via: npx ari mcp
// Register in Claude Code: ~/.claude/settings.json → mcpServers
// ═══════════════════════════════════════════════════════════════════════════════

export function registerMcpCommand(program: Command): void {
  program
    .command('mcp')
    .description('Start ARI MCP server for Claude Code integration')
    .action(async () => {
      // The MCP server auto-starts on import (stdio transport, stays alive until stdin closes)
      await import('../../mcp/server.js');
    });
}
