/**
 * ARI Cal.com Client
 *
 * Provides scheduling integration with Cal.com API.
 * Supports querying bookings, checking availability, and managing
 * appointments for briefings and automation.
 *
 * API: https://api.cal.com/v1/ (or self-hosted equivalent)
 * Auth: API key as query parameter
 *
 * Security: API key loaded from configuration, never logged or exposed.
 */

import { createLogger } from '../../kernel/logger.js';

const logger = createLogger('calcom-client');

// ── Configuration ─────────────────────────────────────────────────────
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes for bookings and event types
const CACHE_MAX_ENTRIES = 50;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export interface Booking {
  id: number;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendees: Array<{ name: string; email: string }>;
  status: 'accepted' | 'pending' | 'cancelled' | 'rejected';
  meetingUrl?: string;
  eventTypeId: number;
}

export interface EventType {
  id: number;
  title: string;
  slug: string;
  length: number; // minutes
  description?: string;
  locations?: Array<{ type: string; link?: string }>;
}

export interface TimeSlot {
  time: string; // ISO format
  available: boolean;
}

interface CalComBooking {
  id: number;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  attendees: Array<{ name: string; email: string }>;
  status: string;
  metadata?: { videoCallUrl?: string };
  eventTypeId: number;
}

interface CalComEventType {
  id: number;
  title: string;
  slug: string;
  length: number;
  description?: string;
  locations?: Array<{ type: string; link?: string }>;
}

interface CalComTimeSlot {
  time: string;
  available?: boolean;
}

export class CalComClient {
  private apiKey: string;
  private baseUrl: string;
  private cache = new Map<string, CacheEntry<unknown>>();

  constructor(apiKey: string, baseUrl: string = 'https://api.cal.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  // ── Cache utilities ───────────────────────────────────────────────────

  private getCached<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.data as T;
  }

  private setCache<T>(key: string, data: T): void {
    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      const firstKey = this.cache.keys().next().value as string;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  private clearBookingsCache(): void {
    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.startsWith('bookings:')) {
        keysToDelete.push(key);
      }
    });
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  // ── HTTP helpers ──────────────────────────────────────────────────────

  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set('apiKey', this.apiKey);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    return url.toString();
  }

  private async request<T>(
    method: string,
    path: string,
    params?: Record<string, string>,
    body?: unknown
  ): Promise<T> {
    const url = this.buildUrl(path, params);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cal.com API error (${response.status}): ${errorText}`);
      }

      const data = await response.json() as T;
      return data;
    } catch (error: unknown) {
      logger.error({ err: error, method, path }, 'Cal.com API request failed');
      throw error;
    }
  }

  // ── Booking operations ────────────────────────────────────────────────

  /**
   * Get bookings within a date range
   */
  async getBookings(startDate: Date, endDate: Date): Promise<Booking[]> {
    const startStr = startDate.toISOString();
    const endStr = endDate.toISOString();

    const cacheKey = `bookings:${startStr}:${endStr}`;
    const cached = this.getCached<Booking[]>(cacheKey);
    if (cached) return cached;

    logger.debug({ startDate: startStr, endDate: endStr }, 'Fetching bookings');

    const response = await this.request<{ bookings: CalComBooking[] }>(
      'GET',
      '/bookings',
      {
        dateFrom: startStr,
        dateTo: endStr,
      }
    );

    const bookings = response.bookings.map((b) => this.mapBooking(b));

    this.setCache(cacheKey, bookings);
    return bookings;
  }

  /**
   * Get upcoming bookings for the next N days (default: 7)
   */
  async getUpcomingBookings(days: number = 7): Promise<Booking[]> {
    const start = new Date();
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);

    return this.getBookings(start, end);
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(bookingId: number, reason?: string): Promise<boolean> {
    logger.info({ bookingId, reason }, 'Cancelling booking');

    try {
      await this.request<{ message: string }>(
        'DELETE',
        `/bookings/${bookingId}`,
        undefined,
        reason ? { cancellationReason: reason } : undefined
      );

      // Invalidate bookings cache
      this.clearBookingsCache();

      return true;
    } catch (error: unknown) {
      logger.error({ err: error, bookingId }, 'Failed to cancel booking');
      return false;
    }
  }

  // ── Event type operations ─────────────────────────────────────────────

  /**
   * Get all event types
   */
  async getEventTypes(): Promise<EventType[]> {
    const cacheKey = 'event-types';
    const cached = this.getCached<EventType[]>(cacheKey);
    if (cached) return cached;

    logger.debug('Fetching event types');

    const response = await this.request<{ event_types: CalComEventType[] }>(
      'GET',
      '/event-types'
    );

    const eventTypes = response.event_types.map((et) => ({
      id: et.id,
      title: et.title,
      slug: et.slug,
      length: et.length,
      description: et.description,
      locations: et.locations,
    }));

    this.setCache(cacheKey, eventTypes);
    return eventTypes;
  }

  /**
   * Get available time slots for an event type on a specific date
   */
  async getAvailability(eventTypeId: number, date: Date): Promise<TimeSlot[]> {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

    const cacheKey = `availability:${eventTypeId}:${dateStr}`;
    const cached = this.getCached<TimeSlot[]>(cacheKey);
    if (cached) return cached;

    logger.debug({ eventTypeId, date: dateStr }, 'Fetching availability');

    try {
      const response = await this.request<{ slots: CalComTimeSlot[] }>(
        'GET',
        '/slots',
        {
          eventTypeId: String(eventTypeId),
          startTime: dateStr,
          endTime: dateStr,
        }
      );

      const slots = response.slots.map((s) => ({
        time: s.time,
        available: s.available ?? true,
      }));

      this.setCache(cacheKey, slots);
      return slots;
    } catch (error: unknown) {
      logger.warn({ err: error, eventTypeId, date: dateStr }, 'Failed to fetch availability');
      return [];
    }
  }

  // ── Formatting ────────────────────────────────────────────────────────

  /**
   * Format bookings for briefing inclusion
   */
  formatForBriefing(bookings: Booking[]): string {
    if (bookings.length === 0) {
      return 'No upcoming appointments.';
    }

    // Group by date
    const byDate = new Map<string, Booking[]>();
    for (const booking of bookings) {
      const dateKey = booking.startTime.toISOString().split('T')[0];
      const existing = byDate.get(dateKey) ?? [];
      existing.push(booking);
      byDate.set(dateKey, existing);
    }

    // Sort dates
    const sortedDates = Array.from(byDate.keys()).sort();

    let output = '';
    for (const date of sortedDates) {
      const dateBookings = byDate.get(date) ?? [];
      const dateObj = new Date(date);
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

      output += `\n**${dayName}**\n`;

      // Sort by time
      dateBookings.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

      for (const booking of dateBookings) {
        const startTime = booking.startTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        const endTime = booking.endTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });

        const attendeeNames = booking.attendees.map((a) => a.name).join(', ');
        const statusIcon = this.getStatusIcon(booking.status);

        output += `- ${startTime} - ${endTime} ${statusIcon} **${booking.title}**`;
        if (attendeeNames) {
          output += ` (with ${attendeeNames})`;
        }
        if (booking.meetingUrl) {
          output += ` [Join](${booking.meetingUrl})`;
        }
        output += '\n';
      }
    }

    return output;
  }

  // ── Utilities ─────────────────────────────────────────────────────────

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'accepted':
        return '✓';
      case 'pending':
        return '⏳';
      case 'cancelled':
        return '✗';
      case 'rejected':
        return '✗';
      default:
        return '•';
    }
  }

  private mapBooking(booking: CalComBooking): Booking {
    return {
      id: booking.id,
      title: booking.title,
      description: booking.description,
      startTime: new Date(booking.startTime),
      endTime: new Date(booking.endTime),
      attendees: booking.attendees,
      status: this.normalizeStatus(booking.status),
      meetingUrl: booking.metadata?.videoCallUrl,
      eventTypeId: booking.eventTypeId,
    };
  }

  private normalizeStatus(status: string): 'accepted' | 'pending' | 'cancelled' | 'rejected' {
    const normalized = status.toLowerCase();
    if (normalized === 'accepted' || normalized === 'confirmed') {
      return 'accepted';
    }
    if (normalized === 'pending') {
      return 'pending';
    }
    if (normalized === 'cancelled') {
      return 'cancelled';
    }
    if (normalized === 'rejected') {
      return 'rejected';
    }
    // Default to pending for unknown statuses
    return 'pending';
  }
}
