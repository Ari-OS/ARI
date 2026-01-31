import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { writeFileSync, unlinkSync } from 'fs';
import { ToolRegistry } from '../../../src/execution/tool-registry.js';
import { AuditLogger } from '../../../src/kernel/audit.js';
import { EventBus } from '../../../src/kernel/event-bus.js';
import type { ToolCapability } from '../../../src/kernel/types.js';
import type { ToolHandler } from '../../../src/execution/types.js';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  let auditLogger: AuditLogger;
  let eventBus: EventBus;
  let testAuditPath: string;

  const createCapability = (overrides: Partial<ToolCapability> = {}): ToolCapability => ({
    id: 'test_tool',
    name: 'Test Tool',
    description: 'A test tool',
    timeout_ms: 5000,
    sandboxed: true,
    parameters: {},
    ...overrides,
  });

  const dummyHandler: ToolHandler = async () => ({ result: 'ok' });

  beforeEach(() => {
    testAuditPath = join(tmpdir(), `audit-${randomUUID()}.json`);
    auditLogger = new AuditLogger(testAuditPath);
    eventBus = new EventBus();
    registry = new ToolRegistry(auditLogger, eventBus);
  });

  describe('Registration', () => {
    it('should register a tool', () => {
      const capability = createCapability({ id: 'file_read' });
      registry.register(capability, dummyHandler);

      expect(registry.has('file_read')).toBe(true);
      expect(registry.size).toBe(1);
    });

    it('should throw when registering duplicate tool', () => {
      const capability = createCapability({ id: 'duplicate' });
      registry.register(capability, dummyHandler);

      expect(() => registry.register(capability, dummyHandler)).toThrow('already registered');
    });

    it('should emit tool:registered event', () => {
      const events: unknown[] = [];
      eventBus.on('tool:registered', (e) => events.push(e));

      registry.register(createCapability({ id: 'new_tool' }), dummyHandler);

      expect(events.length).toBe(1);
      expect((events[0] as { toolId: string }).toolId).toBe('new_tool');
    });
  });

  describe('Retrieval', () => {
    beforeEach(() => {
      registry.register(
        createCapability({
          id: 'read_file',
          name: 'Read File',
          parameters: {
            path: { type: 'string', required: true, description: 'File path' },
          },
        }),
        dummyHandler
      );
    });

    it('should get registered tool', () => {
      const tool = registry.get('read_file');
      expect(tool).toBeDefined();
      expect(tool?.capability.name).toBe('Read File');
      expect(tool?.handler).toBeDefined();
    });

    it('should return undefined for unregistered tool', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });

    it('should get capability without handler', () => {
      const capability = registry.getCapability('read_file');
      expect(capability).toBeDefined();
      expect(capability?.id).toBe('read_file');
    });

    it('should list all tool IDs', () => {
      registry.register(createCapability({ id: 'tool_2' }), dummyHandler);

      const ids = registry.getToolIds();
      expect(ids).toContain('read_file');
      expect(ids).toContain('tool_2');
    });

    it('should get all capabilities', () => {
      registry.register(createCapability({ id: 'tool_2' }), dummyHandler);

      const capabilities = registry.getAllCapabilities();
      expect(capabilities).toHaveLength(2);
      expect(capabilities.every((c) => c.id)).toBe(true);
    });
  });

  describe('Unregistration', () => {
    it('should unregister existing tool', () => {
      registry.register(createCapability({ id: 'to_remove' }), dummyHandler);
      expect(registry.has('to_remove')).toBe(true);

      const removed = registry.unregister('to_remove');
      expect(removed).toBe(true);
      expect(registry.has('to_remove')).toBe(false);
    });

    it('should return false for nonexistent tool', () => {
      const removed = registry.unregister('nonexistent');
      expect(removed).toBe(false);
    });

    it('should emit tool:unregistered event', () => {
      registry.register(createCapability({ id: 'to_remove' }), dummyHandler);

      const events: unknown[] = [];
      eventBus.on('tool:unregistered', (e) => events.push(e));

      registry.unregister('to_remove');

      expect(events.length).toBe(1);
      expect((events[0] as { toolId: string }).toolId).toBe('to_remove');
    });
  });

  describe('Parameter Validation', () => {
    beforeEach(() => {
      registry.register(
        createCapability({
          id: 'validated_tool',
          parameters: {
            name: { type: 'string', required: true, description: 'Name' },
            count: { type: 'number', required: true, description: 'Count' },
            enabled: { type: 'boolean', required: false, description: 'Enabled' },
          },
        }),
        dummyHandler
      );
    });

    it('should pass valid parameters', () => {
      const result = registry.validateParameters('validated_tool', {
        name: 'test',
        count: 5,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail missing required parameter', () => {
      const result = registry.validateParameters('validated_tool', {
        name: 'test',
        // missing count
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('count'))).toBe(true);
    });

    it('should fail wrong type for string', () => {
      const result = registry.validateParameters('validated_tool', {
        name: 123, // should be string
        count: 5,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('name') && e.includes('string'))).toBe(true);
    });

    it('should fail wrong type for number', () => {
      const result = registry.validateParameters('validated_tool', {
        name: 'test',
        count: 'five', // should be number
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('count') && e.includes('number'))).toBe(true);
    });

    it('should allow optional parameter to be missing', () => {
      const result = registry.validateParameters('validated_tool', {
        name: 'test',
        count: 5,
        // enabled is optional
      });

      expect(result.valid).toBe(true);
    });

    it('should fail for nonexistent tool', () => {
      const result = registry.validateParameters('nonexistent', {});
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('not found'))).toBe(true);
    });
  });

  describe('Timeout and Sandbox', () => {
    it('should return configured timeout', () => {
      registry.register(createCapability({ id: 'slow_tool', timeout_ms: 60000 }), dummyHandler);
      expect(registry.getTimeout('slow_tool')).toBe(60000);
    });

    it('should return default timeout for unknown tool', () => {
      expect(registry.getTimeout('nonexistent')).toBe(30000);
    });

    it('should report sandbox status', () => {
      registry.register(createCapability({ id: 'sandboxed', sandboxed: true }), dummyHandler);
      registry.register(createCapability({ id: 'unsandboxed', sandboxed: false }), dummyHandler);

      expect(registry.isSandboxed('sandboxed')).toBe(true);
      expect(registry.isSandboxed('unsandboxed')).toBe(false);
    });

    it('should default to sandboxed for unknown tool', () => {
      expect(registry.isSandboxed('nonexistent')).toBe(true);
    });
  });

  describe('Config Loading', () => {
    let configPath: string;

    beforeEach(() => {
      configPath = join(tmpdir(), `tool-capabilities-${randomUUID()}.json`);
    });

    afterEach(() => {
      try {
        unlinkSync(configPath);
      } catch {
        // File may not exist
      }
    });

    it('should load capabilities from config file', () => {
      const config = {
        version: '1.0.0',
        description: 'Test config',
        tools: [
          {
            id: 'config_tool_1',
            name: 'Config Tool 1',
            description: 'First tool from config',
            timeout_ms: 5000,
            sandboxed: true,
            parameters: { path: { type: 'string', required: true, description: 'Path' } },
          },
          {
            id: 'config_tool_2',
            name: 'Config Tool 2',
            description: 'Second tool from config',
            timeout_ms: 10000,
            sandboxed: false,
            parameters: {},
          },
        ],
      };

      writeFileSync(configPath, JSON.stringify(config));

      const loaded = registry.loadCapabilitiesFromConfig(configPath);

      expect(loaded).toBe(2);
      expect(registry.has('config_tool_1')).toBe(true);
      expect(registry.has('config_tool_2')).toBe(true);
      expect(registry.getTimeout('config_tool_1')).toBe(5000);
      expect(registry.isSandboxed('config_tool_2')).toBe(false);
    });

    it('should not replace existing tools when loading config', () => {
      // Pre-register a tool
      registry.register(createCapability({ id: 'existing_tool' }), dummyHandler);

      const config = {
        version: '1.0.0',
        description: 'Test config',
        tools: [
          {
            id: 'existing_tool', // Same ID as pre-registered
            name: 'Should Not Replace',
            description: 'This should be ignored',
            timeout_ms: 99999,
            sandboxed: false,
            parameters: {},
          },
        ],
      };

      writeFileSync(configPath, JSON.stringify(config));

      const loaded = registry.loadCapabilitiesFromConfig(configPath);

      expect(loaded).toBe(0); // No new tools loaded
      expect(registry.getTimeout('existing_tool')).toBe(5000); // Original timeout
    });

    it('should create placeholder handlers for config-loaded tools', () => {
      const config = {
        version: '1.0.0',
        description: 'Test config',
        tools: [
          {
            id: 'placeholder_tool',
            name: 'Placeholder Tool',
            description: 'Has placeholder handler',
            timeout_ms: 5000,
            sandboxed: true,
            parameters: {},
          },
        ],
      };

      writeFileSync(configPath, JSON.stringify(config));
      registry.loadCapabilitiesFromConfig(configPath);

      expect(registry.has('placeholder_tool')).toBe(true);
      expect(registry.hasHandler('placeholder_tool')).toBe(false);
    });

    it('should register handler for config-loaded tool', () => {
      const config = {
        version: '1.0.0',
        description: 'Test config',
        tools: [
          {
            id: 'handler_tool',
            name: 'Handler Tool',
            description: 'Will get a handler',
            timeout_ms: 5000,
            sandboxed: true,
            parameters: {},
          },
        ],
      };

      writeFileSync(configPath, JSON.stringify(config));
      registry.loadCapabilitiesFromConfig(configPath);

      expect(registry.hasHandler('handler_tool')).toBe(false);

      registry.registerHandler('handler_tool', async () => 'handled');

      expect(registry.hasHandler('handler_tool')).toBe(true);
    });

    it('should throw when registering handler for nonexistent tool', () => {
      expect(() => registry.registerHandler('nonexistent', dummyHandler)).toThrow(
        'capability nonexistent not found'
      );
    });

    it('should emit tool:registered when handler is registered', () => {
      const config = {
        version: '1.0.0',
        description: 'Test config',
        tools: [
          {
            id: 'event_tool',
            name: 'Event Tool',
            description: 'Emits event on handler registration',
            timeout_ms: 5000,
            sandboxed: true,
            parameters: {},
          },
        ],
      };

      writeFileSync(configPath, JSON.stringify(config));
      registry.loadCapabilitiesFromConfig(configPath);

      const events: unknown[] = [];
      eventBus.on('tool:registered', (e) => events.push(e));

      registry.registerHandler('event_tool', dummyHandler);

      expect(events.length).toBe(1);
      expect((events[0] as { toolId: string }).toolId).toBe('event_tool');
    });
  });
});
