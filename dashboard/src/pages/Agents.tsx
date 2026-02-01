import { useQuery } from '@tanstack/react-query';
import { getAgents, getAgentStats } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState } from '../components/ui/ErrorState';
import { AgentCardSkeleton } from '../components/ui/Skeleton';
import type { ColorName } from '../utils/colors';
import { circleIconClasses, textClasses } from '../utils/colors';

// 6-Agent Council Design from audit (Phase 2 design)
const AGENT_ROLES = {
  CORE: {
    name: 'Core Orchestrator',
    role: 'Strategic reasoning',
    description: 'Master orchestrator - analyzes context, coordinates agents',
    trustLevel: 'Critical',
    permissions: ['orchestrate', 'coordinate', 'delegate'],
    icon: '◉',
    color: { bg: 'bg-purple-900/20', text: 'text-purple-400', border: 'border-purple-800', iconBg: 'bg-purple-900/30' },
  },
  GUARDIAN: {
    name: 'Guardian',
    role: 'Safety enforcement',
    description: 'Checks invariants, can veto unsafe actions',
    trustLevel: 'Critical',
    permissions: ['read:proposal', 'veto:action', 'halt:execution'],
    icon: '⛨',
    color: { bg: 'bg-red-900/20', text: 'text-red-400', border: 'border-red-800', iconBg: 'bg-red-900/30' },
  },
  PLANNER: {
    name: 'Planner',
    role: 'Task decomposition',
    description: 'Breaks down goals into executable DAG steps',
    trustLevel: 'Medium',
    permissions: ['read:context', 'propose:plan', 'create:dag'],
    icon: '◇',
    color: { bg: 'bg-blue-900/20', text: 'text-blue-400', border: 'border-blue-800', iconBg: 'bg-blue-900/30' },
  },
  EXECUTOR: {
    name: 'Executor',
    role: 'Action execution',
    description: 'Executes approved plans using tools (with permission)',
    trustLevel: 'High',
    permissions: ['execute:tools', 'read:plan'],
    icon: '⚙',
    color: { bg: 'bg-emerald-900/20', text: 'text-emerald-400', border: 'border-emerald-800', iconBg: 'bg-emerald-900/30' },
  },
  MEMORY: {
    name: 'Memory Manager',
    role: 'Context management',
    description: 'Provenance-tracked knowledge storage and retrieval',
    trustLevel: 'Medium',
    permissions: ['read:memory', 'write:memory', 'search:memory'],
    icon: '⬢',
    color: { bg: 'bg-cyan-900/20', text: 'text-cyan-400', border: 'border-cyan-800', iconBg: 'bg-cyan-900/30' },
  },
};

export function Agents() {
  const { data: agents, isLoading, isError, refetch } = useQuery({
    queryKey: ['agents'],
    queryFn: getAgents,
    refetchInterval: 10000,
  });

  const safeAgents = Array.isArray(agents) ? agents : [];
  const activeCount = safeAgents.filter(a => a.status === 'active').length;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 px-8 py-6 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Agent System</h1>
            <p className="mt-1 text-sm text-gray-500">
              Multi-agent coordination with safety gates and operator control
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-gray-900 px-4 py-2">
              <div className="text-xs text-gray-500">Active</div>
              <div className="text-lg font-bold text-emerald-400">{isLoading ? '...' : activeCount}</div>
            </div>
            <div className="rounded-lg bg-gray-900 px-4 py-2">
              <div className="text-xs text-gray-500">Total</div>
              <div className="text-lg font-bold text-white">{Object.keys(AGENT_ROLES).length}</div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-8">
        {/* Agent Design Grid */}
        <div className="mb-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Agent Council (Phase 2 Design)
          </h2>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(AGENT_ROLES).map(([key, role]) => {
                const liveAgent = safeAgents.find(a => a.type === key);
                const status = liveAgent?.status || 'active';

                return (
                  <div
                    key={key}
                    className={`card-hover rounded-xl border ${role.color.border} ${role.color.bg} p-6`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${role.color.iconBg} text-2xl ${role.color.text}`}>
                          {role.icon}
                        </div>
                        <div>
                          <div className="font-medium text-white">{role.name}</div>
                          <div className={`text-xs ${role.color.text}`}>{role.role}</div>
                        </div>
                      </div>
                      <StatusBadge
                        status={status}
                        size="sm"
                      />
                    </div>

                    <p className="mt-4 text-sm text-gray-400">
                      {role.description}
                    </p>

                    <div className="mt-4 border-t border-gray-800 pt-4">
                      <div className="mb-2 text-xs text-gray-500">Permissions</div>
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.map((perm) => (
                          <span
                            key={perm}
                            className="rounded bg-gray-800 px-2 py-0.5 font-mono text-[10px] text-gray-400"
                          >
                            {perm}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs">
                      <span className="text-gray-500">Trust Level</span>
                      <span className={`font-medium ${
                        role.trustLevel === 'Critical' ? 'text-red-400' :
                        role.trustLevel === 'High' ? 'text-amber-400' :
                        'text-gray-300'
                      }`}>
                        {role.trustLevel}
                      </span>
                    </div>

                    {liveAgent && (
                      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-800 pt-3 text-xs">
                        <div>
                          <span className="text-gray-500">Completed</span>
                          <div className="font-mono text-emerald-400">{liveAgent.tasksCompleted}</div>
                        </div>
                        <div>
                          <span className="text-gray-500">Errors</span>
                          <div className={`font-mono ${liveAgent.errorCount > 0 ? 'text-red-400' : 'text-gray-500'}`}>
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
        <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Advisor Pattern Flow
          </h2>
          <div className="overflow-x-auto">
            <div className="flex items-center justify-between gap-2 min-w-[700px] py-4">
              {([
                { icon: '⚡', label: 'Event', sub: 'message.received', color: 'blue' as ColorName },
                { icon: '◇', label: 'Planner', sub: 'proposes action', color: 'purple' as ColorName },
                { icon: '⛨', label: 'Guardian', sub: 'safety check', color: 'red' as ColorName },
                { icon: '👤', label: 'Operator', sub: 'approves/rejects', color: 'amber' as ColorName },
                { icon: '⚙', label: 'Executor', sub: 'executes', color: 'emerald' as ColorName },
                { icon: '📋', label: 'Audit', sub: 'logged', color: 'cyan' as ColorName },
              ]).map((step, i, arr) => (
                <div key={step.label} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-full text-xl ${circleIconClasses[step.color]}`}>
                      {step.icon}
                    </div>
                    <div className="mt-2 text-xs text-white">{step.label}</div>
                    <div className="text-[10px] text-gray-500">{step.sub}</div>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="mx-2 h-px w-8 bg-gradient-to-r from-gray-700 to-gray-600" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Properties Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Key Properties */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
              Key Properties
            </h2>
            <div className="space-y-3">
              {[
                { label: 'Operator Final Say', desc: 'Always approves or rejects' },
                { label: 'Guardian Veto Power', desc: 'Can halt unsafe actions' },
                { label: 'All Decisions Audited', desc: 'Full transparency' },
                { label: 'No Auto-Execution', desc: 'Content ≠ Command preserved' },
              ].map((prop) => (
                <div key={prop.label} className="flex items-center gap-3 rounded-lg bg-emerald-900/10 px-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-emerald-900/30 text-emerald-400 text-sm">
                    ✓
                  </div>
                  <div>
                    <div className="text-sm font-medium text-emerald-400">{prop.label}</div>
                    <div className="text-xs text-gray-500">{prop.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Phase Status */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
              Implementation Status
            </h2>
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-800 bg-emerald-900/10 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-emerald-400">Phase 1: Foundation</span>
                  <span className="rounded bg-emerald-900/50 px-2 py-0.5 text-xs text-emerald-400">COMPLETE</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">Gateway, Sanitizer, Audit, Event Bus</p>
              </div>
              <div className="rounded-lg border border-purple-800 bg-purple-900/10 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-purple-400">Phase 2: Agents</span>
                  <span className="rounded bg-purple-900/50 px-2 py-0.5 text-xs text-purple-400">ACTIVE</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">Agent types, Registry, Advisor pattern</p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-400">Phase 3: Council</span>
                  <span className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-500">PLANNED</span>
                </div>
                <p className="mt-1 text-xs text-gray-600">Voting, Learning, Multi-user</p>
              </div>
            </div>
          </div>
        </div>

        {/* Live Agent Stats */}
        {safeAgents.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
              Live Agent Statistics
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-medium text-white">{stats.type}</div>
          <div className="font-mono text-[10px] text-gray-500">{stats.agentId.slice(0, 12)}...</div>
        </div>
        <StatusBadge
          status={tasksInProgress > 0 ? 'active' : 'idle'}
          size="sm"
        />
      </div>

      <div className="mb-3">
        <div className="mb-1 flex justify-between text-xs">
          <span className="text-gray-500">Success Rate</span>
          <span className="font-mono text-emerald-400">{successRate}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-800">
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${successRate}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <div className="font-mono text-emerald-400">{tasksCompleted}</div>
          <div className="text-gray-600">Done</div>
        </div>
        <div>
          <div className="font-mono text-amber-400">{tasksInProgress}</div>
          <div className="text-gray-600">Active</div>
        </div>
        <div>
          <div className="font-mono text-red-400">{tasksFailed}</div>
          <div className="text-gray-600">Failed</div>
        </div>
      </div>
    </div>
  );
}
