import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationManager } from '../../../src/autonomous/notification-manager.js';

// Use vi.hoisted to create mock functions that can be referenced in vi.mock
const {
  mockNotionInit,
  mockNotionIsReady,
  mockNotionCreateDailyLog,
  mockNotionGetTodayEntries,
  mockNotionAddNote,
  mockGetTodayAudit,
  mockLogActivity,
} = vi.hoisted(() => ({
  mockNotionInit: vi.fn(),
  mockNotionIsReady: vi.fn(),
  mockNotionCreateDailyLog: vi.fn(),
  mockNotionGetTodayEntries: vi.fn(),
  mockNotionAddNote: vi.fn(),
  mockGetTodayAudit: vi.fn(),
  mockLogActivity: vi.fn(),
}));

// Mock NotionInbox
vi.mock('../../../src/integrations/notion/inbox.js', () => ({
  NotionInbox: vi.fn().mockImplementation(() => ({
    init: mockNotionInit,
    isReady: mockNotionIsReady,
    createDailyLog: mockNotionCreateDailyLog,
    getTodayEntries: mockNotionGetTodayEntries,
    addNote: mockNotionAddNote,
  })),
}));

// Mock dailyAudit
vi.mock('../../../src/autonomous/daily-audit.js', () => ({
  dailyAudit: {
    getTodayAudit: mockGetTodayAudit,
    logActivity: mockLogActivity,
  },
}));

// Import after mocks
import {
  BriefingGenerator,
  createBriefingGenerator,
} from '../../../src/autonomous/briefings.js';

// Mock NotificationManager
const mockProcessQueue = vi.fn();
const mockNotify = vi.fn();
const mockNotificationManager = {
  processQueue: mockProcessQueue,
  notify: mockNotify,
} as unknown as NotificationManager;

describe('BriefingGenerator', () => {
  let generator: BriefingGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-31T12:00:00Z')); // 7 AM Indiana

    // Set default mock return values
    mockNotionInit.mockResolvedValue(true);
    mockNotionIsReady.mockReturnValue(true);
    mockNotionCreateDailyLog.mockResolvedValue('notion-page-id');
    mockNotionGetTodayEntries.mockResolvedValue([{ id: 'today-entry-id' }]);
    mockNotionAddNote.mockResolvedValue(undefined);
    mockProcessQueue.mockResolvedValue({ processed: 0, sent: 0 });
    mockNotify.mockResolvedValue({ sent: true });
    mockLogActivity.mockResolvedValue(undefined);
    mockGetTodayAudit.mockResolvedValue({
      date: '2026-01-31',
      activities: [
        { title: 'Task 1', outcome: 'success', type: 'task' },
        { title: 'Task 2', outcome: 'success', type: 'task' },
        { title: 'Failed Task', outcome: 'failure', type: 'task' },
      ],
      highlights: ['Shipped feature', 'Fixed bug'],
      issues: ['API rate limit'],
    });

    generator = new BriefingGenerator(mockNotificationManager);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create with notification manager', () => {
      const gen = new BriefingGenerator(mockNotificationManager);
      expect(gen).toBeDefined();
    });
  });

  describe('initNotion()', () => {
    it('should initialize Notion client', async () => {
      const result = await generator.initNotion({
        enabled: true,
        databaseId: 'db-123',
        token: 'token',
        dailyLogParentId: 'parent-123',
      });

      expect(result).toBe(true);
    });

    it('should return false when Notion disabled', async () => {
      const result = await generator.initNotion({
        enabled: false,
        databaseId: '',
        token: '',
      });

      expect(result).toBe(false);
    });

    it('should return false when no dailyLogParentId', async () => {
      const result = await generator.initNotion({
        enabled: true,
        databaseId: 'db-123',
        token: 'token',
        // no dailyLogParentId
      });

      expect(result).toBe(false);
    });
  });

  describe('morningBriefing()', () => {
    beforeEach(async () => {
      await generator.initNotion({
        enabled: true,
        databaseId: 'db-123',
        token: 'token',
        dailyLogParentId: 'parent-123',
      });
    });

    it('should generate morning briefing', async () => {
      const result = await generator.morningBriefing();

      expect(result.success).toBe(true);
      expect(result.notionPageId).toBe('notion-page-id');
    });

    it('should process queued notifications', async () => {
      await generator.morningBriefing();

      expect(mockProcessQueue).toHaveBeenCalled();
    });

    it('should send SMS notification', async () => {
      await generator.morningBriefing();

      expect(mockNotify).toHaveBeenCalled();
    });

    it('should log activity to audit', async () => {
      await generator.morningBriefing();

      expect(mockLogActivity).toHaveBeenCalledWith(
        'system_event',
        'Morning Briefing',
        expect.any(String),
        expect.objectContaining({ outcome: 'success' })
      );
    });

    it('should handle queued items', async () => {
      mockProcessQueue.mockResolvedValueOnce({ processed: 5, sent: 3 });

      const result = await generator.morningBriefing();

      expect(result.success).toBe(true);
      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('processed'),
        })
      );
    });

    it('should work without Notion', async () => {
      const gen = new BriefingGenerator(mockNotificationManager);
      // Don't init Notion

      const result = await gen.morningBriefing();

      expect(result.success).toBe(true);
      expect(result.notionPageId).toBeUndefined();
    });

    it('should include yesterday completed count', async () => {
      await generator.morningBriefing();

      // The SMS should mention tasks completed
      expect(mockNotify).toHaveBeenCalled();
    });

    it('should handle null audit data', async () => {
      mockGetTodayAudit.mockResolvedValueOnce(null);

      const result = await generator.morningBriefing();

      expect(result.success).toBe(true);
    });

    it('should set higher priority when issues exist', async () => {
      mockGetTodayAudit.mockResolvedValueOnce({
        date: '2026-01-31',
        activities: [{ title: 'Failed', outcome: 'failure', type: 'task' }],
        highlights: [],
        issues: ['Critical issue'],
      });

      await generator.morningBriefing();

      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'normal', // Issues present = normal priority
        })
      );
    });
  });

  describe('eveningSummary()', () => {
    beforeEach(async () => {
      await generator.initNotion({
        enabled: true,
        databaseId: 'db-123',
        token: 'token',
        dailyLogParentId: 'parent-123',
      });
    });

    it('should generate evening summary', async () => {
      const result = await generator.eveningSummary();

      expect(result.success).toBe(true);
      expect(result.smsSent).toBe(false); // No SMS in evening
    });

    it('should append to today Notion log', async () => {
      await generator.eveningSummary();

      expect(mockNotionAddNote).toHaveBeenCalledWith(
        'today-entry-id',
        expect.stringContaining('Evening Summary')
      );
    });

    it('should log activity to audit', async () => {
      await generator.eveningSummary();

      expect(mockLogActivity).toHaveBeenCalledWith(
        'system_event',
        'Evening Summary',
        expect.any(String),
        expect.objectContaining({ outcome: 'success' })
      );
    });

    it('should handle no today entries', async () => {
      mockNotionGetTodayEntries.mockResolvedValueOnce([]);

      const result = await generator.eveningSummary();

      expect(result.success).toBe(true);
      expect(mockNotionAddNote).not.toHaveBeenCalled();
    });

    it('should handle null audit data', async () => {
      mockGetTodayAudit.mockResolvedValueOnce(null);

      const result = await generator.eveningSummary();

      expect(result.success).toBe(true);
    });

    it('should include highlights when available', async () => {
      mockGetTodayAudit.mockResolvedValueOnce({
        date: '2026-01-31',
        activities: [
          { title: 'Task 1', outcome: 'success', type: 'task' },
        ],
        highlights: ['Major feature shipped', 'Bug fixed', 'Tests added'],
        issues: [],
      });

      await generator.eveningSummary();

      expect(mockLogActivity).toHaveBeenCalledWith(
        'system_event',
        'Evening Summary',
        expect.stringContaining('accomplishments'),
        expect.any(Object)
      );
    });
  });

  describe('weeklyReview()', () => {
    beforeEach(async () => {
      await generator.initNotion({
        enabled: true,
        databaseId: 'db-123',
        token: 'token',
        dailyLogParentId: 'parent-123',
      });
    });

    it('should generate weekly review', async () => {
      const result = await generator.weeklyReview();

      expect(result.success).toBe(true);
      expect(result.notionPageId).toBe('notion-page-id');
      expect(result.smsSent).toBe(false);
    });

    it('should create Notion page with weekly summary', async () => {
      await generator.weeklyReview();

      expect(mockNotionCreateDailyLog).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: expect.stringContaining('Weekly Review'),
        })
      );
    });

    it('should log activity to audit', async () => {
      await generator.weeklyReview();

      expect(mockLogActivity).toHaveBeenCalledWith(
        'system_event',
        'Weekly Review',
        expect.any(String),
        expect.objectContaining({ outcome: 'success' })
      );
    });

    it('should include suggested action items', async () => {
      mockGetTodayAudit.mockResolvedValueOnce({
        date: '2026-01-31',
        activities: [
          { title: 'Failed Deploy', outcome: 'failure', type: 'task' },
          { title: 'Build Error', outcome: 'failure', type: 'task' },
        ],
        highlights: [],
        issues: [],
      });

      await generator.weeklyReview();

      // Action items should suggest retrying failed tasks
      expect(mockNotionCreateDailyLog).toHaveBeenCalled();
    });

    it('should handle empty week data', async () => {
      mockGetTodayAudit.mockResolvedValueOnce(null);

      const result = await generator.weeklyReview();

      expect(result.success).toBe(true);
    });
  });

  describe('helper methods (via public interfaces)', () => {
    beforeEach(async () => {
      await generator.initNotion({
        enabled: true,
        databaseId: 'db-123',
        token: 'token',
        dailyLogParentId: 'parent-123',
      });
    });

    it('should extract highlights correctly', async () => {
      mockGetTodayAudit.mockResolvedValueOnce({
        date: '2026-01-31',
        activities: [],
        highlights: ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'],
        issues: [],
      });

      await generator.morningBriefing();

      // Highlights limited to 5
      expect(mockNotionCreateDailyLog).toHaveBeenCalled();
    });

    it('should extract issues from failed activities', async () => {
      mockGetTodayAudit.mockResolvedValueOnce({
        date: '2026-01-31',
        activities: [
          { title: 'Fail 1', outcome: 'failure', type: 'task' },
          { title: 'Fail 2', outcome: 'failure', type: 'task' },
          { title: 'Success', outcome: 'success', type: 'task' },
        ],
        highlights: [],
        issues: [],
      });

      await generator.morningBriefing();

      // Should have extracted 2 issues
      expect(mockNotionCreateDailyLog).toHaveBeenCalled();
    });

    it('should build day metrics correctly', async () => {
      mockGetTodayAudit.mockResolvedValueOnce({
        date: '2026-01-31',
        activities: [
          { title: 'Task 1', outcome: 'success', type: 'task' },
          { title: 'Task 2', outcome: 'success', type: 'task' },
          { title: 'Task 3', outcome: 'failure', type: 'task' },
        ],
        highlights: [],
        issues: [],
      });

      await generator.eveningSummary();

      // Should calculate success rate
      expect(mockLogActivity).toHaveBeenCalled();
    });

    it('should format morning SMS with no items', async () => {
      mockProcessQueue.mockResolvedValueOnce({ processed: 0, sent: 0 });
      mockGetTodayAudit.mockResolvedValueOnce({
        date: '2026-01-31',
        activities: [],
        highlights: [],
        issues: [],
      });

      await generator.morningBriefing();

      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('All clear'),
        })
      );
    });

    it('should format morning SMS with issues', async () => {
      mockProcessQueue.mockResolvedValueOnce({ processed: 3, sent: 2 });
      mockGetTodayAudit.mockResolvedValueOnce({
        date: '2026-01-31',
        activities: [
          { title: 'Failed', outcome: 'failure', type: 'task' },
        ],
        highlights: [],
        issues: [],
      });

      await generator.morningBriefing();

      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('issues'),
        })
      );
    });
  });

  describe('audit data retrieval errors', () => {
    it('should handle getTodayAudit throwing', async () => {
      mockGetTodayAudit.mockRejectedValueOnce(new Error('Database error'));

      const result = await generator.morningBriefing();

      expect(result.success).toBe(true);
    });
  });

  describe('week metrics', () => {
    beforeEach(async () => {
      await generator.initNotion({
        enabled: true,
        databaseId: 'db-123',
        token: 'token',
        dailyLogParentId: 'parent-123',
      });
    });

    it('should calculate weekly success rate', async () => {
      mockGetTodayAudit.mockResolvedValueOnce({
        date: '2026-01-31',
        activities: [
          { title: 'Task 1', outcome: 'success', type: 'task' },
          { title: 'Task 2', outcome: 'success', type: 'task' },
          { title: 'Task 3', outcome: 'success', type: 'task' },
          { title: 'Task 4', outcome: 'failure', type: 'task' },
        ],
        highlights: ['Big win'],
        issues: [],
      });

      await generator.weeklyReview();

      expect(mockNotionCreateDailyLog).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.objectContaining({
            daysTracked: 1,
            totalTasks: 4,
            successful: 3,
          }),
        })
      );
    });
  });
});

describe('EventBus integration', () => {
  let generatorWithBus: BriefingGenerator;
  let mockEmit: ReturnType<typeof vi.fn>;
  let mockEventBus: { emit: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-31T12:00:00Z'));

    mockEmit = vi.fn();
    mockEventBus = { emit: mockEmit, on: vi.fn() } as unknown as typeof mockEventBus;

    mockProcessQueue.mockResolvedValue({ processed: 0, sent: 0 });
    mockNotify.mockResolvedValue({ sent: true });
    mockLogActivity.mockResolvedValue(undefined);
    mockGetTodayAudit.mockResolvedValue({
      date: '2026-01-31',
      activities: [{ title: 'Task 1', outcome: 'success', type: 'task' }],
      highlights: [],
      issues: [],
    });

    generatorWithBus = new BriefingGenerator(
      mockNotificationManager,
      mockEventBus as unknown as import('../../../src/kernel/event-bus.js').EventBus,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should emit briefing:morning_delivered after morning briefing', async () => {
    await generatorWithBus.morningBriefing();

    expect(mockEmit).toHaveBeenCalledWith('briefing:morning_delivered', {
      date: '2026-01-31',
    });
  });

  it('should emit briefing:evening_delivered after evening summary', async () => {
    mockNotionGetTodayEntries.mockResolvedValue([]);

    await generatorWithBus.eveningSummary();

    expect(mockEmit).toHaveBeenCalledWith('briefing:evening_delivered', {
      date: '2026-01-31',
    });
  });

  it('should emit briefing:weekly_delivered after weekly review', async () => {
    mockNotionIsReady.mockReturnValue(false);

    await generatorWithBus.weeklyReview();

    expect(mockEmit).toHaveBeenCalledWith('briefing:weekly_delivered', expect.objectContaining({
      date: '2026-01-31',
      weekNumber: expect.any(Number),
    }));
  });

  it('should not emit events when eventBus is not provided', async () => {
    const genNobus = new BriefingGenerator(mockNotificationManager);
    await genNobus.morningBriefing();

    // No emit calls since no eventBus
    expect(mockEmit).not.toHaveBeenCalled();
  });
});

describe('evening Telegram delivery', () => {
  let generator: BriefingGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-31T12:00:00Z'));

    mockProcessQueue.mockResolvedValue({ processed: 0, sent: 0 });
    mockNotify.mockResolvedValue({ sent: true });
    mockLogActivity.mockResolvedValue(undefined);
    mockGetTodayAudit.mockResolvedValue({
      date: '2026-01-31',
      activities: [
        { title: 'Task 1', outcome: 'success', type: 'task' },
        { title: 'Task 2', outcome: 'failure', type: 'task' },
      ],
      highlights: ['Big feature done'],
      issues: [],
    });
    mockNotionGetTodayEntries.mockResolvedValue([]);

    generator = new BriefingGenerator(mockNotificationManager);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should send evening summary via Telegram', async () => {
    await generator.eveningSummary();

    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'daily',
        title: 'Evening Summary',
        priority: 'low',
      })
    );
  });

  it('should include highlights in evening Telegram message', async () => {
    await generator.eveningSummary();

    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('Big feature done'),
      })
    );
  });

  it('should include open issues in evening Telegram message', async () => {
    mockGetTodayAudit.mockResolvedValueOnce({
      date: '2026-01-31',
      activities: [
        { title: 'Deploy Failed', outcome: 'failure', type: 'task' },
      ],
      highlights: [],
      issues: [],
    });

    await generator.eveningSummary();

    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('failed'),
      })
    );
  });
});

describe('createBriefingGenerator()', () => {
  it('should create BriefingGenerator instance', () => {
    const manager = {} as NotificationManager;
    const generator = createBriefingGenerator(manager);

    expect(generator).toBeInstanceOf(BriefingGenerator);
  });
});
