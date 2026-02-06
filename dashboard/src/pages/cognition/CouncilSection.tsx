/**
 * CouncilSection Component
 * Council member cognitive profiles with pillar distribution and learning plans
 */

import { useState, useMemo } from 'react';
import type { CouncilProfile } from '../../api/client';
import { PILLAR_CONFIG, type PillarType } from './constants';

interface CouncilSectionProps {
  profiles: CouncilProfile[];
}

export function CouncilSection({ profiles }: CouncilSectionProps) {
  const [selectedProfile, setSelectedProfile] = useState<CouncilProfile | null>(null);
  const [filter, setFilter] = useState<'ALL' | PillarType>('ALL');

  const filteredProfiles = useMemo(() => {
    if (filter === 'ALL') return profiles;
    return profiles.filter((p) => p.primaryPillar === filter);
  }, [profiles, filter]);

  return (
    <div>
      {/* Filter buttons */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-text-primary">Council Cognitive Profiles</h2>
        <div className="flex gap-2 p-1 bg-bg-tertiary/60 rounded-lg">
          {(['ALL', 'LOGOS', 'ETHOS', 'PATHOS'] as const).map((f) => {
            const isActive = filter === f;
            let bgStyle = {};
            if (isActive) {
              if (f === 'ALL') bgStyle = { background: 'var(--ari-purple)' };
              else if (f === 'LOGOS') bgStyle = { background: 'var(--pillar-logos)' };
              else if (f === 'ETHOS') bgStyle = { background: 'var(--pillar-ethos)' };
              else bgStyle = { background: 'var(--pillar-pathos)' };
            }

            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? 'text-white shadow-lg'
                    : 'bg-transparent text-text-tertiary hover:text-text-primary hover:bg-bg-interactive'
                }`}
                style={bgStyle}
              >
                {f === 'ALL' ? 'All' : f === 'LOGOS' ? '🧠 LOGOS' : f === 'ETHOS' ? '❤️ ETHOS' : '🌱 PATHOS'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Profile Grid with staggered animation */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
        {filteredProfiles.map((profile, index) => (
          <div key={profile.memberId} style={{ animationDelay: `${index * 0.05}s` }}>
            <CouncilProfileCard profile={profile} onClick={() => setSelectedProfile(profile)} />
          </div>
        ))}
      </div>

      {/* Modal */}
      {selectedProfile && (
        <CouncilProfileModal profile={selectedProfile} onClose={() => setSelectedProfile(null)} />
      )}
    </div>
  );
}

function CouncilProfileCard({ profile, onClick }: { profile: CouncilProfile; onClick: () => void }) {
  const pillarConfig = PILLAR_CONFIG[profile.primaryPillar];

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl bg-bg-card backdrop-blur-md border p-4 transition-all duration-300 hover:scale-[1.02]"
      style={{
        borderColor: `var(--pillar-${pillarConfig.cssKey}-border)`,
        boxShadow: '0 0 0 0 transparent',
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.boxShadow = `0 8px 32px var(--pillar-${pillarConfig.cssKey}-glow)`)
      }
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 0 0 0 transparent')}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg text-xl transition-transform duration-300 hover:scale-110"
          style={{ background: `var(--pillar-${pillarConfig.cssKey}-muted)` }}
        >
          {profile.memberAvatar}
        </div>
        <div>
          <h4 className="font-semibold text-text-primary">{profile.memberName}</h4>
          <div className="flex items-center gap-2 text-xs">
            <span style={{ color: `var(--pillar-${pillarConfig.cssKey})` }}>{profile.primaryPillar}</span>
            <span className="text-text-disabled">•</span>
            <span className="text-text-muted">{profile.expertiseAreas[0]}</span>
          </div>
        </div>
      </div>

      {/* Pillar Weights Bar */}
      <div className="mb-3">
        <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-bg-interactive">
          <div
            className="transition-all duration-500"
            style={{
              width: `${profile.pillarWeights.logos * 100}%`,
              background: 'var(--pillar-logos)',
            }}
            title={`LOGOS: ${(profile.pillarWeights.logos * 100).toFixed(0)}%`}
          />
          <div
            className="transition-all duration-500"
            style={{
              width: `${profile.pillarWeights.ethos * 100}%`,
              background: 'var(--pillar-ethos)',
            }}
            title={`ETHOS: ${(profile.pillarWeights.ethos * 100).toFixed(0)}%`}
          />
          <div
            className="transition-all duration-500"
            style={{
              width: `${profile.pillarWeights.pathos * 100}%`,
              background: 'var(--pillar-pathos)',
            }}
            title={`PATHOS: ${(profile.pillarWeights.pathos * 100).toFixed(0)}%`}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-text-disabled">
          <span>🧠 {(profile.pillarWeights.logos * 100).toFixed(0)}%</span>
          <span>❤️ {(profile.pillarWeights.ethos * 100).toFixed(0)}%</span>
          <span>🌱 {(profile.pillarWeights.pathos * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Primary Framework */}
      <div className="text-xs text-text-muted mb-1">Primary Framework</div>
      <div className="text-sm font-medium mb-3" style={{ color: `var(--pillar-${pillarConfig.cssKey})` }}>
        {profile.primaryFrameworks[0]?.name}
      </div>

      {/* Performance Metric */}
      <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
        <span className="text-xs text-text-muted">{profile.performanceMetrics.keyMetric}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-tertiary">{(profile.performanceMetrics.baseline * 100).toFixed(0)}%</span>
          <span className="text-text-disabled">→</span>
          <span className="text-xs font-medium" style={{ color: `var(--pillar-${pillarConfig.cssKey})` }}>
            {(profile.performanceMetrics.target * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </button>
  );
}

function CouncilProfileModal({ profile, onClose }: { profile: CouncilProfile; onClose: () => void }) {
  const pillarConfig = PILLAR_CONFIG[profile.primaryPillar];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-bg-secondary rounded-2xl border border-border-muted shadow-2xl m-4 animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with pillar gradient */}
        <div
          className="sticky top-0 z-10 p-6 rounded-t-2xl"
          style={{
            background: `linear-gradient(135deg, var(--pillar-${pillarConfig.cssKey}-bright) 0%, var(--pillar-${pillarConfig.cssKey}) 100%)`,
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
          >
            ✕
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-4xl">
              {profile.memberAvatar}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{profile.memberName}</h2>
              <p className="text-white/80">{profile.consultedFor}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Pillar Weights */}
          <section>
            <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3">
              Pillar Distribution
            </h3>
            <div className="flex gap-4">
              {(['LOGOS', 'ETHOS', 'PATHOS'] as const).map((pillar) => {
                const config = PILLAR_CONFIG[pillar];
                const weight = profile.pillarWeights[pillar.toLowerCase() as 'logos' | 'ethos' | 'pathos'];
                return (
                  <div key={pillar} className="flex-1 bg-bg-interactive/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{config.icon}</span>
                      <span className="text-sm text-text-secondary">{pillar}</span>
                    </div>
                    <div className="text-2xl font-bold text-text-primary">{(weight * 100).toFixed(0)}%</div>
                    <div className="h-1.5 bg-bg-interactive rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${weight * 100}%`, background: `var(--pillar-${config.cssKey})` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Primary Frameworks */}
          <section>
            <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3">
              Primary Frameworks
            </h3>
            <div className="space-y-3">
              {profile.primaryFrameworks.map((fw, i) => (
                <div key={i} className="bg-bg-interactive/50 rounded-lg p-4 border border-border-subtle">
                  <div className="font-medium mb-1" style={{ color: `var(--pillar-${pillarConfig.cssKey})` }}>
                    {fw.name}
                  </div>
                  <div className="text-sm text-text-tertiary mb-2">
                    {fw.domain} • {fw.application}
                  </div>
                  <div className="text-xs text-text-muted italic">"{fw.why}"</div>
                </div>
              ))}
            </div>
          </section>

          {/* Expertise & APIs */}
          <div className="grid grid-cols-2 gap-4">
            <section>
              <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3">
                Expertise Areas
              </h3>
              <div className="flex flex-wrap gap-2">
                {profile.expertiseAreas.map((area) => (
                  <span
                    key={area}
                    className="px-3 py-1 rounded-full text-xs"
                    style={{
                      background: `var(--pillar-${pillarConfig.cssKey}-muted)`,
                      color: `var(--pillar-${pillarConfig.cssKey})`,
                    }}
                  >
                    {area}
                  </span>
                ))}
              </div>
            </section>
            <section>
              <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3">Typical APIs</h3>
              <div className="flex flex-wrap gap-2">
                {profile.typicalAPIUsage.map((api) => (
                  <span key={api} className="px-3 py-1 rounded-full text-xs bg-bg-interactive text-text-secondary font-mono">
                    {api}
                  </span>
                ))}
              </div>
            </section>
          </div>

          {/* Cognitive Bias Awareness */}
          <section>
            <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3">
              Cognitive Self-Awareness
            </h3>
            <div className="bg-bg-interactive/50 rounded-lg p-4 space-y-3 border border-border-subtle">
              <div>
                <span className="text-xs text-text-muted">Natural Tendency</span>
                <p className="text-sm text-text-secondary">{profile.cognitiveBiasAwareness.naturalTendency}</p>
              </div>
              <div>
                <span className="text-xs text-text-muted">Compensation Strategy</span>
                <p className="text-sm text-text-secondary">{profile.cognitiveBiasAwareness.compensationStrategy}</p>
              </div>
              <div>
                <span className="text-xs text-ari-warning">Improvement Goal</span>
                <p className="text-sm text-ari-warning">{profile.cognitiveBiasAwareness.improvementGoal}</p>
              </div>
            </div>
          </section>

          {/* Learning Plan */}
          <section>
            <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3">Learning Plan</h3>
            <div className="bg-bg-interactive/50 rounded-lg p-4 border border-border-subtle">
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <span className="text-xs text-text-muted">Currently Learning</span>
                  <p className="text-sm text-text-secondary">{profile.learningPlan.current}</p>
                </div>
                <div>
                  <span className="text-xs text-text-muted">Up Next</span>
                  <p className="text-sm text-text-secondary">{profile.learningPlan.next}</p>
                </div>
              </div>
              <div className="pt-3 border-t border-border-subtle">
                <span className="text-xs text-text-muted">Quarterly Goals</span>
                <ul className="mt-2 space-y-1">
                  {profile.learningPlan.quarterlyGoals.map((goal, i) => (
                    <li key={i} className="text-sm text-text-secondary flex items-center gap-2">
                      <span style={{ color: `var(--pillar-${pillarConfig.cssKey})` }}>→</span>
                      {goal}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Performance Metrics */}
          <section>
            <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3">
              Performance Metrics
            </h3>
            <div className="bg-bg-interactive/50 rounded-lg p-4 border border-border-subtle">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-text-secondary">{profile.performanceMetrics.keyMetric}</span>
                <div className="flex items-center gap-2">
                  <span className="text-text-muted">{(profile.performanceMetrics.baseline * 100).toFixed(0)}%</span>
                  <span className="text-xs text-text-disabled">→</span>
                  <span className="font-bold" style={{ color: `var(--pillar-${pillarConfig.cssKey})` }}>
                    {(profile.performanceMetrics.target * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="h-2 bg-bg-interactive rounded-full overflow-hidden">
                <div className="relative h-full">
                  <div
                    className="absolute h-full bg-bg-elevated rounded-full"
                    style={{ width: `${profile.performanceMetrics.target * 100}%` }}
                  />
                  <div
                    className="absolute h-full rounded-full"
                    style={{
                      width: `${profile.performanceMetrics.baseline * 100}%`,
                      background: `var(--pillar-${pillarConfig.cssKey})`,
                    }}
                  />
                </div>
              </div>
              {profile.performanceMetrics.secondaryMetric && (
                <div className="text-xs text-text-muted mt-2">
                  Secondary: {profile.performanceMetrics.secondaryMetric}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
