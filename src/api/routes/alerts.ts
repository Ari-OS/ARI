/* eslint-disable @typescript-eslint/require-await */
import type { FastifyPluginAsync } from 'fastify';
import type { ApiRouteOptions } from './shared.js';
import type { AlertSeverity, AlertStatus } from '../../observability/types.js';

/**
 * Alert endpoints
 * - GET /api/alerts - List alerts (filtered, paginated)
 * - GET /api/alerts/summary - Alert summary statistics
 * - GET /api/alerts/:id - Get specific alert
 * - POST /api/alerts/:id/acknowledge - Acknowledge alert
 * - POST /api/alerts/:id/resolve - Resolve alert
 * - DELETE /api/alerts/:id - Delete alert
 */
export const alertRoutes: FastifyPluginAsync<ApiRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  const { deps } = options;

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
};
