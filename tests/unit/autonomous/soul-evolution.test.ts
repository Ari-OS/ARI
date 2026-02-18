import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import fs from 'node:fs/promises';
import { EventBus } from '../../../src/kernel/event-bus.js';
import { SoulEvolution } from '../../../src/autonomous/soul-evolution.js';
import type { SoulProposal } from '../../../src/autonomous/soul-evolution-types.js';

function makeOrchestrator(response: string = '{}') {
  return {
    query: vi.fn().mockResolvedValue(response),
  };
}

describe('SoulEvolution', () => {
  let soul: SoulEvolution;
  let eventBus: EventBus;
  let orchestrator: ReturnType<typeof makeOrchestrator>;
  let tmpDir: string;
  let workspaceDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `ari-soul-test-${randomUUID()}`);
    workspaceDir = join(tmpDir, 'workspace');
    await fs.mkdir(workspaceDir, { recursive: true });

    eventBus = new EventBus();
    orchestrator = makeOrchestrator();

    soul = new SoulEvolution({
      eventBus,
      orchestrator,
      workspaceDir,
    });
    await soul.initialize();
  });

  afterEach(async () => {
    await soul.shutdown();
    try {
      await fs.rm(tmpDir, { recursive: true });
    } catch { /* noop */ }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // proposeChange
  // ═══════════════════════════════════════════════════════════════════════════

  describe('proposeChange', () => {
    it('should create a proposal with correct fields', async () => {
      const proposal = await soul.proposeChange({
        file: 'PREFERENCES.md',
        section: 'Communication Style',
        currentContent: 'Direct and concise',
        proposedContent: 'Direct, concise, with occasional humor',
        rationale: 'Pryce seems to respond well to lighter tones',
      });

      expect(proposal.id).toMatch(/^soul-/);
      expect(proposal.file).toBe('PREFERENCES.md');
      expect(proposal.section).toBe('Communication Style');
      expect(proposal.currentContent).toBe('Direct and concise');
      expect(proposal.proposedContent).toBe('Direct, concise, with occasional humor');
      expect(proposal.rationale).toBe('Pryce seems to respond well to lighter tones');
      expect(proposal.status).toBe('pending');
      expect(proposal.createdAt).toBeTruthy();
      expect(proposal.diff).toContain('-Direct and concise');
      expect(proposal.diff).toContain('+Direct, concise, with occasional humor');
    });

    it('should set requiresPryceApproval for SOUL.md', async () => {
      const proposal = await soul.proposeChange({
        file: 'SOUL.md',
        section: 'Core Values',
        currentContent: 'old value',
        proposedContent: 'new value',
        rationale: 'Growth reflection',
      });

      expect(proposal.requiresPryceApproval).toBe(true);
    });

    it('should set requiresPryceApproval for IDENTITY.md', async () => {
      const proposal = await soul.proposeChange({
        file: 'IDENTITY.md',
        section: 'Purpose',
        currentContent: 'old purpose',
        proposedContent: 'new purpose',
        rationale: 'Clarified mission',
      });

      expect(proposal.requiresPryceApproval).toBe(true);
    });

    it('should NOT set requiresPryceApproval for PREFERENCES.md', async () => {
      const proposal = await soul.proposeChange({
        file: 'PREFERENCES.md',
        section: 'Tone',
        currentContent: 'formal',
        proposedContent: 'casual',
        rationale: 'Better fit',
      });

      expect(proposal.requiresPryceApproval).toBe(false);
    });

    it('should generate a diff showing removed and added lines', async () => {
      const proposal = await soul.proposeChange({
        file: 'PREFERENCES.md',
        section: 'Style',
        currentContent: 'line one\nline two\nline three',
        proposedContent: 'line one\nline TWO modified\nline three',
        rationale: 'Refinement',
      });

      expect(proposal.diff).toContain(' line one');
      expect(proposal.diff).toContain('-line two');
      expect(proposal.diff).toContain('+line TWO modified');
      expect(proposal.diff).toContain(' line three');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Persistence
  // ═══════════════════════════════════════════════════════════════════════════

  describe('persistence', () => {
    it('should persist proposals and reload them', async () => {
      await soul.proposeChange({
        file: 'PREFERENCES.md',
        section: 'Test',
        currentContent: 'old',
        proposedContent: 'new',
        rationale: 'testing persistence',
      });

      // Create a new instance pointing at the same workspace
      const soul2 = new SoulEvolution({
        eventBus,
        orchestrator,
        workspaceDir,
      });
      await soul2.initialize();

      const pending = soul2.getPendingProposals();
      expect(pending).toHaveLength(1);
      expect(pending[0].section).toBe('Test');
      expect(pending[0].rationale).toBe('testing persistence');

      await soul2.shutdown();
    });

    it('should handle missing persistence file gracefully', async () => {
      // Remove the soul directory
      const soulDir = join(tmpDir, 'soul');
      try {
        await fs.rm(soulDir, { recursive: true });
      } catch { /* noop */ }

      const soul2 = new SoulEvolution({
        eventBus,
        orchestrator,
        workspaceDir,
      });
      await soul2.initialize();

      expect(soul2.getPendingProposals()).toHaveLength(0);
      await soul2.shutdown();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getPendingProposals
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getPendingProposals', () => {
    it('should return only pending proposals', async () => {
      const p1 = await soul.proposeChange({
        file: 'PREFERENCES.md',
        section: 'A',
        currentContent: 'a',
        proposedContent: 'b',
        rationale: 'reason',
      });

      await soul.proposeChange({
        file: 'PREFERENCES.md',
        section: 'B',
        currentContent: 'c',
        proposedContent: 'd',
        rationale: 'reason',
      });

      // Approve the first one
      await soul.updateProposalStatus(p1.id, 'approved');

      const pending = soul.getPendingProposals();
      expect(pending).toHaveLength(1);
      expect(pending[0].section).toBe('B');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // applyProposal
  // ═══════════════════════════════════════════════════════════════════════════

  describe('applyProposal', () => {
    it('should write file changes for approved proposals', async () => {
      // Create the file first
      const filePath = join(workspaceDir, 'PREFERENCES.md');
      await fs.writeFile(filePath, 'Direct and concise\n', 'utf-8');

      const proposal = await soul.proposeChange({
        file: 'PREFERENCES.md',
        section: 'Style',
        currentContent: 'Direct and concise',
        proposedContent: 'Direct with warmth',
        rationale: 'Better rapport',
      });

      // Approve it
      await soul.updateProposalStatus(proposal.id, 'approved');

      const result = await soul.applyProposal(proposal.id);
      expect(result).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('Direct with warmth');
      expect(content).not.toContain('Direct and concise');
    });

    it('should fail for unapproved proposals', async () => {
      const proposal = await soul.proposeChange({
        file: 'PREFERENCES.md',
        section: 'Style',
        currentContent: 'old',
        proposedContent: 'new',
        rationale: 'reason',
      });

      // Do not approve — still pending
      const result = await soul.applyProposal(proposal.id);
      expect(result).toBe(false);
    });

    it('should fail for rejected proposals', async () => {
      const proposal = await soul.proposeChange({
        file: 'PREFERENCES.md',
        section: 'Style',
        currentContent: 'old',
        proposedContent: 'new',
        rationale: 'reason',
      });

      await soul.updateProposalStatus(proposal.id, 'rejected');
      const result = await soul.applyProposal(proposal.id);
      expect(result).toBe(false);
    });

    it('should fail for nonexistent proposal ID', async () => {
      const result = await soul.applyProposal('soul-nonexistent');
      expect(result).toBe(false);
    });

    it('should append content when section not found in file', async () => {
      const filePath = join(workspaceDir, 'PREFERENCES.md');
      await fs.writeFile(filePath, '# Preferences\n\nSome existing content\n', 'utf-8');

      const proposal = await soul.proposeChange({
        file: 'PREFERENCES.md',
        section: 'New Section',
        currentContent: '',
        proposedContent: 'Brand new content here',
        rationale: 'Adding new section',
      });

      await soul.updateProposalStatus(proposal.id, 'approved');
      const result = await soul.applyProposal(proposal.id);
      expect(result).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('## New Section');
      expect(content).toContain('Brand new content here');
    });

    it('should create the file if it does not exist', async () => {
      const proposal = await soul.proposeChange({
        file: 'NEW_FILE.md',
        section: 'Init',
        currentContent: '',
        proposedContent: 'Initial content',
        rationale: 'Bootstrap',
      });

      await soul.updateProposalStatus(proposal.id, 'approved');
      const result = await soul.applyProposal(proposal.id);
      expect(result).toBe(true);

      const filePath = join(workspaceDir, 'NEW_FILE.md');
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('Initial content');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // weeklyReflection
  // ═══════════════════════════════════════════════════════════════════════════

  describe('weeklyReflection', () => {
    it('should generate insights from interaction data', async () => {
      orchestrator.query.mockResolvedValue(JSON.stringify({
        insights: ['ARI is improving at technical discussions', 'Needs more proactive check-ins'],
        overallSentiment: 'growing',
        weekSummary: 'Strong week with good technical engagement',
        proposedChanges: [],
      }));

      const reflection = await soul.weeklyReflection({
        interactionCount: 42,
        feedbackPositive: 35,
        feedbackNegative: 3,
        topTopics: ['TypeScript', 'market analysis', 'scheduling'],
      });

      expect(reflection.insights).toHaveLength(2);
      expect(reflection.insights[0]).toContain('technical discussions');
      expect(reflection.overallSentiment).toBe('growing');
      expect(reflection.weekSummary).toContain('Strong week');
      expect(orchestrator.query).toHaveBeenCalledOnce();
    });

    it('should create proposals from reflection', async () => {
      orchestrator.query.mockResolvedValue(JSON.stringify({
        insights: ['Should be more proactive'],
        overallSentiment: 'stable',
        weekSummary: 'Steady week',
        proposedChanges: [
          {
            file: 'PREFERENCES.md',
            section: 'Proactivity',
            currentContent: 'Reactive by default',
            proposedContent: 'Proactive with daily check-ins',
            rationale: 'User benefits from proactive suggestions',
          },
        ],
      }));

      const reflection = await soul.weeklyReflection({
        interactionCount: 20,
        feedbackPositive: 15,
        feedbackNegative: 2,
        topTopics: ['planning'],
      });

      expect(reflection.proposedChanges).toHaveLength(1);
      expect(reflection.proposedChanges[0].file).toBe('PREFERENCES.md');
      expect(reflection.proposedChanges[0].status).toBe('pending');
      expect(reflection.proposedChanges[0].requiresPryceApproval).toBe(false);

      // Should also appear in pending proposals
      const pending = soul.getPendingProposals();
      expect(pending.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle malformed AI response gracefully', async () => {
      orchestrator.query.mockResolvedValue('This is not JSON at all');

      const reflection = await soul.weeklyReflection({
        interactionCount: 10,
        feedbackPositive: 8,
        feedbackNegative: 1,
        topTopics: ['general'],
      });

      // Should return a fallback reflection, not throw
      expect(reflection.insights).toHaveLength(1);
      expect(reflection.overallSentiment).toBe('growing'); // 8/9 = 0.89 > 0.7
      expect(reflection.weekSummary).toContain('10 interactions');
      expect(reflection.proposedChanges).toHaveLength(0);
    });

    it('should calculate struggling sentiment from bad feedback ratio', async () => {
      orchestrator.query.mockResolvedValue('not json');

      const reflection = await soul.weeklyReflection({
        interactionCount: 20,
        feedbackPositive: 2,
        feedbackNegative: 15,
        topTopics: ['complaints'],
      });

      expect(reflection.overallSentiment).toBe('struggling');
    });

    it('should include missedOpportunities in prompt', async () => {
      orchestrator.query.mockResolvedValue(JSON.stringify({
        insights: ['Need to watch for missed cues'],
        overallSentiment: 'stable',
        weekSummary: 'Okay week',
        proposedChanges: [],
      }));

      await soul.weeklyReflection({
        interactionCount: 30,
        feedbackPositive: 20,
        feedbackNegative: 5,
        topTopics: ['coding'],
        missedOpportunities: ['Could have offered briefing earlier', 'Missed a scheduling conflict'],
      });

      const promptArg = orchestrator.query.mock.calls[0][0] as string;
      expect(promptArg).toContain('Could have offered briefing earlier');
      expect(promptArg).toContain('Missed a scheduling conflict');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Events
  // ═══════════════════════════════════════════════════════════════════════════

  describe('events', () => {
    it('should emit soul:proposal_created via audit:log on proposeChange', async () => {
      const events: Record<string, unknown>[] = [];
      eventBus.on('audit:log', (payload) => {
        if (payload.action === 'soul:proposal_created') {
          events.push(payload.details);
        }
      });

      await soul.proposeChange({
        file: 'PREFERENCES.md',
        section: 'Test',
        currentContent: 'old',
        proposedContent: 'new',
        rationale: 'reason',
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toHaveProperty('proposalId');
      expect(events[0]).toHaveProperty('file', 'PREFERENCES.md');
    });

    it('should emit soul:proposal_approved via audit:log on applyProposal', async () => {
      const events: Record<string, unknown>[] = [];
      eventBus.on('audit:log', (payload) => {
        if (payload.action === 'soul:proposal_approved') {
          events.push(payload.details);
        }
      });

      const filePath = join(workspaceDir, 'PREFERENCES.md');
      await fs.writeFile(filePath, 'old content\n', 'utf-8');

      const proposal = await soul.proposeChange({
        file: 'PREFERENCES.md',
        section: 'Test',
        currentContent: 'old content',
        proposedContent: 'new content',
        rationale: 'reason',
      });

      await soul.updateProposalStatus(proposal.id, 'approved');
      await soul.applyProposal(proposal.id);

      expect(events).toHaveLength(1);
      expect(events[0]).toHaveProperty('proposalId', proposal.id);
    });

    it('should emit soul:reflection_completed via audit:log on weeklyReflection', async () => {
      const events: Record<string, unknown>[] = [];
      eventBus.on('audit:log', (payload) => {
        if (payload.action === 'soul:reflection_completed') {
          events.push(payload.details);
        }
      });

      orchestrator.query.mockResolvedValue(JSON.stringify({
        insights: ['insight'],
        overallSentiment: 'growing',
        weekSummary: 'Good week',
        proposedChanges: [],
      }));

      await soul.weeklyReflection({
        interactionCount: 10,
        feedbackPositive: 8,
        feedbackNegative: 1,
        topTopics: ['code'],
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toHaveProperty('insightCount', 1);
      expect(events[0]).toHaveProperty('overallSentiment', 'growing');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // updateProposalStatus
  // ═══════════════════════════════════════════════════════════════════════════

  describe('updateProposalStatus', () => {
    it('should update pending proposal to approved', async () => {
      const proposal = await soul.proposeChange({
        file: 'PREFERENCES.md',
        section: 'Test',
        currentContent: 'old',
        proposedContent: 'new',
        rationale: 'reason',
      });

      const result = await soul.updateProposalStatus(proposal.id, 'approved');
      expect(result).toBe(true);

      const updated = soul.getProposal(proposal.id);
      expect(updated?.status).toBe('approved');
    });

    it('should return false for nonexistent proposal', async () => {
      const result = await soul.updateProposalStatus('fake-id', 'approved');
      expect(result).toBe(false);
    });

    it('should return false for already approved proposal', async () => {
      const proposal = await soul.proposeChange({
        file: 'PREFERENCES.md',
        section: 'Test',
        currentContent: 'old',
        proposedContent: 'new',
        rationale: 'reason',
      });

      await soul.updateProposalStatus(proposal.id, 'approved');
      const result = await soul.updateProposalStatus(proposal.id, 'rejected');
      expect(result).toBe(false);
    });
  });
});
