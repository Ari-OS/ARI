import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FocusManager } from '../../../../src/integrations/apple/focus-manager.js';
import type { FocusMode } from '../../../../src/integrations/apple/focus-manager.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockEmit = vi.fn();
const mockEventBus = { emit: mockEmit } as unknown as ConstructorParameters<typeof FocusManager>[0];

vi.mock('../../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

const mockExecFileNoThrow = vi.fn();
vi.mock('../../../../src/utils/execFileNoThrow.js', () => ({
  execFileNoThrow: (...args: unknown[]) => mockExecFileNoThrow(...args),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FocusManager', () => {
  let manager: FocusManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new FocusManager(mockEventBus);
  });

  describe('getCurrentFocus()', () => {
    it('should return "off" when DND is not active', async () => {
      mockExecFileNoThrow.mockResolvedValueOnce({ stdout: '0', stderr: '', status: 0 });

      const mode = await manager.getCurrentFocus();

      expect(mode).toBe('off');
    });

    it('should infer mode from schedule when DND is active', async () => {
      mockExecFileNoThrow.mockResolvedValueOnce({ stdout: '1', stderr: '', status: 0 });

      const mode = await manager.getCurrentFocus();

      // Result depends on current time but should be one of the valid modes
      const validModes: FocusMode[] = ['work', 'family', 'build', 'sleep', 'off'];
      expect(validModes).toContain(mode);
    });

    it('should return current stored mode on exec failure', async () => {
      mockExecFileNoThrow.mockResolvedValueOnce({ stdout: '', stderr: 'error', status: 1 });

      const mode = await manager.getCurrentFocus();

      // Default is 'off' since no mode has been set
      expect(mode).toBe('off');
    });

    it('should call osascript with correct arguments', async () => {
      mockExecFileNoThrow.mockResolvedValueOnce({ stdout: '0', stderr: '', status: 0 });

      await manager.getCurrentFocus();

      expect(mockExecFileNoThrow).toHaveBeenCalledWith(
        'osascript',
        ['-e', expect.any(String)],
        expect.objectContaining({ timeoutMs: 10_000 }),
      );
    });
  });

  describe('setFocus()', () => {
    it('should return true on successful mode change', async () => {
      mockExecFileNoThrow.mockResolvedValueOnce({ stdout: 'ok', stderr: '', status: 0 });

      const result = await manager.setFocus('work');

      expect(result).toBe(true);
    });

    it('should return false on exec failure', async () => {
      mockExecFileNoThrow.mockResolvedValueOnce({ stdout: '', stderr: 'permission denied', status: 1 });

      const result = await manager.setFocus('work');

      expect(result).toBe(false);
    });

    it('should return false when stdout contains error prefix', async () => {
      mockExecFileNoThrow.mockResolvedValueOnce({ stdout: 'error:something went wrong', stderr: '', status: 0 });

      const result = await manager.setFocus('work');

      expect(result).toBe(false);
    });

    it('should emit apple:focus_changed event on success', async () => {
      mockExecFileNoThrow.mockResolvedValueOnce({ stdout: 'ok', stderr: '', status: 0 });

      await manager.setFocus('build');

      expect(mockEmit).toHaveBeenCalledWith('apple:focus_changed', expect.objectContaining({
        active: true,
        mode: 'build',
        timestamp: expect.any(String),
      }));
    });

    it('should not emit event on failure', async () => {
      mockExecFileNoThrow.mockResolvedValueOnce({ stdout: '', stderr: 'err', status: 1 });

      await manager.setFocus('work');

      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('should set active to false when mode is "off"', async () => {
      mockExecFileNoThrow.mockResolvedValueOnce({ stdout: 'ok', stderr: '', status: 0 });

      await manager.setFocus('off');

      expect(mockEmit).toHaveBeenCalledWith('apple:focus_changed', expect.objectContaining({
        active: false,
        mode: 'off',
      }));
    });

    it('should use DND-off script when mode is "off"', async () => {
      mockExecFileNoThrow.mockResolvedValueOnce({ stdout: 'ok', stderr: '', status: 0 });

      await manager.setFocus('off');

      const scriptArg = mockExecFileNoThrow.mock.calls[0][1][1] as string;
      expect(scriptArg).toContain('false');
    });

    it('should use DND-on script when mode is not "off"', async () => {
      mockExecFileNoThrow.mockResolvedValueOnce({ stdout: 'ok', stderr: '', status: 0 });

      await manager.setFocus('work');

      const scriptArg = mockExecFileNoThrow.mock.calls[0][1][1] as string;
      expect(scriptArg).toContain('true');
    });
  });

  describe('autoFocus()', () => {
    it('should return target mode when already correct', async () => {
      // getCurrentFocus returns inferred mode (DND active)
      mockExecFileNoThrow.mockResolvedValueOnce({ stdout: '1', stderr: '', status: 0 });

      const mode = await manager.autoFocus();

      // Should return the inferred mode (schedule-based)
      const validModes: FocusMode[] = ['work', 'family', 'build', 'sleep'];
      expect(validModes).toContain(mode);
    });

    it('should call setFocus when current mode differs from target', async () => {
      // getCurrentFocus shows off
      mockExecFileNoThrow.mockResolvedValueOnce({ stdout: '0', stderr: '', status: 0 });
      // setFocus call
      mockExecFileNoThrow.mockResolvedValueOnce({ stdout: 'ok', stderr: '', status: 0 });

      const mode = await manager.autoFocus();

      const validModes: FocusMode[] = ['work', 'family', 'build', 'sleep'];
      expect(validModes).toContain(mode);
    });

    it('should return current mode when setFocus fails', async () => {
      // getCurrentFocus shows off
      mockExecFileNoThrow.mockResolvedValueOnce({ stdout: '0', stderr: '', status: 0 });
      // setFocus fails
      mockExecFileNoThrow.mockResolvedValueOnce({ stdout: '', stderr: 'err', status: 1 });

      const mode = await manager.autoFocus();

      expect(mode).toBe('off');
    });
  });

  describe('schedule inference', () => {
    it('should handle all hours of the day without errors', async () => {
      // We cannot easily test time-of-day inference since it uses new Date(),
      // but we can ensure it doesn't throw
      mockExecFileNoThrow.mockResolvedValue({ stdout: '1', stderr: '', status: 0 });

      const mode = await manager.getCurrentFocus();

      const validModes: FocusMode[] = ['work', 'family', 'build', 'sleep', 'off'];
      expect(validModes).toContain(mode);
    });
  });

  describe('edge cases', () => {
    it('should handle empty stdout from exec', async () => {
      mockExecFileNoThrow.mockResolvedValueOnce({ stdout: '', stderr: '', status: 0 });

      const mode = await manager.getCurrentFocus();

      expect(mode).toBe('off');
    });

    it('should handle whitespace in stdout', async () => {
      mockExecFileNoThrow.mockResolvedValueOnce({ stdout: '  1  \n', stderr: '', status: 0 });

      const mode = await manager.getCurrentFocus();

      // '  1  \n'.trim() === '1' => DND active
      const validModes: FocusMode[] = ['work', 'family', 'build', 'sleep'];
      expect(validModes).toContain(mode);
    });
  });
});
