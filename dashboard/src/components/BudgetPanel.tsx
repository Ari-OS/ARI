import { useBudget, useBudgetProfileMutation } from '../hooks/useBudget';
import type { ThrottleLevel, BudgetProfileName } from '../types/api';

const THROTTLE_COLORS: Record<ThrottleLevel, string> = {
  normal: 'var(--ari-success)',
  warning: 'var(--ari-warning)',
  reduce: 'var(--ari-warning)',
  pause: 'var(--ari-error)',
};

const THROTTLE_LABELS: Record<ThrottleLevel, string> = {
  normal: 'Healthy',
  warning: 'Warning',
  reduce: 'Reduced',
  pause: 'Paused',
};

const THROTTLE_ICONS: Record<ThrottleLevel, string> = {
  normal: '●',
  warning: '◐',
  reduce: '◑',
  pause: '○',
};

export function BudgetPanel() {
  const { data, isLoading, isError, refetch } = useBudget();
  const profileMutation = useBudgetProfileMutation();

  if (isLoading) {
    return (
      <div
        className="card-ari rounded-xl p-6"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-muted)',
        }}
      >
        <div className="animate-pulse space-y-4">
          <div className="h-4 rounded w-1/3" style={{ background: 'var(--bg-tertiary)' }} />
          <div className="h-24 rounded" style={{ background: 'var(--bg-tertiary)' }} />
          <div className="h-2 rounded" style={{ background: 'var(--bg-tertiary)' }} />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div
        className="card-ari rounded-xl p-6"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--ari-error)',
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ari-error)' }}>
              Token Budget
            </h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              Failed to load budget status
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="text-xs underline"
            style={{ color: 'var(--ari-info)' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const throttleColor = THROTTLE_COLORS[data.throttle.level];
  const throttleLabel = THROTTLE_LABELS[data.throttle.level];
  const throttleIcon = THROTTLE_ICONS[data.throttle.level];

  return (
    <div
      className="card-ari card-ari-hover rounded-xl p-6"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-muted)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Token Budget
          </h3>
          <div className="mt-2 flex items-center gap-2">
            <span
              className="text-2xl font-bold font-mono"
              style={{ color: throttleColor }}
            >
              {data.usage.percentUsed.toFixed(1)}%
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded flex items-center gap-1"
              style={{
                background: `${throttleColor}20`,
                color: throttleColor,
              }}
            >
              <span>{throttleIcon}</span>
              {throttleLabel}
            </span>
          </div>
        </div>

        {/* Profile Selector */}
        <div className="flex flex-col items-end gap-1">
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Profile</div>
          <select
            value={data.profile}
            onChange={(e) => profileMutation.mutate(e.target.value as BudgetProfileName)}
            className="text-xs px-2 py-1 rounded cursor-pointer"
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-muted)',
            }}
            disabled={profileMutation.isPending}
          >
            <option value="conservative">Conservative</option>
            <option value="balanced">Balanced</option>
            <option value="aggressive">Aggressive</option>
          </select>
        </div>
      </div>

      {/* Progress Bar */}
      <div
        className="h-2 rounded-full overflow-hidden mb-4"
        style={{ background: 'var(--bg-tertiary)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(100, data.usage.percentUsed)}%`,
            background: throttleColor,
          }}
        />
      </div>

      {/* Stats Grid */}
      <div
        className="grid grid-cols-2 gap-4 pt-4 font-mono text-xs"
        style={{ borderTop: '1px solid var(--border-muted)' }}
      >
        <div>
          <div style={{ color: 'var(--text-muted)' }}>Used</div>
          <div style={{ color: 'var(--text-primary)' }}>
            {data.usage.tokensUsed.toLocaleString()} tokens
          </div>
          <div style={{ color: 'var(--text-tertiary)' }}>
            ${data.usage.costUsed.toFixed(2)}
          </div>
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)' }}>Remaining</div>
          <div style={{ color: 'var(--text-primary)' }}>
            {data.usage.tokensRemaining.toLocaleString()} tokens
          </div>
          <div style={{ color: 'var(--text-tertiary)' }}>
            ${(data.budget.maxCost - data.usage.costUsed).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Projected EOD */}
      {data.throttle.projectedEOD > 0 && (
        <div
          className="mt-4 pt-4"
          style={{ borderTop: '1px solid var(--border-muted)' }}
        >
          <div className="flex justify-between items-center text-xs">
            <span style={{ color: 'var(--text-muted)' }}>Projected End of Day</span>
            <span
              className="font-mono"
              style={{
                color: data.throttle.projectedEOD > data.budget.maxTokens
                  ? 'var(--ari-error)'
                  : 'var(--text-secondary)',
              }}
            >
              {Math.round(data.throttle.projectedEOD).toLocaleString()} tokens
              {data.throttle.projectedEOD > data.budget.maxTokens && (
                <span style={{ color: 'var(--ari-error)' }}> (over budget)</span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Top Consumers */}
      {data.breakdown.byTaskType.length > 0 && (
        <div
          className="mt-4 pt-4"
          style={{ borderTop: '1px solid var(--border-muted)' }}
        >
          <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
            Top Consumers
          </div>
          <div className="space-y-1">
            {data.breakdown.byTaskType.slice(0, 5).map((item) => (
              <div
                key={item.taskType}
                className="flex justify-between text-xs"
              >
                <span
                  className="truncate max-w-[60%]"
                  style={{ color: 'var(--text-tertiary)' }}
                  title={item.taskType}
                >
                  {item.taskType}
                </span>
                <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                  ${item.cost.toFixed(3)} ({item.percentOfTotal.toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budget Limits */}
      <div
        className="mt-4 pt-4 text-xs"
        style={{ borderTop: '1px solid var(--border-muted)' }}
      >
        <div className="flex justify-between" style={{ color: 'var(--text-muted)' }}>
          <span>Daily Limits</span>
          <span className="font-mono" style={{ color: 'var(--text-tertiary)' }}>
            {data.budget.maxTokens.toLocaleString()} tokens / ${data.budget.maxCost.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between mt-1" style={{ color: 'var(--text-muted)' }}>
          <span>Resets</span>
          <span style={{ color: 'var(--text-tertiary)' }}>
            Midnight ({data.date})
          </span>
        </div>
      </div>
    </div>
  );
}
