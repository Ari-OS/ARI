/**
 * ARI Toggl Track Client
 *
 * Provides time tracking integration with Toggl Track API.
 * Supports starting/stopping timers, retrieving entries, and generating
 * weekly reports for briefings.
 *
 * API: https://api.track.toggl.com/api/v9/
 * Auth: Basic authentication with API token
 *
 * Security: API token loaded from configuration, never logged or exposed.
 */

import { createLogger } from '../../kernel/logger.js';

const logger = createLogger('toggl-client');

// ── Configuration ─────────────────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes for reports and projects
const CACHE_MAX_ENTRIES = 50;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export interface TimeEntry {
  id: number;
  description: string;
  projectId?: number;
  projectName?: string;
  start: Date;
  stop?: Date;
  duration: number; // seconds, negative if running
  tags?: string[];
}

export interface Project {
  id: number;
  name: string;
  color: string;
  active: boolean;
  clientName?: string;
}

export interface WeeklyReport {
  totalSeconds: number;
  projects: Array<{ name: string; seconds: number; percentage: number }>;
  dailyTotals: Array<{ date: string; seconds: number }>;
}

interface TogglTimeEntry {
  id: number;
  description: string;
  project_id?: number;
  start: string;
  stop?: string;
  duration: number;
  tags?: string[];
}

interface TogglProject {
  id: number;
  name: string;
  color: string;
  active: boolean;
  client_name?: string;
}

export class TogglClient {
  private apiToken: string;
  private workspaceId: string;
  private baseUrl = 'https://api.track.toggl.com/api/v9';
  private cache = new Map<string, CacheEntry<unknown>>();
  private projectNameCache = new Map<number, string>();

  constructor(apiToken: string, workspaceId: string) {
    this.apiToken = apiToken;
    this.workspaceId = workspaceId;
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

  // ── HTTP helpers ──────────────────────────────────────────────────────

  private getAuthHeader(): string {
    // Basic auth: base64(apiToken:api_token)
    const credentials = `${this.apiToken}:api_token`;
    return `Basic ${Buffer.from(credentials).toString('base64')}`;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Toggl API error (${response.status}): ${errorText}`);
      }

      const data = await response.json() as T;
      return data;
    } catch (error: unknown) {
      logger.error({ err: error, method, path }, 'Toggl API request failed');
      throw error;
    }
  }

  // ── Timer operations ──────────────────────────────────────────────────

  /**
   * Start a new timer
   */
  async startTimer(
    description: string,
    projectId?: number,
    tags?: string[]
  ): Promise<TimeEntry> {
    logger.info({ description, projectId, tags }, 'Starting timer');

    const body = {
      workspace_id: parseInt(this.workspaceId, 10),
      description,
      start: new Date().toISOString(),
      duration: -1, // Negative means running
      created_with: 'ari',
      ...(projectId ? { project_id: projectId } : {}),
      ...(tags ? { tags } : {}),
    };

    const result = await this.request<TogglTimeEntry>(
      'POST',
      '/me/time_entries',
      body
    );

    return this.mapTimeEntry(result);
  }

  /**
   * Stop the currently running timer, or a specific timer by ID
   */
  async stopTimer(entryId?: number): Promise<TimeEntry> {
    // If no ID provided, get the current timer
    if (!entryId) {
      const current = await this.getCurrentTimer();
      if (!current) {
        throw new Error('No timer currently running');
      }
      entryId = current.id;
    }

    logger.info({ entryId }, 'Stopping timer');

    const result = await this.request<TogglTimeEntry>(
      'PATCH',
      `/me/time_entries/${entryId}/stop`,
      {}
    );

    return this.mapTimeEntry(result);
  }

  /**
   * Get the currently running timer, if any
   */
  async getCurrentTimer(): Promise<TimeEntry | null> {
    try {
      const result = await this.request<TogglTimeEntry | null>(
        'GET',
        '/me/time_entries/current'
      );

      if (!result) {
        return null;
      }

      return this.mapTimeEntry(result);
    } catch (error: unknown) {
      logger.warn({ err: error }, 'No current timer');
      return null;
    }
  }

  // ── Time entry queries ────────────────────────────────────────────────

  /**
   * Get all time entries for today
   */
  async getTodayEntries(): Promise<TimeEntry[]> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    return this.getEntriesInRange(startOfDay, endOfDay);
  }

  /**
   * Get entries in a date range
   */
  private async getEntriesInRange(start: Date, end: Date): Promise<TimeEntry[]> {
    const startStr = start.toISOString();
    const endStr = end.toISOString();

    const results = await this.request<TogglTimeEntry[]>(
      'GET',
      `/me/time_entries?start_date=${startStr}&end_date=${endStr}`
    );

    // Ensure project names are cached
    await this.ensureProjectNames(results);

    return results.map((entry) => this.mapTimeEntry(entry));
  }

  // ── Project operations ────────────────────────────────────────────────

  /**
   * Get all projects in the workspace
   */
  async getProjects(): Promise<Project[]> {
    const cacheKey = `projects:${this.workspaceId}`;
    const cached = this.getCached<Project[]>(cacheKey);
    if (cached) return cached;

    logger.debug({ workspaceId: this.workspaceId }, 'Fetching projects');

    const results = await this.request<TogglProject[]>(
      'GET',
      `/workspaces/${this.workspaceId}/projects`
    );

    const projects = results.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      active: p.active,
      clientName: p.client_name,
    }));

    // Update project name cache
    for (const project of projects) {
      this.projectNameCache.set(project.id, project.name);
    }

    this.setCache(cacheKey, projects);
    return projects;
  }

  // ── Reporting ─────────────────────────────────────────────────────────

  /**
   * Generate a weekly report (last 7 days)
   */
  async getWeeklyReport(): Promise<WeeklyReport> {
    const cacheKey = `weekly-report:${this.workspaceId}`;
    const cached = this.getCached<WeeklyReport>(cacheKey);
    if (cached) return cached;

    logger.debug('Generating weekly report');

    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

    const entries = await this.getEntriesInRange(start, end);

    // Calculate totals
    let totalSeconds = 0;
    const projectTotals = new Map<string, number>();
    const dailyTotals = new Map<string, number>();

    for (const entry of entries) {
      // Skip running timers
      if (entry.duration < 0) continue;

      totalSeconds += entry.duration;

      // Project totals
      const projectName = entry.projectName ?? 'No Project';
      projectTotals.set(projectName, (projectTotals.get(projectName) ?? 0) + entry.duration);

      // Daily totals
      const dateKey = entry.start.toISOString().split('T')[0];
      dailyTotals.set(dateKey, (dailyTotals.get(dateKey) ?? 0) + entry.duration);
    }

    // Build project breakdown
    const projects = Array.from(projectTotals.entries())
      .map(([name, seconds]) => ({
        name,
        seconds,
        percentage: totalSeconds > 0 ? Math.round((seconds / totalSeconds) * 100) : 0,
      }))
      .sort((a, b) => b.seconds - a.seconds);

    // Build daily breakdown
    const daily = Array.from(dailyTotals.entries())
      .map(([date, seconds]) => ({ date, seconds }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const report: WeeklyReport = {
      totalSeconds,
      projects,
      dailyTotals: daily,
    };

    this.setCache(cacheKey, report);
    return report;
  }

  /**
   * Format weekly report for briefing inclusion
   */
  formatForBriefing(report: WeeklyReport): string {
    const hours = Math.floor(report.totalSeconds / 3600);
    const minutes = Math.floor((report.totalSeconds % 3600) / 60);

    let output = `**Time Tracked (Last 7 Days):** ${hours}h ${minutes}m\n\n`;

    if (report.projects.length > 0) {
      output += '**By Project:**\n';
      for (const project of report.projects.slice(0, 5)) {
        const projHours = Math.floor(project.seconds / 3600);
        const projMinutes = Math.floor((project.seconds % 3600) / 60);
        output += `- ${project.name}: ${projHours}h ${projMinutes}m (${project.percentage}%)\n`;
      }
    }

    if (report.dailyTotals.length > 0) {
      output += '\n**Daily Breakdown:**\n';
      for (const day of report.dailyTotals) {
        const dayHours = Math.floor(day.seconds / 3600);
        const dayMinutes = Math.floor((day.seconds % 3600) / 60);
        output += `- ${day.date}: ${dayHours}h ${dayMinutes}m\n`;
      }
    }

    return output;
  }

  // ── Utilities ─────────────────────────────────────────────────────────

  private async ensureProjectNames(entries: TogglTimeEntry[]): Promise<void> {
    const projectIds = new Set<number>();
    for (const entry of entries) {
      if (entry.project_id && !this.projectNameCache.has(entry.project_id)) {
        projectIds.add(entry.project_id);
      }
    }

    if (projectIds.size > 0) {
      await this.getProjects(); // This will populate the cache
    }
  }

  private mapTimeEntry(entry: TogglTimeEntry): TimeEntry {
    return {
      id: entry.id,
      description: entry.description || 'No description',
      projectId: entry.project_id,
      projectName: entry.project_id ? this.projectNameCache.get(entry.project_id) : undefined,
      start: new Date(entry.start),
      stop: entry.stop ? new Date(entry.stop) : undefined,
      duration: entry.duration,
      tags: entry.tags,
    };
  }
}
