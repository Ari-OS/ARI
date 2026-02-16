/**
 * ARI Backup Manager
 *
 * P1 module for automated backups of critical ARI data.
 * - Daily backups at 3 AM ET
 * - Timestamped archives with 'latest' symlink
 * - Retention policy: 7 daily, 4 weekly
 * - Path traversal protection (security)
 *
 * Layer: L5 (Autonomous) - can import from L0-L4
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('backup-manager');

// ── Types ────────────────────────────────────────────────────────────────────

export interface BackupResult {
  success: boolean;
  path: string;
  size: number;
  duration: number;
  filesIncluded: number;
}

export interface BackupInfo {
  id: string;
  path: string;
  type: 'full' | 'incremental';
  timestamp: Date;
  size: number;
  filesIncluded: number;
  checksum: string;
}

export interface BackupManagerOptions {
  backupDir?: string;
  retainDaily?: number;
  retainWeekly?: number;
}

interface BackupManifest {
  version: string;
  type: 'full' | 'incremental';
  timestamp: string;
  checksum: string;
  filesIncluded: number;
  targets: string[];
  baseBackup?: string; // For incremental backups
}

// ── Constants ────────────────────────────────────────────────────────────────

const ARI_DIR = path.join(homedir(), '.ari');
const DEFAULT_BACKUP_DIR = path.join(ARI_DIR, 'backups');

const DEFAULT_TARGETS = [
  path.join(ARI_DIR, 'data'),
  path.join(ARI_DIR, 'contexts'),
  path.join(ARI_DIR, 'knowledge'),
];

const MANIFEST_FILENAME = 'manifest.json';
const LATEST_SYMLINK = 'latest';

// ── Path Traversal Protection ────────────────────────────────────────────────

/**
 * Validates a path is within the allowed base directory.
 * Prevents path traversal attacks (../../etc/passwd, etc.)
 *
 * SECURITY: This is critical - 100% test coverage required.
 */
function isPathSafe(targetPath: string, baseDir: string): boolean {
  // Resolve both paths to absolute
  const resolvedTarget = path.resolve(targetPath);
  const resolvedBase = path.resolve(baseDir);

  // Normalize to handle trailing slashes consistently
  const normalizedTarget = path.normalize(resolvedTarget);
  const normalizedBase = path.normalize(resolvedBase);

  // Check for null bytes (security)
  if (targetPath.includes('\0') || baseDir.includes('\0')) {
    return false;
  }

  // Check target starts with base directory
  // Add trailing separator to prevent prefix attacks (e.g., /base vs /baseevil)
  const baseDirWithSep = normalizedBase.endsWith(path.sep)
    ? normalizedBase
    : normalizedBase + path.sep;

  return normalizedTarget === normalizedBase ||
         normalizedTarget.startsWith(baseDirWithSep);
}

/**
 * Validates a backup path contains no traversal sequences.
 * Used for restore operations to prevent writing outside backup targets.
 */
function validateNoTraversal(inputPath: string): boolean {
  // Check for various traversal patterns
  const traversalPatterns = [
    /\.\.[/\\]/,           // ../
    /\.\.$/, // Ends with ..
    /%2e%2e/i,             // URL encoded ..
    /%2e%2e%2f/i,          // URL encoded ../
    /%2e%2e%5c/i,          // URL encoded ..\
    /\.\.%2f/i,            // Mixed encoding
    /\.\.%5c/i,            // Mixed encoding
  ];

  // Check for null bytes
  if (inputPath.includes('\0') || inputPath.includes('%00')) {
    return false;
  }

  for (const pattern of traversalPatterns) {
    if (pattern.test(inputPath)) {
      return false;
    }
  }

  return true;
}

// ── BackupManager ────────────────────────────────────────────────────────────

export class BackupManager {
  private eventBus: EventBus;
  private backupDir: string;
  private retainDaily: number;
  private retainWeekly: number;
  private targets: string[];

  constructor(eventBus: EventBus, options: BackupManagerOptions = {}) {
    this.eventBus = eventBus;
    this.backupDir = options.backupDir || DEFAULT_BACKUP_DIR;
    this.retainDaily = options.retainDaily ?? 7;
    this.retainWeekly = options.retainWeekly ?? 4;
    this.targets = DEFAULT_TARGETS;

    // Validate backup directory is safe
    if (!validateNoTraversal(this.backupDir)) {
      throw new Error('Invalid backup directory: path traversal detected');
    }
  }

  /**
   * Initialize backup directory structure
   */
  async init(): Promise<void> {
    await fs.mkdir(this.backupDir, { recursive: true });
    await fs.mkdir(path.join(this.backupDir, 'daily'), { recursive: true });
    await fs.mkdir(path.join(this.backupDir, 'weekly'), { recursive: true });
    log.info({ backupDir: this.backupDir }, 'Backup manager initialized');
  }

  /**
   * Create a backup of all configured targets
   */
  async createBackup(type: 'full' | 'incremental'): Promise<BackupResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `backup-${type}-${timestamp}`;
    const backupPath = path.join(this.backupDir, 'daily', backupId);

    try {
      // Create backup directory
      await fs.mkdir(backupPath, { recursive: true });

      let totalFiles = 0;
      let totalSize = 0;
      const hasher = createHash('sha256');

      // Find base backup for incremental
      let baseManifest: BackupManifest | null = null;
      if (type === 'incremental') {
        baseManifest = await this.findLatestManifest();
      }

      // Copy each target
      for (const target of this.targets) {
        const targetName = path.basename(target);
        const destPath = path.join(backupPath, targetName);

        try {
          const stats = await fs.stat(target);
          if (stats.isDirectory()) {
            const { fileCount, bytesCopied } = await this.copyDirectory(
              target,
              destPath,
              type === 'incremental' ? baseManifest?.timestamp : undefined
            );
            totalFiles += fileCount;
            totalSize += bytesCopied;
            hasher.update(`${targetName}:${fileCount}:${bytesCopied}`);
          }
        } catch (error) {
          // Target doesn't exist, skip
          log.debug({ target, error }, 'Backup target not found, skipping');
        }
      }

      // Create manifest
      const manifest: BackupManifest = {
        version: '1.0',
        type,
        timestamp: new Date().toISOString(),
        checksum: hasher.digest('hex'),
        filesIncluded: totalFiles,
        targets: this.targets,
        ...(type === 'incremental' && baseManifest
          ? { baseBackup: baseManifest.timestamp }
          : {}),
      };

      await fs.writeFile(
        path.join(backupPath, MANIFEST_FILENAME),
        JSON.stringify(manifest, null, 2)
      );

      // Compress backup
      const archivePath = `${backupPath}.tar.gz`;
      await this.compressDirectory(backupPath, archivePath);

      // Get compressed size
      const archiveStats = await fs.stat(archivePath);
      totalSize = archiveStats.size;

      // Clean up uncompressed directory
      await fs.rm(backupPath, { recursive: true, force: true });

      // Update latest symlink
      await this.updateLatestSymlink(archivePath);

      const duration = Date.now() - startTime;

      // Emit success event
      this.emitBackupEvent('ops:backup_complete', {
        backupId,
        type,
        path: archivePath,
        size: totalSize,
        filesIncluded: totalFiles,
        duration,
      });

      log.info(
        { backupId, type, files: totalFiles, size: totalSize, duration },
        'Backup completed successfully'
      );

      return {
        success: true,
        path: archivePath,
        size: totalSize,
        duration,
        filesIncluded: totalFiles,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Emit failure event
      this.emitBackupEvent('ops:backup_failed', {
        backupId,
        type,
        error: errorMessage,
        duration,
      });

      log.error({ error, backupId }, 'Backup failed');

      return {
        success: false,
        path: '',
        size: 0,
        duration,
        filesIncluded: 0,
      };
    }
  }

  /**
   * Restore a backup to the original locations
   */
  async restoreBackup(backupPath: string): Promise<boolean> {
    // Security: Validate path is within backup directory
    if (!isPathSafe(backupPath, this.backupDir)) {
      log.error({ backupPath }, 'Restore blocked: path traversal attempt');
      throw new Error('Invalid backup path: path traversal detected');
    }

    // Validate no traversal sequences in the path itself
    if (!validateNoTraversal(backupPath)) {
      log.error({ backupPath }, 'Restore blocked: traversal sequence in path');
      throw new Error('Invalid backup path: traversal sequence detected');
    }

    try {
      // Verify backup exists
      await fs.access(backupPath);

      // Create temp directory for extraction
      const tempDir = path.join(this.backupDir, 'temp-restore');
      await fs.mkdir(tempDir, { recursive: true });

      try {
        // Decompress
        await this.decompressArchive(backupPath, tempDir);

        // Read manifest
        const manifestPath = path.join(tempDir, MANIFEST_FILENAME);
        const manifestData = await fs.readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(manifestData) as BackupManifest;

        // Restore each target
        for (const target of manifest.targets) {
          const targetName = path.basename(target);
          const sourcePath = path.join(tempDir, targetName);

          try {
            await fs.access(sourcePath);

            // Security: Validate target is within ARI directory
            if (!isPathSafe(target, ARI_DIR)) {
              log.warn({ target }, 'Skipping restore target: outside ARI directory');
              continue;
            }

            // Backup existing before restore
            const existingBackup = `${target}.pre-restore`;
            try {
              await fs.rename(target, existingBackup);
            } catch {
              // Target doesn't exist, that's fine
            }

            // Restore
            await this.copyDirectory(sourcePath, target);
            log.info({ target }, 'Target restored successfully');
          } catch {
            // Source doesn't exist in backup
            log.debug({ targetName }, 'Target not found in backup');
          }
        }

        log.info({ backupPath }, 'Restore completed successfully');
        return true;
      } finally {
        // Clean up temp directory
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      log.error({ error, backupPath }, 'Restore failed');
      return false;
    }
  }

  /**
   * Prune old backups according to retention policy
   */
  async pruneOldBackups(): Promise<number> {
    let pruned = 0;

    // Prune daily backups
    const dailyDir = path.join(this.backupDir, 'daily');
    pruned += await this.pruneDirectory(dailyDir, this.retainDaily);

    // Prune weekly backups
    const weeklyDir = path.join(this.backupDir, 'weekly');
    pruned += await this.pruneDirectory(weeklyDir, this.retainWeekly);

    log.info({ pruned }, 'Old backups pruned');
    return pruned;
  }

  /**
   * List all available backups
   */
  listBackups(): BackupInfo[] {
    // This is synchronous for simplicity, but could be async
    return this.listBackupsSync();
  }

  /**
   * Promote a daily backup to weekly
   */
  async promoteToWeekly(backupPath: string): Promise<string | null> {
    if (!isPathSafe(backupPath, this.backupDir)) {
      throw new Error('Invalid backup path: path traversal detected');
    }

    try {
      const weeklyDir = path.join(this.backupDir, 'weekly');
      const filename = path.basename(backupPath);
      const weeklyPath = path.join(weeklyDir, filename);

      await fs.copyFile(backupPath, weeklyPath);
      log.info({ from: backupPath, to: weeklyPath }, 'Backup promoted to weekly');

      return weeklyPath;
    } catch (error) {
      log.error({ error, backupPath }, 'Failed to promote backup');
      return null;
    }
  }

  // ── Private Helpers ──────────────────────────────────────────────────────────

  private async copyDirectory(
    src: string,
    dest: string,
    modifiedSince?: string
  ): Promise<{ fileCount: number; bytesCopied: number }> {
    let fileCount = 0;
    let bytesCopied = 0;

    await fs.mkdir(dest, { recursive: true });

    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      // Security: Validate each path
      if (!validateNoTraversal(entry.name)) {
        log.warn({ entry: entry.name }, 'Skipping file with suspicious name');
        continue;
      }

      if (entry.isDirectory()) {
        const result = await this.copyDirectory(srcPath, destPath, modifiedSince);
        fileCount += result.fileCount;
        bytesCopied += result.bytesCopied;
      } else if (entry.isFile()) {
        // For incremental, check modification time
        if (modifiedSince) {
          const stats = await fs.stat(srcPath);
          if (stats.mtime <= new Date(modifiedSince)) {
            continue;
          }
        }

        await fs.copyFile(srcPath, destPath);
        const stats = await fs.stat(srcPath);
        fileCount++;
        bytesCopied += stats.size;
      }
    }

    return { fileCount, bytesCopied };
  }

  private async compressDirectory(srcDir: string, destArchive: string): Promise<void> {
    // Simple tar.gz implementation using streams
    // In production, would use archiver or tar package
    const { execSync } = await import('node:child_process');
    const parentDir = path.dirname(srcDir);
    const dirName = path.basename(srcDir);
    execSync(`tar -czf "${destArchive}" -C "${parentDir}" "${dirName}"`);
  }

  private async decompressArchive(archivePath: string, destDir: string): Promise<void> {
    const { execSync } = await import('node:child_process');
    execSync(`tar -xzf "${archivePath}" -C "${destDir}"`);
  }

  private async updateLatestSymlink(targetPath: string): Promise<void> {
    const latestPath = path.join(this.backupDir, LATEST_SYMLINK);

    try {
      await fs.unlink(latestPath);
    } catch {
      // Symlink doesn't exist, that's fine
    }

    await fs.symlink(targetPath, latestPath);
  }

  private async findLatestManifest(): Promise<BackupManifest | null> {
    const latestPath = path.join(this.backupDir, LATEST_SYMLINK);

    try {
      const realPath = await fs.realpath(latestPath);
      const tempDir = path.join(this.backupDir, 'temp-manifest');
      await fs.mkdir(tempDir, { recursive: true });

      try {
        await this.decompressArchive(realPath, tempDir);
        const manifestData = await fs.readFile(
          path.join(tempDir, MANIFEST_FILENAME),
          'utf-8'
        );
        return JSON.parse(manifestData) as BackupManifest;
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    } catch {
      return null;
    }
  }

  private async pruneDirectory(dir: string, retain: number): Promise<number> {
    let pruned = 0;

    try {
      const entries = await fs.readdir(dir);
      const archives = entries
        .filter((e) => e.endsWith('.tar.gz'))
        .sort()
        .reverse();

      // Keep most recent, delete the rest
      const toDelete = archives.slice(retain);

      for (const archive of toDelete) {
        const archivePath = path.join(dir, archive);
        if (isPathSafe(archivePath, dir)) {
          await fs.unlink(archivePath);
          pruned++;
        }
      }
    } catch (error) {
      log.error({ error, dir }, 'Failed to prune directory');
    }

    return pruned;
  }

  private listBackupsSync(): BackupInfo[] {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeFs = require('node:fs') as typeof import('node:fs');
    const backups: BackupInfo[] = [];

    for (const subdir of ['daily', 'weekly']) {
      const dirPath = path.join(this.backupDir, subdir);

      try {
        const entries = nodeFs.readdirSync(dirPath);

        for (const entry of entries) {
          if (!entry.endsWith('.tar.gz')) continue;

          const archivePath = path.join(dirPath, entry);
          const stats = nodeFs.statSync(archivePath);

          // Extract info from filename: backup-{type}-{timestamp}.tar.gz
          const match = entry.match(/^backup-(full|incremental)-(.+)\.tar\.gz$/);
          if (!match) continue;

          backups.push({
            id: entry.replace('.tar.gz', ''),
            path: archivePath,
            type: match[1] as 'full' | 'incremental',
            timestamp: new Date(match[2].replace(/-/g, ':')),
            size: stats.size,
            filesIncluded: 0, // Would need to read manifest for accurate count
            checksum: '', // Would need to read manifest
          });
        }
      } catch {
        // Directory doesn't exist
      }
    }

    return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  private emitBackupEvent(
    event: 'ops:backup_complete' | 'ops:backup_failed',
    payload: Record<string, unknown>
  ): void {
    // EventBus doesn't have these events defined yet, so we log instead
    // In production, these would be added to EventMap
    log.info({ event, ...payload }, 'Backup event');
  }
}

// Export path validation for testing
export { isPathSafe, validateNoTraversal };
