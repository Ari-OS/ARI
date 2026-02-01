import { useMemo } from 'react';

interface HealthScoreGaugeProps {
  score: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
  trend?: 'up' | 'down' | 'stable';
  previousScore?: number;
}

const SIZE_CONFIG = {
  sm: { width: 80, strokeWidth: 6, fontSize: 'text-lg', labelSize: 'text-[10px]' },
  md: { width: 120, strokeWidth: 8, fontSize: 'text-2xl', labelSize: 'text-xs' },
  lg: { width: 160, strokeWidth: 10, fontSize: 'text-3xl', labelSize: 'text-sm' },
};

export function HealthScoreGauge({
  score,
  size = 'md',
  showLabel = true,
  label = 'Health',
  trend,
  previousScore,
}: HealthScoreGaugeProps) {
  const config = SIZE_CONFIG[size];
  const radius = (config.width - config.strokeWidth) / 2;
  const circumference = radius * Math.PI; // Half circle
  const progress = Math.min(Math.max(score, 0), 100);
  const offset = circumference - (progress / 100) * circumference;

  const color = useMemo(() => {
    if (score >= 90) return { stroke: '#10b981', text: 'text-emerald-400', bg: 'from-emerald-900/20' };
    if (score >= 70) return { stroke: '#22c55e', text: 'text-green-400', bg: 'from-green-900/20' };
    if (score >= 50) return { stroke: '#f59e0b', text: 'text-amber-400', bg: 'from-amber-900/20' };
    if (score >= 30) return { stroke: '#f97316', text: 'text-orange-400', bg: 'from-orange-900/20' };
    return { stroke: '#ef4444', text: 'text-red-400', bg: 'from-red-900/20' };
  }, [score]);

  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400';

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: config.width, height: config.width / 2 + 20 }}>
        <svg
          width={config.width}
          height={config.width / 2 + config.strokeWidth}
          viewBox={`0 0 ${config.width} ${config.width / 2 + config.strokeWidth}`}
          className="overflow-visible"
        >
          {/* Background arc */}
          <path
            d={`M ${config.strokeWidth / 2} ${config.width / 2} A ${radius} ${radius} 0 0 1 ${config.width - config.strokeWidth / 2} ${config.width / 2}`}
            fill="none"
            stroke="#374151"
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
          />
          {/* Progress arc */}
          <path
            d={`M ${config.strokeWidth / 2} ${config.width / 2} A ${radius} ${radius} 0 0 1 ${config.width - config.strokeWidth / 2} ${config.width / 2}`}
            fill="none"
            stroke={color.stroke}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 0.5s ease-in-out, stroke 0.3s ease',
              filter: `drop-shadow(0 0 6px ${color.stroke}40)`,
            }}
          />
        </svg>

        {/* Score display */}
        <div
          className="absolute inset-x-0 flex flex-col items-center"
          style={{ top: config.width / 2 - 10 }}
        >
          <div className={`font-bold ${config.fontSize} ${color.text}`}>
            {Math.round(score)}
          </div>
          {showLabel && (
            <div className={`${config.labelSize} uppercase tracking-wider text-gray-500`}>
              {label}
            </div>
          )}
        </div>
      </div>

      {/* Trend indicator */}
      {trend && (
        <div className={`mt-1 flex items-center gap-1 ${trendColor}`}>
          <span className="text-sm">{trendIcon}</span>
          {previousScore !== undefined && (
            <span className="text-xs">
              {Math.abs(score - previousScore).toFixed(1)}
            </span>
          )}
        </div>
      )}

      {/* Min/Max labels */}
      <div className="flex w-full justify-between px-2" style={{ marginTop: -8 }}>
        <span className="text-[10px] text-gray-600">0</span>
        <span className="text-[10px] text-gray-600">100</span>
      </div>
    </div>
  );
}

// Compact inline health indicator
interface InlineHealthProps {
  score: number;
  showScore?: boolean;
}

export function InlineHealth({ score, showScore = true }: InlineHealthProps) {
  const color = score >= 90 ? 'bg-emerald-500' : score >= 70 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : score >= 30 ? 'bg-orange-500' : 'bg-red-500';
  const textColor = score >= 90 ? 'text-emerald-400' : score >= 70 ? 'text-green-400' : score >= 50 ? 'text-amber-400' : score >= 30 ? 'text-orange-400' : 'text-red-400';

  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full ${color}`} />
      {showScore && <span className={`font-mono text-xs ${textColor}`}>{score}%</span>}
    </div>
  );
}
