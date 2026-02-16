# CLI Layer

User interface for ARI operations using Commander.js.

## Commands

| Command | Purpose |
|---------|---------|
| `ari chat` | Interactive AI conversation |
| `ari ask` | One-shot AI query |
| `ari task` | Task management |
| `ari note` / `ari notes` | Note-taking and retrieval |
| `ari remind` | Reminder management |
| `ari plan` | Planning and goal-setting |
| `ari daemon` | Start/stop/status of daemon |
| `ari gateway` | Gateway management |
| `ari audit` | Audit trail operations |
| `ari audit-report` | Generate audit reports |
| `ari governance` | Council and voting |
| `ari autonomous` | Autonomous agent control |
| `ari cognitive` | Cognitive layer tools (alias: `cog`) |
| `ari context` | Context management |
| `ari doctor` | System diagnostics |
| `ari onboard` | Initial setup |
| `ari budget` | Budget management |
| `ari knowledge` | Knowledge operations |
| `ari crypto` | Crypto prices and portfolio |
| `ari pokemon` | Pokemon TCG card tools |
| `ari speak` | Text-to-speech |
| `ari plugin` | Plugin management |
| `ari provider` | AI provider management |
| `ari diagram` | Architecture diagrams |

**Total: 24 commands**

## Command Pattern

```typescript
import { Command } from 'commander';

export function registerCommand(program: Command): void {
  program
    .command('mycommand')
    .description('What it does')
    .option('-f, --flag <value>', 'Option description')
    .action(async (options) => {
      // Implementation
    });
}
```

## Output Conventions

- Use `console.log` for normal output
- Use `console.error` for errors
- Exit with code 1 on failure
- Support `--json` flag for machine-readable output

## Adding New Commands

1. Create file in `cli/commands/`
2. Export `registerCommand` function
3. Import and register in `cli/index.ts`
4. Add tests in `tests/unit/cli/`

Skills: `/ari-cli-development`
