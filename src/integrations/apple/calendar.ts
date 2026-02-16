/**
 * Apple Calendar Integration
 *
 * Queries Calendar.app via osascript (AppleScript) to retrieve events.
 * macOS-first approach (ADR-008) — no external dependencies.
 *
 * Usage:
 *   const cal = new AppleCalendar();
 *   const events = await cal.getTodayEvents();
 *   const upcoming = await cal.getUpcomingEvents(2); // next 2 hours
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createLogger } from '../../kernel/logger.js';

const execFileAsync = promisify(execFile);
const log = createLogger('apple-calendar');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  notes?: string;
  calendar: string;
  isAllDay: boolean;
  url?: string;
}

export interface CalendarConfig {
  /** Calendar names to include (empty = all calendars) */
  includedCalendars: string[];
  /** Calendar names to exclude */
  excludedCalendars: string[];
  /** Timezone for date operations */
  timezone: string;
}

const DEFAULT_CONFIG: CalendarConfig = {
  includedCalendars: [],
  excludedCalendars: [],
  timezone: 'America/Indiana/Indianapolis',
};

// ─── AppleScript Templates ──────────────────────────────────────────────────

function buildEventsScript(startDate: string, endDate: string): string {
  // AppleScript to query Calendar.app for events in a date range
  // Returns pipe-delimited records, one per line
  return `
    set output to ""
    set startD to date "${startDate}"
    set endD to date "${endDate}"
    tell application "Calendar"
      repeat with cal in calendars
        set calName to name of cal
        set calEvents to (every event of cal whose start date >= startD and start date <= endD)
        repeat with evt in calEvents
          set evtId to uid of evt
          set evtTitle to summary of evt
          set evtStart to start date of evt
          set evtEnd to end date of evt
          set evtAllDay to allday event of evt
          set evtLoc to ""
          try
            set evtLoc to location of evt
          end try
          set evtNotes to ""
          try
            set evtNotes to description of evt
          end try
          set evtUrl to ""
          try
            set evtUrl to url of evt
          end try
          set output to output & evtId & "|" & evtTitle & "|" & (evtStart as string) & "|" & (evtEnd as string) & "|" & evtLoc & "|" & evtNotes & "|" & calName & "|" & evtAllDay & "|" & evtUrl & linefeed
        end repeat
      end repeat
    end tell
    return output
  `;
}

// ─── Parser ─────────────────────────────────────────────────────────────────

function parseEventLine(line: string): CalendarEvent | null {
  const parts = line.split('|');
  if (parts.length < 8) return null;

  const [id, title, startStr, endStr, location, notes, calendar, allDayStr, url] = parts;

  const startDate = new Date(startStr);
  const endDate = new Date(endStr);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return null;
  }

  return {
    id: id.trim(),
    title: title.trim(),
    startDate,
    endDate,
    location: location?.trim() || undefined,
    notes: notes?.trim() || undefined,
    calendar: calendar.trim(),
    isAllDay: allDayStr?.trim().toLowerCase() === 'true',
    url: url?.trim() || undefined,
  };
}

// ─── Apple Calendar Client ──────────────────────────────────────────────────

export class AppleCalendar {
  private config: CalendarConfig;
  private cache: { events: CalendarEvent[]; fetchedAt: number } | null = null;
  private cacheTtlMs = 5 * 60 * 1000; // 5 min cache

  constructor(config: Partial<CalendarConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get all events for today
   */
  async getTodayEvents(): Promise<CalendarEvent[]> {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    return this.getEventsInRange(start, end);
  }

  /**
   * Get events in the next N hours
   */
  async getUpcomingEvents(hours: number): Promise<CalendarEvent[]> {
    const now = new Date();
    const end = new Date(now.getTime() + hours * 60 * 60 * 1000);

    return this.getEventsInRange(now, end);
  }

  /**
   * Get all events for the current week (Monday-Sunday)
   */
  async getWeekEvents(): Promise<CalendarEvent[]> {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return this.getEventsInRange(monday, sunday);
  }

  /**
   * Get events in a specific date range
   */
  async getEventsInRange(start: Date, end: Date): Promise<CalendarEvent[]> {
    // Check cache
    if (this.cache && Date.now() - this.cache.fetchedAt < this.cacheTtlMs) {
      return this.filterByRange(this.cache.events, start, end);
    }

    try {
      const events = await this.fetchEvents(start, end);
      this.cache = { events, fetchedAt: Date.now() };
      return this.filterByCalendar(events);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.warn(`Failed to fetch calendar events: ${message}`);
      return [];
    }
  }

  /**
   * Get the next event starting from now
   */
  async getNextEvent(): Promise<CalendarEvent | null> {
    const upcoming = await this.getUpcomingEvents(24);
    const now = new Date();
    const future = upcoming
      .filter(e => e.startDate > now && !e.isAllDay)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    return future[0] ?? null;
  }

  /**
   * Check if user is currently in a meeting
   */
  async isInMeeting(): Promise<{ inMeeting: boolean; event?: CalendarEvent }> {
    const now = new Date();
    const todayEvents = await this.getTodayEvents();
    const current = todayEvents.find(
      e => !e.isAllDay && e.startDate <= now && e.endDate > now
    );
    return { inMeeting: !!current, event: current };
  }

  /**
   * Format events for briefing display
   */
  formatForBriefing(events: CalendarEvent[]): string {
    if (events.length === 0) return 'No events scheduled';

    const lines: string[] = [];
    const sorted = [...events].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    for (const event of sorted.slice(0, 8)) {
      if (event.isAllDay) {
        lines.push(`  All day: ${event.title}`);
      } else {
        const time = event.startDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: this.config.timezone,
        });
        const loc = event.location ? ` @ ${event.location}` : '';
        lines.push(`  ${time} — ${event.title}${loc}`);
      }
    }

    if (events.length > 8) {
      lines.push(`  ... and ${events.length - 8} more`);
    }

    return lines.join('\n');
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async fetchEvents(start: Date, end: Date): Promise<CalendarEvent[]> {
    const startStr = this.formatAppleScriptDate(start);
    const endStr = this.formatAppleScriptDate(end);
    const script = buildEventsScript(startStr, endStr);

    const { stdout } = await execFileAsync('osascript', ['-e', script], {
      timeout: 10_000,
    });

    const lines = stdout.trim().split('\n').filter(Boolean);
    const events: CalendarEvent[] = [];

    for (const line of lines) {
      const event = parseEventLine(line);
      if (event) {
        events.push(event);
      }
    }

    log.info(`Fetched ${events.length} calendar events`);
    return events;
  }

  private filterByCalendar(events: CalendarEvent[]): CalendarEvent[] {
    let filtered = events;

    if (this.config.includedCalendars.length > 0) {
      filtered = filtered.filter(e =>
        this.config.includedCalendars.includes(e.calendar)
      );
    }

    if (this.config.excludedCalendars.length > 0) {
      filtered = filtered.filter(e =>
        !this.config.excludedCalendars.includes(e.calendar)
      );
    }

    return filtered;
  }

  private filterByRange(events: CalendarEvent[], start: Date, end: Date): CalendarEvent[] {
    return this.filterByCalendar(
      events.filter(e => e.startDate >= start && e.startDate <= end)
    );
  }

  private formatAppleScriptDate(date: Date): string {
    // AppleScript date format: "month day, year hour:minute:second AM/PM"
    return date.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: this.config.timezone,
    });
  }
}
