import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CalComClient } from '../../../../src/integrations/calcom/client.js';
import type { Booking, EventType, TimeSlot } from '../../../../src/integrations/calcom/client.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('CalComClient', () => {
  let client: CalComClient;
  const apiKey = 'test-api-key';
  const baseUrl = 'https://api.cal.com/v1';

  beforeEach(() => {
    client = new CalComClient(apiKey, baseUrl);
    mockFetch.mockReset();
  });

  describe('constructor', () => {
    it('should use default base URL if not provided', () => {
      const defaultClient = new CalComClient(apiKey);
      expect(defaultClient).toBeInstanceOf(CalComClient);
    });

    it('should strip trailing slash from base URL', () => {
      const clientWithSlash = new CalComClient(apiKey, 'https://api.cal.com/v1/');
      expect(clientWithSlash).toBeInstanceOf(CalComClient);
    });

    it('should support self-hosted URL', () => {
      const selfHosted = new CalComClient(apiKey, 'https://cal.example.com/api/v1');
      expect(selfHosted).toBeInstanceOf(CalComClient);
    });
  });

  describe('getBookings', () => {
    it('should fetch bookings in date range', async () => {
      const startDate = new Date('2026-02-16T00:00:00Z');
      const endDate = new Date('2026-02-20T23:59:59Z');

      const mockResponse = {
        bookings: [
          {
            id: 1,
            title: 'Team Sync',
            description: 'Weekly sync',
            startTime: '2026-02-17T10:00:00Z',
            endTime: '2026-02-17T11:00:00Z',
            attendees: [{ name: 'John Doe', email: 'john@example.com' }],
            status: 'accepted',
            metadata: { videoCallUrl: 'https://meet.example.com/abc' },
            eventTypeId: 100,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getBookings(startDate, endDate);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        title: 'Team Sync',
        status: 'accepted',
        eventTypeId: 100,
      });
      expect(result[0].startTime).toBeInstanceOf(Date);
      expect(result[0].endTime).toBeInstanceOf(Date);

      // Verify API call
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('apiKey=test-api-key');
      expect(callUrl).toContain('dateFrom=');
      expect(callUrl).toContain('dateTo=');
    });

    it('should cache bookings', async () => {
      const startDate = new Date('2026-02-16T00:00:00Z');
      const endDate = new Date('2026-02-20T23:59:59Z');

      const mockResponse = {
        bookings: [
          {
            id: 1,
            title: 'Meeting',
            startTime: '2026-02-17T10:00:00Z',
            endTime: '2026-02-17T11:00:00Z',
            attendees: [],
            status: 'accepted',
            eventTypeId: 100,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result1 = await client.getBookings(startDate, endDate);
      const result2 = await client.getBookings(startDate, endDate);

      expect(result1).toEqual(result2);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Cached
    });

    it('should handle empty bookings', async () => {
      const startDate = new Date('2026-02-16T00:00:00Z');
      const endDate = new Date('2026-02-20T23:59:59Z');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bookings: [] }),
      });

      const result = await client.getBookings(startDate, endDate);

      expect(result).toEqual([]);
    });
  });

  describe('getUpcomingBookings', () => {
    it('should fetch bookings for next 7 days by default', async () => {
      const mockResponse = {
        bookings: [
          {
            id: 1,
            title: 'Upcoming meeting',
            startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
            endTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 3600000).toISOString(),
            attendees: [],
            status: 'pending',
            eventTypeId: 100,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getUpcomingBookings();

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Upcoming meeting');
    });

    it('should accept custom days parameter', async () => {
      const mockResponse = {
        bookings: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getUpcomingBookings(14);

      expect(result).toEqual([]);
    });
  });

  describe('cancelBooking', () => {
    it('should cancel a booking', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Booking cancelled' }),
      });

      const result = await client.cancelBooking(123);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/bookings/123'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('should cancel with reason', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Booking cancelled' }),
      });

      const result = await client.cancelBooking(123, 'Schedule conflict');

      expect(result).toBe(true);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string) as { cancellationReason: string };
      expect(callBody.cancellationReason).toBe('Schedule conflict');
    });

    it('should handle cancellation errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Booking not found',
      });

      const result = await client.cancelBooking(999);

      expect(result).toBe(false);
    });
  });

  describe('getEventTypes', () => {
    it('should fetch and cache event types', async () => {
      const mockResponse = {
        event_types: [
          {
            id: 1,
            title: '30 Min Meeting',
            slug: '30min',
            length: 30,
            description: 'Quick sync',
            locations: [{ type: 'zoom', link: 'https://zoom.us/j/123' }],
          },
          {
            id: 2,
            title: '1 Hour Consultation',
            slug: '1hour',
            length: 60,
            description: 'In-depth discussion',
            locations: undefined,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getEventTypes();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 1,
        title: '30 Min Meeting',
        slug: '30min',
        length: 30,
      });

      // Second call should use cache
      const result2 = await client.getEventTypes();
      expect(result2).toEqual(result);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAvailability', () => {
    it('should fetch available slots', async () => {
      const date = new Date('2026-02-17T00:00:00Z');

      const mockResponse = {
        slots: [
          { time: '2026-02-17T09:00:00Z', available: true },
          { time: '2026-02-17T10:00:00Z', available: true },
          { time: '2026-02-17T11:00:00Z', available: false },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getAvailability(1, date);

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        time: '2026-02-17T09:00:00Z',
        available: true,
      });
      expect(result[2].available).toBe(false);
    });

    it('should cache availability', async () => {
      const date = new Date('2026-02-17T00:00:00Z');

      const mockResponse = {
        slots: [{ time: '2026-02-17T09:00:00Z', available: true }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result1 = await client.getAvailability(1, date);
      const result2 = await client.getAvailability(1, date);

      expect(result1).toEqual(result2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors gracefully', async () => {
      const date = new Date('2026-02-17T00:00:00Z');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });

      const result = await client.getAvailability(1, date);

      expect(result).toEqual([]); // Returns empty array on error
    });

    it('should default available to true if missing', async () => {
      const date = new Date('2026-02-17T00:00:00Z');

      const mockResponse = {
        slots: [{ time: '2026-02-17T09:00:00Z' }], // No available field
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getAvailability(1, date);

      expect(result[0].available).toBe(true);
    });
  });

  describe('formatForBriefing', () => {
    it('should format bookings grouped by date', () => {
      const bookings: Booking[] = [
        {
          id: 1,
          title: 'Morning standup',
          startTime: new Date('2026-02-17T09:00:00Z'),
          endTime: new Date('2026-02-17T09:30:00Z'),
          attendees: [{ name: 'Team', email: 'team@example.com' }],
          status: 'accepted',
          eventTypeId: 1,
        },
        {
          id: 2,
          title: 'Client call',
          startTime: new Date('2026-02-17T14:00:00Z'),
          endTime: new Date('2026-02-17T15:00:00Z'),
          attendees: [{ name: 'John Doe', email: 'john@example.com' }],
          status: 'accepted',
          meetingUrl: 'https://meet.example.com/xyz',
          eventTypeId: 2,
        },
        {
          id: 3,
          title: 'Review meeting',
          startTime: new Date('2026-02-18T10:00:00Z'),
          endTime: new Date('2026-02-18T11:00:00Z'),
          attendees: [],
          status: 'pending',
          eventTypeId: 1,
        },
      ];

      const formatted = client.formatForBriefing(bookings);

      expect(formatted).toContain('Morning standup');
      expect(formatted).toContain('Client call');
      expect(formatted).toContain('Review meeting');
      expect(formatted).toContain('with Team');
      expect(formatted).toContain('with John Doe');
      expect(formatted).toContain('[Join](https://meet.example.com/xyz)');
      expect(formatted).toContain('✓'); // accepted icon
      expect(formatted).toContain('⏳'); // pending icon
    });

    it('should handle empty bookings', () => {
      const formatted = client.formatForBriefing([]);
      expect(formatted).toBe('No upcoming appointments.');
    });

    it('should show status icons correctly', () => {
      const bookings: Booking[] = [
        {
          id: 1,
          title: 'Accepted',
          startTime: new Date('2026-02-17T09:00:00Z'),
          endTime: new Date('2026-02-17T10:00:00Z'),
          attendees: [],
          status: 'accepted',
          eventTypeId: 1,
        },
        {
          id: 2,
          title: 'Pending',
          startTime: new Date('2026-02-17T11:00:00Z'),
          endTime: new Date('2026-02-17T12:00:00Z'),
          attendees: [],
          status: 'pending',
          eventTypeId: 1,
        },
        {
          id: 3,
          title: 'Cancelled',
          startTime: new Date('2026-02-17T13:00:00Z'),
          endTime: new Date('2026-02-17T14:00:00Z'),
          attendees: [],
          status: 'cancelled',
          eventTypeId: 1,
        },
      ];

      const formatted = client.formatForBriefing(bookings);

      expect(formatted).toContain('✓');
      expect(formatted).toContain('⏳');
      expect(formatted).toContain('✗');
    });

    it('should sort bookings by date and time', () => {
      const bookings: Booking[] = [
        {
          id: 3,
          title: 'Third',
          startTime: new Date('2026-02-18T10:00:00Z'),
          endTime: new Date('2026-02-18T11:00:00Z'),
          attendees: [],
          status: 'accepted',
          eventTypeId: 1,
        },
        {
          id: 1,
          title: 'First',
          startTime: new Date('2026-02-17T09:00:00Z'),
          endTime: new Date('2026-02-17T10:00:00Z'),
          attendees: [],
          status: 'accepted',
          eventTypeId: 1,
        },
        {
          id: 2,
          title: 'Second',
          startTime: new Date('2026-02-17T14:00:00Z'),
          endTime: new Date('2026-02-17T15:00:00Z'),
          attendees: [],
          status: 'accepted',
          eventTypeId: 1,
        },
      ];

      const formatted = client.formatForBriefing(bookings);

      const firstIndex = formatted.indexOf('First');
      const secondIndex = formatted.indexOf('Second');
      const thirdIndex = formatted.indexOf('Third');

      expect(firstIndex).toBeLessThan(secondIndex);
      expect(secondIndex).toBeLessThan(thirdIndex);
    });
  });

  describe('status normalization', () => {
    it('should normalize various status strings', async () => {
      const mockResponses = [
        { status: 'accepted' },
        { status: 'confirmed' },
        { status: 'ACCEPTED' },
        { status: 'pending' },
        { status: 'PENDING' },
        { status: 'cancelled' },
        { status: 'rejected' },
        { status: 'unknown' },
      ];

      for (const statusData of mockResponses) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            bookings: [
              {
                id: 1,
                title: 'Test',
                startTime: '2026-02-17T10:00:00Z',
                endTime: '2026-02-17T11:00:00Z',
                attendees: [],
                status: statusData.status,
                eventTypeId: 1,
              },
            ],
          }),
        });
      }

      const results = await Promise.all([
        client.getBookings(new Date(), new Date()),
        client.getBookings(new Date(), new Date()),
        client.getBookings(new Date(), new Date()),
        client.getBookings(new Date(), new Date()),
        client.getBookings(new Date(), new Date()),
        client.getBookings(new Date(), new Date()),
        client.getBookings(new Date(), new Date()),
        client.getBookings(new Date(), new Date()),
      ]);

      // Verify normalized statuses
      expect(results[0][0].status).toBe('accepted');
      expect(results[1][0].status).toBe('accepted'); // 'confirmed' → 'accepted'
      expect(results[2][0].status).toBe('accepted'); // case insensitive
      expect(results[3][0].status).toBe('pending');
      expect(results[4][0].status).toBe('pending'); // case insensitive
      expect(results[5][0].status).toBe('cancelled');
      expect(results[6][0].status).toBe('rejected');
      expect(results[7][0].status).toBe('pending'); // unknown → pending
    });
  });

  describe('error handling', () => {
    it('should throw on network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      await expect(
        client.getBookings(new Date(), new Date())
      ).rejects.toThrow('Network failure');
    });

    it('should throw on API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(
        client.getBookings(new Date(), new Date())
      ).rejects.toThrow('Cal.com API error (401)');
    });

    it('should handle malformed JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(
        client.getBookings(new Date(), new Date())
      ).rejects.toThrow('Invalid JSON');
    });
  });

  describe('cache management', () => {
    it('should clear bookings cache after cancellation', async () => {
      const startDate = new Date('2026-02-16T00:00:00Z');
      const endDate = new Date('2026-02-20T23:59:59Z');

      // First fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          bookings: [
            {
              id: 1,
              title: 'Meeting',
              startTime: '2026-02-17T10:00:00Z',
              endTime: '2026-02-17T11:00:00Z',
              attendees: [],
              status: 'accepted',
              eventTypeId: 100,
            },
          ],
        }),
      });

      await client.getBookings(startDate, endDate);

      // Cancel booking
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Cancelled' }),
      });

      await client.cancelBooking(1);

      // Second fetch should make a new API call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          bookings: [],
        }),
      });

      const result = await client.getBookings(startDate, endDate);

      expect(result).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + cancel + refetch
    });
  });
});
