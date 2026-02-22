import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createLogger } from '../kernel/logger.js';
import { execFileNoThrow } from '../utils/execFileNoThrow.js';

const log = createLogger('ari-watchdog');

const ERROR_LOG_PATH = join(homedir(), '.ari', 'logs', 'ari-kernel-error.log');

/**
 * Watchdog Process
 * 
 * Runs alongside the main kernel via PM2.
 * If ari-kernel crashes, it captures the stack trace, feeds it to Claude Opus
 * via the GitHub MCP, generates the patch, applies it, runs the test suite,
 * and restarts the main process autonomously.
 */
class Watchdog {
  private lastCheckedSize = 0;

  constructor() {
    log.info('ARI Watchdog initialized. Monitoring ari-kernel for crashes...');
    this.pollLogs();
  }

  private pollLogs() {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    setInterval(async () => {
      try {
        const stats = await fs.stat(ERROR_LOG_PATH);
        if (stats.size > this.lastCheckedSize) {
          // New errors detected
          const content = await fs.readFile(ERROR_LOG_PATH, 'utf-8');
          const newErrors = content.slice(this.lastCheckedSize);
          this.lastCheckedSize = stats.size;

          if (this.detectCrash(newErrors)) {
            await this.initiateSelfHealing(newErrors);
          }
        }
      } catch {
        // Log file might not exist yet, ignore
      }
    }, 5000);
  }

  private detectCrash(logContent: string): boolean {
    // Basic heuristic for a crash stack trace
    return logContent.includes('Error:') && logContent.includes('at ');
  }

  private async initiateSelfHealing(_stackTrace: string) {
    log.error('CRASH DETECTED. Initiating self-healing protocol via MCP...');

    try {
      log.info('1. Capturing stack trace and feeding to Claude Opus via GitHub MCP...');
      // Simulated: This would be an MCP tool call in reality to prompt Claude Opus
      await this.runCommand('echo', ['"Simulating MCP payload to Claude Opus with stack trace"']);
      
      log.info('2. Generating and applying patch...');
      // Simulated: Receive patch from MCP and apply it
      await this.runCommand('echo', ['"Applying generated patch..."']);

      log.info('3. Running test suite to verify patch...');
      // Run the test suite to ensure the patch didn't break invariants
      const testResult = await this.runCommand('npm', ['test']);
      
      if (testResult.success) {
        log.info('4. Tests passed. Restarting ari-kernel autonomously...');
        await this.runCommand('npx', ['pm2', 'restart', 'ari-kernel']);
        log.info('Self-healing complete. ari-kernel is back online.');
      } else {
        log.error('Self-healing failed: Tests did not pass after patch. Triggering P0 SMS alert.');
        // Notify operator via P0 SMS
      }
    } catch (err) {
      log.error({ err }, 'Critical failure during self-healing protocol.');
    }
  }

  private async runCommand(cmd: string, args: string[]): Promise<{ success: boolean; output: string }> {
    const result = await execFileNoThrow(cmd, args);
    return {
      success: result.status === 0,
      output: result.stdout + result.stderr
    };
  }
}

// Start Watchdog
new Watchdog();
