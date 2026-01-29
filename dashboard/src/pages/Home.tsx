import { useQuery } from '@tanstack/react-query';
import { useDetailedHealth } from '../hooks/useHealth';
import { getAgents } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState } from '../components/ui/ErrorState';
import { StatusCardSkeleton } from '../components/ui/Skeleton';

export function Home() {
  const { data: health, isLoading: healthLoading, isError: healthError, refetch: refetchHealth } = useDetailedHealth();
  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: getAgents,
    refetchInterval: 10000,
  });

  if (healthLoading) {
    return (
      <div className="p-8">
        <h1 className="mb-6 text-3xl font-bold">System Overview</h1>
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
      <div className="p-8">
        <h1 className="mb-6 text-3xl font-bold">System Overview</h1>
        <ErrorState
          title="Failed to load system status"
          message="Could not retrieve health information. Please try again."
          onRetry={() => refetchHealth()}
        />
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-3xl font-bold">System Overview</h1>

      {health && (
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Gateway Status */}
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
              Gateway
            </h3>
            <StatusBadge status={health.gateway.status} size="md" />
            <div className="mt-4 space-y-2 font-mono text-sm text-gray-300">
              <div>Host: {health.gateway.host}</div>
              <div>Port: {health.gateway.port}</div>
              <div>Connections: {health.gateway.connections}</div>
            </div>
          </div>

          {/* Event Bus Status */}
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
              Event Bus
            </h3>
            <StatusBadge status={health.eventBus.status} size="md" />
            <div className="mt-4 space-y-2 font-mono text-sm text-gray-300">
              <div>Events: {health.eventBus.eventCount}</div>
              <div>Subscribers: {health.eventBus.subscribers}</div>
            </div>
          </div>

          {/* Audit Status */}
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
              Audit Log
            </h3>
            <StatusBadge status={health.audit.status} size="md" />
            <div className="mt-4 space-y-2 font-mono text-sm text-gray-300">
              <div>Entries: {health.audit.entryCount}</div>
              <div>
                Chain:{' '}
                {health.audit.chainValid ? (
                  <span className="text-green-400">Valid</span>
                ) : (
                  <span className="text-red-400">Invalid</span>
                )}
              </div>
            </div>
          </div>

          {/* Sanitizer Status */}
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
              Sanitizer
            </h3>
            <StatusBadge status={health.sanitizer.status} size="md" />
            <div className="mt-4 space-y-2 font-mono text-sm text-gray-300">
              <div>Patterns: {health.sanitizer.patternsLoaded}</div>
            </div>
          </div>

          {/* Agents Status */}
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
              Agents
            </h3>
            <StatusBadge status={health.agents.status} size="md" />
            <div className="mt-4 space-y-2 font-mono text-sm text-gray-300">
              <div>Active: {health.agents.activeCount}</div>
              <div>Total: {Object.keys(health.agents.agents).length}</div>
            </div>
          </div>

          {/* Governance Status */}
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
              Governance
            </h3>
            <StatusBadge status={health.governance.status} size="md" />
            <div className="mt-4 space-y-2 font-mono text-sm text-gray-300">
              <div>Active Votes: {health.governance.activeVotes}</div>
              <div>Council Members: {health.governance.councilMembers}</div>
            </div>
          </div>
        </div>
      )}

      {/* Agents Quick View */}
      {!agentsLoading && Array.isArray(agents) && agents.length > 0 && (
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
          <h2 className="mb-4 text-xl font-semibold">Active Agents</h2>
          <div className="space-y-3">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between border-b border-gray-700 pb-3 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <StatusBadge status={agent.status} size="sm" />
                  <span className="font-mono text-sm text-gray-300">
                    {agent.type}
                  </span>
                </div>
                <div className="flex gap-6 font-mono text-xs text-gray-400">
                  <span>Tasks: {agent.tasksCompleted}</span>
                  {agent.errorCount > 0 && (
                    <span className="text-red-400">
                      Errors: {agent.errorCount}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
