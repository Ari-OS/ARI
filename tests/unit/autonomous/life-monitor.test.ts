import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LifeMonitor } from '../../../src/autonomous/life-monitor.js';
import { EventBus } from '../../../src/kernel/event-bus.js';

// Mock fs for state persistence
vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn().mockRejectedValue(new Error('ENOENT')),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
  },
}));

// Mock child_process
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn().mockReturnValue(''),
}));

// Mock fetch for API credit checks
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('LifeMonitor', () => {
  let monitor: LifeMonitor;
  let eventBus: EventBus;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ status: 200, text: () => Promise.resolve('') });

    eventBus = new EventBus();
    monitor = new LifeMonitor(eventBus);
    await monitor.init();
  });

  it('should initialize with default subscriptions', () => {
    const subs = monitor.getSubscriptions();
    expect(subs.length).toBeGreaterThan(0);
    expect(subs.some((s) => s.name === 'Claude Max 20x')).toBe(true);
  });

  it('should return a report from scan', async () => {
    const report = await monitor.scan();
    expect(report).toHaveProperty('generatedAt');
    expect(report).toHaveProperty('alerts');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('telegramHtml');
    expect(typeof report.criticalCount).toBe('number');
    expect(typeof report.urgentCount).toBe('number');
  });

  it('should detect missing ANTHROPIC_API_KEY', async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const report = await monitor.scan();
    const apiAlert = report.alerts.find((a) => a.id === 'api_anthropic_missing');
    expect(apiAlert).toBeDefined();
    expect(apiAlert?.severity).toBe('urgent');

    if (original) process.env.ANTHROPIC_API_KEY = original;
  });

  it('should detect invalid Anthropic API key', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-invalid';
    mockFetch.mockResolvedValueOnce({ status: 401, text: () => Promise.resolve('unauthorized') });

    const report = await monitor.scan();
    const apiAlert = report.alerts.find((a) => a.id === 'api_anthropic_invalid');
    expect(apiAlert).toBeDefined();
    expect(apiAlert?.severity).toBe('critical');
  });

  it('should manage subscriptions', async () => {
    const initialCount = monitor.getSubscriptions().length;

    await monitor.addSubscription({
      name: 'Test Service',
      cost: 10,
      renewalDay: 15,
      active: true,
    });

    expect(monitor.getSubscriptions().length).toBe(initialCount + 1);

    const removed = await monitor.removeSubscription('Test Service');
    expect(removed).toBe(true);
    expect(monitor.getSubscriptions().length).toBe(initialCount);
  });

  it('should suppress alerts', async () => {
    monitor.suppressAlert('test_alert_id');
    const status = monitor.getStatus();
    expect(status.suppressedCount).toBe(1);

    monitor.unsuppressAlert('test_alert_id');
    const status2 = monitor.getStatus();
    expect(status2.suppressedCount).toBe(0);
  });

  it('should format Telegram HTML correctly', () => {
    const html = monitor.formatTelegramHtml([]);
    expect(html).toContain('All clear');

    const htmlWithAlerts = monitor.formatTelegramHtml([
      {
        id: 'test',
        category: 'api_credits',
        severity: 'critical',
        title: 'Test Alert',
        description: 'Test description',
        actionRequired: 'Do something',
        createdAt: new Date().toISOString(),
      },
    ]);
    expect(htmlWithAlerts).toContain('CRITICAL');
    expect(htmlWithAlerts).toContain('Test Alert');
  });

  it('should sort alerts by severity', async () => {
    // This tests the sorting logic indirectly through scan
    const report = await monitor.scan();
    // All alerts should be sorted: critical → urgent → warning → info
    const severityOrder = { critical: 0, urgent: 1, warning: 2, info: 3 };
    for (let i = 1; i < report.alerts.length; i++) {
      expect(severityOrder[report.alerts[i].severity]).toBeGreaterThanOrEqual(
        severityOrder[report.alerts[i - 1].severity]
      );
    }
  });

  it('should emit life_monitor:scan_complete event', async () => {
    const events: unknown[] = [];
    eventBus.on('life_monitor:scan_complete', (payload) => {
      events.push(payload);
    });

    await monitor.scan();
    expect(events.length).toBe(1);
  });

  it('should provide status', () => {
    const status = monitor.getStatus();
    expect(status).toHaveProperty('lastRun');
    expect(status).toHaveProperty('alertCount');
    expect(status).toHaveProperty('subscriptionCount');
    expect(status).toHaveProperty('suppressedCount');
  });
});
