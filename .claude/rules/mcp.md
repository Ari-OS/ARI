# Active MCP Servers

## Configured in `.mcp.json`

| MCP | Key Variable | Purpose |
|-----|-------------|---------|
| **Tavily** | TAVILY_API_KEY | Web search, extract, single-page crawl — primary research layer |
| **Firecrawl** | FIRECRAWL_API_KEY | Full-site crawl, JS-rendered SPAs, structured data extraction |
| **GitHub** | GITHUB_TOKEN | Commits, PRs, issues, code search |
| **SQLite** | — | Memory + pipeline databases at `~/.ari/databases/` |
| **Memory (Anthropic)** | — | Persistent hierarchical memory |
| **Sequential-Thinking** | — | Chain-of-thought for complex reasoning |
| **Playwright** | — | Screenshots, web scraping, lead verification |
| **Pokemon TCG** | — | Card prices, set data, format legality (ptcg-mcp) |
| **Context7** | — | Library documentation lookup |

## Tavily vs Firecrawl — When to Use Which

| Task | Tool | Why |
|------|------|-----|
| Web search (keywords → results) | Tavily | Built for search ranking |
| Extract a single URL | Tavily `tavily_extract` | Fast, no JS needed |
| Deep research (multi-hop) | Tavily `tavily_research` | Orchestrates multi-step search |
| Crawl an entire website | Firecrawl | Follows all internal links, full-site coverage |
| JS-rendered SPA (React/Next) | Firecrawl | Renders JS before extracting |
| Structured data from a site | Firecrawl | Schema-based extraction |
| Prospect website audit (CHASE) | Firecrawl | Needs all pages, not just homepage |
| Documentation site ingestion (DEX) | Firecrawl | Full-site crawl → indexed knowledge |

## Deferred / Optional

| MCP | Status | Reason |
|-----|--------|--------|
| YouTube | Needs YOUTUBE_CLIENT credentials | P1 video publishing |
| Discord | Needs DISCORD_TOKEN | Channel ops, button interactions |
| Obsidian (iansinnott) | Needs Obsidian installed | Claude Code native, 70+ tools |
| Obsidian (cyanheads) | Needs Local REST API plugin | Daemon scheduled tasks |
| Notion | ⏸️ Deferred | Workspace files + SQLite cover current needs |
| Apify | ❌ Not needed | Apollo.io + SerpAPI + Google Maps covers P2 lead discovery with official APIs; Apify LinkedIn scrapers break frequently |

## MCP Usage Rules

- **Tavily first** for web search and single-URL extraction
- **Firecrawl** for full-site crawl, JS SPAs, or structured extraction across multiple pages
- **GitHub MCP** for all GitHub operations — never construct raw GitHub API calls
- **SQLite MCP** reads at `~/.ari/databases/` — never write from Claude Code directly
- **Sequential-Thinking** for any decision requiring >3 logical steps
- **Playwright** for P2 lead audit (live site data) — always headless

## Adding New MCPs

```bash
# Scoped to project (preferred)
claude mcp add --scope project <name> -- <command> [args]

# With env vars
claude mcp add --scope project --env KEY=$VALUE <name> -- <command>

# List active
claude mcp list
```

Key install notes:
- Pokemon TCG: `npx -y ptcg-mcp` — no key needed for basic tier
- Playwright: `npx @microsoft/playwright-mcp` — run `npx playwright install` first
- Tavily: key must be in env as `TAVILY_API_KEY`

## What NOT to Use MCPs For

- Direct LLM routing — use OpenRouter API via ari-ai plugin
- Webhook delivery — use Discord bot (ari-autonomous plugin)
- File writes to `~/.ari/workspace/` — use ari-workspace plugin events
