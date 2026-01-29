import { useQuery } from '@tanstack/react-query';
import { getAgents, getAgentStats } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { AgentCardSkeleton } from '../components/ui/Skeleton';

export function Agents() {
  const { data: agents, isLoading, isError, refetch } = useQuery({
    queryKey: ['agents'],
    queryFn: getAgents,
    refetchInterval: 10000,
  });

  const safeAgents = Array.isArray(agents) ? agents : [];

  return (
    <div className="p-8">
      <h1 className="mb-6 text-3xl font-bold">Agent Status</h1>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <AgentCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to load agents"
          message="Could not retrieve agent status. Please try again."
          onRetry={() => refetch()}
        />
      ) : safeAgents.length === 0 ? (
        <EmptyState title="No agents found" message="No agents are currently registered" icon="○" />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {safeAgents.map((agent) => (
            <AgentCard key={agent.id} agentId={agent.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentCard({ agentId }: { agentId: string }) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['agents', agentId, 'stats'],
    queryFn: () => getAgentStats(agentId),
    refetchInterval: 15000,
  });

  if (isLoading || !stats) {
    return <AgentCardSkeleton />;
  }

  // Safe defaults for all stats properties to prevent crashes
  const tasksCompleted = stats.tasksCompleted ?? 0;
  const tasksFailed = stats.tasksFailed ?? 0;
  const tasksInProgress = stats.tasksInProgress ?? 0;
  const averageTaskDuration = stats.averageTaskDuration ?? 0;
  const uptime = stats.uptime ?? 0;
  const lastActive = stats.lastActive ?? new Date().toISOString();

  const successRate =
    tasksCompleted + tasksFailed > 0
      ? ((tasksCompleted / (tasksCompleted + tasksFailed)) * 100).toFixed(1)
      : '0';

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">{stats.type}</h3>
          <p className="mt-1 font-mono text-xs text-gray-400">{stats.agentId}</p>
        </div>
        <StatusBadge
          status={
            tasksInProgress > 0
              ? 'active'
              : uptime > 0
                ? 'idle'
                : 'stopped'
          }
          size="sm"
        />
      </div>

      <div className="mb-4 space-y-3">
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-gray-400">Success Rate</span>
            <span className="font-mono text-gray-300">{successRate}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-700">
            <div
              className="h-full bg-green-500"
              style={{ width: `${successRate}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 font-mono text-sm">
          <div>
            <div className="text-gray-400">Completed</div>
            <div className="text-green-400">{tasksCompleted}</div>
          </div>
          <div>
            <div className="text-gray-400">In Progress</div>
            <div className="text-yellow-400">{tasksInProgress}</div>
          </div>
          <div>
            <div className="text-gray-400">Failed</div>
            <div className="text-red-400">{tasksFailed}</div>
          </div>
          <div>
            <div className="text-gray-400">Avg Duration</div>
            <div className="text-gray-300">
              {averageTaskDuration.toFixed(0)}ms
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-700 pt-3 font-mono text-xs text-gray-400">
        <div className="mb-1">
          Last active: {new Date(lastActive).toLocaleString()}
        </div>
        <div>
          Uptime: {Math.floor(uptime / 1000)}s
        </div>
      </div>
    </div>
  );
}
