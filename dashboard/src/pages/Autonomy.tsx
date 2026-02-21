import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSchedulerStatus,
  getSchedulerTasks,
  triggerSchedulerTask,
  toggleSchedulerTask,
  getSubagents,
  getSubagentStats,
  deleteSubagent,
} from '../api/client';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import type { ScheduledTask, Subagent, SubagentStatus } from '../types/api';

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS STYLES - CSS Variables for consistent theming
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_STYLES: Record<SubagentStatus, {
  cssColor: string;
  cssBg: string;
  cssBorder: string;
  name: string;
}> = {
  running: {
    cssColor: 'var(--ari-success)',
    cssBg: 'var(--ari-success-muted)',
    cssBorder: 'color-mix(in srgb, var(--ari-success) 40%, transparent)',
    name: 'Running',
  },
  completed: {
    cssColor: 'var(--ari-info)',
    cssBg: 'var(--ari-info-muted)',
    cssBorder: 'color-mix(in srgb, var(--ari-info) 40%, transparent)',
    name: 'Completed',
  },
  failed: {
    cssColor: 'var(--ari-error)',
    cssBg: 'var(--ari-error-muted)',
    cssBorder: 'color-mix(in srgb, var(--ari-error) 40%, transparent)',
    name: 'Failed',
  },
  spawning: {
    cssColor: 'var(--ari-warning)',
    cssBg: 'var(--ari-warning-muted)',
    cssBorder: 'color-mix(in srgb, var(--ari-warning) 40%, transparent)',
    name: 'Spawning',
  },
};

// Stat card color configurations
const STAT_COLORS: Record<string, { cssColor: string; cssBg: string }> = {
  running: { cssColor: 'var(--ari-success)', cssBg: 'var(--ari-success-muted)' },
  completed: { cssColor: 'var(--ari-info)', cssBg: 'var(--ari-info-muted)' },
  failed: { cssColor: 'var(--ari-error)', cssBg: 'var(--ari-error-muted)' },
  spawning: { cssColor: 'var(--ari-warning)', cssBg: 'var(--ari-warning-muted)' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// CRON UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

const CRON_DESCRIPTIONS: Record<string, string> = {
  '0 7 * * *': 'Daily at 7:00 AM',
  '0 8 * * *': 'Daily at 8:00 AM',
  '0 14 * * *': 'Daily at 2:00 PM',
  '0 20 * * *': 'Daily at 8:00 PM',
  '0 19 * * *': 'Daily at 7:00 PM',
  '0 21 * * *': 'Daily at 9:00 PM',
  '*/15 * * * *': 'Every 15 minutes',
  '0 18 * * 0': 'Sunday at 6:00 PM',
};

function formatCron(cron: string): string {
  return CRON_DESCRIPTIONS[cron] || cron;
}

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return 'Never';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);

  if (diffMins < 0) {
    const absMins = Math.abs(diffMins);
    if (absMins < 60) return `${absMins}m ago`;
    const absHours = Math.abs(diffHours);
    if (absHours < 24) return `${absHours}h ago`;
    return date.toLocaleDateString();
  }
  if (diffMins < 60) return `in ${diffMins}m`;
  if (diffHours < 24) return `in ${diffHours}h`;
  return date.toLocaleDateString();
}

function formatDateTime(isoString: string | null): string {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Task icons based on handler name
function getTaskIcon(handler: string): string {
  switch (handler) {
    case 'morning_briefing':
      return '☀';
    case 'evening_summary':
      return '☾';
    case 'knowledge_index':
      return '📚';
    case 'changelog_generate':
      return '📝';
    case 'agent_health_check':
      return '💓';
    case 'weekly_review':
      return '📅';
    default:
      return '⚙';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function Autonomy() {
  const queryClient = useQueryClient();
  const [triggeringTask, setTriggeringTask] = useState<string | null>(null);

  const {
    data: schedulerStatus,
    isLoading: statusLoading,
    isError: statusError,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['scheduler-status'],
    queryFn: getSchedulerStatus,
    refetchInterval: 10000,
  });

  const { data: schedulerTasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['scheduler-tasks'],
    queryFn: getSchedulerTasks,
    refetchInterval: 10000,
  });

  const { data: subagents, isLoading: subagentsLoading } = useQuery({
    queryKey: ['subagents'],
    queryFn: getSubagents,
    refetchInterval: 5000,
  });

  const { data: subagentStats } = useQuery({
    queryKey: ['subagent-stats'],
    queryFn: getSubagentStats,
    refetchInterval: 5000,
  });

  const triggerMutation = useMutation({
    mutationFn: triggerSchedulerTask,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['scheduler-tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['scheduler-status'] });
    },
    onSettled: () => {
      setTriggeringTask(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: toggleSchedulerTask,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['scheduler-tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['scheduler-status'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSubagent,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['subagents'] });
      void queryClient.invalidateQueries({ queryKey: ['subagent-stats'] });
    },
  });

  const handleTrigger = (taskId: string) => {
    setTriggeringTask(taskId);
    triggerMutation.mutate(taskId);
  };

  const handleToggle = (taskId: string) => {
    toggleMutation.mutate(taskId);
  };

  const handleDelete = (agentId: string) => {
    if (confirm('Are you sure you want to delete this subagent and its worktree?')) {
      deleteMutation.mutate(agentId);
    }
  };

  if (statusError) {
    return (
      <div className="min-h-screen p-8" style={{ background: 'var(--bg-primary)' }}>
        <div className="mb-8">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Autonomous Operations
          </h1>
        </div>
        <ErrorState
          title="Failed to load scheduler"
          message="Could not connect to ARI gateway. Ensure the gateway is running."
          onRetry={() => { void refetchStatus(); }}
        />
      </div>
    );
  }

  const runningAgents = subagents?.filter((a) => a.status === 'running') || [];
  const completedAgents =
    subagents?.filter((a) => a.status === 'completed' || a.status === 'failed') || [];

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header
        className="border-b px-8 py-6 backdrop-blur-sm"
        style={{
          borderColor: 'var(--border-primary)',
          background: 'color-mix(in srgb, var(--bg-primary) 80%, transparent)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl transition-all"
              style={{
                background: schedulerStatus?.running
                  ? 'var(--ari-success-muted)'
                  : 'var(--bg-tertiary)',
                color: schedulerStatus?.running
                  ? 'var(--ari-success)'
                  : 'var(--text-tertiary)',
                boxShadow: schedulerStatus?.running
                  ? '0 0 20px color-mix(in srgb, var(--ari-success) 30%, transparent)'
                  : 'none',
              }}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                Autonomous Operations
              </h1>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                Scheduler tasks and spawned subagents
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            {/* Scheduler Status */}
            <div
              className="flex items-center gap-3 rounded-lg px-4 py-2"
              style={{ background: 'var(--bg-secondary)' }}
            >
              <div
                className={`h-2.5 w-2.5 rounded-full ${schedulerStatus?.running ? 'status-dot-healthy' : ''}`}
                style={{
                  background: schedulerStatus?.running
                    ? 'var(--ari-success)'
                    : 'var(--text-tertiary)',
                }}
              />
              <div>
                <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  Scheduler
                </div>
                <div
                  className="text-sm font-medium"
                  style={{
                    color: schedulerStatus?.running
                      ? 'var(--ari-success)'
                      : 'var(--text-secondary)',
                  }}
                >
                  {statusLoading ? '...' : schedulerStatus?.running ? 'Running' : 'Stopped'}
                </div>
              </div>
            </div>
            {/* Task Count */}
            <div
              className="rounded-lg px-4 py-2"
              style={{ background: 'var(--bg-secondary)' }}
            >
              <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Tasks
              </div>
              <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {statusLoading
                  ? '...'
                  : `${schedulerStatus?.enabledCount || 0}/${schedulerStatus?.taskCount || 0}`}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-8">
        {/* Next Task Banner */}
        {schedulerStatus?.nextTask && (
          <div
            className="card-ari mb-8 rounded-xl p-4"
            style={{
              background: 'var(--ari-purple-muted)',
              border: '1px solid color-mix(in srgb, var(--ari-purple) 40%, transparent)',
              boxShadow: '0 0 30px color-mix(in srgb, var(--ari-purple) 15%, transparent)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-xl"
                  style={{
                    background: 'color-mix(in srgb, var(--ari-purple) 30%, transparent)',
                    color: 'var(--ari-purple)',
                  }}
                >
                  ⏰
                </div>
                <div>
                  <div className="text-xs" style={{ color: 'var(--ari-purple-light)' }}>
                    Next Scheduled Task
                  </div>
                  <div className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
                    {schedulerStatus.nextTask.name}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  Scheduled For
                </div>
                <div
                  className="font-mono text-lg"
                  style={{ color: 'var(--ari-purple)' }}
                >
                  {formatRelativeTime(schedulerStatus.nextTask.nextRun)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Subagent Stats Cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4 stagger-children">
          <StatCard
            label="Running"
            value={subagentStats?.running ?? 0}
            colorKey="running"
            loading={subagentsLoading}
          />
          <StatCard
            label="Completed"
            value={subagentStats?.completed ?? 0}
            colorKey="completed"
            loading={subagentsLoading}
          />
          <StatCard
            label="Failed"
            value={subagentStats?.failed ?? 0}
            colorKey="failed"
            loading={subagentsLoading}
          />
          <StatCard
            label="Spawning"
            value={subagentStats?.spawning ?? 0}
            colorKey="spawning"
            loading={subagentsLoading}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Scheduled Tasks */}
          <div
            className="card-ari rounded-xl p-6"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
            }}
          >
            <h2
              className="mb-4 text-sm font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-secondary)' }}
            >
              Scheduled Tasks
            </h2>
            {tasksLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="shimmer h-20 rounded-lg" />
                ))}
              </div>
            ) : schedulerTasks && schedulerTasks.length > 0 ? (
              <div className="space-y-2 stagger-children">
                {schedulerTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onTrigger={handleTrigger}
                    onToggle={handleToggle}
                    isTriggering={triggeringTask === task.id}
                  />
                ))}
              </div>
            ) : (
              <div
                className="rounded-lg border border-dashed p-8 text-center"
                style={{ borderColor: 'var(--border-primary)' }}
              >
                <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  No scheduled tasks
                </div>
              </div>
            )}
          </div>

          {/* Running Subagents */}
          <div
            className="card-ari rounded-xl p-6"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
            }}
          >
            <h2
              className="mb-4 text-sm font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-secondary)' }}
            >
              Running Subagents
            </h2>
            {subagentsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="shimmer h-24 rounded-lg" />
                ))}
              </div>
            ) : runningAgents.length > 0 ? (
              <div className="space-y-3 stagger-children">
                {runningAgents.map((agent) => (
                  <SubagentCard key={agent.id} agent={agent} onDelete={handleDelete} />
                ))}
              </div>
            ) : (
              <div
                className="rounded-lg border border-dashed p-8 text-center"
                style={{ borderColor: 'var(--border-primary)' }}
              >
                <div className="mb-2 text-2xl" style={{ color: 'var(--text-tertiary)' }}>
                  ✨
                </div>
                <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  No agents running
                </div>
                <div className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  Agents will appear here when spawned
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Completed/Failed Subagents */}
        {completedAgents.length > 0 && (
          <div
            className="card-ari mt-6 rounded-xl p-6"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
            }}
          >
            <h2
              className="mb-4 text-sm font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-secondary)' }}
            >
              Recent Completions
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 stagger-children">
              {completedAgents.slice(0, 6).map((agent) => (
                <SubagentCard key={agent.id} agent={agent} compact onDelete={handleDelete} />
              ))}
            </div>
          </div>
        )}

        {/* Cron Legend */}
        <div
          className="card-ari mt-6 rounded-xl p-6"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
          }}
        >
          <h2
            className="mb-4 text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-secondary)' }}
          >
            Schedule Reference
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 stagger-children">
            <div
              className="rounded-lg p-3"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Daily Briefings
              </div>
              <div className="mt-1 text-sm" style={{ color: 'var(--text-primary)' }}>
                7:00 AM / 9:00 PM
              </div>
            </div>
            <div
              className="rounded-lg p-3"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Knowledge Index
              </div>
              <div className="mt-1 text-sm" style={{ color: 'var(--text-primary)' }}>
                8 AM / 2 PM / 8 PM
              </div>
            </div>
            <div
              className="rounded-lg p-3"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Health Check
              </div>
              <div className="mt-1 text-sm" style={{ color: 'var(--text-primary)' }}>
                Every 15 minutes
              </div>
            </div>
            <div
              className="rounded-lg p-3"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Weekly Review
              </div>
              <div className="mt-1 text-sm" style={{ color: 'var(--text-primary)' }}>
                Sunday 6:00 PM
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASK ROW COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface TaskRowProps {
  task: ScheduledTask;
  onTrigger: (id: string) => void;
  onToggle: (id: string) => void;
  isTriggering: boolean;
}

function TaskRow({ task, onTrigger, onToggle, isTriggering }: TaskRowProps) {
  const icon = getTaskIcon(task.handler);

  return (
    <div
      className="rounded-lg border p-4 transition-all"
      style={{
        borderColor: task.enabled
          ? 'var(--border-primary)'
          : 'color-mix(in srgb, var(--border-primary) 50%, transparent)',
        background: task.enabled
          ? 'var(--bg-tertiary)'
          : 'color-mix(in srgb, var(--bg-tertiary) 50%, transparent)',
        opacity: task.enabled ? 1 : 0.6,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-xl"
            style={{ background: 'var(--bg-secondary)' }}
          >
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {task.name}
              </span>
              {!task.enabled && (
                <span
                  className="rounded px-1.5 py-0.5 text-[10px]"
                  style={{
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  DISABLED
                </span>
              )}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {formatCron(task.cron)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="mr-2 text-right">
            <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              Next Run
            </div>
            <div
              className="font-mono text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              {task.enabled ? formatRelativeTime(task.nextRun) : '-'}
            </div>
          </div>
          <button
            onClick={() => onToggle(task.id)}
            className="rounded px-2 py-1 text-xs transition-colors"
            style={{
              background: task.enabled
                ? 'var(--bg-secondary)'
                : 'var(--ari-success-muted)',
              color: task.enabled
                ? 'var(--text-secondary)'
                : 'var(--ari-success)',
            }}
            title={task.enabled ? 'Disable task' : 'Enable task'}
          >
            {task.enabled ? 'Disable' : 'Enable'}
          </button>
          <button
            onClick={() => onTrigger(task.id)}
            disabled={isTriggering || !task.enabled}
            className="rounded px-3 py-1 text-xs font-medium transition-colors"
            style={{
              background: isTriggering
                ? 'color-mix(in srgb, var(--ari-purple) 30%, transparent)'
                : task.enabled
                  ? 'var(--ari-purple-muted)'
                  : 'var(--bg-secondary)',
              color: isTriggering
                ? 'var(--ari-purple-light)'
                : task.enabled
                  ? 'var(--ari-purple)'
                  : 'var(--text-tertiary)',
              cursor: task.enabled ? 'pointer' : 'not-allowed',
            }}
          >
            {isTriggering ? 'Running...' : 'Run Now'}
          </button>
        </div>
      </div>
      {task.lastRun && (
        <div
          className="mt-2 border-t pt-2 text-xs"
          style={{
            borderColor: 'var(--border-primary)',
            color: 'var(--text-tertiary)',
          }}
        >
          Last run: {formatDateTime(task.lastRun)}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBAGENT CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface SubagentCardProps {
  agent: Subagent;
  compact?: boolean;
  onDelete: (id: string) => void;
}

function SubagentCard({ agent, compact, onDelete }: SubagentCardProps) {
  const canDelete = agent.status === 'completed' || agent.status === 'failed';
  const statusStyle = STATUS_STYLES[agent.status] || STATUS_STYLES.completed;

  return (
    <div
      className={`rounded-lg border ${compact ? 'p-3' : 'p-4'}`}
      style={{
        background: statusStyle.cssBg,
        borderColor: statusStyle.cssBorder,
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`h-2.5 w-2.5 rounded-full ${agent.status === 'running' ? 'status-dot-healthy' : ''}`}
            style={{ background: statusStyle.cssColor }}
          />
          <div>
            <div
              className="font-mono text-sm"
              style={{ color: statusStyle.cssColor }}
            >
              {agent.status.toUpperCase()}
            </div>
            {!compact && (
              <div
                className="mt-0.5 text-xs"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {agent.id.slice(0, 20)}...
              </div>
            )}
          </div>
        </div>
        {canDelete && (
          <button
            onClick={() => onDelete(agent.id)}
            className="transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            title="Delete subagent"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      <div className={`${compact ? 'mt-2' : 'mt-3'}`}>
        <div
          className={`${compact ? 'text-xs' : 'text-sm'} ${compact ? 'truncate' : 'line-clamp-2'}`}
          style={{ color: 'var(--text-secondary)' }}
        >
          {agent.task}
        </div>
      </div>

      {agent.progress !== null && agent.status === 'running' && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs">
            <span style={{ color: 'var(--text-tertiary)' }}>Progress</span>
            <span style={{ color: 'var(--ari-success)' }}>{agent.progress}%</span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full"
            style={{ background: 'var(--bg-tertiary)' }}
          >
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${agent.progress}%`,
                background: 'var(--ari-success)',
              }}
            />
          </div>
          {agent.lastMessage && (
            <div
              className="mt-1 truncate text-[10px]"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {agent.lastMessage}
            </div>
          )}
        </div>
      )}

      {agent.error && (
        <div
          className="mt-2 truncate rounded px-2 py-1 text-xs"
          style={{
            background: 'var(--ari-error-muted)',
            color: 'var(--ari-error)',
          }}
        >
          {agent.error}
        </div>
      )}

      {!compact && (
        <div
          className="mt-3 flex items-center gap-4 border-t pt-3 text-xs"
          style={{
            borderColor: 'color-mix(in srgb, var(--border-primary) 50%, transparent)',
            color: 'var(--text-tertiary)',
          }}
        >
          <div>
            <span style={{ color: 'var(--text-tertiary)' }}>Branch:</span>{' '}
            <span
              className="font-mono"
              style={{ color: 'var(--text-secondary)' }}
            >
              {agent.branch.slice(-20)}
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--text-tertiary)' }}>Started:</span>{' '}
            <span style={{ color: 'var(--text-secondary)' }}>
              {formatRelativeTime(agent.createdAt)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAT CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface StatCardProps {
  label: string;
  value: number;
  colorKey: keyof typeof STAT_COLORS;
  loading: boolean;
}

function StatCard({ label, value, colorKey, loading }: StatCardProps) {
  const colors = STAT_COLORS[colorKey];

  return (
    <div
      className="card-ari rounded-xl border p-4"
      style={{
        background: colors.cssBg,
        borderColor: `color-mix(in srgb, ${colors.cssColor} 30%, transparent)`,
      }}
    >
      {loading ? (
        <Skeleton className="h-10 w-16" />
      ) : (
        <>
          <div
            className="text-3xl font-bold"
            style={{ color: colors.cssColor }}
          >
            {value}
          </div>
          <div
            className="mt-1 text-xs uppercase"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {label}
          </div>
        </>
      )}
    </div>
  );
}

export default Autonomy;
