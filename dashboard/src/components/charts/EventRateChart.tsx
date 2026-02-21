import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { format } from 'date-fns';

interface EventRateDataPoint {
  timestamp: string;
  rate: number;
}

interface EventRateChartProps {
  data: EventRateDataPoint[];
  height?: number;
  color?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: EventRateDataPoint }>;
}

const CustomTooltip = ({
  active,
  payload,
}: CustomTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const time = format(new Date(data.timestamp), 'HH:mm:ss');

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="text-xs text-gray-400">{time}</p>
      <p className="font-mono text-sm font-medium text-white">
        {data.rate.toFixed(2)}
        <span className="ml-1 text-gray-400">events/s</span>
      </p>
    </div>
  );
};

export function EventRateChart({
  data,
  height = 150,
  color = '#10b981',
}: EventRateChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-gray-700 text-sm text-gray-500"
        style={{ height }}
      >
        No event data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={data}
        margin={{ top: 5, right: 5, left: -10, bottom: 5 }}
      >
        <defs>
          <linearGradient id="eventRateGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.4} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
        <XAxis
          dataKey="timestamp"
          tickFormatter={(ts: string) => format(new Date(ts), 'HH:mm')}
          stroke="#6b7280"
          fontSize={10}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => v.toFixed(1)}
          stroke="#6b7280"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          width={30}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="rate"
          stroke={color}
          fill="url(#eventRateGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
