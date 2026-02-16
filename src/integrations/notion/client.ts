/**
 * ARI Notion Client Wrapper
 *
 * Provides a simplified interface to Notion API for ARI's notification
 * and logging needs. Handles page creation, database operations, and
 * daily log management.
 *
 * Includes exponential backoff retry for transient failures and
 * TTL-based query caching to reduce API calls.
 *
 * Security: API key loaded from environment, never logged or exposed.
 */

import { Client } from '@notionhq/client';
import type { CreatePageParameters, UpdatePageParameters } from '@notionhq/client/build/src/api-endpoints.js';
import type { NotionConfig } from '../../autonomous/types.js';
import { createLogger } from '../../kernel/logger.js';

const logger = createLogger('notion-client');

// ── Retry configuration ───────────────────────────────────────────────
const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 10_000;
const TRANSIENT_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

// ── Cache configuration ───────────────────────────────────────────────
const CACHE_TTL_MS = 60_000; // 1 minute
const CACHE_MAX_ENTRIES = 100;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const status = (error as unknown as { status?: number }).status;
    if (status && TRANSIENT_STATUS_CODES.has(status)) return true;
    if (error.name === 'TimeoutError') return true;
    if (error.message.includes('ECONNRESET')) return true;
    if (error.message.includes('ETIMEDOUT')) return true;
    if (error.message.includes('fetch failed')) return true;
  }
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface NotionPageContent {
  title: string;
  body: string;
  priority?: string;
  category?: string;
  status?: 'unread' | 'read' | 'archived';
  properties?: Record<string, unknown>;
}

export interface NotionDatabaseEntry {
  id: string;
  title: string;
  priority?: string;
  category?: string;
  status?: string;
  createdAt: string;
  url: string;
}

export class NotionClient {
  private client: Client | null = null;
  private config: NotionConfig;
  private initialized = false;
  private queryCache = new Map<string, CacheEntry<unknown>>();

  constructor(config: NotionConfig) {
    this.config = config;
  }

  // ── Retry with exponential backoff ────────────────────────────────────

  private async withRetry<T>(
    operation: () => Promise<T>,
    label: string,
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < RETRY_MAX_ATTEMPTS; attempt++) {
      try {
        return await operation();
      } catch (error: unknown) {
        lastError = error;

        if (!isTransientError(error) || attempt === RETRY_MAX_ATTEMPTS - 1) {
          throw error;
        }

        // Exponential backoff with jitter
        const delay = Math.min(
          RETRY_BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 200,
          RETRY_MAX_DELAY_MS,
        );
        logger.warn(
          { attempt: attempt + 1, maxAttempts: RETRY_MAX_ATTEMPTS, delayMs: Math.round(delay) },
          `Retrying ${label} after transient failure`,
        );
        await sleep(delay);
      }
    }

    throw lastError;
  }

  // ── Query cache ──────────────────────────────────────────────────────

  private getCached<T>(key: string): T | undefined {
    const entry = this.queryCache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.queryCache.delete(key);
      return undefined;
    }
    return entry.data as T;
  }

  private setCache<T>(key: string, data: T): void {
    // Evict oldest entries if at capacity
    if (this.queryCache.size >= CACHE_MAX_ENTRIES) {
      const firstKey = this.queryCache.keys().next().value as string;
      this.queryCache.delete(firstKey);
    }
    this.queryCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  private invalidateCache(databaseId: string): void {
    for (const key of this.queryCache.keys()) {
      if (key.startsWith(`query:${databaseId}`)) {
        this.queryCache.delete(key);
      }
    }
  }

  clearCache(): void {
    this.queryCache.clear();
  }

  /**
   * Initialize the Notion client with API key
   */
  init(): boolean {
    if (!this.config.enabled || !this.config.apiKey) {
      return false;
    }

    try {
      this.client = new Client({
        auth: this.config.apiKey,
      });
      this.initialized = true;
      return true;
    } catch {
      this.initialized = false;
      return false;
    }
  }

  /**
   * Check if client is ready
   */
  isReady(): boolean {
    return this.initialized && this.client !== null;
  }

  /**
   * Create a page in a database (for inbox entries)
   */
  async createDatabaseEntry(
    databaseId: string,
    content: NotionPageContent
  ): Promise<{ id: string; url: string } | null> {
    if (!this.isReady() || !this.client) {
      return null;
    }

    try {
      const properties: CreatePageParameters['properties'] = {
        Name: {
          title: [
            {
              text: { content: content.title.slice(0, 100) },
            },
          ],
        },
      };

      // Add priority if database has it
      if (content.priority) {
        properties.Priority = {
          select: { name: content.priority },
        };
      }

      // Add category if database has it
      if (content.category) {
        properties.Category = {
          select: { name: content.category },
        };
      }

      // Add status if database has it
      if (content.status) {
        properties.Status = {
          select: { name: content.status },
        };
      }

      const response = await this.withRetry(
        () => this.client!.pages.create({
          parent: { database_id: databaseId },
          properties,
          children: [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  {
                    type: 'text',
                    text: { content: content.body.slice(0, 2000) },
                  },
                ],
              },
            },
            {
              object: 'block',
              type: 'divider',
              divider: {},
            },
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  {
                    type: 'text',
                    text: { content: `Created by ARI at ${new Date().toISOString()}` },
                    annotations: { italic: true, color: 'gray' },
                  },
                ],
              },
            },
          ],
        }),
        'createDatabaseEntry',
      );

      // Invalidate cached queries for this database
      this.invalidateCache(databaseId);

      return {
        id: response.id,
        url: (response as unknown as { url: string }).url,
      };
    } catch (error: unknown) {
      logger.error({ err: error }, 'Failed to create database entry');
      return null;
    }
  }

  /**
   * Update a page's properties
   */
  async updatePage(
    pageId: string,
    updates: { status?: string; priority?: string }
  ): Promise<boolean> {
    if (!this.isReady() || !this.client) {
      return false;
    }

    try {
      const properties: UpdatePageParameters['properties'] = {};

      if (updates.status) {
        properties.Status = {
          select: { name: updates.status },
        };
      }

      if (updates.priority) {
        properties.Priority = {
          select: { name: updates.priority },
        };
      }

      await this.withRetry(
        () => this.client!.pages.update({
          page_id: pageId,
          properties,
        }),
        'updatePage',
      );

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Append content to an existing page
   */
  async appendToPage(pageId: string, content: string): Promise<boolean> {
    if (!this.isReady() || !this.client) {
      return false;
    }

    try {
      await this.withRetry(
        () => this.client!.blocks.children.append({
          block_id: pageId,
          children: [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  {
                    type: 'text',
                    text: { content },
                  },
                ],
              },
            },
          ],
        }),
        'appendToPage',
      );

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Query a database for entries using low-level request API
   * (SDK v5+ moved databases.query to dataSources.query)
   */
  async queryDatabase(
    databaseId: string,
    filter?: {
      status?: string;
      priority?: string;
      createdAfter?: Date;
    }
  ): Promise<NotionDatabaseEntry[]> {
    if (!this.isReady() || !this.client) {
      return [];
    }

    try {
      // Check cache first
      const cacheKey = `query:${databaseId}:${JSON.stringify(filter ?? {})}`;
      const cached = this.getCached<NotionDatabaseEntry[]>(cacheKey);
      if (cached) return cached;

      // Build filter object for Notion API
      let notionFilter: unknown = undefined;

      if (filter) {
        const conditions: unknown[] = [];

        if (filter.status) {
          conditions.push({
            property: 'Status',
            select: { equals: filter.status },
          });
        }

        if (filter.priority) {
          conditions.push({
            property: 'Priority',
            select: { equals: filter.priority },
          });
        }

        if (filter.createdAfter) {
          conditions.push({
            property: 'Created',
            date: { after: filter.createdAfter.toISOString() },
          });
        }

        if (conditions.length === 1) {
          notionFilter = conditions[0];
        } else if (conditions.length > 1) {
          notionFilter = { and: conditions };
        }
      }

      // Use low-level request API since SDK v5 changed the method location
      const response = await this.withRetry(
        () => this.client!.request<{
          results: Array<{
            id: string;
            created_time: string;
            url: string;
            properties: Record<string, unknown>;
          }>;
        }>({
          path: `databases/${databaseId}/query`,
          method: 'post',
          body: {
            filter: notionFilter,
            sorts: [
              {
                timestamp: 'created_time',
                direction: 'descending',
              },
            ],
          },
        }),
        'queryDatabase',
      );

      const results = response.results.map((p) => {
        const props = p.properties;
        const titleProp = props.Name as { title?: Array<{ plain_text: string }> } | undefined;
        // Also check 'Task name' for task databases
        const taskNameProp = props['Task name'] as { title?: Array<{ plain_text: string }> } | undefined;

        return {
          id: p.id,
          title: titleProp?.title?.[0]?.plain_text ?? taskNameProp?.title?.[0]?.plain_text ?? 'Untitled',
          priority: ((props.Priority as { select?: { name: string } })?.select?.name) ?? undefined,
          category: ((props.Category as { select?: { name: string } })?.select?.name) ?? undefined,
          status: ((props.Status as { select?: { name: string } })?.select?.name)
            ?? ((props.Status as { status?: { name: string } })?.status?.name)
            ?? undefined,
          createdAt: p.created_time,
          url: p.url,
        };
      });

      this.setCache(cacheKey, results);
      return results;
    } catch {
      return [];
    }
  }

  /**
   * Create a daily log page under a parent page
   */
  async createDailyLogPage(
    parentId: string,
    date: Date,
    content: {
      summary: string;
      highlights: string[];
      issues: string[];
      metrics?: Record<string, string | number>;
    }
  ): Promise<{ id: string; url: string } | null> {
    if (!this.isReady() || !this.client) {
      return null;
    }

    try {
      const dateStr = date.toISOString().split('T')[0];
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });

      const children: CreatePageParameters['children'] = [
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: 'Summary' } }],
          },
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: content.summary } }],
          },
        },
      ];

      // Add highlights
      if (content.highlights.length > 0) {
        children.push({
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: 'Highlights' } }],
          },
        });

        for (const highlight of content.highlights) {
          children.push({
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [{ type: 'text', text: { content: highlight } }],
            },
          });
        }
      }

      // Add issues
      if (content.issues.length > 0) {
        children.push({
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: 'Issues' } }],
          },
        });

        for (const issue of content.issues) {
          children.push({
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [{ type: 'text', text: { content: issue } }],
            },
          });
        }
      }

      // Add metrics if provided
      if (content.metrics && Object.keys(content.metrics).length > 0) {
        children.push({
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: 'Metrics' } }],
          },
        });

        children.push({
          object: 'block',
          type: 'code',
          code: {
            rich_text: [
              {
                type: 'text',
                text: { content: JSON.stringify(content.metrics, null, 2) },
              },
            ],
            language: 'json',
          },
        });
      }

      const response = await this.withRetry(
        () => this.client!.pages.create({
          parent: { page_id: parentId },
          properties: {
            title: {
              title: [
                {
                  text: { content: `${dateStr} - ${dayName}` },
                },
              ],
            },
          },
          children,
        }),
        'createDailyLogPage',
      );

      return {
        id: response.id,
        url: (response as unknown as { url: string }).url,
      };
    } catch {
      return null;
    }
  }

  /**
   * Test connection to Notion
   */
  async testConnection(): Promise<boolean> {
    if (!this.isReady() || !this.client) {
      return false;
    }

    try {
      await this.withRetry(() => this.client!.users.me({}), 'testConnection');
      return true;
    } catch {
      return false;
    }
  }

  // ── Task Management ───────────────────────────────────────────────────

  /**
   * Create a task in the tasks database
   */
  async createTask(
    databaseId: string,
    task: {
      name: string;
      priority?: 'High' | 'Medium' | 'Low';
      description?: string;
      dueDate?: Date;
    }
  ): Promise<{ id: string; url: string } | null> {
    if (!this.isReady() || !this.client) {
      return null;
    }

    try {
      const properties: CreatePageParameters['properties'] = {
        'Task name': {
          title: [{ text: { content: task.name.slice(0, 100) } }],
        },
        Status: {
          status: { name: 'Not started' },
        },
      };

      if (task.priority) {
        properties.Priority = {
          select: { name: task.priority },
        };
      }

      if (task.dueDate) {
        properties['Due date'] = {
          date: { start: task.dueDate.toISOString().split('T')[0] },
        };
      }

      const children: CreatePageParameters['children'] = [];
      if (task.description) {
        children.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: task.description.slice(0, 2000) } }],
          },
        });
      }

      const response = await this.withRetry(
        () => this.client!.pages.create({
          parent: { database_id: databaseId },
          properties,
          ...(children.length > 0 ? { children } : {}),
        }),
        'createTask',
      );

      this.invalidateCache(databaseId);

      return {
        id: response.id,
        url: (response as unknown as { url: string }).url,
      };
    } catch (error: unknown) {
      logger.error({ err: error }, 'Failed to create task');
      return null;
    }
  }

  /**
   * Update a task's status
   */
  async updateTaskStatus(
    pageId: string,
    status: 'Not started' | 'In progress' | 'Done'
  ): Promise<boolean> {
    if (!this.isReady() || !this.client) {
      return false;
    }

    try {
      await this.withRetry(
        () => this.client!.pages.update({
          page_id: pageId,
          properties: {
            Status: { status: { name: status } },
          },
        }),
        'updateTaskStatus',
      );
      return true;
    } catch {
      return false;
    }
  }
}
