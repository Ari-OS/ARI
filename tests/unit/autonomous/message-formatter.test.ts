import { describe, it, expect } from 'vitest';
import {
  formatTaskComplete,
  formatThresholdAlert,
  formatDailyAudit,
  formatMorningBriefing,
  formatOpportunity,
  formatError,
  formatInsight,
  formatQuestion,
  formatBatchedSummary,
  formatStatus,
  formatCostAlert,
  formatter,
} from '../../../src/autonomous/message-formatter.js';

describe('Message Formatter', () => {
  describe('formatTaskComplete', () => {
    it('should format successful task completion', () => {
      const result = formatTaskComplete('Build feature', true, 'Feature deployed successfully');

      expect(result.title).toBe('✓ Done');
      expect(result.message).toContain('Build feature');
      expect(result.message).toContain('Feature deployed successfully');
    });

    it('should format failed task completion', () => {
      const result = formatTaskComplete('Deploy app', false, 'Connection timeout');

      expect(result.title).toBe('✗ Failed');
      expect(result.message).toContain('Deploy app');
      expect(result.message).toContain('Connection timeout');
    });
  });

  describe('formatThresholdAlert', () => {
    it('should format critical alert', () => {
      const result = formatThresholdAlert('CPU Usage', 95, 80, 'critical');

      expect(result.title).toContain('CPU Usage');
      expect(result.title).toContain('🔴'); // critical icon
      expect(result.message).toContain('Current:');
      expect(result.message).toContain('Threshold:');
    });

    it('should format warning alert', () => {
      const result = formatThresholdAlert('Memory', 70, 80, 'warning');

      expect(result.title).toContain('⚠'); // warning icon
    });

    it('should format info alert', () => {
      const result = formatThresholdAlert('Disk Space', 50, 80, 'info');

      expect(result.title).toContain('ℹ'); // info icon
    });

    it('should format large values with K/M suffix', () => {
      const result = formatThresholdAlert('Users', 1500000, 2000000, 'info');

      expect(result.message).toContain('1.5M');
      expect(result.message).toContain('2.0M');
    });

    it('should format thousands with K suffix', () => {
      const result = formatThresholdAlert('Requests', 5000, 10000, 'info');

      expect(result.message).toContain('5.0K');
      expect(result.message).toContain('10.0K');
    });
  });

  describe('formatDailyAudit', () => {
    it('should format complete daily audit', () => {
      const result = formatDailyAudit({
        date: '2025-01-30',
        tasksCompleted: 15,
        tasksFailed: 2,
        notificationsSent: 10,
        insightsGenerated: 3,
        estimatedCost: 1.50,
        highlights: ['Shipped new feature', 'Fixed critical bug'],
        issues: ['API rate limit hit'],
      });

      expect(result.title).toBe('▫ Daily Report');
      expect(result.message).toContain('✓ 15 done');
      expect(result.message).toContain('✗ 2 failed');
      expect(result.message).toContain('$1.50');
      expect(result.message).toContain('Highlights:');
      expect(result.message).toContain('Shipped new feature');
      expect(result.message).toContain('Issues:');
      expect(result.message).toContain('API rate limit hit');
    });

    it('should handle empty highlights and issues', () => {
      const result = formatDailyAudit({
        date: '2025-01-30',
        tasksCompleted: 5,
        tasksFailed: 0,
        notificationsSent: 3,
        insightsGenerated: 1,
        estimatedCost: 0.25,
        highlights: [],
        issues: [],
      });

      expect(result.title).toBe('▫ Daily Report');
      expect(result.message).not.toContain('Highlights:');
      expect(result.message).not.toContain('Issues:');
    });

    it('should limit highlights to 3', () => {
      const result = formatDailyAudit({
        date: '2025-01-30',
        tasksCompleted: 10,
        tasksFailed: 0,
        notificationsSent: 5,
        insightsGenerated: 2,
        estimatedCost: 0.50,
        highlights: ['One', 'Two', 'Three', 'Four', 'Five'],
        issues: [],
      });

      expect(result.message).toContain('One');
      expect(result.message).toContain('Two');
      expect(result.message).toContain('Three');
      expect(result.message).not.toContain('Four');
      expect(result.message).not.toContain('Five');
    });
  });

  describe('formatMorningBriefing', () => {
    it('should format complete morning briefing', () => {
      const result = formatMorningBriefing({
        greeting: 'Good morning, Ari!',
        priorities: ['Finish PR review', 'Deploy to staging'],
        schedule: [
          { time: '10:00', title: 'Team standup' },
          { time: '14:00', title: 'Client call' },
        ],
        pendingTasks: 7,
        budgetRemaining: 45.50,
      });

      expect(result.title).toBe('◉ Good Morning');
      expect(result.message).toContain('Good morning, Ari!');
      expect(result.message).toContain('Today:');
      expect(result.message).toContain('Finish PR review');
      expect(result.message).toContain('Schedule:');
      expect(result.message).toContain('10:00 Team standup');
      expect(result.message).toContain('7 tasks pending');
      expect(result.message).toContain('$45.50 left');
    });

    it('should handle empty priorities and schedule', () => {
      const result = formatMorningBriefing({
        greeting: 'Hello!',
        priorities: [],
        schedule: [],
        pendingTasks: 0,
        budgetRemaining: 100.00,
      });

      expect(result.message).toContain('Hello!');
      expect(result.message).not.toContain('Today:');
      expect(result.message).not.toContain('Schedule:');
    });
  });

  describe('formatOpportunity', () => {
    it('should format high urgency opportunity', () => {
      const result = formatOpportunity('Stock alert', 'AAPL dropped 5%', 'high');

      expect(result.title).toContain('◇ Opportunity');
      expect(result.title).toContain('▲▲▲');
      expect(result.message).toContain('Stock alert');
      expect(result.message).toContain('AAPL dropped 5%');
    });

    it('should format medium urgency opportunity', () => {
      const result = formatOpportunity('Sale', 'Flash sale ending soon', 'medium');

      expect(result.title).toContain('▲▲');
      expect(result.title).not.toContain('▲▲▲');
    });

    it('should format low urgency opportunity', () => {
      const result = formatOpportunity('FYI', 'New feature available', 'low');

      expect(result.title).toMatch(/▲(?!▲)/); // Single ▲ not followed by another
    });
  });

  describe('formatError', () => {
    it('should format recoverable error', () => {
      const result = formatError('API Error', 'Rate limit exceeded', true);

      expect(result.title).toContain('✗');
      expect(result.title).toContain('API Error');
      expect(result.message).toContain('Rate limit exceeded');
      expect(result.message).toContain('ARI will retry');
    });

    it('should format non-recoverable error', () => {
      const result = formatError('Auth Error', 'Invalid credentials', false);

      expect(result.message).toContain('Needs attention');
      expect(result.message).not.toContain('will retry');
    });
  });

  describe('formatInsight', () => {
    it('should format actionable insight', () => {
      const result = formatInsight('finance', 'You spent 20% more this week', true);

      expect(result.title).toBe('💡 Finance Insight');
      expect(result.message).toContain('You spent 20% more');
      expect(result.message).toContain('→ Action available');
    });

    it('should format non-actionable insight', () => {
      const result = formatInsight('health', 'Sleep quality improved', false);

      expect(result.title).toBe('💡 Health Insight');
      expect(result.message).not.toContain('Action available');
    });

    it('should capitalize domain', () => {
      const result = formatInsight('SECURITY', 'No issues detected', false);

      expect(result.title).toBe('💡 Security Insight');
    });
  });

  describe('formatQuestion', () => {
    it('should format question with options', () => {
      const result = formatQuestion('Which task first?', ['Deploy', 'Review', 'Document']);

      expect(result.title).toBe('❓ Input Needed');
      expect(result.message).toContain('Which task first?');
      expect(result.message).toContain('Options:');
      expect(result.message).toContain('1. Deploy');
      expect(result.message).toContain('2. Review');
      expect(result.message).toContain('3. Document');
    });

    it('should format question without options', () => {
      const result = formatQuestion('What should I prioritize?');

      expect(result.message).toBe('What should I prioritize?');
      expect(result.message).not.toContain('Options:');
    });

    it('should handle empty options array', () => {
      const result = formatQuestion('Any thoughts?', []);

      expect(result.message).not.toContain('Options:');
    });
  });

  describe('formatBatchedSummary', () => {
    it('should format batched updates grouped by type', () => {
      const result = formatBatchedSummary([
        { type: 'task', title: 'Task 1 completed' },
        { type: 'task', title: 'Task 2 completed' },
        { type: 'finance', title: 'Payment received' },
      ]);

      expect(result.title).toBe('▫ Batch Update');
      expect(result.message).toContain('3 updates');
      expect(result.message).toContain('Task (2)');
      expect(result.message).toContain('Finance (1)');
    });

    it('should truncate long titles', () => {
      const longTitle = 'This is a very long title that should be truncated to fit nicely';
      const result = formatBatchedSummary([
        { type: 'task', title: longTitle },
      ]);

      expect(result.message.length).toBeLessThan(longTitle.length + 100);
    });

    it('should show +more for many items of same type', () => {
      const result = formatBatchedSummary([
        { type: 'task', title: 'Task 1' },
        { type: 'task', title: 'Task 2' },
        { type: 'task', title: 'Task 3' },
        { type: 'task', title: 'Task 4' },
      ]);

      expect(result.message).toContain('+2 more');
    });
  });

  describe('formatStatus', () => {
    it('should format online status', () => {
      const result = formatStatus('online', 'All systems operational');

      expect(result.title).toBe('✓ ARI Online');
      expect(result.message).toBe('All systems operational');
    });

    it('should format offline status', () => {
      const result = formatStatus('offline');

      expect(result.title).toBe('○ ARI Offline');
      expect(result.message).toBe('System is offline.');
    });

    it('should format error status', () => {
      const result = formatStatus('error', 'Database connection lost');

      expect(result.title).toBe('✗ ARI Error');
      expect(result.message).toBe('Database connection lost');
    });
  });

  describe('formatCostAlert', () => {
    it('should format cost alert with progress bar', () => {
      const result = formatCostAlert(50, 100, 15);

      expect(result.title).toBe('💰 Budget Update');
      expect(result.message).toContain('50%');
      expect(result.message).toContain('$50.00 / $100.00');
      expect(result.message).toContain('15 days remaining');
      expect(result.message).toContain('▓'); // filled portion
      expect(result.message).toContain('░'); // empty portion
    });

    it('should show full progress bar at 100%', () => {
      const result = formatCostAlert(100, 100, 0);

      expect(result.message).toContain('100%');
      expect(result.message).toContain('▓▓▓▓▓▓▓▓▓▓');
    });

    it('should show empty progress bar at 0%', () => {
      const result = formatCostAlert(0, 100, 30);

      expect(result.message).toContain('0%');
      expect(result.message).toContain('░░░░░░░░░░');
    });
  });

  describe('formatter object export', () => {
    it('should export all formatter functions', () => {
      expect(formatter.taskComplete).toBe(formatTaskComplete);
      expect(formatter.threshold).toBe(formatThresholdAlert);
      expect(formatter.dailyAudit).toBe(formatDailyAudit);
      expect(formatter.morning).toBe(formatMorningBriefing);
      expect(formatter.opportunity).toBe(formatOpportunity);
      expect(formatter.error).toBe(formatError);
      expect(formatter.insight).toBe(formatInsight);
      expect(formatter.question).toBe(formatQuestion);
      expect(formatter.batched).toBe(formatBatchedSummary);
      expect(formatter.status).toBe(formatStatus);
      expect(formatter.cost).toBe(formatCostAlert);
    });
  });
});
