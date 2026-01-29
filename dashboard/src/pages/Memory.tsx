import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMemories } from '../api/client';
import type { MemoryType, MemoryPartition } from '../types/api';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { MemoryCardSkeleton } from '../components/ui/Skeleton';

export function Memory() {
  const [typeFilter, setTypeFilter] = useState<MemoryType | 'ALL'>('ALL');
  const [partitionFilter, setPartitionFilter] =
    useState<MemoryPartition | 'ALL'>('ALL');

  const { data: memories, isLoading, isError, refetch } = useQuery({
    queryKey: ['memory', typeFilter, partitionFilter],
    queryFn: () =>
      getMemories({
        type: typeFilter !== 'ALL' ? typeFilter : undefined,
        partition: partitionFilter !== 'ALL' ? partitionFilter : undefined,
        limit: 50,
      }),
    refetchInterval: 15000,
  });

  return (
    <div className="p-8">
      <h1 className="mb-6 text-3xl font-bold">Memory System</h1>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-400">
            Type
          </label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as MemoryType | 'ALL')}
            className="rounded border border-gray-700 bg-gray-800 px-4 py-2 text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
          >
            <option value="ALL">All Types</option>
            <option value="FACT">FACT</option>
            <option value="TASK">TASK</option>
            <option value="GOAL">GOAL</option>
            <option value="INTERACTION">INTERACTION</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-400">
            Partition
          </label>
          <select
            value={partitionFilter}
            onChange={(e) =>
              setPartitionFilter(e.target.value as MemoryPartition | 'ALL')
            }
            className="rounded border border-gray-700 bg-gray-800 px-4 py-2 text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
          >
            <option value="ALL">All Partitions</option>
            <option value="PUBLIC">PUBLIC</option>
            <option value="PRIVATE">PRIVATE</option>
            <option value="QUARANTINE">QUARANTINE</option>
          </select>
        </div>
      </div>

      {/* Memory List */}
      {(() => {
        const safeMemories = Array.isArray(memories) ? memories : [];

        if (isLoading) {
          return (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <MemoryCardSkeleton key={i} />
              ))}
            </div>
          );
        }

        if (isError) {
          return (
            <ErrorState
              title="Failed to load memories"
              message="Could not retrieve memory entries. Please try again."
              onRetry={() => refetch()}
            />
          );
        }

        if (safeMemories.length === 0) {
          return <EmptyState title="No memories found" message="No memories match the current filters" icon="○" />;
        }

        return (
          <div className="space-y-4">
            {safeMemories.map((memory) => (
            <div
              key={memory.id}
              className="rounded-lg border border-gray-700 bg-gray-800 p-6"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex gap-2">
                  <span
                    className={`rounded px-2 py-1 text-xs font-semibold ${
                      memory.type === 'FACT'
                        ? 'bg-purple-900/50 text-purple-300'
                        : memory.type === 'TASK'
                          ? 'bg-purple-900/50 text-purple-300'
                          : memory.type === 'GOAL'
                            ? 'bg-green-900/50 text-green-300'
                            : 'bg-yellow-900/50 text-yellow-300'
                    }`}
                  >
                    {memory.type}
                  </span>
                  <span
                    className={`rounded px-2 py-1 text-xs font-semibold ${
                      memory.partition === 'PUBLIC'
                        ? 'bg-green-900/50 text-green-300'
                        : memory.partition === 'PRIVATE'
                          ? 'bg-gray-700 text-gray-300'
                          : 'bg-red-900/50 text-red-300'
                    }`}
                  >
                    {memory.partition}
                  </span>
                  <span className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300">
                    {memory.trustLevel}
                  </span>
                </div>
              </div>

              <p className="mb-3 font-mono text-sm text-gray-300">
                {memory.content}
              </p>

              {Array.isArray(memory.tags) && memory.tags.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {memory.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-400"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex justify-between font-mono text-xs text-gray-400">
                <span>Source: {memory.source}</span>
                <span>
                  {new Date(memory.timestamp).toLocaleString()}
                </span>
              </div>

              {Array.isArray(memory.provenance?.chain) && memory.provenance.chain.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:rounded">
                    Provenance Chain ({memory.provenance.chain.length})
                  </summary>
                  <div className="mt-2 space-y-1 font-mono text-xs text-gray-400">
                    {memory.provenance.chain.map((item, idx) => (
                      <div key={idx}>→ {item}</div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}
          </div>
        );
      })()}
    </div>
  );
}
