import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../../src/kernel/event-bus.js';
import { AIPolicyGovernor } from '../../../src/ai/ai-policy-governor.js';
import type { CouncilInterface, AIRequest } from '../../../src/ai/types.js';

/**
 * Mock Council that implements CouncilInterface for testing.
 */
function createMockCouncil(): CouncilInterface {
  return {
    createVote: (request) => ({
      vote_id: 'test-vote-id',
      status: 'OPEN',
    }),
    castVote: () => true,
    castVeto: () => true,
    closeVote: () => {},
  };
}

const makeRequest = (overrides?: Partial<AIRequest>): AIRequest => ({
  content: 'Test request content',
  category: 'query',
  agent: 'core',
  trustLevel: 'system',
  priority: 'STANDARD',
  enableCaching: true,
  securitySensitive: false,
  ...overrides,
});

describe('AIPolicyGovernor', () => {
  let eventBus: EventBus;
  let council: CouncilInterface;
  let governor: AIPolicyGovernor;

  beforeEach(() => {
    eventBus = new EventBus();
    council = createMockCouncil();
    governor = new AIPolicyGovernor(eventBus, council);
  });

  describe('requiresGovernance', () => {
    it('should not require governance for trivial costs', () => {
      expect(governor.requiresGovernance(makeRequest(), 0.001)).toBe(false);
      expect(governor.requiresGovernance(makeRequest(), 0.004)).toBe(false);
    });

    it('should require governance for non-trivial costs', () => {
      expect(governor.requiresGovernance(makeRequest(), 0.005)).toBe(true);
      expect(governor.requiresGovernance(makeRequest(), 0.05)).toBe(true);
      expect(governor.requiresGovernance(makeRequest(), 1.50)).toBe(true);
    });
  });

  describe('requestApproval — auto-approve', () => {
    it('should auto-approve trivial costs', async () => {
      const decision = await governor.requestApproval(
        makeRequest(),
        0.001,
        'claude-haiku-3',
      );
      expect(decision.approved).toBe(true);
      expect(decision.votingMechanism).toBe('auto_approved');
      expect(decision.vetoExercised).toBe(false);
    });
  });

  describe('requestApproval — predicted voting', () => {
    it('should approve low cost requests via simple majority', async () => {
      const decision = await governor.requestApproval(
        makeRequest(),
        0.01,
        'claude-haiku-4.5',
      );
      expect(decision.approved).toBe(true);
      expect(decision.votingMechanism).toBe('simple_majority');
      expect(decision.vetoExercised).toBe(false);
      expect(decision.reason).toContain('Predicted');
    });

    it('should approve moderate costs via weighted majority', async () => {
      const decision = await governor.requestApproval(
        makeRequest(),
        0.10,
        'claude-sonnet-4',
      );
      expect(decision.approved).toBe(true);
      expect(decision.votingMechanism).toBe('weighted_majority');
    });
  });

  describe('requestApproval — full Council deliberation', () => {
    it('should use Council for expensive requests', async () => {
      const decision = await governor.requestApproval(
        makeRequest(),
        0.30,
        'claude-sonnet-4',
      );
      expect(decision.votingMechanism).toBe('supermajority');
      expect(decision.councilVoteId).toBe('test-vote-id');
    });

    it('should use super-supermajority for very expensive requests', async () => {
      const decision = await governor.requestApproval(
        makeRequest(),
        1.50,
        'claude-opus-4.5',
      );
      expect(decision.votingMechanism).toBe('super_supermajority');
    });
  });

  describe('requestApproval — vetoes', () => {
    it('should exercise AEGIS veto for untrusted security requests', async () => {
      const decision = await governor.requestApproval(
        makeRequest({
          securitySensitive: true,
          trustLevel: 'untrusted',
        }),
        0.10,
        'claude-sonnet-4',
      );
      expect(decision.approved).toBe(false);
      expect(decision.vetoExercised).toBe(true);
      expect(decision.vetoAgent).toBe('guardian');
      expect(decision.vetoDomain).toBe('security');
    });

    it('should exercise AEGIS veto for hostile security requests', async () => {
      const decision = await governor.requestApproval(
        makeRequest({
          securitySensitive: true,
          trustLevel: 'hostile',
        }),
        0.01,
        'claude-haiku-4.5',
      );
      expect(decision.approved).toBe(false);
      expect(decision.vetoExercised).toBe(true);
      expect(decision.vetoAgent).toBe('guardian');
    });

    it('should not veto trusted security requests', async () => {
      const decision = await governor.requestApproval(
        makeRequest({
          securitySensitive: true,
          trustLevel: 'operator',
        }),
        0.01,
        'claude-sonnet-4',
      );
      expect(decision.vetoExercised).toBe(false);
    });

    it('should exercise MINT veto for expensive supermajority requests', async () => {
      const decision = await governor.requestApproval(
        makeRequest(),
        0.60,
        'claude-opus-4.5',
      );
      expect(decision.approved).toBe(false);
      expect(decision.vetoExercised).toBe(true);
      expect(decision.vetoAgent).toBe('wealth');
      expect(decision.vetoDomain).toBe('major_financial');
    });

    it('should exercise OPAL veto for massive token requests', async () => {
      // Content > 100K tokens (400K chars / 4 = 100K)
      const hugeContent = 'x'.repeat(400_001);
      const decision = await governor.requestApproval(
        makeRequest({ content: hugeContent }),
        0.10,
        'claude-sonnet-4',
      );
      expect(decision.approved).toBe(false);
      expect(decision.vetoExercised).toBe(true);
      expect(decision.vetoAgent).toBe('resource_manager');
      expect(decision.vetoDomain).toBe('resource_depletion');
    });
  });

  describe('emergencyBudgetVote', () => {
    it('should approve when spend is under 95% of budget', async () => {
      const decision = await governor.emergencyBudgetVote(28, 35);
      expect(decision.approved).toBe(true);
      expect(decision.votingMechanism).toBe('emergency');
      expect(decision.councilVoteId).toBe('test-vote-id');
    });

    it('should reject when spend exceeds 95% of budget', async () => {
      const decision = await governor.emergencyBudgetVote(34, 35);
      expect(decision.approved).toBe(false);
      expect(decision.votingMechanism).toBe('emergency');
    });
  });

  describe('audit events', () => {
    it('should emit audit events for auto-approved requests', async () => {
      const events: unknown[] = [];
      eventBus.on('audit:log', (data) => events.push(data));

      await governor.requestApproval(makeRequest(), 0.001, 'claude-haiku-3');
      expect(events.length).toBeGreaterThan(0);
    });

    it('should emit audit events for vetoed requests', async () => {
      const events: unknown[] = [];
      eventBus.on('audit:log', (data) => events.push(data));

      await governor.requestApproval(
        makeRequest({ securitySensitive: true, trustLevel: 'untrusted' }),
        0.10,
        'claude-sonnet-4',
      );
      expect(events.length).toBeGreaterThan(0);
    });
  });
});
