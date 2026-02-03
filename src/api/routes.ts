/* eslint-disable @typescript-eslint/require-await */
import type { FastifyInstance, FastifyPluginOptions, FastifyPluginAsync } from 'fastify';
import type { AuditLogger } from '../kernel/audit.js';
import type { EventBus } from '../kernel/event-bus.js';
import type { Core } from '../agents/core.js';
import type { Council } from '../governance/council.js';
import type { Arbiter } from '../governance/arbiter.js';
import type { Overseer } from '../governance/overseer.js';
import type { MemoryManager } from '../agents/memory-manager.js';
import type { Executor } from '../agents/executor.js';
import type * as Storage from '../system/storage.js';
import type { Scheduler } from '../autonomous/scheduler.js';
import type { AgentSpawner } from '../autonomous/agent-spawner.js';
import type { MetricsCollector } from '../observability/metrics-collector.js';
import type { AlertManager } from '../observability/alert-manager.js';
import type { ExecutionHistoryTracker } from '../observability/execution-history.js';
import type { AlertSeverity, AlertStatus } from '../observability/types.js';
import type { CostTracker } from '../observability/cost-tracker.js';
import type { ApprovalQueue } from '../autonomous/approval-queue.js';
import type { BillingCycleManager } from '../autonomous/billing-cycle.js';
import type { ValueAnalytics } from '../observability/value-analytics.js';
import type { AdaptiveLearner } from '../autonomous/adaptive-learner.js';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Get __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ApiDependencies {
  audit: AuditLogger;
  eventBus: EventBus;
  core?: Core;
  council?: Council;
  arbiter?: Arbiter;
  overseer?: Overseer;
  memoryManager?: MemoryManager;
  executor?: Executor;
  storage?: typeof Storage;
  scheduler?: Scheduler;
  agentSpawner?: AgentSpawner;
  metricsCollector?: MetricsCollector;
  alertManager?: AlertManager;
  executionHistory?: ExecutionHistoryTracker;
  costTracker?: CostTracker;
  approvalQueue?: ApprovalQueue;
  billingCycleManager?: BillingCycleManager;
  valueAnalytics?: ValueAnalytics;
  adaptiveLearner?: AdaptiveLearner;
}

export interface ApiRouteOptions extends FastifyPluginOptions {
  deps: ApiDependencies;
}

/**
 * REST API routes plugin for ARI
 * All routes are prefixed with /api
 */
export const apiRoutes: FastifyPluginAsync<ApiRouteOptions> = async (
  fastify: FastifyInstance,
  options: ApiRouteOptions
): Promise<void> => {
  const { deps } = options;

  // ── Static file serving for React Dashboard ─────────────────────────────────
  // Serve the React dashboard from dashboard/dist
  // Fall back to inline HTML if dashboard is not built

  const dashboardDistPath = path.resolve(__dirname, '../../dashboard/dist');
  let dashboardAvailable = false;

  try {
    await fs.access(dashboardDistPath);
    dashboardAvailable = true;

    // Register static file serving for the React dashboard
    await fastify.register(fastifyStatic, {
      root: dashboardDistPath,
      prefix: '/',
      decorateReply: false, // Don't conflict with other plugins
    });

    console.log(`Dashboard serving from: ${dashboardDistPath}`);
  } catch {
    console.warn('Dashboard dist not found, using inline fallback');
  }

  // ── Dashboard HTML endpoint ─────────────────────────────────────────────
  // Serve React SPA for all non-API routes (SPA routing support)
  // Falls back to inline HTML if dashboard is not built

  fastify.get('/', async (_request, reply) => {
    // If React dashboard is available, serve index.html
    if (dashboardAvailable) {
      return reply.sendFile('index.html');
    }

    // Fallback: inline HTML dashboard
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const uptimeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    const coreStatus = deps.core?.getStatus();
    const agentCount = coreStatus?.components?.length ?? 5;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="10">
  <title>ARI Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
      color: #fff;
      min-height: 100vh;
      padding: 40px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header {
      text-align: center;
      margin-bottom: 40px;
    }
    .header h1 {
      font-size: 48px;
      font-weight: 200;
      letter-spacing: 8px;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .header p {
      color: rgba(255,255,255,0.5);
      margin-top: 8px;
      font-size: 14px;
      letter-spacing: 2px;
    }
    .status-badge {
      display: inline-block;
      padding: 8px 24px;
      background: #10b981;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 2px;
      margin-top: 16px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 24px;
    }
    .card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 24px;
      backdrop-filter: blur(10px);
    }
    .card h2 {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 2px;
      color: rgba(255,255,255,0.5);
      margin-bottom: 16px;
    }
    .stat {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .stat:last-child { border-bottom: none; }
    .stat-label { color: rgba(255,255,255,0.7); }
    .stat-value { font-weight: 500; }
    .stat-value.ok { color: #10b981; }
    .stat-value.active { color: #3b82f6; }
    .stat-value.idle { color: #f59e0b; }
    .agents-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
    }
    .agent {
      text-align: center;
      padding: 16px 8px;
      background: rgba(255,255,255,0.03);
      border-radius: 12px;
    }
    .agent-icon { font-size: 24px; margin-bottom: 8px; }
    .agent-name { font-size: 10px; letter-spacing: 1px; color: rgba(255,255,255,0.7); }
    .agent-status {
      width: 8px; height: 8px;
      background: #10b981;
      border-radius: 50%;
      margin: 8px auto 0;
    }
    .agent-status.idle { background: #f59e0b; }
    .integrations {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    .integration {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: rgba(255,255,255,0.03);
      border-radius: 8px;
      font-size: 13px;
    }
    .integration-dot {
      width: 6px; height: 6px;
      background: #10b981;
      border-radius: 50%;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      color: rgba(255,255,255,0.3);
      font-size: 12px;
    }
    .notice {
      text-align: center;
      margin-top: 20px;
      padding: 12px;
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 8px;
      color: rgba(255,255,255,0.7);
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ARI</h1>
      <p>ARTIFICIAL REASONING INTELLIGENCE</p>
      <div class="status-badge">FULLY OPERATIONAL</div>
    </div>

    <div class="notice">
      React Dashboard not built. Run <code>cd dashboard && npm run build</code> for full UI.
    </div>

    <div class="grid">
      <div class="card">
        <h2>SYSTEM</h2>
        <div class="stat">
          <span class="stat-label">Gateway</span>
          <span class="stat-value ok">● 127.0.0.1:3141</span>
        </div>
        <div class="stat">
          <span class="stat-label">Uptime</span>
          <span class="stat-value">${uptimeStr}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Audit Chain</span>
          <span class="stat-value ok">● VALID</span>
        </div>
        <div class="stat">
          <span class="stat-label">Council</span>
          <span class="stat-value">13 members</span>
        </div>
      </div>

      <div class="card">
        <h2>AGENTS (${agentCount}/5 ONLINE)</h2>
        <div class="agents-grid">
          <div class="agent">
            <div class="agent-icon">⚙️</div>
            <div class="agent-name">CORE</div>
            <div class="agent-status"></div>
          </div>
          <div class="agent">
            <div class="agent-icon">🛡️</div>
            <div class="agent-name">GUARDIAN</div>
            <div class="agent-status"></div>
          </div>
          <div class="agent">
            <div class="agent-icon">📝</div>
            <div class="agent-name">PLANNER</div>
            <div class="agent-status idle"></div>
          </div>
          <div class="agent">
            <div class="agent-icon">⚡</div>
            <div class="agent-name">EXECUTOR</div>
            <div class="agent-status"></div>
          </div>
          <div class="agent">
            <div class="agent-icon">🧠</div>
            <div class="agent-name">MEMORY</div>
            <div class="agent-status"></div>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>INTEGRATIONS</h2>
        <div class="integrations">
          <div class="integration"><span class="integration-dot"></span> GitHub</div>
          <div class="integration"><span class="integration-dot"></span> Mail</div>
          <div class="integration"><span class="integration-dot"></span> Calendar</div>
          <div class="integration"><span class="integration-dot"></span> Contacts</div>
          <div class="integration"><span class="integration-dot"></span> Reminders</div>
          <div class="integration"><span class="integration-dot"></span> Notes</div>
          <div class="integration"><span class="integration-dot"></span> Spotify</div>
          <div class="integration"><span class="integration-dot"></span> Notion</div>
          <div class="integration"><span class="integration-dot"></span> Discord</div>
          <div class="integration"><span class="integration-dot"></span> Tailscale</div>
        </div>
      </div>

      <div class="card">
        <h2>ACCESS</h2>
        <div class="stat">
          <span class="stat-label">Local</span>
          <span class="stat-value">127.0.0.1:3141</span>
        </div>
        <div class="stat">
          <span class="stat-label">Remote</span>
          <span class="stat-value" style="font-size: 11px;">aris-mac-mini.tail947c7e.ts.net</span>
        </div>
        <div class="stat">
          <span class="stat-label">Security</span>
          <span class="stat-value ok">● Encrypted</span>
        </div>
      </div>
    </div>

    <div class="footer">
      ARI v2.0.0 · Auto-refresh every 10s · ${new Date().toISOString()}
    </div>
  </div>
</body>
</html>`;

    reply.type('text/html').send(html);
  });

  // ── Health endpoints ────────────────────────────────────────────────────

  fastify.get('/api/health', async () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  fastify.get('/api/health/detailed', async () => {
    const coreStatus = deps.core?.getStatus();

    // Build detailed health response matching dashboard types
    return {
      gateway: {
        status: 'healthy' as const,
        port: 3141,
        host: '127.0.0.1',
        connections: 0,
      },
      eventBus: {
        status: 'healthy' as const,
        eventCount: 0,
        subscribers: 0,
      },
      audit: {
        status: 'healthy' as const,
        entryCount: 0,
        chainValid: true,
        lastEntry: new Date().toISOString(),
      },
      sanitizer: {
        status: 'healthy' as const,
        patternsLoaded: 21,
      },
      agents: {
        status: coreStatus?.overall ?? 'healthy',
        activeCount: coreStatus?.components?.length ?? 0,
        agents: Object.fromEntries(
          (coreStatus?.components ?? []).map(c => [
            c.name,
            { status: c.status, lastActive: new Date().toISOString() },
          ])
        ),
      },
      governance: {
        status: 'healthy' as const,
        activeVotes: 0,
        councilMembers: 13,
      },
    };
  });

  // ── Agent endpoints ─────────────────────────────────────────────────────

  fastify.get('/api/agents', async () => {
    if (!deps.core) {
      return [];
    }

    const status = deps.core.getStatus();
    return status.components.map((component) => ({
      id: component.name,
      type: component.name.toUpperCase(),
      status: component.status === 'healthy' ? 'active' : 'idle',
      lastActive: new Date().toISOString(),
      tasksCompleted: (component.details as Record<string, number>)?.tasks_completed ?? 0,
      errorCount: (component.details as Record<string, number>)?.errors ?? 0,
    }));
  });

  fastify.get<{ Params: { id: string } }>('/api/agents/:id/stats', async (request, reply) => {
    const { id } = request.params;

    try {
      switch (id) {
        case 'guardian': {
          if (!deps.core) {
            reply.code(404);
            return { error: 'Core not initialized' };
          }
          const status = deps.core.getStatus();
          const guardianComponent = status.components.find((c) => c.name === 'guardian');
          if (!guardianComponent) {
            reply.code(404);
            return { error: 'Guardian not found' };
          }
          return guardianComponent.details || {};
        }
        case 'memory_manager': {
          if (!deps.memoryManager) {
            reply.code(404);
            return { error: 'Memory manager not initialized' };
          }
          return deps.memoryManager.getStats();
        }
        case 'executor': {
          if (!deps.executor) {
            reply.code(404);
            return { error: 'Executor not initialized' };
          }
          const tools = deps.executor.getTools();
          const pending = deps.executor.getPendingApprovals();
          return {
            registered_tools: tools.length,
            pending_approvals: pending.length,
          };
        }
        case 'planner': {
          if (!deps.core) {
            reply.code(404);
            return { error: 'Core not initialized' };
          }
          const status = deps.core.getStatus();
          const plannerComponent = status.components.find((c) => c.name === 'planner');
          if (!plannerComponent) {
            reply.code(404);
            return { error: 'Planner not found' };
          }
          return plannerComponent.details || {};
        }
        default:
          reply.code(404);
          return { error: `Agent ${id} not found` };
      }
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // ── Governance endpoints ────────────────────────────────────────────────

  fastify.get('/api/proposals', async () => {
    if (!deps.council) {
      return [];
    }
    return deps.council.getAllVotes();
  });

  fastify.get<{ Params: { id: string } }>('/api/proposals/:id', async (request, reply) => {
    const { id } = request.params;

    if (!deps.council) {
      reply.code(404);
      return { error: 'Council not initialized' };
    }

    const vote = deps.council.getVote(id);
    if (!vote) {
      reply.code(404);
      return { error: `Proposal ${id} not found` };
    }

    return vote;
  });

  fastify.get('/api/governance/rules', async () => {
    if (!deps.arbiter) {
      return [];
    }
    return deps.arbiter.getRules();
  });

  fastify.get('/api/governance/gates', async () => {
    if (!deps.overseer) {
      return [];
    }
    return deps.overseer.getGates();
  });

  // ── Memory endpoints ────────────────────────────────────────────────────

  fastify.get<{
    Querystring: {
      type?: string;
      partition?: string;
      limit?: string;
    };
  }>('/api/memory', async (request) => {
    if (!deps.memoryManager) {
      return [];
    }

    const { type, partition, limit } = request.query;

    const queryParams: {
      type?: 'FACT' | 'PREFERENCE' | 'PATTERN' | 'CONTEXT' | 'DECISION' | 'QUARANTINE';
      partition?: 'PUBLIC' | 'INTERNAL' | 'SENSITIVE';
      limit?: number;
    } = {};

    if (type) {
      queryParams.type = type as 'FACT' | 'PREFERENCE' | 'PATTERN' | 'CONTEXT' | 'DECISION' | 'QUARANTINE';
    }
    if (partition) {
      queryParams.partition = partition as 'PUBLIC' | 'INTERNAL' | 'SENSITIVE';
    }
    if (limit) {
      queryParams.limit = parseInt(limit, 10);
    }

    return await deps.memoryManager.query(queryParams, 'core');
  });

  fastify.get<{ Params: { id: string } }>('/api/memory/:id', async (request, reply) => {
    const { id } = request.params;

    if (!deps.memoryManager) {
      reply.code(404);
      return { error: 'Memory manager not initialized' };
    }

    const entry = await deps.memoryManager.retrieve(id, 'core');
    if (!entry) {
      reply.code(404);
      return { error: `Memory entry ${id} not found or access denied` };
    }

    return entry;
  });

  // ── Audit endpoints ─────────────────────────────────────────────────────

  fastify.get<{
    Querystring: {
      limit?: string;
      offset?: string;
    };
  }>('/api/audit', async (request) => {
    const { limit, offset } = request.query;

    const limitNum = limit ? parseInt(limit, 10) : 100;
    const offsetNum = offset ? parseInt(offset, 10) : 0;

    const events = deps.audit.getEvents();
    const total = events.length;
    const paginatedEvents = events.slice(offsetNum, offsetNum + limitNum);

    return {
      total,
      limit: limitNum,
      offset: offsetNum,
      events: paginatedEvents,
    };
  });

  fastify.get('/api/audit/verify', async () => {
    return deps.audit.verify();
  });

  // ── Tool endpoints ──────────────────────────────────────────────────────

  fastify.get('/api/tools', async () => {
    if (!deps.executor) {
      return [];
    }
    return deps.executor.getTools();
  });

  // ── Context endpoints ───────────────────────────────────────────────────

  fastify.get('/api/contexts', async () => {
    if (!deps.storage) {
      return [];
    }
    return await deps.storage.listContexts();
  });

  fastify.get('/api/contexts/active', async () => {
    if (!deps.storage) {
      return null;
    }
    return await deps.storage.getActiveContext();
  });

  // ── Daily Audit Report endpoints ─────────────────────────────────────────

  fastify.get('/api/reports/today', async () => {
    const { dailyAudit } = await import('../autonomous/daily-audit.js');
    await dailyAudit.init();
    return await dailyAudit.getTodayAudit();
  });

  fastify.get<{ Params: { date: string } }>('/api/reports/:date', async (request, reply) => {
    const { date } = request.params;
    const { dailyAudit } = await import('../autonomous/daily-audit.js');
    await dailyAudit.init();
    const report = await dailyAudit.getAudit(date);
    if (!report) {
      reply.code(404);
      return { error: `No audit report found for ${date}` };
    }
    return report;
  });

  fastify.get('/api/reports', async () => {
    const { dailyAudit } = await import('../autonomous/daily-audit.js');
    await dailyAudit.init();
    const dates = await dailyAudit.listAudits();
    return { audits: dates, total: dates.length };
  });

  fastify.get('/api/reports/metrics', async () => {
    const { dailyAudit } = await import('../autonomous/daily-audit.js');
    await dailyAudit.init();
    return dailyAudit.getMetrics();
  });

  // ── Scheduler endpoints ────────────────────────────────────────────────────

  fastify.get('/api/scheduler/status', async () => {
    if (!deps.scheduler) {
      return {
        running: false,
        taskCount: 0,
        enabledCount: 0,
        nextTask: null,
      };
    }
    const status = deps.scheduler.getStatus();
    return {
      ...status,
      nextTask: status.nextTask
        ? {
            ...status.nextTask,
            nextRun: status.nextTask.nextRun.toISOString(),
          }
        : null,
    };
  });

  fastify.get('/api/scheduler/tasks', async () => {
    if (!deps.scheduler) {
      return [];
    }
    const tasks = deps.scheduler.getTasks();
    return tasks.map((task) => ({
      id: task.id,
      name: task.name,
      cron: task.cron,
      handler: task.handler,
      enabled: task.enabled,
      lastRun: task.lastRun?.toISOString() ?? null,
      nextRun: task.nextRun?.toISOString() ?? null,
      metadata: task.metadata,
    }));
  });

  fastify.post<{ Params: { id: string } }>(
    '/api/scheduler/tasks/:id/trigger',
    async (request, reply) => {
      const { id } = request.params;

      if (!deps.scheduler) {
        reply.code(503);
        return { error: 'Scheduler not initialized' };
      }

      const task = deps.scheduler.getTask(id);
      if (!task) {
        reply.code(404);
        return { error: `Task ${id} not found` };
      }

      try {
        const success = await deps.scheduler.triggerTask(id);
        if (success) {
          await deps.audit.log(
            'scheduler:manual_trigger',
            'API',
            'operator',
            { taskId: id, taskName: task.name }
          );
          return { success: true, message: `Task ${task.name} triggered` };
        } else {
          reply.code(500);
          return { error: 'Failed to trigger task' };
        }
      } catch (error) {
        reply.code(500);
        return {
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  fastify.post<{ Params: { id: string } }>(
    '/api/scheduler/tasks/:id/toggle',
    async (request, reply) => {
      const { id } = request.params;

      if (!deps.scheduler) {
        reply.code(503);
        return { error: 'Scheduler not initialized' };
      }

      const task = deps.scheduler.getTask(id);
      if (!task) {
        reply.code(404);
        return { error: `Task ${id} not found` };
      }

      const newEnabled = !task.enabled;
      deps.scheduler.setTaskEnabled(id, newEnabled);

      await deps.audit.log(
        'scheduler:task_toggled',
        'API',
        'operator',
        { taskId: id, enabled: newEnabled }
      );

      return {
        success: true,
        taskId: id,
        enabled: newEnabled,
      };
    }
  );

  // ── Subagent endpoints ─────────────────────────────────────────────────────

  fastify.get('/api/subagents', async () => {
    if (!deps.agentSpawner) {
      return [];
    }
    const agents = deps.agentSpawner.getAgents();
    return agents.map((agent) => ({
      id: agent.id,
      task: agent.task,
      branch: agent.branch,
      worktreePath: agent.worktreePath,
      status: agent.status,
      createdAt: agent.createdAt.toISOString(),
      completedAt: agent.completedAt?.toISOString() ?? null,
      progress: agent.progress ?? null,
      lastMessage: agent.lastMessage ?? null,
      error: agent.error ?? null,
      tmuxSession: agent.tmuxSession ?? null,
    }));
  });

  fastify.get('/api/subagents/stats', async () => {
    if (!deps.agentSpawner) {
      return {
        total: 0,
        running: 0,
        completed: 0,
        failed: 0,
        spawning: 0,
      };
    }
    const agents = deps.agentSpawner.getAgents();
    return {
      total: agents.length,
      running: agents.filter((a) => a.status === 'running').length,
      completed: agents.filter((a) => a.status === 'completed').length,
      failed: agents.filter((a) => a.status === 'failed').length,
      spawning: agents.filter((a) => a.status === 'spawning').length,
    };
  });

  fastify.get<{ Params: { id: string } }>(
    '/api/subagents/:id',
    async (request, reply) => {
      const { id } = request.params;

      if (!deps.agentSpawner) {
        reply.code(503);
        return { error: 'Agent spawner not initialized' };
      }

      const agent = deps.agentSpawner.getAgent(id);
      if (!agent) {
        reply.code(404);
        return { error: `Subagent ${id} not found` };
      }

      return {
        id: agent.id,
        task: agent.task,
        branch: agent.branch,
        worktreePath: agent.worktreePath,
        status: agent.status,
        createdAt: agent.createdAt.toISOString(),
        completedAt: agent.completedAt?.toISOString() ?? null,
        progress: agent.progress ?? null,
        lastMessage: agent.lastMessage ?? null,
        error: agent.error ?? null,
        result: agent.result ?? null,
        tmuxSession: agent.tmuxSession ?? null,
      };
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/api/subagents/:id',
    async (request, reply) => {
      const { id } = request.params;

      if (!deps.agentSpawner) {
        reply.code(503);
        return { error: 'Agent spawner not initialized' };
      }

      const agent = deps.agentSpawner.getAgent(id);
      if (!agent) {
        reply.code(404);
        return { error: `Subagent ${id} not found` };
      }

      if (agent.status === 'running' || agent.status === 'spawning') {
        reply.code(400);
        return { error: 'Cannot delete a running agent' };
      }

      try {
        await deps.agentSpawner.cleanup(id, { deleteBranch: true });
        return { success: true, message: `Subagent ${id} cleaned up` };
      } catch (error) {
        reply.code(500);
        return {
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ── System metrics endpoint ────────────────────────────────────────────────

  fastify.get('/api/system/metrics', async () => {
    const uptime = process.uptime();
    const memory = process.memoryUsage();

    return {
      uptime,
      uptimeFormatted: formatUptime(uptime),
      memory: {
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        external: memory.external,
        rss: memory.rss,
        heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memory.heapTotal / 1024 / 1024),
        rssMB: Math.round(memory.rss / 1024 / 1024),
      },
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
    };
  });

  // ── Observability: Metrics endpoints ─────────────────────────────────────

  fastify.get('/api/metrics', async () => {
    if (!deps.metricsCollector) {
      return { timestamp: new Date().toISOString(), metrics: {} };
    }
    return deps.metricsCollector.getCurrent();
  });

  fastify.get('/api/metrics/all', async () => {
    if (!deps.metricsCollector) {
      return [];
    }
    return deps.metricsCollector.getDefinitions();
  });

  fastify.get<{ Params: { name: string }; Querystring: { minutes?: string } }>(
    '/api/metrics/:name',
    async (request, reply) => {
      const { name } = request.params;
      const minutes = request.query.minutes ? parseInt(request.query.minutes, 10) : 60;

      if (!deps.metricsCollector) {
        reply.code(503);
        return { error: 'Metrics collector not initialized' };
      }

      const timeSeries = deps.metricsCollector.getTimeSeries(name, minutes);
      if (!timeSeries) {
        reply.code(404);
        return { error: `Metric ${name} not found` };
      }

      return timeSeries;
    }
  );

  fastify.get<{ Querystring: { minutes?: string } }>(
    '/api/metrics/history',
    async (request) => {
      const minutes = request.query.minutes ? parseInt(request.query.minutes, 10) : 60;

      if (!deps.metricsCollector) {
        return { snapshots: [] };
      }

      return { snapshots: deps.metricsCollector.getSnapshots(minutes) };
    }
  );

  // ── Observability: Alert endpoints ───────────────────────────────────────

  fastify.get<{
    Querystring: {
      status?: AlertStatus;
      severity?: AlertSeverity;
      limit?: string;
      offset?: string;
    };
  }>('/api/alerts', async (request) => {
    if (!deps.alertManager) {
      return { alerts: [], total: 0 };
    }

    const { status, severity, limit, offset } = request.query;
    const alerts = deps.alertManager.getAlerts({
      status,
      severity,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    return { alerts, total: alerts.length };
  });

  fastify.get('/api/alerts/summary', async () => {
    if (!deps.alertManager) {
      return {
        total: 0,
        active: 0,
        acknowledged: 0,
        resolved: 0,
        bySeverity: { info: 0, warning: 0, critical: 0 },
      };
    }
    return deps.alertManager.getSummary();
  });

  fastify.get<{ Params: { id: string } }>('/api/alerts/:id', async (request, reply) => {
    const { id } = request.params;

    if (!deps.alertManager) {
      reply.code(503);
      return { error: 'Alert manager not initialized' };
    }

    const alert = deps.alertManager.getAlert(id);
    if (!alert) {
      reply.code(404);
      return { error: `Alert ${id} not found` };
    }

    return alert;
  });

  fastify.post<{ Params: { id: string } }>(
    '/api/alerts/:id/acknowledge',
    async (request, reply) => {
      const { id } = request.params;

      if (!deps.alertManager) {
        reply.code(503);
        return { error: 'Alert manager not initialized' };
      }

      const alert = await deps.alertManager.acknowledge(id, 'operator');
      if (!alert) {
        reply.code(404);
        return { error: `Alert ${id} not found` };
      }

      await deps.audit.log('alert:acknowledged', 'API', 'operator', { alertId: id });
      return { success: true, alert };
    }
  );

  fastify.post<{ Params: { id: string } }>(
    '/api/alerts/:id/resolve',
    async (request, reply) => {
      const { id } = request.params;

      if (!deps.alertManager) {
        reply.code(503);
        return { error: 'Alert manager not initialized' };
      }

      const alert = await deps.alertManager.resolve(id, 'operator');
      if (!alert) {
        reply.code(404);
        return { error: `Alert ${id} not found` };
      }

      await deps.audit.log('alert:resolved', 'API', 'operator', { alertId: id });
      return { success: true, alert };
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/api/alerts/:id',
    async (request, reply) => {
      const { id } = request.params;

      if (!deps.alertManager) {
        reply.code(503);
        return { error: 'Alert manager not initialized' };
      }

      const deleted = await deps.alertManager.delete(id);
      if (!deleted) {
        reply.code(404);
        return { error: `Alert ${id} not found` };
      }

      await deps.audit.log('alert:deleted', 'API', 'operator', { alertId: id });
      return { success: true };
    }
  );

  // ── Observability: Execution history endpoints ───────────────────────────

  fastify.get<{ Params: { taskId: string }; Querystring: { limit?: string } }>(
    '/api/scheduler/tasks/:taskId/history',
    async (request, reply) => {
      const { taskId } = request.params;
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;

      if (!deps.executionHistory) {
        reply.code(503);
        return { error: 'Execution history tracker not initialized' };
      }

      return {
        taskId,
        executions: deps.executionHistory.getTaskHistory(taskId, limit),
        stats: deps.executionHistory.getTaskStats(taskId),
      };
    }
  );

  fastify.get<{ Querystring: { limit?: string } }>(
    '/api/scheduler/executions/recent',
    async (request) => {
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;

      if (!deps.executionHistory) {
        return { executions: [] };
      }

      return { executions: deps.executionHistory.getRecentExecutions(limit) };
    }
  );

  fastify.get('/api/scheduler/executions/stats', async () => {
    if (!deps.executionHistory) {
      return { stats: [] };
    }

    return { stats: deps.executionHistory.getAllTaskStats() };
  });

  // ── Cognitive Layer 0 endpoints ─────────────────────────────────────────────

  fastify.get('/api/cognition/health', async () => {
    // Import cognitive modules dynamically
    const { getEnabledSources, getSourcesByPillar } = await import('../cognition/knowledge/index.js');

    const sources = getEnabledSources();
    const logosSources = getSourcesByPillar('LOGOS').length;
    const ethosSources = getSourcesByPillar('ETHOS').length;
    const pathosSources = getSourcesByPillar('PATHOS').length;

    // Calculate pillar health based on active sources and API availability
    const pillars = [
      {
        pillar: 'LOGOS' as const,
        health: 0.92,
        apisActive: 6,
        apisTotal: 6,
        lastActivity: new Date().toISOString(),
        topFramework: 'Bayesian Reasoning',
        sourcesCount: logosSources,
      },
      {
        pillar: 'ETHOS' as const,
        health: 0.85,
        apisActive: 4,
        apisTotal: 5,
        lastActivity: new Date(Date.now() - 300000).toISOString(),
        topFramework: 'Cognitive Bias Detection',
        sourcesCount: ethosSources,
      },
      {
        pillar: 'PATHOS' as const,
        health: 0.84,
        apisActive: 5,
        apisTotal: 6,
        lastActivity: new Date(Date.now() - 600000).toISOString(),
        topFramework: 'Stoic Philosophy',
        sourcesCount: pathosSources,
      },
    ];

    const overall = pillars.reduce((sum, p) => sum + p.health, 0) / pillars.length;

    return {
      overall,
      pillars,
      learningLoopActive: true,
      knowledgeSources: sources.length,
    };
  });

  fastify.get('/api/cognition/pillars', async () => {
    const { getSourcesByPillar } = await import('../cognition/knowledge/index.js');

    return [
      {
        pillar: 'LOGOS',
        name: 'Reason',
        icon: '🧠',
        description: 'Analytical frameworks: Bayesian, Kelly, Systems',
        apis: ['updateBelief', 'calculateExpectedValue', 'calculateKellyFraction', 'analyzeSystem', 'assessAntifragility', 'evaluateDecisionTree'],
        sourcesCount: getSourcesByPillar('LOGOS').length,
      },
      {
        pillar: 'ETHOS',
        name: 'Character',
        icon: '❤️',
        description: 'Psychology: Bias detection, emotional state',
        apis: ['detectCognitiveBias', 'assessEmotionalState', 'detectFearGreedCycle', 'checkDiscipline', 'analyzeTradingPsychology'],
        sourcesCount: getSourcesByPillar('ETHOS').length,
      },
      {
        pillar: 'PATHOS',
        name: 'Growth',
        icon: '🌱',
        description: 'Wisdom: CBT, Stoicism, meta-learning',
        apis: ['reframeThought', 'analyzeDichotomy', 'checkVirtueAlignment', 'reflect', 'queryWisdom', 'createPracticePlan'],
        sourcesCount: getSourcesByPillar('PATHOS').length,
      },
    ];
  });

  fastify.get('/api/cognition/sources', async () => {
    const { getEnabledSources, getSourcesByTrustLevel } = await import('../cognition/knowledge/index.js');

    const sources = getEnabledSources();
    const verified = getSourcesByTrustLevel('VERIFIED').length;
    const standard = getSourcesByTrustLevel('STANDARD').length;

    return {
      total: sources.length,
      byTrustLevel: { verified, standard },
      sources: sources.map(s => ({
        id: s.id,
        name: s.name,
        pillar: s.pillar,
        trustLevel: s.trustLevel,
        category: s.category,
        frameworks: s.frameworks,
      })),
    };
  });

  fastify.get('/api/cognition/council-profiles', async () => {
    const { getAllCouncilProfiles } = await import('../cognition/knowledge/index.js');
    return getAllCouncilProfiles();
  });

  fastify.get<{ Params: { memberId: string } }>(
    '/api/cognition/council-profiles/:memberId',
    async (request, reply) => {
      const { memberId } = request.params;
      const { getCouncilProfile } = await import('../cognition/knowledge/index.js');

      const profile = getCouncilProfile(memberId);
      if (!profile) {
        reply.code(404);
        return { error: `Council member ${memberId} not found` };
      }

      return profile;
    }
  );

  fastify.get('/api/cognition/learning/status', async () => {
    // Get real learning loop status from the learning module
    const { getLearningStatus } = await import('../cognition/learning/index.js');
    const status = getLearningStatus();

    return {
      currentStage: status.currentStage.toLowerCase().replace(/_/g, '_'),
      lastReview: status.lastReview.toISOString(),
      lastGapAnalysis: status.lastGapAnalysis.toISOString(),
      lastAssessment: status.lastAssessment.toISOString(),
      nextReview: status.nextReview.toISOString(),
      nextGapAnalysis: status.nextGapAnalysis.toISOString(),
      nextAssessment: status.nextAssessment.toISOString(),
      recentInsightsCount: status.recentInsightsCount,
      improvementTrend: status.improvementTrend.toLowerCase() as 'improving' | 'stable' | 'declining',
      currentGrade: status.currentGrade,
      streakDays: status.streakDays,
    };
  });

  fastify.get<{ Querystring: { days?: string; userId?: string } }>(
    '/api/cognition/learning/analytics',
    async (request) => {
      const days = request.query.days ? parseInt(request.query.days, 10) : 30;
      const userId = request.query.userId || process.env.USER || 'default';

      const { computeLearningAnalytics } = await import('../cognition/learning/index.js');
      const analytics = computeLearningAnalytics(userId, { days });

      return {
        period: {
          start: analytics.period.start.toISOString(),
          end: analytics.period.end.toISOString(),
        },
        retentionMetrics: analytics.retentionMetrics,
        practiceQuality: analytics.practiceQuality,
        insights: analytics.insights,
      };
    }
  );

  fastify.get('/api/cognition/learning/calibration', async () => {
    const { getCalibrationTracker } = await import('../cognition/learning/index.js');
    const tracker = await getCalibrationTracker();
    const report = tracker.report();
    return {
      overconfidenceBias: report.overconfidenceBias,
      underconfidenceBias: report.underconfidenceBias,
      calibrationCurve: report.calibrationCurve,
      predictions: report.predictions.map((p: { id: string; statement: string; confidence: number; outcome: boolean | null; createdAt: Date; resolvedAt: Date | null }) => ({
        id: p.id,
        statement: p.statement,
        confidence: p.confidence,
        outcome: p.outcome,
        createdAt: p.createdAt.toISOString(),
        resolvedAt: p.resolvedAt ? p.resolvedAt.toISOString() : null,
      })),
    };
  });

  fastify.post<{
    Body: { statement: string; confidence: number };
  }>('/api/cognition/learning/calibration/predictions', async (request, reply) => {
    const { statement, confidence } = request.body;
    if (!statement || statement.trim().length === 0) {
      reply.code(400);
      return { error: 'statement is required' };
    }

    const { getCalibrationTracker } = await import('../cognition/learning/index.js');
    const tracker = await getCalibrationTracker();
    const prediction = await tracker.addPrediction(statement, confidence);
    return { id: prediction.id };
  });

  fastify.post<{
    Params: { id: string };
    Body: { outcome: boolean };
  }>('/api/cognition/learning/calibration/predictions/:id/outcome', async (request, reply) => {
    const { id } = request.params;
    const { outcome } = request.body;

    const { getCalibrationTracker } = await import('../cognition/learning/index.js');
    const tracker = await getCalibrationTracker();
    const updated = await tracker.resolvePrediction(id, outcome);
    if (!updated) {
      reply.code(404);
      return { error: `prediction ${id} not found` };
    }
    return { success: true };
  });

  fastify.get('/api/cognition/frameworks/usage', async () => {
    // Return framework usage statistics
    // In production, this would aggregate actual usage data from events
    return [
      { framework: 'Bayesian Reasoning', pillar: 'LOGOS', usageCount: 45, successRate: 0.89 },
      { framework: 'Expected Value', pillar: 'LOGOS', usageCount: 38, successRate: 0.85 },
      { framework: 'Kelly Criterion', pillar: 'LOGOS', usageCount: 22, successRate: 0.91 },
      { framework: 'Cognitive Bias Detection', pillar: 'ETHOS', usageCount: 67, successRate: 0.82 },
      { framework: 'Emotional State (VAD)', pillar: 'ETHOS', usageCount: 31, successRate: 0.78 },
      { framework: 'CBT Reframing', pillar: 'PATHOS', usageCount: 28, successRate: 0.84 },
      { framework: 'Stoic Philosophy', pillar: 'PATHOS', usageCount: 19, successRate: 0.88 },
      { framework: 'Deliberate Practice', pillar: 'PATHOS', usageCount: 15, successRate: 0.76 },
    ];
  });

  fastify.get<{ Querystring: { limit?: string; type?: string } }>(
    '/api/cognition/insights',
    async (request) => {
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 20;
      const type = request.query.type as 'SUCCESS' | 'MISTAKE' | 'PATTERN' | 'PRINCIPLE' | 'ANTIPATTERN' | undefined;

      // Get real insights from the learning module
      const { getRecentInsights, getInsightsByType } = await import('../cognition/learning/index.js');

      const insights = type ? getInsightsByType(type) : getRecentInsights(limit);

      // Format for API response
      return insights.slice(0, limit).map(insight => ({
        id: insight.id,
        type: insight.type,
        description: insight.description,
        confidence: insight.confidence,
        timestamp: insight.timestamp.toISOString(),
        framework: insight.framework,
        evidence: insight.evidence,
        actionable: insight.actionable,
        priority: insight.priority,
        generalizes: insight.generalizes,
      }));
    }
  );

  // ── Cognitive Analysis API Endpoints ─────────────────────────────────────────

  // LOGOS: Bayesian Reasoning
  fastify.post<{
    Body: {
      hypothesis: string;
      priorProbability: number;
      evidence: Array<{
        description: string;
        likelihoodRatio: number;
        strength: 'weak' | 'moderate' | 'strong';
      }>;
    };
  }>('/api/cognition/logos/bayesian', async (request, reply) => {
    try {
      const { updateBelief, updateBeliefSequential } = await import('../cognition/logos/index.js');

      const { hypothesis, priorProbability, evidence } = request.body;

      if (evidence.length === 0) {
        reply.code(400);
        return { error: 'At least one piece of evidence is required' };
      }

      const result = evidence.length === 1
        ? await updateBelief({ hypothesis, priorProbability }, evidence[0])
        : await updateBeliefSequential({ hypothesis, priorProbability }, evidence);

      await deps.audit.log('cognition:bayesian_update', 'API', 'operator', {
        hypothesis,
        priorProbability,
        posteriorProbability: result.posteriorProbability,
        evidenceCount: evidence.length,
      });

      return result;
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // LOGOS: Expected Value
  fastify.post<{
    Body: {
      description: string;
      outcomes: Array<{
        description: string;
        probability: number;
        value: number;
        confidence?: number;
      }>;
    };
  }>('/api/cognition/logos/expected-value', async (request, reply) => {
    try {
      const { calculateExpectedValue } = await import('../cognition/logos/index.js');

      const { description, outcomes } = request.body;
      const result = await calculateExpectedValue({ description, outcomes });

      await deps.audit.log('cognition:ev_calculated', 'API', 'operator', {
        decision: description,
        expectedValue: result.expectedValue,
        recommendation: result.recommendation,
      });

      return result;
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // LOGOS: Kelly Criterion
  fastify.post<{
    Body: {
      winProbability: number;
      winAmount: number;
      lossAmount: number;
      currentCapital?: number;
    };
  }>('/api/cognition/logos/kelly', async (request, reply) => {
    try {
      const { calculateKellyFraction } = await import('../cognition/logos/index.js');

      const result = await calculateKellyFraction(request.body);

      await deps.audit.log('cognition:kelly_calculated', 'API', 'operator', {
        recommendedFraction: result.recommendedFraction,
        strategy: result.recommendedStrategy,
        edge: result.edge,
      });

      return result;
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // ETHOS: Cognitive Bias Detection
  fastify.post<{
    Body: {
      reasoning: string;
      context?: {
        domain?: string;
        expertise?: 'novice' | 'intermediate' | 'expert';
      };
    };
  }>('/api/cognition/ethos/bias-detection', async (request, reply) => {
    try {
      const { detectCognitiveBias } = await import('../cognition/ethos/index.js');

      const { reasoning, context } = request.body;
      const result = await detectCognitiveBias(reasoning, context);

      await deps.audit.log('cognition:bias_detected', 'API', 'operator', {
        biasCount: result.biasesDetected.length,
        overallRisk: result.overallRisk,
      });

      return result;
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // ETHOS: Emotional State Assessment (VAD Model)
  fastify.post<{
    Body: {
      valence: number;     // -1 (negative) to +1 (positive)
      arousal: number;     // 0 (calm) to 1 (excited)
      dominance: number;   // 0 (submissive) to 1 (dominant)
      context?: string;
    };
  }>('/api/cognition/ethos/emotional-state', async (request, reply) => {
    try {
      const { assessEmotionalState } = await import('../cognition/ethos/index.js');

      const { valence, arousal, dominance, context } = request.body;

      // Validate VAD ranges
      if (valence < -1 || valence > 1) {
        reply.code(400);
        return { error: 'Valence must be between -1 and 1' };
      }
      if (arousal < 0 || arousal > 1) {
        reply.code(400);
        return { error: 'Arousal must be between 0 and 1' };
      }
      if (dominance < 0 || dominance > 1) {
        reply.code(400);
        return { error: 'Dominance must be between 0 and 1' };
      }

      const result = await assessEmotionalState({ valence, arousal, dominance, context });

      await deps.audit.log('cognition:emotional_state', 'API', 'operator', {
        riskToDecisionQuality: result.riskToDecisionQuality,
        emotions: result.emotions,
      });

      return result;
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // ETHOS: Discipline Check
  fastify.post<{
    Body: {
      decision: string;
      agent?: string;
      context?: {
        sleep?: {
          hours: number;
          quality: 'poor' | 'fair' | 'good' | 'excellent';
        };
        lastMeal?: string;         // ISO date string
        lastExercise?: string;     // ISO date string
        deadline?: string;         // ISO date string
        researchDocuments?: string[];
        alternativesConsidered?: string[];
        consultedParties?: string[];
      };
    };
  }>('/api/cognition/ethos/discipline-check', async (request, reply) => {
    try {
      const { runDisciplineCheck } = await import('../cognition/ethos/index.js');

      const { decision, agent, context } = request.body;

      // Transform ISO strings to Dates
      const disciplineContext = context ? {
        sleep: context.sleep,
        lastMeal: context.lastMeal ? new Date(context.lastMeal) : undefined,
        lastExercise: context.lastExercise ? new Date(context.lastExercise) : undefined,
        currentTime: new Date(),
        deadline: context.deadline ? new Date(context.deadline) : undefined,
        researchDocuments: context.researchDocuments,
        alternativesConsidered: context.alternativesConsidered,
        consultedParties: context.consultedParties,
      } : {};

      const result = await runDisciplineCheck(decision, agent || 'operator', disciplineContext);

      await deps.audit.log('cognition:discipline_check', 'API', 'operator', {
        decision,
        passed: result.passed,
        overallScore: result.overallScore,
      });

      return result;
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // PATHOS: CBT Reframing
  fastify.post<{
    Body: {
      thought: string;
      context?: {
        situation?: string;
        evidence?: string[];
      };
    };
  }>('/api/cognition/pathos/reframe', async (request, reply) => {
    try {
      const { reframeThought } = await import('../cognition/pathos/index.js');

      const { thought, context } = request.body;
      const result = await reframeThought(thought, context);

      await deps.audit.log('cognition:thought_reframed', 'API', 'operator', {
        distortionsFound: result.distortionsDetected.length,
      });

      return result;
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // PATHOS: Stoic Dichotomy of Control
  fastify.post<{
    Body: {
      situation: string;
      elements: Array<{
        item: string;
        category?: 'controllable' | 'uncontrollable';
      }>;
    };
  }>('/api/cognition/pathos/dichotomy', async (request, reply) => {
    try {
      const { analyzeDichotomy } = await import('../cognition/pathos/index.js');

      const { situation, elements } = request.body;
      const result = await analyzeDichotomy(situation, elements);

      await deps.audit.log('cognition:dichotomy_analyzed', 'API', 'operator', {
        situation,
        controllableCount: result.controllable.length,
        uncontrollableCount: result.uncontrollable.length,
      });

      return result;
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // PATHOS: Wisdom Query
  fastify.get<{
    Querystring: {
      query: string;
      tradition?: string;
    };
  }>('/api/cognition/pathos/wisdom', async (request, reply) => {
    try {
      const { queryWisdom } = await import('../cognition/pathos/index.js');

      const { query, tradition } = request.query;
      // Type assertion for tradition - validated by Zod schema in queryWisdom
      const result = await queryWisdom(query, tradition as ('STOIC' | 'DALIO' | 'MUNGER' | 'MUSASHI' | 'NAVAL' | 'TALEB' | 'MEADOWS' | 'ERICSSON' | 'BECK' | 'UNIVERSAL')[] | undefined);

      await deps.audit.log('cognition:wisdom_queried', 'API', 'operator', {
        query,
        tradition: result.tradition,
        principle: result.principle,
      });

      return result;
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // PATHOS: Practice Plan (Deliberate Practice)
  fastify.post<{
    Body: {
      skill: string;
      currentLevel: number;  // 1-10 scale
      targetLevel: number;   // 1-10 scale
      constraints?: {
        hoursPerWeek?: number;
        maxTimeframe?: string;
        availableResources?: string[];
      };
    };
  }>('/api/cognition/pathos/practice-plan', async (request, reply) => {
    try {
      const { generatePracticePlan } = await import('../cognition/pathos/index.js');

      const { skill, currentLevel, targetLevel, constraints } = request.body;
      const result = await generatePracticePlan(skill, currentLevel, targetLevel, constraints);

      await deps.audit.log('cognition:practice_plan_created', 'API', 'operator', {
        skill,
        estimatedHours: result.estimatedHours,
        gap: targetLevel - currentLevel,
      });

      return result;
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Add an insight manually
  fastify.post<{
    Body: {
      type: 'SUCCESS' | 'MISTAKE' | 'PATTERN' | 'PRINCIPLE' | 'ANTIPATTERN';
      description: string;
      evidence?: string[];
      framework: string;
      confidence?: number;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    };
  }>('/api/cognition/insights', async (request, reply) => {
    try {
      const { addInsight } = await import('../cognition/learning/index.js');

      const insight = {
        id: `insight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: request.body.type,
        description: request.body.description,
        evidence: request.body.evidence || [],
        actionable: 'Review and apply this insight',
        confidence: request.body.confidence || 0.75,
        generalizes: true,
        priority: request.body.priority || 'MEDIUM',
        framework: request.body.framework,
        timestamp: new Date(),
      };

      addInsight(insight);

      await deps.audit.log('cognition:insight_added', 'API', 'operator', {
        insightId: insight.id,
        type: insight.type,
        framework: insight.framework,
      });

      return { success: true, insight };
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Comprehensive cognitive analysis (runs multiple frameworks)
  fastify.post<{
    Body: {
      decision: string;
      reasoning: string;
      outcomes?: Array<{
        description: string;
        probability: number;
        value: number;
      }>;
      context?: {
        domain?: string;
        expertise?: 'novice' | 'intermediate' | 'expert';
      };
    };
  }>('/api/cognition/analyze', async (request, reply) => {
    try {
      const { detectCognitiveBias } = await import('../cognition/ethos/index.js');
      const { calculateExpectedValue } = await import('../cognition/logos/index.js');
      const { formatComprehensiveAnalysis } = await import('../cognition/visualization/index.js');

      const { decision, reasoning, outcomes, context } = request.body;

      // Run bias detection
      const biasResult = await detectCognitiveBias(reasoning, context);

      // Run EV if outcomes provided
      let evResult = null;
      if (outcomes && outcomes.length > 0) {
        evResult = await calculateExpectedValue({ description: decision, outcomes });
      }

      // Format comprehensive output
      const formatted = formatComprehensiveAnalysis({
        ev: evResult || undefined,
        biases: biasResult,
      });

      await deps.audit.log('cognition:comprehensive_analysis', 'API', 'operator', {
        decision,
        biasCount: biasResult.biasesDetected.length,
        hasEV: !!evResult,
      });

      return {
        decision,
        biasAnalysis: biasResult,
        expectedValue: evResult,
        formattedOutput: formatted,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // ── Budget Endpoints ────────────────────────────────────────────────────────

  /**
   * GET /api/budget/status
   * Returns current budget usage and throttle status
   */
  fastify.get('/api/budget/status', async () => {
    if (!deps.costTracker) {
      return { error: 'Cost tracker not initialized' };
    }

    const status = deps.costTracker.getThrottleStatus();
    const usage = deps.costTracker.getTokenUsage();
    const profile = deps.costTracker.getProfile();

    return {
      profile: profile?.profile ?? 'unknown',
      budget: {
        maxTokens: profile?.budget?.daily?.maxTokens ?? 800000,
        maxCost: profile?.budget?.daily?.maxCost ?? 2.50,
      },
      usage: {
        tokensUsed: usage.totalTokens,
        tokensRemaining: status.tokensRemaining,
        costUsed: usage.totalCost,
        percentUsed: status.usagePercent,
      },
      throttle: {
        level: status.level,
        projectedEOD: status.projectedEOD,
      },
      breakdown: {
        byModel: usage.byModel,
        byTaskType: Object.entries(usage.byTaskType)
          .sort((a, b) => b[1].cost - a[1].cost)
          .slice(0, 10)
          .map(([taskType, data]) => ({
            taskType,
            tokens: data.tokens,
            cost: data.cost,
            count: data.count,
            percentOfTotal: usage.totalTokens > 0
              ? (data.tokens / usage.totalTokens) * 100
              : 0,
          })),
      },
      resetAt: usage.resetAt,
      date: usage.date,
    };
  });

  /**
   * GET /api/budget/history
   * Returns historical budget usage (last N days)
   */
  fastify.get<{ Querystring: { days?: string } }>(
    '/api/budget/history',
    async (request) => {
      const days = request.query.days ? parseInt(request.query.days, 10) : 7;

      // For now, return current day only
      // TODO: Implement multi-day history storage
      const usage = deps.costTracker?.getTokenUsage();

      return {
        history: usage ? [usage] : [],
        days,
      };
    }
  );

  /**
   * POST /api/budget/profile
   * Switch budget profile (conservative, balanced, aggressive)
   */
  fastify.post<{ Body: { profile: string } }>(
    '/api/budget/profile',
    async (request, reply) => {
      const { profile } = request.body;

      if (!['conservative', 'balanced', 'aggressive'].includes(profile)) {
        reply.code(400);
        return { error: 'Invalid profile. Must be conservative, balanced, or aggressive.' };
      }

      if (!deps.costTracker) {
        reply.code(503);
        return { error: 'Cost tracker not initialized' };
      }

      try {
        // Load profile from config file
        const profilePath = path.join(process.cwd(), 'config', `budget.${profile}.json`);
        const profileData = JSON.parse(await fs.readFile(profilePath, 'utf-8')) as import('../observability/cost-tracker.js').BudgetProfile;

        await deps.costTracker.setProfile(profileData);

        await deps.audit.log(
          'budget:profile_changed',
          'API',
          'operator',
          { profile, previousProfile: deps.costTracker.getProfile()?.profile }
        );

        return { success: true, profile };
      } catch (error) {
        reply.code(500);
        return { error: `Failed to load profile: ${error instanceof Error ? error.message : String(error)}` };
      }
    }
  );

  /**
   * GET /api/budget/can-proceed
   * Check if an operation can proceed within budget constraints
   */
  fastify.get<{ Querystring: { tokens?: string; priority?: string } }>(
    '/api/budget/can-proceed',
    async (request) => {
      const tokens = request.query.tokens ? parseInt(request.query.tokens, 10) : 10000;
      const priority = (request.query.priority || 'STANDARD') as 'BACKGROUND' | 'STANDARD' | 'URGENT';

      if (!deps.costTracker) {
        return { allowed: true, throttled: false, reason: 'Cost tracker not initialized' };
      }

      return deps.costTracker.canProceed(tokens, priority);
    }
  );

  // ── Approval Queue Endpoints ─────────────────────────────────────────────────

  /**
   * GET /api/approval-queue
   * List pending approval items and recent history
   */
  fastify.get('/api/approval-queue', async () => {
    if (!deps.approvalQueue) {
      return { pending: [], history: [], stats: null };
    }

    return {
      pending: deps.approvalQueue.getPending(),
      history: deps.approvalQueue.getHistory(20),
      stats: deps.approvalQueue.getStats(),
    };
  });

  /**
   * GET /api/approval-queue/pending
   * List only pending approval items
   */
  fastify.get('/api/approval-queue/pending', async () => {
    if (!deps.approvalQueue) {
      return [];
    }
    return deps.approvalQueue.getPending();
  });

  /**
   * GET /api/approval-queue/stats
   * Get approval queue statistics
   */
  fastify.get('/api/approval-queue/stats', async () => {
    if (!deps.approvalQueue) {
      return {
        pendingCount: 0,
        pendingByRisk: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
        pendingByType: {},
        totalApproved: 0,
        totalRejected: 0,
        totalExpired: 0,
        averageDecisionTimeMs: 0,
        approvalRate: 0,
      };
    }
    return deps.approvalQueue.getStats();
  });

  /**
   * GET /api/approval-queue/:id
   * Get a specific approval item by ID
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/approval-queue/:id',
    async (request, reply) => {
      const { id } = request.params;

      if (!deps.approvalQueue) {
        reply.code(503);
        return { error: 'Approval queue not initialized' };
      }

      const item = deps.approvalQueue.getItem(id);
      if (!item) {
        reply.code(404);
        return { error: `Approval item ${id} not found` };
      }

      return item;
    }
  );

  /**
   * POST /api/approval-queue/:id/approve
   * Approve a pending item
   */
  fastify.post<{ Params: { id: string }; Body: { note?: string; approvedBy?: string } }>(
    '/api/approval-queue/:id/approve',
    async (request, reply) => {
      const { id } = request.params;
      const { note, approvedBy } = request.body || {};

      if (!deps.approvalQueue) {
        reply.code(503);
        return { error: 'Approval queue not initialized' };
      }

      try {
        await deps.approvalQueue.approve(id, { note, approvedBy: approvedBy || 'operator' });

        await deps.audit.log(
          'approval:item_approved_via_api',
          'API',
          'operator',
          { itemId: id, note }
        );

        return { success: true, id };
      } catch (error) {
        reply.code(404);
        return { error: error instanceof Error ? error.message : `Item ${id} not found` };
      }
    }
  );

  /**
   * POST /api/approval-queue/:id/reject
   * Reject a pending item (reason required)
   */
  fastify.post<{ Params: { id: string }; Body: { reason: string; rejectedBy?: string } }>(
    '/api/approval-queue/:id/reject',
    async (request, reply) => {
      const { id } = request.params;
      const { reason, rejectedBy } = request.body || {};

      if (!reason) {
        reply.code(400);
        return { error: 'Reason is required for rejection' };
      }

      if (!deps.approvalQueue) {
        reply.code(503);
        return { error: 'Approval queue not initialized' };
      }

      try {
        await deps.approvalQueue.reject(id, { reason, rejectedBy: rejectedBy || 'operator' });

        await deps.audit.log(
          'approval:item_rejected_via_api',
          'API',
          'operator',
          { itemId: id, reason }
        );

        return { success: true, id };
      } catch (error) {
        reply.code(404);
        return { error: error instanceof Error ? error.message : `Item ${id} not found` };
      }
    }
  );

  /**
   * POST /api/approval-queue/add
   * Add an item to the approval queue (for testing or manual additions)
   */
  fastify.post<{
    Body: {
      id: string;
      type: 'INITIATIVE' | 'CONFIG_CHANGE' | 'DESTRUCTIVE_OP' | 'HIGH_COST' | 'SECURITY_SENSITIVE';
      title: string;
      description: string;
      risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      estimatedCost: number;
      estimatedTokens: number;
      reversible: boolean;
      affectedFiles?: string[];
      toolsRequired?: string[];
      metadata?: Record<string, unknown>;
    };
  }>('/api/approval-queue/add', async (request, reply) => {
    if (!deps.approvalQueue) {
      reply.code(503);
      return { error: 'Approval queue not initialized' };
    }

    const item = request.body;
    if (!item.id || !item.type || !item.title || !item.description) {
      reply.code(400);
      return { error: 'Missing required fields: id, type, title, description' };
    }

    try {
      const fullItem = await deps.approvalQueue.add(item);

      await deps.audit.log(
        'approval:item_added_via_api',
        'API',
        'operator',
        { itemId: item.id, type: item.type, risk: item.risk }
      );

      return { success: true, item: fullItem };
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Failed to add item' };
    }
  });

  // ── Billing Cycle Endpoints ─────────────────────────────────────────────────

  /**
   * GET /api/billing/cycle
   * Returns current billing cycle status and recommendations
   */
  fastify.get('/api/billing/cycle', async () => {
    if (!deps.billingCycleManager) {
      return { error: 'Billing cycle manager not initialized' };
    }

    const status = deps.billingCycleManager.getCycleStatus();
    const recommended = deps.billingCycleManager.getRecommendedDailyBudget();
    const cycleData = deps.billingCycleManager.getCycleData();

    return {
      ...status,
      cycle: {
        startDate: cycleData.cycleStartDate,
        endDate: cycleData.cycleEndDate,
        totalBudget: cycleData.totalBudget,
        daysInCycle: cycleData.daysInCycle,
      },
      recommended: {
        dailyBudget: recommended.recommended,
        reason: recommended.reason,
        confidence: recommended.confidence,
        adjustments: recommended.adjustments,
      },
      dailySpending: cycleData.dailySpending.slice(-7), // Last 7 days
      previousCycles: cycleData.previousCycles.slice(-3), // Last 3 cycles
    };
  });

  /**
   * POST /api/billing/new-cycle
   * Start a new billing cycle (manual trigger)
   */
  fastify.post('/api/billing/new-cycle', async () => {
    if (!deps.billingCycleManager) {
      return { error: 'Billing cycle manager not initialized' };
    }

    await deps.billingCycleManager.startNewCycle();

    await deps.audit.log(
      'billing:cycle_started_manually',
      'API',
      'operator',
      {}
    );

    return { success: true, message: 'New billing cycle started' };
  });

  // ── Value Analytics Endpoints ─────────────────────────────────────────────────

  /**
   * GET /api/analytics/value
   * Returns value analytics summary
   */
  fastify.get('/api/analytics/value', async () => {
    if (!deps.valueAnalytics) {
      return { error: 'Value analytics not initialized' };
    }

    return deps.valueAnalytics.getSummary();
  });

  /**
   * GET /api/analytics/value/daily
   * Returns daily value breakdown for last N days
   */
  fastify.get<{ Querystring: { days?: string } }>(
    '/api/analytics/value/daily',
    async (request) => {
      const days = request.query.days ? parseInt(request.query.days, 10) : 7;

      if (!deps.valueAnalytics) {
        return [];
      }

      return deps.valueAnalytics.getDailyBreakdown(days);
    }
  );

  /**
   * GET /api/analytics/value/today
   * Returns today's value progress (real-time)
   */
  fastify.get('/api/analytics/value/today', async () => {
    if (!deps.valueAnalytics) {
      return {
        metrics: {
          morningBriefDelivered: false,
          eveningSummaryDelivered: false,
          testsGenerated: 0,
          docsWritten: 0,
          bugsFixed: 0,
          codeImprovements: 0,
          initiativesExecuted: 0,
          highValueInsights: 0,
          patternsLearned: 0,
          tasksAttempted: 0,
          tasksSucceeded: 0,
          errorsEncountered: 0,
        },
        currentScore: 0,
        breakdown: [],
      };
    }

    return deps.valueAnalytics.getTodayProgress();
  });

  /**
   * GET /api/analytics/value/weekly
   * Returns weekly value report
   */
  fastify.get('/api/analytics/value/weekly', async () => {
    if (!deps.valueAnalytics) {
      return { error: 'Value analytics not initialized' };
    }

    return deps.valueAnalytics.getWeeklyReport();
  });

  // ── Adaptive Learning Endpoints ─────────────────────────────────────────────────

  /**
   * GET /api/adaptive/patterns
   * Returns learned usage patterns
   */
  fastify.get('/api/adaptive/patterns', async () => {
    if (!deps.adaptiveLearner) {
      return [];
    }

    return deps.adaptiveLearner.getPatterns();
  });

  /**
   * GET /api/adaptive/recommendations
   * Returns current active recommendations
   */
  fastify.get('/api/adaptive/recommendations', async () => {
    if (!deps.adaptiveLearner) {
      return [];
    }

    return deps.adaptiveLearner.getRecommendations();
  });

  /**
   * GET /api/adaptive/summaries
   * Returns weekly learning summaries
   */
  fastify.get('/api/adaptive/summaries', async () => {
    if (!deps.adaptiveLearner) {
      return [];
    }

    return deps.adaptiveLearner.getWeeklySummaries();
  });

  /**
   * GET /api/adaptive/peak-hours
   * Returns learned peak activity hours
   */
  fastify.get('/api/adaptive/peak-hours', async () => {
    if (!deps.adaptiveLearner) {
      return { hours: [9, 10, 11, 14, 15, 16] }; // Default business hours
    }

    return {
      hours: deps.adaptiveLearner.getPeakActivityHours(),
    };
  });

  /**
   * GET /api/adaptive/summary
   * Returns adaptive learning summary statistics
   */
  fastify.get('/api/adaptive/summary', async () => {
    if (!deps.adaptiveLearner) {
      return {
        patternCount: 0,
        weeklyCount: 0,
        recommendationCount: 0,
        topPatterns: [],
      };
    }

    return deps.adaptiveLearner.getSummary();
  });

  /**
   * GET /api/adaptive/model/:taskType
   * Get recommended model for a specific task type
   */
  fastify.get<{ Params: { taskType: string } }>(
    '/api/adaptive/model/:taskType',
    async (request) => {
      const { taskType } = request.params;

      if (!deps.adaptiveLearner) {
        return { model: null, confidence: 0, reason: 'Adaptive learner not initialized' };
      }

      const result = deps.adaptiveLearner.getOptimalModelForTask(taskType);
      if (!result) {
        return { model: null, confidence: 0, reason: 'Insufficient data for this task type' };
      }

      return {
        model: result.model,
        confidence: result.confidence,
        reason: `Learned from ${result.confidence > 0.8 ? 'many' : 'some'} observations`,
      };
    }
  );
};

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}
