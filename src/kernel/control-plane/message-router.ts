import type { EventBus } from '../event-bus.js';
import type { AuditLogger } from '../audit.js';
import type { ClientManager } from './client-manager.js';
import {
  type ControlPlaneMessage,
  type MessagePayload,
  type ToolStartPayload,
  type ToolUpdatePayload,
  type ToolEndPayload,
  createMessage,
  createErrorMessage,
  safeParseMessage,
} from './protocol.js';

/**
 * MessageRouter
 *
 * Routes messages between the internal EventBus and WebSocket clients.
 * Bridges the gap between ARI's event-driven architecture and the control plane.
 */
export class MessageRouter {
  private eventBus: EventBus;
  private clientManager: ClientManager;
  private audit: AuditLogger;
  private unsubscribers: Array<() => void> = [];
  private running: boolean = false;

  constructor(eventBus: EventBus, clientManager: ClientManager, audit: AuditLogger) {
    this.eventBus = eventBus;
    this.clientManager = clientManager;
    this.audit = audit;
  }

  /**
   * Start routing messages between EventBus and WebSocket clients
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    // Subscribe to EventBus events and forward to WebSocket clients
    this.subscribeToEventBus();
  }

  /**
   * Stop routing messages
   */
  stop(): void {
    if (!this.running) return;
    this.running = false;

    // Unsubscribe from all events
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers = [];
  }

  /**
   * Subscribe to EventBus events and forward to WebSocket clients
   */
  private subscribeToEventBus(): void {
    // Message events
    this.unsubscribers.push(
      this.eventBus.on('message:received', (payload) => {
        this.forwardToClients('message:received', {
          type: 'message:received',
          payload: {
            messageId: payload.id,
            sessionId: (payload.metadata?.sessionId as string) || '',
            content: payload.content,
            direction: 'inbound' as const,
            channel: (payload.metadata?.channel as string) || 'gateway',
            senderId: payload.source,
            timestamp: payload.timestamp.toISOString(),
            metadata: payload.metadata,
          },
        });
      })
    );

    this.unsubscribers.push(
      this.eventBus.on('message:processed', (payload) => {
        this.forwardToClients('message:processed', {
          type: 'message:processed',
          payload: {
            messageId: payload.id,
            sessionId: (payload.metadata?.sessionId as string) || '',
            content: payload.content,
            direction: 'outbound' as const,
            channel: (payload.metadata?.channel as string) || 'gateway',
            senderId: 'system',
            timestamp: payload.timestamp.toISOString(),
            metadata: payload.metadata,
          },
        });
      })
    );

    // Tool events
    this.unsubscribers.push(
      this.eventBus.on('tool:executed', (payload) => {
        this.forwardToClients('tool:end', {
          type: 'tool:end',
          payload: {
            callId: payload.callId,
            toolId: payload.toolId,
            success: payload.success,
            duration: 0, // Not tracked in original event
            timestamp: new Date().toISOString(),
          },
        });
      })
    );

    this.unsubscribers.push(
      this.eventBus.on('tool:approval_required', (payload) => {
        this.forwardToClients('tool:update', {
          type: 'tool:update',
          payload: {
            callId: payload.callId,
            toolId: payload.toolId,
            status: 'waiting_approval' as const,
            message: `Tool ${payload.toolId} requires approval`,
            timestamp: new Date().toISOString(),
          },
        });
      })
    );

    // Security events
    this.unsubscribers.push(
      this.eventBus.on('security:detected', (payload) => {
        this.forwardToClients('error', {
          type: 'error',
          payload: {
            code: 'SECURITY_EVENT',
            message: `Security event: ${payload.eventType}`,
            details: {
              eventType: payload.eventType,
              severity: payload.severity,
              source: payload.source,
              mitigated: payload.mitigated,
            },
            timestamp: payload.timestamp.toISOString(),
          },
        });
      })
    );

    // System events
    this.unsubscribers.push(
      this.eventBus.on('system:ready', (_payload) => {
        const stats = this.clientManager.getStats();
        this.clientManager.broadcastAll({
          type: 'health:pong',
          payload: {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage().heapUsed,
            activeClients: stats.totalClients,
            activeSessions: 0, // Will be updated when session manager is integrated
            timestamp: new Date().toISOString(),
          },
        });
      })
    );

    this.unsubscribers.push(
      this.eventBus.on('system:error', (payload) => {
        this.forwardToClients('error', {
          type: 'error',
          payload: {
            code: 'SYSTEM_ERROR',
            message: payload.error.message,
            details: {
              context: payload.context,
              stack: payload.error.stack,
            },
            timestamp: new Date().toISOString(),
          },
        });
      })
    );

    // Gateway events
    this.unsubscribers.push(
      this.eventBus.on('gateway:started', (_payload) => {
        const stats = this.clientManager.getStats();
        this.clientManager.broadcastAll({
          type: 'health:pong',
          payload: {
            uptime: 0,
            memoryUsage: process.memoryUsage().heapUsed,
            activeClients: stats.totalClients,
            activeSessions: 0,
            timestamp: new Date().toISOString(),
          },
        });
      })
    );

    // System halted/resumed
    this.unsubscribers.push(
      this.eventBus.on('system:halted', (payload) => {
        this.clientManager.broadcastAll({
          type: 'error',
          payload: {
            code: 'SYSTEM_HALTED',
            message: `System halted by ${payload.authority}: ${payload.reason}`,
            details: { authority: payload.authority },
            timestamp: payload.timestamp.toISOString(),
          },
        });
      })
    );

    this.unsubscribers.push(
      this.eventBus.on('system:resumed', (_payload) => {
        const stats = this.clientManager.getStats();
        this.clientManager.broadcastAll({
          type: 'health:pong',
          payload: {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage().heapUsed,
            activeClients: stats.totalClients,
            activeSessions: 0,
            timestamp: new Date().toISOString(),
          },
        });
      })
    );
  }

  /**
   * Forward a message to all subscribed clients
   */
  private forwardToClients(event: string, message: ControlPlaneMessage): void {
    const count = this.clientManager.broadcast(event, message);

    // Log significant broadcasts to audit trail
    if (event.startsWith('security:') || event.startsWith('system:')) {
      void this.audit.log('controlplane_broadcast', 'system', 'system', {
        event,
        messageType: message.type,
        clientCount: count,
      });
    }
  }

  /**
   * Handle an incoming message from a WebSocket client
   */
  async handleClientMessage(clientId: string, data: string): Promise<void> {
    const client = this.clientManager.getClient(clientId);
    if (!client) return;

    // Parse the message
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      this.clientManager.sendToClient(clientId, createErrorMessage(
        'PARSE_ERROR',
        'Invalid JSON message'
      ));
      return;
    }

    // Validate the message
    const message = safeParseMessage(parsed);
    if (!message) {
      this.clientManager.sendToClient(clientId, createErrorMessage(
        'VALIDATION_ERROR',
        'Invalid message format'
      ));
      return;
    }

    // Update client activity
    this.clientManager.touch(clientId);

    // Handle the message based on type
    switch (message.type) {
      case 'health:ping':
        this.handlePing(clientId);
        break;

      case 'auth:request':
        await this.handleAuth(clientId, message.payload);
        break;

      case 'subscribe':
        await this.handleSubscribe(clientId, message.payload);
        break;

      case 'unsubscribe':
        this.handleUnsubscribe(clientId, message.payload);
        break;

      case 'message:send':
        await this.handleMessageSend(clientId, message.payload);
        break;

      case 'channel:list':
        this.handleChannelList(clientId);
        break;

      default:
        // Log unhandled message types
        await this.audit.log('controlplane_unhandled_message', 'system', 'system', {
          clientId,
          messageType: message.type,
        });
    }
  }

  /**
   * Handle ping request
   */
  private handlePing(clientId: string): void {
    const stats = this.clientManager.getStats();
    this.clientManager.sendToClient(clientId, {
      type: 'health:pong',
      payload: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage().heapUsed,
        activeClients: stats.totalClients,
        activeSessions: 0, // Will be updated when session manager is integrated
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Handle authentication request
   */
  private async handleAuth(
    clientId: string,
    payload: { clientId: string; token?: string; clientType: string; capabilities?: string[] }
  ): Promise<void> {
    // In this implementation, we trust local connections (loopback only)
    // A more sophisticated implementation would validate tokens
    const success = this.clientManager.authenticateClient(
      clientId,
      payload.clientType
    );

    const client = this.clientManager.getClient(clientId);

    this.clientManager.sendToClient(clientId, {
      type: 'auth:response',
      payload: {
        success,
        clientId,
        assignedCapabilities: client ? Array.from(client.capabilities) : [],
        error: success ? undefined : 'Authentication failed',
      },
    });

    if (success) {
      await this.audit.log('controlplane_auth', 'system', 'system', {
        clientId,
        clientType: payload.clientType,
        success: true,
      });
    }
  }

  /**
   * Handle subscription request
   */
  private async handleSubscribe(
    clientId: string,
    payload: { events: string[]; sessionId?: string }
  ): Promise<void> {
    const subscribed = this.clientManager.subscribe(clientId, payload.events);

    // Acknowledge subscription
    this.clientManager.sendToClient(clientId, createMessage('subscribe', {
      events: subscribed,
      sessionId: payload.sessionId,
    }));

    await this.audit.log('controlplane_subscribe', 'system', 'system', {
      clientId,
      events: subscribed,
    });
  }

  /**
   * Handle unsubscription request
   */
  private handleUnsubscribe(
    clientId: string,
    payload: { events: string[] }
  ): void {
    const unsubscribed = this.clientManager.unsubscribe(clientId, payload.events);

    // Acknowledge unsubscription
    this.clientManager.sendToClient(clientId, createMessage('unsubscribe', {
      events: unsubscribed,
    }));
  }

  /**
   * Handle message send request (from client to channel)
   */
  private async handleMessageSend(
    clientId: string,
    payload: MessagePayload
  ): Promise<void> {
    const client = this.clientManager.getClient(clientId);

    // Check if client has permission to send messages
    if (!client?.capabilities.has('write:messages')) {
      this.clientManager.sendToClient(clientId, createErrorMessage(
        'PERMISSION_DENIED',
        'You do not have permission to send messages'
      ));
      return;
    }

    // Emit to EventBus for processing by the gateway/channels
    this.eventBus.emit('message:received', {
      id: payload.messageId,
      content: payload.content,
      source: 'standard', // Control plane messages are standard trust
      timestamp: new Date(payload.timestamp),
      metadata: {
        ...payload.metadata,
        channel: payload.channel,
        sessionId: payload.sessionId,
        senderId: payload.senderId,
        fromControlPlane: true,
      },
    });

    await this.audit.log('controlplane_message_send', 'system', 'standard', {
      clientId,
      messageId: payload.messageId,
      channel: payload.channel,
    });
  }

  /**
   * Handle channel list request
   */
  private handleChannelList(clientId: string): void {
    // This will be populated when the channel registry is integrated
    this.clientManager.sendToClient(clientId, {
      type: 'channel:list:response',
      payload: [], // Empty until channel registry is integrated
    });
  }

  /**
   * Emit a tool start event to subscribed clients
   */
  emitToolStart(payload: ToolStartPayload): void {
    this.forwardToClients('tool:start', {
      type: 'tool:start',
      payload,
    });
  }

  /**
   * Emit a tool update event to subscribed clients
   */
  emitToolUpdate(payload: ToolUpdatePayload): void {
    this.forwardToClients('tool:update', {
      type: 'tool:update',
      payload,
    });
  }

  /**
   * Emit a tool end event to subscribed clients
   */
  emitToolEnd(payload: ToolEndPayload): void {
    this.forwardToClients('tool:end', {
      type: 'tool:end',
      payload,
    });
  }
}
