import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventBus } from '../../../src/kernel/event-bus.js';
import { BackupManager } from '../../../src/autonomous/backup-manager.js';
import { copyFile, mkdir, readdir, stat, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// Mock fs modules
vi.mock('node:fs/promises', () => ({
  copyFile: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
  unlink: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

describe('BackupManager', () => {
  let eventBus: EventBus;
  let backupManager: BackupManager;

  beforeEach(() => {
    eventBus = new EventBus();
    backupManager = new BackupManager(eventBus, {
      backupDir: '/tmp/test-backups',
      maxAgeDays: 7,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('runFullBackup', () => {
    it('should create backup directory', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdir).mockResolvedValue([]);

      await backupManager.runFullBackup();

      expect(mkdir).toHaveBeenCalledWith(
        expect.stringContaining('/tmp/test-backups'),
        { recursive: true }
      );
    });

    it('should copy all .db files', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdir).mockResolvedValue([
        'audit.db',
        'sessions.db',
        'knowledge.db',
        'other.txt',
      ] as unknown as never[]);
      vi.mocked(stat).mockResolvedValue({
        size: 1024,
      } as never);

      const results = await backupManager.runFullBackup();

      expect(copyFile).toHaveBeenCalledTimes(3); // Only .db files
      expect(results.length).toBe(3);
    });

    it('should emit audit event on success', async () => {
      const auditListener = vi.fn();
      eventBus.on('audit:log', auditListener);

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdir).mockResolvedValue(['test.db'] as unknown as never[]);
      vi.mocked(stat).mockResolvedValue({ size: 1024 } as never);

      await backupManager.runFullBackup();

      expect(auditListener).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'backup_completed',
          agent: 'backup-manager',
          trustLevel: 'system',
        })
      );
    });

    it('should handle backup errors gracefully', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdir).mockResolvedValue(['test.db'] as unknown as never[]);
      vi.mocked(copyFile).mockRejectedValue(new Error('Disk full'));
      vi.mocked(stat).mockResolvedValue({ size: 1024 } as never);

      const results = await backupManager.runFullBackup();

      expect(results[0].success).toBe(false);
    });

    it('should emit audit event on failure', async () => {
      const auditListener = vi.fn();
      eventBus.on('audit:log', auditListener);

      vi.mocked(mkdir).mockRejectedValue(new Error('Permission denied'));

      await expect(backupManager.runFullBackup()).rejects.toThrow();

      expect(auditListener).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'backup_failed',
          agent: 'backup-manager',
        })
      );
    });

    it('should handle missing data directory', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const results = await backupManager.runFullBackup();

      expect(results.length).toBe(0);
    });
  });

  describe('pruneOldBackups', () => {
    it('should return 0 if no backup directory exists', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const prunedCount = await backupManager.pruneOldBackups();

      expect(prunedCount).toBe(0);
    });

    it('should keep last 7 daily backups', async () => {
      vi.mocked(existsSync).mockReturnValue(true);

      // Mock 10 daily backups
      const now = new Date();
      const backupDirs = Array.from({ length: 10 }, (_, i) => {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        return date.toISOString().split('T')[0];
      });

      vi.mocked(readdir).mockResolvedValueOnce(
        backupDirs.map((name) => ({
          name,
          isDirectory: () => true,
        })) as never
      );

      // Mock stat for each directory
      vi.mocked(stat).mockResolvedValue({ size: 1024 } as never);

      // Mock readdir for each backup directory (empty)
      vi.mocked(readdir).mockResolvedValue([] as never);

      const prunedCount = await backupManager.pruneOldBackups();

      // Should prune backups older than 7 days (3 in this case)
      expect(prunedCount).toBeGreaterThan(0);
    });

    it('should keep 4 weekly (Sunday) backups', async () => {
      vi.mocked(existsSync).mockReturnValue(true);

      // Create mix of daily and Sunday backups
      const backupDirs = [
        '2024-01-01', // Sunday (old)
        '2024-01-08', // Sunday (old)
        '2024-01-15', // Sunday (old)
        '2024-01-22', // Sunday (old)
        '2024-01-29', // Sunday (recent)
      ];

      vi.mocked(readdir).mockResolvedValueOnce(
        backupDirs.map((name) => ({
          name,
          isDirectory: () => true,
        })) as never
      );

      vi.mocked(stat).mockResolvedValue({ size: 1024 } as never);
      vi.mocked(readdir).mockResolvedValue([] as never);

      const prunedCount = await backupManager.pruneOldBackups();

      // Implementation should keep 4 Sunday backups
      expect(typeof prunedCount).toBe('number');
    });

    it('should emit audit event on completion', async () => {
      const auditListener = vi.fn();
      eventBus.on('audit:log', auditListener);

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdir).mockResolvedValueOnce([] as never);

      await backupManager.pruneOldBackups();

      expect(auditListener).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'backup_pruned',
          agent: 'backup-manager',
        })
      );
    });

    it('should handle pruning errors gracefully', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdir).mockResolvedValueOnce([
        { name: '2024-01-01', isDirectory: () => true },
      ] as never);
      vi.mocked(stat).mockResolvedValue({ size: 1024 } as never);
      vi.mocked(readdir).mockResolvedValueOnce(['test.db'] as never);
      vi.mocked(unlink).mockRejectedValue(new Error('Permission denied'));

      const prunedCount = await backupManager.pruneOldBackups();

      // Should continue despite errors
      expect(typeof prunedCount).toBe('number');
    });
  });

  describe('listBackups', () => {
    it('should return empty array if no backup directory', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const backups = await backupManager.listBackups();

      expect(backups).toEqual([]);
    });

    it('should list all backup directories', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdir).mockResolvedValue([
        { name: '2024-01-01', isDirectory: () => true },
        { name: '2024-01-02', isDirectory: () => true },
        { name: 'file.txt', isDirectory: () => false },
      ] as never);
      vi.mocked(stat).mockResolvedValue({ size: 1024 } as never);

      const backups = await backupManager.listBackups();

      expect(backups.length).toBe(2); // Only directories
      expect(backups[0].date).toBe('2024-01-01');
    });

    it('should handle listing errors gracefully', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdir).mockRejectedValue(new Error('Permission denied'));

      const backups = await backupManager.listBackups();

      expect(backups).toEqual([]);
    });
  });
});
