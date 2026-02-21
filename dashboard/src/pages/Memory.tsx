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
    cssColor: 'var(--ari-purple)',
    cssBg: 'var(--ari-purple-muted)',
  },
  fixes: {
    name: 'Fixes',
    icon: '⚙',
    description: 'Bug fixes and error resolutions',
    cssColor: 'var(--ari-success)',
    cssBg: 'var(--ari-success-muted)',
  },
  decisions: {
    name: 'Decisions',
    icon: '⚖',
    description: 'Architectural and design decisions',
    cssColor: 'var(--ari-info)',
    cssBg: 'var(--ari-info-muted)',
  },
  context: {
    name: 'Context',
    icon: '◉',
    description: 'Session and project context',
    cssColor: 'var(--ari-cyan)',
    cssBg: 'var(--ari-cyan-muted)',
  },
};

// Provenance tracking properties
const PROVENANCE_FEATURES = [
  { label: 'Source Tracking', desc: 'Every memory traces back to origin', icon: '◎' },
  { label: 'Confidence Scores', desc: '0-1 reliability rating per entry', icon: '◈' },
  { label: 'Tag System', desc: 'Semantic categorization for search', icon: '◇' },
  { label: 'Chain Linking', desc: 'Related memories form knowledge graphs', icon: '⬢' },
];

// Type styles
const TYPE_STYLES = {
  FACT: { cssColor: 'var(--ari-purple)', cssBg: 'var(--ari-purple-muted)' },
  TASK: { cssColor: 'var(--ari-info)', cssBg: 'var(--ari-info-muted)' },
  GOAL: { cssColor: 'var(--ari-success)', cssBg: 'var(--ari-success-muted)' },
  INTERACTION: { cssColor: 'var(--ari-warning)', cssBg: 'var(--ari-warning-muted)' },
};

// Partition styles
const PARTITION_STYLES = {
  PUBLIC: { cssColor: 'var(--ari-success)', cssBg: 'var(--ari-success-muted)' },
  PRIVATE: { cssColor: 'var(--text-tertiary)', cssBg: 'var(--bg-tertiary)' },
  QUARANTINE: { cssColor: 'var(--ari-error)', cssBg: 'var(--ari-error-muted)' },
};

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
              Memory System
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              Provenance-tracked knowledge storage • Semantic search enabled
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div
              className="rounded-xl px-4 py-2"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Entries</div>
              <div className="text-lg font-bold" style={{ color: 'var(--ari-cyan)' }}>
                {isLoading ? '...' : safeMemories.length}
              </div>
            </div>
            <div
              className="rounded-xl px-4 py-2"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Domains</div>
              <div className="text-lg font-bold" style={{ color: 'var(--ari-purple)' }}>
                {Object.keys(MEMORY_DOMAINS).length}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-8">
        {/* Memory Domains */}
        <div className="mb-8">
          <h2
            className="mb-4 text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Knowledge Domains
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 stagger-children">
            {Object.entries(MEMORY_DOMAINS).map(([key, domain]) => (
              <div
                key={key}
                className="card-ari card-ari-hover rounded-xl p-4"
                style={{
                  background: domain.cssBg,
                  border: `1px solid color-mix(in srgb, ${domain.cssColor} 30%, transparent)`,
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
                    style={{
                      background: 'var(--bg-card)',
                      color: domain.cssColor,
                    }}
                  >
                    {domain.icon}
                  </div>
                  <div>
                    <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {domain.name}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {domain.description}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Provenance Features */}
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
            Provenance Tracking
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {PROVENANCE_FEATURES.map((feature) => (
              <div key={feature.label} className="flex items-start gap-3">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{
                    background: 'var(--ari-purple-muted)',
                    color: 'var(--ari-purple)',
                  }}
                >
                  {feature.icon}
                </div>
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {feature.label}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {feature.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          {/* Type Distribution */}
          <div
            className="card-ari rounded-xl p-6"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-muted)',
            }}
          >
            <h3
              className="mb-4 text-sm font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              By Type
            </h3>
            <div className="space-y-3">
              {(Object.entries(typeCounts) as [keyof typeof TYPE_STYLES, number][]).map(([type, count]) => {
                const style = TYPE_STYLES[type];
                return (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded px-2 py-0.5 text-xs font-medium"
                        style={{ background: style.cssBg, color: style.cssColor }}
                      >
                        {type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-24 overflow-hidden rounded-full"
                        style={{ background: 'var(--bg-tertiary)' }}
                      >
                        <div
                          className="h-full"
                          style={{
                            background: style.cssColor,
                            width: `${safeMemories.length ? (count / safeMemories.length) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span
                        className="w-8 text-right font-mono text-sm"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {count}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Partition Distribution */}
          <div
            className="card-ari rounded-xl p-6"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-muted)',
            }}
          >
            <h3
              className="mb-4 text-sm font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              By Partition
            </h3>
            <div className="space-y-3">
              {(Object.entries(partitionCounts) as [keyof typeof PARTITION_STYLES, number][]).map(([partition, count]) => {
                const style = PARTITION_STYLES[partition];
                return (
                  <div key={partition} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded px-2 py-0.5 text-xs font-medium"
                        style={{ background: style.cssBg, color: style.cssColor }}
                      >
                        {partition}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-24 overflow-hidden rounded-full"
                        style={{ background: 'var(--bg-tertiary)' }}
                      >
                        <div
                          className="h-full"
                          style={{
                            background: style.cssColor,
                            width: `${safeMemories.length ? (count / safeMemories.length) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span
                        className="w-8 text-right font-mono text-sm"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {count}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div
          className="card-ari mb-6 rounded-xl p-4"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-muted)',
          }}
        >
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search memories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl px-4 py-2 text-sm focus:outline-none focus-visible:ring-2"
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-muted)',
                  color: 'var(--text-primary)',
                  '--tw-ring-color': 'var(--ari-purple)',
                } as React.CSSProperties}
              />
            </div>

            {/* Type Filter */}
            <div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as MemoryType | 'ALL')}
                className="rounded-xl px-4 py-2 text-sm focus:outline-none focus-visible:ring-2"
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-muted)',
                  color: 'var(--text-secondary)',
                  '--tw-ring-color': 'var(--ari-purple)',
                } as React.CSSProperties}
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
                className="rounded-xl px-4 py-2 text-sm focus:outline-none focus-visible:ring-2"
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-muted)',
                  color: 'var(--text-secondary)',
                  '--tw-ring-color': 'var(--ari-purple)',
                } as React.CSSProperties}
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
          <h2
            className="text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
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
                onRetry={() => { void refetch(); }}
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
            <div className="space-y-4 stagger-children">
              {filteredMemories.map((memory) => {
                const typeStyle = TYPE_STYLES[memory.type as keyof typeof TYPE_STYLES] || TYPE_STYLES.FACT;
                const partitionStyle = PARTITION_STYLES[memory.partition as keyof typeof PARTITION_STYLES] || PARTITION_STYLES.PUBLIC;

                return (
                  <div
                    key={memory.id}
                    className="card-ari card-ari-hover rounded-xl p-6"
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-muted)',
                    }}
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex flex-wrap gap-2">
                        <span
                          className="rounded px-2 py-1 text-xs font-semibold"
                          style={{ background: typeStyle.cssBg, color: typeStyle.cssColor }}
                        >
                          {memory.type}
                        </span>
                        <span
                          className="rounded px-2 py-1 text-xs font-semibold"
                          style={{ background: partitionStyle.cssBg, color: partitionStyle.cssColor }}
                        >
                          {memory.partition}
                        </span>
                        <span
                          className="rounded px-2 py-1 text-xs"
                          style={{
                            background: 'var(--bg-tertiary)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {memory.trustLevel}
                        </span>
                      </div>
                      {memory.confidence !== undefined && (
                        <div className="text-right">
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Confidence
                          </div>
                          <div
                            className="font-mono text-sm"
                            style={{
                              color: memory.confidence >= 0.8
                                ? 'var(--ari-success)'
                                : memory.confidence >= 0.5
                                  ? 'var(--ari-warning)'
                                  : 'var(--ari-error)',
                            }}
                          >
                            {(memory.confidence * 100).toFixed(0)}%
                          </div>
                        </div>
                      )}
                    </div>

                    <p className="mb-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {memory.content}
                    </p>

                    {Array.isArray(memory.tags) && memory.tags.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {memory.tags.map((tag: string, idx: number) => (
                          <span
                            key={idx}
                            className="rounded-full px-3 py-1 text-xs"
                            style={{
                              background: 'var(--bg-tertiary)',
                              color: 'var(--ari-purple)',
                            }}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div
                      className="flex justify-between pt-3 font-mono text-xs"
                      style={{
                        borderTop: '1px solid var(--border-muted)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <span>Source: {memory.source}</span>
                      <span>
                        {new Date(memory.timestamp).toLocaleString()}
                      </span>
                    </div>

                    {Array.isArray(memory.provenance?.chain) && memory.provenance.chain.length > 0 && (
                      <details
                        className="mt-3 pt-3"
                        style={{ borderTop: '1px solid var(--border-muted)' }}
                      >
                        <summary
                          className="cursor-pointer text-xs focus:outline-none"
                          style={{ color: 'var(--ari-purple)' }}
                        >
                          View Provenance Chain ({memory.provenance.chain.length} links)
                        </summary>
                        <div
                          className="mt-2 space-y-1 rounded-xl p-3 font-mono text-xs"
                          style={{
                            background: 'var(--bg-tertiary)',
                            color: 'var(--text-tertiary)',
                          }}
                        >
                          {memory.provenance.chain.map((item: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span style={{ color: 'var(--ari-purple)' }}>→</span>
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
