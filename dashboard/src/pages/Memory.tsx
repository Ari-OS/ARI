import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMemories } from '../api/client';
import type { MemoryType, MemoryPartition } from '../types/api';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { MemoryCardSkeleton } from '../components/ui/Skeleton';

// Memory domains from ARI architecture
const MEMORY_DOMAINS = {
  patterns: {
    name: 'Patterns',
    icon: '◇',
    description: 'Learned coding patterns and solutions',
    color: { bg: 'bg-purple-900/20', text: 'text-purple-400', border: 'border-purple-800' },
  },
  fixes: {
    name: 'Fixes',
    icon: '⚙',
    description: 'Bug fixes and error resolutions',
    color: { bg: 'bg-emerald-900/20', text: 'text-emerald-400', border: 'border-emerald-800' },
  },
  decisions: {
    name: 'Decisions',
    icon: '⚖',
    description: 'Architectural and design decisions',
    color: { bg: 'bg-blue-900/20', text: 'text-blue-400', border: 'border-blue-800' },
  },
  context: {
    name: 'Context',
    icon: '◉',
    description: 'Session and project context',
    color: { bg: 'bg-cyan-900/20', text: 'text-cyan-400', border: 'border-cyan-800' },
  },
};

// Provenance tracking properties
const PROVENANCE_FEATURES = [
  { label: 'Source Tracking', desc: 'Every memory traces back to origin', icon: '◎' },
  { label: 'Confidence Scores', desc: '0-1 reliability rating per entry', icon: '◈' },
  { label: 'Tag System', desc: 'Semantic categorization for search', icon: '◇' },
  { label: 'Chain Linking', desc: 'Related memories form knowledge graphs', icon: '⬢' },
];

export function Memory() {
  const [typeFilter, setTypeFilter] = useState<MemoryType | 'ALL'>('ALL');
  const [partitionFilter, setPartitionFilter] = useState<MemoryPartition | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

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

  const safeMemories = Array.isArray(memories) ? memories : [];

  // Filter by search query
  const filteredMemories = searchQuery
    ? safeMemories.filter(m =>
        m.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.tags?.some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : safeMemories;

  // Count by type
  const typeCounts = {
    FACT: safeMemories.filter(m => m.type === 'FACT').length,
    TASK: safeMemories.filter(m => m.type === 'TASK').length,
    GOAL: safeMemories.filter(m => m.type === 'GOAL').length,
    INTERACTION: safeMemories.filter(m => m.type === 'INTERACTION').length,
  };

  // Count by partition
  const partitionCounts = {
    PUBLIC: safeMemories.filter(m => m.partition === 'PUBLIC').length,
    PRIVATE: safeMemories.filter(m => m.partition === 'PRIVATE').length,
    QUARANTINE: safeMemories.filter(m => m.partition === 'QUARANTINE').length,
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 px-8 py-6 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Memory System</h1>
            <p className="mt-1 text-sm text-gray-500">
              Provenance-tracked knowledge storage • Semantic search enabled
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-gray-900 px-4 py-2">
              <div className="text-xs text-gray-500">Total Entries</div>
              <div className="text-lg font-bold text-cyan-400">
                {isLoading ? '...' : safeMemories.length}
              </div>
            </div>
            <div className="rounded-lg bg-gray-900 px-4 py-2">
              <div className="text-xs text-gray-500">Domains</div>
              <div className="text-lg font-bold text-purple-400">
                {Object.keys(MEMORY_DOMAINS).length}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-8">
        {/* Memory Domains */}
        <div className="mb-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Knowledge Domains
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Object.entries(MEMORY_DOMAINS).map(([key, domain]) => (
              <div
                key={key}
                className={`card-hover rounded-xl border ${domain.color.border} ${domain.color.bg} p-4`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900/50 text-xl ${domain.color.text}`}>
                    {domain.icon}
                  </div>
                  <div>
                    <div className="font-medium text-white">{domain.name}</div>
                    <div className="text-xs text-gray-500">{domain.description}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Provenance Features */}
        <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Provenance Tracking
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {PROVENANCE_FEATURES.map((feature) => (
              <div key={feature.label} className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-purple-900/30 text-purple-400">
                  {feature.icon}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{feature.label}</div>
                  <div className="text-xs text-gray-500">{feature.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          {/* Type Distribution */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
              By Type
            </h3>
            <div className="space-y-3">
              {Object.entries(typeCounts).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                      type === 'FACT' ? 'bg-purple-900/50 text-purple-300' :
                      type === 'TASK' ? 'bg-blue-900/50 text-blue-300' :
                      type === 'GOAL' ? 'bg-emerald-900/50 text-emerald-300' :
                      'bg-amber-900/50 text-amber-300'
                    }`}>
                      {type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-800">
                      <div
                        className={`h-full ${
                          type === 'FACT' ? 'bg-purple-500' :
                          type === 'TASK' ? 'bg-blue-500' :
                          type === 'GOAL' ? 'bg-emerald-500' :
                          'bg-amber-500'
                        }`}
                        style={{ width: `${safeMemories.length ? (count / safeMemories.length) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="w-8 text-right font-mono text-sm text-gray-400">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Partition Distribution */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
              By Partition
            </h3>
            <div className="space-y-3">
              {Object.entries(partitionCounts).map(([partition, count]) => (
                <div key={partition} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                      partition === 'PUBLIC' ? 'bg-emerald-900/50 text-emerald-300' :
                      partition === 'PRIVATE' ? 'bg-gray-700 text-gray-300' :
                      'bg-red-900/50 text-red-300'
                    }`}>
                      {partition}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-800">
                      <div
                        className={`h-full ${
                          partition === 'PUBLIC' ? 'bg-emerald-500' :
                          partition === 'PRIVATE' ? 'bg-gray-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${safeMemories.length ? (count / safeMemories.length) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="w-8 text-right font-mono text-sm text-gray-400">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search memories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-gray-300 placeholder-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              />
            </div>

            {/* Type Filter */}
            <div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as MemoryType | 'ALL')}
                className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              >
                <option value="ALL">All Types</option>
                <option value="FACT">FACT</option>
                <option value="TASK">TASK</option>
                <option value="GOAL">GOAL</option>
                <option value="INTERACTION">INTERACTION</option>
              </select>
            </div>

            {/* Partition Filter */}
            <div>
              <select
                value={partitionFilter}
                onChange={(e) => setPartitionFilter(e.target.value as MemoryPartition | 'ALL')}
                className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              >
                <option value="ALL">All Partitions</option>
                <option value="PUBLIC">PUBLIC</option>
                <option value="PRIVATE">PRIVATE</option>
                <option value="QUARANTINE">QUARANTINE</option>
              </select>
            </div>
          </div>
        </div>

        {/* Memory List */}
        <div className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            Memory Entries ({filteredMemories.length})
          </h2>
        </div>

        {(() => {
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

          if (filteredMemories.length === 0) {
            return (
              <EmptyState
                title="No memories found"
                message={searchQuery ? 'No memories match your search' : 'No memories match the current filters'}
                icon="⬢"
              />
            );
          }

          return (
            <div className="space-y-4">
              {filteredMemories.map((memory) => (
                <div
                  key={memory.id}
                  className="card-hover rounded-xl border border-gray-800 bg-gray-900/50 p-6"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded px-2 py-1 text-xs font-semibold ${
                          memory.type === 'FACT'
                            ? 'bg-purple-900/50 text-purple-300'
                            : memory.type === 'TASK'
                              ? 'bg-blue-900/50 text-blue-300'
                              : memory.type === 'GOAL'
                                ? 'bg-emerald-900/50 text-emerald-300'
                                : 'bg-amber-900/50 text-amber-300'
                        }`}
                      >
                        {memory.type}
                      </span>
                      <span
                        className={`rounded px-2 py-1 text-xs font-semibold ${
                          memory.partition === 'PUBLIC'
                            ? 'bg-emerald-900/50 text-emerald-300'
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
                    {memory.confidence !== undefined && (
                      <div className="text-right">
                        <div className="text-xs text-gray-500">Confidence</div>
                        <div className={`font-mono text-sm ${
                          memory.confidence >= 0.8 ? 'text-emerald-400' :
                          memory.confidence >= 0.5 ? 'text-amber-400' :
                          'text-red-400'
                        }`}>
                          {(memory.confidence * 100).toFixed(0)}%
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="mb-3 text-sm text-gray-300">
                    {memory.content}
                  </p>

                  {Array.isArray(memory.tags) && memory.tags.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {memory.tags.map((tag: string, idx: number) => (
                        <span
                          key={idx}
                          className="rounded-full bg-gray-800 px-3 py-1 text-xs text-purple-400"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between border-t border-gray-800 pt-3 font-mono text-xs text-gray-500">
                    <span>Source: {memory.source}</span>
                    <span>
                      {new Date(memory.timestamp).toLocaleString()}
                    </span>
                  </div>

                  {Array.isArray(memory.provenance?.chain) && memory.provenance.chain.length > 0 && (
                    <details className="mt-3 border-t border-gray-800 pt-3">
                      <summary className="cursor-pointer text-xs text-purple-400 hover:text-purple-300 focus:outline-none">
                        View Provenance Chain ({memory.provenance.chain.length} links)
                      </summary>
                      <div className="mt-2 space-y-1 rounded-lg bg-gray-800/50 p-3 font-mono text-xs text-gray-400">
                        {memory.provenance.chain.map((item: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="text-purple-400">→</span>
                            <span>{item}</span>
                          </div>
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
    </div>
  );
}
