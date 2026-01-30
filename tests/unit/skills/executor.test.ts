import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SkillExecutor } from '../../../src/skills/executor.js';
import { SkillRegistry } from '../../../src/skills/registry.js';
import type { SkillDefinition, SkillMetadata, SkillExecutionContext } from '../../../src/skills/types.js';

// Mock EventBus
const createMockEventBus = () => ({
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  once: vi.fn(),
  clear: vi.fn(),
  listenerCount: vi.fn().mockReturnValue(0),
});

// Mock AuditLogger
const createMockAuditLogger = () => ({
  log: vi.fn().mockResolvedValue({}),
  logSecurity: vi.fn().mockResolvedValue({}),
  getEvents: vi.fn().mockReturnValue([]),
  getSecurityEvents: vi.fn().mockReturnValue([]),
  verify: vi.fn().mockResolvedValue({ valid: true }),
});

// Mock Validator
const createMockValidator = () => ({
  validateContent: vi.fn(),
  validatePermissions: vi.fn().mockReturnValue({ allowed: [], denied: [] }),
  validateDefinition: vi.fn(),
  setBlockedPermissions: vi.fn(),
  isBlocked: vi.fn().mockReturnValue(false),
});

// Mock Loader
const createMockLoader = () => ({
  getValidator: vi.fn(),
});

// Mock Registry
const createMockRegistry = () => {
  const skills = new Map<string, SkillDefinition>();

  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    get: vi.fn((name: string) => skills.get(name) || null),
    has: vi.fn((name: string) => skills.has(name)),
    getAll: vi.fn(() => Array.from(skills.values())),
    query: vi.fn().mockReturnValue([]),
    findMatches: vi.fn().mockReturnValue([]),
    findBestMatch: vi.fn().mockReturnValue(null),
    updateStatus: vi.fn().mockResolvedValue(true),
    enable: vi.fn().mockResolvedValue(true),
    disable: vi.fn().mockResolvedValue(true),
    reload: vi.fn().mockResolvedValue(undefined),
    reloadSkill: vi.fn().mockResolvedValue(null),
    getStats: vi.fn().mockReturnValue({}),
    getByTag: vi.fn().mockReturnValue([]),
    getAllTags: vi.fn().mockReturnValue([]),
    isInitialized: vi.fn().mockReturnValue(true),
    getLoader: vi.fn(),
    _skills: skills,
  };
};

// Helper to create a mock skill
const createMockSkill = (overrides: Partial<SkillDefinition> = {}): SkillDefinition => {
  const defaultMetadata: SkillMetadata = {
    name: 'test-skill',
    description: 'A test skill',
    version: '1.0.0',
    author: 'user',
    permissions: [],
    trustRequired: 'standard',
    tools: [],
    triggers: [],
    dependencies: [],
    tags: [],
    enabled: true,
  };

  return {
    metadata: { ...defaultMetadata, ...overrides.metadata },
    content: '# Test Skill\n\nDo something useful.',
    source: 'workspace',
    filePath: '/test/path.md',
    status: 'active',
    loadedAt: new Date().toISOString(),
    contentHash: 'abcd1234',
    ...overrides,
  };
};

describe('SkillExecutor', () => {
  let executor: SkillExecutor;
  let mockRegistry: ReturnType<typeof createMockRegistry>;
  let mockEventBus: ReturnType<typeof createMockEventBus>;
  let mockAudit: ReturnType<typeof createMockAuditLogger>;
  let mockValidator: ReturnType<typeof createMockValidator>;
  let mockLoader: ReturnType<typeof createMockLoader>;

  beforeEach(() => {
    mockRegistry = createMockRegistry();
    mockEventBus = createMockEventBus();
    mockAudit = createMockAuditLogger();
    mockValidator = createMockValidator();
    mockLoader = createMockLoader();

    mockLoader.getValidator.mockReturnValue(mockValidator);
    mockRegistry.getLoader.mockReturnValue(mockLoader);

    executor = new SkillExecutor(
      mockRegistry as unknown as SkillRegistry,
      mockEventBus,
      mockAudit
    );
  });

  describe('execute', () => {
    const defaultContext: SkillExecutionContext = {
      input: 'test input',
      trustLevel: 'standard',
      context: {},
    };

    it('should execute a valid skill', async () => {
      const skill = createMockSkill();
      mockRegistry._skills.set('test-skill', skill);
      mockRegistry.get.mockImplementation((name) => mockRegistry._skills.get(name) || null);
      mockValidator.validatePermissions.mockReturnValue({ allowed: [], denied: [] });

      const result = await executor.execute('test-skill', defaultContext);

      expect(result.success).toBe(true);
      expect(result.skillName).toBe('test-skill');
      expect(result.output).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should fail for non-existent skill', async () => {
      mockRegistry.get.mockReturnValue(null);

      const result = await executor.execute('non-existent', defaultContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Skill not found');
    });

    it('should fail for inactive skill', async () => {
      const skill = createMockSkill({ status: 'inactive' });
      mockRegistry._skills.set('test-skill', skill);
      mockRegistry.get.mockImplementation((name) => mockRegistry._skills.get(name) || null);

      const result = await executor.execute('test-skill', defaultContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not active');
    });

    it('should fail for disabled skill', async () => {
      const skill = createMockSkill({
        metadata: {
          name: 'test-skill',
          description: 'Test',
          version: '1.0.0',
          author: 'user',
          permissions: [],
          trustRequired: 'standard',
          tools: [],
          triggers: [],
          dependencies: [],
          tags: [],
          enabled: false,
        },
      });
      mockRegistry._skills.set('test-skill', skill);
      mockRegistry.get.mockImplementation((name) => mockRegistry._skills.get(name) || null);

      const result = await executor.execute('test-skill', defaultContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled');
    });

    it('should fail if permissions are denied', async () => {
      const skill = createMockSkill({
        metadata: {
          name: 'test-skill',
          description: 'Test',
          version: '1.0.0',
          author: 'user',
          permissions: ['execute_bash'],
          trustRequired: 'standard',
          tools: [],
          triggers: [],
          dependencies: [],
          tags: [],
          enabled: true,
        },
      });
      mockRegistry._skills.set('test-skill', skill);
      mockRegistry.get.mockImplementation((name) => mockRegistry._skills.get(name) || null);
      mockValidator.validatePermissions.mockReturnValue({
        allowed: [],
        denied: ['execute_bash'],
        reason: 'Insufficient trust level for: execute_bash',
      });

      const result = await executor.execute('test-skill', defaultContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient trust level');
      expect(mockAudit.log).toHaveBeenCalledWith(
        'skill_permission_denied',
        'system',
        'standard',
        expect.objectContaining({ deniedPermissions: ['execute_bash'] })
      );
    });

    it('should fail if trust requirement not met', async () => {
      const skill = createMockSkill({
        metadata: {
          name: 'test-skill',
          description: 'Test',
          version: '1.0.0',
          author: 'user',
          permissions: [],
          trustRequired: 'operator',
          tools: [],
          triggers: [],
          dependencies: [],
          tags: [],
          enabled: true,
        },
      });
      mockRegistry._skills.set('test-skill', skill);
      mockRegistry.get.mockImplementation((name) => mockRegistry._skills.get(name) || null);
      mockValidator.validatePermissions.mockReturnValue({ allowed: [], denied: [] });

      const result = await executor.execute('test-skill', defaultContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient trust level');
      expect(mockAudit.log).toHaveBeenCalledWith(
        'skill_trust_denied',
        'system',
        'standard',
        expect.any(Object)
      );
    });

    it('should pass trust check for higher trust level', async () => {
      const skill = createMockSkill({
        metadata: {
          name: 'test-skill',
          description: 'Test',
          version: '1.0.0',
          author: 'user',
          permissions: [],
          trustRequired: 'standard',
          tools: [],
          triggers: [],
          dependencies: [],
          tags: [],
          enabled: true,
        },
      });
      mockRegistry._skills.set('test-skill', skill);
      mockRegistry.get.mockImplementation((name) => mockRegistry._skills.get(name) || null);
      mockValidator.validatePermissions.mockReturnValue({ allowed: [], denied: [] });

      const result = await executor.execute('test-skill', {
        ...defaultContext,
        trustLevel: 'operator',
      });

      expect(result.success).toBe(true);
    });

    it('should perform dry run without execution', async () => {
      const skill = createMockSkill();
      mockRegistry._skills.set('test-skill', skill);
      mockRegistry.get.mockImplementation((name) => mockRegistry._skills.get(name) || null);
      mockValidator.validatePermissions.mockReturnValue({ allowed: [], denied: [] });

      const result = await executor.execute('test-skill', defaultContext, { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.output).toContain('[DRY RUN]');
      expect(result.output).toContain('test-skill');
    });

    it('should log execution start and complete', async () => {
      const skill = createMockSkill();
      mockRegistry._skills.set('test-skill', skill);
      mockRegistry.get.mockImplementation((name) => mockRegistry._skills.get(name) || null);
      mockValidator.validatePermissions.mockReturnValue({ allowed: [], denied: [] });

      await executor.execute('test-skill', defaultContext);

      expect(mockAudit.log).toHaveBeenCalledWith(
        'skill_execution_start',
        'system',
        'standard',
        expect.objectContaining({ skillName: 'test-skill' })
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        'skill_execution_complete',
        'system',
        'standard',
        expect.objectContaining({ skillName: 'test-skill', success: true })
      );
    });

    it('should include session and channel in context', async () => {
      const skill = createMockSkill();
      mockRegistry._skills.set('test-skill', skill);
      mockRegistry.get.mockImplementation((name) => mockRegistry._skills.get(name) || null);
      mockValidator.validatePermissions.mockReturnValue({ allowed: [], denied: [] });

      const result = await executor.execute('test-skill', {
        ...defaultContext,
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        channelId: 'main',
      });

      expect(result.output).toContain('Session: 550e8400-e29b-41d4-a716-446655440000');
      expect(result.output).toContain('Channel: main');
    });

    it('should track execution duration', async () => {
      const skill = createMockSkill();
      mockRegistry._skills.set('test-skill', skill);
      mockRegistry.get.mockImplementation((name) => mockRegistry._skills.get(name) || null);
      mockValidator.validatePermissions.mockReturnValue({ allowed: [], denied: [] });

      const result = await executor.execute('test-skill', defaultContext);

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.duration).toBe('number');
    });

    it('should include timestamp in result', async () => {
      const skill = createMockSkill();
      mockRegistry._skills.set('test-skill', skill);
      mockRegistry.get.mockImplementation((name) => mockRegistry._skills.get(name) || null);
      mockValidator.validatePermissions.mockReturnValue({ allowed: [], denied: [] });

      const result = await executor.execute('test-skill', defaultContext);

      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).getTime()).not.toBeNaN();
    });

    it('should format output with skill metadata', async () => {
      const skill = createMockSkill({
        metadata: {
          name: 'test-skill',
          description: 'A helpful skill',
          version: '2.0.0',
          author: 'user',
          permissions: ['read_files', 'write_files'],
          trustRequired: 'standard',
          tools: ['tool1', { name: 'tool2', required: true }],
          triggers: [],
          dependencies: [],
          tags: [],
          enabled: true,
        },
      });
      mockRegistry._skills.set('test-skill', skill);
      mockRegistry.get.mockImplementation((name) => mockRegistry._skills.get(name) || null);
      mockValidator.validatePermissions.mockReturnValue({ allowed: ['read_files', 'write_files'], denied: [] });

      const result = await executor.execute('test-skill', defaultContext);

      expect(result.output).toContain('name="test-skill"');
      expect(result.output).toContain('version="2.0.0"');
      expect(result.output).toContain('<description>A helpful skill</description>');
      expect(result.output).toContain('read_files, write_files');
      expect(result.output).toContain('tool1, tool2');
    });
  });

  describe('executeMatch', () => {
    const defaultTrustLevel = 'standard' as const;

    it('should execute matching skill', async () => {
      const skill = createMockSkill({
        metadata: {
          name: 'greeting',
          description: 'Greeting skill',
          version: '1.0.0',
          author: 'user',
          permissions: [],
          trustRequired: 'standard',
          tools: [],
          triggers: [{ pattern: 'hello', confidence: 0.8, isRegex: false, priority: 0 }],
          dependencies: [],
          tags: [],
          enabled: true,
        },
      });
      mockRegistry._skills.set('greeting', skill);
      mockRegistry.get.mockImplementation((name) => mockRegistry._skills.get(name) || null);
      mockRegistry.findBestMatch.mockReturnValue({
        skill,
        trigger: { pattern: 'hello', confidence: 0.8, isRegex: false, priority: 0 },
        confidence: 1.0,
      });
      mockValidator.validatePermissions.mockReturnValue({ allowed: [], denied: [] });

      const result = await executor.executeMatch('hello', defaultTrustLevel);

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.skillName).toBe('greeting');
    });

    it('should return null if no match', async () => {
      mockRegistry.findBestMatch.mockReturnValue(null);

      const result = await executor.executeMatch('no match', defaultTrustLevel);

      expect(result).toBeNull();
    });

    it('should pass session and channel to execution', async () => {
      const skill = createMockSkill();
      mockRegistry._skills.set('test-skill', skill);
      mockRegistry.get.mockImplementation((name) => mockRegistry._skills.get(name) || null);
      mockRegistry.findBestMatch.mockReturnValue({
        skill,
        trigger: { pattern: 'test', confidence: 0.8, isRegex: false, priority: 0 },
        confidence: 1.0,
      });
      mockValidator.validatePermissions.mockReturnValue({ allowed: [], denied: [] });

      const result = await executor.executeMatch(
        'test',
        defaultTrustLevel,
        '550e8400-e29b-41d4-a716-446655440000',
        'main'
      );

      expect(result?.output).toContain('Session: 550e8400-e29b-41d4-a716-446655440000');
      expect(result?.output).toContain('Channel: main');
    });

    it('should include match confidence in context', async () => {
      const skill = createMockSkill();
      mockRegistry._skills.set('test-skill', skill);
      mockRegistry.get.mockImplementation((name) => mockRegistry._skills.get(name) || null);
      mockRegistry.findBestMatch.mockReturnValue({
        skill,
        trigger: { pattern: 'test', confidence: 0.8, isRegex: false, priority: 0 },
        confidence: 0.95,
      });
      mockValidator.validatePermissions.mockReturnValue({ allowed: [], denied: [] });

      const result = await executor.executeMatch('test', defaultTrustLevel);

      expect(result?.success).toBe(true);
    });
  });

  describe('getActiveExecutions', () => {
    it('should return empty array when no executions', () => {
      const executions = executor.getActiveExecutions();

      expect(executions).toEqual([]);
    });

    // Note: Testing active executions is difficult without async control
    // In a real scenario, we'd use more sophisticated mocking
  });

  describe('cancelExecution', () => {
    it('should return false for non-existent execution', async () => {
      const result = await executor.cancelExecution('non-existent-id');

      expect(result).toBe(false);
    });
  });

  describe('activeCount', () => {
    it('should return 0 when no active executions', () => {
      expect(executor.activeCount).toBe(0);
    });
  });

  describe('trust level hierarchy', () => {
    const trustLevels = ['hostile', 'untrusted', 'standard', 'verified', 'operator', 'system'] as const;

    it.each(trustLevels)('should handle %s trust level', async (trustLevel) => {
      const skill = createMockSkill({
        metadata: {
          name: 'test-skill',
          description: 'Test',
          version: '1.0.0',
          author: 'user',
          permissions: [],
          trustRequired: 'standard',
          tools: [],
          triggers: [],
          dependencies: [],
          tags: [],
          enabled: true,
        },
      });
      mockRegistry._skills.set('test-skill', skill);
      mockRegistry.get.mockImplementation((name) => mockRegistry._skills.get(name) || null);
      mockValidator.validatePermissions.mockReturnValue({ allowed: [], denied: [] });

      const result = await executor.execute('test-skill', {
        input: 'test',
        trustLevel,
        context: {},
      });

      // Standard and above should succeed, below should fail
      const trustIndex = trustLevels.indexOf(trustLevel);
      const standardIndex = trustLevels.indexOf('standard');

      if (trustIndex >= standardIndex) {
        expect(result.success).toBe(true);
      } else {
        expect(result.success).toBe(false);
        expect(result.error).toContain('trust level');
      }
    });
  });

  describe('skill status checks', () => {
    const statuses = ['active', 'inactive', 'pending_approval', 'rejected'] as const;

    it.each(statuses)('should handle %s status', async (status) => {
      const skill = createMockSkill({ status });
      mockRegistry._skills.set('test-skill', skill);
      mockRegistry.get.mockImplementation((name) => mockRegistry._skills.get(name) || null);
      mockValidator.validatePermissions.mockReturnValue({ allowed: [], denied: [] });

      const result = await executor.execute('test-skill', {
        input: 'test',
        trustLevel: 'standard',
        context: {},
      });

      if (status === 'active') {
        expect(result.success).toBe(true);
      } else {
        expect(result.success).toBe(false);
        expect(result.error).toContain('not active');
      }
    });
  });
});
