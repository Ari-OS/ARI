/**
 * ARI Daily Audit System
 *
 * Generates comprehensive daily reports of all ARI activity.
 * Provides full transparency into what ARI did, decided, and learned.
 *
 * Schedule: Runs automatically at end of day (configurable)
 * Storage: ~/.ari/audits/YYYY-MM-DD.json
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const AUDIT_DIR = path.join(process.env.HOME || '~', '.ari', 'audits');

// Activity types ARI can perform
export type ActivityType =
  | 'task_completed'
  | 'task_failed'
  | 'notification_sent'
  | 'notification_batched'
  | 'knowledge_fetched'
  | 'insight_generated'
  | 'decision_made'
  | 'error_occurred'
  | 'user_interaction'
  | 'system_event'
  | 'council_vote'
  | 'threshold_alert'
  | 'session_started'
  | 'session_ended'
  | 'api_call';

// Single activity entry
export interface ActivityEntry {
  id: string;
  timestamp: string;
  type: ActivityType;
  domain?: string;
  title: string;
  description: string;
  details?: Record<string, unknown>;
  outcome: 'success' | 'failure' | 'pending' | 'skipped';
  tokensUsed?: number;
  costEstimate?: number;
}

// Session tracking for Claude Max
export interface SessionEntry {
  id: string;
  startedAt: string;
  endedAt?: string;
  durationMinutes?: number;
  tasksCompleted: number;
  tokensUsed: number;
  type: 'api' | 'claude_max';
  efficiency?: number; // tasks per hour
  notes?: string;
}

// Daily audit report
export interface DailyAudit {
  date: string;
  generatedAt: string;
  hash: string;
  previousHash: string;
  summary: {
    totalActivities: number;
    successful: number;
    failed: number;
    notificationsSent: number;
    notificationsBatched: number;
    tasksCompleted: number;
    insightsGenerated: number;
    estimatedCost: number;
    tokensUsed: number;
    // Session tracking
    apiCalls: number;
    apiTokensUsed: number;
    apiCost: number;
    claudeMaxSessions: number;
    claudeMaxMinutes: number;
    claudeMaxTasksCompleted: number;
  };
  activities: ActivityEntry[];
  sessions: SessionEntry[];
  highlights: string[];
  issues: string[];
  recommendations: string[];
  // Efficiency learning
  efficiency: {
    tasksPerApiDollar: number;
    tasksPerSessionHour: number;
    avgTokensPerTask: number;
    preferredWorkType: 'api' | 'claude_max' | 'balanced';
  };
}

// Threshold configuration for notifications
export interface ThresholdConfig {
  id: string;
  name: string;
  description: string;
  domain?: string;
  condition: {
    metric: string;
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'change';
    value: number;
    timeframeMinutes?: number;
  };
  severity: 'info' | 'warning' | 'critical';
  cooldownMinutes: number;
  lastTriggered?: string;
  enabled: boolean;
}

// Default thresholds
export const DEFAULT_THRESHOLDS: ThresholdConfig[] = [
  {
    id: 'daily_cost_warning',
    name: 'Daily Cost Warning',
    description: 'Alert when daily API spend approaches limit',
    condition: { metric: 'daily_cost', operator: 'gte', value: 7.0 },
    severity: 'warning',
    cooldownMinutes: 60,
    enabled: true,
  },
  {
    id: 'daily_cost_critical',
    name: 'Daily Cost Critical',
    description: 'Alert when daily API spend exceeds limit',
    condition: { metric: 'daily_cost', operator: 'gte', value: 9.0 },
    severity: 'critical',
    cooldownMinutes: 30,
    enabled: true,
  },
  {
    id: 'error_spike',
    name: 'Error Spike',
    description: 'Alert when errors increase significantly',
    condition: { metric: 'error_count', operator: 'gte', value: 5, timeframeMinutes: 60 },
    severity: 'warning',
    cooldownMinutes: 30,
    enabled: true,
  },
  {
    id: 'task_queue_backup',
    name: 'Task Queue Backup',
    description: 'Alert when tasks are piling up',
    condition: { metric: 'pending_tasks', operator: 'gte', value: 10 },
    severity: 'warning',
    cooldownMinutes: 120,
    enabled: true,
  },
  {
    id: 'high_value_opportunity',
    name: 'High Value Opportunity',
    description: 'Alert for significant opportunities',
    condition: { metric: 'opportunity_score', operator: 'gte', value: 0.8 },
    severity: 'info',
    cooldownMinutes: 0,
    enabled: true,
  },
];

/**
 * Daily Audit System
 */
export class DailyAuditSystem {
  private activities: ActivityEntry[] = [];
  private sessions: SessionEntry[] = [];
  private activeSession: SessionEntry | null = null;
  private thresholds: ThresholdConfig[] = [...DEFAULT_THRESHOLDS];
  private metrics: Map<string, number> = new Map();
  private todayDate: string;

  constructor() {
    this.todayDate = new Date().toISOString().split('T')[0];
  }

  /**
   * Initialize the audit system
   */
  async init(): Promise<void> {
    await fs.mkdir(AUDIT_DIR, { recursive: true });
    await this.loadTodayActivities();
  }

  /**
   * Load today's activities from disk
   */
  private async loadTodayActivities(): Promise<void> {
    try {
      const filepath = path.join(AUDIT_DIR, `${this.todayDate}.json`);
      const data = await fs.readFile(filepath, 'utf-8');
      const audit = JSON.parse(data) as DailyAudit;
      this.activities = audit.activities;
      this.sessions = audit.sessions || [];

      // Restore metrics from activities
      for (const activity of this.activities) {
        if (activity.costEstimate) {
          const currentCost = this.metrics.get('daily_cost') || 0;
          this.metrics.set('daily_cost', currentCost + activity.costEstimate);
        }
        if (activity.tokensUsed) {
          const currentTokens = this.metrics.get('daily_tokens') || 0;
          this.metrics.set('daily_tokens', currentTokens + activity.tokensUsed);
        }
      }
    } catch {
      // No existing audit for today
      this.activities = [];
      this.sessions = [];
    }
  }

  /**
   * Log an activity
   */
  async logActivity(
    type: ActivityType,
    title: string,
    description: string,
    options: {
      domain?: string;
      details?: Record<string, unknown>;
      outcome?: ActivityEntry['outcome'];
      tokensUsed?: number;
      costEstimate?: number;
    } = {}
  ): Promise<ActivityEntry> {
    const entry: ActivityEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      domain: options.domain,
      title,
      description,
      details: options.details,
      outcome: options.outcome || 'success',
      tokensUsed: options.tokensUsed,
      costEstimate: options.costEstimate,
    };

    this.activities.push(entry);

    // Update metrics
    this.updateMetrics(entry);

    // Check thresholds
    await this.checkThresholds();

    // Save incrementally
    await this.saveActivities();

    return entry;
  }

  /**
   * Start a new session (API or Claude Max)
   */
  async startSession(type: 'api' | 'claude_max', notes?: string): Promise<string> {
    // End any existing session first
    if (this.activeSession) {
      await this.endSession();
    }

    const session: SessionEntry = {
      id: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      tasksCompleted: 0,
      tokensUsed: 0,
      type,
      notes,
    };

    this.activeSession = session;
    this.sessions.push(session);

    // Log the session start
    await this.logActivity(
      'session_started',
      `${type === 'claude_max' ? 'Claude Max' : 'API'} Session Started`,
      notes || `Started ${type} session`,
      { details: { sessionId: session.id, type } }
    );

    // Update metrics
    if (type === 'claude_max') {
      const count = this.metrics.get('claude_max_sessions') || 0;
      this.metrics.set('claude_max_sessions', count + 1);
    }

    return session.id;
  }

  /**
   * End the current session
   */
  async endSession(notes?: string): Promise<SessionEntry | null> {
    if (!this.activeSession) return null;

    const session = this.activeSession;
    session.endedAt = new Date().toISOString();

    // Calculate duration
    const startTime = new Date(session.startedAt).getTime();
    const endTime = new Date(session.endedAt).getTime();
    session.durationMinutes = Math.round((endTime - startTime) / 60000);

    // Calculate efficiency (tasks per hour)
    if (session.durationMinutes > 0) {
      session.efficiency = (session.tasksCompleted / session.durationMinutes) * 60;
    }

    if (notes) {
      session.notes = (session.notes || '') + ' | ' + notes;
    }

    // Update metrics
    if (session.type === 'claude_max') {
      const minutes = this.metrics.get('claude_max_minutes') || 0;
      this.metrics.set('claude_max_minutes', minutes + session.durationMinutes);

      const tasks = this.metrics.get('claude_max_tasks') || 0;
      this.metrics.set('claude_max_tasks', tasks + session.tasksCompleted);
    }

    // Log the session end
    await this.logActivity(
      'session_ended',
      `${session.type === 'claude_max' ? 'Claude Max' : 'API'} Session Ended`,
      `Duration: ${session.durationMinutes}min, Tasks: ${session.tasksCompleted}, Efficiency: ${session.efficiency?.toFixed(2) || 'N/A'} tasks/hr`,
      {
        details: {
          sessionId: session.id,
          type: session.type,
          durationMinutes: session.durationMinutes,
          tasksCompleted: session.tasksCompleted,
          tokensUsed: session.tokensUsed,
          efficiency: session.efficiency,
        },
      }
    );

    this.activeSession = null;
    await this.saveActivities();

    return session;
  }

  /**
   * Log an API call
   */
  async logApiCall(
    model: string,
    inputTokens: number,
    outputTokens: number,
    costEstimate: number,
    purpose?: string
  ): Promise<void> {
    const totalTokens = inputTokens + outputTokens;

    await this.logActivity(
      'api_call',
      `API Call: ${model}`,
      purpose || `${inputTokens} in / ${outputTokens} out`,
      {
        tokensUsed: totalTokens,
        costEstimate,
        details: {
          model,
          inputTokens,
          outputTokens,
          purpose,
        },
      }
    );

    // Update API-specific metrics
    const apiCalls = this.metrics.get('api_calls') || 0;
    this.metrics.set('api_calls', apiCalls + 1);

    const apiTokens = this.metrics.get('api_tokens') || 0;
    this.metrics.set('api_tokens', apiTokens + totalTokens);

    const apiCost = this.metrics.get('api_cost') || 0;
    this.metrics.set('api_cost', apiCost + costEstimate);
  }

  /**
   * Record task completion in active session
   */
  recordSessionTask(): void {
    if (this.activeSession) {
      this.activeSession.tasksCompleted++;
    }
  }

  /**
   * Record tokens used in active session
   */
  recordSessionTokens(tokens: number): void {
    if (this.activeSession) {
      this.activeSession.tokensUsed += tokens;
    }
  }

  /**
   * Get efficiency metrics for learning
   */
  getEfficiencyMetrics(): {
    tasksPerApiDollar: number;
    tasksPerSessionHour: number;
    avgTokensPerTask: number;
    preferredWorkType: 'api' | 'claude_max' | 'balanced';
  } {
    const apiCost = this.metrics.get('api_cost') || 0;
    const apiTasks = this.activities.filter(
      a => a.type === 'task_completed' && !this.isSessionTask(a)
    ).length;

    const sessionMinutes = this.metrics.get('claude_max_minutes') || 0;
    const sessionTasks = this.metrics.get('claude_max_tasks') || 0;

    const totalTokens = this.metrics.get('daily_tokens') || 0;
    const totalTasks = this.activities.filter(a => a.type === 'task_completed').length;

    // Calculate efficiency ratios
    const tasksPerApiDollar = apiCost > 0 ? apiTasks / apiCost : 0;
    const tasksPerSessionHour = sessionMinutes > 0 ? (sessionTasks / sessionMinutes) * 60 : 0;
    const avgTokensPerTask = totalTasks > 0 ? totalTokens / totalTasks : 0;

    // Determine preferred work type based on efficiency
    let preferredWorkType: 'api' | 'claude_max' | 'balanced' = 'balanced';
    if (tasksPerApiDollar > 0 && tasksPerSessionHour > 0) {
      // Compare cost-effectiveness
      // Assume Claude Max is ~$0.33/hr equivalent for comparison
      const apiEfficiency = tasksPerApiDollar;
      const sessionEfficiency = tasksPerSessionHour / 3; // tasks per $0.33

      if (apiEfficiency > sessionEfficiency * 1.5) {
        preferredWorkType = 'api';
      } else if (sessionEfficiency > apiEfficiency * 1.5) {
        preferredWorkType = 'claude_max';
      }
    } else if (tasksPerApiDollar > 0) {
      preferredWorkType = 'api';
    } else if (tasksPerSessionHour > 0) {
      preferredWorkType = 'claude_max';
    }

    return {
      tasksPerApiDollar,
      tasksPerSessionHour,
      avgTokensPerTask,
      preferredWorkType,
    };
  }

  /**
   * Check if an activity was completed during a Claude Max session
   */
  private isSessionTask(activity: ActivityEntry): boolean {
    const activityTime = new Date(activity.timestamp).getTime();
    return this.sessions.some(session => {
      const startTime = new Date(session.startedAt).getTime();
      const endTime = session.endedAt
        ? new Date(session.endedAt).getTime()
        : Date.now();
      return (
        session.type === 'claude_max' &&
        activityTime >= startTime &&
        activityTime <= endTime
      );
    });
  }

  /**
   * Update metrics based on activity
   */
  private updateMetrics(entry: ActivityEntry): void {
    // Update cost tracking
    if (entry.costEstimate) {
      const currentCost = this.metrics.get('daily_cost') || 0;
      this.metrics.set('daily_cost', currentCost + entry.costEstimate);
    }

    // Update token tracking
    if (entry.tokensUsed) {
      const currentTokens = this.metrics.get('daily_tokens') || 0;
      this.metrics.set('daily_tokens', currentTokens + entry.tokensUsed);
    }

    // Update error count
    if (entry.outcome === 'failure') {
      const errorCount = this.metrics.get('error_count') || 0;
      this.metrics.set('error_count', errorCount + 1);
    }

    // Update activity counts by type
    const typeCount = this.metrics.get(`count_${entry.type}`) || 0;
    this.metrics.set(`count_${entry.type}`, typeCount + 1);
  }

  /**
   * Check all thresholds and trigger alerts
   */
  async checkThresholds(): Promise<ThresholdConfig[]> {
    const triggered: ThresholdConfig[] = [];

    for (const threshold of this.thresholds) {
      if (!threshold.enabled) continue;

      // Check cooldown
      if (threshold.lastTriggered) {
        const cooldownMs = threshold.cooldownMinutes * 60 * 1000;
        const timeSince = Date.now() - new Date(threshold.lastTriggered).getTime();
        if (timeSince < cooldownMs) continue;
      }

      // Check condition
      const metricValue = this.metrics.get(threshold.condition.metric) || 0;
      let shouldTrigger = false;

      switch (threshold.condition.operator) {
        case 'gt':
          shouldTrigger = metricValue > threshold.condition.value;
          break;
        case 'gte':
          shouldTrigger = metricValue >= threshold.condition.value;
          break;
        case 'lt':
          shouldTrigger = metricValue < threshold.condition.value;
          break;
        case 'lte':
          shouldTrigger = metricValue <= threshold.condition.value;
          break;
        case 'eq':
          shouldTrigger = metricValue === threshold.condition.value;
          break;
      }

      if (shouldTrigger) {
        threshold.lastTriggered = new Date().toISOString();
        triggered.push(threshold);

        // Log the threshold alert
        await this.logActivity(
          'threshold_alert',
          `Threshold: ${threshold.name}`,
          `${threshold.description}. Current value: ${metricValue}`,
          {
            details: { threshold, metricValue },
            outcome: 'success',
          }
        );
      }
    }

    return triggered;
  }

  /**
   * Save activities to disk
   */
  private async saveActivities(): Promise<void> {
    const filepath = path.join(AUDIT_DIR, `${this.todayDate}.json`);
    const audit = await this.generateAudit();
    await fs.writeFile(filepath, JSON.stringify(audit, null, 2));
  }

  /**
   * Generate the daily audit report
   */
  async generateAudit(): Promise<DailyAudit> {
    // Get previous audit hash for chain
    const previousHash = await this.getPreviousHash();

    // Calculate session stats
    const claudeMaxSessions = this.sessions.filter(s => s.type === 'claude_max').length;
    const claudeMaxMinutes = this.sessions
      .filter(s => s.type === 'claude_max')
      .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    const claudeMaxTasksCompleted = this.sessions
      .filter(s => s.type === 'claude_max')
      .reduce((sum, s) => sum + s.tasksCompleted, 0);

    // Calculate summary
    const summary = {
      totalActivities: this.activities.length,
      successful: this.activities.filter(a => a.outcome === 'success').length,
      failed: this.activities.filter(a => a.outcome === 'failure').length,
      notificationsSent: this.activities.filter(a => a.type === 'notification_sent').length,
      notificationsBatched: this.activities.filter(a => a.type === 'notification_batched').length,
      tasksCompleted: this.activities.filter(a => a.type === 'task_completed').length,
      insightsGenerated: this.activities.filter(a => a.type === 'insight_generated').length,
      estimatedCost: this.metrics.get('daily_cost') || 0,
      tokensUsed: this.metrics.get('daily_tokens') || 0,
      // Session tracking
      apiCalls: this.metrics.get('api_calls') || 0,
      apiTokensUsed: this.metrics.get('api_tokens') || 0,
      apiCost: this.metrics.get('api_cost') || 0,
      claudeMaxSessions,
      claudeMaxMinutes,
      claudeMaxTasksCompleted,
    };

    // Generate highlights
    const highlights = this.generateHighlights();

    // Identify issues
    const issues = this.identifyIssues();

    // Generate recommendations
    const recommendations = this.generateRecommendations();

    // Get efficiency metrics
    const efficiency = this.getEfficiencyMetrics();

    // Create audit object (without hash)
    const auditData = {
      date: this.todayDate,
      generatedAt: new Date().toISOString(),
      previousHash,
      summary,
      activities: this.activities,
      sessions: this.sessions,
      highlights,
      issues,
      recommendations,
      efficiency,
    };

    // Calculate hash
    const hash = createHash('sha256')
      .update(JSON.stringify(auditData))
      .digest('hex');

    return {
      ...auditData,
      hash,
    };
  }

  /**
   * Get previous day's audit hash
   */
  private async getPreviousHash(): Promise<string> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    try {
      const filepath = path.join(AUDIT_DIR, `${yesterdayStr}.json`);
      const data = await fs.readFile(filepath, 'utf-8');
      const audit = JSON.parse(data) as DailyAudit;
      return audit.hash;
    } catch {
      return '0'.repeat(64); // Genesis hash
    }
  }

  /**
   * Generate highlights from activities
   */
  private generateHighlights(): string[] {
    const highlights: string[] = [];

    const completed = this.activities.filter(a => a.type === 'task_completed');
    if (completed.length > 0) {
      highlights.push(`Completed ${completed.length} task${completed.length > 1 ? 's' : ''}`);
    }

    const insights = this.activities.filter(a => a.type === 'insight_generated');
    if (insights.length > 0) {
      highlights.push(`Generated ${insights.length} insight${insights.length > 1 ? 's' : ''}`);
    }

    const cost = this.metrics.get('api_cost') || 0;
    if (cost > 0) {
      highlights.push(`API cost: $${cost.toFixed(2)}`);
    }

    // Session highlights
    const sessionMinutes = this.metrics.get('claude_max_minutes') || 0;
    const sessionTasks = this.metrics.get('claude_max_tasks') || 0;
    if (sessionMinutes > 0) {
      const hours = (sessionMinutes / 60).toFixed(1);
      highlights.push(`Claude Max: ${hours}hr, ${sessionTasks} tasks`);
    }

    // Efficiency learning
    const efficiency = this.getEfficiencyMetrics();
    if (efficiency.avgTokensPerTask > 0) {
      highlights.push(`Avg ${Math.round(efficiency.avgTokensPerTask)} tokens/task`);
    }

    return highlights;
  }

  /**
   * Identify issues from activities
   */
  private identifyIssues(): string[] {
    const issues: string[] = [];

    const failures = this.activities.filter(a => a.outcome === 'failure');
    if (failures.length > 0) {
      issues.push(`${failures.length} failed operation${failures.length > 1 ? 's' : ''}`);
    }

    const errors = this.activities.filter(a => a.type === 'error_occurred');
    if (errors.length >= 3) {
      issues.push(`High error rate: ${errors.length} errors today`);
    }

    return issues;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    const cost = this.metrics.get('api_cost') || 0;
    if (cost > 7) {
      recommendations.push('Consider batching more tasks to reduce API calls');
    }

    const failures = this.activities.filter(a => a.outcome === 'failure').length;
    if (failures > 2) {
      recommendations.push('Review failed tasks for patterns');
    }

    // Efficiency-based recommendations
    const efficiency = this.getEfficiencyMetrics();

    if (efficiency.preferredWorkType === 'api' && efficiency.tasksPerApiDollar > 0) {
      recommendations.push('API calls are efficient for current workload - continue this pattern');
    } else if (efficiency.preferredWorkType === 'claude_max' && efficiency.tasksPerSessionHour > 0) {
      recommendations.push('Claude Max sessions are efficient for complex tasks - use for heavy work');
    }

    if (efficiency.avgTokensPerTask > 5000) {
      recommendations.push('High token usage per task - consider breaking tasks into smaller chunks');
    }

    // Session-specific recommendations
    const sessionMinutes = this.metrics.get('claude_max_minutes') || 0;
    const sessionTasks = this.metrics.get('claude_max_tasks') || 0;
    if (sessionMinutes > 60 && sessionTasks === 0) {
      recommendations.push('Long session with no completed tasks - review session focus');
    }

    return recommendations;
  }

  /**
   * Get today's audit (for dashboard)
   */
  async getTodayAudit(): Promise<DailyAudit> {
    return this.generateAudit();
  }

  /**
   * Get audit for specific date
   */
  async getAudit(date: string): Promise<DailyAudit | null> {
    try {
      const filepath = path.join(AUDIT_DIR, `${date}.json`);
      const data = await fs.readFile(filepath, 'utf-8');
      return JSON.parse(data) as DailyAudit;
    } catch {
      return null;
    }
  }

  /**
   * List all available audits
   */
  async listAudits(): Promise<string[]> {
    try {
      const files = await fs.readdir(AUDIT_DIR);
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''))
        .sort()
        .reverse();
    } catch {
      return [];
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  /**
   * Update threshold configuration
   */
  updateThreshold(id: string, updates: Partial<ThresholdConfig>): void {
    const threshold = this.thresholds.find(t => t.id === id);
    if (threshold) {
      Object.assign(threshold, updates);
    }
  }

  /**
   * Add custom threshold
   */
  addThreshold(threshold: ThresholdConfig): void {
    this.thresholds.push(threshold);
  }

  /**
   * Check if a session is currently active
   */
  hasActiveSession(): boolean {
    return this.activeSession !== null;
  }

  /**
   * Get the current active session
   */
  getActiveSession(): SessionEntry | null {
    return this.activeSession;
  }

  /**
   * Get all sessions for today
   */
  getSessions(): SessionEntry[] {
    return [...this.sessions];
  }

  /**
   * Get historical efficiency data for learning
   */
  async getHistoricalEfficiency(days: number = 7): Promise<{
    avgTasksPerApiDollar: number;
    avgTasksPerSessionHour: number;
    trend: 'improving' | 'declining' | 'stable';
    totalApiCost: number;
    totalSessionMinutes: number;
  }> {
    const audits: DailyAudit[] = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const audit = await this.getAudit(dateStr);
      if (audit) {
        audits.push(audit);
      }
    }

    if (audits.length === 0) {
      return {
        avgTasksPerApiDollar: 0,
        avgTasksPerSessionHour: 0,
        trend: 'stable',
        totalApiCost: 0,
        totalSessionMinutes: 0,
      };
    }

    const totalApiCost = audits.reduce((sum, a) => sum + a.summary.apiCost, 0);
    const totalSessionMinutes = audits.reduce((sum, a) => sum + a.summary.claudeMaxMinutes, 0);
    const totalTasks = audits.reduce((sum, a) => sum + a.summary.tasksCompleted, 0);

    const avgTasksPerApiDollar = totalApiCost > 0 ? totalTasks / totalApiCost : 0;
    const avgTasksPerSessionHour = totalSessionMinutes > 0 ? (totalTasks / totalSessionMinutes) * 60 : 0;

    // Determine trend (compare first half vs second half)
    const midpoint = Math.floor(audits.length / 2);
    const recentEfficiency = audits.slice(0, midpoint).reduce((sum, a) =>
      sum + (a.efficiency?.tasksPerApiDollar || 0), 0) / Math.max(midpoint, 1);
    const olderEfficiency = audits.slice(midpoint).reduce((sum, a) =>
      sum + (a.efficiency?.tasksPerApiDollar || 0), 0) / Math.max(audits.length - midpoint, 1);

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recentEfficiency > olderEfficiency * 1.1) {
      trend = 'improving';
    } else if (recentEfficiency < olderEfficiency * 0.9) {
      trend = 'declining';
    }

    return {
      avgTasksPerApiDollar,
      avgTasksPerSessionHour,
      trend,
      totalApiCost,
      totalSessionMinutes,
    };
  }
}

// Singleton instance
export const dailyAudit = new DailyAuditSystem();
