import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  RateLimiter,
  createChannelRateLimiter,
  CHANNEL_RATE_LIMITS,
  type RateLimiterConfig,
} from '../../../../src/channels/middleware/rate-limiter.js';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter<string>;

  beforeEach(() => {
    vi.useFakeTimers();
    rateLimiter = new RateLimiter<string>({
      maxMessages: 5,
      windowMs: 1000,
      strategy: 'reject',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    rateLimiter.reset();
  });

  describe('constructor', () => {
    it('should use default config when no config provided', () => {
      const defaultLimiter = new RateLimiter();
      const state = defaultLimiter.getState();

      expect(state.maxMessages).toBe(60);
      expect(state.windowMs).toBe(60000);
    });

    it('should merge provided config with defaults', () => {
      const customLimiter = new RateLimiter<string>({
        maxMessages: 10,
        strategy: 'queue',
      });
      const state = customLimiter.getState();

      expect(state.maxMessages).toBe(10);
      expect(state.windowMs).toBe(60000); // default
    });
  });

  describe('isLimited', () => {
    it('should return false when under limit', () => {
      expect(rateLimiter.isLimited()).toBe(false);
    });

    it('should return true when at limit', () => {
      for (let i = 0; i < 5; i++) {
        rateLimiter.tryConsume();
      }
      expect(rateLimiter.isLimited()).toBe(true);
    });

    it('should return false after window expires', () => {
      for (let i = 0; i < 5; i++) {
        rateLimiter.tryConsume();
      }
      expect(rateLimiter.isLimited()).toBe(true);

      // Advance time past window
      vi.advanceTimersByTime(1001);

      expect(rateLimiter.isLimited()).toBe(false);
    });
  });

  describe('getState', () => {
    it('should return current rate limit state', () => {
      const state = rateLimiter.getState();

      expect(state.maxMessages).toBe(5);
      expect(state.windowMs).toBe(1000);
      expect(state.currentCount).toBe(0);
      expect(state.limited).toBe(false);
      expect(state.resetAt).toBeUndefined();
    });

    it('should include resetAt when limited', () => {
      for (let i = 0; i < 5; i++) {
        rateLimiter.tryConsume();
      }

      const state = rateLimiter.getState();

      expect(state.limited).toBe(true);
      expect(state.resetAt).toBeDefined();
      expect(state.resetAt!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should track message count accurately', () => {
      rateLimiter.tryConsume();
      rateLimiter.tryConsume();

      const state = rateLimiter.getState();

      expect(state.currentCount).toBe(2);
    });
  });

  describe('tryConsume', () => {
    it('should return true and increment count when under limit', () => {
      expect(rateLimiter.tryConsume()).toBe(true);
      expect(rateLimiter.getState().currentCount).toBe(1);
    });

    it('should return false when at limit', () => {
      for (let i = 0; i < 5; i++) {
        rateLimiter.tryConsume();
      }

      expect(rateLimiter.tryConsume()).toBe(false);
      expect(rateLimiter.getState().currentCount).toBe(5);
    });

    it('should allow consuming after window reset', () => {
      for (let i = 0; i < 5; i++) {
        rateLimiter.tryConsume();
      }

      vi.advanceTimersByTime(1001);

      expect(rateLimiter.tryConsume()).toBe(true);
      expect(rateLimiter.getState().currentCount).toBe(1);
    });
  });

  describe('process with reject strategy', () => {
    it('should process message when under limit', async () => {
      const processor = vi.fn().mockResolvedValue('processed');

      const result = await rateLimiter.process('test', processor);

      expect(result.success).toBe(true);
      expect(result.result).toBe('processed');
      expect(processor).toHaveBeenCalledWith('test');
    });

    it('should reject when at limit', async () => {
      // Fill up the limit
      for (let i = 0; i < 5; i++) {
        await rateLimiter.process('fill', vi.fn().mockResolvedValue('ok'));
      }

      const processor = vi.fn().mockResolvedValue('processed');
      const result = await rateLimiter.process('test', processor);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limited');
      expect(processor).not.toHaveBeenCalled();
    });

    it('should handle processor errors', async () => {
      const processor = vi.fn().mockRejectedValue(new Error('Processing failed'));

      const result = await rateLimiter.process('test', processor);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Processing failed');
    });

    it('should handle non-Error exceptions', async () => {
      const processor = vi.fn().mockRejectedValue('string error');

      const result = await rateLimiter.process('test', processor);

      expect(result.success).toBe(false);
      expect(result.error).toBe('string error');
    });
  });

  describe('process with queue strategy', () => {
    let queueLimiter: RateLimiter<string>;

    beforeEach(() => {
      queueLimiter = new RateLimiter<string>({
        maxMessages: 2,
        windowMs: 1000,
        strategy: 'queue',
        maxQueueSize: 5,
        delayMs: 100,
      });
    });

    afterEach(() => {
      queueLimiter.clearQueue();
    });

    it('should queue messages when at limit', async () => {
      const processor = vi.fn().mockResolvedValue('processed');

      // Fill the limit
      await queueLimiter.process('msg1', processor);
      await queueLimiter.process('msg2', processor);

      // This should be queued
      const queuedPromise = queueLimiter.process('msg3', processor);

      expect(queueLimiter.getQueueSize()).toBe(1);

      // Advance time to allow queue processing after window reset
      vi.advanceTimersByTime(1001);
      await vi.advanceTimersByTimeAsync(200);

      const result = await queuedPromise;
      expect(result.success).toBe(true);
    });

    it('should reject when queue is full', async () => {
      // Use a simpler approach: create a limiter with limit 1 and queue size 2
      const smallQueueLimiter = new RateLimiter<string>({
        maxMessages: 1,
        windowMs: 100000, // Very long window so no reset during test
        strategy: 'queue',
        maxQueueSize: 2,
      });

      const processor = vi.fn().mockResolvedValue('processed');

      // Fill the limit (1 message)
      await smallQueueLimiter.process('msg1', processor);

      // Queue 2 messages (fills the queue)
      const q1 = smallQueueLimiter.process('q1', processor);
      const q2 = smallQueueLimiter.process('q2', processor);

      // Queue should be full now
      expect(smallQueueLimiter.getQueueSize()).toBe(2);

      // This should be rejected synchronously due to full queue
      const result = await smallQueueLimiter.process('overflow', processor);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Queue full');

      // Cleanup
      smallQueueLimiter.clearQueue();
      await Promise.allSettled([q1, q2]);
    });
  });

  describe('process with delay strategy', () => {
    let delayLimiter: RateLimiter<string>;

    beforeEach(() => {
      delayLimiter = new RateLimiter<string>({
        maxMessages: 2,
        windowMs: 1000,
        strategy: 'delay',
      });
    });

    it('should delay message when at limit', async () => {
      const processor = vi.fn().mockResolvedValue('processed');

      // Fill the limit
      await delayLimiter.process('msg1', processor);
      await delayLimiter.process('msg2', processor);

      expect(processor).toHaveBeenCalledTimes(2);

      // Start delayed processing
      const delayedPromise = delayLimiter.process('msg3', processor);

      // Processor should not be called yet
      expect(processor).toHaveBeenCalledTimes(2);

      // Advance time past window reset
      vi.advanceTimersByTime(1001);
      await vi.advanceTimersByTimeAsync(10);

      const result = await delayedPromise;

      expect(result.success).toBe(true);
      expect(processor).toHaveBeenCalledTimes(3);
    });
  });

  describe('getRemainingCapacity', () => {
    it('should return full capacity when no messages sent', () => {
      expect(rateLimiter.getRemainingCapacity()).toBe(5);
    });

    it('should decrease with each message', () => {
      rateLimiter.tryConsume();
      rateLimiter.tryConsume();

      expect(rateLimiter.getRemainingCapacity()).toBe(3);
    });

    it('should return 0 when at limit', () => {
      for (let i = 0; i < 5; i++) {
        rateLimiter.tryConsume();
      }

      expect(rateLimiter.getRemainingCapacity()).toBe(0);
    });

    it('should reset after window expires', () => {
      for (let i = 0; i < 5; i++) {
        rateLimiter.tryConsume();
      }

      vi.advanceTimersByTime(1001);

      expect(rateLimiter.getRemainingCapacity()).toBe(5);
    });
  });

  describe('getTimeUntilReset', () => {
    it('should return time until window end', () => {
      const timeUntilReset = rateLimiter.getTimeUntilReset();

      // Should be close to windowMs (1000ms)
      expect(timeUntilReset).toBeGreaterThan(0);
      expect(timeUntilReset).toBeLessThanOrEqual(1000);
    });

    it('should decrease as time passes', () => {
      const initialTime = rateLimiter.getTimeUntilReset();

      vi.advanceTimersByTime(500);

      const laterTime = rateLimiter.getTimeUntilReset();

      expect(laterTime).toBeLessThan(initialTime);
      expect(laterTime).toBeLessThanOrEqual(500);
    });

    it('should return 0 when window has expired', () => {
      vi.advanceTimersByTime(1001);

      // After update, window resets
      rateLimiter.tryConsume(); // triggers updateWindow

      // Now get time for new window
      const time = rateLimiter.getTimeUntilReset();
      expect(time).toBeGreaterThan(0);
      expect(time).toBeLessThanOrEqual(1000);
    });
  });

  describe('getQueueSize', () => {
    it('should return 0 when no messages queued', () => {
      expect(rateLimiter.getQueueSize()).toBe(0);
    });
  });

  describe('clearQueue', () => {
    let queueLimiter: RateLimiter<string>;

    beforeEach(() => {
      queueLimiter = new RateLimiter<string>({
        maxMessages: 1,
        windowMs: 10000,
        strategy: 'queue',
        maxQueueSize: 10,
      });
    });

    it('should clear all queued messages', async () => {
      const processor = vi.fn().mockResolvedValue('processed');

      // Fill limit
      await queueLimiter.process('msg1', processor);

      // Queue some messages (don't await)
      const p1 = queueLimiter.process('msg2', processor);
      const p2 = queueLimiter.process('msg3', processor);

      expect(queueLimiter.getQueueSize()).toBe(2);

      queueLimiter.clearQueue();

      expect(queueLimiter.getQueueSize()).toBe(0);

      // Queued messages should resolve with error
      const result1 = await p1;
      const result2 = await p2;

      expect(result1.success).toBe(false);
      expect(result1.error).toBe('Queue cleared');
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Queue cleared');
    });
  });

  describe('reset', () => {
    it('should reset message count', () => {
      for (let i = 0; i < 3; i++) {
        rateLimiter.tryConsume();
      }

      expect(rateLimiter.getState().currentCount).toBe(3);

      rateLimiter.reset();

      expect(rateLimiter.getState().currentCount).toBe(0);
    });

    it('should reset window start', () => {
      const initialWindow = rateLimiter.getState().windowStart;

      vi.advanceTimersByTime(500);

      rateLimiter.reset();

      const newWindow = rateLimiter.getState().windowStart;

      expect(newWindow!.getTime()).toBeGreaterThan(initialWindow!.getTime());
    });

    it('should clear the queue', async () => {
      const queueLimiter = new RateLimiter<string>({
        maxMessages: 1,
        windowMs: 10000,
        strategy: 'queue',
      });

      await queueLimiter.process('msg1', vi.fn().mockResolvedValue('ok'));
      const p = queueLimiter.process('msg2', vi.fn().mockResolvedValue('ok'));

      expect(queueLimiter.getQueueSize()).toBe(1);

      queueLimiter.reset();

      expect(queueLimiter.getQueueSize()).toBe(0);

      const result = await p;
      expect(result.success).toBe(false);
    });
  });

  describe('updateConfig', () => {
    it('should update maxMessages', () => {
      rateLimiter.updateConfig({ maxMessages: 10 });

      expect(rateLimiter.getState().maxMessages).toBe(10);
    });

    it('should update windowMs', () => {
      rateLimiter.updateConfig({ windowMs: 5000 });

      expect(rateLimiter.getState().windowMs).toBe(5000);
    });

    it('should update strategy', async () => {
      rateLimiter.updateConfig({ strategy: 'queue', maxQueueSize: 5 });

      // Fill limit
      for (let i = 0; i < 5; i++) {
        await rateLimiter.process(`msg${i}`, vi.fn().mockResolvedValue('ok'));
      }

      // Should queue instead of reject
      const p = rateLimiter.process('queued', vi.fn().mockResolvedValue('ok'));

      expect(rateLimiter.getQueueSize()).toBe(1);

      // Cleanup
      rateLimiter.clearQueue();
      await p;
    });

    it('should preserve unspecified config values', () => {
      rateLimiter.updateConfig({ maxMessages: 20 });

      const state = rateLimiter.getState();

      expect(state.maxMessages).toBe(20);
      expect(state.windowMs).toBe(1000); // unchanged
    });
  });

  describe('window expiration', () => {
    it('should reset count when window expires', () => {
      for (let i = 0; i < 3; i++) {
        rateLimiter.tryConsume();
      }

      expect(rateLimiter.getState().currentCount).toBe(3);

      vi.advanceTimersByTime(1001);

      // Any operation triggers window check
      rateLimiter.isLimited();

      expect(rateLimiter.getState().currentCount).toBe(0);
    });

    it('should update windowStart when window expires', () => {
      const initialWindow = rateLimiter.getState().windowStart;

      vi.advanceTimersByTime(1001);
      rateLimiter.isLimited();

      const newWindow = rateLimiter.getState().windowStart;

      expect(newWindow!.getTime()).toBeGreaterThan(initialWindow!.getTime());
    });
  });
});

describe('createChannelRateLimiter', () => {
  it('should create a rate limiter for a channel', () => {
    const limiter = createChannelRateLimiter('test-channel');

    expect(limiter).toBeInstanceOf(RateLimiter);
  });

  it('should accept custom config', () => {
    const limiter = createChannelRateLimiter('test-channel', {
      maxMessages: 100,
      windowMs: 5000,
      strategy: 'queue',
    });

    const state = limiter.getState();

    expect(state.maxMessages).toBe(100);
    expect(state.windowMs).toBe(5000);
  });
});

describe('CHANNEL_RATE_LIMITS', () => {
  it('should have predefined limits for telegram', () => {
    expect(CHANNEL_RATE_LIMITS.telegram).toBeDefined();
    expect(CHANNEL_RATE_LIMITS.telegram.maxMessages).toBe(30);
    expect(CHANNEL_RATE_LIMITS.telegram.windowMs).toBe(1000);
  });

  it('should have predefined limits for slack', () => {
    expect(CHANNEL_RATE_LIMITS.slack).toBeDefined();
    expect(CHANNEL_RATE_LIMITS.slack.maxMessages).toBe(1);
    expect(CHANNEL_RATE_LIMITS.slack.windowMs).toBe(1000);
  });

  it('should have predefined limits for discord', () => {
    expect(CHANNEL_RATE_LIMITS.discord).toBeDefined();
    expect(CHANNEL_RATE_LIMITS.discord.maxMessages).toBe(5);
    expect(CHANNEL_RATE_LIMITS.discord.windowMs).toBe(5000);
  });

  it('should have predefined limits for sms', () => {
    expect(CHANNEL_RATE_LIMITS.sms).toBeDefined();
    expect(CHANNEL_RATE_LIMITS.sms.strategy).toBe('delay');
  });

  it('should have predefined limits for webhook', () => {
    expect(CHANNEL_RATE_LIMITS.webhook).toBeDefined();
    expect(CHANNEL_RATE_LIMITS.webhook.maxMessages).toBe(100);
    expect(CHANNEL_RATE_LIMITS.webhook.strategy).toBe('reject');
  });
});

describe('RateLimiter edge cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should handle concurrent process calls', async () => {
    const limiter = new RateLimiter<number>({
      maxMessages: 5,
      windowMs: 1000,
      strategy: 'reject',
    });

    const processor = vi.fn().mockImplementation(async (n: number) => {
      await new Promise((r) => setTimeout(r, 10));
      return n * 2;
    });

    // Start multiple concurrent processes
    const promises = Array.from({ length: 10 }, (_, i) =>
      limiter.process(i, processor)
    );

    // Advance timers to let processors complete
    await vi.advanceTimersByTimeAsync(100);

    const results = await Promise.all(promises);

    // First 5 should succeed
    const successful = results.filter((r) => r.success);
    const rejected = results.filter((r) => !r.success);

    expect(successful.length).toBe(5);
    expect(rejected.length).toBe(5);
    expect(rejected.every((r) => r.error === 'Rate limited')).toBe(true);

    limiter.reset();
  });

  it('should handle very high message limits', () => {
    const limiter = new RateLimiter({
      maxMessages: 1000000,
      windowMs: 1000,
      strategy: 'reject',
    });

    expect(limiter.getRemainingCapacity()).toBe(1000000);

    limiter.reset();
  });

  it('should handle very short windows', async () => {
    const limiter = new RateLimiter<string>({
      maxMessages: 1,
      windowMs: 10,
      strategy: 'reject',
    });

    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(false);

    vi.advanceTimersByTime(11);

    expect(limiter.tryConsume()).toBe(true);

    limiter.reset();
  });

  it('should handle zero remaining capacity gracefully', () => {
    const limiter = new RateLimiter({
      maxMessages: 0,
      windowMs: 1000,
      strategy: 'reject',
    });

    expect(limiter.getRemainingCapacity()).toBe(0);
    expect(limiter.isLimited()).toBe(true);
    expect(limiter.tryConsume()).toBe(false);

    limiter.reset();
  });
});
