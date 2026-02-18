import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OperationalCouncils } from '../../../src/governance/operational-councils.js';
import type { CouncilDecision, CouncilDefinition } from '../../../src/governance/operational-councils.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockQuery = vi.fn();
const mockEmit = vi.fn();

const mockOrchestrator = { query: mockQuery };
const mockEventBus = { emit: mockEmit } as unknown as ConstructorParameters<typeof OperationalCouncils>[0]['eventBus'];

vi.mock('../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OperationalCouncils', () => {
  let councils: OperationalCouncils;

  beforeEach(() => {
    vi.clearAllMocks();
    councils = new OperationalCouncils({
      eventBus: mockEventBus,
      orchestrator: mockOrchestrator,
    });
  });

  describe('getCouncils()', () => {
    it('should return all 4 councils', () => {
      const all = councils.getCouncils();

      expect(all).toHaveLength(4);
    });

    it('should include business-advisory council', () => {
      const all = councils.getCouncils();
      const biz = all.find(c => c.id === 'business-advisory');

      expect(biz).toBeDefined();
      expect(biz!.name).toBe('Business Advisory Council');
    });

    it('should include security council', () => {
      const sec = councils.getCouncil('security');

      expect(sec).toBeDefined();
      expect(sec!.decisionThreshold).toBe(0.8);
    });

    it('should include productivity-focus council', () => {
      const pf = councils.getCouncil('productivity-focus');

      expect(pf).toBeDefined();
      expect(pf!.members.length).toBe(5);
    });

    it('should include platform-health council', () => {
      const ph = councils.getCouncil('platform-health');

      expect(ph).toBeDefined();
      expect(ph!.members.length).toBe(4);
    });
  });

  describe('getCouncil()', () => {
    it('should return null for unknown council id', () => {
      const result = councils.getCouncil('nonexistent');

      expect(result).toBeNull();
    });

    it('should return the correct council by id', () => {
      const biz = councils.getCouncil('business-advisory');

      expect(biz).toBeDefined();
      expect(biz!.id).toBe('business-advisory');
    });
  });

  describe('convene() — voting mechanics', () => {
    it('should approve when all members vote approve', async () => {
      mockQuery.mockResolvedValue('{"vote":"approve","reasoning":"Good idea"}');

      const decision = await councils.convene('business-advisory', 'Launch new product');

      expect(decision.approved).toBe(true);
      expect(decision.consensus).toBe(1);
      expect(decision.councilId).toBe('business-advisory');
      expect(decision.proposal).toBe('Launch new product');
    });

    it('should reject when all members vote reject', async () => {
      mockQuery.mockResolvedValue('{"vote":"reject","reasoning":"Bad idea"}');

      const decision = await councils.convene('business-advisory', 'Bad proposal');

      expect(decision.approved).toBe(false);
      expect(decision.consensus).toBe(0);
    });

    it('should use the council-specific threshold for approval', async () => {
      // Security council has threshold 0.8 (4/5 must approve)
      // 3 approve, 2 reject => 60% < 80% => rejected
      let callCount = 0;
      mockQuery.mockImplementation(() => {
        callCount++;
        if (callCount <= 3) return Promise.resolve('{"vote":"approve","reasoning":"ok"}');
        return Promise.resolve('{"vote":"reject","reasoning":"risky"}');
      });

      const decision = await councils.convene('security', 'Deploy change');

      expect(decision.approved).toBe(false);
      // 3/5 voted, 3 approve out of 5 non-abstain = 0.6
      expect(decision.consensus).toBeLessThan(0.8);
    });

    it('should count votes from all members', async () => {
      mockQuery.mockResolvedValue('{"vote":"approve","reasoning":"ok"}');

      const decision = await councils.convene('business-advisory', 'test');

      // Business advisory has 8 members
      expect(decision.votes).toHaveLength(8);
    });

    it('should handle abstention votes', async () => {
      mockQuery.mockResolvedValue('{"vote":"abstain","reasoning":"not sure"}');

      const decision = await councils.convene('business-advisory', 'unclear proposal');

      // All abstain => totalVoters = 1 (fallback), approveCount = 0 => consensus = 0
      expect(decision.approved).toBe(false);
      expect(decision.votes.every(v => v.vote === 'abstain')).toBe(true);
    });

    it('should record abstention for members whose vote fails', async () => {
      let callCount = 0;
      mockQuery.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.reject(new Error('LLM timeout'));
        return Promise.resolve('{"vote":"approve","reasoning":"ok"}');
      });

      const decision = await councils.convene('platform-health', 'test');

      // First member abstains (error), rest approve
      const abstains = decision.votes.filter(v => v.vote === 'abstain');
      expect(abstains).toHaveLength(1);
      expect(abstains[0].reasoning).toBe('Failed to deliberate.');
    });
  });

  describe('convene() — vote parsing', () => {
    it('should parse approve vote correctly', async () => {
      mockQuery.mockResolvedValue('{"vote":"approve","reasoning":"Solid plan"}');

      const decision = await councils.convene('platform-health', 'test');

      expect(decision.votes[0].vote).toBe('approve');
      expect(decision.votes[0].reasoning).toBe('Solid plan');
    });

    it('should parse reject vote correctly', async () => {
      mockQuery.mockResolvedValue('{"vote":"reject","reasoning":"Too risky"}');

      const decision = await councils.convene('platform-health', 'test');

      expect(decision.votes[0].vote).toBe('reject');
    });

    it('should default to abstain for unrecognized vote values', async () => {
      mockQuery.mockResolvedValue('{"vote":"maybe","reasoning":"unclear"}');

      const decision = await councils.convene('platform-health', 'test');

      expect(decision.votes[0].vote).toBe('abstain');
    });

    it('should default to abstain when no JSON found in response', async () => {
      mockQuery.mockResolvedValue('I think we should approve this.');

      const decision = await councils.convene('platform-health', 'test');

      expect(decision.votes[0].vote).toBe('abstain');
      expect(decision.votes[0].reasoning).toBe('Unable to parse vote.');
    });

    it('should truncate long reasoning to 500 chars', async () => {
      const longReasoning = 'x'.repeat(600);
      mockQuery.mockResolvedValue(`{"vote":"approve","reasoning":"${longReasoning}"}`);

      const decision = await councils.convene('platform-health', 'test');

      expect(decision.votes[0].reasoning.length).toBeLessThanOrEqual(500);
    });

    it('should default reasoning when not a string', async () => {
      mockQuery.mockResolvedValue('{"vote":"approve","reasoning":42}');

      const decision = await councils.convene('platform-health', 'test');

      expect(decision.votes[0].reasoning).toBe('No reasoning provided.');
    });
  });

  describe('convene() — error handling', () => {
    it('should throw for unknown council ID', async () => {
      await expect(councils.convene('nonexistent', 'proposal'))
        .rejects
        .toThrow('Unknown council: nonexistent');
    });

    it('should list valid council IDs in error message', async () => {
      await expect(councils.convene('bad-id', 'proposal'))
        .rejects
        .toThrow(/Valid:/);
    });
  });

  describe('convene() — audit events', () => {
    it('should emit council:convened audit event', async () => {
      mockQuery.mockResolvedValue('{"vote":"approve","reasoning":"ok"}');

      await councils.convene('business-advisory', 'test');

      expect(mockEmit).toHaveBeenCalledWith('audit:log', expect.objectContaining({
        action: 'council:convened',
        details: expect.objectContaining({
          councilId: 'business-advisory',
        }),
      }));
    });

    it('should emit council:decision_made audit event', async () => {
      mockQuery.mockResolvedValue('{"vote":"approve","reasoning":"ok"}');

      await councils.convene('business-advisory', 'test');

      expect(mockEmit).toHaveBeenCalledWith('audit:log', expect.objectContaining({
        action: 'council:decision_made',
        details: expect.objectContaining({
          councilId: 'business-advisory',
          approved: true,
        }),
      }));
    });
  });

  describe('convene() — decision summary', () => {
    it('should include APPROVED in summary when approved', async () => {
      mockQuery.mockResolvedValue('{"vote":"approve","reasoning":"ok"}');

      const decision = await councils.convene('business-advisory', 'test');

      expect(decision.summary).toContain('APPROVED');
    });

    it('should include REJECTED in summary when rejected', async () => {
      mockQuery.mockResolvedValue('{"vote":"reject","reasoning":"no"}');

      const decision = await councils.convene('business-advisory', 'test');

      expect(decision.summary).toContain('REJECTED');
    });

    it('should include vote counts in summary', async () => {
      mockQuery.mockResolvedValue('{"vote":"approve","reasoning":"ok"}');

      const decision = await councils.convene('platform-health', 'test');

      expect(decision.summary).toContain('4 approve');
      expect(decision.summary).toContain('0 reject');
    });

    it('should include consensus percentage in summary', async () => {
      mockQuery.mockResolvedValue('{"vote":"approve","reasoning":"ok"}');

      const decision = await councils.convene('platform-health', 'test');

      expect(decision.summary).toContain('100%');
    });

    it('should include timestamp in decision', async () => {
      mockQuery.mockResolvedValue('{"vote":"approve","reasoning":"ok"}');

      const decision = await councils.convene('platform-health', 'test');

      expect(decision.timestamp).toBeDefined();
      expect(new Date(decision.timestamp).getTime()).not.toBeNaN();
    });
  });
});
