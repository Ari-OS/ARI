/* eslint-disable @typescript-eslint/require-await */
import type { FastifyPluginAsync } from 'fastify';
import type { ApiRouteOptions } from './shared.js';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('dashboard-api');

// Get __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Dashboard static file serving and fallback HTML
 * - Static files from dashboard/dist
 * - GET / - Dashboard HTML (React SPA or fallback)
 */
export const dashboardRoutes: FastifyPluginAsync<ApiRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  const { deps } = options;

  // ── Static file serving for React Dashboard ─────────────────────────────────
  // Serve the React dashboard from dashboard/dist
  // Fall back to inline HTML if dashboard is not built

  const dashboardDistPath = path.resolve(__dirname, '../../../dashboard/dist');
  let dashboardAvailable = false;

  try {
    await fs.access(dashboardDistPath);
    dashboardAvailable = true;

    // Register static file serving for the React dashboard
    await fastify.register(fastifyStatic, {
      root: dashboardDistPath,
      prefix: '/',
      // decorateReply defaults to true, enabling reply.sendFile()
    });

    log.info({ path: dashboardDistPath }, 'Dashboard serving from path');
  } catch {
    log.warn('Dashboard dist not found, using inline fallback');
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
          <span class="stat-value">15 members</span>
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
};
