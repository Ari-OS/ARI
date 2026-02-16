import { describe, it, expect } from 'vitest';
import {
  ContentDraftSchema,
  ContentTemplateSchema,
  DraftStatusSchema,
  ContentPlatformSchema,
  TopicBriefSchema,
  ContentEngineConfigSchema,
} from '../../../../src/plugins/content-engine/types.js';

describe('Content Engine Types', () => {
  describe('DraftStatusSchema', () => {
    it('should accept valid statuses', () => {
      expect(DraftStatusSchema.parse('pending')).toBe('pending');
      expect(DraftStatusSchema.parse('sent_for_review')).toBe('sent_for_review');
      expect(DraftStatusSchema.parse('approved')).toBe('approved');
      expect(DraftStatusSchema.parse('edited')).toBe('edited');
      expect(DraftStatusSchema.parse('rejected')).toBe('rejected');
      expect(DraftStatusSchema.parse('published')).toBe('published');
      expect(DraftStatusSchema.parse('archived')).toBe('archived');
    });

    it('should reject invalid status', () => {
      expect(() => DraftStatusSchema.parse('invalid')).toThrow();
    });
  });

  describe('ContentPlatformSchema', () => {
    it('should accept valid platforms', () => {
      expect(ContentPlatformSchema.parse('x_thread')).toBe('x_thread');
      expect(ContentPlatformSchema.parse('x_single')).toBe('x_single');
      expect(ContentPlatformSchema.parse('linkedin')).toBe('linkedin');
      expect(ContentPlatformSchema.parse('blog_outline')).toBe('blog_outline');
      expect(ContentPlatformSchema.parse('quick_take')).toBe('quick_take');
    });
  });

  describe('TopicBriefSchema', () => {
    it('should parse a valid topic brief', () => {
      const brief = TopicBriefSchema.parse({
        headline: 'Claude 4.6 drops with computer use',
        keyPoints: ['Faster than 4.5', 'Computer use built-in'],
        angle: 'How solo devs can leverage computer use for automation',
        targetPlatform: 'x_thread',
        sourceItemIds: ['intel-123'],
        threadabilityScore: 85,
      });
      expect(brief.headline).toBe('Claude 4.6 drops with computer use');
      expect(brief.targetPlatform).toBe('x_thread');
    });

    it('should require headline and keyPoints', () => {
      expect(() => TopicBriefSchema.parse({})).toThrow();
    });
  });

  describe('ContentDraftSchema', () => {
    it('should parse a valid draft', () => {
      const draft = ContentDraftSchema.parse({
        id: 'draft-2026-02-16-001',
        topicBrief: {
          headline: 'Test topic',
          keyPoints: ['Point 1'],
          angle: 'Technical angle',
          targetPlatform: 'x_thread',
          sourceItemIds: ['intel-1'],
          threadabilityScore: 70,
        },
        platform: 'x_thread',
        content: ['Hook tweet', 'Body tweet 1', 'CTA tweet'],
        status: 'pending',
        createdAt: '2026-02-16T07:00:00Z',
      });
      expect(draft.id).toBe('draft-2026-02-16-001');
      expect(draft.status).toBe('pending');
      expect(draft.content).toHaveLength(3);
    });

    it('should default metadata to empty object', () => {
      const draft = ContentDraftSchema.parse({
        id: 'draft-001',
        topicBrief: {
          headline: 'Test',
          keyPoints: ['P1'],
          angle: 'A',
          targetPlatform: 'linkedin',
          sourceItemIds: [],
          threadabilityScore: 50,
        },
        platform: 'linkedin',
        content: ['Post text'],
        status: 'pending',
        createdAt: '2026-02-16T07:00:00Z',
      });
      expect(draft.metadata).toEqual({});
    });
  });

  describe('ContentTemplateSchema', () => {
    it('should parse a valid template', () => {
      const template = ContentTemplateSchema.parse({
        id: 'x-thread',
        platform: 'x_thread',
        systemPrompt: 'You are @PayThePryce...',
        formatInstructions: 'Write a hook + 5-7 body tweets + CTA',
        maxLength: 2240,
        examples: ['Example thread...'],
      });
      expect(template.id).toBe('x-thread');
    });
  });

  describe('ContentEngineConfigSchema', () => {
    it('should provide sensible defaults', () => {
      const config = ContentEngineConfigSchema.parse({});
      expect(config.draftsPerDay).toBe(3);
      expect(config.autoSendForReview).toBe(true);
      expect(config.publishingEnabled).toBe(false);
      expect(config.platforms).toEqual(['x_thread', 'linkedin']);
    });
  });
});
