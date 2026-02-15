/**
 * BACKUP MANAGER - Database Backup System
 *
 * Manages automated backups of SQLite databases:
 * - Copies ~/.ari/data/*.db files to ~/.ari/backups/YYYY-MM-DD/
 * - Retention policy: 7 daily + 4 weekly (Sunday backups older than 7 days)
 * - Safe for SQLite WAL mode (file copy when no active writes)
 *
 * Layer: L5 Execution (part of autonomous operations)
 */

import type { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';
import { copyFile, mkdir, readdir, stat, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const log = createLogger('backup-manager');

const DEFAULT_BACKUP_DIR = join(homedir(), '.ari', 'backups');
const DATA_DIR = join(homedir(), '.ari', 'data');
const DEFAULT_MAX_AGE_DAYS = 7;
const WEEKLY_RETENTION_COUNT = 4;

export interface BackupResult {
  success: boolean;
  path: string;
  size: number;
  duration: number;
  timestamp: string;
}

export interface BackupInfo {
  path: string;
  size: number;
  date: string;
}

export class BackupManager {
  private eventBus: EventBus;
  private backupDir: string;
  private maxAgeDays: number;

  constructor(
    eventBus: EventBus,
    options?: { backupDir?: string; maxAgeDays?: number }
  ) {
    this.eventBus = eventBus;
    this.backupDir = options?.backupDir || DEFAULT_BACKUP_DIR;
    this.maxAgeDays = options?.maxAgeDays || DEFAULT_MAX_AGE_DAYS;
  }

  /**
   * Run full backup of SQLite databases
   */
  async runFullBackup(): Promise<BackupResult[]> {
    const startTime = Date.now();
    const timestamp = new Date();
    const dateStr = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
    const backupPath = join(this.backupDir, dateStr);

    log.info({ backupPath }, 'Starting full backup');

    try {
      // Ensure backup directory exists
      await mkdir(backupPath, { recursive: true });

      // Get all .db files from data directory
      const dbFiles = await this.getDbFiles();
      const results: BackupResult[] = [];

      // Copy each database file
      for (const dbFile of dbFiles) {
        const result = await this.backupFile(
          dbFile,
          backupPath,
          timestamp.toISOString()
        );
        results.push(result);
      }

      const totalDuration = Date.now() - startTime;

      // Emit success event
      this.eventBus.emit('audit:log', {
        action: 'backup_completed',
        agent: 'backup-manager',
        trustLevel: 'system',
        details: {
          backupPath,
          fileCount: results.length,
          successCount: results.filter((r) => r.success).length,
          duration: totalDuration,
        },
      });

      log.info(
        {
          backupPath,
          fileCount: results.length,
          duration: totalDuration,
        },
        'Full backup completed'
      );

      return results;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Emit failure event
      this.eventBus.emit('audit:log', {
        action: 'backup_failed',
        agent: 'backup-manager',
        trustLevel: 'system',
        details: {
          backupPath,
          error: error instanceof Error ? error.message : String(error),
          duration,
        },
      });

      log.error({ err: error, backupPath }, 'Backup failed');
      throw error;
    }
  }

  /**
   * Get all .db files from data directory
   */
  private async getDbFiles(): Promise<string[]> {
    if (!existsSync(DATA_DIR)) {
      log.warn({ dataDir: DATA_DIR }, 'Data directory does not exist');
      return [];
    }

    const files = await readdir(DATA_DIR);
    return files
      .filter((file) => file.endsWith('.db'))
      .map((file) => join(DATA_DIR, file));
  }

  /**
   * Backup a single file
   */
  private async backupFile(
    sourcePath: string,
    backupPath: string,
    timestamp: string
  ): Promise<BackupResult> {
    const startTime = Date.now();
    const fileName = sourcePath.split('/').pop() || 'unknown.db';
    const destPath = join(backupPath, fileName);

    try {
      await copyFile(sourcePath, destPath);

      const stats = await stat(destPath);
      const duration = Date.now() - startTime;

      log.info({ file: fileName, size: stats.size }, 'File backed up');

      return {
        success: true,
        path: destPath,
        size: stats.size,
        duration,
        timestamp,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      log.error({ err: error, file: fileName }, 'File backup failed');

      return {
        success: false,
        path: destPath,
        size: 0,
        duration,
        timestamp,
      };
    }
  }

  /**
   * Prune old backups according to retention policy:
   * - Keep last 7 daily backups
   * - Keep 4 weekly backups (Sunday backups older than 7 days)
   */
  async pruneOldBackups(): Promise<number> {
    const startTime = Date.now();
    log.info('Starting backup pruning');

    try {
      if (!existsSync(this.backupDir)) {
        log.info('No backup directory found, nothing to prune');
        return 0;
      }

      const backups = await this.listBackups();
      const now = new Date();
      const cutoffDaily = new Date(
        now.getTime() - this.maxAgeDays * 24 * 60 * 60 * 1000
      );

      let prunedCount = 0;
      const keepPaths = new Set<string>();

      // Sort backups by date (newest first)
      backups.sort((a, b) => b.date.localeCompare(a.date));

      // Keep last 7 daily backups
      const recentBackups = backups.slice(0, this.maxAgeDays);
      recentBackups.forEach((backup) => keepPaths.add(backup.path));

      // Find Sunday backups older than 7 days (for weekly retention)
      const olderBackups = backups.slice(this.maxAgeDays);
      const sundayBackups = olderBackups.filter((backup) => {
        const date = new Date(backup.date);
        return date.getDay() === 0; // Sunday
      });

      // Keep last 4 Sunday backups
      sundayBackups
        .slice(0, WEEKLY_RETENTION_COUNT)
        .forEach((backup) => keepPaths.add(backup.path));

      // Delete backups not in keep set
      for (const backup of backups) {
        if (!keepPaths.has(backup.path)) {
          const backupDate = new Date(backup.date);
          if (backupDate < cutoffDaily) {
            try {
              // Delete all files in the backup directory, then the directory itself
              const files = await readdir(backup.path);
              for (const file of files) {
                await unlink(join(backup.path, file));
              }
              await unlink(backup.path); // Remove empty directory
              prunedCount++;
              log.info({ path: backup.path }, 'Pruned old backup');
            } catch (error) {
              log.error({ err: error, path: backup.path }, 'Failed to prune backup');
            }
          }
        }
      }

      const duration = Date.now() - startTime;

      // Emit audit event
      this.eventBus.emit('audit:log', {
        action: 'backup_pruned',
        agent: 'backup-manager',
        trustLevel: 'system',
        details: {
          prunedCount,
          remainingCount: backups.length - prunedCount,
          duration,
        },
      });

      log.info({ prunedCount, duration }, 'Backup pruning completed');

      return prunedCount;
    } catch (error) {
      log.error({ err: error }, 'Backup pruning failed');
      throw error;
    }
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<BackupInfo[]> {
    if (!existsSync(this.backupDir)) {
      return [];
    }

    try {
      const entries = await readdir(this.backupDir, { withFileTypes: true });
      const backups: BackupInfo[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const backupPath = join(this.backupDir, entry.name);
          const stats = await stat(backupPath);

          backups.push({
            path: backupPath,
            size: stats.size,
            date: entry.name, // YYYY-MM-DD format
          });
        }
      }

      return backups;
    } catch (error) {
      log.error({ err: error }, 'Failed to list backups');
      return [];
    }
  }
}
