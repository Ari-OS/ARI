/**
 * ARI Notification Inline Keyboard Generator
 *
 * Generates Telegram inline keyboards based on notification category and priority.
 * Every notification above P3 gets action buttons.
 *
 * Callback data format: "action:notificationId"
 * Actions: ack, dismiss, details, snooze, save, skip, fullDigest, todayTasks
 */

import type { NotificationCategory } from './notification-manager.js';
import type { NotificationPriority } from './types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InlineButton {
  text: string;
  callback_data: string;
}

export type InlineKeyboardRow = InlineButton[];
export type InlineKeyboardMarkup = InlineKeyboardRow[];

/** Telegram API inline_keyboard format */
export interface TelegramInlineKeyboard {
  inline_keyboard: InlineKeyboardMarkup;
}

// ─── Callback Action Types ────────────────────────────────────────────────────

export type CallbackAction =
  | 'ack'          // Acknowledge — mark as read
  | 'dismiss'      // Dismiss — suppress similar
  | 'details'      // Show full details
  | 'snooze'       // Remind later
  | 'save'         // Save for later review
  | 'skip'         // Not interested
  | 'fullDigest'   // Show full morning digest
  | 'todayTasks'   // Show today's task list
  | 'moreInfo'     // Get more information
  | 'lessLike'     // Send fewer like this
  | 'breakdown'    // Show full budget breakdown
  | 'councilApprove' // Council vote: Approve
  | 'councilReject'  // Council vote: Reject
  | 'councilAbstain'; // Council vote: Abstain

/**
 * Parse a callback_data string into action and notification ID.
 */
export function parseCallbackData(data: string): { action: CallbackAction; notificationId: string } | null {
  const parts = data.split(':');
  if (parts.length < 2) return null;

  const [action, ...rest] = parts;
  const notificationId = rest.join(':'); // Handle IDs that might contain colons

  const validActions: CallbackAction[] = [
    'ack', 'dismiss', 'details', 'snooze', 'save', 'skip',
    'fullDigest', 'todayTasks', 'moreInfo', 'lessLike', 'breakdown',
    'councilApprove', 'councilReject', 'councilAbstain'
  ];

  if (!validActions.includes(action as CallbackAction)) return null;

  return { action: action as CallbackAction, notificationId };
}

/**
 * Create a callback_data string from action and notification ID.
 */
export function makeCallbackData(action: CallbackAction, notificationId: string): string {
  // Telegram limits callback_data to 64 bytes — truncate ID if needed
  const maxIdLength = 64 - action.length - 1; // -1 for colon
  const truncatedId = notificationId.length > maxIdLength
    ? notificationId.slice(0, maxIdLength)
    : notificationId;
  return `${action}:${truncatedId}`;
}

// ─── Keyboard Generation ──────────────────────────────────────────────────────

/**
 * Generate inline keyboard for a notification based on its category.
 * Returns null for P3/P4 notifications (no buttons).
 */
export function generateKeyboard(
  notificationId: string,
  category: NotificationCategory,
  priority: NotificationPriority,
): TelegramInlineKeyboard | null {
  // P3 and P4: no buttons
  if (priority === 'P3' || priority === 'P4') return null;

  const buttons = getCategoryButtons(category, notificationId);
  if (buttons.length === 0) return null;

  // Always add "Less like this" as second row for non-critical
  const keyboard: InlineKeyboardMarkup = [buttons];

  if (priority !== 'P0') {
    keyboard.push([
      {
        text: '🔕 Less like this',
        callback_data: makeCallbackData('lessLike', notificationId),
      },
    ]);
  }

  return { inline_keyboard: keyboard };
}

/**
 * Get category-specific action buttons.
 */
function getCategoryButtons(
  category: NotificationCategory,
  notificationId: string,
): InlineKeyboardRow {
  switch (category) {
    case 'council_approval':
      return [
        { text: '✅ Approve', callback_data: makeCallbackData('councilApprove', notificationId) },
        { text: '❌ Reject', callback_data: makeCallbackData('councilReject', notificationId) },
        { text: '⚖️ Abstain', callback_data: makeCallbackData('councilAbstain', notificationId) },
      ];

    case 'error':
    case 'security':
      return [
        { text: '📋 Details', callback_data: makeCallbackData('details', notificationId) },
        { text: '✅ Acknowledge', callback_data: makeCallbackData('ack', notificationId) },
      ];

    case 'budget':
      return [
        { text: '📊 Full Breakdown', callback_data: makeCallbackData('breakdown', notificationId) },
        { text: '👌 OK', callback_data: makeCallbackData('ack', notificationId) },
      ];

    case 'opportunity':
      return [
        { text: 'ℹ️ More Info', callback_data: makeCallbackData('moreInfo', notificationId) },
        { text: '📌 Save', callback_data: makeCallbackData('save', notificationId) },
        { text: '⏭ Skip', callback_data: makeCallbackData('skip', notificationId) },
      ];

    case 'question':
      // Dynamic options would be added per-notification; base buttons:
      return [
        { text: '✅ Acknowledge', callback_data: makeCallbackData('ack', notificationId) },
        { text: '⏰ Snooze', callback_data: makeCallbackData('snooze', notificationId) },
      ];

    case 'daily':
      return [
        { text: '📄 Full Digest', callback_data: makeCallbackData('fullDigest', notificationId) },
        { text: '📋 Today\'s Tasks', callback_data: makeCallbackData('todayTasks', notificationId) },
      ];

    case 'finance':
    case 'billing':
      return [
        { text: '📊 Details', callback_data: makeCallbackData('details', notificationId) },
        { text: '👌 OK', callback_data: makeCallbackData('ack', notificationId) },
      ];

    case 'milestone':
    case 'insight':
      return [
        { text: '📋 Details', callback_data: makeCallbackData('details', notificationId) },
        { text: '📌 Save', callback_data: makeCallbackData('save', notificationId) },
      ];

    case 'reminder':
      return [
        { text: '✅ Done', callback_data: makeCallbackData('ack', notificationId) },
        { text: '⏰ Snooze', callback_data: makeCallbackData('snooze', notificationId) },
      ];

    case 'task':
      return [
        { text: '✅ Acknowledge', callback_data: makeCallbackData('ack', notificationId) },
      ];

    default:
      return [
        { text: '✅ OK', callback_data: makeCallbackData('ack', notificationId) },
      ];
  }
}

/**
 * Generate a "message was acknowledged" replacement keyboard.
 * Shows the action taken and removes all other buttons.
 */
export function generateAckedKeyboard(action: CallbackAction): TelegramInlineKeyboard {
  const labels: Record<CallbackAction, string> = {
    ack: '✅ Acknowledged',
    dismiss: '🔕 Dismissed',
    details: '📋 Details shown',
    snooze: '⏰ Snoozed',
    save: '📌 Saved',
    skip: '⏭ Skipped',
    fullDigest: '📄 Digest shown',
    todayTasks: '📋 Tasks shown',
    moreInfo: 'ℹ️ Info shown',
    lessLike: '🔕 Noted — fewer like this',
    breakdown: '📊 Breakdown shown',
    councilApprove: '✅ Voted: Approve',
    councilReject: '❌ Voted: Reject',
    councilAbstain: '⚖️ Voted: Abstain',
  };

  return {
    inline_keyboard: [[{
      text: labels[action],
      callback_data: 'noop:done', // No-op callback for visual feedback
    }]],
  };
}
