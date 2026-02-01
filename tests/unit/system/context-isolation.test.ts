import { describe, it, expect, beforeEach } from 'vitest';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { ContextIsolation } from '../../../src/system/context-isolation.js';
import { AuditLogger } from '../../../src/kernel/audit.js';
import { EventBus } from '../../../src/kernel/event-bus.js';
import type { AgentId } from '../../../src/kernel/types.js';

describe('ContextIsolation', () => {
  let contextIsolation: ContextIsolation;
  let auditLogger: AuditLogger;
  let eventBus: EventBus;

  beforeEach(() => {
    const logPath = join(tmpdir(), `audit-${randomUUID()}.jsonl`);
    auditLogger = new AuditLogger(logPath);
    eventBus = new EventBus();
    contextIsolation = new ContextIsolation(auditLogger, eventBus);
  });

  describe('namespace assignment', () => {
    it('should assign agent to namespace', () => {
      contextIsolation.setAgentNamespace('marketing' as AgentId, 'ventures');

      const namespace = contextIsolation.getAgentNamespace('marketing' as AgentId);
      expect(namespace).toBe('ventures');
    });

    it('should return undefined for unassigned agent', () => {
      const namespace = contextIsolation.getAgentNamespace('marketing' as AgentId);
      expect(namespace).toBeUndefined();
    });

    it('should update namespace when reassigning', () => {
      contextIsolation.setAgentNamespace('marketing' as AgentId, 'ventures');
      contextIsolation.setAgentNamespace('marketing' as AgentId, 'life');

      const namespace = contextIsolation.getAgentNamespace('marketing' as AgentId);
      expect(namespace).toBe('life');
    });

    it('should log namespace assignment to audit', () => {
      contextIsolation.setAgentNamespace('marketing' as AgentId, 'ventures');

      const events = auditLogger.getEvents();
      const assignmentEvent = events.find(e => e.action === 'context:namespace_assigned');

      expect(assignmentEvent).toBeDefined();
      expect(assignmentEvent?.details).toMatchObject({
        agent: 'marketing',
        namespace: 'ventures',
      });
    });
  });

  describe('same namespace access', () => {
    it('should allow read access to own namespace', () => {
      contextIsolation.setAgentNamespace('marketing' as AgentId, 'ventures');

      const result = contextIsolation.checkAccess('marketing' as AgentId, 'ventures', false);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Agent is accessing its own namespace');
    });

    it('should allow write access to own namespace', () => {
      contextIsolation.setAgentNamespace('marketing' as AgentId, 'ventures');

      const result = contextIsolation.checkAccess('marketing' as AgentId, 'ventures', true);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Agent is accessing its own namespace');
    });
  });

  describe('cross-namespace access', () => {
    it('should deny access from life to ventures', () => {
      contextIsolation.setAgentNamespace('planner' as AgentId, 'life');

      const result = contextIsolation.checkAccess('planner' as AgentId, 'ventures', false);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Cannot access ventures namespace from life namespace');
    });

    it('should deny access from ventures to life', () => {
      contextIsolation.setAgentNamespace('marketing' as AgentId, 'ventures');

      const result = contextIsolation.checkAccess('marketing' as AgentId, 'life', false);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Cannot access life namespace from ventures namespace');
    });

    it('should deny write access from ventures to life', () => {
      contextIsolation.setAgentNamespace('marketing' as AgentId, 'ventures');

      const result = contextIsolation.checkAccess('marketing' as AgentId, 'life', true);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Cannot access life namespace from ventures namespace');
    });
  });

  describe('system namespace access', () => {
    it('should allow all agents to read system namespace', () => {
      contextIsolation.setAgentNamespace('marketing' as AgentId, 'ventures');

      const result = contextIsolation.checkAccess('marketing' as AgentId, 'system', false);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('System namespace is readable by all agents');
    });

    it('should deny non-system agents from writing to system namespace', () => {
      contextIsolation.setAgentNamespace('marketing' as AgentId, 'ventures');

      const result = contextIsolation.checkAccess('marketing' as AgentId, 'system', true);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Only system agents can write to system namespace');
    });

    it('should allow system agent (core) to write to system namespace', () => {
      contextIsolation.setAgentNamespace('core' as AgentId, 'system');

      const result = contextIsolation.checkAccess('core' as AgentId, 'system', true);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Agent is accessing its own namespace');
    });

    it('should allow system agent (arbiter) to write to system namespace from different namespace', () => {
      contextIsolation.setAgentNamespace('arbiter' as AgentId, 'life');

      const result = contextIsolation.checkAccess('arbiter' as AgentId, 'system', true);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('System agent can write to system namespace');
    });

    it('should allow system agent (overseer) to write to system namespace', () => {
      contextIsolation.setAgentNamespace('overseer' as AgentId, 'ventures');

      const result = contextIsolation.checkAccess('overseer' as AgentId, 'system', true);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('System agent can write to system namespace');
    });

    it('should allow system agent (memory_keeper) to write to system namespace', () => {
      contextIsolation.setAgentNamespace('memory_keeper' as AgentId, 'ventures');

      const result = contextIsolation.checkAccess('memory_keeper' as AgentId, 'system', true);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('System agent can write to system namespace');
    });
  });

  describe('system agent cross-namespace access', () => {
    it('should allow system agent (core) to access ventures from system', () => {
      contextIsolation.setAgentNamespace('core' as AgentId, 'system');

      const result = contextIsolation.checkAccess('core' as AgentId, 'ventures', false);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('System agent has cross-namespace access');
    });

    it('should allow system agent (arbiter) to write to life from ventures', () => {
      contextIsolation.setAgentNamespace('arbiter' as AgentId, 'ventures');

      const result = contextIsolation.checkAccess('arbiter' as AgentId, 'life', true);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('System agent has cross-namespace access');
    });

    it('should allow system agent (memory_keeper) to access all namespaces', () => {
      contextIsolation.setAgentNamespace('memory_keeper' as AgentId, 'system');

      const lifeAccess = contextIsolation.checkAccess('memory_keeper' as AgentId, 'life', true);
      const venturesAccess = contextIsolation.checkAccess('memory_keeper' as AgentId, 'ventures', true);

      expect(lifeAccess.allowed).toBe(true);
      expect(venturesAccess.allowed).toBe(true);
    });
  });

  describe('unassigned agent access', () => {
    it('should deny access for agent with no namespace', () => {
      // Using 'wealth' (MINT) as a test agent - a valid 15-member Council agent
      const result = contextIsolation.checkAccess('wealth' as AgentId, 'ventures', false);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Agent wealth has no assigned namespace');
    });

    it('should deny write access for agent with no namespace', () => {
      const result = contextIsolation.checkAccess('wealth' as AgentId, 'life', true);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Agent wealth has no assigned namespace');
    });
  });

  describe('memory access validation', () => {
    it('should return true for valid memory access', () => {
      contextIsolation.setAgentNamespace('wealth' as AgentId, 'ventures');

      const result = contextIsolation.validateMemoryAccess('wealth' as AgentId, 'ventures', false);

      expect(result).toBe(true);
    });

    it('should return false for invalid memory access', () => {
      contextIsolation.setAgentNamespace('wealth' as AgentId, 'ventures');

      const result = contextIsolation.validateMemoryAccess('wealth' as AgentId, 'life', false);

      expect(result).toBe(false);
    });

    it('should log denied access attempts to audit', () => {
      contextIsolation.setAgentNamespace('wealth' as AgentId, 'ventures');

      contextIsolation.validateMemoryAccess('wealth' as AgentId, 'life', false);

      const events = auditLogger.getEvents();
      const deniedEvent = events.find(e => e.action === 'context:access_denied');

      expect(deniedEvent).toBeDefined();
      expect(deniedEvent?.actor).toBe('wealth');
      expect(deniedEvent?.details).toMatchObject({
        memory_namespace: 'life',
        agent_namespace: 'ventures',
        write: false,
      });
    });

    it('should validate write access correctly', () => {
      contextIsolation.setAgentNamespace('wealth' as AgentId, 'ventures');

      const readResult = contextIsolation.validateMemoryAccess('wealth' as AgentId, 'system', false);
      const writeResult = contextIsolation.validateMemoryAccess('wealth' as AgentId, 'system', true);

      expect(readResult).toBe(true);
      expect(writeResult).toBe(false);
    });
  });
});
