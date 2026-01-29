import { useQuery } from '@tanstack/react-query';
import { useDetailedHealth } from '../hooks/useHealth';
import { getAgents, verifyAuditChain } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState } from '../components/ui/ErrorState';
import { StatusCardSkeleton } from '../components/ui/Skeleton';

// Trust level configuration matching ARI's 6-tier system
const TRUST_LEVELS = [
  { level: 'SYSTEM', multiplier: '0.5x', color: 'text-purple-400', bg: 'bg-purple-900/20' },
  { level: 'OPERATOR', multiplier: '0.6x', color: 'text-blue-400', bg: 'bg-blue-900/20' },
  { level: 'VERIFIED', multiplier: '0.75x', color: 'text-cyan-400', bg: 'bg-cyan-900/20' },
  { level: 'STANDARD', multiplier: '1.0x', color: 'text-gray-400', bg: 'bg-gray-800/50' },
  { level: 'UNTRUSTED', multiplier: '1.5x', color: 'text-amber-400', bg: 'bg-amber-900/20' },
  { level: 'HOSTILE', multiplier: '2.0x', color: 'text-red-400', bg: 'bg-red-900/20' },
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
      <div className="min-h-screen bg-gray-950 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">System Overview</h1>
          <p className="mt-1 text-sm text-gray-500">Loading system status...</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <StatusCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (healthError) {
    return (
      <div className="min-h-screen bg-gray-950 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">System Overview</h1>
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
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 px-8 py-6 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">System Overview</h1>
            <p className="mt-1 text-sm text-gray-500">
              Real-time health monitoring and system status
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-gray-500">Audit Chain</div>
              <div className={`text-sm font-mono ${auditVerification?.valid ? 'text-emerald-400' : 'text-red-400'}`}>
                {auditVerification?.valid ? '✓ VERIFIED' : '✗ INVALID'}
              </div>
            </div>
            <div className="h-8 w-px bg-gray-800" />
            <div className="text-right">
              <div className="text-xs text-gray-500">Gateway</div>
              <div className="text-sm font-mono text-emerald-400">127.0.0.1:3141</div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-8">
        {/* Main Status Grid */}
        {health && (
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Gateway Status */}
            <div className="card-hover rounded-xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-950 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Gateway
                  </h3>
                  <div className="mt-2">
                    <StatusBadge status={health.gateway.status} size="md" />
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-900/20 text-emerald-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                  </svg>
                </div>
              </div>
              <div className="mt-4 space-y-2 border-t border-gray-800 pt-4 font-mono text-xs text-gray-400">
                <div className="flex justify-between">
                  <span>Host</span>
                  <span className="text-gray-300">{health.gateway.host}</span>
                </div>
                <div className="flex justify-between">
                  <span>Port</span>
                  <span className="text-gray-300">{health.gateway.port}</span>
                </div>
                <div className="flex justify-between">
                  <span>Connections</span>
                  <span className="text-emerald-400">{health.gateway.connections}</span>
                </div>
              </div>
            </div>

            {/* Event Bus Status */}
            <div className="card-hover rounded-xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-950 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Event Bus
                  </h3>
                  <div className="mt-2">
                    <StatusBadge status={health.eventBus.status} size="md" />
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-900/20 text-blue-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
              <div className="mt-4 space-y-2 border-t border-gray-800 pt-4 font-mono text-xs text-gray-400">
                <div className="flex justify-between">
                  <span>Events Processed</span>
                  <span className="text-blue-400">{health.eventBus.eventCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Subscribers</span>
                  <span className="text-gray-300">{health.eventBus.subscribers}</span>
                </div>
              </div>
            </div>

            {/* Audit Log Status */}
            <div className="card-hover rounded-xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-950 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Audit Log
                  </h3>
                  <div className="mt-2">
                    <StatusBadge status={health.audit.status} size="md" />
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-900/20 text-purple-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div className="mt-4 space-y-2 border-t border-gray-800 pt-4 font-mono text-xs text-gray-400">
                <div className="flex justify-between">
                  <span>Entries</span>
                  <span className="text-purple-400">{health.audit.entryCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Hash Chain</span>
                  <span className={health.audit.chainValid ? 'text-emerald-400' : 'text-red-400'}>
                    {health.audit.chainValid ? 'Valid' : 'Invalid'}
                  </span>
                </div>
              </div>
            </div>

            {/* Sanitizer Status */}
            <div className="card-hover rounded-xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-950 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Sanitizer
                  </h3>
                  <div className="mt-2">
                    <StatusBadge status={health.sanitizer.status} size="md" />
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-900/20 text-amber-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>
              <div className="mt-4 space-y-2 border-t border-gray-800 pt-4 font-mono text-xs text-gray-400">
                <div className="flex justify-between">
                  <span>Injection Patterns</span>
                  <span className="text-amber-400">{health.sanitizer.patternsLoaded}</span>
                </div>
                <div className="flex justify-between">
                  <span>Categories</span>
                  <span className="text-gray-300">6</span>
                </div>
              </div>
            </div>

            {/* Agents Status */}
            <div className="card-hover rounded-xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-950 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Agents
                  </h3>
                  <div className="mt-2">
                    <StatusBadge status={health.agents.status} size="md" />
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-900/20 text-cyan-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
              <div className="mt-4 space-y-2 border-t border-gray-800 pt-4 font-mono text-xs text-gray-400">
                <div className="flex justify-between">
                  <span>Active</span>
                  <span className="text-cyan-400">{health.agents.activeCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total</span>
                  <span className="text-gray-300">{Object.keys(health.agents.agents).length}</span>
                </div>
              </div>
            </div>

            {/* Governance Status */}
            <div className="card-hover rounded-xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-950 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Governance
                  </h3>
                  <div className="mt-2">
                    <StatusBadge status={health.governance.status} size="md" />
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-900/20 text-indigo-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                  </svg>
                </div>
              </div>
              <div className="mt-4 space-y-2 border-t border-gray-800 pt-4 font-mono text-xs text-gray-400">
                <div className="flex justify-between">
                  <span>Active Votes</span>
                  <span className="text-indigo-400">{health.governance.activeVotes}</span>
                </div>
                <div className="flex justify-between">
                  <span>Council Members</span>
                  <span className="text-gray-300">{health.governance.councilMembers}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Active Agents */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
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
                    className={`agent-card flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950/50 p-4 ${agent.status}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${
                        agent.status === 'active' ? 'bg-emerald-400 status-dot-healthy' :
                        agent.status === 'idle' ? 'bg-amber-400' : 'bg-red-400'
                      }`} />
                      <div>
                        <div className="font-mono text-sm text-white">{agent.type}</div>
                        <div className="text-xs text-gray-500">ID: {agent.id.slice(0, 8)}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm text-emerald-400">{agent.tasksCompleted}</div>
                      <div className="text-xs text-gray-500">tasks</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-800 p-8 text-center">
                <div className="text-sm text-gray-500">No agents active</div>
                <div className="mt-1 text-xs text-gray-600">Agents will appear here when running</div>
              </div>
            )}
          </div>

          {/* Trust Levels */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
              Trust Levels
            </h2>
            <div className="space-y-2">
              {TRUST_LEVELS.map((trust) => (
                <div
                  key={trust.level}
                  className={`flex items-center justify-between rounded-lg ${trust.bg} px-4 py-3`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`text-sm font-mono font-medium ${trust.color}`}>
                      {trust.level}
                    </div>
                  </div>
                  <div className={`font-mono text-xs ${trust.color}`}>
                    {trust.multiplier} risk
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Philosophy Section */}
        <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Core Philosophy
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {PHILOSOPHY.map((pillar) => (
              <div
                key={pillar.name}
                className="rounded-lg border border-gray-800 bg-gray-950/50 p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg text-purple-400">{pillar.icon}</span>
                  <div>
                    <div className="text-sm font-medium text-white">{pillar.name}</div>
                    <div className="text-xs text-gray-500">{pillar.source}</div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-400">{pillar.description}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Security Invariants */}
        <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Security Invariants
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 rounded-lg bg-emerald-900/10 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-emerald-900/30 text-emerald-400">
                ✓
              </div>
              <div>
                <div className="text-xs font-medium text-emerald-400">Loopback Only</div>
                <div className="text-[10px] text-gray-500">127.0.0.1 enforced</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-emerald-900/10 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-emerald-900/30 text-emerald-400">
                ✓
              </div>
              <div>
                <div className="text-xs font-medium text-emerald-400">Content ≠ Command</div>
                <div className="text-[10px] text-gray-500">Input is data only</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-emerald-900/10 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-emerald-900/30 text-emerald-400">
                ✓
              </div>
              <div>
                <div className="text-xs font-medium text-emerald-400">Hash Chain Audit</div>
                <div className="text-[10px] text-gray-500">SHA-256 linked</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-emerald-900/10 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-emerald-900/30 text-emerald-400">
                ✓
              </div>
              <div>
                <div className="text-xs font-medium text-emerald-400">Least Privilege</div>
                <div className="text-[10px] text-gray-500">3-layer checks</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
