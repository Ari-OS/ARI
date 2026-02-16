/**
 * Apple Ecosystem Integration
 *
 * Barrel export for all Apple integrations:
 * - Calendar: Query Calendar.app events
 * - Reminders: Query and manage Reminders.app
 * - Focus Mode: Detect active Focus/DND mode
 * - Reminder Sync: Bridge Apple Reminders → Notion tasks
 */

export { AppleCalendar, type CalendarEvent, type CalendarConfig } from './calendar.js';
export { AppleReminders, type AppleReminder, type RemindersConfig } from './reminders.js';
export { FocusModeDetector, type FocusModeState, type FocusModeConfig, type FocusModeName } from './focus-mode.js';
export { ReminderSync, type SyncResult, type ReminderSyncConfig } from './reminder-sync.js';
