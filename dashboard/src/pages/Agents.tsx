import { useQuery } from '@tanstack/react-query';
import { getAgents, getAgentStats } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState } from '../components/ui/ErrorState';
import { AgentCardSkeleton } from '../components/ui/Skeleton';

// 6-Agent Council Design from audit (Phase 2 design)
const AGENT_ROLES = {
  CORE: {
    name: 'Core Orchestrator',
    role: 'Strategic reasoning',
    description: 'Master orchestrator - analyzes context, coordinates agents',
    trustLevel: 'Critical',
    permissions: ['orchestrate', 'coordinate', 'delegate'],
    icon: '◉',
    cssColor: 'var(--ari-purple)',
    cssBgColor: 'var(--ari-purple-muted)',
  },
  GUARDIAN: {
    name: 'Guardian',
    role: 'Safety enforcement',
    description: 'Checks invariants, can veto unsafe actions',
    trustLevel: 'Critical',
    permissions: ['read:proposal', 'veto:action', 'halt:execution'],
    icon: '⛨',
    cssColor: 'var(--ari-error)',
    cssBgColor: 'var(--ari-error-muted)',
  },
  PLANNER: {
    name: 'Planner',
    role: 'Task decomposition',
    description: 'Breaks down goals into executable DAG steps',
    trustLevel: 'Medium',
    permissions: ['read:context', 'propose:plan', 'create:dag'],
    icon: '◇',
    cssColor: 'var(--ari-info)',
    cssBgColor: 'var(--ari-info-muted)',
  },
  EXECUTOR: {
    name: 'Executor',
    role: 'Action execution',
    description: 'Executes approved plans using tools (with permission)',
    trustLevel: 'High',
    permissions: ['execute:tools', 'read:plan'],
    icon: '⚙',
    cssColor: 'var(--ari-success)',
    cssBgColor: 'var(--ari-success-muted)',
  },
  MEMORY: {
    name: 'Memory Manager',
    role: 'Context management',
    description: 'Provenance-tracked knowledge storage and retrieval',
    trustLevel: 'Medium',
    permissions: ['read:memory', 'write:memory', 'search:memory'],
    icon: '⬢',
    cssColor: 'var(--ari-cyan)',
    cssBgColor: 'var(--ari-cyan-muted)',
  },
};

// Advisor Pattern Flow steps
const ADVISOR_FLOW = [
  { icon: '⚡', label: 'Event', sub: 'message.received', cssColor: 'var(--ari-info)', cssBg: 'var(--ari-info-muted)' },
  { icon: '◇', label: 'Planner', sub: 'proposes action', cssColor: 'var(--ari-purple)', cssBg: 'var(--ari-purple-muted)' },
  { icon: '⛨', label: 'Guardian', sub: 'safety check', cssColor: 'var(--ari-error)', cssBg: 'var(--ari-error-muted)' },
  { icon: '👤', label: 'Operator', sub: 'approves/rejects', cssColor: 'var(--ari-warning)', cssBg: 'var(--ari-warning-muted)' },
  { icon: '⚙', label: 'Executor', sub: 'executes', cssColor: 'var(--ari-success)', cssBg: 'var(--ari-success-muted)' },
  { icon: '📋', label: 'Audit', sub: 'logged', cssColor: 'var(--ari-cyan)', cssBg: 'var(--ari-cyan-muted)' },
];

export function Agents() {
  const { data: agents, isLoading, isError, refetch } = useQuery({
    queryKey: ['agents'],
    queryFn: getAgents,
    refetchInterval: 10000,
  });

  const safeAgents = Array.isArray(agents) ? agents : [];
  const activeCount = safeAgents.filter(a => a.status === 'active').length;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header
        className="px-8 py-6 backdrop-blur-sm"
        style={{
          background: 'var(--bg-glass)',
          borderBottom: '1px solid var(--border-muted)',
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Agent System
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              Multi-agent coordination with safety gates and operator control
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div
              className="rounded-xl px-4 py-2"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Active</div>
              <div className="text-lg font-bold" style={{ color: 'var(--ari-success)' }}>
                {isLoading ? '...' : activeCount}
              </div>
            </div>
            <div
              className="rounded-xl px-4 py-2"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Total</div>
              <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {Object.keys(AGENT_ROLES).length}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-8">
        {/* Agent Design Grid */}
        <div className="mb-8">
          <h2
            className="mb-4 text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Agent Council (Phase 2 Design)
          </h2>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-children">
              {[1, 2, 3, 4, 5].map((i) => (
                <AgentCardSkeleton key={i} />
              ))}
            </div>
          ) : isError ? (
            <ErrorState
              title="Failed to load agents"
              message="Could not retrieve agent status. Please try again."
              onRetry={() => refetch()}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-children">
              {Object.entries(AGENT_ROLES).map(([key, role]) => {
                const liveAgent = safeAgents.find(a => a.type === key);
                const status = liveAgent?.status || 'active';

                return (
                  <div
                    key={key}
                    className="card-ari card-ari-hover rounded-xl p-6"
                    style={{
                      background: role.cssBgColor,
                      border: `1px solid color-mix(in srgb, ${role.cssColor} 30%, transparent)`,
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
                          style={{
                            background: `color-mix(in srgb, ${role.cssColor} 20%, transparent)`,
                            color: role.cssColor,
                          }}
                        >
                          {role.icon}
                        </div>
                        <div>
                          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                            {role.name}
                          </div>
                          <div className="text-xs" style={{ color: role.cssColor }}>
                            {role.role}
                          </div>
                        </div>
                      </div>
                      <StatusBadge status={status} size="sm" />
                    </div>

                    <p className="mt-4 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                      {role.description}
                    </p>

                    <div
                      className="mt-4 pt-4"
                      style={{ borderTop: '1px solid var(--border-muted)' }}
                    >
                      <div className="mb-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                        Permissions
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.map((perm) => (
                          <span
                            key={perm}
                            className="rounded px-2 py-0.5 font-mono text-[10px]"
                            style={{
                              background: 'var(--bg-tertiary)',
                              color: 'var(--text-tertiary)',
                            }}
                          >
                            {perm}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs">
                      <span style={{ color: 'var(--text-muted)' }}>Trust Level</span>
                      <span
                        className="font-medium"
                        style={{
                          color: role.trustLevel === 'Critical'
                            ? 'var(--ari-error)'
                            : role.trustLevel === 'High'
                              ? 'var(--ari-warning)'
                              : 'var(--text-secondary)',
                        }}
                      >
                        {role.trustLevel}
                      </span>
                    </div>

                    {liveAgent && (
                      <div
                        className="mt-3 grid grid-cols-2 gap-2 pt-3 text-xs"
                        style={{ borderTop: '1px solid var(--border-muted)' }}
                      >
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Completed</span>
                          <div className="font-mono" style={{ color: 'var(--ari-success)' }}>
                            {liveAgent.tasksCompleted}
                          </div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Errors</span>
                          <div
                            className="font-mono"
                            style={{
                              color: liveAgent.errorCount > 0
                                ? 'var(--ari-error)'
                                : 'var(--text-muted)',
                            }}
                          >
                            {liveAgent.errorCount}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Decision Flow */}
        <div
          className="card-ari mb-8 rounded-xl p-6"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-muted)',
          }}
        >
          <h2
            className="mb-4 text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Advisor Pattern Flow
          </h2>
          <div className="overflow-x-auto">
            <div className="flex items-center justify-between gap-2 min-w-[700px] py-4">
              {ADVISOR_FLOW.map((step, i, arr) => (
                <div key={step.label} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-full text-xl"
                      style={{
                        background: step.cssBg,
                        color: step.cssColor,
                      }}
                    >
                      {step.icon}
                    </div>
                    <div className="mt-2 text-xs" style={{ color: 'var(--text-primary)' }}>
                      {step.label}
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {step.sub}
                    </div>
                  </div>
                  {i < arr.length - 1 && (
                    <div
                      className="mx-2 h-px w-8"
                      style={{
                        background: 'linear-gradient(to right, var(--border-muted), var(--border-subtle))',
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Properties Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Key Properties */}
          <div
            className="card-ari rounded-xl p-6"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-muted)',
            }}
          >
            <h2
              className="mb-4 text-sm font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              Key Properties
            </h2>
            <div className="space-y-3 stagger-children">
              {[
                { label: 'Operator Final Say', desc: 'Always approves or rejects' },
                { label: 'Guardian Veto Power', desc: 'Can halt unsafe actions' },
                { label: 'All Decisions Audited', desc: 'Full transparency' },
                { label: 'No Auto-Execution', desc: 'Content ≠ Command preserved' },
              ].map((prop) => (
                <div
                  key={prop.label}
                  className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{ background: 'var(--ari-success-muted)' }}
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-sm"
                    style={{
                      background: 'color-mix(in srgb, var(--ari-success) 20%, transparent)',
                      color: 'var(--ari-success)',
                    }}
                  >
                    ✓
                  </div>
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--ari-success)' }}>
                      {prop.label}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {prop.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Phase Status */}
          <div
            className="card-ari rounded-xl p-6"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-muted)',
            }}
          >
            <h2
              className="mb-4 text-sm font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              Implementation Status
            </h2>
            <div className="space-y-3 stagger-children">
              <div
                className="rounded-xl p-4"
                style={{
                  background: 'var(--ari-success-muted)',
                  border: '1px solid color-mix(in srgb, var(--ari-success) 30%, transparent)',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: 'var(--ari-success)' }}>
                    Phase 1: Foundation
                  </span>
                  <span
                    className="rounded px-2 py-0.5 text-xs"
                    style={{
                      background: 'color-mix(in srgb, var(--ari-success) 20%, transparent)',
                      color: 'var(--ari-success)',
                    }}
                  >
                    COMPLETE
                  </span>
                </div>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Gateway, Sanitizer, Audit, Event Bus
                </p>
              </div>
              <div
                className="rounded-xl p-4"
                style={{
                  background: 'var(--ari-purple-muted)',
                  border: '1px solid color-mix(in srgb, var(--ari-purple) 30%, transparent)',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: 'var(--ari-purple)' }}>
                    Phase 2: Agents
                  </span>
                  <span
                    className="rounded px-2 py-0.5 text-xs"
                    style={{
                      background: 'color-mix(in srgb, var(--ari-purple) 20%, transparent)',
                      color: 'var(--ari-purple)',
                    }}
                  >
                    ACTIVE
                  </span>
                </div>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Agent types, Registry, Advisor pattern
                </p>
              </div>
              <div
                className="rounded-xl p-4"
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-muted)',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    Phase 3: Council
                  </span>
                  <span
                    className="rounded px-2 py-0.5 text-xs"
                    style={{
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    PLANNED
                  </span>
                </div>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-disabled)' }}>
                  Voting, Learning, Multi-user
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Live Agent Stats */}
        {safeAgents.length > 0 && (
          <div className="mt-6">
            <h2
              className="mb-4 text-sm font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              Live Agent Statistics
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-children">
              {safeAgents.map((agent) => (
                <AgentStatsCard key={agent.id} agentId={agent.id} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentStatsCard({ agentId }: { agentId: string }) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['agents', agentId, 'stats'],
    queryFn: () => getAgentStats(agentId),
    refetchInterval: 15000,
  });

  if (isLoading || !stats) {
    return <AgentCardSkeleton />;
  }

  const tasksCompleted = stats.tasksCompleted ?? 0;
  const tasksFailed = stats.tasksFailed ?? 0;
  const tasksInProgress = stats.tasksInProgress ?? 0;
  const successRate = tasksCompleted + tasksFailed > 0
    ? ((tasksCompleted / (tasksCompleted + tasksFailed)) * 100).toFixed(1)
    : '100';

  return (
    <div
      className="card-ari card-ari-hover rounded-xl p-4"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-muted)',
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
            {stats.type}
          </div>
          <div className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {stats.agentId.slice(0, 12)}...
          </div>
        </div>
        <StatusBadge
          status={tasksInProgress > 0 ? 'active' : 'idle'}
          size="sm"
        />
      </div>

      <div className="mb-3">
        <div className="mb-1 flex justify-between text-xs">
          <span style={{ color: 'var(--text-muted)' }}>Success Rate</span>
          <span className="font-mono" style={{ color: 'var(--ari-success)' }}>
            {successRate}%
          </span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full"
          style={{ background: 'var(--bg-tertiary)' }}
        >
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${successRate}%`,
              background: 'var(--ari-success)',
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <div className="font-mono" style={{ color: 'var(--ari-success)' }}>
            {tasksCompleted}
          </div>
          <div style={{ color: 'var(--text-disabled)' }}>Done</div>
        </div>
        <div>
          <div className="font-mono" style={{ color: 'var(--ari-warning)' }}>
            {tasksInProgress}
          </div>
          <div style={{ color: 'var(--text-disabled)' }}>Active</div>
        </div>
        <div>
          <div className="font-mono" style={{ color: 'var(--ari-error)' }}>
            {tasksFailed}
          </div>
          <div style={{ color: 'var(--text-disabled)' }}>Failed</div>
        </div>
      </div>
    </div>
  );
}
