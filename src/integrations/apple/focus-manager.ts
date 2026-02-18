/**
 * Apple Focus Manager
 *
 * Manages macOS Focus modes with smart auto-scheduling.
 * Uses osascript via execFileNoThrow for safe subprocess interaction.
 *
 * Smart Focus schedule:
 *   7am-4pm:  'work'
 *   4pm-9pm:  'family'
 *   9pm-12am: 'build'
 *   12am-7am: 'sleep'
 *
 * macOS-first approach (ADR-008) — no external dependencies.
 */

import { createLogger } from '../../kernel/logger.js';
import { execFileNoThrow } from '../../utils/execFileNoThrow.js';
import type { EventBus } from '../../kernel/event-bus.js';

const log = createLogger('apple-focus-manager');

// ─── Types ──────────────────────────────────────────────────────────────────

export type FocusMode = 'work' | 'family' | 'build' | 'sleep' | 'off';

export interface FocusScheduleEntry {
  startHour: number;
  endHour: number;
  mode: FocusMode;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const SMART_SCHEDULE: FocusScheduleEntry[] = [
  { startHour: 7, endHour: 16, mode: 'work' },
  { startHour: 16, endHour: 21, mode: 'family' },
  { startHour: 21, endHour: 24, mode: 'build' },
  { startHour: 0, endHour: 7, mode: 'sleep' },
];

const FOCUS_DND_SCRIPT = `
tell application "System Events"
  try
    set dndStatus to do shell script "defaults read com.apple.controlcenter \\"NSStatusItem Visible FocusModes\\""
    return dndStatus
  on error
    return "0"
  end try
end tell
`;

const SET_DND_ON_SCRIPT = `
tell application "System Events"
  try
    do shell script "defaults write com.apple.controlcenter \\"NSStatusItem Visible FocusModes\\" -bool true"
    return "ok"
  on error errMsg
    return "error:" & errMsg
  end try
end tell
`;

const SET_DND_OFF_SCRIPT = `
tell application "System Events"
  try
    do shell script "defaults write com.apple.controlcenter \\"NSStatusItem Visible FocusModes\\" -bool false"
    return "ok"
  on error errMsg
    return "error:" & errMsg
  end try
end tell
`;

// ─── FocusManager ───────────────────────────────────────────────────────────

export class FocusManager {
  private eventBus: EventBus;
  private currentMode: FocusMode = 'off';

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Get the current Focus mode by reading macOS DND status
   */
  async getCurrentFocus(): Promise<FocusMode> {
    const result = await execFileNoThrow('osascript', ['-e', FOCUS_DND_SCRIPT], {
      timeoutMs: 10_000,
    });

    if (result.status !== 0) {
      log.warn({ stderr: result.stderr }, 'Failed to read Focus mode');
      return this.currentMode;
    }

    const isActive = result.stdout.trim() === '1';
    if (!isActive) {
      this.currentMode = 'off';
      return 'off';
    }

    // If DND is active but we don't know the specific mode,
    // infer from schedule
    return this.inferModeFromSchedule();
  }

  /**
   * Set Focus mode via osascript
   */
  async setFocus(mode: FocusMode): Promise<boolean> {
    const previousMode = this.currentMode;
    const script = mode === 'off' ? SET_DND_OFF_SCRIPT : SET_DND_ON_SCRIPT;

    const result = await execFileNoThrow('osascript', ['-e', script], {
      timeoutMs: 10_000,
    });

    if (result.status !== 0 || result.stdout.trim().startsWith('error:')) {
      log.error({ mode, stderr: result.stderr, stdout: result.stdout }, 'Failed to set Focus mode');
      return false;
    }

    this.currentMode = mode;
    log.info({ mode, previousMode }, 'Focus mode changed');

    this.eventBus.emit('apple:focus_changed', {
      active: mode !== 'off',
      mode,
      timestamp: new Date().toISOString(),
    });

    return true;
  }

  /**
   * Automatically set Focus mode based on time of day
   */
  async autoFocus(): Promise<FocusMode> {
    const targetMode = this.inferModeFromSchedule();
    const currentMode = await this.getCurrentFocus();

    if (currentMode === targetMode) {
      log.debug({ mode: targetMode }, 'Focus mode already correct');
      return targetMode;
    }

    const success = await this.setFocus(targetMode);
    if (!success) {
      log.warn({ targetMode }, 'Auto-focus failed to set mode');
      return currentMode;
    }

    log.info({ previousMode: currentMode, newMode: targetMode }, 'Auto-focus applied');
    return targetMode;
  }

  /**
   * Infer the correct Focus mode from the smart schedule
   */
  private inferModeFromSchedule(): FocusMode {
    const hour = new Date().getHours();

    for (const entry of SMART_SCHEDULE) {
      if (entry.startHour <= entry.endHour) {
        // Normal range (e.g., 7-16)
        if (hour >= entry.startHour && hour < entry.endHour) {
          return entry.mode;
        }
      } else {
        // Wrapping range (e.g., 21-7 via midnight)
        if (hour >= entry.startHour || hour < entry.endHour) {
          return entry.mode;
        }
      }
    }

    return 'off';
  }
}
