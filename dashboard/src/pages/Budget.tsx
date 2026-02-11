import { useQuery } from '@tanstack/react-query';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { useEffect, useState } from 'react';

// Types matching budget-tracker.ts
interface BudgetStatus {
  mode: 'conservative' | 'balanced' | 'aggressive' | 'paused';
  spent: number;
  remaining: number;
  budget: number;
  percentUsed: number;
  daysInCycle: number;
  daysRemaining: number;
  projectedSpend: number;
  avgDailySpend: number;
  recommendedDailySpend: number;
  status: 'ok' | 'warning' | 'critical' | 'paused';
}

interface DailyUsage {
  date: string;
  totalCost: number;
  totalTokens: number;
  requestCount: number;
  modelBreakdown: Record<string, { cost: number; tokens: number; requests: number }>;
  taskBreakdown: Record<string, { cost: number; requests: number }>;
}

interface BudgetState {
  config: {
    monthlyBudget: number;
    warningThreshold: number;
    criticalThreshold: number;
    pauseThreshold: number;
  };
  dailyUsage: DailyUsage[];
  totalSpent: number;
  mode: string;
  currentCycleStart: string;
  currentCycleEnd: string;
}

// Model display names
const MODEL_NAMES: Record<string, string> = {
  'claude-3-haiku': 'Haiku 3',
  'claude-3.5-haiku': 'Haiku 3.5',
  'claude-haiku-4.5': 'Haiku 4.5',
  'claude-3.5-sonnet': 'Sonnet 3.5',
  'claude-sonnet-4': 'Sonnet 4',
  'claude-sonnet-4.5': 'Sonnet 4.5',
  'claude-opus-4': 'Opus 4',
  'claude-opus-4.5': 'Opus 4.5',
};

// Model colors for charts
const MODEL_COLORS: Record<string, string> = {
  'claude-3-haiku': '#94a3b8',
  'claude-3.5-haiku': '#64748b',
  'claude-haiku-4.5': '#475569',
  'claude-3.5-sonnet': '#a78bfa',
  'claude-sonnet-4': '#8b5cf6',
  'claude-sonnet-4.5': '#7c3aed',
  'claude-opus-4': '#f472b6',
  'claude-opus-4.5': '#ec4899',
};

export function Budget() {
  const { subscribe } = useWebSocketContext();
  const [liveStatus, setLiveStatus] = useState<Partial<BudgetStatus> | null>(null);

  // Fetch budget status
  const { data: status, isLoading: statusLoading } = useQuery<BudgetStatus>({
    queryKey: ['budget-status'],
    queryFn: async () => {
      const res = await fetch('/api/budget/status');
      if (!res.ok) throw new Error('Failed to fetch budget status');
      return res.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch budget state for historical data
  const { data: state } = useQuery<BudgetState>({
    queryKey: ['budget-state'],
    queryFn: async () => {
      const res = await fetch('/api/budget/state');
      if (!res.ok) throw new Error('Failed to fetch budget state');
      return res.json();
    },
    refetchInterval: 60000,
  });

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribe = subscribe('budget:update', (data: Partial<BudgetStatus>) => {
      setLiveStatus(data);
    });
    return unsubscribe;
  }, [subscribe]);

  // Merge live updates with fetched data
  const currentStatus: BudgetStatus | undefined = liveStatus
    ? { ...status, ...liveStatus } as BudgetStatus
    : status;

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-8 w-8 border-2 border-[var(--ari-purple)] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!currentStatus) {
    return (
      <div className="p-6">
        <div className="text-center text-[var(--text-muted)]">
          Budget data unavailable. Start the gateway to enable tracking.
        </div>
      </div>
    );
  }

  // Calculate status colors
  const getStatusColor = (s: string) => {
    switch (s) {
      case 'ok': return 'var(--ari-success)';
      case 'warning': return 'var(--ari-warning)';
      case 'critical':
      case 'paused': return 'var(--ari-error)';
      default: return 'var(--text-muted)';
    }
  };

  const getModeColor = (m: string) => {
    switch (m) {
      case 'conservative': return 'var(--ari-cyan)';
      case 'balanced': return 'var(--ari-success)';
      case 'aggressive': return 'var(--ari-warning)';
      case 'paused': return 'var(--ari-error)';
      default: return 'var(--text-muted)';
    }
  };

  const getModeDescription = (m: string) => {
    switch (m) {
      case 'conservative': return 'Using cost-efficient models';
      case 'balanced': return 'Balanced cost and capability';
      case 'aggressive': return 'Using highest capability models';
      case 'paused': return 'Operations paused - budget exceeded';
      default: return '';
    }
  };

  // Aggregate model usage from daily data
  const modelUsage: Record<string, { cost: number; tokens: number; requests: number }> = {};
  state?.dailyUsage?.forEach(day => {
    Object.entries(day.modelBreakdown).forEach(([model, data]) => {
      if (!modelUsage[model]) {
        modelUsage[model] = { cost: 0, tokens: 0, requests: 0 };
      }
      modelUsage[model].cost += data.cost;
      modelUsage[model].tokens += data.tokens;
      modelUsage[model].requests += data.requests;
    });
  });

  // Sort models by cost
  const sortedModels = Object.entries(modelUsage)
    .sort((a, b) => b[1].cost - a[1].cost);

  // Prepare chart data (last 14 days)
  const chartData = (state?.dailyUsage || [])
    .slice(-14)
    .map(day => ({
      date: day.date,
      cost: day.totalCost,
      requests: day.requestCount,
    }));

  const maxCost = Math.max(...chartData.map(d => d.cost), 0.01);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Budget Management
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            LLM cost tracking and optimization
          </p>
        </div>
        <div
          className="px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{
            background: `${getModeColor(currentStatus.mode)}20`,
            color: getModeColor(currentStatus.mode),
          }}
        >
          {currentStatus.mode.charAt(0).toUpperCase() + currentStatus.mode.slice(1)} Mode
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-4 gap-4">
        {/* Monthly Budget */}
        <div className="card-ari rounded-xl p-4">
          <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            Monthly Budget
          </div>
          <div className="text-3xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
            ${currentStatus.budget.toFixed(2)}
          </div>
        </div>

        {/* Spent */}
        <div className="card-ari rounded-xl p-4">
          <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            Spent
          </div>
          <div className="text-3xl font-bold mt-1" style={{ color: getStatusColor(currentStatus.status) }}>
            ${currentStatus.spent.toFixed(2)}
          </div>
        </div>

        {/* Remaining */}
        <div className="card-ari rounded-xl p-4">
          <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            Remaining
          </div>
          <div className="text-3xl font-bold mt-1" style={{ color: 'var(--ari-success)' }}>
            ${currentStatus.remaining.toFixed(2)}
          </div>
        </div>

        {/* Days Remaining */}
        <div className="card-ari rounded-xl p-4">
          <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            Days Remaining
          </div>
          <div className="text-3xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
            {currentStatus.daysRemaining}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="card-ari rounded-xl p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
            Budget Usage
          </span>
          <span
            className="text-sm font-medium px-2 py-0.5 rounded"
            style={{
              background: `${getStatusColor(currentStatus.status)}20`,
              color: getStatusColor(currentStatus.status),
            }}
          >
            {currentStatus.status.toUpperCase()}
          </span>
        </div>
        <div className="h-4 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${Math.min(100, currentStatus.percentUsed * 100)}%`,
              background: getStatusColor(currentStatus.status),
            }}
          />
        </div>
        <div className="flex justify-between mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          <span>{(currentStatus.percentUsed * 100).toFixed(1)}% used</span>
          <span>Recommended: ${currentStatus.recommendedDailySpend.toFixed(2)}/day</span>
        </div>
      </div>

      {/* Mode Info */}
      <div
        className="rounded-xl p-4 border"
        style={{
          background: `${getModeColor(currentStatus.mode)}10`,
          borderColor: `${getModeColor(currentStatus.mode)}30`,
        }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: getModeColor(currentStatus.mode) }}>●</span>
          <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
            Mode: {currentStatus.mode.charAt(0).toUpperCase() + currentStatus.mode.slice(1)}
          </span>
        </div>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {getModeDescription(currentStatus.mode)}
        </p>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-6">
        {/* Daily Usage Chart */}
        <div className="card-ari rounded-xl p-4">
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
            Daily Spending (Last 14 Days)
          </h2>
          {chartData.length > 0 ? (
            <div className="h-48 flex items-end gap-1">
              {chartData.map((day, i) => (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center group"
                >
                  <div className="relative w-full">
                    <div
                      className="w-full rounded-t transition-all hover:opacity-80"
                      style={{
                        height: `${Math.max(4, (day.cost / maxCost) * 160)}px`,
                        background: 'var(--ari-purple)',
                      }}
                    />
                    <div
                      className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-muted)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      ${day.cost.toFixed(4)}
                    </div>
                  </div>
                  {i % 2 === 0 && (
                    <div
                      className="text-[10px] mt-1 truncate w-full text-center"
                      style={{ color: 'var(--text-disabled)' }}
                    >
                      {new Date(day.date).getDate()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
              No usage data yet
            </div>
          )}
        </div>

        {/* Model Breakdown */}
        <div className="card-ari rounded-xl p-4">
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
            Model Usage
          </h2>
          {sortedModels.length > 0 ? (
            <div className="space-y-3">
              {sortedModels.map(([model, data]) => {
                const percentage = currentStatus.spent > 0 ? (data.cost / currentStatus.spent) * 100 : 0;
                return (
                  <div key={model}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {MODEL_NAMES[model] || model}
                      </span>
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        ${data.cost.toFixed(4)} ({data.requests} req)
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${percentage}%`,
                          background: MODEL_COLORS[model] || 'var(--ari-purple)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
              No model usage yet
            </div>
          )}
        </div>
      </div>

      {/* Spending Projections */}
      <div className="card-ari rounded-xl p-4">
        <h2 className="font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
          Spending Analysis
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Average Daily</div>
            <div className="text-xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
              ${currentStatus.avgDailySpend.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Projected Total</div>
            <div
              className="text-xl font-bold mt-1"
              style={{
                color: currentStatus.projectedSpend > currentStatus.budget
                  ? 'var(--ari-error)'
                  : 'var(--text-primary)',
              }}
            >
              ${currentStatus.projectedSpend.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Recommended Daily</div>
            <div className="text-xl font-bold mt-1" style={{ color: 'var(--ari-success)' }}>
              ${currentStatus.recommendedDailySpend.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Warning if over budget */}
        {currentStatus.projectedSpend > currentStatus.budget && (
          <div
            className="mt-4 p-3 rounded-lg text-sm"
            style={{
              background: 'var(--ari-error-muted)',
              color: 'var(--ari-error)',
            }}
          >
            ⚠️ At current rate, you'll exceed your ${currentStatus.budget} budget by $
            {(currentStatus.projectedSpend - currentStatus.budget).toFixed(2)}
          </div>
        )}
      </div>

      {/* Model Selection Guide */}
      <div className="card-ari rounded-xl p-4">
        <h2 className="font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
          Model Selection Guide
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <th className="text-left py-2 px-2" style={{ color: 'var(--text-muted)' }}>Task Type</th>
                <th className="text-left py-2 px-2" style={{ color: 'var(--text-muted)' }}>Conservative</th>
                <th className="text-left py-2 px-2" style={{ color: 'var(--text-muted)' }}>Balanced</th>
                <th className="text-left py-2 px-2" style={{ color: 'var(--text-muted)' }}>Aggressive</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td className="py-2 px-2" style={{ color: 'var(--text-secondary)' }}>Simple</td>
                <td className="py-2 px-2" style={{ color: 'var(--text-muted)' }}>Haiku 3</td>
                <td className="py-2 px-2" style={{ color: 'var(--text-muted)' }}>Haiku 3.5</td>
                <td className="py-2 px-2" style={{ color: 'var(--text-muted)' }}>Haiku 4.5</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td className="py-2 px-2" style={{ color: 'var(--text-secondary)' }}>Standard</td>
                <td className="py-2 px-2" style={{ color: 'var(--text-muted)' }}>Haiku 3.5</td>
                <td className="py-2 px-2" style={{ color: 'var(--text-muted)' }}>Sonnet 4</td>
                <td className="py-2 px-2" style={{ color: 'var(--text-muted)' }}>Sonnet 4.5</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td className="py-2 px-2" style={{ color: 'var(--text-secondary)' }}>Complex</td>
                <td className="py-2 px-2" style={{ color: 'var(--text-muted)' }}>Haiku 4.5</td>
                <td className="py-2 px-2" style={{ color: 'var(--text-muted)' }}>Sonnet 4.5</td>
                <td className="py-2 px-2" style={{ color: 'var(--text-muted)' }}>Opus 4.5</td>
              </tr>
              <tr>
                <td className="py-2 px-2" style={{ color: 'var(--text-secondary)' }}>Critical</td>
                <td className="py-2 px-2" style={{ color: 'var(--text-muted)' }}>Haiku 4.5</td>
                <td className="py-2 px-2" style={{ color: 'var(--text-muted)' }}>Sonnet 4.5</td>
                <td className="py-2 px-2" style={{ color: 'var(--text-muted)' }}>Opus 4.5</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
