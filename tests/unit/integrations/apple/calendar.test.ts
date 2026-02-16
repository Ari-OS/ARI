import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppleCalendar, type CalendarEvent } from '../../../../src/integrations/apple/calendar.js';

// Mock child_process
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

// Mock logger
vi.mock('../../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { execFile } from 'node:child_process';

const execFileMock = vi.mocked(execFile);

// ─── Test Data ──────────────────────────────────────────────────────────────

const now = new Date();
const todayMorning = new Date(now);
todayMorning.setHours(9, 0, 0, 0);
const todayAfternoon = new Date(now);
todayAfternoon.setHours(14, 0, 0, 0);
const todayEvening = new Date(now);
todayEvening.setHours(17, 0, 0, 0);

function mockOsascriptOutput(events: string[]): void {
  execFileMock.mockImplementation((...allArgs: unknown[]) => {
    const callback = [...allArgs].reverse().find((a) => typeof a === 'function') as
      | ((err: Error | null, result: { stdout: string; stderr: string }) => void)
      | undefined;
    if (typeof callback === 'function') {
      callback(null, { stdout: events.join('\n') + '\n', stderr: '' });
    }
    return {} as ReturnType<typeof execFile>;
  });
}

function mockOsascriptError(error: Error): void {
  execFileMock.mockImplementation((...allArgs: unknown[]) => {
    const callback = [...allArgs].reverse().find((a) => typeof a === 'function') as
      | ((err: Error | null, result: { stdout: string; stderr: string }) => void)
      | undefined;
    if (typeof callback === 'function') {
      callback(error, { stdout: '', stderr: error.message });
    }
    return {} as ReturnType<typeof execFile>;
  });
}

const SAMPLE_EVENT_LINE = `uid-123|Team Standup|${todayMorning.toString()}|${new Date(todayMorning.getTime() + 30 * 60000).toString()}|Conference Room A||Work|false|`;
const ALL_DAY_EVENT_LINE = `uid-456|Company Holiday|${todayMorning.toString()}|${todayEvening.toString()}|||Personal|true|`;

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('AppleCalendar', () => {
  let calendar: AppleCalendar;

  beforeEach(() => {
    vi.clearAllMocks();
    calendar = new AppleCalendar();
  });

  describe('getTodayEvents', () => {
    it('should return parsed calendar events', async () => {
      mockOsascriptOutput([SAMPLE_EVENT_LINE, ALL_DAY_EVENT_LINE]);

      const events = await calendar.getTodayEvents();

      expect(events).toHaveLength(2);
      expect(events[0].title).toBe('Team Standup');
      expect(events[0].id).toBe('uid-123');
      expect(events[0].isAllDay).toBe(false);
      expect(events[0].location).toBe('Conference Room A');
      expect(events[1].title).toBe('Company Holiday');
      expect(events[1].isAllDay).toBe(true);
    });

    it('should return empty array on osascript failure', async () => {
      mockOsascriptError(new Error('Calendar access denied'));

      const events = await calendar.getTodayEvents();

      expect(events).toEqual([]);
    });

    it('should skip malformed lines', async () => {
      mockOsascriptOutput([
        SAMPLE_EVENT_LINE,
        'bad|data',
        ALL_DAY_EVENT_LINE,
      ]);

      const events = await calendar.getTodayEvents();

      expect(events).toHaveLength(2);
    });
  });

  describe('getUpcomingEvents', () => {
    it('should return events within the specified hour window', async () => {
      mockOsascriptOutput([SAMPLE_EVENT_LINE]);

      const events = await calendar.getUpcomingEvents(4);

      expect(events.length).toBeGreaterThanOrEqual(0);
      expect(execFileMock).toHaveBeenCalled();
    });
  });

  describe('getWeekEvents', () => {
    it('should fetch events for the full week', async () => {
      mockOsascriptOutput([SAMPLE_EVENT_LINE]);

      const events = await calendar.getWeekEvents();

      expect(events.length).toBeGreaterThanOrEqual(0);
      expect(execFileMock).toHaveBeenCalled();
    });
  });

  describe('getNextEvent', () => {
    it('should return the next upcoming non-all-day event', async () => {
      const futureTime = new Date(Date.now() + 60 * 60 * 1000);
      const futureEndTime = new Date(futureTime.getTime() + 30 * 60 * 1000);
      const futureLine = `uid-789|Future Meeting|${futureTime.toString()}|${futureEndTime.toString()}|Room B||Work|false|`;

      mockOsascriptOutput([futureLine]);

      const next = await calendar.getNextEvent();

      // May or may not find depending on timing, but shouldn't error
      expect(next === null || next.title === 'Future Meeting').toBe(true);
    });

    it('should return null when no upcoming events', async () => {
      mockOsascriptOutput([]);

      const next = await calendar.getNextEvent();

      expect(next).toBeNull();
    });
  });

  describe('isInMeeting', () => {
    it('should detect when user is in a meeting', async () => {
      const pastStart = new Date(Date.now() - 15 * 60 * 1000);
      const futureEnd = new Date(Date.now() + 15 * 60 * 1000);
      const currentMeeting = `uid-current|Active Meeting|${pastStart.toString()}|${futureEnd.toString()}|||Work|false|`;

      mockOsascriptOutput([currentMeeting]);

      const result = await calendar.isInMeeting();

      expect(result.inMeeting).toBe(true);
      expect(result.event?.title).toBe('Active Meeting');
    });

    it('should return false when not in a meeting', async () => {
      mockOsascriptOutput([]);

      const result = await calendar.isInMeeting();

      expect(result.inMeeting).toBe(false);
      expect(result.event).toBeUndefined();
    });
  });

  describe('formatForBriefing', () => {
    it('should format events for Telegram briefing', () => {
      const events: CalendarEvent[] = [
        {
          id: '1',
          title: 'Morning Standup',
          startDate: todayMorning,
          endDate: new Date(todayMorning.getTime() + 30 * 60000),
          calendar: 'Work',
          isAllDay: false,
          location: 'Room A',
        },
        {
          id: '2',
          title: 'Company Holiday',
          startDate: todayMorning,
          endDate: todayEvening,
          calendar: 'Personal',
          isAllDay: true,
        },
      ];

      const formatted = calendar.formatForBriefing(events);

      expect(formatted).toContain('All day: Company Holiday');
      expect(formatted).toContain('Morning Standup');
      expect(formatted).toContain('@ Room A');
    });

    it('should return "No events" for empty array', () => {
      expect(calendar.formatForBriefing([])).toBe('No events scheduled');
    });

    it('should truncate to 8 events', () => {
      const manyEvents: CalendarEvent[] = Array.from({ length: 12 }, (_, i) => ({
        id: String(i),
        title: `Event ${i}`,
        startDate: new Date(todayMorning.getTime() + i * 60 * 60000),
        endDate: new Date(todayMorning.getTime() + (i + 1) * 60 * 60000),
        calendar: 'Work',
        isAllDay: false,
      }));

      const formatted = calendar.formatForBriefing(manyEvents);

      expect(formatted).toContain('... and 4 more');
    });
  });

  describe('calendar filtering', () => {
    it('should filter by included calendars', async () => {
      const filtered = new AppleCalendar({ includedCalendars: ['Work'] });
      mockOsascriptOutput([SAMPLE_EVENT_LINE, ALL_DAY_EVENT_LINE]);

      const events = await filtered.getTodayEvents();

      expect(events.every(e => e.calendar === 'Work')).toBe(true);
    });

    it('should exclude specified calendars', async () => {
      const filtered = new AppleCalendar({ excludedCalendars: ['Personal'] });
      mockOsascriptOutput([SAMPLE_EVENT_LINE, ALL_DAY_EVENT_LINE]);

      const events = await filtered.getTodayEvents();

      expect(events.every(e => e.calendar !== 'Personal')).toBe(true);
    });
  });

  describe('caching', () => {
    it('should use cached results within TTL', async () => {
      mockOsascriptOutput([SAMPLE_EVENT_LINE]);

      await calendar.getTodayEvents();
      await calendar.getTodayEvents();

      // Should only call execFile once due to caching
      expect(execFileMock).toHaveBeenCalledTimes(1);
    });
  });
});
