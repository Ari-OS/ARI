import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuditLog, verifyAuditChain } from '../api/client';
import { AuditEntry as AuditEntryComponent } from '../components/AuditEntry';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { AuditEntrySkeleton } from '../components/ui/Skeleton';
import type { ColorName } from '../utils/colors';
import { cardClasses, textClasses, bg600Classes, borderClasses } from '../utils/colors';

// Action categories from audit findings with typed colors
const ACTION_CATEGORIES: Record<string, { name: string; icon: string; color: ColorName; actions: string[] }> = {
  security: {
    name: 'Security',
    icon: '⛨',
    color: 'red',
    actions: ['security:threat', 'security:blocked', 'permission:denied', 'trust:violation'],
  },
  governance: {
    name: 'Governance',
    icon: '⚖',
    color: 'purple',
    actions: ['council:vote', 'proposal:submit', 'proposal:approved', 'proposal:rejected'],
  },
  agents: {
    name: 'Agents',
    icon: '⬡',
    color: 'blue',
    actions: ['task_start', 'task_complete', 'task_failed', 'agent:spawn'],
  },
  memory: {
    name: 'Memory',
    icon: '⬢',
    color: 'cyan',
    actions: ['memory:store', 'memory:retrieve', 'memory:search'],
  },
  system: {
    name: 'System',
    icon: '◉',
    color: 'emerald',
    actions: ['system:start', 'system:stop', 'config:update', 'health:check'],
  },
};

// Chain integrity properties
const CHAIN_PROPERTIES = [
  { label: 'Algorithm', value: 'SHA-256', desc: 'Cryptographic hash function' },
  { label: 'Genesis', value: '0x00...00', desc: 'Zero-hash initial block' },
  { label: 'Structure', value: 'Append-Only', desc: 'Immutable log' },
  { label: 'Verification', value: 'On Startup', desc: 'Auto-validates chain' },
];

export function Audit() {
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  const { data: entries, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit', limit, offset],
    queryFn: () => getAuditLog({ limit, offset }),
    refetchInterval: 10000,
  });

  const safeEntries = Array.isArray(entries) ? entries : [];

  const { data: verification, isLoading: verifyLoading } = useQuery({
    queryKey: ['audit', 'verify'],
    queryFn: verifyAuditChain,
    refetchInterval: 30000,
  });

  const handlePrevPage = () => {
    if (offset > 0) {
      setOffset(Math.max(0, offset - limit));
    }
  };

  const handleNextPage = () => {
    if (safeEntries.length === limit) {
      setOffset(offset + limit);
    }
  };

  // Filter entries by action category
  const filteredEntries = actionFilter === 'ALL'
    ? safeEntries
    : safeEntries.filter(entry => {
        const category = Object.values(ACTION_CATEGORIES).find(cat =>
          cat.actions.some(action => entry.action?.includes(action))
        );
        return category?.name === actionFilter;
      });

  // Count actions by category
  const actionCounts = Object.entries(ACTION_CATEGORIES).reduce((acc, [, cat]) => {
    acc[cat.name] = safeEntries.filter(entry =>
      cat.actions.some(action => entry.action?.includes(action))
    ).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 px-8 py-6 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Audit Trail</h1>
            <p className="mt-1 text-sm text-gray-500">
              SHA-256 hash-chained immutable log • Tamper-evident security
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-gray-900 px-4 py-2">
              <div className="text-xs text-gray-500">Total Events</div>
              <div className="text-lg font-bold text-cyan-400">
                {verifyLoading ? '...' : (verification?.entryCount ?? 0).toLocaleString()}
              </div>
            </div>
            <div className={`rounded-lg px-4 py-2 ${
              verification?.valid ? 'bg-emerald-900/20' : 'bg-red-900/20'
            }`}>
              <div className="text-xs text-gray-500">Chain Status</div>
              <div className={`text-lg font-bold ${
                verification?.valid ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {verifyLoading ? '...' : verification?.valid ? 'VALID' : 'BROKEN'}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-8">
        {/* Chain Verification Status */}
        {!verifyLoading && verification && (
          <div
            className={`mb-6 rounded-xl border p-6 ${
              verification.valid
                ? 'border-emerald-800 bg-emerald-900/10'
                : 'border-red-800 bg-red-900/10'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className={`flex h-14 w-14 items-center justify-center rounded-xl text-2xl ${
                  verification.valid
                    ? 'bg-emerald-900/30 text-emerald-400'
                    : 'bg-red-900/30 text-red-400'
                }`}>
                  {verification.valid ? '⛓' : '⚠'}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {verification.valid
                      ? 'Hash Chain Integrity Verified'
                      : 'Hash Chain Integrity Compromised'}
                  </h3>
                  <p className="mt-1 text-sm text-gray-400">
                    {verification.message}
                  </p>
                </div>
              </div>
              {!verification.valid && verification.brokenAt && (
                <div className="rounded-lg bg-red-900/30 px-4 py-2">
                  <div className="text-xs text-red-400">Broken At</div>
                  <div className="font-mono text-sm text-red-300">
                    #{verification.brokenAt}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-gray-800 pt-4 lg:grid-cols-4">
              <div>
                <div className="text-xs text-gray-500">Genesis Hash</div>
                <div className="mt-1 font-mono text-xs text-emerald-400 truncate">
                  {verification.genesisHash?.slice(0, 16)}...
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Latest Hash</div>
                <div className="mt-1 font-mono text-xs text-purple-400 truncate">
                  {verification.lastHash?.slice(0, 16)}...
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Entry Count</div>
                <div className="mt-1 font-mono text-xs text-white">
                  {verification.entryCount?.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Algorithm</div>
                <div className="mt-1 font-mono text-xs text-white">
                  SHA-256
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chain Properties */}
        <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {CHAIN_PROPERTIES.map((prop) => (
            <div
              key={prop.label}
              className="rounded-lg border border-gray-800 bg-gray-900/50 p-4"
            >
              <div className="text-xs text-gray-500">{prop.label}</div>
              <div className="mt-1 font-mono text-lg font-bold text-white">{prop.value}</div>
              <div className="mt-1 text-xs text-gray-600">{prop.desc}</div>
            </div>
          ))}
        </div>

        {/* Action Categories Filter */}
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Filter by Category
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActionFilter('ALL')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                actionFilter === 'ALL'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              All ({safeEntries.length})
            </button>
            {Object.entries(ACTION_CATEGORIES).map(([key, cat]) => (
              <button
                key={key}
                onClick={() => setActionFilter(cat.name)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  actionFilter === cat.name
                    ? `${bg600Classes[cat.color]} text-white`
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
                <span className="rounded-full bg-gray-700 px-2 py-0.5 text-xs">
                  {actionCounts[cat.name] ?? 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="mb-6 flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 p-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <span>Show:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setOffset(0);
                }}
                className="rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
              <span>entries</span>
            </label>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {offset + 1} - {offset + filteredEntries.length}
            </span>
            <div className="flex gap-2">
              <button
                onClick={handlePrevPage}
                disabled={offset === 0}
                className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              >
                ← Prev
              </button>
              <button
                onClick={handleNextPage}
                disabled={safeEntries.length < limit}
                className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              >
                Next →
              </button>
            </div>
          </div>
        </div>

        {/* Audit Entries */}
        <div className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            Audit Log
          </h2>
        </div>

        {(() => {
          if (isLoading) {
            return (
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
                {[1, 2, 3, 4, 5].map((i) => (
                  <AuditEntrySkeleton key={i} />
                ))}
              </div>
            );
          }

          if (isError) {
            return (
              <ErrorState
                title="Failed to load audit log"
                message="Could not retrieve audit entries. Please try again."
                onRetry={() => refetch()}
              />
            );
          }

          if (filteredEntries.length === 0) {
            return (
              <EmptyState
                title="No audit entries"
                message={actionFilter === 'ALL' ? 'No audit entries found' : `No ${actionFilter} events found`}
                icon="○"
              />
            );
          }

          return (
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
              {filteredEntries.map((entry, index) => (
                <div
                  key={entry.id}
                  className={`${index > 0 ? 'border-t border-gray-800' : ''}`}
                >
                  <AuditEntryComponent entry={entry} />
                </div>
              ))}
            </div>
          );
        })()}

        {/* Hash Chain Visualization */}
        <div className="mt-8 rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Hash Chain Structure
          </h2>
          <div className="overflow-x-auto">
            <div className="flex items-center gap-2 min-w-[600px] py-4">
              {([
                { label: 'Genesis', hash: '0x00...00', color: 'emerald' as ColorName },
                { label: 'Block 1', hash: 'a7b3...', color: 'purple' as ColorName },
                { label: 'Block 2', hash: 'f2c8...', color: 'purple' as ColorName },
                { label: '...', hash: '', color: 'gray' as ColorName },
                { label: `Block N`, hash: verification?.lastHash?.slice(0, 4) + '...' || 'xxxx...', color: 'cyan' as ColorName },
              ]).map((block, i, arr) => (
                <div key={block.label} className="flex items-center">
                  <div className={`rounded-lg border px-4 py-3 text-center ${borderClasses[block.color]} ${cardClasses[block.color]}`}>
                    <div className={`text-xs font-medium ${textClasses[block.color]}`}>{block.label}</div>
                    {block.hash && (
                      <div className="mt-1 font-mono text-[10px] text-gray-500">{block.hash}</div>
                    )}
                  </div>
                  {i < arr.length - 1 && (
                    <div className="mx-2 flex items-center text-gray-600">
                      <div className="h-px w-6 bg-gray-700" />
                      <span className="text-xs">→</span>
                      <div className="h-px w-6 bg-gray-700" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-500">
            Each block contains the SHA-256 hash of the previous block, creating a tamper-evident chain.
            Any modification breaks the chain and is immediately detectable.
          </p>
        </div>
      </div>
    </div>
  );
}
