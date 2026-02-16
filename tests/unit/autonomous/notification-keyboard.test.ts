import { describe, it, expect } from 'vitest';
import {
  generateKeyboard,
  generateAckedKeyboard,
  parseCallbackData,
  makeCallbackData,
} from '../../../src/autonomous/notification-keyboard.js';

describe('Notification Keyboard', () => {
  // ─── Keyboard Generation ──────────────────────────────────────────────────

  describe('generateKeyboard', () => {
    it('should generate error/security keyboard with Details + Acknowledge', () => {
      const kb = generateKeyboard('notif-1', 'error', 'P1');
      expect(kb).not.toBeNull();
      expect(kb!.inline_keyboard[0]).toHaveLength(2);
      expect(kb!.inline_keyboard[0][0].text).toContain('Details');
      expect(kb!.inline_keyboard[0][1].text).toContain('Acknowledge');
    });

    it('should generate budget keyboard with Breakdown + OK', () => {
      const kb = generateKeyboard('notif-2', 'budget', 'P1');
      expect(kb).not.toBeNull();
      expect(kb!.inline_keyboard[0][0].text).toContain('Breakdown');
      expect(kb!.inline_keyboard[0][1].text).toContain('OK');
    });

    it('should generate opportunity keyboard with More Info + Save + Skip', () => {
      const kb = generateKeyboard('notif-3', 'opportunity', 'P1');
      expect(kb).not.toBeNull();
      expect(kb!.inline_keyboard[0]).toHaveLength(3);
      expect(kb!.inline_keyboard[0][0].text).toContain('More Info');
      expect(kb!.inline_keyboard[0][1].text).toContain('Save');
      expect(kb!.inline_keyboard[0][2].text).toContain('Skip');
    });

    it('should generate question keyboard with Acknowledge + Snooze', () => {
      const kb = generateKeyboard('notif-4', 'question', 'P1');
      expect(kb).not.toBeNull();
      expect(kb!.inline_keyboard[0][0].text).toContain('Acknowledge');
      expect(kb!.inline_keyboard[0][1].text).toContain('Snooze');
    });

    it('should generate daily keyboard with Full Digest + Today Tasks', () => {
      const kb = generateKeyboard('notif-5', 'daily', 'P2');
      expect(kb).not.toBeNull();
      expect(kb!.inline_keyboard[0][0].text).toContain('Full Digest');
      expect(kb!.inline_keyboard[0][1].text).toContain('Tasks');
    });

    it('should generate reminder keyboard with Done + Snooze', () => {
      const kb = generateKeyboard('notif-6', 'reminder', 'P2');
      expect(kb).not.toBeNull();
      expect(kb!.inline_keyboard[0][0].text).toContain('Done');
      expect(kb!.inline_keyboard[0][1].text).toContain('Snooze');
    });

    it('should return null for P3 notifications', () => {
      expect(generateKeyboard('notif-7', 'task', 'P3')).toBeNull();
    });

    it('should return null for P4 notifications', () => {
      expect(generateKeyboard('notif-8', 'value', 'P4')).toBeNull();
    });

    it('should add "Less like this" row for non-P0 notifications', () => {
      const kb = generateKeyboard('notif-9', 'finance', 'P1');
      expect(kb).not.toBeNull();
      expect(kb!.inline_keyboard.length).toBeGreaterThanOrEqual(2);
      const lastRow = kb!.inline_keyboard[kb!.inline_keyboard.length - 1];
      expect(lastRow[0].text).toContain('Less like this');
    });

    it('should NOT add "Less like this" for P0 notifications', () => {
      const kb = generateKeyboard('notif-10', 'security', 'P0');
      expect(kb).not.toBeNull();
      // P0 security has 1 row of buttons, no "Less like this"
      const allText = kb!.inline_keyboard.flat().map((b) => b.text).join(' ');
      expect(allText).not.toContain('Less like this');
    });
  });

  // ─── Callback Data ────────────────────────────────────────────────────────

  describe('makeCallbackData', () => {
    it('should create action:id format', () => {
      expect(makeCallbackData('ack', 'abc-123')).toBe('ack:abc-123');
    });

    it('should truncate long IDs to fit 64-byte limit', () => {
      const longId = 'a'.repeat(100);
      const result = makeCallbackData('ack', longId);
      expect(result.length).toBeLessThanOrEqual(64);
    });
  });

  describe('parseCallbackData', () => {
    it('should parse valid callback data', () => {
      const result = parseCallbackData('ack:notif-123');
      expect(result).toEqual({ action: 'ack', notificationId: 'notif-123' });
    });

    it('should handle IDs with colons', () => {
      const result = parseCallbackData('details:uuid:with:colons');
      expect(result).toEqual({ action: 'details', notificationId: 'uuid:with:colons' });
    });

    it('should return null for invalid format', () => {
      expect(parseCallbackData('noaction')).toBeNull();
    });

    it('should return null for unknown actions', () => {
      expect(parseCallbackData('unknown:123')).toBeNull();
    });

    it('should parse all valid actions', () => {
      const actions = [
        'ack', 'dismiss', 'details', 'snooze', 'save', 'skip',
        'fullDigest', 'todayTasks', 'moreInfo', 'lessLike', 'breakdown',
      ];
      for (const action of actions) {
        const result = parseCallbackData(`${action}:test-id`);
        expect(result).not.toBeNull();
        expect(result!.action).toBe(action);
      }
    });
  });

  // ─── Acked Keyboard ──────────────────────────────────────────────────────

  describe('generateAckedKeyboard', () => {
    it('should show acknowledged label', () => {
      const kb = generateAckedKeyboard('ack');
      expect(kb.inline_keyboard[0][0].text).toContain('Acknowledged');
    });

    it('should show dismissed label', () => {
      const kb = generateAckedKeyboard('dismiss');
      expect(kb.inline_keyboard[0][0].text).toContain('Dismissed');
    });

    it('should show snoozed label', () => {
      const kb = generateAckedKeyboard('snooze');
      expect(kb.inline_keyboard[0][0].text).toContain('Snoozed');
    });

    it('should use noop callback data', () => {
      const kb = generateAckedKeyboard('ack');
      expect(kb.inline_keyboard[0][0].callback_data).toBe('noop:done');
    });

    it('should show correct labels for all actions', () => {
      const actions = ['ack', 'dismiss', 'details', 'snooze', 'save', 'skip',
        'fullDigest', 'todayTasks', 'moreInfo', 'lessLike', 'breakdown'] as const;

      for (const action of actions) {
        const kb = generateAckedKeyboard(action);
        expect(kb.inline_keyboard).toHaveLength(1);
        expect(kb.inline_keyboard[0]).toHaveLength(1);
        expect(kb.inline_keyboard[0][0].text.length).toBeGreaterThan(0);
      }
    });
  });
});
