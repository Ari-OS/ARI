import { describe, it, expect, vi } from 'vitest';
import type { EventBus } from '../../../../src/kernel/event-bus.js';

vi.mock('../../../../src/kernel/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        goto: vi.fn().mockResolvedValue({ status: () => 200 }),
        title: vi.fn().mockResolvedValue('Hello World Page'),
        evaluate: vi.fn().mockResolvedValue('Hello World body text'),
        screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-screenshot')),
        waitForSelector: vi.fn().mockResolvedValue(null),
        close: vi.fn(),
      }),
      close: vi.fn(),
    }),
  },
}));

const mockBus = { emit: vi.fn(), on: vi.fn() } as unknown as EventBus;

describe('PlaywrightRunner', () => {
  it('should instantiate', async () => {
    const { PlaywrightRunner } = await import('../../../../src/integrations/browser/playwright-runner.js');
    const runner = new PlaywrightRunner({ eventBus: mockBus });
    expect(runner).toBeDefined();
  });

  it('should reject URLs not in allowlist', async () => {
    const { PlaywrightRunner } = await import('../../../../src/integrations/browser/playwright-runner.js');
    const runner = new PlaywrightRunner({ eventBus: mockBus });
    await expect(runner.browse('https://evil-site.example.com/malicious')).rejects.toThrow();
  });

  it('should allow URLs in allowlist', async () => {
    const { PlaywrightRunner } = await import('../../../../src/integrations/browser/playwright-runner.js');
    const runner = new PlaywrightRunner({ eventBus: mockBus });
    const result = await runner.browse('https://prycehedrick.com');
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('statusCode');
  });

  it('should identify allowed vs blocked domains', async () => {
    const { PlaywrightRunner } = await import('../../../../src/integrations/browser/playwright-runner.js');
    const runner = new PlaywrightRunner({ eventBus: mockBus });
    expect(runner.isAllowed('https://prycehedrick.com')).toBe(true);
    expect(runner.isAllowed('https://evil.example.com')).toBe(false);
  });
});
