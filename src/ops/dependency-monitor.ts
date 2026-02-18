/**
 * DEPENDENCY MONITOR — npm audit and outdated package tracking
 *
 * Runs `npm audit --json` and `npm outdated --json` via execFileNoThrow
 * to provide a dependency health score and actionable recommendations.
 *
 * Phase 24-25: Dev Infrastructure
 */

import type { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';
import { execFileNoThrow } from '../utils/execFileNoThrow.js';

const log = createLogger('dependency-monitor');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AuditResult {
  vulnerabilities: {
    critical: number;
    high: number;
    moderate: number;
    low: number;
  };
  totalDependencies: number;
  details: Array<{
    package: string;
    severity: string;
    description: string;
    fixAvailable: boolean;
  }>;
}

export interface OutdatedPackage {
  name: string;
  current: string;
  latest: string;
  type: 'dependencies' | 'devDependencies';
}

export interface DependencyReport {
  healthy: boolean;
  score: number;
  criticalIssues: string[];
  recommendations: string[];
  summary: string;
}

// ─── Severity weights for scoring ───────────────────────────────────────────

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 25,
  high: 15,
  moderate: 5,
  low: 1,
};

// ─── Monitor ────────────────────────────────────────────────────────────────

export class DependencyMonitor {
  private readonly projectPath: string;
  private readonly eventBus: EventBus;

  constructor(params: {
    projectPath: string;
    eventBus: EventBus;
  }) {
    this.projectPath = params.projectPath;
    this.eventBus = params.eventBus;
  }

  /**
   * Run npm audit and parse results.
   */
  async audit(): Promise<AuditResult> {
    log.info({ projectPath: this.projectPath }, 'Running npm audit');

    const result = await execFileNoThrow('npm', ['audit', '--json'], {
      cwd: this.projectPath,
      timeoutMs: 60_000,
    });

    // npm audit exits non-zero when vulnerabilities exist; that's expected
    const output = result.stdout || '{}';

    try {
      const parsed = JSON.parse(output) as Record<string, unknown>;
      return this.parseAuditOutput(parsed);
    } catch (error) {
      log.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to parse npm audit output',
      );
      return {
        vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0 },
        totalDependencies: 0,
        details: [],
      };
    }
  }

  /**
   * Check for outdated packages.
   */
  async checkOutdated(): Promise<OutdatedPackage[]> {
    log.info({ projectPath: this.projectPath }, 'Checking outdated packages');

    const result = await execFileNoThrow('npm', ['outdated', '--json'], {
      cwd: this.projectPath,
      timeoutMs: 60_000,
    });

    // npm outdated exits non-zero when outdated packages exist; that's expected
    const output = result.stdout || '{}';

    try {
      const parsed = JSON.parse(output) as Record<string, Record<string, unknown>>;
      return this.parseOutdatedOutput(parsed);
    } catch (error) {
      log.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to parse npm outdated output',
      );
      return [];
    }
  }

  /**
   * Generate a dependency health report from audit and outdated data.
   */
  generateReport(auditResult: AuditResult, outdated: OutdatedPackage[]): DependencyReport {
    const criticalIssues: string[] = [];
    const recommendations: string[] = [];

    // Score deductions for vulnerabilities
    const vulnDeduction =
      auditResult.vulnerabilities.critical * SEVERITY_WEIGHTS.critical +
      auditResult.vulnerabilities.high * SEVERITY_WEIGHTS.high +
      auditResult.vulnerabilities.moderate * SEVERITY_WEIGHTS.moderate +
      auditResult.vulnerabilities.low * SEVERITY_WEIGHTS.low;

    // Score deductions for outdated packages (1 point per outdated)
    const outdatedDeduction = Math.min(outdated.length, 20);

    const score = Math.max(0, 100 - vulnDeduction - outdatedDeduction);
    const healthy = score >= 70 && auditResult.vulnerabilities.critical === 0;

    // Critical issues
    if (auditResult.vulnerabilities.critical > 0) {
      criticalIssues.push(
        `${auditResult.vulnerabilities.critical} critical vulnerabilit${auditResult.vulnerabilities.critical === 1 ? 'y' : 'ies'} found.`,
      );
    }
    if (auditResult.vulnerabilities.high > 0) {
      criticalIssues.push(
        `${auditResult.vulnerabilities.high} high-severity vulnerabilit${auditResult.vulnerabilities.high === 1 ? 'y' : 'ies'} found.`,
      );
    }

    // Recommendations
    const fixable = auditResult.details.filter(d => d.fixAvailable);
    if (fixable.length > 0) {
      recommendations.push(`Run \`npm audit fix\` to resolve ${fixable.length} auto-fixable issue(s).`);
    }

    if (outdated.length > 0) {
      const majorOutdated = outdated.slice(0, 5).map(p => `${p.name} (${p.current} -> ${p.latest})`);
      recommendations.push(`Update outdated packages: ${majorOutdated.join(', ')}`);
    }

    if (auditResult.vulnerabilities.critical > 0) {
      recommendations.push('Address critical vulnerabilities immediately — they may allow remote code execution.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Dependencies are healthy. No immediate action needed.');
    }

    const totalVulns =
      auditResult.vulnerabilities.critical +
      auditResult.vulnerabilities.high +
      auditResult.vulnerabilities.moderate +
      auditResult.vulnerabilities.low;

    const summary = `Dependency health: ${score}/100. ` +
      `${totalVulns} vulnerabilit${totalVulns === 1 ? 'y' : 'ies'}, ` +
      `${outdated.length} outdated package(s).`;

    this.eventBus.emit('audit:log', {
      action: 'deps:audit_completed',
      agent: 'system',
      trustLevel: 'system',
      details: {
        score,
        healthy,
        vulnerabilities: auditResult.vulnerabilities,
        outdatedCount: outdated.length,
      },
    });

    if (auditResult.vulnerabilities.critical > 0 || auditResult.vulnerabilities.high > 0) {
      this.eventBus.emit('audit:log', {
        action: 'deps:vulnerability_found',
        agent: 'system',
        trustLevel: 'system',
        details: {
          critical: auditResult.vulnerabilities.critical,
          high: auditResult.vulnerabilities.high,
        },
      });
    }

    return { healthy, score, criticalIssues, recommendations, summary };
  }

  // ─── Private ────────────────────────────────────────────────────────────

  private parseAuditOutput(raw: Record<string, unknown>): AuditResult {
    const metadata = raw.metadata as Record<string, unknown> | undefined;
    const vulnerabilities = (metadata?.vulnerabilities ?? raw.vulnerabilities ?? {}) as Record<string, unknown>;

    const vulnCounts = {
      critical: Number(vulnerabilities.critical ?? 0),
      high: Number(vulnerabilities.high ?? 0),
      moderate: Number(vulnerabilities.moderate ?? 0),
      low: Number(vulnerabilities.low ?? 0),
    };

    const totalDependencies = Number(metadata?.totalDependencies ?? metadata?.dependencies ?? 0);

    // Parse advisory details
    const details: AuditResult['details'] = [];
    const advisories = (raw.advisories ?? raw.vulnerabilities ?? {}) as Record<string, unknown>;

    if (typeof advisories === 'object' && advisories !== null) {
      for (const [, advisory] of Object.entries(advisories)) {
        if (typeof advisory === 'object' && advisory !== null) {
          const adv = advisory as Record<string, unknown>;
          details.push({
            package: typeof adv.module_name === 'string' ? adv.module_name : typeof adv.name === 'string' ? adv.name : 'unknown',
            severity: typeof adv.severity === 'string' ? adv.severity : 'unknown',
            description: (typeof adv.title === 'string' ? adv.title : typeof adv.overview === 'string' ? adv.overview : '').slice(0, 200),
            fixAvailable: Boolean(adv.fixAvailable ?? adv.patched_versions !== '<0.0.0'),
          });
        }
      }
    }

    return { vulnerabilities: vulnCounts, totalDependencies, details };
  }

  private parseOutdatedOutput(raw: Record<string, Record<string, unknown>>): OutdatedPackage[] {
    const packages: OutdatedPackage[] = [];

    for (const [name, info] of Object.entries(raw)) {
      if (typeof info !== 'object' || info === null) continue;

      packages.push({
        name,
        current: typeof info.current === 'string' ? info.current : 'unknown',
        latest: typeof info.latest === 'string' ? info.latest : 'unknown',
        type: (typeof info.type === 'string' ? info.type : 'dependencies') === 'devDependencies'
          ? 'devDependencies'
          : 'dependencies',
      });
    }

    return packages;
  }
}
