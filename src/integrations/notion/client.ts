/**
 * ARI Notion Client Wrapper
 *
 * Provides a simplified interface to Notion API for ARI's notification
 * and logging needs. Handles page creation, database operations, and
 * daily log management.
 *
 * Security: API key loaded from environment, never logged or exposed.
 */

import { Client } from '@notionhq/client';
import type { CreatePageParameters, UpdatePageParameters } from '@notionhq/client/build/src/api-endpoints.js';
import type { NotionConfig } from '../../autonomous/types.js';
import { createLogger } from '../../kernel/logger.js';

const logger = createLogger('notion-client');

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

  constructor(config: NotionConfig) {
    this.config = config;
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

      const response = await this.client.pages.create({
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
      });

      return {
        id: response.id,
        url: (response as unknown as { url: string }).url,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      // Log but don't throw - notification system should be resilient
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

      await this.client.pages.update({
        page_id: pageId,
        properties,
      });

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
      await this.client.blocks.children.append({
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
      });

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
      // Build filter object for Notion API
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let notionFilter: any = undefined;

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
      const response = await this.client.request<{
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
      });

      return response.results.map((p) => {
        const props = p.properties;
        const titleProp = props.Name as { title?: Array<{ plain_text: string }> } | undefined;

        return {
          id: p.id,
          title: titleProp?.title?.[0]?.plain_text ?? 'Untitled',
          priority: ((props.Priority as { select?: { name: string } })?.select?.name) ?? undefined,
          category: ((props.Category as { select?: { name: string } })?.select?.name) ?? undefined,
          status: ((props.Status as { select?: { name: string } })?.select?.name) ?? undefined,
          createdAt: p.created_time,
          url: p.url,
        };
      });
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

      const response = await this.client.pages.create({
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
      });

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
      await this.client.users.me({});
      return true;
    } catch {
      return false;
    }
  }
}
