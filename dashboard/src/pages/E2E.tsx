import { useE2E } from '../hooks/useE2E';
import { StatusBadge } from '../components/StatusBadge';
import { TimeSeriesChart, type TimeSeriesDataPoint } from '../components/charts/TimeSeriesChart';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorState } from '../components/ui/ErrorState';
import { format, formatDistanceToNow } from 'date-fns';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function E2E() {
  const {
    runs,
    passRate,
    lastRun,
    consecutiveFailures,
    totalRuns,
    liveRun,
    isLoading,
    isError,
  } = useE2E();

  if (isLoading) {
    return (
      <div className="min-h-screen p-8" style={{ background: 'var(--bg-primary)' }}>
        <div className="mb-8">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            E2E Testing
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading test results...
          </p>
        </div>
        <LoadingState message="Loading E2E test data..." />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen p-8" style={{ background: 'var(--bg-primary)' }}>
        <div className="mb-8">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            E2E Testing
          </h1>
        </div>
        <ErrorState
          title="Failed to load E2E test data"
          message="Could not connect to ARI gateway. Ensure the gateway is running."
        />
      </div>
    );
  }

  // Calculate pass rate color
  const getPassRateColor = (rate: number) => {
    if (rate >= 95) return 'var(--ari-success)';
    if (rate >= 80) return 'var(--ari-warning)';
    return 'var(--ari-error)';
  };

  const getPassRateBg = (rate: number) => {
    if (rate >= 95) return 'var(--ari-success-muted)';
    if (rate >= 80) return 'var(--ari-warning-muted)';
    return 'var(--ari-error-muted)';
  };

  // Prepare chart data (last 10 runs)
  const chartData: TimeSeriesDataPoint[] = runs
    .slice(0, 10)
    .reverse()
    .map((run) => ({
      timestamp: run.startedAt,
      value: run.total > 0 ? (run.passed / run.total) * 100 : 0,
    }));

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header
        className="px-8 py-6 backdrop-blur-md"
        style={{
          borderBottom: '1px solid var(--border-muted)',
          background: 'var(--bg-glass)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{
                background: getPassRateBg(passRate),
                color: getPassRateColor(passRate),
              }}
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                E2E Testing
              </h1>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                End-to-end test suite monitoring
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Pass Rate
              </div>
              <div
                className="font-mono text-lg"
                style={{ color: getPassRateColor(passRate) }}
              >
                {passRate.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-8 space-y-6">
        {/* Live Run Progress */}
        {liveRun && (
          <div
            className="rounded-xl p-6 card-ari"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-muted)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-sm font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                Test Run in Progress
              </h2>
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full animate-pulse"
                  style={{ background: 'var(--ari-info)' }}
                />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Running
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    {liveRun.completed} / {liveRun.total}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Scenarios completed
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="text-center">
                    <div
                      className="text-xl font-mono"
                      style={{ color: 'var(--ari-success)' }}
                    >
                      {liveRun.passed}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Passed
                    </div>
                  </div>
                  <div className="text-center">
                    <div
                      className="text-xl font-mono"
                      style={{ color: 'var(--ari-error)' }}
                    >
                      {liveRun.failed}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Failed
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ background: 'var(--bg-tertiary)' }}
              >
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${(liveRun.completed / liveRun.total) * 100}%`,
                    background: 'var(--ari-info)',
                  }}
                />
              </div>

              {liveRun.currentScenario && (
                <div
                  className="text-xs font-mono"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Current: {liveRun.currentScenario}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Pass Rate"
            value={`${passRate.toFixed(1)}%`}
            color={getPassRateColor(passRate)}
            bg={getPassRateBg(passRate)}
          />
          <StatCard
            label="Last Run"
            value={lastRun ? formatDistanceToNow(new Date(lastRun), { addSuffix: true }) : 'Never'}
            color="var(--text-primary)"
            bg="var(--bg-tertiary)"
          />
          <StatCard
            label="Consecutive Failures"
            value={consecutiveFailures.toString()}
            color={consecutiveFailures >= 2 ? 'var(--ari-error)' : 'var(--text-primary)'}
            bg={consecutiveFailures >= 2 ? 'var(--ari-error-muted)' : 'var(--bg-tertiary)'}
          />
          <StatCard
            label="Total Runs"
            value={totalRuns.toString()}
            color="var(--text-primary)"
            bg="var(--bg-tertiary)"
          />
        </div>

        {/* Pass Rate Trend Chart */}
        <div
          className="rounded-xl p-6 card-ari"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-muted)',
          }}
        >
          <h2
            className="mb-4 text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Pass Rate Trend (Last 10 Runs)
          </h2>
          {chartData.length > 0 ? (
            <TimeSeriesChart
              data={chartData}
              color="var(--ari-info)"
              height={200}
              formatValue={(v) => `${v.toFixed(1)}%`}
              formatTime={(ts) => format(new Date(ts), 'MMM d HH:mm')}
              unit="%"
            />
          ) : (
            <div
              className="flex items-center justify-center rounded-lg border border-dashed border-gray-700 text-sm text-gray-500"
              style={{ height: 200 }}
            >
              No test runs available
            </div>
          )}
        </div>

        {/* Recent Runs Table */}
        <div
          className="rounded-xl p-6 card-ari"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-muted)',
          }}
        >
          <h2
            className="mb-4 text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Recent Test Runs
          </h2>
          {runs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid var(--border-muted)',
                    }}
                  >
                    <th
                      className="pb-3 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Time
                    </th>
                    <th
                      className="pb-3 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Status
                    </th>
                    <th
                      className="pb-3 text-center text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Passed
                    </th>
                    <th
                      className="pb-3 text-center text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Failed
                    </th>
                    <th
                      className="pb-3 text-right text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Duration
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {runs.slice(0, 15).map((run) => (
                    <tr
                      key={run.id}
                      style={{
                        borderBottom: '1px solid var(--border-muted)',
                      }}
                    >
                      <td className="py-3 font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {format(new Date(run.startedAt), 'MMM d, HH:mm:ss')}
                      </td>
                      <td className="py-3">
                        <StatusBadge
                          status={run.status === 'passed' ? 'healthy' : 'unhealthy'}
                          size="sm"
                        />
                      </td>
                      <td
                        className="py-3 text-center font-mono text-sm"
                        style={{ color: 'var(--ari-success)' }}
                      >
                        {run.passed}
                      </td>
                      <td
                        className="py-3 text-center font-mono text-sm"
                        style={{ color: 'var(--ari-error)' }}
                      >
                        {run.failed}
                      </td>
                      <td
                        className="py-3 text-right font-mono text-sm"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {run.duration ? formatDuration(run.duration) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              className="rounded-lg p-8 text-center"
              style={{ border: '1px dashed var(--border-muted)' }}
            >
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No test runs recorded
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  color: string;
  bg: string;
}

function StatCard({ label, value, color, bg }: StatCardProps) {
  return (
    <div
      className="rounded-xl p-6 card-ari"
      style={{
        background: bg,
        border: '1px solid var(--border-muted)',
      }}
    >
      <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold font-mono" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

export default E2E;
