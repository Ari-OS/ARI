import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationRouter } from '../../../src/autonomous/notification-router.js';
import { EventBus } from '../../../src/kernel/event-bus.js';

// Mock notification-manager
vi.mock('../../../src/autonomous/notification-manager.js', () => ({
  notificationManager: {
    budgetWarning: vi.fn().mockResolvedValue(undefined),
    budgetCritical: vi.fn().mockResolvedValue(undefined),
    notify: vi.fn().mockResolvedValue(undefined),
    security: vi.fn().mockResolvedValue(undefined),
    opportunity: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    finance: vi.fn().mockResolvedValue(undefined),
  },
}));

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
const { notificationManager } = await import('../../../src/autonomous/notification-manager.js') as {
  notificationManager: {
    budgetWarning: ReturnType<typeof vi.fn>;
    budgetCritical: ReturnType<typeof vi.fn>;
    notify: ReturnType<typeof vi.fn>;
    security: ReturnType<typeof vi.fn>;
    opportunity: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    finance: ReturnType<typeof vi.fn>;
  };
};

describe('NotificationRouter', () => {
  let router: NotificationRouter;
  let eventBus: EventBus;

  beforeEach(() => {
    vi.clearAllMocks();
    eventBus = new EventBus();
    router = new NotificationRouter(eventBus);
    router.init();
  });

  it('should initialize with event subscriptions', () => {
    const status = router.getStatus();
    expect(status.initialized).toBe(true);
    expect(status.subscriptionCount).toBeGreaterThan(0);
  });

  it('should not double-initialize', () => {
    const count1 = router.getStatus().subscriptionCount;
    router.init();
    const count2 = router.getStatus().subscriptionCount;
    expect(count1).toBe(count2);
  });

  it('should route budget:warning to budgetWarning', () => {
    eventBus.emit('budget:warning', { spent: 75, remaining: 25 });
    expect(notificationManager.budgetWarning).toHaveBeenCalledWith(
      75,
      25,
      expect.stringContaining('25.00 remaining'),
    );
  });

  it('should route budget:critical to budgetCritical', () => {
    eventBus.emit('budget:critical', { spent: 95, remaining: 5 });
    expect(notificationManager.budgetCritical).toHaveBeenCalledWith(95);
  });

  it('should route budget:pause to budgetCritical', () => {
    eventBus.emit('budget:pause', { spent: 98, budget: 100, percentUsed: 98 });
    expect(notificationManager.budgetCritical).toHaveBeenCalledWith(98);
  });

  it('should route budget:projection_exceeded to notify', () => {
    eventBus.emit('budget:projection_exceeded', {
      projected: 150,
      budget: 100,
      burnRate: 0.05,
      hoursRemaining: 10,
      percentOver: 50,
    });
    expect(notificationManager.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'budget',
        title: 'Budget Projection Exceeded',
        priority: 'high',
      }),
    );
  });

  it('should route security:alert to security', () => {
    eventBus.emit('security:alert', {
      type: 'injection_attempt',
      source: 'gateway',
      data: { pattern: 'sql' },
    });
    expect(notificationManager.security).toHaveBeenCalledWith(
      'Security Alert: injection_attempt',
      expect.stringContaining('gateway'),
    );
  });

  it('should route investment:opportunity_detected to opportunity', () => {
    eventBus.emit('investment:opportunity_detected', {
      category: 'crypto_investment',
      title: 'BTC breakout pattern',
      score: 85,
    });
    expect(notificationManager.opportunity).toHaveBeenCalledWith(
      'crypto_investment: BTC breakout pattern',
      'Score: 85/100',
      'high',
    );
  });

  it('should route ops:backup_failed to error', () => {
    eventBus.emit('ops:backup_failed', {
      type: 'daily',
      error: 'Disk full',
    });
    expect(notificationManager.error).toHaveBeenCalledWith(
      'Backup Failed',
      expect.stringContaining('Disk full'),
    );
  });

  it('should route career:new_matches to opportunity', () => {
    eventBus.emit('career:new_matches', {
      count: 3,
      topMatch: 'Senior TypeScript Developer at Anthropic',
    });
    expect(notificationManager.opportunity).toHaveBeenCalledWith(
      '3 Career Matches Found',
      expect.stringContaining('Anthropic'),
      'medium',
    );
  });

  it('should not notify for zero career matches', () => {
    eventBus.emit('career:new_matches', {
      count: 0,
      topMatch: '',
    });
    expect(notificationManager.opportunity).not.toHaveBeenCalled();
  });

  it('should clean up on destroy', () => {
    router.destroy();
    const status = router.getStatus();
    expect(status.initialized).toBe(false);
    expect(status.subscriptionCount).toBe(0);

    // Events should no longer route
    eventBus.emit('budget:critical', { spent: 95, remaining: 5 });
    expect(notificationManager.budgetCritical).not.toHaveBeenCalled();
  });
});
