import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { format } from 'date-fns';

export interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
}

interface TimeSeriesChartProps {
  data: TimeSeriesDataPoint[];
  color?: string;
  height?: number;
  showGrid?: boolean;
  showAxis?: boolean;
  formatValue?: (value: number) => string;
  formatTime?: (timestamp: string) => string;
  unit?: string;
  title?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: TimeSeriesDataPoint }>;
  formatValue?: (value: number) => string;
  formatTime?: (timestamp: string) => string;
  unit?: string;
}

const CustomTooltip = ({
  active,
  payload,
  formatValue,
  formatTime,
  unit,
}: CustomTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const time = formatTime
    ? formatTime(data.timestamp)
    : format(new Date(data.timestamp), 'HH:mm:ss');
  const value = formatValue ? formatValue(data.value) : data.value.toFixed(2);

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="text-xs text-gray-400">{time}</p>
      <p className="font-mono text-sm font-medium text-white">
        {value}
        {unit && <span className="ml-1 text-gray-400">{unit}</span>}
      </p>
    </div>
  );
};

export function TimeSeriesChart({
  data,
  color = '#8b5cf6',
  height = 200,
  showGrid = true,
  showAxis = true,
  formatValue,
  formatTime,
  unit,
  title,
}: TimeSeriesChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-gray-700 text-sm text-gray-500"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  return (
    <div>
      {title && (
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 5, left: showAxis ? 0 : -20, bottom: 5 }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#374151"
              vertical={false}
            />
          )}
          {showAxis && (
            <XAxis
              dataKey="timestamp"
              tickFormatter={(ts: string) =>
                formatTime ? formatTime(ts) : format(new Date(ts), 'HH:mm')
              }
              stroke="#6b7280"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
          )}
          {showAxis && (
            <YAxis
              tickFormatter={(v: number) => (formatValue ? formatValue(v) : v.toString())}
              stroke="#6b7280"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              width={40}
            />
          )}
          <Tooltip
            content={<CustomTooltip formatValue={formatValue} formatTime={formatTime} unit={unit} />}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: color }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
