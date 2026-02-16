import { createLogger } from '../../kernel/logger.js';
import type { Logger } from 'pino';

const logger = createLogger('producthunt-client');

export interface PHProduct {
  id: string;
  name: string;
  tagline: string;
  description?: string;
  url: string;
  votesCount: number;
  commentsCount: number;
  topics: string[];
  thumbnail?: string;
  createdAt: string;
}

export interface PHCollection {
  id: string;
  name: string;
  description?: string;
  productsCount: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class ProductHuntClient {
  private readonly accessToken: string;
  private readonly apiUrl = 'https://api.producthunt.com/v2/api/graphql';
  private readonly logger: Logger;
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  constructor(accessToken: string) {
    this.accessToken = accessToken;
    this.logger = logger.child({ integration: 'producthunt' });
  }

  async getTodayProducts(limit = 10): Promise<PHProduct[]> {
    const cacheKey = `today-${limit}`;
    const cached = this.getFromCache<PHProduct[]>(cacheKey, 30 * 60 * 1000); // 30 minutes
    if (cached !== undefined) {
      return cached;
    }

    const today = new Date().toISOString().split('T')[0];

    const query = `
      query GetTodayProducts($postedAfter: DateTime!, $first: Int!) {
        posts(order: RANKING, postedAfter: $postedAfter, first: $first) {
          edges {
            node {
              id
              name
              tagline
              description
              url
              votesCount
              commentsCount
              createdAt
              thumbnail {
                url
              }
              topics {
                edges {
                  node {
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const products = await this.queryGraphQL<PHProduct[]>(query, {
        postedAfter: `${today}T00:00:00Z`,
        first: limit,
      });

      this.setCache(cacheKey, products);
      this.logger.info({ count: products.length }, 'Retrieved today\'s products');
      return products;
    } catch (error: unknown) {
      this.logger.error({ error }, 'Failed to get today\'s products');
      throw error;
    }
  }

  async getTopProducts(
    period: 'daily' | 'weekly' | 'monthly' = 'daily',
    limit = 10,
  ): Promise<PHProduct[]> {
    const cacheKey = `top-${period}-${limit}`;
    const cached = this.getFromCache<PHProduct[]>(cacheKey, 30 * 60 * 1000); // 30 minutes
    if (cached !== undefined) {
      return cached;
    }

    const now = new Date();
    let postedAfter: string;

    switch (period) {
      case 'daily':
        postedAfter = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'weekly':
        postedAfter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'monthly':
        postedAfter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
    }

    const query = `
      query GetTopProducts($postedAfter: DateTime!, $first: Int!) {
        posts(order: VOTES, postedAfter: $postedAfter, first: $first) {
          edges {
            node {
              id
              name
              tagline
              description
              url
              votesCount
              commentsCount
              createdAt
              thumbnail {
                url
              }
              topics {
                edges {
                  node {
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const products = await this.queryGraphQL<PHProduct[]>(query, {
        postedAfter,
        first: limit,
      });

      this.setCache(cacheKey, products);
      this.logger.info({ period, count: products.length }, 'Retrieved top products');
      return products;
    } catch (error: unknown) {
      this.logger.error({ error, period }, 'Failed to get top products');
      throw error;
    }
  }

  async searchProducts(query: string, limit = 10): Promise<PHProduct[]> {
    const cacheKey = `search-${query}-${limit}`;
    const cached = this.getFromCache<PHProduct[]>(cacheKey, 30 * 60 * 1000); // 30 minutes
    if (cached !== undefined) {
      return cached;
    }

    const searchQuery = `
      query SearchProducts($query: String!, $first: Int!) {
        posts(order: RANKING, query: $query, first: $first) {
          edges {
            node {
              id
              name
              tagline
              description
              url
              votesCount
              commentsCount
              createdAt
              thumbnail {
                url
              }
              topics {
                edges {
                  node {
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const products = await this.queryGraphQL<PHProduct[]>(searchQuery, {
        query,
        first: limit,
      });

      this.setCache(cacheKey, products);
      this.logger.info({ query, count: products.length }, 'Searched products');
      return products;
    } catch (error: unknown) {
      this.logger.error({ error, query }, 'Failed to search products');
      throw error;
    }
  }

  async getProductsByTopic(topic: string, limit = 10): Promise<PHProduct[]> {
    const cacheKey = `topic-${topic}-${limit}`;
    const cached = this.getFromCache<PHProduct[]>(cacheKey, 30 * 60 * 1000); // 30 minutes
    if (cached !== undefined) {
      return cached;
    }

    const query = `
      query GetProductsByTopic($topic: String!, $first: Int!) {
        posts(order: RANKING, topic: $topic, first: $first) {
          edges {
            node {
              id
              name
              tagline
              description
              url
              votesCount
              commentsCount
              createdAt
              thumbnail {
                url
              }
              topics {
                edges {
                  node {
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const products = await this.queryGraphQL<PHProduct[]>(query, {
        topic,
        first: limit,
      });

      this.setCache(cacheKey, products);
      this.logger.info({ topic, count: products.length }, 'Retrieved products by topic');
      return products;
    } catch (error: unknown) {
      this.logger.error({ error, topic }, 'Failed to get products by topic');
      throw error;
    }
  }

  formatForBriefing(products: PHProduct[]): string {
    if (products.length === 0) {
      return 'No products found.';
    }

    const topProducts = products
      .slice(0, 5)
      .map((p, i) => {
        const topics = p.topics.length > 0 ? ` [${p.topics.slice(0, 3).join(', ')}]` : '';
        return `${i + 1}. ${p.name} - ${p.tagline}\n   ${p.votesCount} votes${topics}`;
      })
      .join('\n\n');

    return `Top Products:\n\n${topProducts}`;
  }

  private async queryGraphQL<T>(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<T> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) {
        throw new Error(`Product Hunt API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as {
        data?: {
          posts?: {
            edges: Array<{
              node: {
                id: string;
                name: string;
                tagline: string;
                description?: string;
                url: string;
                votesCount: number;
                commentsCount: number;
                createdAt: string;
                thumbnail?: { url: string };
                topics: {
                  edges: Array<{ node: { name: string } }>;
                };
              };
            }>;
          };
        };
        errors?: Array<{ message: string }>;
      };

      if (result.errors) {
        throw new Error(`GraphQL errors: ${result.errors.map((e) => e.message).join(', ')}`);
      }

      if (!result.data?.posts?.edges) {
        throw new Error('Invalid GraphQL response: missing posts data');
      }

      const products: PHProduct[] = result.data.posts.edges.map((edge) => ({
        id: edge.node.id,
        name: edge.node.name,
        tagline: edge.node.tagline,
        description: edge.node.description,
        url: edge.node.url,
        votesCount: edge.node.votesCount,
        commentsCount: edge.node.commentsCount,
        topics: edge.node.topics.edges.map((t) => t.node.name),
        thumbnail: edge.node.thumbnail?.url,
        createdAt: edge.node.createdAt,
      }));

      return products as T;
    } catch (error: unknown) {
      this.logger.error({ error }, 'GraphQL query failed');
      throw error;
    }
  }

  private getFromCache<T>(key: string, maxAge: number): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      return undefined;
    }

    const age = Date.now() - entry.timestamp;
    if (age > maxAge) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.data;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }
}
