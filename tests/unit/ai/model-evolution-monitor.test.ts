import { describe, it, expect, vi } from 'vitest';
import type { EventBus } from '../../../src/kernel/event-bus.js';

vi.mock('../../../src/kernel/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

const mockBus = { emit: vi.fn(), on: vi.fn() } as unknown as EventBus;

describe('ModelEvolutionMonitor', () => {
  it('should instantiate', async () => {
    const { ModelEvolutionMonitor } = await import('../../../src/ai/model-evolution-monitor.js');
    const monitor = new ModelEvolutionMonitor({ eventBus: mockBus });
    expect(monitor).toBeDefined();
  });

  it('should return known models with modelId', async () => {
    const { ModelEvolutionMonitor } = await import('../../../src/ai/model-evolution-monitor.js');
    const monitor = new ModelEvolutionMonitor({ eventBus: mockBus });
    const models = monitor.getKnownModels();
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
    expect(models[0]).toHaveProperty('modelId');
  });

  it('should run check and return EvolutionReport', async () => {
    const { ModelEvolutionMonitor } = await import('../../../src/ai/model-evolution-monitor.js');
    const monitor = new ModelEvolutionMonitor({ eventBus: mockBus });
    const report = monitor.check();
    expect(report).toHaveProperty('checkedAt');
    expect(report).toHaveProperty('newModelsFound');
    expect(report).toHaveProperty('upgradeRecommended');
    expect(Array.isArray(report.newModelsFound)).toBe(true);
  });
});
