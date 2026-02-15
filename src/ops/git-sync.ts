/**
 * GIT SYNC - Hourly Git Sync for State Files
 *
 * Automatically commits and pushes state file changes:
 * - Monitors: ~/.ari/data/, ~/.ari/memories/, ~/.ari/workspace/
 * - NEVER auto-commits source code changes
 * - Uses [skip ci] to avoid CI triggers
 * - Safe operation: only commits tracked state files
 *
 * Layer: L5 Execution (operations)
 */

import type { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { homedir } from 'node:os';
import { join } from 'node:path';

const log = createLogger('git-sync');
const execFileAsync = promisify(execFile);

const STATE_DIRS = [
  join(homedir(), '.ari', 'data'),
  join(homedir(), '.ari', 'memories'),
  join(homedir(), '.ari', 'workspace'),
];

export interface GitSyncResult {
  success: boolean;
  action: 'pushed' | 'up_to_date' | 'error';
  message: string;
  timestamp: string;
}

export interface GitStatus {
  branch: string;
  clean: boolean;
  ahead: number;
}

export class GitSync {
  private eventBus: EventBus;
  private repoPath: string;

  constructor(eventBus: EventBus, options?: { repoPath?: string }) {
    this.eventBus = eventBus;
    this.repoPath = options?.repoPath || process.cwd();
  }

  /**
   * Check for uncommitted state changes and push if needed
   */
  async sync(): Promise<GitSyncResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      log.info('Starting git sync');

      // Check current status
      const status = await this.getStatus();

      // If branch is clean and not ahead, nothing to do
      if (status.clean && status.ahead === 0) {
        log.info('Repository is clean and up to date');
        return {
          success: true,
          action: 'up_to_date',
          message: 'No changes to sync',
          timestamp,
        };
      }

      // Check if there are uncommitted changes in state directories
      const hasStateChanges = await this.hasStateChanges();

      if (!hasStateChanges && status.ahead === 0) {
        log.info('No state changes to commit');
        return {
          success: true,
          action: 'up_to_date',
          message: 'No state changes to sync',
          timestamp,
        };
      }

      // Stage state files if there are changes
      if (hasStateChanges) {
        await this.stageStateFiles();

        // Commit with [skip ci] marker
        await this.commit();
      }

      // Push to remote
      await this.push();

      const duration = Date.now() - startTime;

      // Emit success event
      this.eventBus.emit('audit:log', {
        action: 'git_sync_completed',
        agent: 'git-sync',
        trustLevel: 'system',
        details: {
          branch: status.branch,
          hasStateChanges,
          duration,
        },
      });

      log.info({ duration, branch: status.branch }, 'Git sync completed');

      return {
        success: true,
        action: 'pushed',
        message: `Synced state files to ${status.branch}`,
        timestamp,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const message =
        error instanceof Error ? error.message : String(error);

      // Emit failure event
      this.eventBus.emit('audit:log', {
        action: 'git_sync_failed',
        agent: 'git-sync',
        trustLevel: 'system',
        details: {
          error: message,
          duration,
        },
      });

      log.error({ err: error }, 'Git sync failed');

      return {
        success: false,
        action: 'error',
        message,
        timestamp,
      };
    }
  }

  /**
   * Get current git status
   */
  async getStatus(): Promise<GitStatus> {
    try {
      // Get current branch
      const { stdout: branchOutput } = await execFileAsync(
        'git',
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        { cwd: this.repoPath }
      );
      const branch = branchOutput.trim();

      // Check if working tree is clean
      const { stdout: statusOutput } = await execFileAsync(
        'git',
        ['status', '--porcelain'],
        { cwd: this.repoPath }
      );
      const clean = statusOutput.trim().length === 0;

      // Check if ahead of remote
      let ahead = 0;
      try {
        const { stdout: aheadOutput } = await execFileAsync(
          'git',
          ['rev-list', '--count', `origin/${branch}..HEAD`],
          { cwd: this.repoPath }
        );
        ahead = parseInt(aheadOutput.trim(), 10) || 0;
      } catch {
        // No remote tracking branch — ahead is 0
      }

      return { branch, clean, ahead };
    } catch (error) {
      log.error({ err: error }, 'Failed to get git status');
      throw error;
    }
  }

  /**
   * Check if there are uncommitted changes in state directories
   */
  private async hasStateChanges(): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['status', '--porcelain'],
        { cwd: this.repoPath }
      );

      const lines = stdout.trim().split('\n');

      // Check if any changed files are in state directories
      for (const line of lines) {
        if (!line) continue;

        // Parse git status line format: "XY path"
        const path = line.substring(3).trim();

        // Check if path is in any state directory
        for (const stateDir of STATE_DIRS) {
          if (path.startsWith(stateDir) || path.includes('.ari/data/') || path.includes('.ari/memories/') || path.includes('.ari/workspace/')) {
            log.info({ path }, 'State file change detected');
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      log.error({ err: error }, 'Failed to check state changes');
      throw error;
    }
  }

  /**
   * Stage state files for commit
   */
  private async stageStateFiles(): Promise<void> {
    try {
      // Add each state directory
      for (const stateDir of STATE_DIRS) {
        try {
          await execFileAsync('git', ['add', stateDir], {
            cwd: this.repoPath,
          });
          log.info({ dir: stateDir }, 'Staged state directory');
        } catch (error) {
          // Directory might not exist or have no changes — that's okay
          log.debug({ err: error, dir: stateDir }, 'Could not stage directory');
        }
      }
    } catch (error) {
      log.error({ err: error }, 'Failed to stage state files');
      throw error;
    }
  }

  /**
   * Commit staged changes with [skip ci] marker
   */
  private async commit(): Promise<void> {
    try {
      const message = 'chore: auto-sync state [skip ci]';

      await execFileAsync('git', ['commit', '-m', message], {
        cwd: this.repoPath,
      });

      log.info({ message }, 'Committed state changes');
    } catch (error) {
      // If commit fails because there's nothing to commit, that's okay
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('nothing to commit')) {
        log.info('No changes to commit after staging');
        return;
      }

      log.error({ err: error }, 'Failed to commit');
      throw error;
    }
  }

  /**
   * Push commits to remote
   */
  private async push(): Promise<void> {
    try {
      await execFileAsync('git', ['push'], { cwd: this.repoPath });
      log.info('Pushed to remote');
    } catch (error) {
      log.error({ err: error }, 'Failed to push');
      throw error;
    }
  }
}
