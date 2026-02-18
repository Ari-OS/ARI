/**
 * ARI Autonomous Agent CLI Commands
 *
 * Manage the autonomous agent from the command line.
 */

import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';

const CONFIG_PATH = path.join(process.env.HOME || '~', '.ari', 'autonomous.json');
const STATE_PATH = path.join(process.env.HOME || '~', '.ari', 'agent-state.json');

interface AgentState {
  running: boolean;
  startedAt: string | null;
  tasksProcessed: number;
  lastActivity: string | null;
  errors: number;
}

interface ClaudeConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

interface SecurityConfig {
  requireConfirmation: boolean;
  allowedCommands: string[];
  blockedPatterns: string[];
}

interface AutonomousConfig {
  enabled: boolean;
  pollIntervalMs: number;
  maxConcurrentTasks: number;
  claude?: ClaudeConfig;
  security?: SecurityConfig;
}

interface SetupOptions {
  claudeKey?: string;
  enable?: boolean;
  disable?: boolean;
}

export function createAutonomousCommand(): Command {
  const cmd = new Command('autonomous')
    .alias('auto')
    .description('Manage the autonomous agent');

  cmd
    .command('status')
    .description('Show autonomous agent status')
    .action(async () => {
      try {
        const state = JSON.parse(await fs.readFile(STATE_PATH, 'utf-8')) as AgentState;
        const config = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf-8').catch(() => '{}')) as Partial<AutonomousConfig>;

        console.log(chalk.bold('\n🤖 Autonomous Agent Status\n'));
        console.log(`  Enabled:      ${config.enabled ? chalk.green('Yes') : chalk.yellow('No')}`);
        console.log(`  Running:      ${state.running ? chalk.green('Yes') : chalk.red('No')}`);
        console.log(`  Started:      ${state.startedAt ?? 'Never'}`);
        console.log(`  Last Active:  ${state.lastActivity ?? 'Never'}`);
        console.log(`  Processed:    ${state.tasksProcessed ?? 0} tasks`);
        console.log(`  Errors:       ${state.errors ?? 0}`);
        console.log();
      } catch {
        console.log(chalk.yellow('Autonomous agent not configured yet.'));
        console.log('Run: npx ari autonomous setup');
      }
    });

  cmd
    .command('setup')
    .description('Configure the autonomous agent')
    .option('--claude-key <key>', 'Anthropic API key')
    .option('--enable', 'Enable autonomous operation')
    .option('--disable', 'Disable autonomous operation')
    .action(async (options: SetupOptions) => {
      const spinner = ora('Configuring autonomous agent...').start();

      try {
        // Load existing config
        let config: Partial<AutonomousConfig> = {};
        try {
          config = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf-8')) as Partial<AutonomousConfig>;
        } catch {
          // Start fresh
        }

        // Apply options
        if (options.claudeKey) {
          config.claude = {
            ...(config.claude ?? {}),
            apiKey: options.claudeKey,
          };
        }

        if (options.enable) {
          config.enabled = true;
        } else if (options.disable) {
          config.enabled = false;
        }

        // Set defaults
        config.pollIntervalMs = config.pollIntervalMs ?? 5000;
        config.maxConcurrentTasks = config.maxConcurrentTasks ?? 1;
        config.security = config.security ?? {
          requireConfirmation: true,
          allowedCommands: [],
          blockedPatterns: [],
        };

        // Save config
        const dir = path.dirname(CONFIG_PATH);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
        await fs.chmod(CONFIG_PATH, 0o600); // Secure permissions

        spinner.succeed('Autonomous agent configured');

        console.log(chalk.bold('\nConfiguration:'));
        console.log(`  Enabled:   ${config.enabled ? chalk.green('Yes') : chalk.yellow('No')}`);
        console.log(`  Claude:    ${config.claude?.apiKey ? chalk.green('Configured') : chalk.yellow('Not set')}`);

        if (!config.enabled) {
          console.log(chalk.yellow('\nTo enable: npx ari autonomous setup --enable'));
        }
        if (!config.claude?.apiKey) {
          console.log(chalk.yellow('To add Claude: npx ari autonomous setup --claude-key YOUR_KEY'));
        }
      } catch (error) {
        spinner.fail('Configuration failed');
        console.error(error);
      }
    });

  cmd
    .command('enable')
    .description('Enable the autonomous agent')
    .action(async () => {
      try {
        let config: Partial<AutonomousConfig> = {};
        try {
          config = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf-8')) as Partial<AutonomousConfig>;
        } catch {
          // Start fresh
        }

        config.enabled = true;

        await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
        await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));

        console.log(chalk.green('✓ Autonomous agent enabled'));
        console.log('Restart the daemon for changes to take effect.');
      } catch (error) {
        console.error('Failed to enable:', error);
      }
    });

  cmd
    .command('disable')
    .description('Disable the autonomous agent')
    .action(async () => {
      try {
        let config: Partial<AutonomousConfig> = {};
        try {
          config = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf-8')) as Partial<AutonomousConfig>;
        } catch {
          // Start fresh
        }

        config.enabled = false;

        await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
        await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));

        console.log(chalk.yellow('✓ Autonomous agent disabled'));
      } catch (error) {
        console.error('Failed to disable:', error);
      }
    });

  cmd
    .command('test')
    .description('Test autonomous agent connections')
    .action(async () => {
      const spinner = ora('Testing connections...').start();

      try {
        const config = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf-8')) as Partial<AutonomousConfig>;
        const results: string[] = [];

        // Test Claude
        if (config.claude?.apiKey) {
          spinner.text = 'Testing Claude API...';

          try {
            const { default: Anthropic } = await import('@anthropic-ai/sdk');
            const client = new Anthropic({ apiKey: config.claude.apiKey });

            await client.messages.create({
              model: config.claude.model ?? 'claude-sonnet-4-6',
              max_tokens: 10,
              messages: [{ role: 'user', content: 'test' }],
            });

            results.push(chalk.green('✓ Claude API: Connected'));
          } catch {
            results.push(chalk.red('✗ Claude API: Failed'));
          }
        } else {
          results.push(chalk.yellow('○ Claude API: Not configured'));
        }

        spinner.succeed('Connection test complete');
        console.log('\nResults:');
        results.forEach(r => console.log(`  ${r}`));

      } catch (error) {
        spinner.fail('Test failed');
        console.error(error);
      }
    });

  return cmd;
}
