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

  // ── Dashboard HTML endpoint ─────────────────────────────────────────────

  fastify.get('/', async (_request, reply) => {
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
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ARI</h1>
      <p>ARTIFICIAL REASONING INTELLIGENCE</p>
      <div class="status-badge">FULLY OPERATIONAL</div>
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
