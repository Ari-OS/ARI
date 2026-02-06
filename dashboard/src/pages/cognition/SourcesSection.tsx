/**
 * SourcesSection Component
 * Knowledge sources organized by pillar with summary statistics
 */

import { useQuery } from '@tanstack/react-query';
import { getCognitiveSources } from '../../api/client';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { PILLAR_CONFIG } from './constants';

export function SourcesSection() {
  const { data: sourcesData, isLoading, error } = useQuery({
    queryKey: ['cognition', 'sources'],
    queryFn: getCognitiveSources,
    staleTime: 60000,
  });

  if (isLoading) {
    return <Skeleton className="h-96 rounded-xl shimmer-purple" />;
  }

  if (error || !sourcesData) {
    return <ErrorState message="Failed to load knowledge sources" />;
  }

  const sourcesByPillar = {
    LOGOS: sourcesData.sources.filter((s) => s.pillar === 'LOGOS'),
    ETHOS: sourcesData.sources.filter((s) => s.pillar === 'ETHOS'),
    PATHOS: sourcesData.sources.filter((s) => s.pillar === 'PATHOS'),
    CROSS_CUTTING: sourcesData.sources.filter((s) => s.pillar === 'CROSS_CUTTING'),
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 stagger-children">
        <div className="bg-bg-card backdrop-blur-md rounded-xl p-4 border border-border-muted transition-all hover:border-[var(--border-purple)] hover:shadow-lg hover:shadow-ari-purple-muted">
          <div className="text-2xl font-bold text-ari-purple">{sourcesData.total}</div>
          <div className="text-xs text-text-muted">Total Sources</div>
        </div>
        <div className="bg-bg-card backdrop-blur-md rounded-xl p-4 border border-border-muted transition-all hover:border-ari-success hover:border-opacity-50">
          <div className="text-2xl font-bold text-ari-success">{sourcesData.byTrustLevel.verified}</div>
          <div className="text-xs text-text-muted">Verified</div>
        </div>
        <div className="bg-bg-card backdrop-blur-md rounded-xl p-4 border border-border-muted transition-all hover:border-ari-warning hover:border-opacity-50">
          <div className="text-2xl font-bold text-ari-warning">{sourcesData.byTrustLevel.standard}</div>
          <div className="text-xs text-text-muted">Standard</div>
        </div>
        <div className="bg-bg-card backdrop-blur-md rounded-xl p-4 border border-border-muted transition-all hover:border-pillar-logos hover:border-opacity-50">
          <div className="text-2xl font-bold text-pillar-logos">
            {new Set(sourcesData.sources.flatMap((s) => s.frameworks)).size}
          </div>
          <div className="text-xs text-text-muted">Frameworks</div>
        </div>
      </div>

      {/* Sources by Pillar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {(['LOGOS', 'ETHOS', 'PATHOS'] as const).map((pillar, pillarIndex) => {
          const config = PILLAR_CONFIG[pillar];
          const sources = sourcesByPillar[pillar];

          return (
            <div
              key={pillar}
              className="bg-bg-card backdrop-blur-md rounded-xl border p-5 transition-all duration-300 hover:shadow-lg animate-fade-in-up"
              style={{
                borderColor: `var(--pillar-${config.cssKey}-border)`,
                animationDelay: `${pillarIndex * 0.1}s`,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.boxShadow = `0 8px 32px var(--pillar-${config.cssKey}-glow)`)
              }
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{config.icon}</span>
                <div>
                  <h3 className="font-semibold text-text-primary">{pillar}</h3>
                  <p className="text-xs text-text-muted">{sources.length} sources</p>
                </div>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                {sources.slice(0, 10).map((source, index) => (
                  <div
                    key={source.id}
                    className="p-2 bg-bg-interactive/50 rounded-lg hover:bg-bg-elevated transition-colors"
                    style={{ animationDelay: `${(pillarIndex * 10 + index) * 0.03}s` }}
                  >
                    <div className="text-sm text-text-secondary truncate">{source.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          source.trustLevel === 'VERIFIED'
                            ? 'bg-ari-success-muted text-ari-success'
                            : 'bg-ari-warning-muted text-ari-warning'
                        }`}
                      >
                        {source.trustLevel}
                      </span>
                      <span className="text-[10px] text-text-muted">{source.category}</span>
                    </div>
                  </div>
                ))}
                {sources.length > 10 && (
                  <div className="text-center text-xs text-text-muted py-2">+{sources.length - 10} more sources</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
