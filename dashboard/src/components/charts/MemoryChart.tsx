import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { format } from 'date-fns';

interface MemoryDataPoint {
  timestamp: string;
  heapUsed: number;
  heapTotal: number;
  rss?: number;
}

interface MemoryChartProps {
  data: MemoryDataPoint[];
  height?: number;
  showRss?: boolean;
}

const formatMB = (value: number): string => `${value.toFixed(1)} MB`;

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: MemoryDataPoint }>;
}

const CustomTooltip = ({
  active,
  payload,
}: CustomTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload as MemoryDataPoint;
  const time = format(new Date(data.timestamp), 'HH:mm:ss');

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="mb-2 text-xs text-gray-400">{time}</p>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-purple-500" />
          <span className="text-xs text-gray-400">Heap Used:</span>
          <span className="font-mono text-xs text-white">{formatMB(data.heapUsed)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-cyan-500" />
          <span className="text-xs text-gray-400">Heap Total:</span>
          <span className="font-mono text-xs text-white">{formatMB(data.heapTotal)}</span>
        </div>
        {data.rss !== undefined && (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="text-xs text-gray-400">RSS:</span>
            <span className="font-mono text-xs text-white">{formatMB(data.rss)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export function MemoryChart({ data, height = 250, showRss = false }: MemoryChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-gray-700 text-sm text-gray-500"
        style={{ height }}
      >
        No memory data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={data}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="heapUsedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="heapTotalGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="rssGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
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
          tickFormatter={(v: number) => `${v}MB`}
          stroke="#6b7280"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          width={45}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          verticalAlign="top"
          height={36}
          iconType="circle"
          wrapperStyle={{ fontSize: '11px' }}
        />
        {showRss && (
          <Area
            type="monotone"
            dataKey="rss"
            name="RSS"
            stroke="#f59e0b"
            fill="url(#rssGradient)"
            strokeWidth={1.5}
          />
        )}
        <Area
          type="monotone"
          dataKey="heapTotal"
          name="Heap Total"
          stroke="#06b6d4"
          fill="url(#heapTotalGradient)"
          strokeWidth={1.5}
        />
        <Area
          type="monotone"
          dataKey="heapUsed"
          name="Heap Used"
          stroke="#8b5cf6"
          fill="url(#heapUsedGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
