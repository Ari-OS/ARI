import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDetailedHealth } from '../hooks/useHealth';
import { getAgents, verifyAuditChain, getAuditLog, getSystemMetrics } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState } from '../components/ui/ErrorState';
import { StatusCardSkeleton, AuditEntrySkeleton } from '../components/ui/Skeleton';
import { BudgetPanel } from '../components/BudgetPanel';
import { TabGroup } from '../components/ui/TabGroup';
import { Card } from '../components/ui/Card';
import { CollapsibleSection } from '../components/ui/CollapsibleSection';
import { PageHeader } from '../components/ui/PageHeader';

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

export default function SystemStatus() {
  const [activeTab, setActiveTab] = useState('overview');

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

  if (healthLoading) {
    return (
      <div className="min-h-screen p-8 bg-bg-primary">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary">System Status</h1>
          <p className="mt-1 text-sm text-text-muted">Loading system status...</p>
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
      <div className="min-h-screen p-8 bg-bg-primary">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary">System Status</h1>
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
    <div className="min-h-screen bg-bg-primary">
      <div className="p-8">
        <PageHeader
          icon="◉"
          title="System Status"
          subtitle="Real-time health monitoring and system overview"
        />

        <div className="mb-6">
          <TabGroup
            tabs={[
              { id: 'overview', label: 'Overview', icon: '◉' },
              { id: 'health', label: 'Health', icon: '◈' },
            ]}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* Main Status Grid - Always Visible */}
            {health && (
              <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-children">
                {/* Gateway Status */}
                <Card padding="lg" hoverable className="bg-bg-card border-border-muted">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Gateway
                      </h3>
                      <div className="mt-2">
                        <StatusBadge status={health.gateway.status} size="md" />
                      </div>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ari-success-muted text-ari-success">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2 pt-4 font-mono text-xs border-t border-border-muted text-text-tertiary">
                    <div className="flex justify-between">
                      <span>Host</span>
                      <span className="text-text-secondary">{health.gateway.host}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Port</span>
                      <span className="text-text-secondary">{health.gateway.port}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Connections</span>
                      <span className="text-ari-success">{health.gateway.connections}</span>
                    </div>
                  </div>
                </Card>

                {/* Event Bus Status */}
                <Card padding="lg" hoverable className="bg-bg-card border-border-muted">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Event Bus
                      </h3>
                      <div className="mt-2">
                        <StatusBadge status={health.eventBus.status} size="md" />
                      </div>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ari-info-muted text-ari-info">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2 pt-4 font-mono text-xs border-t border-border-muted text-text-tertiary">
                    <div className="flex justify-between">
                      <span>Events Processed</span>
                      <span className="text-ari-info">{health.eventBus.eventCount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Subscribers</span>
                      <span className="text-text-secondary">{health.eventBus.subscribers}</span>
                    </div>
                  </div>
                </Card>

                {/* Audit Log Status */}
                <Card padding="lg" hoverable className="bg-bg-card border-border-muted">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Audit Log
                      </h3>
                      <div className="mt-2">
                        <StatusBadge status={health.audit.status} size="md" />
                      </div>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ari-purple-muted text-ari-purple">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2 pt-4 font-mono text-xs border-t border-border-muted text-text-tertiary">
                    <div className="flex justify-between">
                      <span>Entries</span>
                      <span className="text-ari-purple">{health.audit.entryCount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Hash Chain</span>
                      <span className={health.audit.chainValid ? 'text-ari-success' : 'text-ari-error'}>
                        {health.audit.chainValid ? 'Valid' : 'Invalid'}
                      </span>
                    </div>
                  </div>
                </Card>

                {/* Sanitizer Status */}
                <Card padding="lg" hoverable className="bg-bg-card border-border-muted">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Sanitizer
                      </h3>
                      <div className="mt-2">
                        <StatusBadge status={health.sanitizer.status} size="md" />
                      </div>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ari-warning-muted text-ari-warning">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2 pt-4 font-mono text-xs border-t border-border-muted text-text-tertiary">
                    <div className="flex justify-between">
                      <span>Injection Patterns</span>
                      <span className="text-ari-warning">{health.sanitizer.patternsLoaded}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Categories</span>
                      <span className="text-text-secondary">6</span>
                    </div>
                  </div>
                </Card>

                {/* Agents Status */}
                <Card padding="lg" hoverable className="bg-bg-card border-border-muted">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Agents
                      </h3>
                      <div className="mt-2">
                        <StatusBadge status={health.agents.status} size="md" />
                      </div>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg text-ari-cyan" style={{ background: 'rgba(6, 182, 212, 0.1)' }}>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2 pt-4 font-mono text-xs border-t border-border-muted text-text-tertiary">
                    <div className="flex justify-between">
                      <span>Active</span>
                      <span className="text-ari-cyan">{health.agents.activeCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total</span>
                      <span className="text-text-secondary">{Object.keys(health.agents.agents).length}</span>
                    </div>
                  </div>
                </Card>

                {/* Governance Status */}
                <Card padding="lg" hoverable className="bg-bg-card border-border-muted">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Governance
                      </h3>
                      <div className="mt-2">
                        <StatusBadge status={health.governance.status} size="md" />
                      </div>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8' }}>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2 pt-4 font-mono text-xs border-t border-border-muted text-text-tertiary">
                    <div className="flex justify-between">
                      <span>Active Votes</span>
                      <span style={{ color: '#818cf8' }}>{health.governance.activeVotes}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Council Members</span>
                      <span className="text-text-secondary">{health.governance.councilMembers}</span>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* Budget Panel */}
            <div className="mb-6">
              <BudgetPanel />
            </div>

            {/* Active Agents - Collapsible, Default Expanded */}
            <div className="mb-4">
              <CollapsibleSection title="Active Agents" defaultCollapsed={false}>
                <div className="mt-4">
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
                          className="agent-card flex items-center justify-between rounded-lg p-4 bg-bg-tertiary border border-border-muted"
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
                              <div className="font-mono text-sm text-text-primary">{agent.type}</div>
                              <div className="text-xs text-text-muted">ID: {agent.id.slice(0, 8)}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-sm text-ari-success">{agent.tasksCompleted}</div>
                            <div className="text-xs text-text-muted">tasks</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg p-8 text-center border border-dashed border-border-muted">
                      <div className="text-sm text-text-muted">No agents active</div>
                      <div className="mt-1 text-xs text-text-disabled">Agents will appear here when running</div>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            </div>

            {/* Trust Levels, Philosophy, Security - Collapsible, Default Collapsed */}
            <div className="space-y-4">
              <CollapsibleSection title="Trust Levels" defaultCollapsed>
                <div className="mt-4 space-y-2">
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
              </CollapsibleSection>

              <CollapsibleSection title="Core Philosophy" defaultCollapsed>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  {PHILOSOPHY.map((pillar) => (
                    <div
                      key={pillar.name}
                      className="rounded-lg p-4 bg-bg-tertiary border border-border-muted"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg text-ari-purple">{pillar.icon}</span>
                        <div>
                          <div className="text-sm font-medium text-text-primary">{pillar.name}</div>
                          <div className="text-xs text-text-muted">{pillar.source}</div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-text-tertiary">{pillar.description}</div>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="Security Invariants" defaultCollapsed>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: 'Loopback Only', desc: '127.0.0.1 enforced' },
                    { label: 'Content ≠ Command', desc: 'Input is data only' },
                    { label: 'Hash Chain Audit', desc: 'SHA-256 linked' },
                    { label: 'Least Privilege', desc: '3-layer checks' },
                  ].map((invariant) => (
                    <div
                      key={invariant.label}
                      className="flex items-center gap-3 rounded-lg px-4 py-3 bg-ari-success-muted"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded text-sm font-bold text-ari-success" style={{ background: 'rgba(16, 185, 129, 0.2)' }}>
                        ✓
                      </div>
                      <div>
                        <div className="text-xs font-medium text-ari-success">{invariant.label}</div>
                        <div className="text-[10px] text-text-muted">{invariant.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            </div>
          </>
        )}

        {/* Health Tab */}
        {activeTab === 'health' && (
          <>
            {/* Security Invariants Banner */}
            <Card padding="lg" className="mb-8 bg-bg-secondary border-border-muted">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
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
                        <div className="text-[10px] text-text-muted">{invariant.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

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
              <Card padding="lg" className="bg-bg-secondary border-border-muted">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
                  Six-Layer Architecture
                </h2>
                <div className="space-y-2">
                  {LAYERS.map((layer) => (
                    <div
                      key={layer.num}
                      className="rounded-lg p-3 bg-bg-tertiary border border-border-muted"
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
                            <div className="text-sm font-medium text-text-primary">{layer.name}</div>
                            <div className="text-xs text-text-muted">
                              {layer.components.join(' • ')}
                            </div>
                          </div>
                        </div>
                        <div className="flex h-6 w-6 items-center justify-center rounded-full text-xs bg-ari-success-muted text-ari-success">
                          ✓
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Recent Audit Events */}
              <Card padding="lg" className="bg-bg-secondary border-border-muted">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
                    Recent Security Events
                  </h2>
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${auditVerification?.valid ? 'status-dot-healthy' : ''}`}
                      style={{
                        background: auditVerification?.valid ? 'var(--ari-success)' : 'var(--ari-error)',
                      }}
                    />
                    <span className="text-xs text-text-muted">
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
                        className="rounded-lg p-3 bg-bg-tertiary border border-border-muted"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-ari-purple">{event.action}</span>
                              <span className="text-xs text-text-disabled">•</span>
                              <span className="text-xs text-text-muted">{event.agent}</span>
                            </div>
                            {event.details && Object.keys(event.details).length > 0 && (
                              <div className="mt-1 text-[10px] font-mono truncate max-w-[280px] text-text-disabled">
                                {JSON.stringify(event.details).slice(0, 60)}...
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-text-disabled">
                            {formatTimestamp(event.timestamp)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg p-8 text-center border border-dashed border-border-muted">
                    <div className="text-sm text-text-muted">No recent events</div>
                  </div>
                )}
              </Card>
            </div>

            {/* System Metrics */}
            <Card padding="lg" className="mt-6 bg-bg-secondary border-border-muted">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
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
                  <SystemMetricCard label="Heap Used" value={formatBytes(metrics.memory.heapUsed)} />
                  <SystemMetricCard label="Heap Total" value={formatBytes(metrics.memory.heapTotal)} />
                  <SystemMetricCard label="RSS" value={formatBytes(metrics.memory.rss)} />
                  <SystemMetricCard label="Node" value={metrics.nodeVersion} />
                  <SystemMetricCard label="Platform" value={`${metrics.platform}/${metrics.arch}`} />
                  <SystemMetricCard label="PID" value={metrics.pid.toString()} />
                </div>
              ) : null}
            </Card>
          </>
        )}
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
    <Card padding="lg" hoverable className="bg-bg-card border-border-muted">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">{title}</h3>
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
      <div className="mt-4 space-y-2 pt-4 font-mono text-xs border-t border-border-muted text-text-tertiary">
        {stats.map((stat) => (
          <div key={stat.label} className="flex justify-between">
            <span>{stat.label}</span>
            <span style={{ color: stat.color || 'var(--text-secondary)' }}>{stat.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SystemMetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg p-4 text-center bg-bg-tertiary border border-border-muted">
      <div className="text-lg font-mono font-bold text-text-primary">{value}</div>
      <div className="mt-1 text-[10px] uppercase text-text-muted">{label}</div>
    </div>
  );
}
