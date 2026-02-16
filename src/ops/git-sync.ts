/**
 * GIT SYNC - Automated Git Operations Module
 *
 * P2 module for automated git synchronization.
 * Handles auto-commits, pushes, and status tracking.
 *
 * L5 Layer (Ops) - can import from L0-L4
 *
 * SECURITY: This module NEVER logs or emits credentials.
 * All git output is sanitized before logging/eventing.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';

import { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';

const execFileAsync = promisify(execFile);
const log = createLogger('git-sync');

// ═══════════════════════════════════════════════════════════════════════════
// Security Constants
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Patterns that indicate credential or sensitive data.
 * NEVER log strings matching these patterns.
 */
const CREDENTIAL_PATTERNS: RegExp[] = [
  // Git credential patterns
  /password[=:\s]+\S+/gi,
  /token[=:\s]+\S+/gi,
  /auth[=:\s]+\S+/gi,
  /bearer\s+\S+/gi,
  /api[_-]?key[=:\s]+\S+/gi,
  /secret[=:\s]+\S+/gi,
  /credential[=:\s]+\S+/gi,

  // URL with credentials: https://user:pass@host
  /https?:\/\/[^:]+:[^@]+@/gi,

  // SSH key patterns
  /-----BEGIN\s+(RSA|DSA|EC|OPENSSH)\s+PRIVATE\s+KEY-----/gi,

  // GitHub/GitLab tokens
  /gh[pousr]_[A-Za-z0-9_]+/gi,
  /glpat-[A-Za-z0-9_-]+/gi,
  /github_pat_[A-Za-z0-9_]+/gi,

  // AWS keys
  /AKIA[0-9A-Z]{16}/gi,

  // Generic secrets
  /[A-Za-z0-9+/]{40,}/g, // Base64 encoded secrets (40+ chars)
];

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface SyncResult {
  /** Number of files committed */
  filesCommitted: number;
  /** Whether push succeeded */
  pushed: boolean;
  /** Commit hash if commit was created */
  commitHash?: string;
  /** Error message if operation failed */
  error?: string;
}

export interface GitStatus {
  /** Files with modifications */
  modified: string[];
  /** Untracked files */
  untracked: string[];
  /** Files staged for commit */
  staged: string[];
  /** Files with conflicts */
  conflicted: string[];
}

export interface GitSyncOptions {
  /** Path to git repository (default: cwd) */
  repoPath?: string;
  /** Auto-commit interval in ms (default: 1 hour) */
  autoCommitIntervalMs?: number;
  /** Whether to auto-push after commit (default: true) */
  autoPush?: boolean;
  /** Commit message prefix (default: '[ARI Auto-Sync]') */
  commitPrefix?: string;
  /** Branch to operate on (default: current branch) */
  branch?: string;
  /** Maximum files to commit at once (default: 100) */
  maxFilesPerCommit?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Security Utilities
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sanitizes a string by removing any credential patterns.
 * Used to ensure credentials are NEVER logged or emitted.
 */
function sanitizeOutput(text: string): string {
  let sanitized = text;

  for (const pattern of CREDENTIAL_PATTERNS) {
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  return sanitized;
}

/**
 * Checks if a string contains any credential patterns.
 */
function containsCredentials(text: string): boolean {
  for (const pattern of CREDENTIAL_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

/**
 * Safe logging wrapper that sanitizes all output.
 */
function safeLog(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>): void {
  const sanitizedMessage = sanitizeOutput(message);
  const sanitizedData = data
    ? (JSON.parse(sanitizeOutput(JSON.stringify(data))) as Record<string, unknown>)
    : undefined;

  if (level === 'info') {
    log.info(sanitizedData ?? {}, sanitizedMessage);
  } else if (level === 'warn') {
    log.warn(sanitizedData ?? {}, sanitizedMessage);
  } else {
    log.error(sanitizedData ?? {}, sanitizedMessage);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GitSync Implementation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Automated git synchronization service.
 * Handles commits and pushes with credential safety.
 */
export class GitSync {
  private eventBus: EventBus;
  private repoPath: string;
  private autoCommitIntervalMs: number;
  private autoPush: boolean;
  private commitPrefix: string;
  private branch: string | null;
  private maxFilesPerCommit: number;
  private autoCommitTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(eventBus: EventBus, options?: GitSyncOptions) {
    this.eventBus = eventBus;
    this.repoPath = options?.repoPath ?? process.cwd();
    this.autoCommitIntervalMs = options?.autoCommitIntervalMs ?? 60 * 60 * 1000; // 1 hour
    this.autoPush = options?.autoPush ?? true;
    this.commitPrefix = options?.commitPrefix ?? '[ARI Auto-Sync]';
    this.branch = options?.branch ?? null;
    this.maxFilesPerCommit = options?.maxFilesPerCommit ?? 100;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Starts the auto-commit timer.
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Schedule periodic syncs
    this.autoCommitTimer = setInterval(() => {
      void this.sync().catch((err) => {
        safeLog('error', 'Auto-sync failed', { error: err instanceof Error ? err.message : String(err) });
      });
    }, this.autoCommitIntervalMs);

    safeLog('info', 'GitSync started', { intervalMs: this.autoCommitIntervalMs });
  }

  /**
   * Stops the auto-commit timer.
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.autoCommitTimer) {
      clearInterval(this.autoCommitTimer);
      this.autoCommitTimer = null;
    }

    this.isRunning = false;
    safeLog('info', 'GitSync stopped');
  }

  /**
   * Returns whether the auto-sync timer is running.
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Performs a full sync: stage, commit, push.
   */
  async sync(): Promise<SyncResult> {
    try {
      // Verify repo exists
      if (!this.isGitRepo()) {
        return {
          filesCommitted: 0,
          pushed: false,
          error: 'Not a git repository',
        };
      }

      // Get current status
      const status = await this.getStatus();

      // Check for conflicts first (before other checks)
      if (status.conflicted.length > 0) {
        return {
          filesCommitted: 0,
          pushed: false,
          error: `Merge conflicts in ${status.conflicted.length} file(s)`,
        };
      }

      const filesToCommit = [...status.modified, ...status.untracked];

      // Nothing to commit
      if (filesToCommit.length === 0 && status.staged.length === 0) {
        safeLog('info', 'No changes to commit');
        return { filesCommitted: 0, pushed: false };
      }

      // Limit files per commit
      const limitedFiles = filesToCommit.slice(0, this.maxFilesPerCommit);
      if (filesToCommit.length > this.maxFilesPerCommit) {
        safeLog('warn', `Limiting commit to ${this.maxFilesPerCommit} files (${filesToCommit.length} total)`);
      }

      // Stage files
      if (limitedFiles.length > 0) {
        await this.stageFiles(limitedFiles);
      }

      // Generate commit message
      const timestamp = new Date().toISOString();
      const message = `${this.commitPrefix} ${timestamp}\n\nFiles: ${limitedFiles.length + status.staged.length}`;

      // Commit
      const commitHash = await this.commit(message);

      if (!commitHash) {
        return {
          filesCommitted: 0,
          pushed: false,
          error: 'Commit failed - no hash returned',
        };
      }

      const totalFiles = limitedFiles.length + status.staged.length;

      // Push if enabled
      let pushed = false;
      if (this.autoPush) {
        pushed = await this.push();
      }

      // Emit event (sanitized)
      this.eventBus.emit('ops:git_synced', {
        filesCommitted: totalFiles,
        pushed,
      });

      safeLog('info', 'Sync completed', { filesCommitted: totalFiles, pushed, commitHash });

      return {
        filesCommitted: totalFiles,
        pushed,
        commitHash,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const sanitizedError = sanitizeOutput(error);

      safeLog('error', 'Sync failed', { error: sanitizedError });

      return {
        filesCommitted: 0,
        pushed: false,
        error: sanitizedError,
      };
    }
  }

  /**
   * Gets the current git status.
   */
  async getStatus(): Promise<GitStatus> {
    const result: GitStatus = {
      modified: [],
      untracked: [],
      staged: [],
      conflicted: [],
    };

    try {
      const { stdout } = await this.execGit(['status', '--porcelain']);

      for (const line of stdout.split('\n')) {
        if (!line.trim()) continue;

        const status = line.substring(0, 2);
        const file = line.substring(3).trim();

        // Parse status codes
        // First char = index status, second char = worktree status
        const indexStatus = status[0];
        const worktreeStatus = status[1];

        // Conflicted files
        if (status === 'UU' || status === 'AA' || status === 'DD') {
          result.conflicted.push(file);
          continue;
        }

        // Staged files (index has changes)
        if (indexStatus !== ' ' && indexStatus !== '?') {
          result.staged.push(file);
        }

        // Modified in worktree
        if (worktreeStatus === 'M') {
          result.modified.push(file);
        }

        // Untracked
        if (status === '??') {
          result.untracked.push(file);
        }
      }

      return result;
    } catch (err) {
      safeLog('error', 'Failed to get status', {
        error: sanitizeOutput(err instanceof Error ? err.message : String(err)),
      });
      return result;
    }
  }

  /**
   * Creates a commit with the given message.
   * Returns the commit hash or null if no commit was made.
   */
  async commit(message: string): Promise<string | null> {
    try {
      // Validate message doesn't contain credentials
      if (containsCredentials(message)) {
        throw new Error('Commit message contains potential credentials');
      }

      await this.execGit(['commit', '-m', message]);

      // Get the commit hash
      const { stdout } = await this.execGit(['rev-parse', 'HEAD']);
      const hash = stdout.trim();

      safeLog('info', 'Commit created', { hash: hash.substring(0, 8) });

      return hash;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      // "nothing to commit" is not really an error
      if (errorMsg.includes('nothing to commit')) {
        return null;
      }

      safeLog('error', 'Commit failed', { error: sanitizeOutput(errorMsg) });
      throw err;
    }
  }

  /**
   * Pushes to the remote repository.
   * Returns true if push succeeded.
   */
  async push(): Promise<boolean> {
    try {
      const args = ['push'];

      // Add branch if specified
      if (this.branch) {
        args.push('origin', this.branch);
      }

      // Use --porcelain for parseable output
      args.push('--porcelain');

      const { stdout, stderr } = await this.execGit(args);

      // Check for errors in output (sanitized)
      const output = sanitizeOutput(stdout + stderr);

      if (output.includes('rejected') || output.includes('failed')) {
        safeLog('warn', 'Push rejected', { output });
        return false;
      }

      safeLog('info', 'Push completed');
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      safeLog('error', 'Push failed', { error: sanitizeOutput(errorMsg) });
      return false;
    }
  }

  /**
   * Stages files for commit.
   */
  async stageFiles(files: string[]): Promise<void> {
    if (files.length === 0) return;

    // Stage in batches to avoid command line length limits
    const batchSize = 50;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      await this.execGit(['add', '--', ...batch]);
    }
  }

  /**
   * Gets the current branch name.
   */
  async getCurrentBranch(): Promise<string | null> {
    try {
      const { stdout } = await this.execGit(['rev-parse', '--abbrev-ref', 'HEAD']);
      return stdout.trim();
    } catch {
      return null;
    }
  }

  /**
   * Checks if the remote has changes not in local.
   */
  async hasRemoteChanges(): Promise<boolean> {
    try {
      // Fetch without merging
      await this.execGit(['fetch', '--dry-run']);

      // Compare local to remote
      const { stdout } = await this.execGit(['rev-list', 'HEAD..@{u}', '--count']);
      return parseInt(stdout.trim(), 10) > 0;
    } catch {
      // No upstream or other error
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Checks if the repo path is a git repository.
   */
  private isGitRepo(): boolean {
    return existsSync(join(this.repoPath, '.git'));
  }

  /**
   * Executes a git command with credential safety.
   */
  private async execGit(args: string[]): Promise<{ stdout: string; stderr: string }> {
    try {
      const result = await execFileAsync('git', args, {
        cwd: this.repoPath,
        env: {
          ...process.env,
          // Prevent git from prompting for credentials
          GIT_TERMINAL_PROMPT: '0',
          // Disable credential helpers that might log
          GIT_ASKPASS: '',
        },
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });

      return result;
    } catch (err) {
      // ExecFileException has stdout/stderr on the error object
      const execErr = err as { stdout?: string; stderr?: string; message: string };

      // Always sanitize error output
      const sanitizedMessage = sanitizeOutput(execErr.message);
      const sanitizedStderr = execErr.stderr ? sanitizeOutput(execErr.stderr) : '';

      const error = new Error(sanitizedMessage);
      (error as unknown as { stdout: string; stderr: string }).stdout = execErr.stdout ?? '';
      (error as unknown as { stdout: string; stderr: string }).stderr = sanitizedStderr;

      throw error;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════

export { sanitizeOutput, containsCredentials };
