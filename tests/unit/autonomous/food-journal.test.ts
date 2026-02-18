import { describe, it, expect, vi } from 'vitest';
import type { EventBus } from '../../../src/kernel/event-bus.js';

vi.mock('better-sqlite3', () => ({
  default: vi.fn().mockImplementation(() => ({
    pragma: vi.fn(),
    prepare: vi.fn().mockReturnValue({
      run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }),
      get: vi.fn().mockReturnValue(null),
      all: vi.fn().mockReturnValue([]),
    }),
    exec: vi.fn(),
    close: vi.fn(),
  })),
}));
vi.mock('../../../src/kernel/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
const mockBus = { emit: vi.fn(), on: vi.fn() } as unknown as EventBus;

describe('FoodJournal', () => {
  it('should instantiate', async () => {
    const { FoodJournal } = await import('../../../src/autonomous/food-journal.js');
    const journal = new FoodJournal({ eventBus: mockBus });
    expect(journal).toBeDefined();
  });

  it('should log a food entry and return FoodEntry shape', async () => {
    const { FoodJournal } = await import('../../../src/autonomous/food-journal.js');
    const journal = new FoodJournal({ eventBus: mockBus });
    const entry = journal.logFood({ description: 'Chicken breast 100g', meal: 'lunch', calories: 165, protein: 31, carbs: 0, fat: 3.6, source: 'manual' });
    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('description', 'Chicken breast 100g');
    expect(entry).toHaveProperty('calories', 165);
  });

  it('should return daily totals with correct shape', async () => {
    const { FoodJournal } = await import('../../../src/autonomous/food-journal.js');
    const journal = new FoodJournal({ eventBus: mockBus });
    const totals = journal.getDailyTotals();
    expect(totals).toHaveProperty('date');
    expect(totals).toHaveProperty('totalCalories');
    expect(totals).toHaveProperty('entryCount');
  });

  it('should generate a daily summary text string', async () => {
    const { FoodJournal } = await import('../../../src/autonomous/food-journal.js');
    const journal = new FoodJournal({ eventBus: mockBus });
    const summary = journal.getDailySummaryText();
    expect(typeof summary).toBe('string');
  });
});
