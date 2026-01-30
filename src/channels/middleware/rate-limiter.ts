import type { RateLimit } from '../types.js';

/**
 * Rate Limiter Configuration
 */
export interface RateLimiterConfig {
  /** Maximum messages per window */
  maxMessages: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Strategy when rate limited: 'reject', 'queue', 'delay' */
  strategy: 'reject' | 'queue' | 'delay';
  /** Max queue size (for queue strategy) */
  maxQueueSize?: number;
  /** Delay between messages (for delay strategy) */
  delayMs?: number;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  maxMessages: 60,
  windowMs: 60000, // 1 minute
  strategy: 'reject',
  maxQueueSize: 100,
  delayMs: 1000,
};

/**
 * Queued message
 */
interface QueuedMessage<T> {
  data: T;
  timestamp: Date;
  resolve: (value: boolean) => void;
  reject: (reason: Error) => void;
}

/**
 * RateLimiter
 *
 * Implements rate limiting for channel messages.
 * Supports multiple strategies: reject, queue, or delay.
 */
export class RateLimiter<T = unknown> {
  private config: RateLimiterConfig;
  private windowStart: Date;
  private messageCount: number = 0;
  private queue: Array<QueuedMessage<T>> = [];
  private processing: boolean = false;
  private lastProcessed: Date | null = null;

  constructor(config?: Partial<RateLimiterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.windowStart = new Date();
  }

  /**
   * Check if currently rate limited
   */
  isLimited(): boolean {
    this.updateWindow();
    return this.messageCount >= this.config.maxMessages;
  }

  /**
   * Get current rate limit state
   */
  getState(): RateLimit {
    this.updateWindow();

    const limited = this.messageCount >= this.config.maxMessages;
    const resetAt = limited
      ? new Date(this.windowStart.getTime() + this.config.windowMs)
      : undefined;

    return {
      maxMessages: this.config.maxMessages,
      windowMs: this.config.windowMs,
      currentCount: this.messageCount,
      windowStart: this.windowStart,
      limited,
      resetAt,
    };
  }

  /**
   * Try to consume a rate limit slot
   * Returns true if allowed, false if rate limited
   */
  tryConsume(): boolean {
    this.updateWindow();

    if (this.messageCount >= this.config.maxMessages) {
      return false;
    }

    this.messageCount++;
    return true;
  }

  /**
   * Process a message with rate limiting
   * Behavior depends on strategy configuration
   */
  async process<R>(
    data: T,
    processor: (data: T) => Promise<R>
  ): Promise<{ success: boolean; result?: R; queued?: boolean; error?: string }> {
    this.updateWindow();

    // Check if we can process immediately
    if (this.messageCount < this.config.maxMessages) {
      return this.executeProcess(data, processor);
    }

    // Handle based on strategy
    switch (this.config.strategy) {
      case 'reject':
        return {
          success: false,
          error: 'Rate limited',
        };

      case 'queue':
        return this.queueMessage(data, processor);

      case 'delay':
        return this.delayMessage(data, processor);

      default:
        return {
          success: false,
          error: 'Invalid strategy',
        };
    }
  }

  /**
   * Execute the processor with rate limit tracking
   */
  private async executeProcess<R>(
    data: T,
    processor: (data: T) => Promise<R>
  ): Promise<{ success: boolean; result?: R; error?: string }> {
    this.messageCount++;
    this.lastProcessed = new Date();

    try {
      const result = await processor(data);
      return { success: true, result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Queue a message for later processing
   */
  private async queueMessage<R>(
    data: T,
    processor: (data: T) => Promise<R>
  ): Promise<{ success: boolean; result?: R; queued?: boolean; error?: string }> {
    if (this.queue.length >= (this.config.maxQueueSize || 100)) {
      return {
        success: false,
        error: 'Queue full',
      };
    }

    return new Promise((resolve) => {
      this.queue.push({
        data,
        timestamp: new Date(),
        resolve: (allowed) => {
          if (allowed) {
            void this.executeProcess(data, processor).then(result => resolve(result));
          } else {
            resolve({ success: false, error: 'Dequeued but not allowed' });
          }
        },
        reject: (error) => {
          resolve({ success: false, error: error.message });
        },
      });

      // Start processing queue if not already
      void this.processQueue();
    });
  }

  /**
   * Delay processing until rate limit allows
   */
  private async delayMessage<R>(
    data: T,
    processor: (data: T) => Promise<R>
  ): Promise<{ success: boolean; result?: R; error?: string }> {
    const state = this.getState();

    if (state.resetAt) {
      const waitTime = state.resetAt.getTime() - Date.now();
      if (waitTime > 0) {
        await this.sleep(waitTime);
      }
    }

    // Reset and try again
    this.updateWindow();

    if (this.messageCount < this.config.maxMessages) {
      return this.executeProcess(data, processor);
    }

    return {
      success: false,
      error: 'Still rate limited after delay',
    };
  }

  /**
   * Process queued messages
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      this.updateWindow();

      if (this.messageCount >= this.config.maxMessages) {
        // Wait for window reset
        const state = this.getState();
        if (state.resetAt) {
          const waitTime = state.resetAt.getTime() - Date.now();
          if (waitTime > 0) {
            await this.sleep(waitTime);
            continue;
          }
        }
      }

      const item = this.queue.shift();
      if (item) {
        item.resolve(true);

        // Add delay between messages if configured
        if (this.config.delayMs) {
          await this.sleep(this.config.delayMs);
        }
      }
    }

    this.processing = false;
  }

  /**
   * Update the sliding window
   */
  private updateWindow(): void {
    const now = Date.now();
    const windowEnd = this.windowStart.getTime() + this.config.windowMs;

    if (now >= windowEnd) {
      // Window has expired, reset
      this.windowStart = new Date(now);
      this.messageCount = 0;
    }
  }

  /**
   * Get remaining capacity in current window
   */
  getRemainingCapacity(): number {
    this.updateWindow();
    return Math.max(0, this.config.maxMessages - this.messageCount);
  }

  /**
   * Get time until window resets (ms)
   */
  getTimeUntilReset(): number {
    const windowEnd = this.windowStart.getTime() + this.config.windowMs;
    return Math.max(0, windowEnd - Date.now());
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Clear the queue
   */
  clearQueue(): void {
    for (const item of this.queue) {
      item.reject(new Error('Queue cleared'));
    }
    this.queue = [];
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.windowStart = new Date();
    this.messageCount = 0;
    this.clearQueue();
    this.lastProcessed = null;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RateLimiterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a rate limiter for a specific channel
 */
export function createChannelRateLimiter(
  channelId: string,
  config?: Partial<RateLimiterConfig>
): RateLimiter {
  return new RateLimiter(config);
}

/**
 * Default rate limits by channel type
 */
export const CHANNEL_RATE_LIMITS: Record<string, Partial<RateLimiterConfig>> = {
  pushover: {
    maxMessages: 7500,  // Pushover limit per month, we'll use a conservative daily rate
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    strategy: 'queue',
  },
  telegram: {
    maxMessages: 30,
    windowMs: 1000, // 30 messages per second
    strategy: 'queue',
  },
  slack: {
    maxMessages: 1,
    windowMs: 1000, // 1 message per second
    strategy: 'queue',
  },
  discord: {
    maxMessages: 5,
    windowMs: 5000, // 5 messages per 5 seconds
    strategy: 'queue',
  },
  sms: {
    maxMessages: 1,
    windowMs: 1000, // Conservative
    strategy: 'delay',
  },
  webhook: {
    maxMessages: 100,
    windowMs: 60000, // 100 per minute
    strategy: 'reject',
  },
};
