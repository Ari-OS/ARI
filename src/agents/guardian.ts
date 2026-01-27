import { createHash } from 'crypto';
import type { AuditLogger } from '../kernel/audit.js';
import type { EventBus } from '../kernel/event-bus.js';
import type { Message, TrustLevel } from '../kernel/types.js';

type ThreatLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

interface ThreatAssessment {
  threat_level: ThreatLevel;
  risk_score: number;
  patterns_detected: string[];
  should_block: boolean;
  should_escalate: boolean;
}

interface SourceBaseline {
  message_count: number;
  avg_length: number;
  avg_interval_ms: number;
  last_message_time: number;
  injection_attempts: number;
}

interface GuardianStats {
  baselines_tracked: number;
  recent_messages: number;
  injection_history_size: number;
}

/**
 * Guardian agent - Security monitoring and threat detection
 * Analyzes all incoming messages for security threats and anomalies
 */
export class Guardian {
  private readonly auditLogger: AuditLogger;
  private readonly eventBus: EventBus;
  private unsubscribe: (() => void) | null = null;

  // Baseline tracking
  private baselines = new Map<string, SourceBaseline>();
  private recentMessages: Array<{ source: string; timestamp: number; length: number }> = [];
  private injectionHistory: Array<{ source: string; timestamp: number; pattern: string }> = [];

  // Rate limiting
  private readonly RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
  private readonly RATE_LIMIT_MAX = 60;

  // Anomaly thresholds
  private readonly LENGTH_ANOMALY_FACTOR = 3.0;
  private readonly TIMING_ANOMALY_FACTOR = 0.1; // 10% of normal interval

  // Injection patterns
  private readonly INJECTION_PATTERNS = [
    { pattern: /\$\{.*\}/g, name: 'template_injection', weight: 0.8 },
    { pattern: /eval\s*\(/gi, name: 'eval_injection', weight: 1.0 },
    { pattern: /exec\s*\(/gi, name: 'exec_injection', weight: 1.0 },
    { pattern: /__proto__|constructor\[/gi, name: 'prototype_pollution', weight: 0.9 },
    { pattern: /\.\.\//g, name: 'path_traversal', weight: 0.7 },
    { pattern: /<script/gi, name: 'xss_attempt', weight: 0.6 },
    { pattern: /union.*select/gi, name: 'sql_injection', weight: 0.8 },
    { pattern: /;\s*rm\s+-rf/gi, name: 'command_injection', weight: 1.0 },
  ];

  constructor(auditLogger: AuditLogger, eventBus: EventBus) {
    this.auditLogger = auditLogger;
    this.eventBus = eventBus;
  }

  /**
   * Start monitoring messages
   */
  start(): void {
    this.unsubscribe = this.eventBus.on('message:accepted', (message) => {
      this.analyzeMessage(message);
    });
  }

  /**
   * Stop monitoring messages
   */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /**
   * Analyze a message for security threats
   */
  private async analyzeMessage(message: Message): Promise<void> {
    const sourceKey = this.getSourceKey(message.source);
    const assessment = this.assessThreat(message.content, message.source);

    // Update baselines
    this.updateBaseline(sourceKey, message);

    // Log high-risk assessments
    if (assessment.risk_score > 0.5) {
      await this.auditLogger.log(
        'guardian:threat_detected',
        'guardian',
        'system',
        {
          message_id: message.id,
          source: message.source,
          threat_level: assessment.threat_level,
          risk_score: assessment.risk_score,
          patterns: assessment.patterns_detected,
        }
      );
    }

    // Handle blocks and escalations
    if (assessment.should_block) {
      await this.auditLogger.logSecurity({
        eventType: 'injection_detected',
        severity: assessment.threat_level === 'critical' ? 'critical' : 'high',
        source: sourceKey,
        details: {
          message_id: message.id,
          patterns: assessment.patterns_detected,
          risk_score: assessment.risk_score,
        },
        mitigated: true,
      });

      this.eventBus.emit('security:alert', {
        type: 'threat_blocked',
        source: sourceKey,
        data: {
          message_id: message.id,
          threat_level: assessment.threat_level,
          patterns: assessment.patterns_detected,
        },
      });
    }

    if (assessment.should_escalate) {
      this.eventBus.emit('security:alert', {
        type: 'threat_escalation',
        source: sourceKey,
        data: {
          message_id: message.id,
          threat_level: assessment.threat_level,
          risk_score: assessment.risk_score,
          patterns: assessment.patterns_detected,
        },
      });
    }
  }

  /**
   * Assess threat level for message content from a source
   * Public method for other agents to use
   */
  assessThreat(content: string, source: TrustLevel): ThreatAssessment {
    const sourceKey = this.getSourceKey(source);

    // Calculate injection risk
    const injectionResult = this.detectInjection(content, sourceKey);

    // Calculate anomaly score
    const anomalyScore = this.detectAnomalies(sourceKey, content.length);

    // Check rate limiting
    const rateLimitViolation = this.checkRateLimit(sourceKey);

    // Calculate combined risk score
    const trustPenalty = this.getTrustPenalty(source);
    let risk_score = (injectionResult.score * 0.5) + (anomalyScore * 0.3) + (trustPenalty * 0.2);

    if (rateLimitViolation) {
      risk_score = Math.min(1.0, risk_score + 0.3);
    }

    // Determine threat level
    let threat_level: ThreatLevel = 'none';
    if (risk_score >= 0.9) threat_level = 'critical';
    else if (risk_score >= 0.7) threat_level = 'high';
    else if (risk_score >= 0.5) threat_level = 'medium';
    else if (risk_score >= 0.3) threat_level = 'low';

    const patterns_detected = [...injectionResult.patterns];
    if (rateLimitViolation) patterns_detected.push('rate_limit_exceeded');
    if (anomalyScore > 0.5) patterns_detected.push('anomalous_behavior');

    return {
      threat_level,
      risk_score,
      patterns_detected,
      should_block: risk_score >= 0.8,
      should_escalate: risk_score >= 0.6,
    };
  }

  /**
   * Detect injection patterns in content
   */
  private detectInjection(content: string, source: string): { score: number; patterns: string[] } {
    const patterns: string[] = [];
    let score = 0;

    for (const { pattern, name, weight } of this.INJECTION_PATTERNS) {
      if (pattern.test(content)) {
        patterns.push(name);
        score = Math.max(score, weight);

        // Track injection attempt
        this.injectionHistory.push({
          source,
          timestamp: Date.now(),
          pattern: name,
        });

        // Keep only recent history (last 1000 attempts)
        if (this.injectionHistory.length > 1000) {
          this.injectionHistory.shift();
        }
      }
    }

    return { score, patterns };
  }

  /**
   * Detect anomalies based on source baseline
   */
  private detectAnomalies(source: string, messageLength: number): number {
    const baseline = this.baselines.get(source);
    if (!baseline || baseline.message_count < 10) {
      return 0; // Not enough data for baseline
    }

    let anomalyScore = 0;

    // Length anomaly
    if (messageLength > baseline.avg_length * this.LENGTH_ANOMALY_FACTOR) {
      anomalyScore += 0.4;
    }

    // Timing anomaly (too fast)
    const now = Date.now();
    const interval = now - baseline.last_message_time;
    if (interval < baseline.avg_interval_ms * this.TIMING_ANOMALY_FACTOR) {
      anomalyScore += 0.3;
    }

    // Injection spike detection
    const recentInjections = this.injectionHistory.filter(
      (h) => h.source === source && now - h.timestamp < 300000 // 5 minutes
    ).length;
    if (recentInjections > 5) {
      anomalyScore += 0.5;
    }

    return Math.min(1.0, anomalyScore);
  }

  /**
   * Check rate limit for source
   */
  private checkRateLimit(source: string): boolean {
    const now = Date.now();
    const windowStart = now - this.RATE_LIMIT_WINDOW_MS;

    const messagesInWindow = this.recentMessages.filter(
      (m) => m.source === source && m.timestamp > windowStart
    ).length;

    return messagesInWindow > this.RATE_LIMIT_MAX;
  }

  /**
   * Update behavioral baseline for source
   */
  private updateBaseline(source: string, message: Message): void {
    const now = Date.now();
    const messageLength = message.content.length;

    // Update recent messages
    this.recentMessages.push({
      source,
      timestamp: now,
      length: messageLength,
    });

    // Keep only last 1000 messages
    if (this.recentMessages.length > 1000) {
      this.recentMessages.shift();
    }

    let baseline = this.baselines.get(source);
    if (!baseline) {
      baseline = {
        message_count: 0,
        avg_length: 0,
        avg_interval_ms: 0,
        last_message_time: now,
        injection_attempts: 0,
      };
      this.baselines.set(source, baseline);
    }

    // Update running averages
    const count = baseline.message_count;
    baseline.avg_length = (baseline.avg_length * count + messageLength) / (count + 1);

    if (count > 0) {
      const interval = now - baseline.last_message_time;
      baseline.avg_interval_ms = (baseline.avg_interval_ms * (count - 1) + interval) / count;
    }

    baseline.message_count++;
    baseline.last_message_time = now;
  }

  /**
   * Get trust penalty multiplier
   */
  private getTrustPenalty(source: TrustLevel): number {
    const penalties: Record<TrustLevel, number> = {
      system: 0.0,
      operator: 0.0,
      verified: 0.1,
      standard: 0.3,
      untrusted: 0.6,
      hostile: 1.0,
    };
    return penalties[source];
  }

  /**
   * Get source key for tracking
   */
  private getSourceKey(source: TrustLevel): string {
    return `trust:${source}`;
  }

  /**
   * Get guardian statistics
   */
  getStats(): GuardianStats {
    return {
      baselines_tracked: this.baselines.size,
      recent_messages: this.recentMessages.length,
      injection_history_size: this.injectionHistory.length,
    };
  }
}
