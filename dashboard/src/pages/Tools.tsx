import { useQuery } from '@tanstack/react-query';
import { getTools } from '../api/client';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { ToolCardSkeleton } from '../components/ui/Skeleton';

export function Tools() {
  const { data: tools, isLoading, isError, refetch } = useQuery({
    queryKey: ['tools'],
    queryFn: getTools,
    refetchInterval: 30000,
  });

  const safeTools = Array.isArray(tools) ? tools : [];

  const groupedTools = safeTools.reduce(
    (acc, tool) => {
      const category = tool.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(tool);
      return acc;
    },
    {} as Record<string, typeof safeTools>,
  );

  return (
    <div className="p-8">
      <h1 className="mb-6 text-3xl font-bold">Tool Registry</h1>

      {isLoading ? (
        <div className="space-y-8">
          <section>
            <div className="mb-4 h-7 w-32 animate-pulse rounded bg-gray-700" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <ToolCardSkeleton key={i} />
              ))}
            </div>
          </section>
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to load tools"
          message="Could not retrieve tool registry. Please try again."
          onRetry={() => refetch()}
        />
      ) : safeTools.length === 0 ? (
        <EmptyState title="No tools registered" message="No tools are currently registered in the system" icon="○" />
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedTools).map(([category, categoryTools]) => (
            <section key={category}>
              <h2 className="mb-4 text-xl font-semibold capitalize">
                {category}
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {categoryTools.map((tool) => (
                  <div
                    key={tool.id}
                    className="rounded-lg border border-gray-700 bg-gray-800 p-4"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <h3 className="font-semibold text-white">{tool.name}</h3>
                      <span
                        className={`rounded px-2 py-1 text-xs ${
                          tool.enabled
                            ? 'bg-green-900/50 text-green-300'
                            : 'bg-gray-700 text-gray-400'
                        }`}
                      >
                        {tool.enabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>

                    <p className="mb-3 text-sm text-gray-400">
                      {tool.description}
                    </p>

                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className="rounded bg-purple-900/50 px-2 py-1 text-xs text-purple-300">
                        {tool.trustLevel}
                      </span>
                      <span
                        className={`rounded px-2 py-1 text-xs ${
                          tool.permissionTier === 'READ'
                            ? 'bg-green-900/50 text-green-300'
                            : tool.permissionTier === 'WRITE'
                              ? 'bg-yellow-900/50 text-yellow-300'
                              : 'bg-red-900/50 text-red-300'
                        }`}
                      >
                        {tool.permissionTier}
                      </span>
                    </div>

                    <div className="flex justify-between font-mono text-xs">
                      <span className="text-gray-400">
                        Executions: {tool.executionCount}
                      </span>
                      {tool.errorCount > 0 && (
                        <span className="text-red-400">
                          Errors: {tool.errorCount}
                        </span>
                      )}
                    </div>

                    {tool.lastUsed && (
                      <div className="mt-2 font-mono text-xs text-gray-400">
                        Last used: {new Date(tool.lastUsed).toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
