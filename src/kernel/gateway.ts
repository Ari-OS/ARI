import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import type { Message } from './types.js';
import type { TrustLevel } from './types.js';
import { sanitize } from './sanitizer.js';
import { AuditLogger } from './audit.js';
import { EventBus } from './event-bus.js';

/**
 * Fastify Gateway for ARI - bound to loopback only for security
 *
 * Security invariant: HOST is hardcoded to 127.0.0.1 and never configurable.
 * This ensures the gateway cannot be exposed to external networks.
 */
export class Gateway {
  private server: ReturnType<typeof Fastify>;
  private audit: AuditLogger;
  private eventBus: EventBus;
  private readonly HOST = '127.0.0.1';
  private port: number;

  constructor(port?: number, audit?: AuditLogger, eventBus?: EventBus) {
    this.port = port ?? 3141;
    this.server = Fastify({ logger: false });
    this.audit = audit ?? new AuditLogger();
    this.eventBus = eventBus ?? new EventBus();

    this.registerRoutes();
  }

  /**
   * Registers all HTTP routes for the gateway
   */
  private registerRoutes(): void {
    // Health check endpoint
    this.server.get('/health', async (_request: FastifyRequest, _reply: FastifyReply) => {
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    });

    // Status endpoint with security information
    this.server.get('/status', async (_request: FastifyRequest, _reply: FastifyReply) => {
      return {
        version: '12.0.0',
        gateway: {
          host: this.HOST,
          port: this.port,
        },
        security: {
          loopbackOnly: true,
          auditEnabled: true,
          injectionDetection: true,
        },
      };
    });

    // Message submission endpoint with sanitization
    this.server.post('/message', async (request: FastifyRequest<{ Body: { content: string; source?: TrustLevel } }>, reply: FastifyReply) => {
      const { content, source = 'untrusted' } = request.body;

      // Sanitize the incoming message
      const result = sanitize(content, source);

      if (!result.safe) {
        // Log security event
        await this.audit.logSecurity({
          eventType: 'injection_detected',
          severity: result.riskScore >= 10 ? 'critical' : result.riskScore >= 5 ? 'high' : 'medium',
          source: source,
          details: {
            content,
            threats: result.threats,
            riskScore: result.riskScore,
          },
          mitigated: true,
        });

        // Emit security event
        this.eventBus.emit('security:detected', {
          id: randomUUID(),
          timestamp: new Date(),
          eventType: 'injection_detected',
          severity: result.riskScore >= 10 ? 'critical' : result.riskScore >= 5 ? 'high' : 'medium',
          source: source,
          details: {
            content,
            threats: result.threats,
            riskScore: result.riskScore,
          },
          mitigated: true,
        });

        reply.code(403);
        return {
          error: 'Message rejected',
          threats: result.threats,
          riskScore: result.riskScore,
        };
      }

      // Message is safe - log and emit event
      const messageId = randomUUID();
      const timestamp = new Date();

      await this.audit.log('message_received', source, source, {
        messageId,
        contentLength: content.length,
      });

      const message: Message = {
        id: messageId,
        content,
        source,
        timestamp,
      };

      this.eventBus.emit('message:received', message);
      this.eventBus.emit('message:accepted', message);

      return {
        accepted: true,
        id: messageId,
        timestamp: timestamp.toISOString(),
      };
    });
  }

  /**
   * Start the gateway server
   */
  async start(): Promise<void> {
    await this.server.listen({ host: this.HOST, port: this.port });

    await this.audit.log('gateway_started', 'system', 'system', {
      host: this.HOST,
      port: this.port,
    });

    this.eventBus.emit('gateway:started', {
      port: this.port,
      host: this.HOST,
    });
  }

  /**
   * Stop the gateway server
   */
  async stop(): Promise<void> {
    await this.server.close();

    await this.audit.log('gateway_stopped', 'system', 'system', {
      host: this.HOST,
      port: this.port,
    });

    this.eventBus.emit('gateway:stopped', {
      reason: 'shutdown',
    });
  }

  /**
   * Get the gateway address
   */
  getAddress(): string {
    return `http://${this.HOST}:${this.port}`;
  }

  /**
   * Get the event bus for system-layer subscription
   */
  getEventBus(): EventBus {
    return this.eventBus;
  }

  /**
   * Get the audit logger for system-layer logging (append-only)
   */
  getAuditLogger(): AuditLogger {
    return this.audit;
  }
}
