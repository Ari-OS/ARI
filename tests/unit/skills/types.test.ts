import { describe, it, expect } from 'vitest';
import {
  SkillPermissionSchema,
  SkillTrustRequirementSchema,
  SkillSourceSchema,
  SkillStatusSchema,
  SkillTriggerSchema,
  SkillToolSchema,
  SkillMetadataSchema,
  SkillDefinitionSchema,
  SkillExecutionContextSchema,
  SkillExecutionResultSchema,
  SkillQuerySchema,
  parseSkillFrontmatter,
  computeSkillHash,
} from '../../../src/skills/types.js';

describe('Skills Types', () => {
  describe('SkillPermissionSchema', () => {
    it('should accept valid permissions', () => {
      const validPermissions = [
        'read_files',
        'write_files',
        'execute_bash',
        'network_access',
        'memory_read',
        'memory_write',
        'session_access',
        'channel_send',
        'tool_execute',
        'governance_vote',
      ];

      for (const permission of validPermissions) {
        expect(() => SkillPermissionSchema.parse(permission)).not.toThrow();
      }
    });

    it('should reject invalid permissions', () => {
      expect(() => SkillPermissionSchema.parse('invalid_permission')).toThrow();
      expect(() => SkillPermissionSchema.parse('')).toThrow();
      expect(() => SkillPermissionSchema.parse(123)).toThrow();
    });
  });

  describe('SkillTrustRequirementSchema', () => {
    it('should accept valid trust requirements', () => {
      const validRequirements = ['standard', 'verified', 'operator', 'system'];

      for (const requirement of validRequirements) {
        expect(() => SkillTrustRequirementSchema.parse(requirement)).not.toThrow();
      }
    });

    it('should reject invalid trust requirements', () => {
      expect(() => SkillTrustRequirementSchema.parse('admin')).toThrow();
      expect(() => SkillTrustRequirementSchema.parse('untrusted')).toThrow();
    });
  });

  describe('SkillSourceSchema', () => {
    it('should accept valid sources', () => {
      expect(SkillSourceSchema.parse('workspace')).toBe('workspace');
      expect(SkillSourceSchema.parse('user')).toBe('user');
      expect(SkillSourceSchema.parse('bundled')).toBe('bundled');
    });

    it('should reject invalid sources', () => {
      expect(() => SkillSourceSchema.parse('external')).toThrow();
      expect(() => SkillSourceSchema.parse('system')).toThrow();
    });
  });

  describe('SkillStatusSchema', () => {
    it('should accept valid statuses', () => {
      const validStatuses = ['active', 'inactive', 'pending_approval', 'rejected'];

      for (const status of validStatuses) {
        expect(() => SkillStatusSchema.parse(status)).not.toThrow();
      }
    });

    it('should reject invalid statuses', () => {
      expect(() => SkillStatusSchema.parse('enabled')).toThrow();
      expect(() => SkillStatusSchema.parse('disabled')).toThrow();
    });
  });

  describe('SkillTriggerSchema', () => {
    it('should parse valid trigger with defaults', () => {
      const trigger = SkillTriggerSchema.parse({ pattern: 'test' });

      expect(trigger.pattern).toBe('test');
      expect(trigger.confidence).toBe(0.8);
      expect(trigger.isRegex).toBe(false);
      expect(trigger.priority).toBe(0);
    });

    it('should parse trigger with custom values', () => {
      const trigger = SkillTriggerSchema.parse({
        pattern: '^test.*',
        confidence: 0.9,
        isRegex: true,
        priority: 10,
      });

      expect(trigger.pattern).toBe('^test.*');
      expect(trigger.confidence).toBe(0.9);
      expect(trigger.isRegex).toBe(true);
      expect(trigger.priority).toBe(10);
    });

    it('should validate confidence range', () => {
      expect(() => SkillTriggerSchema.parse({ pattern: 'test', confidence: 1.5 })).toThrow();
      expect(() => SkillTriggerSchema.parse({ pattern: 'test', confidence: -0.1 })).toThrow();
      expect(() => SkillTriggerSchema.parse({ pattern: 'test', confidence: 0 })).not.toThrow();
      expect(() => SkillTriggerSchema.parse({ pattern: 'test', confidence: 1 })).not.toThrow();
    });

    it('should require pattern', () => {
      expect(() => SkillTriggerSchema.parse({})).toThrow();
    });
  });

  describe('SkillToolSchema', () => {
    it('should parse valid tool with defaults', () => {
      const tool = SkillToolSchema.parse({ name: 'my-tool' });

      expect(tool.name).toBe('my-tool');
      expect(tool.required).toBe(false);
      expect(tool.config).toBeUndefined();
    });

    it('should parse tool with custom values', () => {
      const tool = SkillToolSchema.parse({
        name: 'my-tool',
        required: true,
        config: { timeout: 5000 },
      });

      expect(tool.name).toBe('my-tool');
      expect(tool.required).toBe(true);
      expect(tool.config).toEqual({ timeout: 5000 });
    });

    it('should require name', () => {
      expect(() => SkillToolSchema.parse({})).toThrow();
    });
  });

  describe('SkillMetadataSchema', () => {
    it('should parse valid metadata with required fields', () => {
      const metadata = SkillMetadataSchema.parse({
        name: 'test-skill',
        description: 'A test skill',
        version: '1.0.0',
      });

      expect(metadata.name).toBe('test-skill');
      expect(metadata.description).toBe('A test skill');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.author).toBe('user');
      expect(metadata.permissions).toEqual([]);
      expect(metadata.trustRequired).toBe('standard');
      expect(metadata.tools).toEqual([]);
      expect(metadata.triggers).toEqual([]);
      expect(metadata.dependencies).toEqual([]);
      expect(metadata.tags).toEqual([]);
      expect(metadata.enabled).toBe(true);
    });

    it('should parse metadata with all fields', () => {
      const metadata = SkillMetadataSchema.parse({
        name: 'advanced-skill',
        displayName: 'Advanced Skill',
        description: 'An advanced skill with all fields',
        version: '2.0.0',
        author: 'system',
        permissions: ['read_files', 'write_files'],
        trustRequired: 'verified',
        tools: ['tool1', { name: 'tool2', required: true }],
        triggers: [{ pattern: 'test' }],
        dependencies: ['other-skill'],
        tags: ['testing', 'advanced'],
        enabled: false,
      });

      expect(metadata.name).toBe('advanced-skill');
      expect(metadata.displayName).toBe('Advanced Skill');
      expect(metadata.permissions).toEqual(['read_files', 'write_files']);
      expect(metadata.trustRequired).toBe('verified');
      expect(metadata.tools).toHaveLength(2);
      expect(metadata.triggers).toHaveLength(1);
      expect(metadata.dependencies).toEqual(['other-skill']);
      expect(metadata.tags).toEqual(['testing', 'advanced']);
      expect(metadata.enabled).toBe(false);
    });

    it('should validate name format (lowercase with hyphens)', () => {
      expect(() =>
        SkillMetadataSchema.parse({
          name: 'valid-name-123',
          description: 'test',
          version: '1.0.0',
        })
      ).not.toThrow();

      expect(() =>
        SkillMetadataSchema.parse({
          name: 'Invalid_Name',
          description: 'test',
          version: '1.0.0',
        })
      ).toThrow();

      expect(() =>
        SkillMetadataSchema.parse({
          name: 'CamelCase',
          description: 'test',
          version: '1.0.0',
        })
      ).toThrow();

      expect(() =>
        SkillMetadataSchema.parse({
          name: 'with spaces',
          description: 'test',
          version: '1.0.0',
        })
      ).toThrow();
    });

    it('should validate version format (semver)', () => {
      expect(() =>
        SkillMetadataSchema.parse({
          name: 'test',
          description: 'test',
          version: '1.0.0',
        })
      ).not.toThrow();

      expect(() =>
        SkillMetadataSchema.parse({
          name: 'test',
          description: 'test',
          version: '10.20.30',
        })
      ).not.toThrow();

      expect(() =>
        SkillMetadataSchema.parse({
          name: 'test',
          description: 'test',
          version: '1.0',
        })
      ).toThrow();

      expect(() =>
        SkillMetadataSchema.parse({
          name: 'test',
          description: 'test',
          version: 'v1.0.0',
        })
      ).toThrow();

      expect(() =>
        SkillMetadataSchema.parse({
          name: 'test',
          description: 'test',
          version: '1.0.0-beta',
        })
      ).toThrow();
    });
  });

  describe('SkillDefinitionSchema', () => {
    const validDefinition = {
      metadata: {
        name: 'test-skill',
        description: 'A test skill',
        version: '1.0.0',
      },
      content: '# Test Skill\n\nInstructions here.',
      source: 'workspace',
      filePath: '/path/to/skill.md',
      status: 'active',
      loadedAt: new Date().toISOString(),
      contentHash: 'abc123def456',
    };

    it('should parse valid skill definition', () => {
      const definition = SkillDefinitionSchema.parse(validDefinition);

      expect(definition.metadata.name).toBe('test-skill');
      expect(definition.content).toBe('# Test Skill\n\nInstructions here.');
      expect(definition.source).toBe('workspace');
      expect(definition.filePath).toBe('/path/to/skill.md');
      expect(definition.status).toBe('active');
      expect(definition.contentHash).toBe('abc123def456');
    });

    it('should require all fields', () => {
      expect(() => SkillDefinitionSchema.parse({})).toThrow();
      expect(() =>
        SkillDefinitionSchema.parse({
          metadata: validDefinition.metadata,
          content: 'test',
        })
      ).toThrow();
    });
  });

  describe('SkillExecutionContextSchema', () => {
    it('should parse valid execution context', () => {
      const context = SkillExecutionContextSchema.parse({
        trustLevel: 'standard',
        input: 'test input',
      });

      expect(context.trustLevel).toBe('standard');
      expect(context.input).toBe('test input');
      expect(context.context).toEqual({});
    });

    it('should parse context with all optional fields', () => {
      const context = SkillExecutionContextSchema.parse({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        channelId: 'main',
        trustLevel: 'verified',
        input: 'test input',
        trigger: { pattern: 'test' },
        context: { custom: 'data' },
      });

      expect(context.sessionId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(context.channelId).toBe('main');
      expect(context.trigger?.pattern).toBe('test');
      expect(context.context).toEqual({ custom: 'data' });
    });

    it('should validate sessionId as UUID', () => {
      expect(() =>
        SkillExecutionContextSchema.parse({
          sessionId: 'invalid-uuid',
          trustLevel: 'standard',
          input: 'test',
        })
      ).toThrow();
    });
  });

  describe('SkillExecutionResultSchema', () => {
    it('should parse successful result', () => {
      const result = SkillExecutionResultSchema.parse({
        skillName: 'test-skill',
        success: true,
        output: 'Result output',
        duration: 100,
        timestamp: new Date().toISOString(),
      });

      expect(result.skillName).toBe('test-skill');
      expect(result.success).toBe(true);
      expect(result.output).toBe('Result output');
      expect(result.duration).toBe(100);
      expect(result.toolsExecuted).toEqual([]);
    });

    it('should parse failed result', () => {
      const result = SkillExecutionResultSchema.parse({
        skillName: 'test-skill',
        success: false,
        error: 'Something went wrong',
        duration: 50,
        timestamp: new Date().toISOString(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Something went wrong');
    });
  });

  describe('SkillQuerySchema', () => {
    it('should parse empty query with defaults', () => {
      const query = SkillQuerySchema.parse({});

      expect(query.enabledOnly).toBe(false);
    });

    it('should parse query with all filters', () => {
      const query = SkillQuerySchema.parse({
        name: 'test',
        source: 'workspace',
        status: 'active',
        tag: 'testing',
        permission: 'read_files',
        trustRequired: 'standard',
        enabledOnly: true,
      });

      expect(query.name).toBe('test');
      expect(query.source).toBe('workspace');
      expect(query.status).toBe('active');
      expect(query.tag).toBe('testing');
      expect(query.permission).toBe('read_files');
      expect(query.trustRequired).toBe('standard');
      expect(query.enabledOnly).toBe(true);
    });
  });

  describe('parseSkillFrontmatter', () => {
    it('should parse valid frontmatter', () => {
      const content = `---
name: test-skill
description: A test skill
version: 1.0.0
enabled: true
---

# Instructions

Do something.`;

      const result = parseSkillFrontmatter(content);

      expect(result.metadata).toEqual({
        name: 'test-skill',
        description: 'A test skill',
        version: '1.0.0',
        enabled: true,
      });
      expect(result.body.trim()).toBe('# Instructions\n\nDo something.');
    });

    it('should parse frontmatter with arrays', () => {
      const content = `---
name: test-skill
description: A test skill
version: 1.0.0
tags:
- testing
- demo
permissions:
- read_files
- write_files
---

Body content`;

      const result = parseSkillFrontmatter(content);

      expect(result.metadata.tags).toEqual(['testing', 'demo']);
      expect(result.metadata.permissions).toEqual(['read_files', 'write_files']);
    });

    it('should handle boolean values', () => {
      const content = `---
name: test
enabled: true
disabled: false
---

Body`;

      const result = parseSkillFrontmatter(content);

      expect(result.metadata.enabled).toBe(true);
      expect(result.metadata.disabled).toBe(false);
    });

    it('should handle numeric values', () => {
      const content = `---
name: test
count: 42
rate: 3.14
---

Body`;

      const result = parseSkillFrontmatter(content);

      expect(result.metadata.count).toBe(42);
      expect(result.metadata.rate).toBe(3.14);
    });

    it('should return empty metadata for content without frontmatter', () => {
      const content = '# Just a heading\n\nSome content.';

      const result = parseSkillFrontmatter(content);

      expect(result.metadata).toEqual({});
      expect(result.body).toBe(content);
    });

    it('should return empty metadata for malformed frontmatter', () => {
      const content = `---
name: test
# Missing closing ---

Body content`;

      const result = parseSkillFrontmatter(content);

      expect(result.metadata).toEqual({});
    });

    it('should strip quotes from values', () => {
      const content = `---
name: "quoted-name"
description: 'single quoted'
---

Body`;

      const result = parseSkillFrontmatter(content);

      expect(result.metadata.name).toBe('quoted-name');
      expect(result.metadata.description).toBe('single quoted');
    });

    it('should skip comments in frontmatter', () => {
      const content = `---
name: test
# This is a comment
description: desc
---

Body`;

      const result = parseSkillFrontmatter(content);

      expect(result.metadata.name).toBe('test');
      expect(result.metadata.description).toBe('desc');
      expect(Object.keys(result.metadata)).not.toContain('#');
    });
  });

  describe('computeSkillHash', () => {
    it('should compute deterministic hash', () => {
      const content = 'Test content';
      const hash1 = computeSkillHash(content);
      const hash2 = computeSkillHash(content);

      expect(hash1).toBe(hash2);
    });

    it('should return 16-character hex string', () => {
      const hash = computeSkillHash('Any content');

      expect(hash).toMatch(/^[a-f0-9]{16}$/);
    });

    it('should produce different hashes for different content', () => {
      const hash1 = computeSkillHash('Content A');
      const hash2 = computeSkillHash('Content B');

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty content', () => {
      const hash = computeSkillHash('');

      expect(hash).toMatch(/^[a-f0-9]{16}$/);
    });

    it('should handle special characters', () => {
      const hash = computeSkillHash('Special chars: \n\t\r"\'<>');

      expect(hash).toMatch(/^[a-f0-9]{16}$/);
    });
  });
});
