import { useHealth, useDetailedHealth } from '../hooks/useHealth';
import { useAlertSummary } from '../hooks/useAlerts';
import { NotificationBell } from './alerts/NotificationBell';
import { HealthScoreGauge } from './charts/HealthScoreGauge';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  wsStatus?: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
}

const pages = [
  { id: 'home', label: 'Overview', icon: '◉', description: 'Dashboard', accent: 'purple' },
  { id: 'health', label: 'Health', icon: '♥', description: 'System status', accent: 'emerald' },
  { id: 'cognition', label: 'Cognition', icon: '🧠', description: 'LOGOS/ETHOS/PATHOS', accent: 'purple' },
  { id: 'autonomy', label: 'Autonomy', icon: '↻', description: 'Scheduler', accent: 'cyan' },
  { id: 'agents', label: 'Agents', icon: '⬡', description: 'Active agents', accent: 'blue' },
  { id: 'governance', label: 'Governance', icon: '⚖', description: 'Council', accent: 'indigo' },
  { id: 'memory', label: 'Memory', icon: '⬢', description: 'Knowledge', accent: 'cyan' },
  { id: 'tools', label: 'Tools', icon: '⚙', description: 'Registry', accent: 'amber' },
  { id: 'audit', label: 'Audit Trail', icon: '⊞', description: 'Hash chain', accent: 'purple' },
];

export function Sidebar({ currentPage, onNavigate, wsStatus = 'disconnected' }: SidebarProps) {
  const { data: health } = useHealth();
  const { data: detailedHealth } = useDetailedHealth();
  const { data: alertSummary } = useAlertSummary();

  const getStatusColor = (status?: string) => {
    if (!status) return 'bg-gray-500';
    if (status === 'healthy' || status === 'ok') return 'bg-[var(--ari-success)]';
    if (status === 'degraded' || status === 'warning') return 'bg-[var(--ari-warning)]';
    return 'bg-[var(--ari-error)]';
  };

  const getStatusGlow = (status?: string) => {
    if (!status) return '';
    if (status === 'healthy' || status === 'ok') return 'glow-success';
    if (status === 'degraded' || status === 'warning') return 'glow-warning';
    return 'glow-error';
  };

  const getWsStatusColor = () => {
    switch (wsStatus) {
      case 'connected':
        return 'bg-[var(--ari-success)]';
      case 'connecting':
      case 'reconnecting':
        return 'bg-[var(--ari-warning)] animate-pulse';
      default:
        return 'bg-gray-500';
    }
  };

  // Calculate health score (0-100) from component statuses
  const calculateHealthScore = (): number => {
    if (!detailedHealth) return 0;

    const components = [
      detailedHealth.gateway.status,
      detailedHealth.eventBus.status,
      detailedHealth.audit.status,
      detailedHealth.sanitizer.status,
      detailedHealth.agents.status,
      detailedHealth.governance.status,
    ];

    const healthyCount = components.filter((s) => s === 'healthy').length;
    const degradedCount = components.filter((s) => s === 'degraded').length;

    // Healthy = 100%, Degraded = 50%, Unhealthy = 0%
    return Math.round(((healthyCount * 100 + degradedCount * 50) / components.length));
  };

  const healthScore = calculateHealthScore();

  // Real data from API
  const agentCount = detailedHealth?.agents.activeCount ?? 0;
  const councilCount = detailedHealth?.governance.councilMembers ?? 0;
  const patternCount = detailedHealth?.sanitizer.patternsLoaded ?? 21;

  // Dynamic description for agents page
  const pagesWithData = pages.map((page) => {
    if (page.id === 'agents') {
      return { ...page, description: `${agentCount} active` };
    }
    if (page.id === 'governance') {
      return { ...page, description: `${councilCount} members` };
    }
    return page;
  });

  return (
    <aside
      className="flex w-72 flex-col border-r bg-[var(--bg-secondary)]"
      style={{ borderColor: 'var(--border-muted)' }}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Header with Purple Gradient Accent */}
      <div className="relative p-6" style={{ borderBottom: '1px solid var(--border-muted)' }}>
        {/* Subtle purple glow at top */}
        <div
          className="absolute inset-x-0 top-0 h-32 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at top, rgba(168, 85, 247, 0.08) 0%, transparent 70%)'
          }}
        />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`relative h-11 w-11 rounded-xl animate-breathe-purple ${getStatusGlow(health?.status)}`}
              style={{
                background: 'linear-gradient(135deg, var(--ari-purple) 0%, var(--ari-purple-dark) 100%)'
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-white">
                A
              </div>
              <div
                className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full ${getStatusColor(health?.status)} ${health?.status === 'healthy' ? 'status-dot-healthy' : ''}`}
                style={{ border: '2px solid var(--bg-secondary)' }}
              />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>ARI</h1>
              <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                Life Operating System
              </p>
            </div>
          </div>
          <NotificationBell />
        </div>

        {/* Health Score Gauge */}
        <div className="mt-5 flex justify-center">
          <HealthScoreGauge score={healthScore} size="sm" label="Health" />
        </div>

        {/* Quick Stats with Pillar-Inspired Colors */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          <div
            className="rounded-lg p-2.5 text-center card-ari"
            style={{ background: 'var(--ari-success-muted)' }}
          >
            <div className="text-lg font-bold" style={{ color: 'var(--ari-success)' }}>{agentCount}</div>
            <div className="text-[9px] uppercase font-medium" style={{ color: 'var(--text-muted)' }}>Agents</div>
          </div>
          <div
            className="rounded-lg p-2.5 text-center card-ari"
            style={{ background: 'var(--ari-purple-muted)' }}
          >
            <div className="text-lg font-bold" style={{ color: 'var(--ari-purple)' }}>{councilCount}</div>
            <div className="text-[9px] uppercase font-medium" style={{ color: 'var(--text-muted)' }}>Council</div>
          </div>
          <div
            className="rounded-lg p-2.5 text-center card-ari"
            style={{ background: 'var(--ari-info-muted)' }}
          >
            <div className="text-lg font-bold" style={{ color: 'var(--ari-cyan)' }}>{patternCount}</div>
            <div className="text-[9px] uppercase font-medium" style={{ color: 'var(--text-muted)' }}>Patterns</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto custom-scrollbar" aria-label="Page navigation">
        <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-disabled)' }}>
          Dashboard
        </div>
        <ul className="space-y-1 stagger-children">
          {pagesWithData.map((page) => (
            <li key={page.id}>
              <button
                onClick={() => onNavigate(page.id)}
                aria-current={currentPage === page.id ? 'page' : undefined}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  currentPage === page.id
                    ? ''
                    : 'hover:bg-[var(--bg-interactive)]'
                }`}
                style={{
                  background: currentPage === page.id ? 'var(--ari-purple-muted)' : 'transparent',
                  color: currentPage === page.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  '--tw-ring-color': 'var(--ari-purple)',
                  '--tw-ring-offset-color': 'var(--bg-secondary)',
                } as React.CSSProperties}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-all ${
                    currentPage === page.id ? '' : 'group-hover:scale-105'
                  }`}
                  style={{
                    background: currentPage === page.id
                      ? 'rgba(168, 85, 247, 0.3)'
                      : 'var(--bg-tertiary)',
                    color: currentPage === page.id
                      ? 'var(--ari-purple-300)'
                      : 'var(--text-muted)',
                  }}
                  aria-hidden="true"
                >
                  {page.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm font-medium truncate"
                    style={{ color: currentPage === page.id ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                  >
                    {page.label}
                  </div>
                  <div
                    className="text-[10px] truncate"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {page.description}
                  </div>
                </div>
                {currentPage === page.id && (
                  <div
                    className="h-1.5 w-1.5 rounded-full animate-pulse"
                    style={{ background: 'var(--ari-purple-400)' }}
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Security Status */}
      <div className="p-4" style={{ borderTop: '1px solid var(--border-muted)' }}>
        <div
          className="rounded-xl p-3"
          style={{
            background: (alertSummary?.bySeverity.critical ?? 0) > 0
              ? 'var(--ari-error-muted)'
              : 'var(--ari-success-muted)',
            border: `1px solid ${(alertSummary?.bySeverity.critical ?? 0) > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold"
              style={{
                background: (alertSummary?.bySeverity.critical ?? 0) > 0
                  ? 'rgba(239, 68, 68, 0.2)'
                  : 'rgba(16, 185, 129, 0.2)',
                color: (alertSummary?.bySeverity.critical ?? 0) > 0
                  ? 'var(--ari-error)'
                  : 'var(--ari-success)',
              }}
            >
              {(alertSummary?.bySeverity.critical ?? 0) > 0 ? '!' : '✓'}
            </div>
            <div>
              <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Security</div>
              <div
                className="text-[10px] font-medium"
                style={{
                  color: (alertSummary?.bySeverity.critical ?? 0) > 0
                    ? 'var(--ari-error)'
                    : 'var(--ari-success)',
                }}
              >
                {(alertSummary?.bySeverity.critical ?? 0) > 0
                  ? `${alertSummary?.bySeverity.critical} critical alerts`
                  : 'All systems nominal'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4" style={{ borderTop: '1px solid var(--border-muted)' }}>
        <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--text-disabled)' }}>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${getWsStatusColor()}`} />
            <span className="font-mono">
              {wsStatus === 'connected' ? 'Live' : wsStatus === 'reconnecting' ? 'Reconnecting...' : 'Offline'}
            </span>
          </div>
          <span className="font-mono">127.0.0.1:3141</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10px]" style={{ color: 'var(--text-disabled)' }}>
          <span className="font-mono" style={{ color: 'var(--ari-purple-400)' }}>v3.0.0</span>
          <span className="flex items-center gap-1">
            <kbd
              className="px-1.5 py-0.5 rounded text-[9px] font-mono"
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-muted)',
              }}
            >
              ⌘K
            </kbd>
            <span>search</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
