import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { useValueDaily } from '../../hooks/useValueAnalytics';
import type { DayValueAnalysis } from '../../api/client';

interface ValueTrendChartProps {
  days?: number;
  height?: number;
  showGrid?: boolean;
  showThresholds?: boolean;
  title?: string;
}

interface ChartDataPoint {
  date: string;
  valueScore: number;
  cost: number;
  costPerPoint: number;
  efficiency: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartDataPoint }>;
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'var(--ari-success)';
  if (score >= 50) return 'var(--ari-info)';
  if (score >= 30) return 'var(--ari-warning)';
  return 'var(--ari-error)';
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const scoreColor = getScoreColor(data.valueScore);

  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-lg backdrop-blur-sm"
      style={{
        background: 'var(--bg-tertiary)',
        borderColor: 'var(--border-muted)',
      }}
    >
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {format(parseISO(data.date), 'MMM d, yyyy')}
      </p>
      <p
        className="font-mono text-lg font-bold"
        style={{ color: scoreColor }}
      >
        {data.valueScore}/100
      </p>
      <div className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
        <div>Cost: ${data.cost.toFixed(2)}</div>
        <div>$/pt: ${data.costPerPoint.toFixed(3)}</div>
        <div className="capitalize">Efficiency: {data.efficiency}</div>
      </div>
    </div>
  );
};

export function ValueTrendChart({
  days = 7,
  height = 200,
  showGrid = true,
  showThresholds = true,
  title,
}: ValueTrendChartProps) {
  const { data, isLoading, isError } = useValueDaily(days);

  if (isLoading) {
    return (
      <div
        className="rounded-xl p-4"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-muted)',
        }}
      >
        {title && (
          <h3
            className="mb-4 text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            {title}
          </h3>
        )}
        <div
          className="animate-pulse rounded"
          style={{ height, background: 'var(--bg-tertiary)' }}
        />
      </div>
    );
  }

  if (isError || !data || data.length === 0) {
    return (
      <div
        className="rounded-xl p-4"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-muted)',
        }}
      >
        {title && (
          <h3
            className="mb-4 text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            {title}
          </h3>
        )}
        <div
          className="flex items-center justify-center rounded-lg text-sm"
          style={{
            height,
            border: '1px dashed var(--border-muted)',
            color: 'var(--text-muted)',
          }}
        >
          No value data available
        </div>
      </div>
    );
  }

  // Transform data for the chart
  const chartData: ChartDataPoint[] = data.map((day: DayValueAnalysis) => ({
    date: day.date,
    valueScore: day.totalValueScore,
    cost: day.cost,
    costPerPoint: day.costPerPoint,
    efficiency: day.efficiency,
  }));

  // Calculate trend
  const avgScore = chartData.reduce((sum, d) => sum + d.valueScore, 0) / chartData.length;
  const trendColor = avgScore >= 60 ? 'var(--ari-success)' :
                     avgScore >= 40 ? 'var(--ari-warning)' :
                     'var(--ari-error)';

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-muted)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        {title && (
          <h3
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            {title}
          </h3>
        )}
        <div className="flex items-center gap-2 text-xs">
          <span style={{ color: 'var(--text-muted)' }}>Avg:</span>
          <span className="font-mono font-bold" style={{ color: trendColor }}>
            {avgScore.toFixed(0)}
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-muted)"
              vertical={false}
            />
          )}

          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => format(parseISO(d), 'EEE')}
            stroke="var(--text-muted)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />

          <YAxis
            domain={[0, 100]}
            stroke="var(--text-muted)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            width={30}
            tickFormatter={(v: number) => v.toString()}
          />

          {/* Reference lines for thresholds */}
          {showThresholds && (
            <>
              <ReferenceLine
                y={50}
                stroke="var(--text-tertiary)"
                strokeDasharray="5 5"
                strokeOpacity={0.5}
              />
              <ReferenceLine
                y={70}
                stroke="var(--ari-success)"
                strokeDasharray="3 3"
                strokeOpacity={0.3}
              />
            </>
          )}

          <Tooltip content={<CustomTooltip />} />

          <Line
            type="monotone"
            dataKey="valueScore"
            stroke="var(--ari-accent)"
            strokeWidth={2}
            dot={{
              fill: 'var(--ari-accent)',
              strokeWidth: 0,
              r: 3,
            }}
            activeDot={{
              r: 5,
              fill: 'var(--ari-accent)',
              strokeWidth: 2,
              stroke: 'var(--bg-card)',
            }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      {showThresholds && (
        <div
          className="mt-3 pt-3 flex justify-center gap-4 text-xs"
          style={{ borderTop: '1px solid var(--border-muted)' }}
        >
          <div className="flex items-center gap-1">
            <div
              className="w-3 h-0.5"
              style={{ background: 'var(--text-tertiary)', opacity: 0.5 }}
            />
            <span style={{ color: 'var(--text-muted)' }}>Baseline (50)</span>
          </div>
          <div className="flex items-center gap-1">
            <div
              className="w-3 h-0.5"
              style={{ background: 'var(--ari-success)', opacity: 0.3 }}
            />
            <span style={{ color: 'var(--text-muted)' }}>Good (70)</span>
          </div>
        </div>
      )}
    </div>
  );
}
