import Fastify, { type FastifyRequest, type FastifyReply, type FastifyPluginAsync, type FastifyPluginOptions, type FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import type { Server } from 'http';
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
  private server: FastifyInstance;
  private audit: AuditLogger;
  private eventBus: EventBus;
  private readonly HOST = '127.0.0.1';
  private port: number;

  // Rate limiting — in-process token bucket (no external dependency needed)
  private readonly RATE_LIMIT_MAX = 100; // requests per window
  private readonly RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
  private rateLimitTokens = 100;
  private rateLimitLastRefill = Date.now();

  constructor(port?: number, audit?: AuditLogger, eventBus?: EventBus) {
    this.port = port ?? 3141;
    this.server = Fastify({ logger: false });
    this.audit = audit ?? new AuditLogger();
    this.eventBus = eventBus ?? new EventBus();

    this.registerRateLimiter();
    this.registerRoutes();
  }

  /**
   * Register rate limiter as a Fastify preHandler hook.
   * Token bucket: 100 requests per minute, refills linearly.
   */
  private registerRateLimiter(): void {
    this.server.addHook('preHandler', async (_request, reply) => {
      // Refill tokens based on elapsed time
      const now = Date.now();
      const elapsed = now - this.rateLimitLastRefill;
      const tokensToAdd = (elapsed / this.RATE_LIMIT_WINDOW_MS) * this.RATE_LIMIT_MAX;
      this.rateLimitTokens = Math.min(this.RATE_LIMIT_MAX, this.rateLimitTokens + tokensToAdd);
      this.rateLimitLastRefill = now;

      if (this.rateLimitTokens < 1) {
        this.eventBus.emit('security:alert', {
          type: 'rate_limited',
          source: 'gateway',
          data: {
            timestamp: new Date().toISOString(),
            tokensRemaining: this.rateLimitTokens,
          },
        });

        reply.code(429);
        reply.send({
          error: 'Too Many Requests',
          retryAfter: Math.ceil(this.RATE_LIMIT_WINDOW_MS / 1000),
        });
        return;
      }

      this.rateLimitTokens -= 1;
    });
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
        version: '2.1.0',
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

      if (!result.safe || result.riskScore >= 0.8) {
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

  /**
   * Get the underlying Fastify instance for plugin registration
   */
  getServer(): FastifyInstance {
    return this.server;
  }

  /**
   * Get the underlying HTTP server (available after start() is called)
   */
  getHttpServer(): Server {
    const server = this.server.server as Server;
    if (!server) {
      throw new Error('HTTP server not available. Call start() first.');
    }
    return server;
  }

  /**
   * Register a Fastify plugin on the gateway
   * Must be called before start()
   */
  async registerPlugin<T extends FastifyPluginOptions = FastifyPluginOptions>(
    plugin: FastifyPluginAsync<T>,
    opts?: T
  ): Promise<void> {
    await this.server.register(plugin, opts ?? {} as T);
  }
}
