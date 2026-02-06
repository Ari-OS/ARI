/**
 * PillarHealthCard Component
 * Displays health status for a single cognitive pillar (LOGOS/ETHOS/PATHOS)
 */

import type { CognitiveHealth } from '../../api/client';
import { PILLAR_CONFIG, formatRelativeTime } from './constants';

interface PillarHealthCardProps {
  pillar: CognitiveHealth['pillars'][0];
}

export function PillarHealthCard({ pillar }: PillarHealthCardProps) {
  const config = PILLAR_CONFIG[pillar.pillar];

  return (
    <div
      className={`group relative overflow-hidden rounded-xl bg-bg-card backdrop-blur-md border transition-all duration-300 hover:scale-[1.02] ${config.borderClass} hover:shadow-xl`}
      style={{
        boxShadow: `0 0 0 0 var(--pillar-${config.cssKey}-glow)`,
        transition: 'all 0.3s ease-out',
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.boxShadow = `0 8px 32px var(--pillar-${config.cssKey}-glow)`)
      }
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = `0 0 0 0 var(--pillar-${config.cssKey}-glow)`)}
    >
      {/* Subtle gradient overlay on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `linear-gradient(135deg, var(--pillar-${config.cssKey}-muted) 0%, transparent 50%)`,
        }}
      />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-center gap-4 mb-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
            style={{ background: `var(--pillar-${config.cssKey}-muted)` }}
          >
            <span className="text-2xl">{config.icon}</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-primary">{pillar.pillar}</h3>
            <p className="text-xs text-text-muted">
              {config.name} • {config.description}
            </p>
          </div>
        </div>

        {/* Health bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-text-tertiary">Pillar Health</span>
            <span
              className={`text-sm font-bold ${
                pillar.health >= 0.8
                  ? 'text-ari-success'
                  : pillar.health >= 0.6
                  ? 'text-ari-warning'
                  : 'text-ari-error'
              }`}
            >
              {(pillar.health * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-bg-interactive rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${pillar.health * 100}%`,
                background: `var(--pillar-${config.cssKey})`,
              }}
            />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-bg-interactive/50 rounded-lg p-3">
            <div className="text-xs text-text-muted mb-1">APIs Active</div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold" style={{ color: `var(--pillar-${config.cssKey})` }}>
                {pillar.apisActive}
              </span>
              <span className="text-xs text-text-muted">/ {pillar.apisTotal}</span>
            </div>
          </div>
          <div className="bg-bg-interactive/50 rounded-lg p-3">
            <div className="text-xs text-text-muted mb-1">Sources</div>
            <div className="text-lg font-bold" style={{ color: `var(--pillar-${config.cssKey})` }}>
              {pillar.sourcesCount}
            </div>
          </div>
        </div>

        {/* Top framework and last activity */}
        <div className="mt-3 pt-3 border-t border-border-subtle">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-text-muted">Top Framework</span>
            <span className="font-medium" style={{ color: `var(--pillar-${config.cssKey})` }}>
              {pillar.topFramework}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">Last activity</span>
            <span className="text-text-tertiary">{formatRelativeTime(pillar.lastActivity)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
