import { useQuery } from '@tanstack/react-query';
import { Modal, ModalFooter } from '../ui/Modal';
import { StatusBadge } from '../StatusBadge';
import { format } from 'date-fns';
import type { Subagent } from '../../types/api';

interface SubagentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  subagentId: string | null;
  onDelete?: (id: string) => void;
}

async function fetchSubagent(id: string): Promise<Subagent> {
  const response = await fetch(`/api/subagents/${id}`);
  if (!response.ok) throw new Error('Failed to fetch subagent');
  return response.json();
}

export function SubagentDetailModal({
  isOpen,
  onClose,
  subagentId,
  onDelete,
}: SubagentDetailModalProps) {
  const { data: subagent, isLoading } = useQuery({
    queryKey: ['subagent', subagentId],
    queryFn: () => fetchSubagent(subagentId!),
    enabled: isOpen && !!subagentId,
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });

  if (!subagentId) return null;

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'running':
        return 'emerald';
      case 'completed':
        return 'blue';
      case 'failed':
        return 'red';
      case 'spawning':
        return 'amber';
      default:
        return 'gray';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Subagent Details"
      subtitle={subagent?.task.slice(0, 50)}
      size="lg"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
        </div>
      ) : subagent ? (
        <div className="space-y-6">
          {/* Status Header */}
          <div className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-950/50 p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-${getStatusColor(subagent.status)}-900/30 text-${getStatusColor(subagent.status)}-400`}>
                {subagent.status === 'running' ? '⚡' : subagent.status === 'completed' ? '✓' : subagent.status === 'failed' ? '✕' : '◷'}
              </div>
              <div>
                <div className="text-sm font-medium text-white">
                  {subagent.id.slice(0, 8)}
                </div>
                <div className="text-xs text-gray-500">
                  Created {format(new Date(subagent.createdAt), 'MMM d, HH:mm')}
                </div>
              </div>
            </div>
            <StatusBadge
              status={
                subagent.status === 'completed'
                  ? 'healthy'
                  : subagent.status === 'failed'
                  ? 'unhealthy'
                  : 'degraded'
              }
              size="md"
            />
          </div>

          {/* Task */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Task
            </h4>
            <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
              <p className="text-sm text-gray-300">{subagent.task}</p>
            </div>
          </div>

          {/* Progress */}
          {subagent.progress !== null && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Progress
              </h4>
              <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-gray-400">Completion</span>
                  <span className="font-mono text-sm text-white">{subagent.progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-700">
                  <div
                    className="h-full rounded-full bg-purple-500 transition-all duration-500"
                    style={{ width: `${subagent.progress}%` }}
                  />
                </div>
                {subagent.lastMessage && (
                  <p className="mt-3 text-xs text-gray-500">{subagent.lastMessage}</p>
                )}
              </div>
            </div>
          )}

          {/* Git Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Branch
              </h4>
              <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-3">
                <code className="text-sm text-cyan-400">{subagent.branch}</code>
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Worktree
              </h4>
              <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-3">
                <code className="truncate text-sm text-gray-400">{subagent.worktreePath}</code>
              </div>
            </div>
          </div>

          {/* Tmux Session */}
          {subagent.tmuxSession && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Tmux Session
              </h4>
              <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-3">
                <div className="flex items-center justify-between">
                  <code className="text-sm text-purple-400">{subagent.tmuxSession}</code>
                  <span className="text-xs text-gray-500">
                    Attach: tmux attach -t {subagent.tmuxSession}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {subagent.error && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-400">
                Error
              </h4>
              <div className="rounded-lg border border-red-800 bg-red-900/10 p-4">
                <pre className="whitespace-pre-wrap text-sm text-red-400">{subagent.error}</pre>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Timeline
            </h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-gray-600" />
                <span className="text-xs text-gray-500">
                  Created {format(new Date(subagent.createdAt), 'MMM d, yyyy HH:mm:ss')}
                </span>
              </div>
              {subagent.completedAt && (
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${subagent.status === 'completed' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <span className="text-xs text-gray-500">
                    {subagent.status === 'completed' ? 'Completed' : 'Failed'}{' '}
                    {format(new Date(subagent.completedAt), 'MMM d, yyyy HH:mm:ss')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-gray-500">Subagent not found</div>
      )}

      <ModalFooter>
        {subagent && (subagent.status === 'completed' || subagent.status === 'failed') && onDelete && (
          <button
            onClick={() => {
              onDelete(subagent.id);
              onClose();
            }}
            className="rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-900/50"
          >
            Delete & Cleanup
          </button>
        )}
        <button
          onClick={onClose}
          className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-white transition-colors hover:bg-gray-700"
        >
          Close
        </button>
      </ModalFooter>
    </Modal>
  );
}
