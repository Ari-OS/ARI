import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitHubClient, type RepoActivity, type GitHubNotification } from '../../../../src/integrations/github/client.js';

// Mock logger
vi.mock('../../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ─── Test Data ──────────────────────────────────────────────────────────────

const MOCK_REPO_RESPONSE = {
  stargazers_count: 42,
  forks_count: 12,
  open_issues_count: 8,
};

const MOCK_COMMITS_RESPONSE = [
  {
    sha: 'abc1234567890',
    commit: {
      message: 'feat: add new feature\n\nDetailed description',
      author: {
        name: 'Pryce Hedrick',
        date: '2026-02-16T10:30:00Z',
      },
    },
  },
  {
    sha: 'def4567890123',
    commit: {
      message: 'fix: resolve bug',
      author: {
        name: 'ARI Bot',
        date: '2026-02-15T14:20:00Z',
      },
    },
  },
  {
    sha: 'ghi7890123456',
    commit: {
      message: 'docs: update README',
      author: {
        name: 'Pryce Hedrick',
        date: '2026-02-14T09:15:00Z',
      },
    },
  },
];

const MOCK_PRS_RESPONSE = [
  { id: 1, title: 'Add feature X' },
  { id: 2, title: 'Fix bug Y' },
];

const MOCK_NOTIFICATIONS_RESPONSE = [
  {
    id: '1',
    reason: 'mention',
    subject: {
      title: 'PR: Add new integration',
      type: 'PullRequest',
      url: 'https://api.github.com/repos/Ari-OS/ARI/pulls/123',
    },
    repository: {
      full_name: 'Ari-OS/ARI',
    },
    updated_at: '2026-02-16T10:00:00Z',
    unread: true,
  },
  {
    id: '2',
    reason: 'author',
    subject: {
      title: 'Issue: Bug in kernel',
      type: 'Issue',
      url: 'https://api.github.com/repos/Ari-OS/ARI/issues/45',
    },
    repository: {
      full_name: 'Ari-OS/ARI',
    },
    updated_at: '2026-02-15T15:30:00Z',
    unread: false,
  },
  {
    id: '3',
    reason: 'subscribed',
    subject: {
      title: 'Discussion: Architecture',
      type: 'Discussion',
      url: 'https://api.github.com/repos/Ari-OS/ARI/discussions/78',
    },
    repository: {
      full_name: 'Ari-OS/ARI',
    },
    updated_at: '2026-02-14T08:00:00Z',
    unread: true,
  },
];

// ─── Mock Fetch ─────────────────────────────────────────────────────────────

function mockFetch(responses: Map<string, unknown>): void {
  global.fetch = vi.fn().mockImplementation((url: string | URL | Request) => {
    const urlStr = url instanceof Request ? url.url : String(url);

    // Match in order of specificity (most specific first)
    const sortedPatterns = Array.from(responses.entries()).sort((a, b) => b[0].length - a[0].length);

    for (const [pattern, response] of sortedPatterns) {
      if (urlStr.includes(pattern)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => response,
        });
      }
    }

    return Promise.resolve({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ message: 'Not found' }),
    });
  });
}

function mockFetchError(message: string): void {
  global.fetch = vi.fn().mockRejectedValue(new Error(message));
}

function mockFetchStatus(status: number): void {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: 'Error',
    json: async () => ({ message: 'API error' }),
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GitHubClient', () => {
  let client: GitHubClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GitHubClient('test-token');
  });

  describe('constructor', () => {
    it('should throw if token is missing', () => {
      expect(() => new GitHubClient('')).toThrow('GitHub token is required');
    });

    it('should create client with valid token', () => {
      expect(client).toBeInstanceOf(GitHubClient);
    });
  });

  describe('getRepoActivity', () => {
    it('should fetch and parse repository activity', async () => {
      mockFetch(new Map([
        ['/repos/Ari-OS/ARI/commits', MOCK_COMMITS_RESPONSE],
        ['/repos/Ari-OS/ARI/pulls', MOCK_PRS_RESPONSE],
        ['/repos/Ari-OS/ARI', MOCK_REPO_RESPONSE],
      ]));

      const activity = await client.getRepoActivity('Ari-OS', 'ARI');

      expect(activity.stars).toBe(42);
      expect(activity.forks).toBe(12);
      expect(activity.openIssues).toBe(8);
      expect(activity.openPRs).toBe(2);
      expect(activity.lastCommit.message).toBe('feat: add new feature');
      expect(activity.lastCommit.author).toBe('Pryce Hedrick');
      expect(activity.lastCommit.date).toBe('2026-02-16T10:30:00Z');
      expect(activity.recentCommits).toHaveLength(3);
      expect(activity.recentCommits[0].sha).toBe('abc1234');
      expect(activity.recentCommits[0].message).toBe('feat: add new feature');
    });

    it('should handle multi-line commit messages', async () => {
      mockFetch(new Map([
        ['/repos/Ari-OS/ARI/commits', MOCK_COMMITS_RESPONSE],
        ['/repos/Ari-OS/ARI/pulls', MOCK_PRS_RESPONSE],
        ['/repos/Ari-OS/ARI', MOCK_REPO_RESPONSE],
      ]));

      const activity = await client.getRepoActivity('Ari-OS', 'ARI');

      expect(activity.lastCommit.message).toBe('feat: add new feature');
      expect(activity.lastCommit.message).not.toContain('\n');
    });

    it('should use cached data within TTL', async () => {
      mockFetch(new Map([
        ['/repos/Ari-OS/ARI/commits', MOCK_COMMITS_RESPONSE],
        ['/repos/Ari-OS/ARI/pulls', MOCK_PRS_RESPONSE],
        ['/repos/Ari-OS/ARI', MOCK_REPO_RESPONSE],
      ]));

      await client.getRepoActivity('Ari-OS', 'ARI');
      await client.getRepoActivity('Ari-OS', 'ARI');

      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should throw on API error', async () => {
      mockFetchStatus(401);

      await expect(client.getRepoActivity('Ari-OS', 'ARI')).rejects.toThrow('Failed to fetch repo activity');
    });

    it('should throw on network error', async () => {
      mockFetchError('Network failure');

      await expect(client.getRepoActivity('Ari-OS', 'ARI')).rejects.toThrow('Failed to fetch repo activity');
    });
  });

  describe('getNotifications', () => {
    it('should fetch and parse all notifications', async () => {
      mockFetch(new Map([
        ['/notifications', MOCK_NOTIFICATIONS_RESPONSE],
      ]));

      const notifications = await client.getNotifications(false);

      expect(notifications).toHaveLength(3);
      expect(notifications[0].id).toBe('1');
      expect(notifications[0].reason).toBe('mention');
      expect(notifications[0].subject.title).toBe('PR: Add new integration');
      expect(notifications[0].subject.type).toBe('PullRequest');
      expect(notifications[0].repository).toBe('Ari-OS/ARI');
      expect(notifications[0].unread).toBe(true);
      expect(notifications[1].unread).toBe(false);
    });

    it('should filter unread notifications when requested', async () => {
      mockFetch(new Map([
        ['/notifications', MOCK_NOTIFICATIONS_RESPONSE],
      ]));

      const notifications = await client.getNotifications(true);

      expect(notifications).toHaveLength(2);
      expect(notifications.every(n => n.unread)).toBe(true);
    });

    it('should use cached data within TTL', async () => {
      mockFetch(new Map([
        ['/notifications', MOCK_NOTIFICATIONS_RESPONSE],
      ]));

      await client.getNotifications();
      await client.getNotifications();

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should filter cached data when requesting unread only', async () => {
      mockFetch(new Map([
        ['/notifications', MOCK_NOTIFICATIONS_RESPONSE],
      ]));

      await client.getNotifications(false);
      const unread = await client.getNotifications(true);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(unread).toHaveLength(2);
    });

    it('should throw on API error', async () => {
      mockFetchStatus(403);

      await expect(client.getNotifications()).rejects.toThrow('Failed to fetch notifications');
    });
  });

  describe('getRecentCommits', () => {
    it('should fetch recent commits with default limit', async () => {
      mockFetch(new Map([
        ['/commits', MOCK_COMMITS_RESPONSE],
      ]));

      const commits = await client.getRecentCommits('Ari-OS', 'ARI');

      expect(commits).toHaveLength(3);
      expect(commits[0].sha).toBe('abc1234');
      expect(commits[0].message).toBe('feat: add new feature');
      expect(commits[0].author).toBe('Pryce Hedrick');
      expect(commits[0].date).toBe('2026-02-16T10:30:00Z');
    });

    it('should respect custom limit', async () => {
      mockFetch(new Map([
        ['/commits', MOCK_COMMITS_RESPONSE.slice(0, 2)],
      ]));

      const commits = await client.getRecentCommits('Ari-OS', 'ARI', 2);

      expect(commits).toHaveLength(2);
      const fetchMock = vi.mocked(global.fetch);
      const callUrl = fetchMock.mock.calls[0][0] as string;
      expect(callUrl).toContain('per_page=2');
    });

    it('should truncate SHA to 7 characters', async () => {
      mockFetch(new Map([
        ['/commits', MOCK_COMMITS_RESPONSE],
      ]));

      const commits = await client.getRecentCommits('Ari-OS', 'ARI');

      expect(commits[0].sha).toHaveLength(7);
    });

    it('should throw on API error', async () => {
      mockFetchStatus(404);

      await expect(client.getRecentCommits('Ari-OS', 'ARI')).rejects.toThrow('Failed to fetch recent commits');
    });
  });

  describe('formatForBriefing', () => {
    it('should format activity and notifications', () => {
      const activity: RepoActivity = {
        stars: 42,
        forks: 12,
        openIssues: 8,
        openPRs: 2,
        lastCommit: {
          message: 'feat: add new feature',
          date: '2026-02-16T10:30:00Z',
          author: 'Pryce Hedrick',
        },
        recentCommits: [
          { sha: 'abc1234', message: 'feat: add new feature', date: '2026-02-16T10:30:00Z' },
          { sha: 'def4567', message: 'fix: resolve bug', date: '2026-02-15T14:20:00Z' },
          { sha: 'ghi7890', message: 'docs: update README', date: '2026-02-14T09:15:00Z' },
        ],
      };

      const notifications: GitHubNotification[] = [
        {
          id: '1',
          reason: 'mention',
          subject: {
            title: 'PR: Add new integration',
            type: 'PullRequest',
            url: 'https://api.github.com/repos/Ari-OS/ARI/pulls/123',
          },
          repository: 'Ari-OS/ARI',
          updatedAt: '2026-02-16T10:00:00Z',
          unread: true,
        },
        {
          id: '2',
          reason: 'author',
          subject: {
            title: 'Issue: Bug in kernel',
            type: 'Issue',
            url: 'https://api.github.com/repos/Ari-OS/ARI/issues/45',
          },
          repository: 'Ari-OS/ARI',
          updatedAt: '2026-02-15T15:30:00Z',
          unread: false,
        },
      ];

      const formatted = client.formatForBriefing(activity, notifications);

      expect(formatted).toContain('42 stars');
      expect(formatted).toContain('12 forks');
      expect(formatted).toContain('8 issues');
      expect(formatted).toContain('2 open PRs');
      expect(formatted).toContain('feat: add new feature');
      expect(formatted).toContain('Pryce Hedrick');
      expect(formatted).toContain('fix: resolve bug');
      expect(formatted).toContain('docs: update README');
      expect(formatted).toContain('2 total, 1 unread');
      expect(formatted).toContain('PR: Add new integration');
      expect(formatted).toContain('Ari-OS/ARI');
    });

    it('should handle no notifications', () => {
      const activity: RepoActivity = {
        stars: 42,
        forks: 12,
        openIssues: 8,
        openPRs: 2,
        lastCommit: {
          message: 'feat: add new feature',
          date: '2026-02-16T10:30:00Z',
          author: 'Pryce Hedrick',
        },
        recentCommits: [],
      };

      const formatted = client.formatForBriefing(activity, []);

      expect(formatted).toContain('42 stars');
      expect(formatted).not.toContain('Notifications:');
    });

    it('should limit recent commits to 3', () => {
      const activity: RepoActivity = {
        stars: 42,
        forks: 12,
        openIssues: 8,
        openPRs: 2,
        lastCommit: {
          message: 'feat: add new feature',
          date: '2026-02-16T10:30:00Z',
          author: 'Pryce Hedrick',
        },
        recentCommits: Array.from({ length: 6 }, (_, i) => ({
          sha: `sha${i}`,
          message: `commit ${i}`,
          date: '2026-02-16T10:30:00Z',
        })),
      };

      const formatted = client.formatForBriefing(activity, []);

      const commitLines = formatted.split('\n').filter(line => /sha\d/.test(line));
      expect(commitLines.length).toBeLessThanOrEqual(3);
    });

    it('should limit notifications display to 3 unread', () => {
      const activity: RepoActivity = {
        stars: 42,
        forks: 12,
        openIssues: 8,
        openPRs: 2,
        lastCommit: {
          message: 'feat: add new feature',
          date: '2026-02-16T10:30:00Z',
          author: 'Pryce Hedrick',
        },
        recentCommits: [],
      };

      const notifications: GitHubNotification[] = Array.from({ length: 5 }, (_, i) => ({
        id: String(i),
        reason: 'mention',
        subject: {
          title: `Notification ${i}`,
          type: 'Issue',
          url: `https://api.github.com/repos/Ari-OS/ARI/issues/${i}`,
        },
        repository: 'Ari-OS/ARI',
        updatedAt: '2026-02-16T10:00:00Z',
        unread: true,
      }));

      const formatted = client.formatForBriefing(activity, notifications);

      expect(formatted).toContain('... and 2 more unread');
    });

    it('should use correct icons for notification types', () => {
      const activity: RepoActivity = {
        stars: 42,
        forks: 12,
        openIssues: 8,
        openPRs: 2,
        lastCommit: {
          message: 'feat: add new feature',
          date: '2026-02-16T10:30:00Z',
          author: 'Pryce Hedrick',
        },
        recentCommits: [],
      };

      const notifications: GitHubNotification[] = [
        {
          id: '1',
          reason: 'mention',
          subject: {
            title: 'PR notification',
            type: 'PullRequest',
            url: 'url',
          },
          repository: 'Ari-OS/ARI',
          updatedAt: '2026-02-16T10:00:00Z',
          unread: true,
        },
        {
          id: '2',
          reason: 'mention',
          subject: {
            title: 'Issue notification',
            type: 'Issue',
            url: 'url',
          },
          repository: 'Ari-OS/ARI',
          updatedAt: '2026-02-16T10:00:00Z',
          unread: true,
        },
      ];

      const formatted = client.formatForBriefing(activity, notifications);

      const lines = formatted.split('\n');
      const prLine = lines.find(l => l.includes('PR notification'));
      const issueLine = lines.find(l => l.includes('Issue notification'));

      expect(prLine).toContain('🔀');
      expect(issueLine).toContain('📝');
    });
  });
});
