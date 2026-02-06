/* eslint-disable @typescript-eslint/require-await */
import type { FastifyPluginAsync } from 'fastify';
import type { ApiRouteOptions } from './shared.js';

/**
 * Audit endpoints
 * - GET /api/audit - Get audit events (paginated)
 * - GET /api/audit/verify - Verify audit chain integrity
 * - GET /api/reports/today - Today's audit report
 * - GET /api/reports/:date - Specific date audit report
 * - GET /api/reports - List all audit reports
 * - GET /api/reports/metrics - Audit metrics
 */
export const auditRoutes: FastifyPluginAsync<ApiRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  const { deps } = options;

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

  // Daily audit reports
  fastify.get('/api/reports/today', async () => {
    const { dailyAudit } = await import('../../autonomous/daily-audit.js');
    await dailyAudit.init();
    return await dailyAudit.getTodayAudit();
  });

  fastify.get<{ Params: { date: string } }>('/api/reports/:date', async (request, reply) => {
    const { date } = request.params;
    const { dailyAudit } = await import('../../autonomous/daily-audit.js');
    await dailyAudit.init();
    const report = await dailyAudit.getAudit(date);
    if (!report) {
      reply.code(404);
      return { error: `No audit report found for ${date}` };
    }
    return report;
  });

  fastify.get('/api/reports', async () => {
    const { dailyAudit } = await import('../../autonomous/daily-audit.js');
    await dailyAudit.init();
    const dates = await dailyAudit.listAudits();
    return { audits: dates, total: dates.length };
  });

  fastify.get('/api/reports/metrics', async () => {
    const { dailyAudit } = await import('../../autonomous/daily-audit.js');
    await dailyAudit.init();
    return dailyAudit.getMetrics();
  });
};
