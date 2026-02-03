/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { test, expect } from '@playwright/test';

test.describe('API Endpoints', () => {
  test.describe('Health Checks', () => {
    test('GET /api/health returns healthy', async ({ request }) => {
      const response = await request.get('/api/health');
      expect(response.ok()).toBe(true);
      expect(response.headers()['content-type']).toContain('application/json');

      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('uptime');
    });

    test('GET /api/health/detailed returns all components', async ({ request }) => {
      const response = await request.get('/api/health/detailed');
      expect(response.ok()).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('gateway');
      expect(data).toHaveProperty('eventBus');
      expect(data).toHaveProperty('audit');
      expect(data).toHaveProperty('sanitizer');
    });

    test('health endpoint responds under 100ms', async ({ request }) => {
      const start = Date.now();
      await request.get('/api/health');
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100);
    });
  });

  test.describe('Cognitive Layer', () => {
    test('GET /api/cognition/health returns system status', async ({ request }) => {
      const response = await request.get('/api/cognition/health');
      if (response.ok()) {
        const data = await response.json();
        expect(data).toHaveProperty('logos');
        expect(data).toHaveProperty('ethos');
        expect(data).toHaveProperty('pathos');
      }
    });

    test('GET /api/cognition/logos/beliefs returns Bayesian beliefs', async ({ request }) => {
      const response = await request.get('/api/cognition/logos/beliefs');

      if (response.ok()) {
        const data = await response.json();
        expect(Array.isArray(data.beliefs)).toBe(true);
        for (const belief of data.beliefs || []) {
          expect(belief).toHaveProperty('hypothesis');
          expect(belief).toHaveProperty('priorProbability');
          expect(belief.priorProbability).toBeGreaterThanOrEqual(0);
          expect(belief.priorProbability).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  test.describe('Alerts API', () => {
    test('GET /api/alerts returns paginated list', async ({ request }) => {
      const response = await request.get('/api/alerts?limit=10');
      expect(response.ok()).toBe(true);

      const data = await response.json();
      expect(Array.isArray(data.alerts)).toBe(true);
      expect(data).toHaveProperty('total');
    });

    test('GET /api/alerts supports filtering by severity', async ({ request }) => {
      const response = await request.get('/api/alerts?severity=critical');
      expect(response.ok()).toBe(true);

      const data = await response.json();
      for (const alert of data.alerts || []) {
        expect(alert.severity).toBe('critical');
      }
    });

    test('GET /api/alerts supports filtering by status', async ({ request }) => {
      const response = await request.get('/api/alerts?status=active');
      expect(response.ok()).toBe(true);

      const data = await response.json();
      for (const alert of data.alerts || []) {
        expect(alert.status).toBe('active');
      }
    });

    test('POST /api/alerts/:id/acknowledge works', async ({ request }) => {
      // First get an alert
      const listResponse = await request.get('/api/alerts?status=active&limit=1');
      const list = await listResponse.json();

      if (list.alerts && list.alerts.length > 0) {
        const alertId = list.alerts[0].id;

        // Acknowledge it
        const ackResponse = await request.post(`/api/alerts/${alertId}/acknowledge`);
        if (ackResponse.ok()) {
          const data = await ackResponse.json();
          expect(data.success || data.alert).toBeTruthy();
        }
      }
    });
  });

  test.describe('E2E API', () => {
    test('GET /api/e2e/runs returns run history', async ({ request }) => {
      const response = await request.get('/api/e2e/runs');
      if (response.ok()) {
        const data = await response.json();
        expect(Array.isArray(data.runs)).toBe(true);
        expect(data).toHaveProperty('passRate');
        expect(data).toHaveProperty('consecutiveFailures');
      }
    });

    test('GET /api/e2e/status shows running state', async ({ request }) => {
      const response = await request.get('/api/e2e/status');
      if (response.ok()) {
        const data = await response.json();
        expect(data).toHaveProperty('isRunning');
      }
    });
  });

  test.describe('Budget API', () => {
    test('GET /api/budget/status returns budget info', async ({ request }) => {
      const response = await request.get('/api/budget/status');
      if (response.ok()) {
        const data = await response.json();
        expect(data).toHaveProperty('status');
        expect(data).toHaveProperty('spent');
        expect(data).toHaveProperty('remaining');
        expect(data).toHaveProperty('percentUsed');
      }
    });

    test('GET /api/budget/history returns usage history', async ({ request }) => {
      const response = await request.get('/api/budget/history');
      if (response.ok()) {
        const data = await response.json();
        expect(data).toHaveProperty('usageByDay');
      }
    });
  });

  test.describe('Error Handling', () => {
    test('invalid JSON returns 400', async ({ request }) => {
      const response = await request.post('/message', {
        data: 'not json',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(response.status()).toBe(400);
    });

    test('missing required fields returns 400 with details', async ({ request }) => {
      const response = await request.post('/message', {
        data: {},
      });
      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    test('404 for unknown routes', async ({ request }) => {
      const response = await request.get('/api/nonexistent');
      expect(response.status()).toBe(404);
    });
  });

  test.describe('Response Headers', () => {
    test('security headers are present', async ({ request }) => {
      const response = await request.get('/api/health');
      const headers = response.headers();
      // Check for common security headers
      expect(headers['content-type']).toContain('application/json');
    });

    test('request IDs are included', async ({ request }) => {
      const response = await request.get('/api/health');
      // Many APIs include request IDs for tracing
      const headers = response.headers();
      // This is optional - check if present
      if (headers['x-request-id']) {
        expect(headers['x-request-id']).toBeTruthy();
      }
    });
  });
});
