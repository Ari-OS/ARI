import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { EventBus, EventMap } from '../kernel/event-bus.js';

/**
 * WebSocket event broadcaster
 * Forwards EventBus events to connected WebSocket clients
 */
export class WebSocketBroadcaster {
  private wss: WebSocketServer;
  private unsubscribers: Array<() => void> = [];

  constructor(server: Server, eventBus: EventBus) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.setupEventForwarding(eventBus);
    this.setupConnectionHandling();
  }

  /**
   * Subscribe to key EventBus events and broadcast to WS clients
   */
  private setupEventForwarding(eventBus: EventBus): void {
    // Message events
    this.unsubscribers.push(
      eventBus.on('message:accepted', (payload) => {
        this.broadcast('message:accepted', payload);
      })
    );

    this.unsubscribers.push(
      eventBus.on('message:rejected', (payload) => {
        this.broadcast('message:rejected', payload);
      })
    );

    // Security events
    this.unsubscribers.push(
      eventBus.on('security:detected', (payload) => {
        this.broadcast('security:detected', payload);
      })
    );

    // Governance events
    this.unsubscribers.push(
      eventBus.on('vote:started', (payload) => {
        this.broadcast('vote:started', payload);
      })
    );

    this.unsubscribers.push(
      eventBus.on('vote:cast', (payload) => {
        this.broadcast('vote:cast', payload);
      })
    );

    this.unsubscribers.push(
      eventBus.on('vote:completed', (payload) => {
        this.broadcast('vote:completed', payload);
      })
    );

    this.unsubscribers.push(
      eventBus.on('vote:vetoed', (payload) => {
        this.broadcast('vote:vetoed', payload);
      })
    );

    this.unsubscribers.push(
      eventBus.on('vote:matrix_update', (payload) => {
        this.broadcast('vote:matrix_update', payload);
      })
    );

    this.unsubscribers.push(
      eventBus.on('arbiter:ruling', (payload) => {
        this.broadcast('arbiter:ruling', payload);
      })
    );

    this.unsubscribers.push(
      eventBus.on('overseer:gate', (payload) => {
        this.broadcast('overseer:gate', payload);
      })
    );

    // Council Amendment events
    this.unsubscribers.push(
      eventBus.on('amendment:proposed', (payload) => {
        this.broadcast('amendment:proposed', payload);
      })
    );

    this.unsubscribers.push(
      eventBus.on('amendment:voted', (payload) => {
        this.broadcast('amendment:voted', payload);
      })
    );

    this.unsubscribers.push(
      eventBus.on('amendment:ratified', (payload) => {
        this.broadcast('amendment:ratified', payload);
      })
    );

    // Scheduler events
    this.unsubscribers.push(
      eventBus.on('scheduler:task_run', (payload) => {
        this.broadcast('scheduler:task_run', payload);
      })
    );

    this.unsubscribers.push(
      eventBus.on('scheduler:task_complete', (payload) => {
        this.broadcast('scheduler:task_complete', payload);
      })
    );

    // Subagent events
    this.unsubscribers.push(
      eventBus.on('subagent:spawned', (payload) => {
        this.broadcast('subagent:spawned', payload);
      })
    );

    this.unsubscribers.push(
      eventBus.on('subagent:progress', (payload) => {
        this.broadcast('subagent:progress', payload);
      })
    );

    this.unsubscribers.push(
      eventBus.on('subagent:completed', (payload) => {
        this.broadcast('subagent:completed', payload);
      })
    );

    // Permission events
    this.unsubscribers.push(
      eventBus.on('permission:granted', (payload) => {
        this.broadcast('permission:granted', payload);
      })
    );

    this.unsubscribers.push(
      eventBus.on('permission:denied', (payload) => {
        this.broadcast('permission:denied', payload);
      })
    );

    // Memory events
    this.unsubscribers.push(
      eventBus.on('memory:stored', (payload) => {
        this.broadcast('memory:stored', payload);
      })
    );

    this.unsubscribers.push(
      eventBus.on('memory:quarantined', (payload) => {
        this.broadcast('memory:quarantined', payload);
      })
    );

    // Tool events
    this.unsubscribers.push(
      eventBus.on('tool:executed', (payload) => {
        this.broadcast('tool:executed', payload);
      })
    );

    // Agent events
    this.unsubscribers.push(
      eventBus.on('agent:started', (payload) => {
        this.broadcast('agent:started', payload);
      })
    );

    this.unsubscribers.push(
      eventBus.on('agent:stopped', (payload) => {
        this.broadcast('agent:stopped', payload);
      })
    );
  }

  /**
   * Set up WebSocket connection handling
   */
  private setupConnectionHandling(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      // Send welcome message
      const welcomeMessage = JSON.stringify({
        type: 'connection:established',
        payload: {
          message: 'Connected to ARI WebSocket',
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      });
      ws.send(welcomeMessage);

      // Handle client messages (optional - for future ping/pong)
      ws.on('message', (data: Buffer) => {
        try {
          const parsed = JSON.parse(data.toString()) as { type?: string };
          if (parsed.type === 'ping') {
            ws.send(
              JSON.stringify({
                type: 'pong',
                payload: { timestamp: new Date().toISOString() },
                timestamp: new Date().toISOString(),
              })
            );
          }
        } catch {
          // Ignore malformed messages
        }
      });

      // Handle errors
      ws.on('error', (error: Error) => {
        console.error('WebSocket client error:', error);
      });

      // Handle close
      ws.on('close', () => {
        // Client disconnected - no action needed
      });
    });

    this.wss.on('error', (error: Error) => {
      console.error('WebSocket server error:', error);
    });
  }

  /**
   * Broadcast an event to all connected clients
   */
  private broadcast<K extends keyof EventMap>(type: K, payload: EventMap[K]): void {
    const message = JSON.stringify({
      type,
      payload,
      timestamp: new Date().toISOString(),
    });

    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  /**
   * Close the WebSocket server and cleanup
   */
  close(): void {
    // Unsubscribe from all event bus listeners
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers = [];

    // Close all client connections
    for (const client of this.wss.clients) {
      client.close();
    }

    // Close the server
    this.wss.close();
  }
}
