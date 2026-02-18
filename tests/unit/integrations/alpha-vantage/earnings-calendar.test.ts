import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EarningsCalendar } from '../../../../src/integrations/alpha-vantage/earnings-calendar.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Helper: build CSV response
function makeCsvResponse(rows: string[]): Response {
  const header = 'symbol,name,reportDate,fiscalDateEnding,estimate,currency\n';
  const body = header + rows.join('\n');
  return {
    ok: true,
    status: 200,
    text: async () => body,
  } as unknown as Response;
}

// Helper: date N days from now
function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0]!;
}

describe('EarningsCalendar', () => {
  let calendar: EarningsCalendar;

  beforeEach(() => {
    vi.clearAllMocks();
    calendar = new EarningsCalendar('test-api-key');
  });

  describe('constructor', () => {
    it('should create with valid API key', () => {
      expect(calendar).toBeDefined();
    });

    it('should throw if no API key', () => {
      expect(() => new EarningsCalendar('')).toThrow('API key is required');
    });
  });

  describe('getUpcomingEarnings', () => {
    it('should return upcoming earnings events', async () => {
      const reportDate = daysFromNow(2);
      mockFetch.mockResolvedValueOnce(makeCsvResponse([
        `AAPL,Apple Inc,${reportDate},2026-03-31,1.25,USD`,
      ]));

      const events = await calendar.getUpcomingEarnings('AAPL');

      expect(events).toHaveLength(1);
      expect(events[0]!.symbol).toBe('AAPL');
      expect(events[0]!.estimate).toBe(1.25);
      expect(events[0]!.daysUntil).toBe(2);
      expect(events[0]!.currency).toBe('USD');
    });

    it('should return empty array on API error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'Error' } as unknown as Response);

      const events = await calendar.getUpcomingEarnings('AAPL');
      expect(events).toEqual([]);
    });

    it('should return empty array on rate limit message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        text: async () => '{"Information": "You have reached the maximum requests per minute"}',
      } as unknown as Response);

      const events = await calendar.getUpcomingEarnings('AAPL');
      expect(events).toEqual([]);
    });

    it('should cache results for 6 hours', async () => {
      const reportDate = daysFromNow(1);
      mockFetch.mockResolvedValue(makeCsvResponse([
        `AAPL,Apple Inc,${reportDate},2026-03-31,1.20,USD`,
      ]));

      await calendar.getUpcomingEarnings('AAPL');
      await calendar.getUpcomingEarnings('AAPL'); // Second call — should use cache

      expect(mockFetch).toHaveBeenCalledTimes(1); // Only one real request
    });

    it('should handle null estimate gracefully', async () => {
      const reportDate = daysFromNow(3);
      mockFetch.mockResolvedValueOnce(makeCsvResponse([
        `MSFT,Microsoft,${reportDate},2026-03-31,,USD`,
      ]));

      const events = await calendar.getUpcomingEarnings('MSFT');
      expect(events[0]!.estimate).toBeNull();
    });

    it('should sort events by reportDate', async () => {
      const tomorrow = daysFromNow(1);
      const nextWeek = daysFromNow(7);
      mockFetch.mockResolvedValueOnce(makeCsvResponse([
        `AAPL,Apple Inc,${nextWeek},2026-03-31,1.25,USD`,
        `AAPL,Apple Inc,${tomorrow},2025-12-31,1.10,USD`,
      ]));

      const events = await calendar.getUpcomingEarnings('AAPL');
      expect(events[0]!.daysUntil).toBe(1);
      expect(events[1]!.daysUntil).toBe(7);
    });
  });

  describe('getEarningsWithin', () => {
    it('should return only events within N days', async () => {
      const tomorrow = daysFromNow(1);
      const nextMonth = daysFromNow(30);

      mockFetch
        .mockResolvedValueOnce(makeCsvResponse([
          `AAPL,Apple Inc,${tomorrow},2026-03-31,1.25,USD`,
          `AAPL,Apple Inc,${nextMonth},2026-06-30,1.50,USD`,
        ]))
        .mockResolvedValueOnce(makeCsvResponse([
          `MSFT,Microsoft,${nextMonth},2026-06-30,2.00,USD`,
        ]));

      const upcoming = await calendar.getEarningsWithin(['AAPL', 'MSFT'], 3);

      // Only AAPL tomorrow should appear
      expect(upcoming).toHaveLength(1);
      expect(upcoming[0]!.symbol).toBe('AAPL');
    });

    it('should return sorted by daysUntil', async () => {
      const in2Days = daysFromNow(2);
      const tomorrow = daysFromNow(1);

      mockFetch
        .mockResolvedValueOnce(makeCsvResponse([
          `AAPL,Apple Inc,${in2Days},2026-03-31,1.25,USD`,
        ]))
        .mockResolvedValueOnce(makeCsvResponse([
          `MSFT,Microsoft,${tomorrow},2026-03-31,2.00,USD`,
        ]));

      const upcoming = await calendar.getEarningsWithin(['AAPL', 'MSFT'], 3);

      expect(upcoming[0]!.symbol).toBe('MSFT');  // 1 day
      expect(upcoming[1]!.symbol).toBe('AAPL');  // 2 days
    });

    it('should return empty for empty symbols list', async () => {
      const result = await calendar.getEarningsWithin([]);
      expect(result).toEqual([]);
    });
  });
});
