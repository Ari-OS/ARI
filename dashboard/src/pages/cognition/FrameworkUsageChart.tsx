/**
 * FrameworkUsageChart Component
 * Displays framework usage statistics with pillar-colored bars
 */

import type { FrameworkUsage } from '../../api/client';
import { PILLAR_CONFIG } from './constants';

interface FrameworkUsageChartProps {
  data: FrameworkUsage[];
}

export function FrameworkUsageChart({ data }: FrameworkUsageChartProps) {
  const maxCount = Math.max(...data.map((d) => d.usageCount), 1);

  return (
    <div className="bg-bg-card backdrop-blur-md rounded-xl border border-border-muted p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-text-primary">Framework Usage</h3>
        <span className="text-xs text-text-muted">{data.length} frameworks</span>
      </div>

      <div className="space-y-3">
        {data.map((item, index) => {
          const config = PILLAR_CONFIG[item.pillar];
          const widthPercent = (item.usageCount / maxCount) * 100;

          return (
            <div key={item.framework} className="group animate-fade-in-up" style={{ animationDelay: `${index * 0.05}s` }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{config.icon}</span>
                  <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                    {item.framework}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-muted">{item.usageCount} uses</span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      item.successRate >= 0.85
                        ? 'bg-ari-success-muted text-ari-success'
                        : item.successRate >= 0.7
                        ? 'bg-ari-warning-muted text-ari-warning'
                        : 'bg-ari-error-muted text-ari-error'
                    }`}
                  >
                    {(item.successRate * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-bg-interactive rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${widthPercent}%`,
                    background: `var(--pillar-${config.cssKey})`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
