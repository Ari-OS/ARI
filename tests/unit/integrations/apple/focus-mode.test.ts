import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FocusModeDetector, type FocusModeState } from '../../../../src/integrations/apple/focus-mode.js';

// Mock fs
vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn(),
  },
}));

// Mock child_process
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

// Mock logger
vi.mock('../../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';

const fsMock = vi.mocked(fs);
const execFileMock = vi.mocked(execFile);

// ─── Test Data ──────────────────────────────────────────────────────────────

const ACTIVE_DND_DB = JSON.stringify({
  data: [{
    storeAssertionRecords: {
      'assertion-1': {
        assertionDetails: {
          assertionDetailsModeIdentifier: 'com.apple.donotdisturb.mode.default',
          assertionDetailsDate: Math.floor(Date.now() / 1000) - 3600,
        },
      },
    },
  }],
});

const ACTIVE_WORK_FOCUS_DB = JSON.stringify({
  data: [{
    storeAssertionRecords: {
      'assertion-1': {
        assertionDetails: {
          assertionDetailsModeIdentifier: 'com.apple.focus.work',
          assertionDetailsDate: Math.floor(Date.now() / 1000) - 1800,
          assertionDetailsExpiryDate: Math.floor(Date.now() / 1000) + 3600,
        },
      },
    },
  }],
});

const EXPIRED_FOCUS_DB = JSON.stringify({
  data: [{
    storeAssertionRecords: {
      'assertion-1': {
        assertionDetails: {
          assertionDetailsModeIdentifier: 'com.apple.focus.work',
          assertionDetailsDate: Math.floor(Date.now() / 1000) - 7200,
          assertionDetailsExpiryDate: Math.floor(Date.now() / 1000) - 3600,
        },
      },
    },
  }],
});

const EMPTY_DB = JSON.stringify({
  data: [{
    storeAssertionRecords: {},
  }],
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('FocusModeDetector', () => {
  let detector: FocusModeDetector;

  beforeEach(() => {
    vi.clearAllMocks();
    detector = new FocusModeDetector({
      assertionsDbPath: '/mock/Assertions.json',
      cacheTtlMs: 0, // Disable cache for tests
    });
  });

  describe('getCurrentState', () => {
    it('should detect active Do Not Disturb mode', async () => {
      fsMock.readFile.mockResolvedValue(ACTIVE_DND_DB);

      const state = await detector.getCurrentState();

      expect(state.active).toBe(true);
      expect(state.mode).toBe('do-not-disturb');
      expect(state.activatedAt).toBeInstanceOf(Date);
    });

    it('should detect active Work Focus mode with expiry', async () => {
      fsMock.readFile.mockResolvedValue(ACTIVE_WORK_FOCUS_DB);

      const state = await detector.getCurrentState();

      expect(state.active).toBe(true);
      expect(state.mode).toBe('work');
      expect(state.expiresAt).toBeInstanceOf(Date);
      expect(state.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should report inactive when Focus has expired', async () => {
      fsMock.readFile.mockResolvedValue(EXPIRED_FOCUS_DB);

      const state = await detector.getCurrentState();

      expect(state.active).toBe(false);
      expect(state.mode).toBeNull();
    });

    it('should report inactive when no assertions exist', async () => {
      fsMock.readFile.mockResolvedValue(EMPTY_DB);

      const state = await detector.getCurrentState();

      expect(state.active).toBe(false);
      expect(state.mode).toBeNull();
    });

    it('should fall back to defaults command when Assertions.json is missing', async () => {
      fsMock.readFile.mockRejectedValue(new Error('ENOENT'));
      execFileMock.mockImplementation((...allArgs: unknown[]) => {
        const callback = [...allArgs].reverse().find((a) => typeof a === 'function') as
          | ((err: Error | null, result: { stdout: string; stderr: string }) => void)
          | undefined;
        if (typeof callback === 'function') {
          callback(null, { stdout: '1\n', stderr: '' });
        }
        return {} as ReturnType<typeof execFile>;
      });

      const state = await detector.getCurrentState();

      expect(state.active).toBe(true);
      expect(state.mode).toBe('unknown');
    });

    it('should report inactive when both strategies fail', async () => {
      fsMock.readFile.mockRejectedValue(new Error('ENOENT'));
      execFileMock.mockImplementation((...allArgs: unknown[]) => {
        const callback = [...allArgs].reverse().find((a) => typeof a === 'function') as
          | ((err: Error | null, result: { stdout: string; stderr: string }) => void)
          | undefined;
        if (typeof callback === 'function') {
          callback(new Error('defaults failed'), { stdout: '', stderr: '' });
        }
        return {} as ReturnType<typeof execFile>;
      });

      const state = await detector.getCurrentState();

      expect(state.active).toBe(false);
      expect(state.mode).toBeNull();
    });
  });

  describe('isActive', () => {
    it('should return true when focus mode is active', async () => {
      fsMock.readFile.mockResolvedValue(ACTIVE_DND_DB);

      expect(await detector.isActive()).toBe(true);
    });

    it('should return false when inactive', async () => {
      fsMock.readFile.mockResolvedValue(EMPTY_DB);

      expect(await detector.isActive()).toBe(false);
    });
  });

  describe('shouldSuppressNotifications', () => {
    it('should suppress during Do Not Disturb', async () => {
      fsMock.readFile.mockResolvedValue(ACTIVE_DND_DB);

      expect(await detector.shouldSuppressNotifications()).toBe(true);
    });

    it('should suppress during Work Focus', async () => {
      fsMock.readFile.mockResolvedValue(ACTIVE_WORK_FOCUS_DB);

      expect(await detector.shouldSuppressNotifications()).toBe(true);
    });

    it('should not suppress when inactive', async () => {
      fsMock.readFile.mockResolvedValue(EMPTY_DB);

      expect(await detector.shouldSuppressNotifications()).toBe(false);
    });

    it('should not suppress during Fitness focus', async () => {
      const fitnessDb = JSON.stringify({
        data: [{
          storeAssertionRecords: {
            'assertion-1': {
              assertionDetails: {
                assertionDetailsModeIdentifier: 'com.apple.focus.fitness',
                assertionDetailsDate: Math.floor(Date.now() / 1000) - 600,
              },
            },
          },
        }],
      });
      fsMock.readFile.mockResolvedValue(fitnessDb);

      expect(await detector.shouldSuppressNotifications()).toBe(false);
    });
  });

  describe('caching', () => {
    it('should cache results within TTL', async () => {
      const cachingDetector = new FocusModeDetector({
        assertionsDbPath: '/mock/Assertions.json',
        cacheTtlMs: 60_000,
      });

      fsMock.readFile.mockResolvedValue(ACTIVE_DND_DB);

      await cachingDetector.getCurrentState();
      await cachingDetector.getCurrentState();

      expect(fsMock.readFile).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache on clearCache', async () => {
      const cachingDetector = new FocusModeDetector({
        assertionsDbPath: '/mock/Assertions.json',
        cacheTtlMs: 60_000,
      });

      fsMock.readFile.mockResolvedValue(ACTIVE_DND_DB);

      await cachingDetector.getCurrentState();
      cachingDetector.clearCache();
      await cachingDetector.getCurrentState();

      expect(fsMock.readFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('custom focus modes', () => {
    it('should detect unknown mode identifiers as custom', async () => {
      const customDb = JSON.stringify({
        data: [{
          storeAssertionRecords: {
            'assertion-1': {
              assertionDetails: {
                assertionDetailsModeIdentifier: 'com.apple.focus.custom-user-mode',
                assertionDetailsDate: Math.floor(Date.now() / 1000) - 300,
              },
            },
          },
        }],
      });
      fsMock.readFile.mockResolvedValue(customDb);

      const state = await detector.getCurrentState();

      expect(state.active).toBe(true);
      expect(state.mode).toBe('custom');
      expect(state.rawIdentifier).toBe('com.apple.focus.custom-user-mode');
    });
  });
});
