/**
 * ARI Governance Reporter
 *
 * Aggregates council voting activity, arbiter rulings, and overseer gate results
 * into daily snapshots for morning/evening briefings.
 *
 * Listens to governance events via EventBus and maintains rolling 24-hour statistics.
 */

export interface GovernanceSnapshot {
  period: { start: number; end: number };
  council: {
    votesCreated: number;
    votesCompleted: number;
    outcomes: { passed: number; failed: number; expired: number; vetoed: number };
    openVotes: Array<{ voteId: string; topic: string; threshold: string; deadlineMs: number }>;
    vetoes: Array<{ vetoer: string; domain: string; reason: string }>;
    topicsSummary: string[];
  };
  arbiter: {
    evaluations: number;
    violations: number;
    violationsByRule: Record<string, number>;
    complianceRate: number;
  };
  overseer: {
    gatesChecked: number;
    gatesPassed: number;
    gatesFailed: number;
    failedGates: Array<{ gateId: string; reason: string }>;
  };
  pipeline: {
    totalEvents: number;
    eventsByType: Record<string, number>;
  };
}

interface GovernanceEvent {
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

/**
 * Aggregates governance events for reporting in daily briefings.
 */
export class GovernanceReporter {
  private events: GovernanceEvent[] = [];
  private readonly retentionMs: number;

  constructor(retentionMs: number = 24 * 60 * 60 * 1000) {
    this.retentionMs = retentionMs;
  }

  /**
   * Record a governance event (called by EventBus listener).
   */
  recordEvent(type: string, payload: Record<string, unknown>): void {
    this.events.push({ type, payload, timestamp: Date.now() });
    this.pruneOld();
  }

  /**
   * Generate snapshot for the last N milliseconds.
   */
  generateSnapshot(windowMs?: number): GovernanceSnapshot {
    const now = Date.now();
    const window = windowMs ?? this.retentionMs;
    const cutoff = now - window;

    const recentEvents = this.events.filter(e => e.timestamp >= cutoff);

    const period = { start: cutoff, end: now };

    // Council stats
    const voteStarted = recentEvents.filter(e => e.type === 'vote:started');
    const voteCompleted = recentEvents.filter(e => e.type === 'vote:completed');
    const voteVetoed = recentEvents.filter(e => e.type === 'vote:vetoed');

    const outcomes = {
      passed: voteCompleted.filter(e => e.payload.status === 'PASSED').length,
      failed: voteCompleted.filter(e => e.payload.status === 'FAILED').length,
      expired: voteCompleted.filter(e => e.payload.status === 'EXPIRED').length,
      vetoed: voteCompleted.filter(e => e.payload.status === 'VETOED').length,
    };

    const openVotes: Array<{ voteId: string; topic: string; threshold: string; deadlineMs: number }> = [];
    const topicsSet = new Set<string>();

    for (const event of voteStarted) {
      const voteId = event.payload.voteId as string;
      const topic = event.payload.topic as string;
      const threshold = event.payload.threshold as string;
      const deadline = event.payload.deadline as string;

      topicsSet.add(topic);

      // Check if vote was completed
      const completed = voteCompleted.some(e => e.payload.voteId === voteId);
      if (!completed) {
        const deadlineMs = new Date(deadline).getTime();
        openVotes.push({ voteId, topic, threshold, deadlineMs });
      }
    }

    const vetoes = voteVetoed.map(e => ({
      vetoer: (e.payload.vetoer as string) || 'unknown',
      domain: (e.payload.domain as string) || 'unknown',
      reason: (e.payload.reason as string) || 'No reason provided',
    }));

    const council = {
      votesCreated: voteStarted.length,
      votesCompleted: voteCompleted.length,
      outcomes,
      openVotes,
      vetoes,
      topicsSummary: Array.from(topicsSet),
    };

    // Arbiter stats
    const arbiterRulings = recentEvents.filter(e => e.type === 'arbiter:ruling');
    const violationCount = arbiterRulings.filter(e => e.payload.decision === 'DENIED').length;

    const violationsByRule: Record<string, number> = {};
    for (const ruling of arbiterRulings) {
      if (ruling.payload.decision === 'DENIED') {
        const ruleType = ruling.payload.type as string | undefined;
        if (ruleType) {
          violationsByRule[ruleType] = (violationsByRule[ruleType] || 0) + 1;
        }
      }
    }

    const arbiter = {
      evaluations: arbiterRulings.length,
      violations: violationCount,
      violationsByRule,
      complianceRate: arbiterRulings.length > 0
        ? ((arbiterRulings.length - violationCount) / arbiterRulings.length) * 100
        : 100,
    };

    // Overseer stats
    const overseerGates = recentEvents.filter(e => e.type === 'overseer:gate');
    const gatesPassed = overseerGates.filter(e => e.payload.passed === true).length;
    const gatesFailed = overseerGates.filter(e => e.payload.passed === false).length;

    const failedGates = overseerGates
      .filter(e => e.payload.passed === false)
      .map(e => ({
        gateId: (e.payload.gateId as string) || 'unknown',
        reason: (e.payload.reason as string) || 'No reason provided',
      }));

    const overseer = {
      gatesChecked: overseerGates.length,
      gatesPassed,
      gatesFailed,
      failedGates,
    };

    // Pipeline stats
    const eventsByType: Record<string, number> = {};
    for (const event of recentEvents) {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
    }

    const pipeline = {
      totalEvents: recentEvents.length,
      eventsByType,
    };

    return {
      period,
      council,
      arbiter,
      overseer,
      pipeline,
    };
  }

  /**
   * Format snapshot as Telegram HTML for briefing inclusion.
   */
  formatForBriefing(snapshot: GovernanceSnapshot): string {
    const { council, arbiter, overseer, pipeline } = snapshot;

    // No activity case
    if (pipeline.totalEvents === 0) {
      return '<b>⚖️ Governance</b>\n▸ No governance activity in the last 24 hours';
    }

    const lines: string[] = ['<b>⚖️ Governance</b>'];

    // Council summary
    if (council.votesCreated > 0 || council.votesCompleted > 0) {
      const { passed, failed, expired, vetoed } = council.outcomes;
      const parts: string[] = [];
      if (passed > 0) parts.push(`${passed} passed`);
      if (failed > 0) parts.push(`${failed} failed`);
      if (expired > 0) parts.push(`${expired} expired`);
      if (vetoed > 0) parts.push(`${vetoed} vetoed`);

      const summary = parts.length > 0 ? ` (${parts.join(', ')})` : '';
      lines.push(`▸ Council: ${council.votesCompleted} votes${summary}`);
    }

    // Veto highlights
    if (council.vetoes.length > 0) {
      for (const veto of council.vetoes) {
        lines.push(`▸ Veto: ${veto.vetoer} blocked ${veto.domain}`);
      }
    }

    // Arbiter compliance
    if (arbiter.evaluations > 0) {
      const complianceStr = arbiter.complianceRate.toFixed(0);
      lines.push(`▸ Arbiter: ${arbiter.evaluations} evaluations, ${complianceStr}% compliant`);
    }

    // Overseer gates
    if (overseer.gatesChecked > 0) {
      lines.push(`▸ Gates: ${overseer.gatesPassed}/${overseer.gatesChecked} passing`);
    }

    // Pipeline throughput
    if (pipeline.totalEvents > 0) {
      lines.push(`▸ Pipeline: ${pipeline.totalEvents} governance events processed`);
    }

    return lines.join('\n');
  }

  /**
   * Get event count for a time window.
   */
  getEventCount(windowMs?: number): number {
    const now = Date.now();
    const window = windowMs ?? this.retentionMs;
    const cutoff = now - window;

    return this.events.filter(e => e.timestamp >= cutoff).length;
  }

  /**
   * Clear all recorded events.
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Remove events older than retention period.
   */
  private pruneOld(): void {
    const now = Date.now();
    const cutoff = now - this.retentionMs;
    this.events = this.events.filter(e => e.timestamp >= cutoff);
  }
}

/**
 * Singleton instance for use across the system.
 */
export const governanceReporter = new GovernanceReporter();
