import type { BriefingContribution, AlertContribution } from '../types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TELEGRAM BOT FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════════

export function formatBriefingHtml(contributions: BriefingContribution[]): string {
  if (contributions.length === 0) return 'No briefing data available.';

  const lines = ['<b>ARI Briefing</b>', ''];

  for (const c of contributions) {
    const icon = c.category === 'alert' ? '⚠️' :
      c.category === 'action' ? '📌' :
      c.category === 'insight' ? '💡' : 'ℹ️';

    lines.push(`${icon} <b>${c.section}</b>`);
    lines.push(c.content);
    lines.push('');
  }

  return lines.join('\n');
}

export function formatAlertsHtml(alerts: AlertContribution[]): string {
  if (alerts.length === 0) return 'No active alerts.';

  const lines = ['<b>Active Alerts</b>', ''];

  for (const alert of alerts) {
    const icon = alert.severity === 'critical' ? '🔴' :
      alert.severity === 'warning' ? '🟡' : '🔵';

    lines.push(`${icon} <b>${alert.title}</b>`);
    lines.push(alert.message);
    if (alert.action) lines.push(`<i>Action: ${alert.action}</i>`);
    lines.push('');
  }

  return lines.join('\n');
}

export function formatSystemStatusHtml(
  plugins: Array<{ id: string; name: string; status: string; capabilities: string[] }>,
): string {
  const lines = ['<b>System Status</b>', ''];

  for (const p of plugins) {
    const icon = p.status === 'active' ? '🟢' :
      p.status === 'error' ? '🔴' :
      p.status === 'disabled' ? '⚪' : '🟡';

    lines.push(`${icon} <b>${p.name}</b> — ${p.status}`);
  }

  lines.push('');
  lines.push(`<i>Total: ${plugins.length} plugins</i>`);

  return lines.join('\n');
}
