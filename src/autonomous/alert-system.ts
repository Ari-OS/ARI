/**
 * ARI Alert System
 *
 * Intelligent notification system that decides when to alert the operator.
 * Uses council voting to prevent spam while ensuring important alerts get through.
 *
 * Flow:
 * 1. Threshold triggered or important event occurs
 * 2. Council votes on whether to notify
 * 3. If approved, notification sent via NotificationManager
 * 4. Activity logged to daily audit
 */

import { notificationManager } from './notification-manager.js';
import { dailyAudit, ThresholdConfig } from './daily-audit.js';
// Alert severity levels
export type AlertSeverity = 'info' | 'warning' | 'critical';

// Alert categories
export type AlertCategory =
  | 'threshold'      // Metric threshold crossed
  | 'opportunity'    // Time-sensitive opportunity
  | 'completion'     // Important task completed
  | 'error'          // Significant error
  | 'security'       // Security-related
  | 'insight'        // Valuable insight
  | 'reminder'       // Scheduled reminder
  | 'question';      // ARI needs input

// Council voter perspectives
interface CouncilVoter {
  id: string;
  name: string;
  weight: number;
  evaluate: (alert: AlertRequest) => VoteDecision;
}

// Vote decision
interface VoteDecision {
  vote: 'send' | 'batch' | 'suppress';
  confidence: number;
  reasoning: string;
}

// Alert request
export interface AlertRequest {
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  source: string;
  timestamp: string;
}

// Council decision
export interface CouncilDecision {
  alertId: string;
  votes: { voterId: string; decision: VoteDecision }[];
  finalDecision: 'send' | 'batch' | 'suppress';
  totalScore: number;
  reasoning: string;
  decidedAt: string;
}

// Alert system configuration
export interface AlertConfig {
  enabled: boolean;
  quietHoursStart: number;  // 24h format
  quietHoursEnd: number;
  maxAlertsPerHour: number;
  maxAlertsPerDay: number;
  councilThreshold: number; // Score needed to send (0-1)
  batchedAlertTime: number; // Hour to send batched alerts
}

const DEFAULT_CONFIG: AlertConfig = {
  enabled: true,
  quietHoursStart: 22,
  quietHoursEnd: 7,
  maxAlertsPerHour: 5,
  maxAlertsPerDay: 15,
  councilThreshold: 0.6,
  batchedAlertTime: 8,
};

// Map alert categories to notification categories
const ALERT_TO_NOTIFICATION_CATEGORY: Record<AlertCategory, string> = {
  threshold: 'system',
  opportunity: 'opportunity',
  completion: 'task',
  error: 'error',
  security: 'security',
  insight: 'insight',
  reminder: 'reminder',
  question: 'question',
};

// Map alert severity to notification priority
const SEVERITY_TO_PRIORITY: Record<AlertSeverity, 'critical' | 'high' | 'normal'> = {
  critical: 'critical',
  warning: 'high',
  info: 'normal',
};

// The Council - multiple perspectives evaluate each alert
const COUNCIL: CouncilVoter[] = [
  {
    id: 'urgency',
    name: 'Urgency Assessor',
    weight: 0.3,
    evaluate: (alert) => {
      if (alert.severity === 'critical') {
        return { vote: 'send', confidence: 1.0, reasoning: 'Critical severity requires immediate attention' };
      }
      if (alert.category === 'security') {
        return { vote: 'send', confidence: 0.9, reasoning: 'Security alerts are time-sensitive' };
      }
      if (alert.category === 'opportunity') {
        return { vote: 'send', confidence: 0.8, reasoning: 'Opportunities may be time-limited' };
      }
      if (alert.severity === 'warning') {
        return { vote: 'send', confidence: 0.6, reasoning: 'Warning level merits attention' };
      }
      return { vote: 'batch', confidence: 0.7, reasoning: 'Info level can wait for summary' };
    },
  },
  {
    id: 'value',
    name: 'Value Assessor',
    weight: 0.25,
    evaluate: (alert) => {
      if (alert.category === 'opportunity') {
        return { vote: 'send', confidence: 0.9, reasoning: 'Opportunities provide direct value' };
      }
      if (alert.category === 'insight') {
        return { vote: 'send', confidence: 0.7, reasoning: 'Insights help decision-making' };
      }
      if (alert.category === 'question') {
        return { vote: 'send', confidence: 0.8, reasoning: 'ARI needs input to proceed' };
      }
      if (alert.category === 'completion') {
        return { vote: 'batch', confidence: 0.6, reasoning: 'Completions are nice-to-know' };
      }
      return { vote: 'send', confidence: 0.5, reasoning: 'Standard value assessment' };
    },
  },
  {
    id: 'wellbeing',
    name: 'Wellbeing Guardian',
    weight: 0.25,
    evaluate: (alert) => {
      const hour = new Date().getHours();
      const isLateNight = hour >= 22 || hour < 7;

      if (isLateNight && alert.severity !== 'critical') {
        return { vote: 'batch', confidence: 0.8, reasoning: 'Late night - protect sleep unless critical' };
      }
      if (alert.category === 'error' && alert.severity !== 'critical') {
        return { vote: 'batch', confidence: 0.6, reasoning: 'Non-critical errors can cause unnecessary stress' };
      }
      return { vote: 'send', confidence: 0.5, reasoning: 'No wellbeing concerns' };
    },
  },
  {
    id: 'context',
    name: 'Context Analyzer',
    weight: 0.2,
    evaluate: (alert) => {
      // This would check recent alerts for redundancy
      // Simplified for now
      if (alert.category === 'threshold') {
        return { vote: 'send', confidence: 0.7, reasoning: 'Threshold alerts indicate state change' };
      }
      return { vote: 'send', confidence: 0.5, reasoning: 'No redundancy detected' };
    },
  },
];

/**
 * Alert System
 */
export class AlertSystem {
  private config: AlertConfig;
  private recentAlerts: { timestamp: number; category: AlertCategory }[] = [];
  private batchedAlerts: AlertRequest[] = [];

  constructor(config: Partial<AlertConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Process an alert through the council
   */
  async processAlert(request: AlertRequest): Promise<CouncilDecision> {
    const alertId = crypto.randomUUID();

    // Critical alerts bypass council
    if (request.severity === 'critical') {
      await this.sendAlert(request);
      return {
        alertId,
        votes: [],
        finalDecision: 'send',
        totalScore: 1.0,
        reasoning: 'Critical alert - bypassed council',
        decidedAt: new Date().toISOString(),
      };
    }

    // Check rate limits
    if (this.isRateLimited()) {
      this.batchedAlerts.push(request);
      await dailyAudit.logActivity(
        'notification_batched',
        'Alert batched due to rate limit',
        request.title,
        { details: { category: request.category, severity: request.severity } }
      );
      return {
        alertId,
        votes: [],
        finalDecision: 'batch',
        totalScore: 0,
        reasoning: 'Rate limited - batched for later',
        decidedAt: new Date().toISOString(),
      };
    }

    // Check quiet hours (critical already handled above)
    if (this.isQuietHours()) {
      this.batchedAlerts.push(request);
      await dailyAudit.logActivity(
        'notification_batched',
        'Alert batched for quiet hours',
        request.title,
        { details: { category: request.category, severity: request.severity } }
      );
      return {
        alertId,
        votes: [],
        finalDecision: 'batch',
        totalScore: 0,
        reasoning: 'Quiet hours - batched for morning',
        decidedAt: new Date().toISOString(),
      };
    }

    // Council vote
    const votes: { voterId: string; decision: VoteDecision }[] = [];
    let totalScore = 0;

    for (const voter of COUNCIL) {
      const decision = voter.evaluate(request);
      votes.push({ voterId: voter.id, decision });

      if (decision.vote === 'send') {
        totalScore += voter.weight * decision.confidence;
      } else if (decision.vote === 'batch') {
        totalScore += voter.weight * (1 - decision.confidence) * 0.3;
      }
    }

    // Make final decision
    let finalDecision: 'send' | 'batch' | 'suppress';
    let reasoning: string;

    if (totalScore >= this.config.councilThreshold) {
      finalDecision = 'send';
      reasoning = `Council approved (score: ${totalScore.toFixed(2)})`;
      await this.sendAlert(request);
    } else if (totalScore >= this.config.councilThreshold * 0.5) {
      finalDecision = 'batch';
      reasoning = `Council batched (score: ${totalScore.toFixed(2)})`;
      this.batchedAlerts.push(request);
      await dailyAudit.logActivity(
        'notification_batched',
        'Alert batched by council',
        request.title,
        { details: { category: request.category, severity: request.severity, score: totalScore } }
      );
    } else {
      finalDecision = 'suppress';
      reasoning = `Council suppressed (score: ${totalScore.toFixed(2)})`;
      await dailyAudit.logActivity(
        'council_vote',
        'Alert suppressed by council',
        request.title,
        { details: { category: request.category, severity: request.severity, score: totalScore }, outcome: 'skipped' }
      );
    }

    return {
      alertId,
      votes,
      finalDecision,
      totalScore,
      reasoning,
      decidedAt: new Date().toISOString(),
    };
  }

  /**
   * Send an alert via NotificationManager
   */
  private async sendAlert(request: AlertRequest): Promise<boolean> {
    const category = ALERT_TO_NOTIFICATION_CATEGORY[request.category] ?? 'system';
    const priority = SEVERITY_TO_PRIORITY[request.severity];

    const result = await notificationManager.notify({
      category: category as Parameters<typeof notificationManager.notify>[0]['category'],
      title: request.title,
      body: request.message,
      priority,
    });

    if (result.sent) {
      this.recentAlerts.push({
        timestamp: Date.now(),
        category: request.category,
      });

      await dailyAudit.logActivity(
        'notification_sent',
        request.title,
        request.message,
        { details: { category: request.category, severity: request.severity }, outcome: 'success' }
      );
    }

    return result.sent;
  }

  /**
   * Send batched alerts as a summary
   */
  async sendBatchedAlerts(): Promise<void> {
    if (this.batchedAlerts.length === 0) return;

    const summary = this.batchedAlerts
      .map(a => `• ${a.title}`)
      .join('\n');

    await notificationManager.notify({
      category: 'daily',
      title: 'Batched Alerts Summary',
      body: `${this.batchedAlerts.length} batched updates:\n\n${summary}`,
      priority: 'normal',
    });

    await dailyAudit.logActivity(
      'notification_sent',
      'Daily Summary',
      `Sent ${this.batchedAlerts.length} batched alerts`,
      { outcome: 'success' }
    );

    this.batchedAlerts = [];
  }

  /**
   * Check if currently in quiet hours
   */
  private isQuietHours(): boolean {
    const hour = new Date().getHours();
    if (this.config.quietHoursStart > this.config.quietHoursEnd) {
      return hour >= this.config.quietHoursStart || hour < this.config.quietHoursEnd;
    }
    return hour >= this.config.quietHoursStart && hour < this.config.quietHoursEnd;
  }

  /**
   * Check if rate limited
   */
  private isRateLimited(): boolean {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    // Clean old entries
    this.recentAlerts = this.recentAlerts.filter(a => a.timestamp > oneDayAgo);

    const hourlyCount = this.recentAlerts.filter(a => a.timestamp > oneHourAgo).length;
    const dailyCount = this.recentAlerts.length;

    return hourlyCount >= this.config.maxAlertsPerHour || dailyCount >= this.config.maxAlertsPerDay;
  }

  /**
   * Trigger a threshold alert
   */
  async triggerThresholdAlert(threshold: ThresholdConfig, currentValue: number): Promise<void> {
    await this.processAlert({
      category: 'threshold',
      severity: threshold.severity,
      title: threshold.name,
      message: `${threshold.description}\nCurrent: ${currentValue}`,
      data: { threshold, currentValue },
      source: 'threshold_monitor',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get pending batched alerts count
   */
  getBatchedCount(): number {
    return this.batchedAlerts.length;
  }
}

// Singleton
export const alertSystem = new AlertSystem();
