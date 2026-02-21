---
name: ari-cli-development
description: Commander.js CLI development patterns for ARI
triggers:
  - "cli command"
  - "add command"
  - "commander"
  - "ari cli"
---

# ARI CLI Development

## Purpose

Develop and maintain ARI's CLI interface using Commander.js.

## CLI Structure

```
src/cli/
├── index.ts           # Main entry, Commander setup
└── commands/
    ├── gateway.ts     # gateway start/stop
    ├── daemon.ts      # daemon management
    ├── audit.ts       # audit verify/export
    ├── doctor.ts      # system diagnostics
    ├── council.ts     # governance commands
    ├── memory.ts      # memory operations
    ├── config.ts      # configuration
    └── version.ts     # version info
```

## Main Entry Point

```typescript
// src/cli/index.ts
#!/usr/bin/env node
import { Command } from 'commander';
import { version } from '../../package.json';

const program = new Command();

program
  .name('ari')
  .description('ARI - Artificial Reasoning Intelligence CLI')
  .version(version);

// Register commands
import './commands/gateway.js';
import './commands/daemon.js';
import './commands/audit.js';
import './commands/doctor.js';
import './commands/council.js';
import './commands/memory.js';
import './commands/config.js';

program.parse();
```

## Command Pattern

```typescript
// src/cli/commands/audit.ts
import { Command } from 'commander';
import { program } from '../index.js';
import { Audit } from '../../kernel/audit.js';
import { logger } from '../../kernel/logger.js';
import chalk from 'chalk';
import ora from 'ora';

const audit = program
  .command('audit')
  .description('Audit trail operations');

audit
  .command('verify')
  .description('Verify audit trail integrity')
  .action(async () => {
    const spinner = ora('Verifying audit chain...').start();

    try {
      const result = await Audit.verifyChain();

      if (result.valid) {
        spinner.succeed(chalk.green(
          `Audit chain valid (${result.eventCount} events)`
        ));
      } else {
        spinner.fail(chalk.red(
          `Audit chain INVALID at event ${result.failedAt}`
        ));
        process.exit(1);
      }
    } catch (error) {
      spinner.fail(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

audit
  .command('export')
  .description('Export audit trail')
  .option('-o, --output <file>', 'Output file', 'audit-export.json')
  .option('-f, --format <format>', 'Format (json|csv)', 'json')
  .action(async (options) => {
    // Implementation
  });
```

## Output Formatting

### Success Messages

```typescript
import chalk from 'chalk';

console.log(chalk.green('✓'), 'Operation completed successfully');
console.log(chalk.blue('ℹ'), 'Information message');
console.log(chalk.yellow('⚠'), 'Warning message');
console.log(chalk.red('✗'), 'Error message');
```

### Progress Indicators

```typescript
import ora from 'ora';

const spinner = ora('Processing...').start();
// ... operation
spinner.succeed('Done');
// or
spinner.fail('Failed');
```

### Tables

```typescript
console.table([
  { agent: 'guardian', status: 'active', tasks: 12 },
  { agent: 'planner', status: 'active', tasks: 5 },
  { agent: 'executor', status: 'idle', tasks: 0 }
]);
```

## Interactive Commands

```typescript
import { input, select, confirm } from '@inquirer/prompts';

audit
  .command('cleanup')
  .description('Archive old audit events')
  .action(async () => {
    const age = await select({
      message: 'Archive events older than:',
      choices: [
        { name: '30 days', value: 30 },
        { name: '60 days', value: 60 },
        { name: '90 days', value: 90 }
      ]
    });

    const confirmed = await confirm({
      message: `Archive events older than ${age} days?`
    });

    if (confirmed) {
      await archiveOldEvents(age);
    }
  });
```

## Error Handling

```typescript
program.exitOverride();

try {
  await program.parseAsync();
} catch (error) {
  if (error.code === 'commander.help') {
    process.exit(0);
  }
  if (error.code === 'commander.version') {
    process.exit(0);
  }

  logger.error({ error: error.message }, 'CLI error');
  console.error(chalk.red('Error:'), error.message);
  process.exit(1);
}
```

## Available Commands

| Command | Description |
|---------|-------------|
| `ari gateway start` | Start the gateway server |
| `ari gateway stop` | Stop the gateway server |
| `ari daemon start` | Start as background daemon |
| `ari daemon status` | Check daemon status |
| `ari audit verify` | Verify audit chain integrity |
| `ari audit export` | Export audit trail |
| `ari doctor` | Run system diagnostics |
| `ari council vote` | Cast governance vote |
| `ari memory stats` | Show memory statistics |
| `ari config get` | Get configuration value |
| `ari config set` | Set configuration value |
