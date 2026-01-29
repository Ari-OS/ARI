import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuditLog, verifyAuditChain } from '../api/client';
import { AuditEntry as AuditEntryComponent } from '../components/AuditEntry';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { AuditEntrySkeleton } from '../components/ui/Skeleton';

export function Audit() {
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const { data: entries, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit', limit, offset],
    queryFn: () => getAuditLog({ limit, offset }),
    refetchInterval: 10000,
  });

  // Safe array check at top of component to use throughout
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

  return (
    <div className="p-8">
      <h1 className="mb-6 text-3xl font-bold">Audit Log</h1>

      {/* Chain Verification Status */}
      {!verifyLoading && verification && (
        <div
          className={`mb-6 rounded-lg border p-4 ${
            verification.valid
              ? 'border-green-700 bg-green-900/20'
              : 'border-red-700 bg-red-900/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">
                {verification.valid
                  ? '✓ Hash Chain Valid'
                  : '✗ Hash Chain Broken'}
              </h3>
              <p className="mt-1 text-sm text-gray-400">
                {verification.message}
              </p>
            </div>
            <div className="text-right font-mono text-sm">
              <div className="text-gray-400">Entries: {verification.entryCount}</div>
              {!verification.valid && verification.brokenAt && (
                <div className="text-red-400">
                  Broken at: {verification.brokenAt}
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4 font-mono text-xs text-gray-400">
            <div>
              <span className="text-gray-300">Genesis: </span>
              {verification.genesisHash.slice(0, 16)}...
            </div>
            <div>
              <span className="text-gray-300">Latest: </span>
              {verification.lastHash.slice(0, 16)}...
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-400">
            Entries per page:
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setOffset(0);
              }}
              className="ml-2 rounded border border-gray-700 bg-gray-800 px-3 py-1 text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </label>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handlePrevPage}
            disabled={offset === 0}
            className="rounded border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
          >
            Previous
          </button>
          <button
            onClick={handleNextPage}
            disabled={safeEntries.length < limit}
            className="rounded border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
          >
            Next
          </button>
        </div>
      </div>

      {/* Audit Entries */}
      {(() => {
        if (isLoading) {
          return (
            <div className="rounded-lg border border-gray-700 bg-gray-800">
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

        if (safeEntries.length === 0) {
          return <EmptyState title="No audit entries" message="No audit entries found" icon="○" />;
        }

        return (
          <div className="rounded-lg border border-gray-700 bg-gray-800">
            {safeEntries.map((entry) => (
              <AuditEntryComponent key={entry.id} entry={entry} />
            ))}
          </div>
        );
      })()}

      {safeEntries.length > 0 && (
        <div className="mt-4 text-center font-mono text-sm text-gray-400">
          Showing {offset + 1} - {offset + safeEntries.length}
        </div>
      )}
    </div>
  );
}
