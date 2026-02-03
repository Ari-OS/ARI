import { spawn } from 'node:child_process';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { EventBus } from '../kernel/event-bus.js';
import type { E2ETestRun, E2EScenarioResult, E2ERunnerConfig, RunOptions } from './types.js';

const execAsync = promisify(exec);

export class E2ERunner {
  private eventBus: EventBus | null = null;
  private projectRoot: string;
  private outputDir: string;
  private alertThreshold: number;
  private maxRetries: number;
  private consecutiveFailures = 0;
  private isRunning = false;
  private history: E2ETestRun[] = [];

  constructor(config: Partial<E2ERunnerConfig> = {}) {
    this.projectRoot = config.projectRoot || process.cwd();
    this.outputDir = config.outputDir || path.join(process.env.HOME || '~', '.ari', 'e2e');
    this.alertThreshold = config.alertThreshold ?? 2;
    this.maxRetries = config.maxRetries ?? 2;
  }

  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }

  async initialize(): Promise<void> {
    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });

    // Load history from disk
    const historyPath = path.join(this.outputDir, 'history.json');
    try {
      const data = await fs.readFile(historyPath, 'utf-8');
      this.history = JSON.parse(data) as E2ETestRun[];
    } catch {
      this.history = [];
    }

    // Load consecutive failures
    const cfPath = path.join(this.outputDir, 'consecutive-failures');
    try {
      this.consecutiveFailures = parseInt(await fs.readFile(cfPath, 'utf-8'), 10) || 0;
    } catch {
      this.consecutiveFailures = 0;
    }
  }

  async runDailySuite(options: RunOptions = {}): Promise<E2ETestRun> {
    // Prevent concurrent runs
    if (this.isRunning) {
      this.emitEvent('e2e:skipped', { reason: 'already_running' });
      throw new Error('E2E test run already in progress');
    }

    this.isRunning = true;
    const runId = randomUUID();
    const startTime = Date.now();

    try {
      // Emit start event
      const scenarioCount = await this.countScenarios(options);
      this.emitEvent('e2e:run_started', {
        runId,
        scenarioCount,
        timestamp: new Date().toISOString(),
      });

      // Run Playwright
      const results = await this.runPlaywright(runId, options);

      // Process results
      const run: E2ETestRun = {
        id: runId,
        timestamp: new Date().toISOString(),
        passed: results.filter(r => r.passed).length,
        failed: results.filter(r => !r.passed).length,
        skipped: 0,
        duration: Date.now() - startTime,
        scenarios: results,
        consecutiveFailures: this.consecutiveFailures,
        triggeredBy: options.triggeredBy || 'manual',
        issuesFiled: [],
      };

      // Handle failures
      if (run.failed > 0) {
        this.consecutiveFailures++;
        await this.persistConsecutiveFailures();

        if (this.consecutiveFailures >= this.alertThreshold) {
          // File GitHub issue
          const issueNumber = await this.fileGitHubIssue(run);
          if (issueNumber) {
            run.issuesFiled.push(issueNumber);
          }
        }
      } else {
        this.consecutiveFailures = 0;
        await this.persistConsecutiveFailures();
      }

      // Update history
      this.history.unshift(run);
      if (this.history.length > 100) {
        this.history = this.history.slice(0, 100);
      }
      await this.persistHistory();

      // Emit completion
      this.emitEvent('e2e:run_complete', {
        runId,
        passed: run.passed,
        failed: run.failed,
        skipped: run.skipped,
        duration: run.duration,
        consecutiveFailures: this.consecutiveFailures,
      });

      return run;

    } finally {
      this.isRunning = false;
    }
  }

  private emitEvent(event: string, payload: Record<string, unknown>): void {
    if (this.eventBus) {
      // Cast to the expected type since EventBus is strongly typed
      (this.eventBus as unknown as { emit: (e: string, p: unknown) => void }).emit(event, payload);
    }
  }

  private async runPlaywright(runId: string, options: RunOptions): Promise<E2EScenarioResult[]> {
    return new Promise((resolve) => {
      const args = ['playwright', 'test', '--reporter=json'];

      // Add category filter
      if (options.category) {
        args.push(`--project=${options.category}`);
      }

      // Add tag filter
      if (options.tag) {
        args.push(`--grep=${options.tag}`);
      }

      const child = spawn('npx', args, {
        cwd: this.projectRoot,
        env: {
          ...process.env,
          E2E_RUN_ID: runId,
          E2E_OUTPUT_DIR: this.outputDir,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      child.stdout?.on('data', () => {
        // Consume stdout
      });

      child.stderr?.on('data', () => {
        // Consume stderr
      });

      child.on('close', () => {
        // Parse JSON output
        void (async () => {
          try {
            const resultsPath = path.join(this.outputDir, 'results.json');
            const rawResults: unknown = JSON.parse(await fs.readFile(resultsPath, 'utf-8'));
            const scenarios = this.parsePlaywrightResults(rawResults);
            resolve(scenarios);
          } catch {
            // Return empty results if parsing fails
            // eslint-disable-next-line no-console
            console.error('Failed to parse Playwright results');
            resolve([]);
          }
        })();
      });

      child.on('error', () => {
        resolve([]);
      });
    });
  }

  private parsePlaywrightResults(rawResults: unknown): E2EScenarioResult[] {
    const results: E2EScenarioResult[] = [];
    const suites = (rawResults as { suites?: unknown[] })?.suites || [];

    const processSuite = (suite: { title?: string; tests?: unknown[]; suites?: unknown[] }) => {
      for (const test of (suite.tests || []) as { title?: string; results?: { status?: string; duration?: number; error?: { message?: string }; attachments?: { name?: string; path?: string }[] }[] }[]) {
        results.push({
          scenario: `${suite.title || 'Unknown'} > ${test.title || 'Unknown'}`,
          passed: test.results?.[0]?.status === 'passed',
          duration: test.results?.[0]?.duration || 0,
          error: test.results?.[0]?.error?.message,
          screenshot: test.results?.[0]?.attachments?.find(a => a.name === 'screenshot')?.path,
          retries: (test.results?.length || 1) > 1 ? (test.results?.length || 1) - 1 : 0,
          tags: [],
        });
      }

      for (const child of (suite.suites || []) as typeof suite[]) {
        processSuite(child);
      }
    };

    for (const suite of suites as { title?: string; tests?: unknown[]; suites?: unknown[] }[]) {
      processSuite(suite);
    }

    return results;
  }

  private async countScenarios(options: RunOptions): Promise<number> {
    try {
      const { stdout } = await execAsync(
        `npx playwright test --list ${options.category ? `--project=${options.category}` : ''}`,
        { cwd: this.projectRoot }
      );
      // Count lines that look like test names
      return stdout.split('\n').filter(line => line.includes('>')).length || 10;
    } catch {
      return 10; // Default estimate
    }
  }

  private async fileGitHubIssue(run: E2ETestRun): Promise<number | null> {
    const failedScenarios = run.scenarios.filter(s => !s.passed);
    const date = new Date().toISOString().split('T')[0];

    const title = `[E2E] ${run.failed} test(s) failed - ${date}`;
    const body = this.formatIssueBody(run, failedScenarios);

    try {
      const { stdout } = await execAsync(
        `gh issue create --title "${title}" --body "${body.replace(/"/g, '\\"')}" --label "bug,e2e,automated"`,
        { cwd: this.projectRoot }
      );

      const match = stdout.match(/\/issues\/(\d+)/);
      const issueNumber = match ? parseInt(match[1], 10) : null;

      if (issueNumber) {
        this.emitEvent('e2e:bug_filed', {
          runId: run.id,
          issueUrl: stdout.trim(),
          issueNumber,
        });
      }

      return issueNumber;
    } catch (error) {
      console.error('Failed to file GitHub issue:', error);
      return null;
    }
  }

  private formatIssueBody(run: E2ETestRun, failedScenarios: E2EScenarioResult[]): string {
    return `## E2E Test Failure Report

**Run ID:** \`${run.id.slice(0, 8)}\`
**Timestamp:** ${run.timestamp}
**Consecutive Failures:** ${this.consecutiveFailures}

### Summary
| Passed | Failed | Duration |
|--------|--------|----------|
| ${run.passed} | ${run.failed} | ${(run.duration / 1000).toFixed(1)}s |

### Failed Tests
${failedScenarios.map(s => `
#### ${s.scenario}
- **Duration:** ${s.duration}ms
- **Retries:** ${s.retries}
${s.error ? `- **Error:**\n\`\`\`\n${s.error.slice(0, 500)}\n\`\`\`` : ''}
`).join('\n')}

### Environment
- **Triggered By:** ${run.triggeredBy}
- **Node:** ${process.version}
- **Platform:** ${process.platform}

---
*This issue was automatically filed by ARI's E2E testing system.*
`;
  }

  private async persistHistory(): Promise<void> {
    const historyPath = path.join(this.outputDir, 'history.json');
    await fs.writeFile(historyPath, JSON.stringify(this.history, null, 2));
  }

  private async persistConsecutiveFailures(): Promise<void> {
    const cfPath = path.join(this.outputDir, 'consecutive-failures');
    await fs.writeFile(cfPath, String(this.consecutiveFailures));
  }

  // Public getters for API
  getRunHistory(): E2ETestRun[] {
    return this.history;
  }

  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  isCurrentlyRunning(): boolean {
    return this.isRunning;
  }

  getPassRate(): number {
    if (this.history.length === 0) return 0;
    const successfulRuns = this.history.filter(r => r.failed === 0).length;
    return (successfulRuns / this.history.length) * 100;
  }

  getLastRun(): E2ETestRun | null {
    return this.history[0] || null;
  }
}
