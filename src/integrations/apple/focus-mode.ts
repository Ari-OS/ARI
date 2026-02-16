/**
 * Apple Focus Mode Detection
 *
 * Detects the current macOS Focus mode (Do Not Disturb, Sleep, Work, etc.)
 * by reading the system's DoNotDisturb assertion database.
 *
 * Used by NotificationManager to suppress non-critical notifications
 * when the user has Focus mode active.
 *
 * macOS-first approach (ADR-008) — no external dependencies.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createLogger } from '../../kernel/logger.js';

const execFileAsync = promisify(execFile);
const log = createLogger('apple-focus');

// ─── Types ──────────────────────────────────────────────────────────────────

export type FocusModeName =
  | 'do-not-disturb'
  | 'sleep'
  | 'work'
  | 'personal'
  | 'driving'
  | 'fitness'
  | 'gaming'
  | 'reading'
  | 'mindfulness'
  | 'custom'
  | 'unknown';

export interface FocusModeState {
  active: boolean;
  mode: FocusModeName | null;
  /** When the current Focus mode was activated */
  activatedAt?: Date;
  /** When it's scheduled to end (if timed) */
  expiresAt?: Date;
  /** Raw mode identifier from the system */
  rawIdentifier?: string;
}

export interface FocusModeConfig {
  /** Path to DoNotDisturb assertion database */
  assertionsDbPath: string;
  /** Cache TTL in milliseconds */
  cacheTtlMs: number;
}

const DEFAULT_CONFIG: FocusModeConfig = {
  assertionsDbPath: path.join(
    process.env.HOME ?? '~',
    'Library',
    'DoNotDisturb',
    'DB',
    'Assertions.json'
  ),
  cacheTtlMs: 30_000, // 30 second cache
};

// ─── Focus Mode Identifier Mapping ──────────────────────────────────────────

const FOCUS_MODE_MAP: Record<string, FocusModeName> = {
  'com.apple.donotdisturb.mode.default': 'do-not-disturb',
  'com.apple.donotdisturb.mode.sleep': 'sleep',
  'com.apple.focus.work': 'work',
  'com.apple.focus.personal-time': 'personal',
  'com.apple.focus.driving': 'driving',
  'com.apple.focus.fitness': 'fitness',
  'com.apple.focus.gaming': 'gaming',
  'com.apple.focus.reading': 'reading',
  'com.apple.focus.mindfulness': 'mindfulness',
};

// ─── Focus Mode Detector ────────────────────────────────────────────────────

export class FocusModeDetector {
  private config: FocusModeConfig;
  private cache: { state: FocusModeState; fetchedAt: number } | null = null;

  constructor(config: Partial<FocusModeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get the current Focus mode state
   *
   * Uses two strategies:
   * 1. Read Assertions.json (fast, reliable on macOS 12+)
   * 2. Fallback to `defaults read` command
   */
  async getCurrentState(): Promise<FocusModeState> {
    // Check cache
    if (this.cache && Date.now() - this.cache.fetchedAt < this.config.cacheTtlMs) {
      return this.cache.state;
    }

    let state: FocusModeState;

    try {
      state = await this.readAssertionsDb();
    } catch {
      try {
        state = await this.readViaDefaults();
      } catch {
        state = { active: false, mode: null };
      }
    }

    this.cache = { state, fetchedAt: Date.now() };
    return state;
  }

  /**
   * Check if Focus mode is currently active
   */
  async isActive(): Promise<boolean> {
    const state = await this.getCurrentState();
    return state.active;
  }

  /**
   * Check if the current Focus mode should suppress notifications
   * All Focus modes suppress except "fitness" (user may want health alerts)
   */
  async shouldSuppressNotifications(): Promise<boolean> {
    const state = await this.getCurrentState();
    if (!state.active) return false;

    // Fitness mode might want health-related notifications
    return state.mode !== 'fitness';
  }

  /**
   * Invalidate cache (useful after detecting a state change)
   */
  clearCache(): void {
    this.cache = null;
  }

  // ─── Private Strategies ─────────────────────────────────────────────────────

  /**
   * Strategy 1: Read the Assertions.json file
   * Available on macOS 12+ (Monterey)
   */
  private async readAssertionsDb(): Promise<FocusModeState> {
    const content = await fs.readFile(this.config.assertionsDbPath, 'utf-8');
    const db = JSON.parse(content) as {
      data?: Array<{
        storeAssertionRecords?: Record<string, {
          assertionDetails?: {
            assertionDetailsModeIdentifier?: string;
            assertionDetailsDate?: number;
            assertionDetailsExpiryDate?: number;
          };
        }>;
      }>;
    };

    // Walk the assertion records to find active Focus modes
    const records = db.data?.[0]?.storeAssertionRecords;
    if (!records || Object.keys(records).length === 0) {
      return { active: false, mode: null };
    }

    // Find the most recent active assertion
    for (const [, record] of Object.entries(records)) {
      const details = record.assertionDetails;
      if (!details?.assertionDetailsModeIdentifier) continue;

      const rawId = details.assertionDetailsModeIdentifier;
      const mode = FOCUS_MODE_MAP[rawId] ?? 'custom';
      const activatedAt = details.assertionDetailsDate
        ? new Date(details.assertionDetailsDate * 1000)
        : undefined;
      const expiresAt = details.assertionDetailsExpiryDate
        ? new Date(details.assertionDetailsExpiryDate * 1000)
        : undefined;

      // Check if expired
      if (expiresAt && expiresAt < new Date()) continue;

      return {
        active: true,
        mode,
        activatedAt,
        expiresAt,
        rawIdentifier: rawId,
      };
    }

    return { active: false, mode: null };
  }

  /**
   * Strategy 2: Fallback using `defaults read` command
   * Works on older macOS versions
   */
  private async readViaDefaults(): Promise<FocusModeState> {
    const { stdout } = await execFileAsync(
      'defaults',
      ['read', 'com.apple.controlcenter', 'NSStatusItem Visible FocusModes'],
      { timeout: 5_000 }
    );

    const isActive = stdout.trim() === '1';

    if (!isActive) {
      return { active: false, mode: null };
    }

    // If active but we can't determine the mode, report as unknown
    log.info('Focus mode detected via defaults (mode unknown)');
    return { active: true, mode: 'unknown' };
  }
}
