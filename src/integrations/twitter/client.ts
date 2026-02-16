/**
 * ARI X/Twitter Client
 *
 * Reads user's liked tweets and curated list feeds via X API v2.
 * Used by the intelligence scanner to understand what Pryce finds
 * interesting and surface relevant content in the daily digest.
 *
 * API: X API v2 (Free tier: 10K reads/month)
 * Auth: OAuth 2.0 Bearer Token
 *
 * Required env:
 * - X_BEARER_TOKEN: App-level bearer token from developer.x.com
 * - X_USER_ID: Pryce's X user ID (numeric)
 */

import { createLogger } from '../../kernel/logger.js';

const log = createLogger('twitter-client');

const X_API_BASE = 'https://api.x.com/2';

// ─── Security: Redact sensitive data from error responses ────────────────────

/**
 * Sanitize error response body before logging.
 * Removes potential token fragments and sensitive data.
 */
function sanitizeErrorBody(body: string): string {
  return body
    // Redact bearer tokens
    .replace(/Bearer\s+[\w-]+/gi, 'Bearer [REDACTED]')
    // Redact API keys
    .replace(/api[_-]?key["']?\s*[:=]\s*["']?[\w-]+/gi, 'api_key: [REDACTED]')
    // Redact tokens in JSON
    .replace(/"(token|key|secret|password|bearer)":\s*"[^"]+"/gi, '"$1": "[REDACTED]"')
    // Redact authorization headers
    .replace(/authorization["']?\s*[:=]\s*["']?[^"',}\s]+/gi, 'authorization: [REDACTED]')
    // Limit length to prevent log bloat
    .slice(0, 500);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface XClientConfig {
  enabled: boolean;
  bearerToken?: string;
  userId?: string;
  maxLikesPerFetch?: number;
  rateLimitPerMonth?: number;
}

export interface XTweet {
  id: string;
  text: string;
  authorId: string;
  authorUsername?: string;
  authorName?: string;
  createdAt: string;
  urls: string[];
  hashtags: string[];
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
  };
  referencedTweets?: Array<{ type: string; id: string }>;
}

export interface XFetchResult {
  tweets: XTweet[];
  fetchedAt: string;
  source: 'likes' | 'list' | 'search';
  paginationToken?: string;
  rateLimitRemaining?: number;
}

export interface XPostResult {
  id: string;
  text: string;
}

export interface XThreadResult {
  ids: string[];
  texts: string[];
}

interface XApiResponse {
  data?: Array<{
    id: string;
    text: string;
    author_id?: string;
    created_at?: string;
    entities?: {
      urls?: Array<{ expanded_url: string }>;
      hashtags?: Array<{ tag: string }>;
    };
    public_metrics?: {
      like_count: number;
      retweet_count: number;
      reply_count: number;
      impression_count: number;
    };
    referenced_tweets?: Array<{ type: string; id: string }>;
  }>;
  includes?: {
    users?: Array<{
      id: string;
      username: string;
      name: string;
    }>;
  };
  meta?: {
    next_token?: string;
    result_count?: number;
  };
  errors?: Array<{ message: string; type: string }>;
}

// ─── Client ──────────────────────────────────────────────────────────────────

export class XClient {
  private config: XClientConfig;
  private requestCount = 0;
  private lastReset = Date.now();
  private initialized = false;

  constructor(config: XClientConfig) {
    this.config = {
      ...config,
      maxLikesPerFetch: config.maxLikesPerFetch ?? 50,
      rateLimitPerMonth: config.rateLimitPerMonth ?? 10000,
    };
  }

  /**
   * Initialize and validate credentials
   */
  async init(): Promise<boolean> {
    if (!this.config.enabled || !this.config.bearerToken || !this.config.userId) {
      log.info('X client disabled or missing credentials');
      return false;
    }

    try {
      // Validate by fetching user info
      const response = await this.apiCall(`/users/${this.config.userId}`, {
        'user.fields': 'id,username,name',
      });

      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        this.initialized = true;
        log.info({ userId: this.config.userId }, 'X client initialized');
        return true;
      }

      // Single user lookup returns data as object, not array
      if (response.data) {
        this.initialized = true;
        return true;
      }

      return false;
    } catch (error) {
      log.error({ err: error }, 'Failed to initialize X client');
      return false;
    }
  }

  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Fetch user's liked tweets
   */
  async fetchLikes(maxResults?: number): Promise<XFetchResult> {
    if (!this.isReady()) {
      return { tweets: [], fetchedAt: new Date().toISOString(), source: 'likes' };
    }

    const limit = Math.min(maxResults ?? this.config.maxLikesPerFetch ?? 50, 100);

    const response = await this.apiCall(
      `/users/${this.config.userId}/liked_tweets`,
      {
        max_results: String(limit),
        'tweet.fields': 'created_at,public_metrics,entities,referenced_tweets,author_id',
        'user.fields': 'username,name',
        expansions: 'author_id',
      }
    );

    return this.parseResponse(response, 'likes');
  }

  /**
   * Fetch tweets from a curated list
   */
  async fetchList(listId: string, maxResults?: number): Promise<XFetchResult> {
    if (!this.isReady()) {
      return { tweets: [], fetchedAt: new Date().toISOString(), source: 'list' };
    }

    const limit = Math.min(maxResults ?? 50, 100);

    const response = await this.apiCall(
      `/lists/${listId}/tweets`,
      {
        max_results: String(limit),
        'tweet.fields': 'created_at,public_metrics,entities,referenced_tweets,author_id',
        'user.fields': 'username,name',
        expansions: 'author_id',
      }
    );

    return this.parseResponse(response, 'list');
  }

  /**
   * Search recent tweets by keywords
   */
  async searchRecent(query: string, maxResults?: number): Promise<XFetchResult> {
    if (!this.isReady()) {
      return { tweets: [], fetchedAt: new Date().toISOString(), source: 'search' };
    }

    const limit = Math.min(maxResults ?? 25, 100);

    const response = await this.apiCall(
      '/tweets/search/recent',
      {
        query,
        max_results: String(limit),
        'tweet.fields': 'created_at,public_metrics,entities,referenced_tweets,author_id',
        'user.fields': 'username,name',
        expansions: 'author_id',
      }
    );

    return this.parseResponse(response, 'search');
  }

  // ─── Write Methods (require OAuth 2.0 User Context or OAuth 1.0a) ──────

  async postTweet(text: string): Promise<XPostResult> {
    if (!this.isReady()) {
      throw new Error('X client not initialized');
    }

    const response = await this.apiPost('/tweets', { text });
    const data = response.data as { id?: string; text?: string } | undefined;
    return {
      id: data?.id ?? '',
      text: data?.text ?? text,
    };
  }

  async postThread(tweets: string[]): Promise<XThreadResult> {
    if (!this.isReady()) {
      throw new Error('X client not initialized');
    }
    if (tweets.length === 0) {
      return { ids: [], texts: [] };
    }

    const ids: string[] = [];
    const texts: string[] = [];
    let replyToId: string | undefined;

    for (const text of tweets) {
      const body: Record<string, unknown> = { text };
      if (replyToId) {
        body.reply = { in_reply_to_tweet_id: replyToId };
      }

      const response = await this.apiPost('/tweets', body);
      const data = response.data as { id?: string; text?: string } | undefined;
      const tweetId = data?.id ?? '';
      ids.push(tweetId);
      texts.push(data?.text ?? text);
      replyToId = tweetId;
    }

    return { ids, texts };
  }

  async deleteTweet(tweetId: string): Promise<boolean> {
    if (!this.isReady()) {
      throw new Error('X client not initialized');
    }

    const response = await this.apiDelete(`/tweets/${tweetId}`);
    const data = response.data as { deleted?: boolean } | undefined;
    return data?.deleted ?? false;
  }

  /**
   * Reply to a tweet
   */
  async replyToTweet(tweetId: string, text: string): Promise<XPostResult> {
    if (!this.isReady()) {
      throw new Error('X client not initialized');
    }

    const body = {
      text,
      reply: { in_reply_to_tweet_id: tweetId },
    };

    const response = await this.apiPost('/tweets', body);
    const data = response.data as { id?: string; text?: string } | undefined;
    return {
      id: data?.id ?? '',
      text: data?.text ?? text,
    };
  }

  /**
   * Like a tweet
   */
  async likeTweet(tweetId: string): Promise<boolean> {
    if (!this.isReady()) {
      throw new Error('X client not initialized');
    }

    const response = await this.apiPost(`/users/${this.config.userId}/likes`, {
      tweet_id: tweetId,
    });
    const data = response.data as { liked?: boolean } | undefined;
    return data?.liked ?? false;
  }

  /**
   * Bookmark a tweet
   */
  async bookmarkTweet(tweetId: string): Promise<boolean> {
    if (!this.isReady()) {
      throw new Error('X client not initialized');
    }

    const response = await this.apiPost(`/users/${this.config.userId}/bookmarks`, {
      tweet_id: tweetId,
    });
    const data = response.data as { bookmarked?: boolean } | undefined;
    return data?.bookmarked ?? false;
  }

  /**
   * Get a user's recent tweets by username
   */
  async getUserTimeline(username: string, maxResults?: number): Promise<XFetchResult> {
    if (!this.isReady()) {
      return { tweets: [], fetchedAt: new Date().toISOString(), source: 'list' };
    }

    // First get user ID from username
    const userResponse = await this.apiCall(`/users/by/username/${username}`, {});
    const userData = userResponse.data as Array<{ id?: string }> | undefined;
    const userId = userData?.[0]?.id ?? (userResponse as unknown as { data?: { id?: string } })?.data?.id;

    if (!userId) {
      log.warn({ username }, 'User not found');
      return { tweets: [], fetchedAt: new Date().toISOString(), source: 'list' };
    }

    // Then get their tweets
    const response = await this.apiCall(`/users/${userId}/tweets`, {
      max_results: String(maxResults ?? 10),
      'tweet.fields': 'created_at,public_metrics,entities,referenced_tweets',
      expansions: 'author_id',
      'user.fields': 'username,name',
    });

    return this.parseResponse(response, 'list');
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private async apiPost(
    endpoint: string,
    body: Record<string, unknown>
  ): Promise<XApiResponse> {
    if (this.requestCount >= (this.config.rateLimitPerMonth ?? 10000)) {
      const elapsed = Date.now() - this.lastReset;
      if (elapsed < 30 * 24 * 60 * 60 * 1000) {
        log.warn('Monthly rate limit reached');
        return {};
      }
      this.requestCount = 0;
      this.lastReset = Date.now();
    }

    const url = `${X_API_BASE}${endpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.bearerToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ARI-Content-Engine/1.0',
      },
      body: JSON.stringify(body),
    });

    this.requestCount++;

    if (!response.ok) {
      const text = await response.text();
      log.error({ status: response.status, body: sanitizeErrorBody(text) }, 'X API POST error');
      throw new Error(`X API POST ${endpoint} failed: ${response.status}`);
    }

    return (await response.json()) as XApiResponse;
  }

  private async apiDelete(endpoint: string): Promise<XApiResponse> {
    if (this.requestCount >= (this.config.rateLimitPerMonth ?? 10000)) {
      const elapsed = Date.now() - this.lastReset;
      if (elapsed < 30 * 24 * 60 * 60 * 1000) {
        log.warn('Monthly rate limit reached');
        return {};
      }
      this.requestCount = 0;
      this.lastReset = Date.now();
    }

    const url = `${X_API_BASE}${endpoint}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.config.bearerToken}`,
        'User-Agent': 'ARI-Content-Engine/1.0',
      },
    });

    this.requestCount++;

    if (!response.ok) {
      const text = await response.text();
      log.error({ status: response.status, body: sanitizeErrorBody(text) }, 'X API DELETE error');
      throw new Error(`X API DELETE ${endpoint} failed: ${response.status}`);
    }

    return (await response.json()) as XApiResponse;
  }

  private async apiCall(
    endpoint: string,
    params: Record<string, string>
  ): Promise<XApiResponse> {
    // Check rate limit
    if (this.requestCount >= (this.config.rateLimitPerMonth ?? 10000)) {
      const elapsed = Date.now() - this.lastReset;
      if (elapsed < 30 * 24 * 60 * 60 * 1000) {
        log.warn('Monthly rate limit reached');
        return {};
      }
      this.requestCount = 0;
      this.lastReset = Date.now();
    }

    const url = new URL(`${X_API_BASE}${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.config.bearerToken}`,
        'User-Agent': 'ARI-Intelligence-Scanner/1.0',
      },
    });

    this.requestCount++;

    if (!response.ok) {
      const text = await response.text();
      log.error({ status: response.status, body: sanitizeErrorBody(text) }, 'X API error');
      return {};
    }

    return (await response.json()) as XApiResponse;
  }

  private parseResponse(response: XApiResponse, source: 'likes' | 'list' | 'search'): XFetchResult {
    if (!response.data || !Array.isArray(response.data)) {
      return { tweets: [], fetchedAt: new Date().toISOString(), source };
    }

    // Build user lookup map
    const userMap = new Map<string, { username: string; name: string }>();
    if (response.includes?.users) {
      for (const user of response.includes.users) {
        userMap.set(user.id, { username: user.username, name: user.name });
      }
    }

    const tweets: XTweet[] = response.data.map((tweet) => {
      const author = tweet.author_id ? userMap.get(tweet.author_id) : undefined;

      return {
        id: tweet.id,
        text: tweet.text,
        authorId: tweet.author_id ?? 'unknown',
        authorUsername: author?.username,
        authorName: author?.name,
        createdAt: tweet.created_at ?? new Date().toISOString(),
        urls: tweet.entities?.urls?.map((u) => u.expanded_url) ?? [],
        hashtags: tweet.entities?.hashtags?.map((h) => h.tag) ?? [],
        metrics: {
          likes: tweet.public_metrics?.like_count ?? 0,
          retweets: tweet.public_metrics?.retweet_count ?? 0,
          replies: tweet.public_metrics?.reply_count ?? 0,
          impressions: tweet.public_metrics?.impression_count ?? 0,
        },
        referencedTweets: tweet.referenced_tweets,
      };
    });

    return {
      tweets,
      fetchedAt: new Date().toISOString(),
      source,
      paginationToken: response.meta?.next_token,
    };
  }

  /**
   * Get usage stats
   */
  getStats(): { requestsUsed: number; requestsRemaining: number } {
    return {
      requestsUsed: this.requestCount,
      requestsRemaining: Math.max(0, (this.config.rateLimitPerMonth ?? 10000) - this.requestCount),
    };
  }
}
