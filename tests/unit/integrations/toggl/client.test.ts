import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TogglClient } from '../../../../src/integrations/toggl/client.js';
import type { TimeEntry, Project, WeeklyReport } from '../../../../src/integrations/toggl/client.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('TogglClient', () => {
  let client: TogglClient;
  const apiToken = 'test-api-token';
  const workspaceId = '12345';

  beforeEach(() => {
    client = new TogglClient(apiToken, workspaceId);
    mockFetch.mockReset();
  });

  describe('startTimer', () => {
    it('should start a timer with description only', async () => {
      const mockResponse = {
        id: 1,
        description: 'Test task',
        start: '2026-02-16T10:00:00Z',
        duration: -1,
        project_id: undefined,
        tags: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.startTimer('Test task');

      expect(result).toMatchObject({
        id: 1,
        description: 'Test task',
        duration: -1,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.track.toggl.com/api/v9/me/time_entries',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Basic'),
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should start a timer with project and tags', async () => {
      const mockResponse = {
        id: 2,
        description: 'ARI development',
        start: '2026-02-16T10:00:00Z',
        duration: -1,
        project_id: 100,
        tags: ['coding', 'typescript'],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.startTimer('ARI development', 100, ['coding', 'typescript']);

      expect(result).toMatchObject({
        id: 2,
        description: 'ARI development',
        projectId: 100,
        tags: ['coding', 'typescript'],
      });
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(client.startTimer('Test')).rejects.toThrow('Toggl API error (401)');
    });
  });

  describe('stopTimer', () => {
    it('should stop a timer by ID', async () => {
      const mockResponse = {
        id: 1,
        description: 'Test task',
        start: '2026-02-16T10:00:00Z',
        stop: '2026-02-16T11:30:00Z',
        duration: 5400, // 1.5 hours
        project_id: undefined,
        tags: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.stopTimer(1);

      expect(result).toMatchObject({
        id: 1,
        duration: 5400,
      });
      expect(result.stop).toBeInstanceOf(Date);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.track.toggl.com/api/v9/me/time_entries/1/stop',
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });

    it('should stop current timer if no ID provided', async () => {
      // Mock getCurrentTimer response
      const currentTimerResponse = {
        id: 5,
        description: 'Running task',
        start: '2026-02-16T10:00:00Z',
        duration: -1,
        project_id: undefined,
        tags: [],
      };

      // Mock stopTimer response
      const stoppedTimerResponse = {
        ...currentTimerResponse,
        stop: '2026-02-16T11:00:00Z',
        duration: 3600,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => currentTimerResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => stoppedTimerResponse,
        });

      const result = await client.stopTimer();

      expect(result.id).toBe(5);
      expect(result.duration).toBe(3600);
    });

    it('should throw if no timer running and no ID provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      });

      await expect(client.stopTimer()).rejects.toThrow('No timer currently running');
    });
  });

  describe('getCurrentTimer', () => {
    it('should return current timer if running', async () => {
      const mockResponse = {
        id: 3,
        description: 'Current work',
        start: '2026-02-16T10:00:00Z',
        duration: -1,
        project_id: 200,
        tags: ['work'],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getCurrentTimer();

      expect(result).toMatchObject({
        id: 3,
        description: 'Current work',
        duration: -1,
        projectId: 200,
      });
    });

    it('should return null if no timer running', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      });

      const result = await client.getCurrentTimer();

      expect(result).toBeNull();
    });
  });

  describe('getTodayEntries', () => {
    it('should fetch entries for today', async () => {
      const mockEntries = [
        {
          id: 1,
          description: 'Morning work',
          start: '2026-02-16T08:00:00Z',
          stop: '2026-02-16T10:00:00Z',
          duration: 7200,
          project_id: undefined,
          tags: [],
        },
        {
          id: 2,
          description: 'Afternoon work',
          start: '2026-02-16T13:00:00Z',
          stop: '2026-02-16T15:30:00Z',
          duration: 9000,
          project_id: undefined,
          tags: [],
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockEntries,
      });

      const result = await client.getTodayEntries();

      expect(result).toHaveLength(2);
      expect(result[0].description).toBe('Morning work');
      expect(result[1].description).toBe('Afternoon work');
    });
  });

  describe('getProjects', () => {
    it('should fetch and cache projects', async () => {
      const mockProjects = [
        {
          id: 100,
          name: 'ARI Project',
          color: '#ff0000',
          active: true,
          client_name: 'Personal',
        },
        {
          id: 101,
          name: 'School Work',
          color: '#00ff00',
          active: true,
          client_name: undefined,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProjects,
      });

      const result = await client.getProjects();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 100,
        name: 'ARI Project',
        color: '#ff0000',
        active: true,
        clientName: 'Personal',
      });

      // Second call should use cache
      const result2 = await client.getProjects();
      expect(result2).toEqual(result);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still just once
    });
  });

  describe('getWeeklyReport', () => {
    it('should generate weekly report with project breakdown', async () => {
      const mockEntries = [
        {
          id: 1,
          description: 'ARI work',
          start: '2026-02-10T08:00:00Z',
          stop: '2026-02-10T12:00:00Z',
          duration: 14400, // 4 hours
          project_id: 100,
          tags: [],
        },
        {
          id: 2,
          description: 'More ARI work',
          start: '2026-02-11T08:00:00Z',
          stop: '2026-02-11T11:00:00Z',
          duration: 10800, // 3 hours
          project_id: 100,
          tags: [],
        },
        {
          id: 3,
          description: 'School work',
          start: '2026-02-12T13:00:00Z',
          stop: '2026-02-12T16:00:00Z',
          duration: 10800, // 3 hours
          project_id: 101,
          tags: [],
        },
      ];

      const mockProjects = [
        { id: 100, name: 'ARI Project', color: '#ff0000', active: true },
        { id: 101, name: 'School Work', color: '#00ff00', active: true },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockEntries,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockProjects,
        });

      const report = await client.getWeeklyReport();

      expect(report.totalSeconds).toBe(36000); // 10 hours total
      expect(report.projects).toHaveLength(2);
      expect(report.projects[0].name).toBe('ARI Project');
      expect(report.projects[0].seconds).toBe(25200); // 7 hours
      expect(report.projects[0].percentage).toBe(70);
      expect(report.projects[1].name).toBe('School Work');
      expect(report.projects[1].seconds).toBe(10800); // 3 hours
      expect(report.projects[1].percentage).toBe(30);
    });

    it('should handle entries without projects', async () => {
      const mockEntries = [
        {
          id: 1,
          description: 'Untracked work',
          start: '2026-02-10T08:00:00Z',
          stop: '2026-02-10T10:00:00Z',
          duration: 7200, // 2 hours
          project_id: undefined,
          tags: [],
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockEntries,
      });

      const report = await client.getWeeklyReport();

      expect(report.totalSeconds).toBe(7200);
      expect(report.projects).toHaveLength(1);
      expect(report.projects[0].name).toBe('No Project');
    });

    it('should skip running timers in report', async () => {
      const mockEntries = [
        {
          id: 1,
          description: 'Completed work',
          start: '2026-02-10T08:00:00Z',
          stop: '2026-02-10T10:00:00Z',
          duration: 7200,
          project_id: undefined,
          tags: [],
        },
        {
          id: 2,
          description: 'Running task',
          start: '2026-02-16T10:00:00Z',
          duration: -1, // Running
          project_id: undefined,
          tags: [],
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockEntries,
      });

      const report = await client.getWeeklyReport();

      expect(report.totalSeconds).toBe(7200); // Only completed entry
    });
  });

  describe('formatForBriefing', () => {
    it('should format weekly report for briefing', () => {
      const report: WeeklyReport = {
        totalSeconds: 36000, // 10 hours
        projects: [
          { name: 'ARI Project', seconds: 25200, percentage: 70 },
          { name: 'School Work', seconds: 10800, percentage: 30 },
        ],
        dailyTotals: [
          { date: '2026-02-10', seconds: 14400 },
          { date: '2026-02-11', seconds: 10800 },
          { date: '2026-02-12', seconds: 10800 },
        ],
      };

      const formatted = client.formatForBriefing(report);

      expect(formatted).toContain('10h 0m');
      expect(formatted).toContain('ARI Project');
      expect(formatted).toContain('70%');
      expect(formatted).toContain('School Work');
      expect(formatted).toContain('30%');
      expect(formatted).toContain('2026-02-10');
      expect(formatted).toContain('4h 0m');
    });

    it('should handle reports with minutes', () => {
      const report: WeeklyReport = {
        totalSeconds: 5430, // 1h 30m 30s
        projects: [
          { name: 'Quick task', seconds: 5430, percentage: 100 },
        ],
        dailyTotals: [
          { date: '2026-02-16', seconds: 5430 },
        ],
      };

      const formatted = client.formatForBriefing(report);

      expect(formatted).toContain('1h 30m');
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.startTimer('Test')).rejects.toThrow('Network error');
    });

    it('should handle malformed responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      // getCurrentTimer returns null on error, use startTimer instead
      await expect(client.startTimer('Test')).rejects.toThrow();
    });
  });

  describe('caching', () => {
    it('should cache weekly reports', async () => {
      const mockEntries = [
        {
          id: 1,
          description: 'Work',
          start: '2026-02-10T08:00:00Z',
          stop: '2026-02-10T10:00:00Z',
          duration: 7200,
          project_id: undefined,
          tags: [],
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockEntries,
      });

      const report1 = await client.getWeeklyReport();
      const report2 = await client.getWeeklyReport();

      expect(report1).toEqual(report2);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only one API call
    });

    it('should cache projects', async () => {
      const mockProjects = [
        { id: 100, name: 'Project A', color: '#ff0000', active: true },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProjects,
      });

      const projects1 = await client.getProjects();
      const projects2 = await client.getProjects();

      expect(projects1).toEqual(projects2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
