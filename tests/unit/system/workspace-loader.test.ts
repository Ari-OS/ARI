import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

// Mock fs/promises before importing the module
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

const { loadWorkspaceFile, loadIdentityPrompt, clearWorkspaceCache } = await import('../../../src/system/workspace-loader.js');

describe('workspace-loader', () => {
  const WORKSPACE_DIR = join(homedir(), '.ari', 'workspace');

  beforeEach(() => {
    clearWorkspaceCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearWorkspaceCache();
  });

  describe('loadWorkspaceFile', () => {
    it('should load a workspace file that exists', async () => {
      const content = 'Test content from SOUL.md';
      vi.mocked(readFile).mockResolvedValueOnce(content);

      const result = await loadWorkspaceFile('SOUL.md');

      expect(result).toBe(content);
      expect(readFile).toHaveBeenCalledWith(join(WORKSPACE_DIR, 'SOUL.md'), 'utf-8');
      expect(readFile).toHaveBeenCalledTimes(1);
    });

    it('should return empty string when file does not exist', async () => {
      vi.mocked(readFile).mockRejectedValueOnce(new Error('ENOENT'));

      const result = await loadWorkspaceFile('MISSING.md');

      expect(result).toBe('');
      expect(readFile).toHaveBeenCalledWith(join(WORKSPACE_DIR, 'MISSING.md'), 'utf-8');
    });

    it('should cache content within TTL period', async () => {
      const content = 'Cached content';
      vi.mocked(readFile).mockResolvedValueOnce(content);

      // First call should read from file
      const result1 = await loadWorkspaceFile('TEST.md');
      expect(result1).toBe(content);
      expect(readFile).toHaveBeenCalledTimes(1);

      // Second call should use cache (no additional read)
      const result2 = await loadWorkspaceFile('TEST.md');
      expect(result2).toBe(content);
      expect(readFile).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it('should reload content after TTL expires', async () => {
      const content1 = 'First content';
      const content2 = 'Second content';

      vi.mocked(readFile)
        .mockResolvedValueOnce(content1)
        .mockResolvedValueOnce(content2);

      // First call
      const result1 = await loadWorkspaceFile('TEST.md');
      expect(result1).toBe(content1);

      // Fast-forward time by 6 minutes (TTL is 5 minutes)
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now + 6 * 60 * 1000);

      // Second call should reload
      const result2 = await loadWorkspaceFile('TEST.md');
      expect(result2).toBe(content2);
      expect(readFile).toHaveBeenCalledTimes(2);

      vi.restoreAllMocks();
    });
  });

  describe('clearWorkspaceCache', () => {
    it('should clear the cache', async () => {
      const content = 'Cached content';
      vi.mocked(readFile).mockResolvedValue(content);

      // Load file (cache it)
      await loadWorkspaceFile('TEST.md');
      expect(readFile).toHaveBeenCalledTimes(1);

      // Load again (should use cache)
      await loadWorkspaceFile('TEST.md');
      expect(readFile).toHaveBeenCalledTimes(1);

      // Clear cache
      clearWorkspaceCache();

      // Load again (should read from file)
      await loadWorkspaceFile('TEST.md');
      expect(readFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('loadIdentityPrompt', () => {
    it('should combine SOUL, IDENTITY, and USER files', async () => {
      // loadIdentityPrompt loads all 9 workspace files; first 3 have content
      vi.mocked(readFile)
        .mockResolvedValueOnce('SOUL content')
        .mockResolvedValueOnce('IDENTITY content')
        .mockResolvedValueOnce('USER content')
        .mockRejectedValue(new Error('ENOENT')); // GOALS, PREFERENCES, AGENTS, HEARTBEAT, MEMORY, TOOLS missing

      const result = await loadIdentityPrompt();

      expect(result).toContain('SOUL content');
      expect(result).toContain('IDENTITY content');
      expect(result).toContain('USER content');
      expect(readFile).toHaveBeenCalledTimes(10); // 10 workspace files
      expect(readFile).toHaveBeenCalledWith(join(WORKSPACE_DIR, 'SOUL.md'), 'utf-8');
      expect(readFile).toHaveBeenCalledWith(join(WORKSPACE_DIR, 'IDENTITY.md'), 'utf-8');
      expect(readFile).toHaveBeenCalledWith(join(WORKSPACE_DIR, 'USER.md'), 'utf-8');
    });

    it('should filter out empty files', async () => {
      vi.mocked(readFile)
        .mockResolvedValueOnce('SOUL content')
        .mockRejectedValueOnce(new Error('ENOENT')) // IDENTITY missing
        .mockResolvedValueOnce('USER content')
        .mockRejectedValue(new Error('ENOENT')); // remaining files missing

      const result = await loadIdentityPrompt();

      expect(result).toContain('SOUL content');
      expect(result).toContain('USER content');
      expect(result).not.toContain('IDENTITY');
    });

    it('should return empty string when all files are missing', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));

      const result = await loadIdentityPrompt();

      expect(result).toBe('');
    });

    it('should load files in parallel', async () => {
      const promises: Array<Promise<string>> = [];

      vi.mocked(readFile).mockImplementation(() => {
        const promise = Promise.resolve('content');
        promises.push(promise);
        return promise;
      });

      await loadIdentityPrompt();

      // All 10 workspace files should be requested in parallel
      expect(promises.length).toBe(10);
    });
  });
});
