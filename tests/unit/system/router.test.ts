import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { EventBus } from '../../../src/kernel/event-bus.js';
import { AuditLogger } from '../../../src/kernel/audit.js';
import { SystemRouter } from '../../../src/system/router.js';
import { saveContext, ensureContextsDir } from '../../../src/system/storage.js';
import type { Message } from '../../../src/kernel/types.js';
import type { Context } from '../../../src/system/types.js';

describe('SystemRouter', () => {
  let eventBus: EventBus;
  let audit: AuditLogger;
  let router: SystemRouter;
  let testAuditPath: string;

  beforeEach(() => {
    testAuditPath = join(tmpdir(), `ari-test-${randomUUID()}.json`);
    eventBus = new EventBus();
    audit = new AuditLogger(testAuditPath);
    router = new SystemRouter(eventBus, audit);
  });

  it('should subscribe to message:accepted and audit routing', async () => {
    router.start();

    const message: Message = {
      id: randomUUID(),
      content: 'Hello, how are you?',
      source: 'standard',
      timestamp: new Date(),
    };

    // Emit message:accepted (simulating kernel pipeline completion)
    eventBus.emit('message:accepted', message);

    // Wait for async handler (matchContext does disk I/O)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify audit log contains the routing event
    const events = audit.getEvents();
    expect(events.length).toBeGreaterThanOrEqual(1);

    const routeEvent = events.find((e) => e.action === 'system_routed');
    expect(routeEvent).toBeDefined();
    expect(routeEvent!.actor).toBe('system_router');
    expect(routeEvent!.details?.messageId).toBe(message.id);
    expect(routeEvent!.details?.route).toBe('default');

    router.stop();
  });

  it('should emit system:routed event after routing', async () => {
    router.start();

    let routedPayload: { messageId: string; route: string } | null = null;
    eventBus.on('system:routed', (payload) => {
      routedPayload = payload;
    });

    const message: Message = {
      id: randomUUID(),
      content: 'Test message',
      source: 'untrusted',
      timestamp: new Date(),
    };

    eventBus.emit('message:accepted', message);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    expect(routedPayload).not.toBeNull();
    expect(routedPayload!.messageId).toBe(message.id);
    expect(routedPayload!.route).toBe('default');

    router.stop();
  });

  it('should match message to context when triggers match', async () => {
    // Create a test context
    await ensureContextsDir();
    const testContext: Context = {
      id: 'test_finance',
      name: 'Finance',
      type: 'life',
      description: 'Personal finances',
      partition: 'LIFE_FINANCE',
      triggers: ['budget', 'money', 'savings'],
      active: false,
      createdAt: new Date().toISOString(),
    };
    await saveContext(testContext);

    router.start();

    const message: Message = {
      id: randomUUID(),
      content: 'Help me review my budget for this month',
      source: 'standard',
      timestamp: new Date(),
    };

    eventBus.emit('message:accepted', message);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const events = audit.getEvents();
    const routeEvent = events.find((e) => e.action === 'system_routed');
    expect(routeEvent).toBeDefined();
    expect(routeEvent!.details?.contextId).toBe('test_finance');
    expect(routeEvent!.details?.route).toBe('context:life:test_finance');

    router.stop();
  });

  it('should stop subscribing after stop() is called', async () => {
    router.start();
    router.stop();

    const message: Message = {
      id: randomUUID(),
      content: 'This should not be routed',
      source: 'standard',
      timestamp: new Date(),
    };

    eventBus.emit('message:accepted', message);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const events = audit.getEvents();
    expect(events.length).toBe(0);
  });

  it('should prove full pipeline: sanitize → audit → event → system route → audit', async () => {
    // This test simulates the full pipeline without a running gateway:
    // 1. Kernel would sanitize (we skip — tested elsewhere)
    // 2. Kernel audits message_received
    // 3. Kernel emits message:accepted
    // 4. System router handles → audits system_routed
    // 5. We verify both audit entries exist, proving chain of custody

    router.start();

    // Step 2: Kernel audit (simulated)
    const messageId = randomUUID();
    await audit.log('message_received', 'untrusted', 'untrusted', {
      messageId,
      contentLength: 42,
    });

    // Step 3: Kernel emits message:accepted
    const message: Message = {
      id: messageId,
      content: 'A perfectly normal message for processing',
      source: 'untrusted',
      timestamp: new Date(),
    };
    eventBus.emit('message:accepted', message);

    // Wait for async routing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Step 5: Verify audit chain proves full pipeline
    const events = audit.getEvents();
    expect(events.length).toBe(2);

    // First: kernel logged message_received
    expect(events[0].action).toBe('message_received');
    expect(events[0].details?.messageId).toBe(messageId);

    // Second: system logged system_routed
    expect(events[1].action).toBe('system_routed');
    expect(events[1].details?.messageId).toBe(messageId);

    // Hash chain is intact (proves tamper evidence)
    expect(events[1].previousHash).toBe(events[0].hash);
    const verification = await audit.verify();
    expect(verification.valid).toBe(true);

    router.stop();
  });
});
