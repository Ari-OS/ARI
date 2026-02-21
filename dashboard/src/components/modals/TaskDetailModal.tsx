import { useQuery } from '@tanstack/react-query';
import { Modal, ModalFooter } from '../ui/Modal';
import { MiniSuccessBar } from '../charts/TaskSuccessChart';
import { format, formatDistanceToNow } from 'date-fns';
import type { ScheduledTask } from '../../types/api';

interface TaskExecutionRecord {
  id: string;
  taskId: string;
  taskName: string;
  startedAt: string;
  completedAt: string;
  duration: number;
  result: 'success' | 'failure' | 'skipped' | 'timeout';
  error?: string;
  triggeredBy: 'scheduler' | 'manual' | 'api' | 'subagent';
}

interface TaskExecutionStats {
  taskId: string;
  taskName: string;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  lastExecution?: TaskExecutionRecord;
}

interface TaskHistoryResponse {
  taskId: string;
  executions: TaskExecutionRecord[];
  stats: TaskExecutionStats | null;
}

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: ScheduledTask | null;
  onTrigger?: (taskId: string) => void;
  onToggle?: (taskId: string) => void;
}

async function fetchTaskHistory(taskId: string): Promise<TaskHistoryResponse> {
  const response = await fetch(`/api/scheduler/tasks/${taskId}/history`);
  if (!response.ok) throw new Error('Failed to fetch task history');
  return (await response.json()) as TaskHistoryResponse;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function TaskDetailModal({
  isOpen,
  onClose,
  task,
  onTrigger,
  onToggle,
}: TaskDetailModalProps) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['task-history', task?.id],
    queryFn: () => fetchTaskHistory(task!.id),
    enabled: isOpen && !!task,
    refetchInterval: 10000,
  });

  if (!task) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={task.name}
      subtitle={`${task.cron} • Handler: ${task.handler}`}
      size="lg"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Status Banner */}
          <div className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-950/50 p-4">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  task.enabled
                    ? 'bg-emerald-900/30 text-emerald-400'
                    : 'bg-gray-800 text-gray-400'
                }`}
              >
                {task.enabled ? '▶' : '⏸'}
              </div>
              <div>
                <div className="text-sm font-medium text-white">
                  {task.enabled ? 'Active' : 'Paused'}
                </div>
                {task.nextRun && (
                  <div className="text-xs text-gray-500">
                    Next run: {format(new Date(task.nextRun), 'MMM d, HH:mm')}
                  </div>
                )}
              </div>
            </div>
            {history?.stats && (
              <div className="text-right">
                <div className={`text-2xl font-bold ${
                  history.stats.successRate >= 80
                    ? 'text-emerald-400'
                    : history.stats.successRate >= 50
                    ? 'text-amber-400'
                    : 'text-red-400'
                }`}>
                  {history.stats.successRate}%
                </div>
                <div className="text-xs text-gray-500">Success Rate</div>
              </div>
            )}
          </div>

          {/* Stats Grid */}
          {history?.stats && (
            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4 text-center">
                <div className="text-xl font-bold text-white">
                  {history.stats.totalExecutions}
                </div>
                <div className="text-[10px] uppercase text-gray-500">Total Runs</div>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4 text-center">
                <div className="text-xl font-bold text-emerald-400">
                  {history.stats.successCount}
                </div>
                <div className="text-[10px] uppercase text-gray-500">Successes</div>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4 text-center">
                <div className="text-xl font-bold text-red-400">
                  {history.stats.failureCount}
                </div>
                <div className="text-[10px] uppercase text-gray-500">Failures</div>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4 text-center">
                <div className="text-xl font-bold text-cyan-400">
                  {formatDuration(history.stats.avgDuration)}
                </div>
                <div className="text-[10px] uppercase text-gray-500">Avg Duration</div>
              </div>
            </div>
          )}

          {/* Success Rate Bar */}
          {history?.stats && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Success Rate
              </h4>
              <MiniSuccessBar successRate={history.stats.successRate} size="md" />
              <div className="mt-2 flex justify-between text-xs text-gray-500">
                <span>{history.stats.successCount} successful</span>
                <span>{history.stats.failureCount} failed</span>
              </div>
            </div>
          )}

          {/* Recent Executions */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Recent Executions
            </h4>
            {history?.executions && history.executions.length > 0 ? (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {history.executions.slice(0, 10).map((exec) => (
                  <div
                    key={exec.id}
                    className={`rounded-lg border p-3 ${
                      exec.result === 'success'
                        ? 'border-emerald-800/50 bg-emerald-900/10'
                        : 'border-red-800/50 bg-red-900/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm ${
                            exec.result === 'success' ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {exec.result === 'success' ? '✓' : '✕'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(exec.completedAt), { addSuffix: true })}
                        </span>
                        <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400">
                          {exec.triggeredBy}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-gray-500">
                        {formatDuration(exec.duration)}
                      </span>
                    </div>
                    {exec.error && (
                      <p className="mt-2 truncate text-xs text-red-400">{exec.error}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-700 p-8 text-center text-sm text-gray-500">
                No executions recorded yet
              </div>
            )}
          </div>

          {/* Schedule Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Last Run
              </h4>
              <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-3">
                <span className="text-sm text-gray-300">
                  {task.lastRun
                    ? format(new Date(task.lastRun), 'MMM d, yyyy HH:mm:ss')
                    : 'Never'}
                </span>
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Duration Range
              </h4>
              <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-3">
                {history?.stats ? (
                  <span className="text-sm text-gray-300">
                    {formatDuration(history.stats.minDuration)} - {formatDuration(history.stats.maxDuration)}
                  </span>
                ) : (
                  <span className="text-sm text-gray-500">N/A</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ModalFooter>
        {onToggle && (
          <button
            onClick={() => onToggle(task.id)}
            className={`rounded-lg px-4 py-2 text-sm transition-colors ${
              task.enabled
                ? 'bg-amber-900/30 text-amber-400 hover:bg-amber-900/50'
                : 'bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50'
            }`}
          >
            {task.enabled ? 'Pause Task' : 'Enable Task'}
          </button>
        )}
        {onTrigger && (
          <button
            onClick={() => onTrigger(task.id)}
            className="rounded-lg bg-purple-900/30 px-4 py-2 text-sm text-purple-400 transition-colors hover:bg-purple-900/50"
          >
            Trigger Now
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
