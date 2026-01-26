/**
 * ARI vNext — WebSocket Gateway
 *
 * Local-only WebSocket server that accepts inbound messages,
 * sanitizes them, logs to audit, and publishes to the event bus.
 *
 * SECURITY: Binds to 127.0.0.1 ONLY — hardcoded, config cannot override.
 *
 * @module gateway/gateway
 * @version 1.0.0
 */

import * as crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import { type SessionInfo, type HealthStatus, type EventType } from '../types/index.js';
import { getConfig } from '../config/config.js';
import { gatewayLogger } from '../utils/logger.js';
import { getSanitizer } from '../security/sanitizer.js';
import { getAuditLog, systemActor, senderActor } from '../audit/audit-log.js';
import { getEventBus } from './event-bus.js';
import {
  parseClientMessage,
  parseInboundMessage,
  createPong,
  createAck,
  createErrorResponse,
  createSessionsResponse,
  createHealthResponse,
  createEventMessage,
  serializeMessage,
} from './protocol.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface Session {
  id: string;
  ws: WebSocket;
  connectedAt: Date;
  lastActivity: Date;
  messagesReceived: number;
  subscriptions: Set<string>;
  alive: boolean;
}

export interface GatewayOptions {
  host?: string;
  port?: number;
  maxConnections?: number;
  heartbeatIntervalMs?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// GATEWAY CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class Gateway {
  private wss: WebSocketServer | null = null;
  private sessions: Map<string, Session> = new Map();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private startTime: Date | null = null;
  private lastMessageAt: Date | null = null;
  private readonly config: Required<GatewayOptions>;

  constructor(options?: GatewayOptions) {
    const appConfig = getConfig();
    this.config = {
      // SECURITY: Always bind to loopback only
      host: '127.0.0.1',
      port: options?.port ?? appConfig.gateway.port,
      maxConnections: options?.maxConnections ?? appConfig.gateway.max_connections,
      heartbeatIntervalMs: options?.heartbeatIntervalMs ?? appConfig.gateway.heartbeat_interval_ms,
    };
  }

  /**
   * Start the WebSocket gateway
   */
  async start(): Promise<void> {
    if (this.wss) {
      throw new Error('Gateway already running');
    }

    const auditLog = getAuditLog();
    await auditLog.initialize();

    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({
        host: this.config.host,
        port: this.config.port,
        maxPayload: 1024 * 1024, // 1MB max frame
      });

      this.wss.on('listening', () => {
        this.startTime = new Date();
        gatewayLogger.info(
          { host: this.config.host, port: this.config.port },
          'Gateway started',
        );

        void auditLog.append('gateway_start', systemActor('gateway'), {
          host: this.config.host,
          port: this.config.port,
        });

        void getEventBus().publish('session.connected', { gateway: 'started' }, 'gateway');

        this.startHeartbeat();
        resolve();
      });

      this.wss.on('error', (error: Error) => {
        gatewayLogger.error({ error: error.message }, 'Gateway error');
        reject(error);
      });

      this.wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
        this.handleConnection(ws);
      });
    });
  }

  /**
   * Stop the gateway gracefully
   */
  async stop(): Promise<void> {
    if (!this.wss) {
      return;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all sessions
    for (const session of this.sessions.values()) {
      session.ws.close(1001, 'Server shutting down');
    }
    this.sessions.clear();

    return new Promise((resolve) => {
      if (!this.wss) {
        resolve();
        return;
      }

      this.wss.close(() => {
        this.wss = null;
        this.startTime = null;
        gatewayLogger.info('Gateway stopped');

        void getAuditLog().append('gateway_stop', systemActor('gateway'), {});
        void getEventBus().publish('system.shutdown', {}, 'gateway');

        resolve();
      });
    });
  }

  /**
   * Handle a new WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    if (this.sessions.size >= this.config.maxConnections) {
      ws.close(1013, 'Maximum connections reached');
      gatewayLogger.warn({ maxConnections: this.config.maxConnections }, 'Connection rejected: max connections');
      return;
    }

    const sessionId = crypto.randomUUID();
    const now = new Date();
    const session: Session = {
      id: sessionId,
      ws,
      connectedAt: now,
      lastActivity: now,
      messagesReceived: 0,
      subscriptions: new Set(),
      alive: true,
    };

    this.sessions.set(sessionId, session);

    gatewayLogger.info({ sessionId }, 'Client connected');

    void getAuditLog().append('session_connect', systemActor('gateway'), {
      session_id: sessionId,
    });

    void getEventBus().publish('session.connected', { sessionId }, 'gateway');

    ws.on('message', (data: Buffer | string) => {
      this.handleMessage(session, data.toString());
    });

    ws.on('close', () => {
      this.sessions.delete(sessionId);
      gatewayLogger.info({ sessionId }, 'Client disconnected');

      void getAuditLog().append('session_disconnect', systemActor('gateway'), {
        session_id: sessionId,
        messages_received: session.messagesReceived,
      });

      void getEventBus().publish('session.disconnected', { sessionId }, 'gateway');
    });

    ws.on('error', (error: Error) => {
      gatewayLogger.error({ sessionId, error: error.message }, 'WebSocket error');
    });

    ws.on('pong', () => {
      session.alive = true;
    });
  }

  /**
   * Handle an incoming WebSocket message
   */
  private handleMessage(session: Session, raw: string): void {
    session.lastActivity = new Date();
    session.messagesReceived++;

    const parseResult = parseClientMessage(raw);
    if (!parseResult.success) {
      const errorMsg = createErrorResponse('PARSE_ERROR', parseResult.error.message);
      session.ws.send(serializeMessage(errorMsg));
      return;
    }

    const message = parseResult.data;

    switch (message.type) {
      case 'ping': {
        session.ws.send(serializeMessage(createPong(message.id)));
        break;
      }

      case 'inbound_message': {
        this.handleInboundMessage(session, message.payload, message.id);
        break;
      }

      case 'sessions_list': {
        const sessions = this.getSessionInfos();
        session.ws.send(serializeMessage(createSessionsResponse(sessions, message.id)));
        break;
      }

      case 'health': {
        const health = this.getHealthStatus();
        session.ws.send(serializeMessage(createHealthResponse(health, message.id)));
        break;
      }

      case 'subscribe': {
        if (typeof message.payload === 'string') {
          session.subscriptions.add(message.payload);
          session.ws.send(
            serializeMessage(createAck(message.id, { subscribed: message.payload })),
          );
        } else {
          session.ws.send(
            serializeMessage(
              createErrorResponse('INVALID_PAYLOAD', 'Expected event type string', message.id),
            ),
          );
        }
        break;
      }

      case 'unsubscribe': {
        if (typeof message.payload === 'string') {
          session.subscriptions.delete(message.payload);
          session.ws.send(
            serializeMessage(createAck(message.id, { unsubscribed: message.payload })),
          );
        } else {
          session.ws.send(
            serializeMessage(
              createErrorResponse('INVALID_PAYLOAD', 'Expected event type string', message.id),
            ),
          );
        }
        break;
      }
    }
  }

  /**
   * Process an inbound message through the sanitization pipeline
   */
  private handleInboundMessage(session: Session, payload: unknown, requestId?: string): void {
    const msgResult = parseInboundMessage(payload);
    if (!msgResult.success) {
      session.ws.send(
        serializeMessage(
          createErrorResponse('INVALID_MESSAGE', msgResult.error.message, requestId),
        ),
      );
      return;
    }

    const inboundMessage = msgResult.data;

    void getAuditLog().append(
      'message_received',
      senderActor(inboundMessage.sender, inboundMessage.channel),
      {
        channel: inboundMessage.channel,
        content_length: inboundMessage.content.length,
        trust_level: inboundMessage.source_trust_level,
      },
    );

    // Sanitize
    const sanitizer = getSanitizer();
    const sanitizeResult = sanitizer.sanitize(inboundMessage);
    if (!sanitizeResult.success) {
      session.ws.send(
        serializeMessage(
          createErrorResponse('SANITIZATION_ERROR', sanitizeResult.error.message, requestId),
        ),
      );
      return;
    }

    const sanitized = sanitizeResult.data;
    this.lastMessageAt = new Date();

    void getAuditLog().append(
      'message_sanitized',
      systemActor('sanitizer'),
      {
        message_id: sanitized.message_id,
        flags: sanitized.flags,
      },
    );

    if (sanitized.flags.suspicious_patterns.length > 0) {
      void getAuditLog().append(
        'suspicious_pattern_detected',
        senderActor(inboundMessage.sender, inboundMessage.channel),
        {
          message_id: sanitized.message_id,
          patterns: sanitized.flags.suspicious_patterns,
        },
      );
    }

    if (sanitized.flags.rate_limited) {
      void getAuditLog().append(
        'message_rate_limited',
        senderActor(inboundMessage.sender, inboundMessage.channel),
        { message_id: sanitized.message_id },
      );
    }

    // Publish to event bus
    void getEventBus().publish(
      'message.sanitized',
      sanitized,
      'gateway',
      sanitized.message_id,
    );

    // Broadcast to subscribed sessions
    this.broadcastEvent('message.sanitized', sanitized);

    // Acknowledge
    session.ws.send(
      serializeMessage(
        createAck(requestId, {
          message_id: sanitized.message_id,
          flags: sanitized.flags,
        }),
      ),
    );
  }

  /**
   * Broadcast an event to sessions subscribed to the event type
   */
  private broadcastEvent(eventType: string, data: unknown): void {
    for (const session of this.sessions.values()) {
      if (session.subscriptions.has(eventType) || session.subscriptions.has('*')) {
        try {
          session.ws.send(serializeMessage(createEventMessage(eventType, data)));
        } catch {
          // Connection might be closing
        }
      }
    }
  }

  /**
   * Start the heartbeat interval
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [sessionId, session] of this.sessions) {
        if (!session.alive) {
          gatewayLogger.info({ sessionId }, 'Terminating inactive connection');
          session.ws.terminate();
          this.sessions.delete(sessionId);
          continue;
        }
        session.alive = false;
        session.ws.ping();
      }
    }, this.config.heartbeatIntervalMs);
  }

  /**
   * Get session info for all connected clients
   */
  private getSessionInfos(): SessionInfo[] {
    const infos: SessionInfo[] = [];
    for (const session of this.sessions.values()) {
      infos.push({
        id: session.id,
        connected_at: session.connectedAt.toISOString(),
        last_activity: session.lastActivity.toISOString(),
        messages_received: session.messagesReceived,
        subscriptions: Array.from(session.subscriptions),
      });
    }
    return infos;
  }

  /**
   * Get current health status
   */
  getHealthStatus(): HealthStatus {
    const now = new Date();
    const uptimeSeconds = this.startTime
      ? (now.getTime() - this.startTime.getTime()) / 1000
      : 0;

    const auditLog = getAuditLog();

    return {
      status: this.wss ? 'healthy' : 'unhealthy',
      version: '1.0.0',
      uptime_seconds: uptimeSeconds,
      connections: this.sessions.size,
      audit_sequence: auditLog.getSequence(),
      last_message_at: this.lastMessageAt?.toISOString() ?? null,
      checks: {
        gateway: {
          status: this.wss ? 'pass' : 'fail',
          message: this.wss ? 'WebSocket server running' : 'WebSocket server not running',
        },
        audit: {
          status: 'pass',
          message: `Sequence at ${auditLog.getSequence()}`,
        },
      },
    };
  }

  /**
   * Get the number of connected sessions
   */
  getConnectionCount(): number {
    return this.sessions.size;
  }

  /**
   * Check if the gateway is running
   */
  isRunning(): boolean {
    return this.wss !== null;
  }

  /**
   * Get the port the gateway is listening on
   */
  getPort(): number {
    return this.config.port;
  }

  /**
   * Subscribe a specific event type to forward to WebSocket clients
   */
  registerEventForwarding(eventType: EventType): void {
    getEventBus().subscribe(eventType, (event) => {
      this.broadcastEvent(eventType, event.data);
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON & FACTORY
// ═══════════════════════════════════════════════════════════════════════════

let gatewayInstance: Gateway | null = null;

export function getGateway(options?: GatewayOptions): Gateway {
  if (gatewayInstance === null) {
    gatewayInstance = new Gateway(options);
  }
  return gatewayInstance;
}

export function createGateway(options?: GatewayOptions): Gateway {
  return new Gateway(options);
}

export function resetGateway(): void {
  gatewayInstance = null;
}
