import { describe, it, expect } from 'vitest';
import {
  eventMatches,
  SUBSCRIBABLE_EVENTS,
  PROTECTED_EVENTS,
  ADMIN_ONLY_EVENTS,
  EVENT_TO_MESSAGE_TYPE,
} from '../../../../src/kernel/control-plane/events.js';

describe('Events', () => {
  describe('eventMatches', () => {
    describe('exact matches', () => {
      it('should match identical event names', () => {
        expect(eventMatches('message:received', 'message:received')).toBe(true);
        expect(eventMatches('tool:start', 'tool:start')).toBe(true);
        expect(eventMatches('session:end', 'session:end')).toBe(true);
      });

      it('should not match different event names', () => {
        expect(eventMatches('message:received', 'message:sent')).toBe(false);
        expect(eventMatches('tool:start', 'tool:end')).toBe(false);
      });
    });

    describe('wildcard matches', () => {
      it('should match wildcard pattern with :* suffix', () => {
        expect(eventMatches('message:*', 'message:received')).toBe(true);
        expect(eventMatches('message:*', 'message:sent')).toBe(true);
        expect(eventMatches('message:*', 'message:processed')).toBe(true);
      });

      it('should match tool:* wildcard', () => {
        expect(eventMatches('tool:*', 'tool:start')).toBe(true);
        expect(eventMatches('tool:*', 'tool:update')).toBe(true);
        expect(eventMatches('tool:*', 'tool:end')).toBe(true);
      });

      it('should match session:* wildcard', () => {
        expect(eventMatches('session:*', 'session:start')).toBe(true);
        expect(eventMatches('session:*', 'session:end')).toBe(true);
        expect(eventMatches('session:*', 'session:activity')).toBe(true);
      });

      it('should match channel:* wildcard', () => {
        expect(eventMatches('channel:*', 'channel:status')).toBe(true);
        expect(eventMatches('channel:*', 'channel:connected')).toBe(true);
      });

      it('should match system:* wildcard', () => {
        expect(eventMatches('system:*', 'system:ready')).toBe(true);
        expect(eventMatches('system:*', 'system:error')).toBe(true);
        expect(eventMatches('system:*', 'system:halted')).toBe(true);
      });

      it('should not match wildcard when prefix does not match', () => {
        expect(eventMatches('message:*', 'tool:start')).toBe(false);
        expect(eventMatches('tool:*', 'session:start')).toBe(false);
        expect(eventMatches('session:*', 'channel:status')).toBe(false);
      });

      it('should not match partial prefix with wildcard', () => {
        // 'msg:*' should not match 'message:received'
        expect(eventMatches('msg:*', 'message:received')).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle empty strings', () => {
        expect(eventMatches('', '')).toBe(true);
        expect(eventMatches('', 'message:received')).toBe(false);
        expect(eventMatches('message:received', '')).toBe(false);
      });

      it('should not match wildcard against base prefix alone', () => {
        // 'message:*' should match 'message:something' but not just 'message'
        expect(eventMatches('message:*', 'message')).toBe(false);
      });

      it('should handle pattern that ends with :* but has no following content', () => {
        expect(eventMatches(':*', ':received')).toBe(true);
        expect(eventMatches(':*', ':anything')).toBe(true);
      });

      it('should handle deeply nested event names', () => {
        expect(eventMatches('controlplane:*', 'controlplane:client:connected')).toBe(true);
        expect(eventMatches('controlplane:*', 'controlplane:server:started')).toBe(true);
      });

      it('should not do partial wildcard matching', () => {
        // Pattern 'tool:st*' should not match 'tool:start' (we only support :* at end)
        expect(eventMatches('tool:st*', 'tool:start')).toBe(false);
      });
    });
  });

  describe('SUBSCRIBABLE_EVENTS', () => {
    it('should include wildcard subscriptions', () => {
      expect(SUBSCRIBABLE_EVENTS).toContain('session:*');
      expect(SUBSCRIBABLE_EVENTS).toContain('message:*');
      expect(SUBSCRIBABLE_EVENTS).toContain('tool:*');
      expect(SUBSCRIBABLE_EVENTS).toContain('channel:*');
    });

    it('should include specific session events', () => {
      expect(SUBSCRIBABLE_EVENTS).toContain('session:start');
      expect(SUBSCRIBABLE_EVENTS).toContain('session:end');
    });

    it('should include specific message events', () => {
      expect(SUBSCRIBABLE_EVENTS).toContain('message:inbound');
      expect(SUBSCRIBABLE_EVENTS).toContain('message:outbound');
      expect(SUBSCRIBABLE_EVENTS).toContain('message:processed');
    });

    it('should include specific tool events', () => {
      expect(SUBSCRIBABLE_EVENTS).toContain('tool:start');
      expect(SUBSCRIBABLE_EVENTS).toContain('tool:update');
      expect(SUBSCRIBABLE_EVENTS).toContain('tool:end');
    });

    it('should include channel events', () => {
      expect(SUBSCRIBABLE_EVENTS).toContain('channel:status');
    });

    it('should include system events', () => {
      expect(SUBSCRIBABLE_EVENTS).toContain('system:ready');
      expect(SUBSCRIBABLE_EVENTS).toContain('system:error');
    });

    it('should be an immutable array (const assertion)', () => {
      // TypeScript ensures this, but we can verify the type at runtime
      expect(Array.isArray(SUBSCRIBABLE_EVENTS)).toBe(true);
    });
  });

  describe('PROTECTED_EVENTS', () => {
    it('should be a Set', () => {
      expect(PROTECTED_EVENTS).toBeInstanceOf(Set);
    });

    it('should include tool events', () => {
      expect(PROTECTED_EVENTS.has('tool:*')).toBe(true);
      expect(PROTECTED_EVENTS.has('tool:start')).toBe(true);
      expect(PROTECTED_EVENTS.has('tool:update')).toBe(true);
      expect(PROTECTED_EVENTS.has('tool:end')).toBe(true);
    });

    it('should include system events', () => {
      expect(PROTECTED_EVENTS.has('system:*')).toBe(true);
    });

    it('should include security events', () => {
      expect(PROTECTED_EVENTS.has('security:*')).toBe(true);
    });

    it('should not include message events', () => {
      expect(PROTECTED_EVENTS.has('message:*')).toBe(false);
      expect(PROTECTED_EVENTS.has('message:received')).toBe(false);
    });

    it('should not include session events', () => {
      expect(PROTECTED_EVENTS.has('session:*')).toBe(false);
      expect(PROTECTED_EVENTS.has('session:start')).toBe(false);
    });
  });

  describe('ADMIN_ONLY_EVENTS', () => {
    it('should be a Set', () => {
      expect(ADMIN_ONLY_EVENTS).toBeInstanceOf(Set);
    });

    it('should include security events', () => {
      expect(ADMIN_ONLY_EVENTS.has('security:*')).toBe(true);
    });

    it('should include audit events', () => {
      expect(ADMIN_ONLY_EVENTS.has('audit:*')).toBe(true);
    });

    it('should not include tool events', () => {
      expect(ADMIN_ONLY_EVENTS.has('tool:*')).toBe(false);
    });

    it('should not include message events', () => {
      expect(ADMIN_ONLY_EVENTS.has('message:*')).toBe(false);
    });
  });

  describe('EVENT_TO_MESSAGE_TYPE', () => {
    it('should map message:received correctly', () => {
      expect(EVENT_TO_MESSAGE_TYPE['message:received']).toBe('message:received');
    });

    it('should map message:processed correctly', () => {
      expect(EVENT_TO_MESSAGE_TYPE['message:processed']).toBe('message:processed');
    });

    it('should map tool:executed to tool:end', () => {
      expect(EVENT_TO_MESSAGE_TYPE['tool:executed']).toBe('tool:end');
    });

    it('should map security:detected to error', () => {
      expect(EVENT_TO_MESSAGE_TYPE['security:detected']).toBe('error');
    });

    it('should map system:ready to health:pong', () => {
      expect(EVENT_TO_MESSAGE_TYPE['system:ready']).toBe('health:pong');
    });

    it('should map system:error to error', () => {
      expect(EVENT_TO_MESSAGE_TYPE['system:error']).toBe('error');
    });

    it('should be a plain object', () => {
      expect(typeof EVENT_TO_MESSAGE_TYPE).toBe('object');
      expect(EVENT_TO_MESSAGE_TYPE).not.toBeInstanceOf(Map);
    });
  });

  describe('Event patterns integration', () => {
    it('should correctly identify protected events using eventMatches', () => {
      const toolEvents = ['tool:start', 'tool:update', 'tool:end'];

      for (const event of toolEvents) {
        let isProtected = false;
        for (const pattern of PROTECTED_EVENTS) {
          if (eventMatches(pattern, event)) {
            isProtected = true;
            break;
          }
        }
        expect(isProtected).toBe(true);
      }
    });

    it('should correctly identify admin-only events using eventMatches', () => {
      const securityEvents = ['security:detected', 'security:alert', 'security:violation'];

      for (const event of securityEvents) {
        let isAdminOnly = false;
        for (const pattern of ADMIN_ONLY_EVENTS) {
          if (eventMatches(pattern, event)) {
            isAdminOnly = true;
            break;
          }
        }
        expect(isAdminOnly).toBe(true);
      }
    });

    it('should allow subscribable events not in protected or admin-only sets', () => {
      const openEvents = ['message:inbound', 'message:outbound', 'channel:status'];

      for (const event of openEvents) {
        let isProtected = false;
        let isAdminOnly = false;

        for (const pattern of PROTECTED_EVENTS) {
          if (eventMatches(pattern, event)) {
            isProtected = true;
            break;
          }
        }

        for (const pattern of ADMIN_ONLY_EVENTS) {
          if (eventMatches(pattern, event)) {
            isAdminOnly = true;
            break;
          }
        }

        expect(isProtected).toBe(false);
        expect(isAdminOnly).toBe(false);
      }
    });
  });
});
