/**
 * InsightBlockRenderer — React component for cognitive insights
 *
 * Renders normalized metrics with:
 * - Visual gauges (0-10 scale)
 * - Pillar color coding (LOGOS blue, ETHOS orange, PATHOS green)
 * - Traffic light indicators (STOP/CAUTION/PROCEED)
 * - Contextual comparables ("This is like...")
 * - DO/DON'T/CAUTION recommendations
 */

import { useMemo } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export type Pillar = 'LOGOS' | 'ETHOS' | 'PATHOS' | 'MULTI';
export type ScoreCategory = 'EXCELLENT' | 'GOOD' | 'MODERATE' | 'HIGH_RISK' | 'CRITICAL';
export type TrafficLight = 'PROCEED' | 'CAUTION' | 'STOP';
export type ActionType = 'DO' | 'DONT' | 'CAUTION';

export interface NormalizedMetric {
  name: string;
  score: number;
  category: ScoreCategory;
  trafficLight: TrafficLight;
  comparable?: string;
  recommendation: {
    action: ActionType;
    statement: string;
  };
}

export interface InsightBlockProps {
  title: string;
  pillar: Pillar;
  metrics: NormalizedMetric[];
  recommendation?: {
    action: ActionType;
    statement: string;
    reasons: string[];
    alternatives?: string[];
    overallScore: number;
  };
  className?: string;
}

// =============================================================================
// PILLAR CONFIGURATION
// =============================================================================

const PILLAR_CONFIG = {
  LOGOS: {
    icon: '🧠',
    name: 'Reason',
    colorVar: 'var(--pillar-logos)',
    bgClass: 'bg-blue-500/10',
    borderClass: 'border-blue-500/30',
    textClass: 'text-blue-400',
  },
  ETHOS: {
    icon: '❤️',
    name: 'Character',
    colorVar: 'var(--pillar-ethos)',
    bgClass: 'bg-orange-500/10',
    borderClass: 'border-orange-500/30',
    textClass: 'text-orange-400',
  },
  PATHOS: {
    icon: '🌱',
    name: 'Growth',
    colorVar: 'var(--pillar-pathos)',
    bgClass: 'bg-green-500/10',
    borderClass: 'border-green-500/30',
    textClass: 'text-green-400',
  },
  MULTI: {
    icon: '🎯',
    name: 'Multi-Pillar',
    colorVar: 'var(--ari-purple)',
    bgClass: 'bg-purple-500/10',
    borderClass: 'border-purple-500/30',
    textClass: 'text-purple-400',
  },
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface GaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function Gauge({ score, size = 'md', showLabel = true }: GaugeProps) {
  const percentage = (score / 10) * 100;
  const color = score >= 7 ? 'text-green-400' : score >= 5 ? 'text-yellow-400' : 'text-red-400';
  const bgColor = score >= 7 ? 'bg-green-500' : score >= 5 ? 'bg-yellow-500' : 'bg-red-500';

  const widths = { sm: 'w-24', md: 'w-32', lg: 'w-48' };
  const heights = { sm: 'h-2', md: 'h-3', lg: 'h-4' };

  return (
    <div className={`flex items-center gap-2 ${widths[size]}`}>
      <div className={`flex-1 ${heights[size]} bg-slate-700 rounded-full overflow-hidden`}>
        <div
          className={`${heights[size]} ${bgColor} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className={`text-sm font-mono ${color}`}>{score.toFixed(1)}</span>
      )}
    </div>
  );
}

interface TrafficLightIndicatorProps {
  light: TrafficLight;
  size?: 'sm' | 'md';
}

export function TrafficLightIndicator({ light, size = 'md' }: TrafficLightIndicatorProps) {
  const config = {
    PROCEED: { emoji: '🟢', color: 'text-green-400', label: 'Proceed' },
    CAUTION: { emoji: '🟡', color: 'text-yellow-400', label: 'Caution' },
    STOP: { emoji: '🔴', color: 'text-red-400', label: 'Stop' },
  }[light];

  return (
    <span className={`flex items-center gap-1 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
      <span>{config.emoji}</span>
      <span className={config.color}>{config.label}</span>
    </span>
  );
}

interface ActionBadgeProps {
  action: ActionType;
}

export function ActionBadge({ action }: ActionBadgeProps) {
  const config = {
    DO: {
      label: 'PROCEED',
      emoji: '✅',
      classes: 'bg-green-500/20 border-green-500/40 text-green-300',
    },
    DONT: {
      label: 'DO NOT PROCEED',
      emoji: '❌',
      classes: 'bg-red-500/20 border-red-500/40 text-red-300',
    },
    CAUTION: {
      label: 'PROCEED WITH CAUTION',
      emoji: '⚠️',
      classes: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300',
    },
  }[action];

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.classes}`}>
      <span>{config.emoji}</span>
      <span className="font-semibold text-sm">{config.label}</span>
    </div>
  );
}

interface MetricRowProps {
  metric: NormalizedMetric;
}

export function MetricRow({ metric }: MetricRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-200">{metric.name}</span>
        {metric.comparable && (
          <span className="text-xs text-slate-400">≈ {metric.comparable}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Gauge score={metric.score} size="sm" />
        <TrafficLightIndicator light={metric.trafficLight} size="sm" />
      </div>
    </div>
  );
}

interface RecommendationBoxProps {
  recommendation: NonNullable<InsightBlockProps['recommendation']>;
}

export function RecommendationBox({ recommendation }: RecommendationBoxProps) {
  const bgConfig = {
    DO: 'bg-green-500/10 border-green-500/30',
    DONT: 'bg-red-500/10 border-red-500/30',
    CAUTION: 'bg-yellow-500/10 border-yellow-500/30',
  }[recommendation.action];

  return (
    <div className={`rounded-xl border p-4 ${bgConfig}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <ActionBadge action={recommendation.action} />
        <Gauge score={recommendation.overallScore} size="md" />
      </div>

      {/* Statement */}
      <p className="text-sm text-slate-200 mb-3">{recommendation.statement}</p>

      {/* Reasons */}
      {recommendation.reasons.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-slate-400 mb-1">Reasoning:</p>
          <ul className="space-y-1">
            {recommendation.reasons.slice(0, 4).map((reason, i) => (
              <li key={i} className="text-xs text-slate-300 flex items-start gap-1">
                <span>{reason.startsWith('✓') ? '✓' : reason.startsWith('✗') ? '✗' : '○'}</span>
                <span>{reason.replace(/^[✓✗○]\s*/, '')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Alternatives (for DONT recommendations) */}
      {recommendation.action === 'DONT' && recommendation.alternatives && recommendation.alternatives.length > 0 && (
        <div>
          <p className="text-xs text-slate-400 mb-1">Instead, consider:</p>
          <ul className="space-y-1">
            {recommendation.alternatives.slice(0, 3).map((alt, i) => (
              <li key={i} className="text-xs text-slate-300 flex items-start gap-1">
                <span>•</span>
                <span>{alt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function InsightBlockRenderer({
  title,
  pillar,
  metrics,
  recommendation,
  className = '',
}: InsightBlockProps) {
  const config = PILLAR_CONFIG[pillar];

  const averageScore = useMemo(() => {
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length;
  }, [metrics]);

  return (
    <div
      className={`
        rounded-2xl border backdrop-blur-md
        ${config.bgClass} ${config.borderClass}
        overflow-hidden transition-all duration-300
        hover:border-opacity-50 hover:shadow-lg
        ${className}
      `}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{config.icon}</span>
          <div>
            <h3 className={`font-semibold ${config.textClass}`}>{pillar}</h3>
            <p className="text-xs text-slate-400">{title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Gauge score={averageScore} size="sm" />
        </div>
      </div>

      {/* Metrics */}
      <div className="px-4 py-2">
        {metrics.map((metric, i) => (
          <MetricRow key={i} metric={metric} />
        ))}
      </div>

      {/* Recommendation */}
      {recommendation && (
        <div className="px-4 pb-4">
          <RecommendationBox recommendation={recommendation} />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// PILLAR COMPARISON COMPONENT
// =============================================================================

interface PillarComparisonProps {
  logos: number;
  ethos: number;
  pathos: number;
}

export function PillarComparison({ logos, ethos, pathos }: PillarComparisonProps) {
  const pillars = [
    { name: 'LOGOS', icon: '🧠', score: logos, color: 'bg-blue-500' },
    { name: 'ETHOS', icon: '❤️', score: ethos, color: 'bg-orange-500' },
    { name: 'PATHOS', icon: '🌱', score: pathos, color: 'bg-green-500' },
  ];

  return (
    <div className="card-ari p-4">
      <h4 className="text-sm font-semibold text-slate-300 mb-3">Pillar Comparison</h4>
      <div className="space-y-3">
        {pillars.map(({ name, icon, score, color }) => (
          <div key={name} className="flex items-center gap-3">
            <span className="w-8 text-center">{icon}</span>
            <span className="w-16 text-xs text-slate-400">{name}</span>
            <div className="flex-1 h-3 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${color} rounded-full transition-all duration-500`}
                style={{ width: `${(score / 10) * 100}%` }}
              />
            </div>
            <span className="w-10 text-right text-sm font-mono text-slate-300">
              {score.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// QUICK STATUS COMPONENT
// =============================================================================

interface QuickStatusProps {
  metrics: NormalizedMetric[];
}

export function QuickStatus({ metrics }: QuickStatusProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {metrics.map((metric, i) => {
        const color = metric.score >= 7 ? 'text-green-400' : metric.score >= 5 ? 'text-yellow-400' : 'text-red-400';
        return (
          <div key={i} className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-lg">
            <span className="text-xs text-slate-400">{metric.name}:</span>
            <span className={`text-sm font-mono ${color}`}>{metric.score.toFixed(1)}</span>
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// SPARKLINE COMPONENT
// =============================================================================

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
}

export function Sparkline({ values, width = 100, height = 24 }: SparklineProps) {
  if (values.length === 0) return null;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const trend = values.length > 1 ? (values[values.length - 1] > values[0] ? '↗' : values[values.length - 1] < values[0] ? '↘' : '→') : '';
  const trendColor = trend === '↗' ? 'text-green-400' : trend === '↘' ? 'text-red-400' : 'text-slate-400';

  return (
    <div className="flex items-center gap-2">
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          points={points}
          fill="none"
          stroke="var(--ari-purple)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className={`text-sm ${trendColor}`}>{trend}</span>
    </div>
  );
}

export default InsightBlockRenderer;
