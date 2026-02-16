import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SkillBridge } from '../../../../src/plugins/telegram-bot/skill-bridge.js';
import type { SkillBridgeDeps } from '../../../../src/plugins/telegram-bot/skill-bridge.js';
import type { Context } from 'grammy';
import type { EventBus } from '../../../../src/kernel/event-bus.js';
import type { SkillRegistry, SkillMatch } from '../../../../src/skills/registry.js';
import type { SkillDefinition } from '../../../../src/skills/types.js';

describe('skill-bridge', () => {
  let mockEventBus: EventBus;
  let mockCtx: Partial<Context>;
  let mockRegistry: Partial<SkillRegistry>;
  let bridge: SkillBridge;
  let deps: SkillBridgeDeps;

  beforeEach(() => {
    mockEventBus = {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
    } as unknown as EventBus;

    mockCtx = {
      reply: vi.fn().mockResolvedValue(undefined),
    };

    deps = {
      eventBus: mockEventBus,
    };

    bridge = new SkillBridge(deps);

    mockRegistry = {
      findBestMatch: vi.fn(),
    };
  });

  it('should return false when registry is not set', async () => {
    const result = await bridge.handleSkillQuery(mockCtx as Context, 'test query');

    expect(result).toBe(false);
    expect(mockCtx.reply).not.toHaveBeenCalled();
  });

  it('should match skill above confidence threshold', async () => {
    const mockSkill: SkillDefinition = {
      metadata: {
        name: 'test-skill',
        displayName: 'Test Skill',
        description: 'A test skill for demonstration',
        version: '1.0.0',
        author: 'ARI',
        tags: ['test'],
        triggers: [{
          pattern: 'test',
          isRegex: false,
          priority: 1,
          confidence: 0.7,
        }],
        permissions: [],
        trustRequired: 'STANDARD',
        enabled: true,
      },
      source: 'builtin',
      status: 'active',
      content: '# Test Skill',
      loadedAt: Date.now(),
    };

    const mockMatch: SkillMatch = {
      skill: mockSkill,
      trigger: mockSkill.metadata.triggers[0],
      confidence: 0.85,
    };

    mockRegistry.findBestMatch = vi.fn().mockReturnValue(mockMatch);
    bridge.setRegistry(mockRegistry as SkillRegistry);

    const result = await bridge.handleSkillQuery(mockCtx as Context, 'test query');

    expect(result).toBe(true);
    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Test Skill'),
      { parse_mode: 'HTML' },
    );
    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining('85%'),
      { parse_mode: 'HTML' },
    );
    expect(mockEventBus.emit).toHaveBeenCalledWith('telegram:skill_invoked', {
      skill: 'test-skill',
      confidence: 0.85,
      timestamp: expect.any(String),
    });
  });

  it('should return false when confidence is below threshold', async () => {
    const mockSkill: SkillDefinition = {
      metadata: {
        name: 'test-skill',
        displayName: 'Test Skill',
        description: 'A test skill',
        version: '1.0.0',
        author: 'ARI',
        tags: [],
        triggers: [{
          pattern: 'test',
          isRegex: false,
          priority: 1,
          confidence: 0.7,
        }],
        permissions: [],
        trustRequired: 'STANDARD',
        enabled: true,
      },
      source: 'builtin',
      status: 'active',
      content: '# Test',
      loadedAt: Date.now(),
    };

    const mockMatch: SkillMatch = {
      skill: mockSkill,
      trigger: mockSkill.metadata.triggers[0],
      confidence: 0.65, // Below 0.7 threshold
    };

    mockRegistry.findBestMatch = vi.fn().mockReturnValue(mockMatch);
    bridge.setRegistry(mockRegistry as SkillRegistry);

    const result = await bridge.handleSkillQuery(mockCtx as Context, 'test query');

    expect(result).toBe(false);
    expect(mockCtx.reply).not.toHaveBeenCalled();
    expect(mockEventBus.emit).not.toHaveBeenCalledWith(
      'telegram:skill_invoked',
      expect.any(Object),
    );
  });

  it('should return false when no match is found', async () => {
    mockRegistry.findBestMatch = vi.fn().mockReturnValue(null);
    bridge.setRegistry(mockRegistry as SkillRegistry);

    const result = await bridge.handleSkillQuery(mockCtx as Context, 'unknown query');

    expect(result).toBe(false);
    expect(mockCtx.reply).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    mockRegistry.findBestMatch = vi.fn().mockImplementation(() => {
      throw new Error('Registry error');
    });
    bridge.setRegistry(mockRegistry as SkillRegistry);

    const result = await bridge.handleSkillQuery(mockCtx as Context, 'test query');

    expect(result).toBe(false);
    expect(mockEventBus.emit).toHaveBeenCalledWith('system:error', {
      error: expect.any(Error),
      context: 'skill_bridge',
    });
  });

  it('should use skill name when displayName is not set', async () => {
    const mockSkill: SkillDefinition = {
      metadata: {
        name: 'test-skill',
        // displayName is undefined
        description: 'A test skill',
        version: '1.0.0',
        author: 'ARI',
        tags: [],
        triggers: [{
          pattern: 'test',
          isRegex: false,
          priority: 1,
          confidence: 0.7,
        }],
        permissions: [],
        trustRequired: 'STANDARD',
        enabled: true,
      },
      source: 'builtin',
      status: 'active',
      content: '# Test',
      loadedAt: Date.now(),
    };

    const mockMatch: SkillMatch = {
      skill: mockSkill,
      trigger: mockSkill.metadata.triggers[0],
      confidence: 0.9,
    };

    mockRegistry.findBestMatch = vi.fn().mockReturnValue(mockMatch);
    bridge.setRegistry(mockRegistry as SkillRegistry);

    const result = await bridge.handleSkillQuery(mockCtx as Context, 'test query');

    expect(result).toBe(true);
    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining('test-skill'),
      { parse_mode: 'HTML' },
    );
  });
});
