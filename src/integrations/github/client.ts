/**
 * GitHub Integration
 *
 * Provides repository activity tracking and notification monitoring via GitHub REST API
 * Free tier with personal access token
 *
 * Usage:
 *   const github = new GitHubClient(process.env.GITHUB_TOKEN);
 *   const activity = await github.getRepoActivity('Ari-OS', 'ARI');
 *   const notifications = await github.getNotifications(true);
 */

import { createLogger } from '../../kernel/logger.js';

const log = createLogger('github-client');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RepoActivity {
  stars: number;
  forks: number;
  openIssues: number;
  openPRs: number;
  lastCommit: { message: string; date: string; author: string };
  recentCommits: Array<{ sha: string; message: string; date: string }>;
}

export interface GitHubNotification {
  id: string;
  reason: string;
  subject: { title: string; type: string; url: string };
  repository: string;
  updatedAt: string;
  unread: boolean;
}

interface ApiRepoResponse {
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
}

interface ApiCommitResponse {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
}

interface ApiPullsResponse {
  length: number;
}

interface ApiNotificationResponse {
  id: string;
  reason: string;
  subject: {
    title: string;
    type: string;
    url: string;
  };
  repository: {
    full_name: string;
  };
  updated_at: string;
  unread: boolean;
}

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

// ─── GitHub Client ──────────────────────────────────────────────────────────

export class GitHubClient {
  private token: string;
  private baseUrl = 'https://api.github.com';
  private cacheTtlMs = 10 * 60 * 1000; // 10 minutes
  private activityCache: Map<string, CacheEntry<RepoActivity>> = new Map();
  private notificationsCache: CacheEntry<GitHubNotification[]> | null = null;

  constructor(token: string) {
    if (!token) {
      throw new Error('GitHub token is required');
    }
    this.token = token;
  }

  /**
   * Get repository activity statistics
   */
  async getRepoActivity(owner: string, repo: string): Promise<RepoActivity> {
    const cacheKey = `${owner}/${repo}`;
    const cached = this.activityCache.get(cacheKey);

    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      log.debug(`Using cached activity for ${cacheKey}`);
      return cached.data;
    }

    try {
      const headers = {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      };

      // Fetch repo metadata
      const repoUrl = `${this.baseUrl}/repos/${owner}/${repo}`;
      const repoResponse = await fetch(repoUrl, { headers });

      if (!repoResponse.ok) {
        throw new Error(`GitHub API error: ${repoResponse.status} ${repoResponse.statusText}`);
      }

      const repoData = await repoResponse.json() as ApiRepoResponse;

      // Fetch recent commits
      const commitsUrl = `${this.baseUrl}/repos/${owner}/${repo}/commits?per_page=10`;
      const commitsResponse = await fetch(commitsUrl, { headers });

      if (!commitsResponse.ok) {
        throw new Error(`GitHub API error: ${commitsResponse.status} ${commitsResponse.statusText}`);
      }

      const commitsData = await commitsResponse.json() as ApiCommitResponse[];

      // Fetch open PRs
      const prsUrl = `${this.baseUrl}/repos/${owner}/${repo}/pulls?state=open`;
      const prsResponse = await fetch(prsUrl, { headers });

      if (!prsResponse.ok) {
        throw new Error(`GitHub API error: ${prsResponse.status} ${prsResponse.statusText}`);
      }

      const prsData = await prsResponse.json() as ApiPullsResponse;

      const activity: RepoActivity = {
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        openIssues: repoData.open_issues_count,
        openPRs: prsData.length,
        lastCommit: {
          message: commitsData[0].commit.message.split('\n')[0],
          date: commitsData[0].commit.author.date,
          author: commitsData[0].commit.author.name,
        },
        recentCommits: commitsData.slice(0, 5).map(commit => ({
          sha: commit.sha.substring(0, 7),
          message: commit.commit.message.split('\n')[0],
          date: commit.commit.author.date,
        })),
      };

      this.activityCache.set(cacheKey, { data: activity, fetchedAt: Date.now() });
      log.info(`Fetched activity for ${cacheKey}: ${activity.stars} stars, ${activity.openPRs} open PRs`);
      return activity;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to fetch repo activity for ${owner}/${repo}: ${message}`);
      throw new Error(`Failed to fetch repo activity: ${message}`);
    }
  }

  /**
   * Get GitHub notifications
   */
  async getNotifications(unreadOnly: boolean = false): Promise<GitHubNotification[]> {
    const cached = this.notificationsCache;

    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      log.debug('Using cached notifications');
      const data = unreadOnly ? cached.data.filter(n => n.unread) : cached.data;
      return data;
    }

    try {
      const headers = {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      };

      const url = `${this.baseUrl}/notifications?all=${!unreadOnly}`;
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as ApiNotificationResponse[];

      const notifications: GitHubNotification[] = data.map(notification => ({
        id: notification.id,
        reason: notification.reason,
        subject: {
          title: notification.subject.title,
          type: notification.subject.type,
          url: notification.subject.url,
        },
        repository: notification.repository.full_name,
        updatedAt: notification.updated_at,
        unread: notification.unread,
      }));

      this.notificationsCache = { data: notifications, fetchedAt: Date.now() };
      log.info(`Fetched ${notifications.length} notifications (${notifications.filter(n => n.unread).length} unread)`);
      return unreadOnly ? notifications.filter(n => n.unread) : notifications;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to fetch GitHub notifications: ${message}`);
      throw new Error(`Failed to fetch notifications: ${message}`);
    }
  }

  /**
   * Get recent commits for a repository
   */
  async getRecentCommits(
    owner: string,
    repo: string,
    limit: number = 5
  ): Promise<Array<{ sha: string; message: string; date: string; author: string }>> {
    try {
      const headers = {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      };

      const url = `${this.baseUrl}/repos/${owner}/${repo}/commits?per_page=${limit}`;
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as ApiCommitResponse[];

      const commits = data.map(commit => ({
        sha: commit.sha.substring(0, 7),
        message: commit.commit.message.split('\n')[0],
        date: commit.commit.author.date,
        author: commit.commit.author.name,
      }));

      log.info(`Fetched ${commits.length} recent commits for ${owner}/${repo}`);
      return commits;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to fetch recent commits for ${owner}/${repo}: ${message}`);
      throw new Error(`Failed to fetch recent commits: ${message}`);
    }
  }

  /**
   * Format GitHub data for briefing display
   */
  formatForBriefing(activity: RepoActivity, notifications: GitHubNotification[]): string {
    const lines: string[] = [];

    // Repository activity
    lines.push('📊 Repository Activity:');
    lines.push(`  ⭐ ${activity.stars} stars | 🍴 ${activity.forks} forks`);
    lines.push(`  📝 ${activity.openIssues} issues | 🔀 ${activity.openPRs} open PRs`);
    lines.push('');
    lines.push(`📌 Latest commit: ${activity.lastCommit.message}`);
    lines.push(`   by ${activity.lastCommit.author} on ${new Date(activity.lastCommit.date).toLocaleDateString()}`);

    if (activity.recentCommits.length > 1) {
      lines.push('');
      lines.push('📜 Recent commits:');
      for (const commit of activity.recentCommits.slice(1, 4)) {
        const date = new Date(commit.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
        lines.push(`  ${commit.sha} ${commit.message} (${date})`);
      }
    }

    if (notifications.length > 0) {
      const unreadCount = notifications.filter(n => n.unread).length;
      lines.push('');
      lines.push(`🔔 Notifications: ${notifications.length} total, ${unreadCount} unread`);
      const unread = notifications.filter(n => n.unread).slice(0, 3);
      for (const notification of unread) {
        const icon = notification.subject.type === 'PullRequest' ? '🔀' : '📝';
        lines.push(`  ${icon} ${notification.subject.title} (${notification.repository})`);
      }
      if (unreadCount > 3) {
        lines.push(`  ... and ${unreadCount - 3} more unread`);
      }
    }

    return lines.join('\n');
  }
}
