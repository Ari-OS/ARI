#!/usr/bin/env node

/**
 * ARI vNext — Command Line Interface
 *
 * Provides commands for managing the ARI gateway, audit log,
 * daemon, and system health.
 *
 * @module cli
 * @version 1.0.0
 */

import { Command } from 'commander';
import * as fs from 'node:fs';
import { type AuditAction } from '../types/index.js';
import { getConfig, ensureDirectories, ensureConfig, getBaseDir, getAuditPath, getLogsPath, checkDirectoryAccess } from '../config/config.js';
import { createGateway } from '../gateway/gateway.js';
import { createAuditLog } from '../audit/audit-log.js';
import { getDaemonStatus, installDaemon, uninstallDaemon, restartDaemon } from '../ops/launchd.js';
import { createPromptRefiner } from '../prompting/prompt-refiner.js';

// ═══════════════════════════════════════════════════════════════════════════
// PROGRAM SETUP
// ═══════════════════════════════════════════════════════════════════════════

const program = new Command();

program
  .name('ari')
  .description('ARI vNext — Constitutional Multi-Agent Personal Operating System')
  .version('1.0.0');

// ═══════════════════════════════════════════════════════════════════════════
// GATEWAY COMMANDS
// ═══════════════════════════════════════════════════════════════════════════

const gatewayCmd = program.command('gateway').description('Manage the WebSocket gateway');

gatewayCmd
  .command('start')
  .description('Start the gateway')
  .option('-f, --foreground', 'Run in foreground (don\'t daemonize)', false)
  .option('-p, --port <port>', 'Port to listen on', '18789')
  .action(async (options: { foreground: boolean; port: string }) => {
    const port = parseInt(options.port, 10);
    if (isNaN(port) || port < 1024 || port > 65535) {
      process.stderr.write('Error: Port must be between 1024 and 65535\n');
      process.exit(1);
    }

    ensureDirectories();

    const gateway = createGateway({ port });

    process.stdout.write(`Starting ARI gateway on 127.0.0.1:${port}...\n`);

    try {
      await gateway.start();
      process.stdout.write(`Gateway running on ws://127.0.0.1:${port}\n`);
      process.stdout.write('Press Ctrl+C to stop\n');

      const shutdown = async () => {
        process.stdout.write('\nShutting down gateway...\n');
        await gateway.stop();
        process.exit(0);
      };

      process.on('SIGINT', () => void shutdown());
      process.on('SIGTERM', () => void shutdown());
    } catch (error) {
      process.stderr.write(`Failed to start gateway: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    }
  });

gatewayCmd
  .command('status')
  .description('Show gateway status')
  .action(() => {
    const status = getDaemonStatus();
    process.stdout.write('ARI Gateway Status\n');
    process.stdout.write(`  Daemon installed: ${status.installed ? 'yes' : 'no'}\n`);
    process.stdout.write(`  Running: ${status.running ? 'yes' : 'no'}\n`);
    if (status.pid) {
      process.stdout.write(`  PID: ${status.pid}\n`);
    }
  });

// ═══════════════════════════════════════════════════════════════════════════
// AUDIT COMMANDS
// ═══════════════════════════════════════════════════════════════════════════

const auditCmd = program.command('audit').description('Manage the audit log');

auditCmd
  .command('list')
  .description('List audit entries')
  .option('-n, --limit <count>', 'Number of entries to show', '20')
  .option('-a, --action <action>', 'Filter by action type')
  .option('--since <datetime>', 'Show entries since datetime')
  .option('--until <datetime>', 'Show entries until datetime')
  .action(async (options: { limit: string; action?: string; since?: string; until?: string }) => {
    const auditLog = createAuditLog();
    await auditLog.initialize();

    const queryOptions: Parameters<typeof auditLog.list>[0] = {
      limit: parseInt(options.limit, 10),
    };
    if (options.action !== undefined) {
      queryOptions.action = options.action as AuditAction;
    }
    if (options.since !== undefined) {
      queryOptions.since = options.since;
    }
    if (options.until !== undefined) {
      queryOptions.until = options.until;
    }
    const entries = await auditLog.list(queryOptions);

    if (entries.length === 0) {
      process.stdout.write('No audit entries found.\n');
      return;
    }

    for (const entry of entries) {
      process.stdout.write(
        `[${entry.sequence}] ${entry.timestamp} ${entry.action} actor=${entry.actor.type}:${entry.actor.id}\n`,
      );
    }

    process.stdout.write(`\nShowing ${entries.length} entries\n`);
  });

auditCmd
  .command('verify')
  .description('Verify audit log integrity')
  .action(async () => {
    process.stdout.write('Verifying audit log integrity...\n');

    const auditLog = createAuditLog();
    const result = await auditLog.verify();

    if (result.valid) {
      process.stdout.write(`PASS: ${result.entriesChecked} entries verified, hash chain intact.\n`);
    } else {
      process.stderr.write(`FAIL: ${result.error ?? 'Unknown error'}\n`);
      if (result.firstInvalidSequence !== undefined) {
        process.stderr.write(`  First invalid at sequence: ${result.firstInvalidSequence}\n`);
      }
      process.exit(1);
    }
  });

auditCmd
  .command('tail')
  .description('Show the last N audit entries')
  .option('-n, --count <count>', 'Number of entries', '10')
  .action(async (options: { count: string }) => {
    const auditLog = createAuditLog();
    await auditLog.initialize();

    const allEntries = await auditLog.list();
    const count = parseInt(options.count, 10);
    const entries = allEntries.slice(-count);

    for (const entry of entries) {
      process.stdout.write(JSON.stringify(entry) + '\n');
    }
  });

// ═══════════════════════════════════════════════════════════════════════════
// ONBOARD COMMANDS
// ═══════════════════════════════════════════════════════════════════════════

const onboardCmd = program.command('onboard').description('System onboarding');

onboardCmd
  .command('init')
  .description('Initialize ARI data directories and config')
  .action(() => {
    process.stdout.write('Initializing ARI...\n');

    const configResult = ensureConfig();
    if (!configResult.success) {
      process.stderr.write(`Failed to initialize: ${configResult.error.message}\n`);
      process.exit(1);
    }

    process.stdout.write(`  Base directory: ${getBaseDir()}\n`);
    process.stdout.write(`  Audit log: ${getAuditPath()}\n`);
    process.stdout.write(`  Logs directory: ${getLogsPath()}\n`);
    process.stdout.write('Initialization complete.\n');
  });

onboardCmd
  .command('install-daemon')
  .description('Install ARI as a macOS launch agent')
  .action(async () => {
    if (process.platform !== 'darwin') {
      process.stderr.write('Error: Daemon installation is only supported on macOS.\n');
      process.exit(1);
    }

    process.stdout.write('Installing ARI daemon...\n');

    const result = await installDaemon();
    if (result.success) {
      process.stdout.write(`Daemon installed at: ${result.data}\n`);
      process.stdout.write('ARI will now start automatically at login.\n');
    } else {
      process.stderr.write(`Failed to install daemon: ${result.error.message}\n`);
      process.exit(1);
    }
  });

onboardCmd
  .command('uninstall-daemon')
  .description('Uninstall the ARI launch agent')
  .action(async () => {
    const result = await uninstallDaemon();
    if (result.success) {
      process.stdout.write('Daemon uninstalled.\n');
    } else {
      process.stderr.write(`Failed to uninstall daemon: ${result.error.message}\n`);
      process.exit(1);
    }
  });

onboardCmd
  .command('restart-daemon')
  .description('Restart the ARI daemon')
  .action(() => {
    const result = restartDaemon();
    if (result.success) {
      process.stdout.write('Daemon restarted.\n');
    } else {
      process.stderr.write(`Failed to restart daemon: ${result.error.message}\n`);
      process.exit(1);
    }
  });

// ═══════════════════════════════════════════════════════════════════════════
// DOCTOR COMMAND
// ═══════════════════════════════════════════════════════════════════════════

program
  .command('doctor')
  .description('Run system health checks')
  .option('--fix', 'Attempt to fix issues', false)
  .action(async (options: { fix: boolean }) => {
    process.stdout.write('ARI System Doctor\n');
    process.stdout.write('=================\n\n');

    let allPassed = true;

    // Check 1: Node.js version
    const nodeVersion = process.versions['node'] ?? '0.0.0';
    const major = parseInt(nodeVersion.split('.')[0] ?? '0', 10);
    if (major >= 22) {
      process.stdout.write(`  [PASS] Node.js version: v${nodeVersion}\n`);
    } else {
      process.stdout.write(`  [FAIL] Node.js version: v${nodeVersion} (requires >= 22)\n`);
      allPassed = false;
    }

    // Check 2: Base directory
    const config = getConfig();
    const baseDir = getBaseDir(config);
    if (fs.existsSync(baseDir)) {
      process.stdout.write(`  [PASS] Base directory exists: ${baseDir}\n`);
    } else if (options.fix) {
      ensureDirectories(config);
      process.stdout.write(`  [FIXED] Created base directory: ${baseDir}\n`);
    } else {
      process.stdout.write(`  [FAIL] Base directory missing: ${baseDir}\n`);
      allPassed = false;
    }

    // Check 3: Directory writable
    const accessResult = checkDirectoryAccess(config);
    if (accessResult.success) {
      process.stdout.write(`  [PASS] Base directory is writable\n`);
    } else if (options.fix) {
      ensureDirectories(config);
      process.stdout.write(`  [FIXED] Directory access restored\n`);
    } else {
      process.stdout.write(`  [FAIL] Base directory not writable: ${accessResult.error.message}\n`);
      allPassed = false;
    }

    // Check 4: Config file
    const configResult = ensureConfig();
    if (configResult.success) {
      process.stdout.write(`  [PASS] Configuration valid\n`);
    } else {
      process.stdout.write(`  [FAIL] Configuration error: ${configResult.error.message}\n`);
      allPassed = false;
    }

    // Check 5: Loopback binding
    if (config.security.bind_loopback_only === true) {
      process.stdout.write(`  [PASS] Loopback-only binding enforced\n`);
    } else {
      process.stdout.write(`  [FAIL] Loopback binding not enforced (security violation)\n`);
      allPassed = false;
    }

    // Check 6: Audit log integrity
    const auditPath = getAuditPath(config);
    if (fs.existsSync(auditPath)) {
      const auditLog = createAuditLog(auditPath);
      const verifyResult = await auditLog.verify();
      if (verifyResult.valid) {
        process.stdout.write(`  [PASS] Audit log integrity (${verifyResult.entriesChecked} entries)\n`);
      } else {
        process.stdout.write(`  [FAIL] Audit log corrupted: ${verifyResult.error ?? 'unknown'}\n`);
        allPassed = false;
      }
    } else {
      process.stdout.write(`  [INFO] No audit log yet (will be created on first use)\n`);
    }

    // Check 7: Daemon status (macOS only)
    if (process.platform === 'darwin') {
      const daemonStatus = getDaemonStatus();
      if (daemonStatus.installed) {
        process.stdout.write(`  [PASS] Daemon installed${daemonStatus.running ? ' and running' : ' (not running)'}\n`);
      } else {
        process.stdout.write(`  [INFO] Daemon not installed (optional)\n`);
      }
    }

    process.stdout.write('\n');

    if (allPassed) {
      process.stdout.write('All checks passed.\n');
    } else {
      process.stdout.write('Some checks failed. Run with --fix to attempt repairs.\n');
      process.exit(1);
    }
  });

// ═══════════════════════════════════════════════════════════════════════════
// REFINE COMMAND
// ═══════════════════════════════════════════════════════════════════════════

program
  .command('refine')
  .description('Refine a prompt (for testing the prompt refiner)')
  .argument('<prompt>', 'The prompt text to refine')
  .action((prompt: string) => {
    const refiner = createPromptRefiner();
    const result = refiner.refine(prompt);

    if (result.success) {
      process.stdout.write(JSON.stringify(result.data, null, 2) + '\n');
    } else {
      process.stderr.write(`Error: ${result.error.message}\n`);
      process.exit(1);
    }
  });

// ═══════════════════════════════════════════════════════════════════════════
// PARSE & EXECUTE
// ═══════════════════════════════════════════════════════════════════════════

program.parse(process.argv);
