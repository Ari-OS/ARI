import { describe, it, expect, vi } from 'vitest';
import type { EventBus } from '../../../../src/kernel/event-bus.js';

vi.mock('../../../../src/kernel/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
const mockBus = { emit: vi.fn(), on: vi.fn() } as unknown as EventBus;

describe('PerplexitySeo', () => {
  it('should instantiate', async () => {
    const { PerplexitySeo } = await import('../../../../src/plugins/seo-engine/perplexity-seo.js');
    const seo = new PerplexitySeo({ eventBus: mockBus });
    expect(seo).toBeDefined();
  });

  it('should record a citation check with required fields', async () => {
    const { PerplexitySeo } = await import('../../../../src/plugins/seo-engine/perplexity-seo.js');
    const seo = new PerplexitySeo({ eventBus: mockBus });
    seo.recordCheck({
      query: 'Pryceless Solutions IT consulting',
      engine: 'perplexity',
      cited: true,
      citationUrl: 'https://prycehedrick.com',
      position: 1,
      checkedAt: new Date().toISOString(),
    });
    const report = seo.getCitationReport(7);
    expect(report).toHaveProperty('totalChecks');
    expect(report.totalChecks).toBeGreaterThan(0);
    expect(report).toHaveProperty('citationRate');
  });

  it('should return string[] from getTopQueries', async () => {
    const { PerplexitySeo } = await import('../../../../src/plugins/seo-engine/perplexity-seo.js');
    const seo = new PerplexitySeo({ eventBus: mockBus });
    seo.recordCheck({ query: 'IT consulting Portland', engine: 'perplexity', cited: true, citationUrl: 'https://prycehedrick.com', position: 1, checkedAt: new Date().toISOString() });
    const top = seo.getTopQueries(5);
    expect(top.length).toBeGreaterThan(0);
    expect(typeof top[0]).toBe('string');
  });
});
