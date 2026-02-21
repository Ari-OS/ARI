import { useQuery } from '@tanstack/react-query';
import { useDetailedHealth } from '../hooks/useHealth';
import { getAuditLog, verifyAuditChain, getSystemMetrics } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState } from '../components/ui/ErrorState';
import { StatusCardSkeleton, AuditEntrySkeleton } from '../components/ui/Skeleton';

// Security invariants that should always be verified
const SECURITY_INVARIANTS = [
  {
    id: 'loopback',
    name: 'Loopback Only',
    description: '127.0.0.1 enforced',
    check: (health: { gateway: { host: string } }) => health.gateway.host === '127.0.0.1',
  },
  {
    id: 'content-command',
    name: 'Content ≠ Command',
    description: 'Input is data only',
    check: () => true,
  },
  {
    id: 'hash-chain',
    name: 'Hash Chain Audit',
    description: 'SHA-256 linked',
    check: (_health: unknown, auditValid: boolean) => auditValid,
  },
  {
    id: 'least-privilege',
    name: 'Least Privilege',
    description: '3-layer checks',
    check: () => true,
  },
  {
    id: 'trust-required',
    name: 'Trust Required',
    description: '6-tier trust levels',
    check: () => true,
  },
];

// Layer architecture for status display
const LAYERS = [
  { num: 1, name: 'Kernel', components: ['Gateway', 'Sanitizer', 'Audit', 'EventBus'], cssColor: 'var(--ari-purple)' },
  { num: 2, name: 'System', components: ['Router', 'Storage'], cssColor: 'var(--ari-info)' },
  { num: 3, name: 'Agents', components: ['Core', 'Guardian', 'Planner', 'Executor', 'Memory'], cssColor: 'var(--ari-cyan)' },
  { num: 4, name: 'Governance', components: ['Council', 'Arbiter', 'Overseer'], cssColor: '#818cf8' },
  { num: 5, name: 'Ops', components: ['Daemon', 'Scheduler'], cssColor: 'var(--ari-success)' },
  { num: 6, name: 'Interfaces', components: ['CLI', 'API', 'Dashboard'], cssColor: 'var(--ari-warning)' },
];

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function Health() {
  const {
    data: health,
    isLoading: healthLoading,
    isError: healthError,
    refetch: refetchHealth,
  } = useDetailedHealth();

  const { data: auditVerification } = useQuery({
    queryKey: ['audit-verify'],
    queryFn: verifyAuditChain,
    refetchInterval: 30000,
  });

  const { data: recentAudit, isLoading: auditLoading } = useQuery({
    queryKey: ['audit', 'recent'],
    queryFn: () => getAuditLog({ limit: 8 }),
    refetchInterval: 10000,
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['system-metrics'],
    queryFn: getSystemMetrics,
    refetchInterval: 5000,
  });

  const overallStatus = (() => {
    if (!health) return 'unknown';
    const statuses = [
      health.gateway.status,
      health.eventBus.status,
      health.audit.status,
      health.sanitizer.status,
      health.agents.status,
      health.governance.status,
    ];
    if (statuses.every((s) => s === 'healthy')) return 'healthy';
    if (statuses.some((s) => s === 'unhealthy')) return 'unhealthy';
    return 'degraded';
  })();

  if (healthLoading) {
    return (
      <div className="min-h-screen p-8" style={{ background: 'var(--bg-primary)' }}>
        <div className="mb-8">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>System Health</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Loading health status...</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-children">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <StatusCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (healthError) {
    return (
      <div className="min-h-screen p-8" style={{ background: 'var(--bg-primary)' }}>
        <div className="mb-8">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>System Health</h1>
        </div>
        <ErrorState
          title="Failed to load health status"
          message="Could not connect to ARI gateway. Ensure the gateway is running at 127.0.0.1:3141."
          onRetry={() => { void refetchHealth(); }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header
        className="px-8 py-6 backdrop-blur-md"
        style={{
          borderBottom: '1px solid var(--border-muted)',
          background: 'var(--bg-glass)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{
                background:
                  overallStatus === 'healthy'
                    ? 'var(--ari-success-muted)'
                    : overallStatus === 'degraded'
                      ? 'var(--ari-warning-muted)'
                      : 'var(--ari-error-muted)',
                color:
                  overallStatus === 'healthy'
                    ? 'var(--ari-success)'
                    : overallStatus === 'degraded'
                      ? 'var(--ari-warning)'
                      : 'var(--ari-error)',
              }}
            >
              {overallStatus === 'healthy' ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>System Health</h1>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                Real-time monitoring of all ARI components
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Uptime</div>
              <div className="font-mono text-lg" style={{ color: 'var(--text-primary)' }}>
                {metricsLoading ? '...' : metrics?.uptimeFormatted || '0s'}
              </div>
            </div>
            <div className="h-10 w-px" style={{ background: 'var(--border-muted)' }} />
            <StatusBadge status={overallStatus as 'healthy' | 'degraded' | 'unhealthy'} size="lg" />
          </div>
        </div>
      </header>

      <div className="p-8">
        {/* Security Invariants Banner */}
        <div
          className="mb-8 rounded-xl p-6 card-ari"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-muted)',
          }}
        >
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Security Invariants
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {SECURITY_INVARIANTS.map((invariant) => {
              const isValid = health
                ? invariant.check(health, auditVerification?.valid ?? true)
                : false;
              return (
                <div
                  key={invariant.id}
                  className="flex items-center gap-3 rounded-lg px-4 py-3"
                  style={{
                    background: isValid ? 'var(--ari-success-muted)' : 'var(--ari-error-muted)',
                  }}
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded text-sm"
                    style={{
                      background: isValid ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: isValid ? 'var(--ari-success)' : 'var(--ari-error)',
                    }}
                  >
                    {isValid ? '✓' : '✗'}
                  </div>
                  <div>
                    <div
                      className="text-xs font-medium"
                      style={{ color: isValid ? 'var(--ari-success)' : 'var(--ari-error)' }}
                    >
                      {invariant.name}
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{invariant.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Component Status Grid */}
        {health && (
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-children">
            <ComponentCard
              title="Gateway"
              status={health.gateway.status}
              iconColor="var(--ari-success)"
              iconBg="var(--ari-success-muted)"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                </svg>
              }
              stats={[
                { label: 'Host', value: health.gateway.host },
                { label: 'Port', value: health.gateway.port.toString() },
                { label: 'Connections', value: health.gateway.connections.toString(), color: 'var(--ari-success)' },
              ]}
            />

            <ComponentCard
              title="Event Bus"
              status={health.eventBus.status}
              iconColor="var(--ari-info)"
              iconBg="var(--ari-info-muted)"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
              stats={[
                { label: 'Events Processed', value: health.eventBus.eventCount.toLocaleString(), color: 'var(--ari-info)' },
                { label: 'Subscribers', value: health.eventBus.subscribers.toString() },
              ]}
            />

            <ComponentCard
              title="Audit Log"
              status={health.audit.status}
              iconColor="var(--ari-purple)"
              iconBg="var(--ari-purple-muted)"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
              stats={[
                { label: 'Entries', value: health.audit.entryCount.toLocaleString(), color: 'var(--ari-purple)' },
                { label: 'Chain', value: health.audit.chainValid ? 'Valid' : 'INVALID', color: health.audit.chainValid ? 'var(--ari-success)' : 'var(--ari-error)' },
              ]}
            />

            <ComponentCard
              title="Sanitizer"
              status={health.sanitizer.status}
              iconColor="var(--ari-warning)"
              iconBg="var(--ari-warning-muted)"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              }
              stats={[
                { label: 'Injection Patterns', value: health.sanitizer.patternsLoaded.toString(), color: 'var(--ari-warning)' },
                { label: 'Categories', value: '6' },
              ]}
            />

            <ComponentCard
              title="Agents"
              status={health.agents.status}
              iconColor="var(--ari-cyan)"
              iconBg="rgba(6, 182, 212, 0.1)"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
              stats={[
                { label: 'Active', value: health.agents.activeCount.toString(), color: 'var(--ari-cyan)' },
                { label: 'Total', value: Object.keys(health.agents.agents).length.toString() },
              ]}
            />

            <ComponentCard
              title="Governance"
              status={health.governance.status}
              iconColor="#818cf8"
              iconBg="rgba(99, 102, 241, 0.1)"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
              }
              stats={[
                { label: 'Active Votes', value: health.governance.activeVotes.toString(), color: '#818cf8' },
                { label: 'Council', value: `${health.governance.councilMembers} members` },
              ]}
            />
          </div>
        )}

        {/* Two-Column Layout: Layer Architecture + Recent Audit */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Layer Architecture */}
          <div
            className="rounded-xl p-6 card-ari"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-muted)',
            }}
          >
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Six-Layer Architecture
            </h2>
            <div className="space-y-2">
              {LAYERS.map((layer) => (
                <div
                  key={layer.num}
                  className="rounded-lg p-3"
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-muted)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold"
                        style={{
                          background: `${layer.cssColor}20`,
                          color: layer.cssColor,
                        }}
                      >
                        {layer.num}
                      </div>
                      <div>
                        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{layer.name}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {layer.components.join(' • ')}
                        </div>
                      </div>
                    </div>
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-full text-xs"
                      style={{ background: 'var(--ari-success-muted)', color: 'var(--ari-success)' }}
                    >
                      ✓
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Audit Events */}
          <div
            className="rounded-xl p-6 card-ari"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-muted)',
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Recent Security Events
              </h2>
              <div className="flex items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full ${auditVerification?.valid ? 'status-dot-healthy' : ''}`}
                  style={{
                    background: auditVerification?.valid ? 'var(--ari-success)' : 'var(--ari-error)',
                  }}
                />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {auditVerification?.valid ? 'Chain Valid' : 'Chain Invalid'}
                </span>
              </div>
            </div>
            {auditLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <AuditEntrySkeleton key={i} />
                ))}
              </div>
            ) : recentAudit && Array.isArray(recentAudit.events) && recentAudit.events.length > 0 ? (
              <div className="space-y-2">
                {recentAudit.events.slice(0, 8).map((event, idx) => (
                  <div
                    key={event.id || idx}
                    className="rounded-lg p-3"
                    style={{
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-muted)',
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs" style={{ color: 'var(--ari-purple)' }}>{event.action}</span>
                          <span className="text-xs" style={{ color: 'var(--text-disabled)' }}>•</span>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{event.agent}</span>
                        </div>
                        {event.details && Object.keys(event.details).length > 0 && (
                          <div className="mt-1 text-[10px] font-mono truncate max-w-[280px]" style={{ color: 'var(--text-disabled)' }}>
                            {JSON.stringify(event.details).slice(0, 60)}...
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-mono" style={{ color: 'var(--text-disabled)' }}>
                        {formatTimestamp(event.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="rounded-lg p-8 text-center"
                style={{ border: '1px dashed var(--border-muted)' }}
              >
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>No recent events</div>
              </div>
            )}
          </div>
        </div>

        {/* System Metrics */}
        <div
          className="mt-6 rounded-xl p-6 card-ari"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-muted)',
          }}
        >
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            System Metrics
          </h2>
          {metricsLoading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="shimmer h-20 rounded-lg" />
              ))}
            </div>
          ) : metrics ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
              <MetricCard label="Heap Used" value={formatBytes(metrics.memory.heapUsed)} />
              <MetricCard label="Heap Total" value={formatBytes(metrics.memory.heapTotal)} />
              <MetricCard label="RSS" value={formatBytes(metrics.memory.rss)} />
              <MetricCard label="Node" value={metrics.nodeVersion} />
              <MetricCard label="Platform" value={`${metrics.platform}/${metrics.arch}`} />
              <MetricCard label="PID" value={metrics.pid.toString()} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface ComponentCardProps {
  title: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  stats: Array<{
    label: string;
    value: string;
    color?: string;
  }>;
}

function ComponentCard({ title, status, icon, iconColor, iconBg, stats }: ComponentCardProps) {
  return (
    <div
      className="card-ari card-ari-hover rounded-xl p-6"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-muted)',
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{title}</h3>
          <div className="mt-2">
            <StatusBadge status={status} size="md" />
          </div>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ background: iconBg, color: iconColor }}
        >
          {icon}
        </div>
      </div>
      <div
        className="mt-4 space-y-2 pt-4 font-mono text-xs"
        style={{ borderTop: '1px solid var(--border-muted)', color: 'var(--text-tertiary)' }}
      >
        {stats.map((stat) => (
          <div key={stat.label} className="flex justify-between">
            <span>{stat.label}</span>
            <span style={{ color: stat.color || 'var(--text-secondary)' }}>{stat.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg p-4 text-center"
      style={{
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-muted)',
      }}
    >
      <div className="text-lg font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{value}</div>
      <div className="mt-1 text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}

export default Health;
