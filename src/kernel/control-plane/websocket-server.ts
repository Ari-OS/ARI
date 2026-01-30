import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer, IncomingMessage } from 'http';
import type { EventBus } from '../event-bus.js';
import type { AuditLogger } from '../audit.js';
import { ClientManager } from './client-manager.js';
import { MessageRouter } from './message-router.js';
import { createErrorMessage, createMessage } from './protocol.js';

/**
 * WebSocket Control Plane Server Configuration
 */
export interface ControlPlaneConfig {
  /** Port for standalone mode (default: 3142) */
  port?: number;
  /** Heartbeat interval in milliseconds (default: 30000) */
  heartbeatInterval?: number;
  /** Client timeout in milliseconds (default: 60000) */
  clientTimeout?: number;
  /** Maximum message size in bytes (default: 1MB) */
  maxMessageSize?: number;
}

const DEFAULT_CONFIG: Required<ControlPlaneConfig> = {
  port: 3142,
  heartbeatInterval: 30000,
  clientTimeout: 60000,
  maxMessageSize: 1024 * 1024, // 1MB
};

/**
 * WebSocketControlPlane
 *
 * Real-time WebSocket server for ARI control plane communication.
 *
 * SECURITY INVARIANT: Binds ONLY to 127.0.0.1 (loopback).
 * This is hardcoded and cannot be changed via configuration.
 */
export class WebSocketControlPlane {
  private wss: WebSocketServer | null = null;
  private clientManager: ClientManager;
  private messageRouter: MessageRouter;
  private eventBus: EventBus;
  private audit: AuditLogger;
  private config: Required<ControlPlaneConfig>;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private running: boolean = false;

  /**
   * SECURITY: Host is hardcoded to loopback - never configurable
   */
  private readonly HOST = '127.0.0.1';

  constructor(
    eventBus: EventBus,
    audit: AuditLogger,
    config?: ControlPlaneConfig
  ) {
    this.eventBus = eventBus;
    this.audit = audit;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.clientManager = new ClientManager();
    this.messageRouter = new MessageRouter(eventBus, this.clientManager, audit);
  }

  /**
   * Start the WebSocket server in standalone mode
   * Binds to 127.0.0.1 only (hardcoded for security)
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Control plane is already running');
    }

    this.wss = new WebSocketServer({
      host: this.HOST, // SECURITY: Hardcoded loopback only
      port: this.config.port,
      maxPayload: this.config.maxMessageSize,
    });

    this.setupServerEvents();
    this.messageRouter.start();
    this.startHeartbeat();
    this.startCleanup();

    this.running = true;

    await this.audit.log('controlplane_started', 'system', 'system', {
      host: this.HOST,
      port: this.config.port,
      mode: 'standalone',
    });

    // Emit event for system integration
    this.eventBus.emit('gateway:started', {
      host: this.HOST,
      port: this.config.port,
    });
  }

  /**
   * Attach to an existing HTTP server (for Fastify integration)
   * The HTTP server MUST be bound to 127.0.0.1 only
   */
  async attachToServer(httpServer: HttpServer): Promise<void> {
    if (this.running) {
      throw new Error('Control plane is already running');
    }

    // Verify the server is bound to loopback only
    const address = httpServer.address();
    if (address && typeof address === 'object') {
      if (address.address !== '127.0.0.1' && address.address !== '::1') {
        throw new Error(
          `SECURITY VIOLATION: HTTP server is bound to ${address.address}. ` +
          'Control plane requires loopback-only binding.'
        );
      }
    }

    this.wss = new WebSocketServer({
      server: httpServer,
      path: '/ws',
      maxPayload: this.config.maxMessageSize,
    });

    this.setupServerEvents();
    this.messageRouter.start();
    this.startHeartbeat();
    this.startCleanup();

    this.running = true;

    await this.audit.log('controlplane_started', 'system', 'system', {
      host: this.HOST,
      mode: 'attached',
      path: '/ws',
    });
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;

    // Stop timers
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Stop message routing
    this.messageRouter.stop();

    // Disconnect all clients
    this.clientManager.clear();

    // Close server
    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss!.close(() => resolve());
      });
      this.wss = null;
    }

    await this.audit.log('controlplane_stopped', 'system', 'system', {
      reason: 'shutdown',
    });
  }

  /**
   * Set up WebSocket server event handlers
   */
  private setupServerEvents(): void {
    if (!this.wss) return;

    this.wss.on('connection', (socket: WebSocket, request: IncomingMessage) => {
      this.handleConnection(socket, request);
    });

    this.wss.on('error', (error: Error) => {
      void this.audit.log('controlplane_error', 'system', 'system', {
        error: error.message,
        stack: error.stack,
      });

      this.eventBus.emit('system:error', {
        error,
        context: 'control-plane',
      });
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(socket: WebSocket, request: IncomingMessage): void {
    // Verify connection is from loopback
    const remoteAddress = request.socket.remoteAddress;
    if (remoteAddress !== '127.0.0.1' && remoteAddress !== '::1' && remoteAddress !== '::ffff:127.0.0.1') {
      socket.close(4003, 'Connections only allowed from loopback');
      void this.audit.log('controlplane_rejected_connection', 'system', 'system', {
        remoteAddress,
        reason: 'non-loopback',
      });
      return;
    }

    // Register client
    const client = this.clientManager.addClient(socket);

    void this.audit.log('controlplane_client_connected', 'system', 'system', {
      clientId: client.id,
      remoteAddress,
    });

    // Send welcome message
    socket.send(JSON.stringify(createMessage('auth:response', {
      success: false, // Not authenticated yet
      clientId: client.id,
      assignedCapabilities: Array.from(client.capabilities),
      error: 'Authentication required',
    })));

    // Set up socket event handlers
    socket.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      const dataStr = typeof data === 'string' ? data : Buffer.isBuffer(data) ? data.toString() : '';
      void this.messageRouter.handleClientMessage(client.id, dataStr).catch((error) => {
        this.clientManager.sendToClient(client.id, createErrorMessage(
          'INTERNAL_ERROR',
          error instanceof Error ? error.message : 'Unknown error'
        ));
      });
    });

    socket.on('close', (code: number, reason: Buffer) => {
      this.handleDisconnection(client.id, code, reason.toString());
    });

    socket.on('error', (error: Error) => {
      void this.audit.log('controlplane_client_error', 'system', 'system', {
        clientId: client.id,
        error: error.message,
      });
    });

    socket.on('pong', () => {
      this.clientManager.touch(client.id);
    });
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(clientId: string, code: number, reason: string): void {
    const client = this.clientManager.getClient(clientId);
    if (!client) return;

    this.clientManager.removeClient(clientId);

    void this.audit.log('controlplane_client_disconnected', 'system', 'system', {
      clientId,
      code,
      reason,
    });
  }

  /**
   * Start heartbeat to check client health
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (!this.wss) return;

      for (const clientId of this.clientManager.getAllClientIds()) {
        const client = this.clientManager.getClient(clientId);
        if (client && client.socket.readyState === WebSocket.OPEN) {
          client.socket.ping();
        }
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Start cleanup timer to remove inactive clients
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const inactive = this.clientManager.getInactiveClients(this.config.clientTimeout);

      for (const client of inactive) {
        client.socket.close(4000, 'Connection timeout');
        this.clientManager.removeClient(client.id);

        void this.audit.log('controlplane_client_timeout', 'system', 'system', {
          clientId: client.id,
          lastActivity: client.lastActivity.toISOString(),
        });
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Get the message router for external integration
   */
  getMessageRouter(): MessageRouter {
    return this.messageRouter;
  }

  /**
   * Get the client manager for external integration
   */
  getClientManager(): ClientManager {
    return this.clientManager;
  }

  /**
   * Get server statistics
   */
  getStats(): {
    running: boolean;
    host: string;
    port: number;
    clients: ReturnType<ClientManager['getStats']>;
  } {
    return {
      running: this.running,
      host: this.HOST,
      port: this.config.port,
      clients: this.clientManager.getStats(),
    };
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.running;
  }
}
