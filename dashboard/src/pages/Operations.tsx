import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { useE2E } from '../hooks/useE2E';
import { TabGroup } from '../components/ui/TabGroup';
import { Card } from '../components/ui/Card';
import { MetricCard } from '../components/ui/MetricCard';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable } from '../components/ui/DataTable';
import { StatusBadge } from '../components/StatusBadge';

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

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export default function Operations() {
  const [activeTab, setActiveTab] = useState('budget');

  // Budget data
  const { data: status, isLoading: statusLoading } = useQuery<BudgetStatus>({
    queryKey: ['budget-status'],
    queryFn: async () => {
      const res = await fetch('/api/budget/status');
      if (!res.ok) throw new Error('Failed to fetch budget status');
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: state } = useQuery<BudgetState>({
    queryKey: ['budget-state'],
    queryFn: async () => {
      const res = await fetch('/api/budget/state');
      if (!res.ok) throw new Error('Failed to fetch budget state');
      return res.json();
    },
    refetchInterval: 60000,
  });

  // E2E data
  const {
    runs,
    passRate,
    lastRun,
    consecutiveFailures,
    totalRuns,
    liveRun,
    isLoading: e2eLoading,
  } = useE2E();

  const tabs = [
    { id: 'budget', label: 'Budget', icon: '💰' },
    { id: 'e2e', label: 'E2E Tests', icon: '✓' },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Operations"
        subtitle="Budget management and E2E test monitoring"
        icon="⚙️"
      />

      <TabGroup tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'budget' && (
        <BudgetTab status={status} state={state} isLoading={statusLoading} />
      )}

      {activeTab === 'e2e' && (
        <E2ETab
          runs={runs}
          passRate={passRate}
          lastRun={lastRun}
          consecutiveFailures={consecutiveFailures}
          totalRuns={totalRuns}
          liveRun={liveRun}
          isLoading={e2eLoading}
        />
      )}
    </div>
  );
}

interface BudgetTabProps {
  status: BudgetStatus | undefined;
  state: BudgetState | undefined;
  isLoading: boolean;
}

function BudgetTab({ status, state, isLoading }: BudgetTabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-ari-purple border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="p-6">
        <div className="text-center text-text-muted">
          Budget data unavailable. Start the gateway to enable tracking.
        </div>
      </div>
    );
  }

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

  const sortedModels = Object.entries(modelUsage).sort((a, b) => b[1].cost - a[1].cost);
  const chartData = (state?.dailyUsage || []).slice(-14).map(day => ({
    date: day.date,
    cost: day.totalCost,
    requests: day.requestCount,
  }));
  const maxCost = Math.max(...chartData.map(d => d.cost), 0.01);

  return (
    <div className="space-y-6">
      {/* Mode Badge */}
      <div
        className="px-3 py-1.5 rounded-lg text-sm font-medium inline-block"
        style={{
          background: `${getModeColor(status.mode)}20`,
          color: getModeColor(status.mode),
        }}
      >
        {status.mode.charAt(0).toUpperCase() + status.mode.slice(1)} Mode
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Monthly Budget" value={`$${status.budget.toFixed(2)}`} color="default" />
        <MetricCard
          label="Spent"
          value={`$${status.spent.toFixed(2)}`}
          color={status.status === 'ok' ? 'success' : status.status === 'warning' ? 'warning' : 'error'}
        />
        <MetricCard label="Remaining" value={`$${status.remaining.toFixed(2)}`} color="success" />
        <MetricCard label="Days Remaining" value={status.daysRemaining} color="default" />
      </div>

      {/* Progress Bar */}
      <Card>
        <div className="flex justify-between items-center mb-2">
          <span className="font-medium text-text-secondary">Budget Usage</span>
          <span
            className="text-sm font-medium px-2 py-0.5 rounded"
            style={{
              background: `${getStatusColor(status.status)}20`,
              color: getStatusColor(status.status),
            }}
          >
            {status.status.toUpperCase()}
          </span>
        </div>
        <div className="h-4 rounded-full overflow-hidden bg-bg-tertiary">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${Math.min(100, status.percentUsed * 100)}%`,
              background: getStatusColor(status.status),
            }}
          />
        </div>
        <div className="flex justify-between mt-2 text-sm text-text-muted">
          <span>{(status.percentUsed * 100).toFixed(1)}% used</span>
          <span>Recommended: ${status.recommendedDailySpend.toFixed(2)}/day</span>
        </div>
      </Card>

      {/* Mode Info */}
      <div
        className="rounded-xl p-4 border"
        style={{
          background: `${getModeColor(status.mode)}10`,
          borderColor: `${getModeColor(status.mode)}30`,
        }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: getModeColor(status.mode) }}>●</span>
          <span className="font-medium text-text-secondary">
            Mode: {status.mode.charAt(0).toUpperCase() + status.mode.slice(1)}
          </span>
        </div>
        <p className="text-sm mt-1 text-text-muted">{getModeDescription(status.mode)}</p>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-6">
        {/* Daily Usage Chart */}
        <Card>
          <h2 className="font-semibold mb-4 text-text-secondary">Daily Spending (Last 14 Days)</h2>
          {chartData.length > 0 ? (
            <div className="h-48 flex items-end gap-1">
              {chartData.map((day, i) => (
                <div key={day.date} className="flex-1 flex flex-col items-center group">
                  <div className="relative w-full">
                    <div
                      className="w-full rounded-t transition-all hover:opacity-80 bg-ari-purple"
                      style={{
                        height: `${Math.max(4, (day.cost / maxCost) * 160)}px`,
                      }}
                    />
                    <div
                      className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-bg-secondary border border-border-muted text-text-primary"
                    >
                      ${day.cost.toFixed(4)}
                    </div>
                  </div>
                  {i % 2 === 0 && (
                    <div className="text-[10px] mt-1 truncate w-full text-center text-text-disabled">
                      {new Date(day.date).getDate()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-text-muted">
              No usage data yet
            </div>
          )}
        </Card>

        {/* Model Breakdown */}
        <Card>
          <h2 className="font-semibold mb-4 text-text-secondary">Model Usage</h2>
          {sortedModels.length > 0 ? (
            <div className="space-y-3">
              {sortedModels.map(([model, data]) => {
                const percentage = status.spent > 0 ? (data.cost / status.spent) * 100 : 0;
                return (
                  <div key={model}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-text-secondary">
                        {MODEL_NAMES[model] || model}
                      </span>
                      <span className="text-sm text-text-muted">
                        ${data.cost.toFixed(4)} ({data.requests} req)
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden bg-bg-tertiary">
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
            <div className="h-full flex items-center justify-center text-text-muted">
              No model usage yet
            </div>
          )}
        </Card>
      </div>

      {/* Spending Projections */}
      <Card>
        <h2 className="font-semibold mb-4 text-text-secondary">Spending Analysis</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-text-muted">Average Daily</div>
            <div className="text-xl font-bold mt-1 text-text-primary">
              ${status.avgDailySpend.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-sm text-text-muted">Projected Total</div>
            <div
              className="text-xl font-bold mt-1"
              style={{
                color: status.projectedSpend > status.budget
                  ? 'var(--ari-error)'
                  : 'var(--text-primary)',
              }}
            >
              ${status.projectedSpend.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-sm text-text-muted">Recommended Daily</div>
            <div className="text-xl font-bold mt-1 text-ari-success">
              ${status.recommendedDailySpend.toFixed(2)}
            </div>
          </div>
        </div>

        {status.projectedSpend > status.budget && (
          <div className="mt-4 p-3 rounded-lg text-sm bg-ari-error-muted text-ari-error">
            ⚠️ At current rate, you'll exceed your ${status.budget} budget by $
            {(status.projectedSpend - status.budget).toFixed(2)}
          </div>
        )}
      </Card>

      {/* Model Selection Guide */}
      <Card>
        <h2 className="font-semibold mb-4 text-text-secondary">Model Selection Guide</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-muted">
                <th className="text-left py-2 px-2 text-text-muted">Task Type</th>
                <th className="text-left py-2 px-2 text-text-muted">Conservative</th>
                <th className="text-left py-2 px-2 text-text-muted">Balanced</th>
                <th className="text-left py-2 px-2 text-text-muted">Aggressive</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border-subtle">
                <td className="py-2 px-2 text-text-secondary">Simple</td>
                <td className="py-2 px-2 text-text-muted">Haiku 3</td>
                <td className="py-2 px-2 text-text-muted">Haiku 3.5</td>
                <td className="py-2 px-2 text-text-muted">Haiku 4.5</td>
              </tr>
              <tr className="border-b border-border-subtle">
                <td className="py-2 px-2 text-text-secondary">Standard</td>
                <td className="py-2 px-2 text-text-muted">Haiku 3.5</td>
                <td className="py-2 px-2 text-text-muted">Sonnet 4</td>
                <td className="py-2 px-2 text-text-muted">Sonnet 4.5</td>
              </tr>
              <tr className="border-b border-border-subtle">
                <td className="py-2 px-2 text-text-secondary">Complex</td>
                <td className="py-2 px-2 text-text-muted">Haiku 4.5</td>
                <td className="py-2 px-2 text-text-muted">Sonnet 4.5</td>
                <td className="py-2 px-2 text-text-muted">Opus 4.5</td>
              </tr>
              <tr>
                <td className="py-2 px-2 text-text-secondary">Critical</td>
                <td className="py-2 px-2 text-text-muted">Haiku 4.5</td>
                <td className="py-2 px-2 text-text-muted">Sonnet 4.5</td>
                <td className="py-2 px-2 text-text-muted">Opus 4.5</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

interface E2ETabProps {
  runs: any[];
  passRate: number;
  lastRun: string | null;
  consecutiveFailures: number;
  totalRuns: number;
  liveRun: any;
  isLoading: boolean;
}

function E2ETab({
  runs,
  passRate,
  lastRun,
  consecutiveFailures,
  totalRuns,
  liveRun,
  isLoading,
}: E2ETabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-ari-purple border-t-transparent rounded-full" />
      </div>
    );
  }

  const getPassRateColor = (rate: number) => {
    if (rate >= 95) return 'success';
    if (rate >= 80) return 'warning';
    return 'error';
  };

  return (
    <div className="space-y-6">
      {/* Live Run Progress */}
      {liveRun && (
        <Card variant="default" className="bg-bg-secondary border-border-muted">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
              Test Run in Progress
            </h2>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full animate-pulse bg-ari-info" />
              <span className="text-xs text-text-muted">Running</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-text-primary">
                  {liveRun.completed} / {liveRun.total}
                </div>
                <div className="text-sm text-text-muted">Scenarios completed</div>
              </div>
              <div className="flex gap-4">
                <div className="text-center">
                  <div className="text-xl font-mono text-ari-success">{liveRun.passed}</div>
                  <div className="text-xs text-text-muted">Passed</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-mono text-ari-error">{liveRun.failed}</div>
                  <div className="text-xs text-text-muted">Failed</div>
                </div>
              </div>
            </div>

            <div className="h-2 rounded-full overflow-hidden bg-bg-tertiary">
              <div
                className="h-full transition-all duration-300 bg-ari-info"
                style={{
                  width: `${(liveRun.completed / liveRun.total) * 100}%`,
                }}
              />
            </div>

            {liveRun.currentScenario && (
              <div className="text-xs font-mono text-text-muted">
                Current: {liveRun.currentScenario}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Pass Rate"
          value={`${passRate.toFixed(1)}%`}
          color={getPassRateColor(passRate)}
        />
        <MetricCard
          label="Last Run"
          value={lastRun ? formatDistanceToNow(new Date(lastRun), { addSuffix: true }) : 'Never'}
          color="default"
        />
        <MetricCard
          label="Consecutive Failures"
          value={consecutiveFailures.toString()}
          color={consecutiveFailures >= 2 ? 'error' : 'default'}
        />
        <MetricCard label="Total Runs" value={totalRuns.toString()} color="default" />
      </div>

      {/* Recent Runs Table */}
      <Card className="bg-bg-secondary border-border-muted">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
          Recent Test Runs
        </h2>
        {runs.length > 0 ? (
          <DataTable
            columns={[
              {
                key: 'startedAt',
                header: 'Time',
                render: (run) => (
                  <span className="font-mono text-sm text-text-secondary">
                    {format(new Date(run.startedAt), 'MMM d, HH:mm:ss')}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (run) => (
                  <StatusBadge
                    status={run.status === 'passed' ? 'healthy' : 'unhealthy'}
                    size="sm"
                  />
                ),
              },
              {
                key: 'passed',
                header: 'Passed',
                align: 'center',
                render: (run) => (
                  <span className="font-mono text-sm text-ari-success">{run.passed}</span>
                ),
              },
              {
                key: 'failed',
                header: 'Failed',
                align: 'center',
                render: (run) => (
                  <span className="font-mono text-sm text-ari-error">{run.failed}</span>
                ),
              },
              {
                key: 'duration',
                header: 'Duration',
                align: 'right',
                render: (run) => (
                  <span className="font-mono text-sm text-text-muted">
                    {run.duration ? formatDuration(run.duration) : '-'}
                  </span>
                ),
              },
            ]}
            data={runs.slice(0, 15)}
            getRowKey={(run) => run.id}
          />
        ) : (
          <div className="rounded-lg p-8 text-center border border-dashed border-border-muted">
            <div className="text-sm text-text-muted">No test runs recorded</div>
          </div>
        )}
      </Card>
    </div>
  );
}
