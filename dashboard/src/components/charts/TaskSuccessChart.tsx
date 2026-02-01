import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface TaskStats {
  taskId: string;
  taskName: string;
  successCount: number;
  failureCount: number;
  successRate: number;
}

interface TaskSuccessChartProps {
  data: TaskStats[];
  height?: number;
  layout?: 'horizontal' | 'vertical';
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: TaskStats }>;
}

const CustomTooltip = ({
  active,
  payload,
}: CustomTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload as TaskStats;

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="mb-2 text-xs font-medium text-white">{data.taskName}</p>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-gray-400">Success:</span>
          <span className="font-mono text-xs text-white">{data.successCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <span className="text-xs text-gray-400">Failure:</span>
          <span className="font-mono text-xs text-white">{data.failureCount}</span>
        </div>
        <div className="border-t border-gray-700 pt-1">
          <span className="text-xs text-gray-400">Rate: </span>
          <span className={`font-mono text-xs ${data.successRate >= 80 ? 'text-emerald-400' : data.successRate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
            {data.successRate}%
          </span>
        </div>
      </div>
    </div>
  );
};

export function TaskSuccessChart({
  data,
  height = 250,
  layout = 'horizontal',
}: TaskSuccessChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-gray-700 text-sm text-gray-500"
        style={{ height }}
      >
        No task data available
      </div>
    );
  }

  // Truncate task names for display
  const chartData = data.map(d => ({
    ...d,
    displayName: d.taskName.length > 15 ? d.taskName.slice(0, 15) + '...' : d.taskName,
  }));

  if (layout === 'vertical') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 10, left: 80, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
          <XAxis type="number" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="displayName"
            stroke="#6b7280"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            width={75}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#374151', opacity: 0.3 }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
          <Bar dataKey="successCount" name="Success" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
          <Bar dataKey="failureCount" name="Failure" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
        <XAxis
          dataKey="displayName"
          stroke="#6b7280"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#374151', opacity: 0.3 }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
        <Bar dataKey="successCount" name="Success" stackId="a" fill="#10b981" />
        <Bar dataKey="failureCount" name="Failure" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Mini version for dashboard cards
interface MiniSuccessBarProps {
  successRate: number;
  size?: 'sm' | 'md';
}

export function MiniSuccessBar({ successRate, size = 'sm' }: MiniSuccessBarProps) {
  const height = size === 'sm' ? 'h-1.5' : 'h-2';
  const color = successRate >= 80 ? 'bg-emerald-500' : successRate >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className={`w-full ${height} rounded-full bg-gray-700 overflow-hidden`}>
      <div
        className={`${height} ${color} rounded-full transition-all duration-500`}
        style={{ width: `${successRate}%` }}
      />
    </div>
  );
}
