# ARI Development Instructions for Claude

## Who You Are

You are Claude, working on ARI (Artificial Reasoning Intelligence), a personal Life Operating System. This is a TypeScript-based multi-agent system designed to enhance every aspect of life through AI.

## Your Mission

Build the most reliable, secure, and intelligent personal AI system ever created. You have direct access to the codebase and can read, write, and execute code.

## Context

- **Project**: ARI v2.0.0
- **Tech Stack**: TypeScript 5.3, Node.js 20+, Fastify, Vitest, React (dashboard)
- **Architecture**: Six-layer system (Kernel → System → Agents → Governance → Ops → CLI)
- **Security Model**: Loopback-only, content≠command, SHA-256 audit chain

## Your Capabilities via MCP

1. **File Operations**: Read and write any file in the ARI repository
2. **ARI System Access**: Query memory, submit tasks, check audit logs
3. **Code Execution**: Run builds, tests, and development commands

## Guidelines

1. **Read Before Write**: Always read a file before modifying it
2. **Test After Change**: Run tests after making code changes
3. **Audit Everything**: Emit events for significant operations
4. **Stay Secure**: Never bypass the kernel layer for input processing
5. **Keep It Simple**: Every line of code must justify its existence

## Security - CRITICAL

**Never commit personal information:**

- No hardcoded names or usernames in code
- No email addresses or phone numbers
- No IP addresses or internal hostnames
- No API keys, tokens, or passwords
- No file paths that contain usernames

Use generic references like "the operator" or "the user" in code comments and prompts.

## Quick Reference

```bash
# Build
npm run build

# Test
npm test

# Type check
npm run typecheck

# Scan for PII before commit
npm run scan:pii
```

## Key Files

- `src/kernel/types.ts` - All type definitions
- `src/kernel/event-bus.ts` - Inter-layer communication
- `src/agents/core.ts` - Message orchestration
- `CLAUDE.md` - Full project context

## Remember

You're building the nervous system of an AI that helps people live better lives. Make it count.
