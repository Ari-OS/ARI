import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventBus } from '../../../src/kernel/event-bus.js';
import { GitSync } from '../../../src/ops/git-sync.js';

// Mock execFile to return promises directly
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('node:util', async () => {
  const actual = await vi.importActual<typeof import('node:util')>('node:util');
  return {
    ...actual,
    promisify: (fn: unknown) => fn, // Return the mock function as-is (it's already promise-based)
  };
});

describe('GitSync', () => {
  let eventBus: EventBus;
  let gitSync: GitSync;
  let mockExecFile: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const { execFile } = await import('node:child_process');
    mockExecFile = vi.mocked(execFile);

    eventBus = new EventBus();
    gitSync = new GitSync(eventBus, { repoPath: '/tmp/test-repo' });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getStatus', () => {
    it('should return current branch and clean status', async () => {
      // Mock git commands
      mockExecFile.mockImplementation((file: string, args: string[]) => {
        const argsStr = args.join(' ');
        if (argsStr.includes('rev-parse')) {
          return Promise.resolve({ stdout: 'main\n', stderr: '' });
        } else if (argsStr.includes('status --porcelain')) {
          return Promise.resolve({ stdout: '', stderr: '' }); // Clean
        } else if (argsStr.includes('rev-list')) {
          return Promise.resolve({ stdout: '0\n', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const status = await gitSync.getStatus();

      expect(status.branch).toBe('main');
      expect(status.clean).toBe(true);
      expect(status.ahead).toBe(0);
    });

    it('should detect uncommitted changes', async () => {
      mockExecFile.mockImplementation((file: string, args: string[]) => {
        const argsStr = args.join(' ');
        if (argsStr.includes('rev-parse')) {
          return Promise.resolve({ stdout: 'main\n', stderr: '' });
        } else if (argsStr.includes('status --porcelain')) {
          return Promise.resolve({ stdout: 'M file.txt\n', stderr: '' });
        } else if (argsStr.includes('rev-list')) {
          return Promise.resolve({ stdout: '0\n', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const status = await gitSync.getStatus();

      expect(status.clean).toBe(false);
    });

    it('should detect commits ahead of remote', async () => {
      mockExecFile.mockImplementation((file: string, args: string[]) => {
        const argsStr = args.join(' ');
        if (argsStr.includes('rev-parse')) {
          return Promise.resolve({ stdout: 'main\n', stderr: '' });
        } else if (argsStr.includes('status --porcelain')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        } else if (argsStr.includes('rev-list')) {
          return Promise.resolve({ stdout: '3\n', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const status = await gitSync.getStatus();

      expect(status.ahead).toBe(3);
    });
  });

  describe('sync', () => {
    it('should return up_to_date when clean and not ahead', async () => {
      mockExecFile.mockImplementation((file: string, args: string[]) => {
        const argsStr = args.join(' ');
        if (argsStr.includes('rev-parse')) {
          return Promise.resolve({ stdout: 'main\n', stderr: '' });
        } else if (argsStr.includes('status --porcelain')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        } else if (argsStr.includes('rev-list')) {
          return Promise.resolve({ stdout: '0\n', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const result = await gitSync.sync();

      expect(result.action).toBe('up_to_date');
      expect(result.success).toBe(true);
    });

    it.skip('should commit and push state changes', async () => {
      const gitCalls: string[] = [];

      mockExecFile.mockImplementation((file: string, args: string[]) => {
        const argsStr = args.join(' ');
        gitCalls.push(argsStr);

        if (argsStr.includes('rev-parse')) {
          return Promise.resolve({ stdout: 'main\n', stderr: '' });
        } else if (argsStr.includes('status --porcelain')) {
          // Always return state directory changes
          // Git status --porcelain format: "XY filename" where X and Y are status codes
          return Promise.resolve({ stdout: ' M .ari/data/test.db\n', stderr: '' });
        } else if (argsStr.includes('rev-list')) {
          return Promise.resolve({ stdout: '0\n', stderr: '' });
        } else if (argsStr.includes('add')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        } else if (argsStr.includes('commit')) {
          return Promise.resolve({ stdout: '[main abc123] auto-sync\n', stderr: '' });
        } else if (argsStr.includes('push')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const result = await gitSync.sync();

      expect(result.action).toBe('pushed');
      expect(result.success).toBe(true);
      expect(gitCalls.some((c) => c.includes('commit'))).toBe(true);
      expect(gitCalls.some((c) => c.includes('push'))).toBe(true);
    });

    it.skip('should emit audit event on success', async () => {
      const auditListener = vi.fn();
      eventBus.on('audit:log', auditListener);

      const gitCalls: string[] = [];
      mockExecFile.mockImplementation((file: string, args: string[]) => {
        const argsStr = args.join(' ');
        gitCalls.push(argsStr);

        if (argsStr.includes('rev-parse')) {
          return Promise.resolve({ stdout: 'main\n', stderr: '' });
        } else if (argsStr.includes('status --porcelain')) {
          return Promise.resolve({ stdout: ' M .ari/data/test.db\n', stderr: '' });
        } else if (argsStr.includes('rev-list')) {
          return Promise.resolve({ stdout: '0\n', stderr: '' });
        } else if (argsStr.includes('add')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        } else if (argsStr.includes('commit')) {
          return Promise.resolve({ stdout: '[main abc123] auto-sync\n', stderr: '' });
        } else if (argsStr.includes('push')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      await gitSync.sync();

      expect(auditListener).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'git_sync_completed',
          agent: 'git-sync',
          trustLevel: 'system',
        })
      );
    });

    it('should handle git errors gracefully', async () => {
      mockExecFile.mockRejectedValue(new Error('Git error'));

      const result = await gitSync.sync();

      expect(result.success).toBe(false);
      expect(result.action).toBe('error');
    });

    it('should emit audit event on failure', async () => {
      const auditListener = vi.fn();
      eventBus.on('audit:log', auditListener);

      mockExecFile.mockRejectedValue(new Error('Git error'));

      await gitSync.sync();

      expect(auditListener).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'git_sync_failed',
          agent: 'git-sync',
        })
      );
    });

    it('should not commit non-state file changes', async () => {
      const gitCalls: string[] = [];

      mockExecFile.mockImplementation((file: string, args: string[]) => {
        const argsStr = args.join(' ');
        gitCalls.push(argsStr);

        if (argsStr.includes('rev-parse')) {
          return Promise.resolve({ stdout: 'main\n', stderr: '' });
        } else if (argsStr.includes('status --porcelain')) {
          return Promise.resolve({ stdout: 'M src/agents/core.ts\n', stderr: '' }); // Source code change
        } else if (argsStr.includes('rev-list')) {
          return Promise.resolve({ stdout: '0\n', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const result = await gitSync.sync();

      expect(result.action).toBe('up_to_date');
      expect(gitCalls.some((c) => c.includes('commit'))).toBe(false);
    });

    it.skip('should use [skip ci] in commit message', async () => {
      let commitMessage = '';

      mockExecFile.mockImplementation((file: string, args: string[]) => {
        const argsStr = args.join(' ');

        if (argsStr.includes('commit')) {
          commitMessage = argsStr;
        }

        if (argsStr.includes('rev-parse')) {
          return Promise.resolve({ stdout: 'main\n', stderr: '' });
        } else if (argsStr.includes('status --porcelain')) {
          return Promise.resolve({ stdout: ' M .ari/data/test.db\n', stderr: '' });
        } else if (argsStr.includes('rev-list')) {
          return Promise.resolve({ stdout: '0\n', stderr: '' });
        } else if (argsStr.includes('add')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        } else if (argsStr.includes('commit')) {
          return Promise.resolve({ stdout: '[main abc123] auto-sync\n', stderr: '' });
        } else if (argsStr.includes('push')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      await gitSync.sync();

      expect(commitMessage).toContain('[skip ci]');
    });
  });
});
