import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer, type Server } from 'http';
import { WebSocket } from 'ws';
import { WebSocketBroadcaster } from '../../../src/api/ws.js';
import { EventBus } from '../../../src/kernel/event-bus.js';

describe('WebSocketBroadcaster', () => {
  let httpServer: Server;
  let eventBus: EventBus;
  let broadcaster: WebSocketBroadcaster;
  let port: number;

  beforeEach(async () => {
    eventBus = new EventBus();
    httpServer = createServer();

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const address = httpServer.address();
        if (address && typeof address === 'object') {
          port = address.port;
          broadcaster = new WebSocketBroadcaster(httpServer, eventBus);
          resolve();
        }
      });
    });
  });

  afterEach(async () => {
    if (broadcaster) {
      broadcaster.close();
    }
    await new Promise<void>((resolve) => {
      if (httpServer) {
        httpServer.close(() => resolve());
      } else {
        resolve();
      }
    });
  });

  it('should establish WebSocket connection', async () => {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
      });

      ws.on('close', () => {
        resolve();
      });

      ws.on('error', reject);
    });
  });

  it('should send welcome message on connection', async () => {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

      ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('connection:established');
        expect(message.payload.message).toBe('Connected to ARI WebSocket');
        ws.close();
        resolve();
      });

      ws.on('error', reject);
    });
  });

  it('should broadcast message:accepted events', async () => {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      let messageCount = 0;

      ws.on('message', (data: Buffer) => {
        messageCount++;
        const message = JSON.parse(data.toString());

        if (messageCount === 1) {
          expect(message.type).toBe('connection:established');

          eventBus.emit('message:accepted', {
            id: 'test-123',
            content: 'test message',
            source: 'untrusted',
            timestamp: new Date(),
          });
        } else if (messageCount === 2) {
          expect(message.type).toBe('message:accepted');
          expect(message.payload.id).toBe('test-123');
          expect(message.payload.content).toBe('test message');
          ws.close();
          resolve();
        }
      });

      ws.on('error', reject);
    });
  });

  it('should broadcast security:detected events', async () => {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      let messageCount = 0;

      ws.on('message', (data: Buffer) => {
        messageCount++;
        const message = JSON.parse(data.toString());

        if (messageCount === 1) {
          eventBus.emit('security:detected', {
            id: 'sec-123',
            timestamp: new Date(),
            eventType: 'injection_detected',
            severity: 'high',
            source: 'test',
            details: { pattern: 'xss' },
            mitigated: true,
          });
        } else if (messageCount === 2) {
          expect(message.type).toBe('security:detected');
          expect(message.payload.id).toBe('sec-123');
          ws.close();
          resolve();
        }
      });

      ws.on('error', reject);
    });
  });

  it('should broadcast vote:started events', async () => {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      let messageCount = 0;

      ws.on('message', (data: Buffer) => {
        messageCount++;
        const message = JSON.parse(data.toString());

        if (messageCount === 1) {
          eventBus.emit('vote:started', {
            voteId: 'vote-123',
            topic: 'Test vote',
            threshold: 'MAJORITY',
            deadline: new Date().toISOString(),
          });
        } else if (messageCount === 2) {
          expect(message.type).toBe('vote:started');
          expect(message.payload.voteId).toBe('vote-123');
          ws.close();
          resolve();
        }
      });

      ws.on('error', reject);
    });
  });

  it('should broadcast memory:stored events', async () => {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      let messageCount = 0;

      ws.on('message', (data: Buffer) => {
        messageCount++;
        const message = JSON.parse(data.toString());

        if (messageCount === 1) {
          eventBus.emit('memory:stored', {
            memoryId: 'mem-123',
            type: 'FACT',
            partition: 'PUBLIC',
            agent: 'core',
          });
        } else if (messageCount === 2) {
          expect(message.type).toBe('memory:stored');
          expect(message.payload.memoryId).toBe('mem-123');
          ws.close();
          resolve();
        }
      });

      ws.on('error', reject);
    });
  });

  it('should broadcast agent:started events', async () => {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      let messageCount = 0;

      ws.on('message', (data: Buffer) => {
        messageCount++;
        const message = JSON.parse(data.toString());

        if (messageCount === 1) {
          eventBus.emit('agent:started', {
            agent: 'core',
            timestamp: new Date(),
          });
        } else if (messageCount === 2) {
          expect(message.type).toBe('agent:started');
          expect(message.payload.agent).toBe('core');
          ws.close();
          resolve();
        }
      });

      ws.on('error', reject);
    });
  });

  it('should respond to ping messages', async () => {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      let messageCount = 0;

      ws.on('message', (data: Buffer) => {
        messageCount++;
        const message = JSON.parse(data.toString());

        if (messageCount === 1) {
          ws.send(JSON.stringify({ type: 'ping' }));
        } else if (messageCount === 2) {
          expect(message.type).toBe('pong');
          expect(message.payload.timestamp).toBeDefined();
          ws.close();
          resolve();
        }
      });

      ws.on('error', reject);
    });
  });

  it('should handle multiple concurrent clients', async () => {
    await new Promise<void>((resolve, reject) => {
      const ws1 = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      const ws2 = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      let ws1Count = 0;
      let ws2Count = 0;

      ws1.on('message', (data: Buffer) => {
        ws1Count++;
        if (ws1Count === 1) {
          if (ws2Count >= 1) {
            eventBus.emit('message:accepted', {
              id: 'broadcast-test',
              content: 'test',
              source: 'untrusted',
              timestamp: new Date(),
            });
          }
        } else if (ws1Count === 2) {
          const message = JSON.parse(data.toString());
          expect(message.type).toBe('message:accepted');
          ws1.close();
        }
      });

      ws2.on('message', (data: Buffer) => {
        ws2Count++;
        if (ws2Count === 1) {
          if (ws1Count >= 1) {
            eventBus.emit('message:accepted', {
              id: 'broadcast-test',
              content: 'test',
              source: 'untrusted',
              timestamp: new Date(),
            });
          }
        } else if (ws2Count === 2) {
          const message = JSON.parse(data.toString());
          expect(message.type).toBe('message:accepted');
          ws2.close();
          resolve();
        }
      });

      ws1.on('error', reject);
      ws2.on('error', reject);
    });
  });

  it('should cleanup on close', () => {
    expect(() => {
      broadcaster.close();
    }).not.toThrow();

    // Verify event bus listeners are removed
    expect(eventBus.listenerCount('message:accepted')).toBe(0);
    expect(eventBus.listenerCount('security:detected')).toBe(0);
  });

  it('should broadcast agent:stopped events', async () => {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      let messageCount = 0;

      ws.on('message', (data: Buffer) => {
        messageCount++;
        const message = JSON.parse(data.toString());

        if (messageCount === 1) {
          eventBus.emit('agent:stopped', {
            agent: 'guardian',
            timestamp: new Date(),
          });
        } else if (messageCount === 2) {
          expect(message.type).toBe('agent:stopped');
          expect(message.payload.agent).toBe('guardian');
          ws.close();
          resolve();
        }
      });

      ws.on('error', reject);
    });
  });

  it('should broadcast message:rejected events', async () => {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      let messageCount = 0;

      ws.on('message', (data: Buffer) => {
        messageCount++;
        const message = JSON.parse(data.toString());

        if (messageCount === 1) {
          eventBus.emit('message:rejected', {
            id: 'reject-123',
            reason: 'test rejection',
            timestamp: new Date(),
          });
        } else if (messageCount === 2) {
          expect(message.type).toBe('message:rejected');
          expect(message.payload.id).toBe('reject-123');
          expect(message.payload.reason).toBe('test rejection');
          ws.close();
          resolve();
        }
      });

      ws.on('error', reject);
    });
  });

  it('should broadcast vote:completed events', async () => {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      let messageCount = 0;

      ws.on('message', (data: Buffer) => {
        messageCount++;
        const message = JSON.parse(data.toString());

        if (messageCount === 1) {
          eventBus.emit('vote:completed', {
            voteId: 'vote-complete-123',
            result: 'PASSED',
            tally: { approve: 7, reject: 3, abstain: 3 },
          });
        } else if (messageCount === 2) {
          expect(message.type).toBe('vote:completed');
          expect(message.payload.voteId).toBe('vote-complete-123');
          expect(message.payload.result).toBe('PASSED');
          ws.close();
          resolve();
        }
      });

      ws.on('error', reject);
    });
  });

  it('should broadcast arbiter:ruling events', async () => {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      let messageCount = 0;

      ws.on('message', (data: Buffer) => {
        messageCount++;
        const message = JSON.parse(data.toString());

        if (messageCount === 1) {
          eventBus.emit('arbiter:ruling', {
            ruleId: 'rule-1',
            action: 'block',
            reason: 'Security violation',
            timestamp: new Date().toISOString(),
          });
        } else if (messageCount === 2) {
          expect(message.type).toBe('arbiter:ruling');
          expect(message.payload.ruleId).toBe('rule-1');
          expect(message.payload.action).toBe('block');
          ws.close();
          resolve();
        }
      });

      ws.on('error', reject);
    });
  });

  it('should broadcast overseer:gate events', async () => {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      let messageCount = 0;

      ws.on('message', (data: Buffer) => {
        messageCount++;
        const message = JSON.parse(data.toString());

        if (messageCount === 1) {
          eventBus.emit('overseer:gate', {
            gateId: 'gate-1',
            passed: true,
            timestamp: new Date().toISOString(),
          });
        } else if (messageCount === 2) {
          expect(message.type).toBe('overseer:gate');
          expect(message.payload.gateId).toBe('gate-1');
          expect(message.payload.passed).toBe(true);
          ws.close();
          resolve();
        }
      });

      ws.on('error', reject);
    });
  });

  it('should broadcast memory:quarantined events', async () => {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      let messageCount = 0;

      ws.on('message', (data: Buffer) => {
        messageCount++;
        const message = JSON.parse(data.toString());

        if (messageCount === 1) {
          eventBus.emit('memory:quarantined', {
            memoryId: 'mem-quarantine-123',
            reason: 'Suspicious content',
            agent: 'guardian',
          });
        } else if (messageCount === 2) {
          expect(message.type).toBe('memory:quarantined');
          expect(message.payload.memoryId).toBe('mem-quarantine-123');
          expect(message.payload.reason).toBe('Suspicious content');
          ws.close();
          resolve();
        }
      });

      ws.on('error', reject);
    });
  });

  it('should broadcast tool:executed events', async () => {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      let messageCount = 0;

      ws.on('message', (data: Buffer) => {
        messageCount++;
        const message = JSON.parse(data.toString());

        if (messageCount === 1) {
          eventBus.emit('tool:executed', {
            toolId: 'file_read',
            success: true,
            agent: 'executor',
            timestamp: new Date().toISOString(),
          });
        } else if (messageCount === 2) {
          expect(message.type).toBe('tool:executed');
          expect(message.payload.toolId).toBe('file_read');
          expect(message.payload.success).toBe(true);
          ws.close();
          resolve();
        }
      });

      ws.on('error', reject);
    });
  });

  it('should ignore malformed JSON messages', async () => {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      let messageCount = 0;

      ws.on('message', (data: Buffer) => {
        messageCount++;
        const message = JSON.parse(data.toString());

        if (messageCount === 1) {
          // Send malformed JSON - should be silently ignored
          ws.send('not valid json {{{');

          // Send a valid ping to verify the connection still works
          setTimeout(() => {
            ws.send(JSON.stringify({ type: 'ping' }));
          }, 50);
        } else if (messageCount === 2) {
          // Should still receive pong after malformed message
          expect(message.type).toBe('pong');
          ws.close();
          resolve();
        }
      });

      ws.on('error', reject);
    });
  });

  it('should not broadcast to clients that are not OPEN', async () => {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

      ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'connection:established') {
          // Close the connection
          ws.close();
        }
      });

      ws.on('close', () => {
        // Emit an event after the client is closed
        // This should not throw and should be silently skipped
        expect(() => {
          eventBus.emit('message:accepted', {
            id: 'after-close',
            content: 'test',
            source: 'untrusted',
            timestamp: new Date(),
          });
        }).not.toThrow();
        resolve();
      });

      ws.on('error', reject);
    });
  });

  it('should handle non-ping messages without responding', async () => {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      let messageCount = 0;

      ws.on('message', (data: Buffer) => {
        messageCount++;
        const message = JSON.parse(data.toString());

        if (messageCount === 1) {
          expect(message.type).toBe('connection:established');
          // Send a non-ping message
          ws.send(JSON.stringify({ type: 'other', data: 'test' }));
          // Wait a bit to ensure no response comes
          setTimeout(() => {
            ws.close();
          }, 100);
        }
      });

      ws.on('close', () => {
        // Only received welcome message, no response to non-ping
        expect(messageCount).toBe(1);
        resolve();
      });

      ws.on('error', reject);
    });
  });

  it('should handle WebSocket client errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

      ws.on('open', () => {
        // Simulate an error by terminating the underlying socket abruptly
        // This triggers the error handler on the server side
        ws.terminate();

        // Give the server time to process the termination
        setTimeout(() => {
          resolve();
        }, 100);
      });

      ws.on('error', () => {
        // Client error is expected when we terminate
      });
    });

    consoleSpy.mockRestore();
  });
});
