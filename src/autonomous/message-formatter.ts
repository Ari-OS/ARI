/**
 * ARI Message Formatter
 *
 * Creates beautiful, easy-to-read notifications.
 * Designed for quick scanning on mobile.
 */

// Status indicators
const STATUS = {
  success: '✓',
  failure: '✗',
  warning: '⚠',
  info: 'ℹ',
  pending: '○',
  working: '◉',
  money: '◈',
  alert: '◆',
  insight: '◇',
  question: '?',
} as const;

// Category icons
const ICONS = {
  task: '▸',
  finance: '◈',
  security: '◆',
  learning: '◇',
  social: '▹',
  system: '▪',
  daily: '▫',
} as const;

/**
 * Format a task completion notification
 */
export function formatTaskComplete(
  taskTitle: string,
  success: boolean,
  summary: string
): { title: string; message: string } {
  const status = success ? STATUS.success : STATUS.failure;
  const word = success ? 'Done' : 'Failed';

  return {
    title: `${status} ${word}`,
    message: `${taskTitle}\n\n${summary}`,
  };
}

/**
 * Format a threshold alert
 */
export function formatThresholdAlert(
  name: string,
  currentValue: number,
  threshold: number,
  severity: 'info' | 'warning' | 'critical'
): { title: string; message: string } {
  const icon = severity === 'critical' ? STATUS.alert :
               severity === 'warning' ? STATUS.warning : STATUS.info;

  return {
    title: `${icon} ${name}`,
    message: `Current: ${formatValue(currentValue)}\nThreshold: ${formatValue(threshold)}`,
  };
}

/**
 * Format daily audit summary
 */
export function formatDailyAudit(audit: {
  date: string;
  tasksCompleted: number;
  tasksFailed: number;
  notificationsSent: number;
  insightsGenerated: number;
  estimatedCost: number;
  highlights: string[];
  issues: string[];
}): { title: string; message: string } {
  const lines: string[] = [];

  // Stats line
  lines.push(`${STATUS.success} ${audit.tasksCompleted} done  ${STATUS.failure} ${audit.tasksFailed} failed  ${STATUS.money} $${audit.estimatedCost.toFixed(2)}`);

  // Highlights
  if (audit.highlights.length > 0) {
    lines.push('');
    lines.push('Highlights:');
    audit.highlights.slice(0, 3).forEach(h => {
      lines.push(`${ICONS.task} ${h}`);
    });
  }

  // Issues
  if (audit.issues.length > 0) {
    lines.push('');
    lines.push('Issues:');
    audit.issues.slice(0, 2).forEach(i => {
      lines.push(`${STATUS.warning} ${i}`);
    });
  }

  return {
    title: `▫ Daily Report`,
    message: lines.join('\n'),
  };
}

/**
 * Format morning briefing
 */
export function formatMorningBriefing(briefing: {
  greeting: string;
  priorities: string[];
  schedule: { time: string; title: string }[];
  pendingTasks: number;
  budgetRemaining: number;
}): { title: string; message: string } {
  const lines: string[] = [];

  lines.push(briefing.greeting);
  lines.push('');

  // Priorities
  if (briefing.priorities.length > 0) {
    lines.push('Today:');
    briefing.priorities.slice(0, 3).forEach(p => {
      lines.push(`${ICONS.task} ${p}`);
    });
  }

  // Schedule
  if (briefing.schedule.length > 0) {
    lines.push('');
    lines.push('Schedule:');
    briefing.schedule.slice(0, 3).forEach(s => {
      lines.push(`${s.time} ${s.title}`);
    });
  }

  // Status line
  lines.push('');
  lines.push(`${briefing.pendingTasks} tasks pending  ${STATUS.money} $${briefing.budgetRemaining.toFixed(2)} left`);

  return {
    title: '◉ Good Morning',
    message: lines.join('\n'),
  };
}

/**
 * Format opportunity alert
 */
export function formatOpportunity(
  title: string,
  description: string,
  urgency: 'low' | 'medium' | 'high'
): { title: string; message: string } {
  const urgencyIndicator = urgency === 'high' ? '▲▲▲' :
                           urgency === 'medium' ? '▲▲' : '▲';

  return {
    title: `◇ Opportunity ${urgencyIndicator}`,
    message: `${title}\n\n${description}`,
  };
}

/**
 * Format error alert
 */
export function formatError(
  errorType: string,
  message: string,
  recoverable: boolean
): { title: string; message: string } {
  return {
    title: `${STATUS.failure} ${errorType}`,
    message: `${message}${recoverable ? '\n\nARI will retry.' : '\n\nNeeds attention.'}`,
  };
}

/**
 * Format insight
 */
export function formatInsight(
  domain: string,
  insight: string,
  actionable: boolean
): { title: string; message: string } {
  return {
    title: `${STATUS.insight} ${capitalize(domain)} Insight`,
    message: actionable ? `${insight}\n\n→ Action available` : insight,
  };
}

/**
 * Format question for user
 */
export function formatQuestion(
  question: string,
  options?: string[]
): { title: string; message: string } {
  let message = question;

  if (options && options.length > 0) {
    message += '\n\nOptions:';
    options.forEach((opt, i) => {
      message += `\n${i + 1}. ${opt}`;
    });
  }

  return {
    title: `${STATUS.question} Input Needed`,
    message,
  };
}

/**
 * Format batched summary
 */
export function formatBatchedSummary(
  items: { type: string; title: string }[]
): { title: string; message: string } {
  const lines: string[] = [];

  lines.push(`${items.length} updates while you were away:`);
  lines.push('');

  // Group by type
  const grouped = new Map<string, string[]>();
  items.forEach(item => {
    const existing = grouped.get(item.type) || [];
    existing.push(item.title);
    grouped.set(item.type, existing);
  });

  grouped.forEach((titles, type) => {
    const icon = getIconForType(type);
    lines.push(`${icon} ${capitalize(type)} (${titles.length})`);
    titles.slice(0, 2).forEach(t => {
      lines.push(`  ${ICONS.task} ${truncate(t, 40)}`);
    });
    if (titles.length > 2) {
      lines.push(`  ... +${titles.length - 2} more`);
    }
  });

  return {
    title: '▫ Batch Update',
    message: lines.join('\n'),
  };
}

/**
 * Format status update
 */
export function formatStatus(
  status: 'online' | 'offline' | 'error',
  details?: string
): { title: string; message: string } {
  const statusInfo = {
    online: { icon: STATUS.success, word: 'Online' },
    offline: { icon: STATUS.pending, word: 'Offline' },
    error: { icon: STATUS.failure, word: 'Error' },
  };

  const { icon, word } = statusInfo[status];

  return {
    title: `${icon} ARI ${word}`,
    message: details || `System is ${status}.`,
  };
}

/**
 * Format cost alert
 */
export function formatCostAlert(
  spent: number,
  limit: number,
  daysRemaining: number
): { title: string; message: string } {
  const percent = Math.round((spent / limit) * 100);
  const bar = generateProgressBar(percent);

  return {
    title: `${STATUS.money} Budget Update`,
    message: `${bar} ${percent}%\n\n$${spent.toFixed(2)} / $${limit.toFixed(2)}\n${daysRemaining} days remaining`,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatValue(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  if (value < 1) return value.toFixed(2);
  return value.toFixed(0);
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

function getIconForType(type: string): string {
  const iconMap: Record<string, string> = {
    task: ICONS.task,
    finance: ICONS.finance,
    security: ICONS.security,
    learning: ICONS.learning,
    social: ICONS.social,
    completion: STATUS.success,
    error: STATUS.failure,
    insight: STATUS.insight,
  };
  return iconMap[type.toLowerCase()] || ICONS.system;
}

function generateProgressBar(percent: number): string {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  return '▓'.repeat(filled) + '░'.repeat(empty);
}

export const formatter = {
  taskComplete: formatTaskComplete,
  threshold: formatThresholdAlert,
  dailyAudit: formatDailyAudit,
  morning: formatMorningBriefing,
  opportunity: formatOpportunity,
  error: formatError,
  insight: formatInsight,
  question: formatQuestion,
  batched: formatBatchedSummary,
  status: formatStatus,
  cost: formatCostAlert,
};
