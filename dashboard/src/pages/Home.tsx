import { useQuery } from '@tanstack/react-query';
import { useDetailedHealth } from '../hooks/useHealth';
import { getAgents, verifyAuditChain } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState } from '../components/ui/ErrorState';
import { StatusCardSkeleton } from '../components/ui/Skeleton';

// Trust level configuration matching ARI's 6-tier system
const TRUST_LEVELS = [
  { level: 'SYSTEM', multiplier: '0.5x', cssColor: 'var(--ari-purple)', bgColor: 'var(--ari-purple-muted)' },
  { level: 'OPERATOR', multiplier: '0.6x', cssColor: 'var(--ari-info)', bgColor: 'var(--ari-info-muted)' },
  { level: 'VERIFIED', multiplier: '0.75x', cssColor: 'var(--ari-cyan)', bgColor: 'rgba(6, 182, 212, 0.1)' },
  { level: 'STANDARD', multiplier: '1.0x', cssColor: 'var(--text-secondary)', bgColor: 'var(--bg-tertiary)' },
  { level: 'UNTRUSTED', multiplier: '1.5x', cssColor: 'var(--ari-warning)', bgColor: 'var(--ari-warning-muted)' },
  { level: 'HOSTILE', multiplier: '2.0x', cssColor: 'var(--ari-error)', bgColor: 'var(--ari-error-muted)' },
];

// Philosophy pillars from the audit
const PHILOSOPHY = [
  { name: 'Shadow Integration', source: 'Jung', icon: '◐', description: 'Detect, log, integrate' },
  { name: 'Radical Transparency', source: 'Dalio', icon: '◉', description: 'All actions audited' },
  { name: 'Ruthless Simplicity', source: 'Musashi', icon: '◇', description: 'One clear job each' },
];

export function Home() {
  const { data: health, isLoading: healthLoading, isError: healthError, refetch: refetchHealth } = useDetailedHealth();
  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: getAgents,
    refetchInterval: 10000,
  });
  const { data: auditVerification } = useQuery({
    queryKey: ['audit-verify'],
    queryFn: verifyAuditChain,
    refetchInterval: 30000,
  });

  if (healthLoading) {
    return (
      <div className="min-h-screen p-8" style={{ background: 'var(--bg-primary)' }}>
        <div className="mb-8">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>System Overview</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Loading system status...</p>
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
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>System Overview</h1>
        </div>
        <ErrorState
          title="Failed to load system status"
          message="Could not connect to ARI gateway at 127.0.0.1:3141. Ensure the gateway is running."
          onRetry={() => refetchHealth()}
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
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>System Overview</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              Real-time health monitoring and system status
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Audit Chain</div>
              <div
                className="text-sm font-mono"
                style={{ color: auditVerification?.valid ? 'var(--ari-success)' : 'var(--ari-error)' }}
              >
                {auditVerification?.valid ? '✓ VERIFIED' : '✗ INVALID'}
              </div>
            </div>
            <div className="h-8 w-px" style={{ background: 'var(--border-muted)' }} />
            <div className="text-right">
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Gateway</div>
              <div className="text-sm font-mono" style={{ color: 'var(--ari-success)' }}>127.0.0.1:3141</div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-8">
        {/* Main Status Grid */}
        {health && (
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-children">
            {/* Gateway Status */}
            <div
              className="card-ari card-ari-hover rounded-xl p-6"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-muted)',
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Gateway
                  </h3>
                  <div className="mt-2">
                    <StatusBadge status={health.gateway.status} size="md" />
                  </div>
                </div>
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ background: 'var(--ari-success-muted)', color: 'var(--ari-success)' }}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                  </svg>
                </div>
              </div>
              <div
                className="mt-4 space-y-2 pt-4 font-mono text-xs"
                style={{ borderTop: '1px solid var(--border-muted)', color: 'var(--text-tertiary)' }}
              >
                <div className="flex justify-between">
                  <span>Host</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{health.gateway.host}</span>
                </div>
                <div className="flex justify-between">
                  <span>Port</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{health.gateway.port}</span>
                </div>
                <div className="flex justify-between">
                  <span>Connections</span>
                  <span style={{ color: 'var(--ari-success)' }}>{health.gateway.connections}</span>
                </div>
              </div>
            </div>

            {/* Event Bus Status */}
            <div
              className="card-ari card-ari-hover rounded-xl p-6"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-muted)',
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Event Bus
                  </h3>
                  <div className="mt-2">
                    <StatusBadge status={health.eventBus.status} size="md" />
                  </div>
                </div>
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ background: 'var(--ari-info-muted)', color: 'var(--ari-info)' }}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
              <div
                className="mt-4 space-y-2 pt-4 font-mono text-xs"
                style={{ borderTop: '1px solid var(--border-muted)', color: 'var(--text-tertiary)' }}
              >
                <div className="flex justify-between">
                  <span>Events Processed</span>
                  <span style={{ color: 'var(--ari-info)' }}>{health.eventBus.eventCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Subscribers</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{health.eventBus.subscribers}</span>
                </div>
              </div>
            </div>

            {/* Audit Log Status */}
            <div
              className="card-ari card-ari-hover rounded-xl p-6"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-muted)',
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Audit Log
                  </h3>
                  <div className="mt-2">
                    <StatusBadge status={health.audit.status} size="md" />
                  </div>
                </div>
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ background: 'var(--ari-purple-muted)', color: 'var(--ari-purple)' }}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div
                className="mt-4 space-y-2 pt-4 font-mono text-xs"
                style={{ borderTop: '1px solid var(--border-muted)', color: 'var(--text-tertiary)' }}
              >
                <div className="flex justify-between">
                  <span>Entries</span>
                  <span style={{ color: 'var(--ari-purple)' }}>{health.audit.entryCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Hash Chain</span>
                  <span style={{ color: health.audit.chainValid ? 'var(--ari-success)' : 'var(--ari-error)' }}>
                    {health.audit.chainValid ? 'Valid' : 'Invalid'}
                  </span>
                </div>
              </div>
            </div>

            {/* Sanitizer Status */}
            <div
              className="card-ari card-ari-hover rounded-xl p-6"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-muted)',
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Sanitizer
                  </h3>
                  <div className="mt-2">
                    <StatusBadge status={health.sanitizer.status} size="md" />
                  </div>
                </div>
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ background: 'var(--ari-warning-muted)', color: 'var(--ari-warning)' }}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>
              <div
                className="mt-4 space-y-2 pt-4 font-mono text-xs"
                style={{ borderTop: '1px solid var(--border-muted)', color: 'var(--text-tertiary)' }}
              >
                <div className="flex justify-between">
                  <span>Injection Patterns</span>
                  <span style={{ color: 'var(--ari-warning)' }}>{health.sanitizer.patternsLoaded}</span>
                </div>
                <div className="flex justify-between">
                  <span>Categories</span>
                  <span style={{ color: 'var(--text-secondary)' }}>6</span>
                </div>
              </div>
            </div>

            {/* Agents Status */}
            <div
              className="card-ari card-ari-hover rounded-xl p-6"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-muted)',
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Agents
                  </h3>
                  <div className="mt-2">
                    <StatusBadge status={health.agents.status} size="md" />
                  </div>
                </div>
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ background: 'rgba(6, 182, 212, 0.1)', color: 'var(--ari-cyan)' }}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
              <div
                className="mt-4 space-y-2 pt-4 font-mono text-xs"
                style={{ borderTop: '1px solid var(--border-muted)', color: 'var(--text-tertiary)' }}
              >
                <div className="flex justify-between">
                  <span>Active</span>
                  <span style={{ color: 'var(--ari-cyan)' }}>{health.agents.activeCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{Object.keys(health.agents.agents).length}</span>
                </div>
              </div>
            </div>

            {/* Governance Status */}
            <div
              className="card-ari card-ari-hover rounded-xl p-6"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-muted)',
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Governance
                  </h3>
                  <div className="mt-2">
                    <StatusBadge status={health.governance.status} size="md" />
                  </div>
                </div>
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8' }}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                  </svg>
                </div>
              </div>
              <div
                className="mt-4 space-y-2 pt-4 font-mono text-xs"
                style={{ borderTop: '1px solid var(--border-muted)', color: 'var(--text-tertiary)' }}
              >
                <div className="flex justify-between">
                  <span>Active Votes</span>
                  <span style={{ color: '#818cf8' }}>{health.governance.activeVotes}</span>
                </div>
                <div className="flex justify-between">
                  <span>Council Members</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{health.governance.councilMembers}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Active Agents */}
          <div
            className="rounded-xl p-6 card-ari"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-muted)',
            }}
          >
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Active Agents
            </h2>
            {agentsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="shimmer h-14 rounded-lg" />
                ))}
              </div>
            ) : Array.isArray(agents) && agents.length > 0 ? (
              <div className="space-y-2">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="agent-card flex items-center justify-between rounded-lg p-4"
                    style={{
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-muted)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          agent.status === 'active' ? 'status-dot-healthy' : ''
                        }`}
                        style={{
                          background:
                            agent.status === 'active'
                              ? 'var(--ari-success)'
                              : agent.status === 'idle'
                                ? 'var(--ari-warning)'
                                : 'var(--ari-error)',
                        }}
                      />
                      <div>
                        <div className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>{agent.type}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>ID: {agent.id.slice(0, 8)}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm" style={{ color: 'var(--ari-success)' }}>{agent.tasksCompleted}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>tasks</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="rounded-lg p-8 text-center"
                style={{ border: '1px dashed var(--border-muted)' }}
              >
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>No agents active</div>
                <div className="mt-1 text-xs" style={{ color: 'var(--text-disabled)' }}>Agents will appear here when running</div>
              </div>
            )}
          </div>

          {/* Trust Levels */}
          <div
            className="rounded-xl p-6 card-ari"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-muted)',
            }}
          >
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Trust Levels
            </h2>
            <div className="space-y-2">
              {TRUST_LEVELS.map((trust) => (
                <div
                  key={trust.level}
                  className="flex items-center justify-between rounded-lg px-4 py-3"
                  style={{ background: trust.bgColor }}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-mono font-medium" style={{ color: trust.cssColor }}>
                      {trust.level}
                    </div>
                  </div>
                  <div className="font-mono text-xs" style={{ color: trust.cssColor }}>
                    {trust.multiplier} risk
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Philosophy Section */}
        <div
          className="mt-6 rounded-xl p-6 card-ari"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-muted)',
          }}
        >
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Core Philosophy
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {PHILOSOPHY.map((pillar) => (
              <div
                key={pillar.name}
                className="rounded-lg p-4"
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-muted)',
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg" style={{ color: 'var(--ari-purple)' }}>{pillar.icon}</span>
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{pillar.name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{pillar.source}</div>
                  </div>
                </div>
                <div className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>{pillar.description}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Security Invariants */}
        <div
          className="mt-6 rounded-xl p-6 card-ari"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-muted)',
          }}
        >
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Security Invariants
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Loopback Only', desc: '127.0.0.1 enforced' },
              { label: 'Content ≠ Command', desc: 'Input is data only' },
              { label: 'Hash Chain Audit', desc: 'SHA-256 linked' },
              { label: 'Least Privilege', desc: '3-layer checks' },
            ].map((invariant) => (
              <div
                key={invariant.label}
                className="flex items-center gap-3 rounded-lg px-4 py-3"
                style={{ background: 'var(--ari-success-muted)' }}
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded text-sm font-bold"
                  style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--ari-success)' }}
                >
                  ✓
                </div>
                <div>
                  <div className="text-xs font-medium" style={{ color: 'var(--ari-success)' }}>{invariant.label}</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{invariant.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
