import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { SessionState } from '../../../src/system/session-state.js';
import type { SessionSnapshot } from '../../../src/system/session-state.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockEmit = vi.fn();
const mockEventBus = { emit: mockEmit } as unknown as import('../../../src/kernel/event-bus.js').EventBus;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SessionState', () => {
  let testDir: string;
  let testPath: string;
  let session: SessionState;

  beforeEach(() => {
    vi.clearAllMocks();
    testDir = join(tmpdir(), `ari-session-test-${randomUUID()}`);
    testPath = join(testDir, 'SESSION_STATE.md');
    session = new SessionState(testPath, mockEventBus);
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  const makeSnapshot = (overrides: Partial<SessionSnapshot> = {}): SessionSnapshot => ({
    lastActive: '2026-02-18T12:00:00.000Z',
    pendingItems: [],
    activeAgents: [],
    systemHealth: 'healthy',
    context: {},
    uptime: 0,
    version: '1.0.0',
    ...overrides,
  });

  describe('save()', () => {
    it('should create the state file', () => {
      session.save(makeSnapshot());

      expect(existsSync(testPath)).toBe(true);
    });

    it('should create the directory if it does not exist', () => {
      expect(existsSync(testDir)).toBe(false);

      session.save(makeSnapshot());

      expect(existsSync(testDir)).toBe(true);
    });

    it('should write markdown content', () => {
      session.save(makeSnapshot({ version: '2.0.0' }));

      const content = readFileSync(testPath, 'utf-8');
      expect(content).toContain('# ARI Session State');
      expect(content).toContain('2.0.0');
    });

    it('should include system health in output', () => {
      session.save(makeSnapshot({ systemHealth: 'degraded' }));

      const content = readFileSync(testPath, 'utf-8');
      expect(content).toContain('degraded');
    });

    it('should include pending items as checkboxes', () => {
      session.save(makeSnapshot({ pendingItems: ['item 1', 'item 2'] }));

      const content = readFileSync(testPath, 'utf-8');
      expect(content).toContain('- [ ] item 1');
      expect(content).toContain('- [ ] item 2');
    });

    it('should include active agents as bullet list', () => {
      session.save(makeSnapshot({ activeAgents: ['guardian', 'planner'] }));

      const content = readFileSync(testPath, 'utf-8');
      expect(content).toContain('- guardian');
      expect(content).toContain('- planner');
    });

    it('should include current task when set', () => {
      session.save(makeSnapshot({ currentTask: 'Building video pipeline' }));

      const content = readFileSync(testPath, 'utf-8');
      expect(content).toContain('Building video pipeline');
    });

    it('should serialize context as JSON', () => {
      session.save(makeSnapshot({ context: { key: 'value', num: 42 } }));

      const content = readFileSync(testPath, 'utf-8');
      expect(content).toContain('"key": "value"');
      expect(content).toContain('"num": 42');
    });

    it('should emit session:state_saved event', () => {
      session.save(makeSnapshot());

      expect(mockEmit).toHaveBeenCalledWith('session:state_saved', expect.objectContaining({
        timestamp: expect.any(String),
      }));
    });
  });

  describe('load()', () => {
    it('should return null when no state file exists', () => {
      const result = session.load();

      expect(result).toBeNull();
    });

    it('should load a previously saved state', () => {
      const snapshot = makeSnapshot({
        version: '3.0.0',
        systemHealth: 'critical',
        uptime: 3600,
      });
      session.save(snapshot);

      const loaded = session.load();

      expect(loaded).not.toBeNull();
      expect(loaded!.version).toBe('3.0.0');
      expect(loaded!.systemHealth).toBe('critical');
      expect(loaded!.uptime).toBe(3600);
    });

    it('should restore pending items', () => {
      session.save(makeSnapshot({ pendingItems: ['task A', 'task B'] }));

      const loaded = session.load();

      expect(loaded!.pendingItems).toEqual(['task A', 'task B']);
    });

    it('should restore active agents', () => {
      session.save(makeSnapshot({ activeAgents: ['executor', 'guardian'] }));

      const loaded = session.load();

      expect(loaded!.activeAgents).toEqual(['executor', 'guardian']);
    });

    it('should restore current task', () => {
      session.save(makeSnapshot({ currentTask: 'Processing batch' }));

      const loaded = session.load();

      expect(loaded!.currentTask).toBe('Processing batch');
    });

    it('should restore context JSON', () => {
      session.save(makeSnapshot({ context: { nested: { deep: true } } }));

      const loaded = session.load();

      expect(loaded!.context).toEqual({ nested: { deep: true } });
    });

    it('should emit session:state_restored event on load', () => {
      session.save(makeSnapshot({ pendingItems: ['item'] }));

      session.load();

      expect(mockEmit).toHaveBeenCalledWith('session:state_restored', expect.objectContaining({
        pendingItems: 1,
      }));
    });
  });

  describe('update()', () => {
    it('should update specific fields without losing others', () => {
      session.save(makeSnapshot({
        version: '1.0.0',
        systemHealth: 'healthy',
        pendingItems: ['keep me'],
      }));

      session.update({ systemHealth: 'degraded' });

      const loaded = session.load();
      expect(loaded!.systemHealth).toBe('degraded');
      expect(loaded!.version).toBe('1.0.0');
      expect(loaded!.pendingItems).toEqual(['keep me']);
    });

    it('should update lastActive timestamp', () => {
      session.save(makeSnapshot({ lastActive: '2020-01-01T00:00:00.000Z' }));

      session.update({ uptime: 999 });

      const loaded = session.load();
      expect(loaded!.lastActive).not.toBe('2020-01-01T00:00:00.000Z');
    });

    it('should create state file if none exists', () => {
      session.update({ systemHealth: 'degraded' });

      expect(existsSync(testPath)).toBe(true);
      const loaded = session.load();
      expect(loaded!.systemHealth).toBe('degraded');
    });
  });

  describe('clear()', () => {
    it('should remove the state file', () => {
      session.save(makeSnapshot());
      expect(existsSync(testPath)).toBe(true);

      session.clear();

      expect(existsSync(testPath)).toBe(false);
    });

    it('should not throw when file does not exist', () => {
      expect(() => session.clear()).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle state with no pending items', () => {
      session.save(makeSnapshot({ pendingItems: [] }));

      const loaded = session.load();
      expect(loaded!.pendingItems).toEqual([]);
    });

    it('should handle state with no active agents', () => {
      session.save(makeSnapshot({ activeAgents: [] }));

      const loaded = session.load();
      expect(loaded!.activeAgents).toEqual([]);
    });

    it('should work without event bus', () => {
      const sessionNoEvents = new SessionState(testPath);

      expect(() => sessionNoEvents.save(makeSnapshot())).not.toThrow();
      expect(sessionNoEvents.load()).not.toBeNull();
    });

    it('should handle empty context', () => {
      session.save(makeSnapshot({ context: {} }));

      const loaded = session.load();
      expect(loaded!.context).toEqual({});
    });
  });
});
