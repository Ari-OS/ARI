import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Virtuoso } from 'react-virtuoso';
import { getAuditLog, verifyAuditChain } from '../api/client';
import { AuditEntry as AuditEntryComponent } from '../components/AuditEntry';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { AuditEntrySkeleton } from '../components/ui/Skeleton';

// Action categories from audit findings
const ACTION_CATEGORIES = {
  security: {
    name: 'Security',
    icon: '⛨',
    cssColor: 'var(--ari-error)',
    cssBg: 'var(--ari-error-muted)',
    actions: ['security:threat', 'security:blocked', 'permission:denied', 'trust:violation'],
  },
  governance: {
    name: 'Governance',
    icon: '⚖',
    cssColor: 'var(--ari-purple)',
    cssBg: 'var(--ari-purple-muted)',
    actions: ['council:vote', 'proposal:submit', 'proposal:approved', 'proposal:rejected'],
  },
  agents: {
    name: 'Agents',
    icon: '⬡',
    cssColor: 'var(--ari-info)',
    cssBg: 'var(--ari-info-muted)',
    actions: ['task_start', 'task_complete', 'task_failed', 'agent:spawn'],
  },
  memory: {
    name: 'Memory',
    icon: '⬢',
    cssColor: 'var(--ari-cyan)',
    cssBg: 'var(--ari-cyan-muted)',
    actions: ['memory:store', 'memory:retrieve', 'memory:search'],
  },
  system: {
    name: 'System',
    icon: '◉',
    cssColor: 'var(--ari-success)',
    cssBg: 'var(--ari-success-muted)',
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

// Hash chain blocks for visualization
const CHAIN_BLOCKS = [
  { label: 'Genesis', hash: '0x00...00', cssColor: 'var(--ari-success)', cssBg: 'var(--ari-success-muted)' },
  { label: 'Block 1', hash: 'a7b3...', cssColor: 'var(--ari-purple)', cssBg: 'var(--ari-purple-muted)' },
  { label: 'Block 2', hash: 'f2c8...', cssColor: 'var(--ari-purple)', cssBg: 'var(--ari-purple-muted)' },
  { label: '...', hash: '', cssColor: 'var(--text-tertiary)', cssBg: 'var(--bg-tertiary)' },
];

export function Audit() {
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  const { data: auditResponse, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit', limit, offset],
    queryFn: () => getAuditLog({ limit, offset }),
    refetchInterval: 10000,
  });

  const safeEntries = auditResponse?.events ?? [];

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
              Audit Trail
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              SHA-256 hash-chained immutable log • Tamper-evident security
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div
              className="rounded-xl px-4 py-2"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Events</div>
              <div className="text-lg font-bold" style={{ color: 'var(--ari-cyan)' }}>
                {verifyLoading ? '...' : (verification?.entryCount ?? 0).toLocaleString()}
              </div>
            </div>
            <div
              className="rounded-xl px-4 py-2"
              style={{
                background: verification?.valid ? 'var(--ari-success-muted)' : 'var(--ari-error-muted)',
              }}
            >
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Chain Status</div>
              <div
                className="text-lg font-bold"
                style={{
                  color: verification?.valid ? 'var(--ari-success)' : 'var(--ari-error)',
                }}
              >
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
            className="card-ari mb-6 rounded-xl p-6"
            style={{
              background: verification.valid ? 'var(--ari-success-muted)' : 'var(--ari-error-muted)',
              border: `1px solid color-mix(in srgb, ${verification.valid ? 'var(--ari-success)' : 'var(--ari-error)'} 30%, transparent)`,
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-xl text-2xl"
                  style={{
                    background: `color-mix(in srgb, ${verification.valid ? 'var(--ari-success)' : 'var(--ari-error)'} 20%, transparent)`,
                    color: verification.valid ? 'var(--ari-success)' : 'var(--ari-error)',
                  }}
                >
                  {verification.valid ? '⛓' : '⚠'}
                </div>
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {verification.valid
                      ? 'Hash Chain Integrity Verified'
                      : 'Hash Chain Integrity Compromised'}
                  </h3>
                  <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                    {verification.message}
                  </p>
                </div>
              </div>
              {!verification.valid && verification.brokenAt && (
                <div
                  className="rounded-xl px-4 py-2"
                  style={{ background: 'color-mix(in srgb, var(--ari-error) 20%, transparent)' }}
                >
                  <div className="text-xs" style={{ color: 'var(--ari-error)' }}>Broken At</div>
                  <div className="font-mono text-sm" style={{ color: 'var(--ari-error)' }}>
                    #{verification.brokenAt}
                  </div>
                </div>
              )}
            </div>

            <div
              className="mt-6 grid grid-cols-2 gap-4 pt-4 lg:grid-cols-4"
              style={{ borderTop: '1px solid var(--border-muted)' }}
            >
              <div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Genesis Hash</div>
                <div className="mt-1 font-mono text-xs truncate" style={{ color: 'var(--ari-success)' }}>
                  {verification.genesisHash?.slice(0, 16)}...
                </div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Latest Hash</div>
                <div className="mt-1 font-mono text-xs truncate" style={{ color: 'var(--ari-purple)' }}>
                  {verification.lastHash?.slice(0, 16)}...
                </div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Entry Count</div>
                <div className="mt-1 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
                  {verification.entryCount?.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Algorithm</div>
                <div className="mt-1 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
                  SHA-256
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chain Properties */}
        <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4 stagger-children">
          {CHAIN_PROPERTIES.map((prop) => (
            <div
              key={prop.label}
              className="card-ari rounded-xl p-4"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-muted)',
              }}
            >
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{prop.label}</div>
              <div className="mt-1 font-mono text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {prop.value}
              </div>
              <div className="mt-1 text-xs" style={{ color: 'var(--text-disabled)' }}>{prop.desc}</div>
            </div>
          ))}
        </div>

        {/* Action Categories Filter */}
        <div className="mb-6">
          <h2
            className="mb-3 text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Filter by Category
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActionFilter('ALL')}
              className="rounded-xl px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2"
              style={{
                background: actionFilter === 'ALL' ? 'var(--ari-purple)' : 'var(--bg-tertiary)',
                color: actionFilter === 'ALL' ? 'white' : 'var(--text-tertiary)',
                '--tw-ring-color': 'var(--ari-purple)',
              } as React.CSSProperties}
            >
              All ({safeEntries.length})
            </button>
            {Object.entries(ACTION_CATEGORIES).map(([key, cat]) => (
              <button
                key={key}
                onClick={() => setActionFilter(cat.name)}
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2"
                style={{
                  background: actionFilter === cat.name ? cat.cssColor : 'var(--bg-tertiary)',
                  color: actionFilter === cat.name ? 'white' : 'var(--text-tertiary)',
                  '--tw-ring-color': 'var(--ari-purple)',
                } as React.CSSProperties}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-xs"
                  style={{
                    background: actionFilter === cat.name ? 'rgba(255,255,255,0.2)' : 'var(--bg-tertiary)',
                  }}
                >
                  {actionCounts[cat.name] ?? 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div
          className="card-ari mb-6 flex items-center justify-between rounded-xl p-4"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-muted)',
          }}
        >
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
              <span>Show:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setOffset(0);
                }}
                className="rounded-lg px-3 py-1.5 text-sm focus:outline-none focus-visible:ring-2"
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-muted)',
                  color: 'var(--text-secondary)',
                  '--tw-ring-color': 'var(--ari-purple)',
                } as React.CSSProperties}
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
              <span>entries</span>
            </label>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {offset + 1} - {offset + filteredEntries.length}
            </span>
            <div className="flex gap-2">
              <button
                onClick={handlePrevPage}
                disabled={offset === 0}
                className="rounded-xl px-4 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2"
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-muted)',
                  color: 'var(--text-secondary)',
                  '--tw-ring-color': 'var(--ari-purple)',
                } as React.CSSProperties}
              >
                ← Prev
              </button>
              <button
                onClick={handleNextPage}
                disabled={safeEntries.length < limit}
                className="rounded-xl px-4 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2"
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-muted)',
                  color: 'var(--text-secondary)',
                  '--tw-ring-color': 'var(--ari-purple)',
                } as React.CSSProperties}
              >
                Next →
              </button>
            </div>
          </div>
        </div>

        {/* Audit Entries */}
        <div className="mb-4">
          <h2
            className="text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Audit Log
          </h2>
        </div>

        {(() => {
          if (isLoading) {
            return (
              <div
                className="rounded-xl overflow-hidden"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-muted)',
                }}
              >
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
                onRetry={() => { void refetch(); }}
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
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-muted)',
                height: '600px',
              }}
            >
              <Virtuoso
                style={{ height: '100%' }}
                data={filteredEntries}
                itemContent={(_index, entry) => (
                  <div
                    key={entry.id}
                    style={{
                      borderTop: _index > 0 ? '1px solid var(--border-muted)' : 'none',
                    }}
                  >
                    <AuditEntryComponent entry={entry} />
                  </div>
                )}
              />
            </div>
          );
        })()}

        {/* Hash Chain Visualization */}
        <div
          className="card-ari mt-8 rounded-xl p-6"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-muted)',
          }}
        >
          <h2
            className="mb-4 text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Hash Chain Structure
          </h2>
          <div className="overflow-x-auto">
            <div className="flex items-center gap-2 min-w-[600px] py-4">
              {[
                ...CHAIN_BLOCKS,
                {
                  label: 'Block N',
                  hash: verification?.lastHash?.slice(0, 4) + '...' || 'xxxx...',
                  cssColor: 'var(--ari-cyan)',
                  cssBg: 'var(--ari-cyan-muted)',
                },
              ].map((block, i, arr) => (
                <div key={block.label} className="flex items-center">
                  <div
                    className="rounded-xl px-4 py-3 text-center"
                    style={{
                      background: block.cssBg,
                      border: `1px solid color-mix(in srgb, ${block.cssColor} 30%, transparent)`,
                    }}
                  >
                    <div className="text-xs font-medium" style={{ color: block.cssColor }}>
                      {block.label}
                    </div>
                    {block.hash && (
                      <div className="mt-1 font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {block.hash}
                      </div>
                    )}
                  </div>
                  {i < arr.length - 1 && (
                    <div className="mx-2 flex items-center" style={{ color: 'var(--text-disabled)' }}>
                      <div className="h-px w-6" style={{ background: 'var(--border-muted)' }} />
                      <span className="text-xs">→</span>
                      <div className="h-px w-6" style={{ background: 'var(--border-muted)' }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            Each block contains the SHA-256 hash of the previous block, creating a tamper-evident chain.
            Any modification breaks the chain and is immediately detectable.
          </p>
        </div>
      </div>
    </div>
  );
}
