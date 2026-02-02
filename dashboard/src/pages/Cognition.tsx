/**
 * Cognition Page — Cognitive Layer 0 Dashboard
 *
 * Displays the three pillars of ARI's cognitive architecture:
 * - LOGOS (Reason): Bayesian, Kelly Criterion, Systems Thinking
 * - ETHOS (Character): Bias detection, emotional state, discipline
 * - PATHOS (Growth): CBT, Stoicism, meta-learning
 *
 * Also shows:
 * - Real-time cognitive activity feed
 * - Learning loop progress
 * - Framework usage statistics
 * - Recent insights
 * - Council cognitive profiles
 */

import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import {
  getCognitiveHealth,
  getLearningStatus,
  getFrameworkUsage,
  getCognitiveInsights,
  getCouncilProfiles,
  getCognitiveSources,
  type CognitiveHealth,
  type LearningStatus,
  type FrameworkUsage,
  type CognitiveInsight,
  type CouncilProfile,
} from '../api/client';

// =============================================================================
// TYPES
// =============================================================================

interface CognitiveActivity {
  id: string;
  timestamp: string;
  agent: string;
  pillar: 'LOGOS' | 'ETHOS' | 'PATHOS';
  api: string;
  confidence: number;
  duration: number;
}

type TabId = 'overview' | 'council' | 'sources' | 'insights';

// =============================================================================
// PILLAR CONFIGURATION — Uses CSS Variables from index.css
// =============================================================================

const PILLAR_CONFIG = {
  LOGOS: {
    icon: '🧠',
    name: 'Reason',
    cssKey: 'logos',
    // Tailwind classes that map to CSS variables
    bgClass: 'bg-[var(--pillar-logos)]',
    bgClassMuted: 'bg-[var(--pillar-logos-muted)]',
    textClass: 'text-[var(--pillar-logos)]',
    borderClass: 'border-[var(--pillar-logos-border)]',
    gradientClass: 'gradient-logos',
    glowClass: 'glow-logos',
    cardClass: 'card-ari-logos',
    badgeClass: 'badge-logos',
    description: 'Bayesian, Kelly, Systems, Antifragility',
  },
  ETHOS: {
    icon: '❤️',
    name: 'Character',
    cssKey: 'ethos',
    bgClass: 'bg-[var(--pillar-ethos)]',
    bgClassMuted: 'bg-[var(--pillar-ethos-muted)]',
    textClass: 'text-[var(--pillar-ethos)]',
    borderClass: 'border-[var(--pillar-ethos-border)]',
    gradientClass: 'gradient-ethos',
    glowClass: 'glow-ethos',
    cardClass: 'card-ari-ethos',
    badgeClass: 'badge-ethos',
    description: 'Bias Detection, Emotional State, Discipline',
  },
  PATHOS: {
    icon: '🌱',
    name: 'Growth',
    cssKey: 'pathos',
    bgClass: 'bg-[var(--pillar-pathos)]',
    bgClassMuted: 'bg-[var(--pillar-pathos-muted)]',
    textClass: 'text-[var(--pillar-pathos)]',
    borderClass: 'border-[var(--pillar-pathos-border)]',
    gradientClass: 'gradient-pathos',
    glowClass: 'glow-pathos',
    cardClass: 'card-ari-pathos',
    badgeClass: 'badge-pathos',
    description: 'CBT, Stoicism, Deliberate Practice',
  },
};

// =============================================================================
// TAB NAVIGATION — Purple Accent
// =============================================================================

function TabNav({ activeTab, onTabChange }: { activeTab: TabId; onTabChange: (tab: TabId) => void }) {
  const tabs: Array<{ id: TabId; label: string; icon: string }> = [
    { id: 'overview', label: 'Overview', icon: '◉' },
    { id: 'council', label: 'Council', icon: '👥' },
    { id: 'sources', label: 'Sources', icon: '📚' },
    { id: 'insights', label: 'Insights', icon: '💡' },
  ];

  return (
    <div className="flex gap-1 p-1 bg-[var(--bg-tertiary)]/60 backdrop-blur-sm rounded-xl border border-[var(--border-subtle)]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === tab.id
              ? 'bg-[var(--ari-purple)] text-white shadow-lg shadow-[var(--ari-purple-muted)]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-interactive)]'
          }`}
        >
          <span className="text-base">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// =============================================================================
// PILLAR HEALTH CARD — Glassmorphism with Pillar Accent
// =============================================================================

function PillarHealthCard({ pillar }: { pillar: CognitiveHealth['pillars'][0] }) {
  const config = PILLAR_CONFIG[pillar.pillar];

  return (
    <div className={`group relative overflow-hidden rounded-xl bg-[var(--bg-card)] backdrop-blur-md border transition-all duration-300 hover:scale-[1.02] ${config.borderClass} hover:shadow-xl`}
         style={{
           boxShadow: `0 0 0 0 var(--pillar-${config.cssKey}-glow)`,
           transition: 'all 0.3s ease-out'
         }}
         onMouseEnter={(e) => e.currentTarget.style.boxShadow = `0 8px 32px var(--pillar-${config.cssKey}-glow)`}
         onMouseLeave={(e) => e.currentTarget.style.boxShadow = `0 0 0 0 var(--pillar-${config.cssKey}-glow)`}>

      {/* Subtle gradient overlay on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: `linear-gradient(135deg, var(--pillar-${config.cssKey}-muted) 0%, transparent 50%)` }}
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
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">{pillar.pillar}</h3>
            <p className="text-xs text-[var(--text-muted)]">{config.name} • {config.description}</p>
          </div>
        </div>

        {/* Health bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-[var(--text-tertiary)]">Pillar Health</span>
            <span className={`text-sm font-bold ${
              pillar.health >= 0.8 ? 'text-[var(--ari-success)]' :
              pillar.health >= 0.6 ? 'text-[var(--ari-warning)]' : 'text-[var(--ari-error)]'
            }`}>
              {(pillar.health * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-[var(--bg-interactive)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${pillar.health * 100}%`,
                background: `var(--pillar-${config.cssKey})`
              }}
            />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[var(--bg-interactive)]/50 rounded-lg p-3">
            <div className="text-xs text-[var(--text-muted)] mb-1">APIs Active</div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold" style={{ color: `var(--pillar-${config.cssKey})` }}>
                {pillar.apisActive}
              </span>
              <span className="text-xs text-[var(--text-muted)]">/ {pillar.apisTotal}</span>
            </div>
          </div>
          <div className="bg-[var(--bg-interactive)]/50 rounded-lg p-3">
            <div className="text-xs text-[var(--text-muted)] mb-1">Sources</div>
            <div className="text-lg font-bold" style={{ color: `var(--pillar-${config.cssKey})` }}>
              {pillar.sourcesCount}
            </div>
          </div>
        </div>

        {/* Top framework and last activity */}
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[var(--text-muted)]">Top Framework</span>
            <span className="font-medium" style={{ color: `var(--pillar-${config.cssKey})` }}>
              {pillar.topFramework}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-muted)]">Last activity</span>
            <span className="text-[var(--text-tertiary)]">{formatRelativeTime(pillar.lastActivity)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// LEARNING LOOP PROGRESS — Purple Theme with Progress Visualization
// =============================================================================

function LearningLoopProgress({ status }: { status: LearningStatus }) {
  const STAGES = [
    { id: 'performance_review', name: 'Review', icon: '📊', fullName: 'Performance Review' },
    { id: 'gap_analysis', name: 'Analysis', icon: '🔍', fullName: 'Gap Analysis' },
    { id: 'source_discovery', name: 'Discovery', icon: '📚', fullName: 'Source Discovery' },
    { id: 'knowledge_integration', name: 'Integration', icon: '🧩', fullName: 'Knowledge Integration' },
    { id: 'self_assessment', name: 'Assessment', icon: '📝', fullName: 'Self-Assessment' },
  ];

  const currentIndex = STAGES.findIndex(s => s.id === status.currentStage);

  return (
    <div className="bg-[var(--bg-card)] backdrop-blur-md rounded-xl border border-[var(--border-muted)] p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Learning Loop</h3>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
          status.improvementTrend === 'improving'
            ? 'bg-[var(--ari-success-muted)] text-[var(--ari-success)]'
            : status.improvementTrend === 'declining'
            ? 'bg-[var(--ari-error-muted)] text-[var(--ari-error)]'
            : 'bg-[var(--ari-warning-muted)] text-[var(--ari-warning)]'
        }`}>
          {status.improvementTrend === 'improving' ? '↑' : status.improvementTrend === 'declining' ? '↓' : '→'}
          {status.improvementTrend.charAt(0).toUpperCase() + status.improvementTrend.slice(1)}
        </div>
      </div>

      {/* Stage Progress */}
      <div className="relative mb-6">
        {/* Progress line background */}
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-[var(--bg-interactive)]" />
        {/* Progress line filled */}
        <div
          className="absolute top-4 left-4 h-0.5 bg-[var(--ari-success)] transition-all duration-700"
          style={{ width: `${(currentIndex / (STAGES.length - 1)) * (100 - 8)}%` }}
        />

        {/* Stage indicators */}
        <div className="relative flex justify-between">
          {STAGES.map((stage, index) => (
            <div key={stage.id} className="flex flex-col items-center" title={stage.fullName}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                index === currentIndex
                  ? 'bg-[var(--ari-purple)] text-white ring-2 ring-[var(--ari-purple-400)] ring-offset-2 ring-offset-[var(--bg-card)]'
                  : index < currentIndex
                  ? 'bg-[var(--ari-success)] text-white'
                  : 'bg-[var(--bg-interactive)] text-[var(--text-muted)]'
              }`}>
                <span className="text-sm">{stage.icon}</span>
              </div>
              <span className={`mt-2 text-[10px] font-medium ${
                index === currentIndex
                  ? 'text-[var(--ari-purple)]'
                  : index < currentIndex
                  ? 'text-[var(--ari-success)]'
                  : 'text-[var(--text-muted)]'
              }`}>
                {stage.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[var(--bg-interactive)]/50 rounded-lg p-3">
          <div className="text-xs text-[var(--text-muted)]">Last Review</div>
          <div className="text-sm font-medium text-[var(--text-secondary)]">{formatRelativeTime(status.lastReview)}</div>
        </div>
        <div className="bg-[var(--bg-interactive)]/50 rounded-lg p-3">
          <div className="text-xs text-[var(--text-muted)]">Next Review</div>
          <div className="text-sm font-medium text-[var(--text-secondary)]">{formatRelativeTime(status.nextReview)}</div>
        </div>
        <div className="bg-[var(--bg-interactive)]/50 rounded-lg p-3">
          <div className="text-xs text-[var(--text-muted)]">Recent Insights</div>
          <div className="text-lg font-bold text-[var(--ari-purple)]">{status.recentInsightsCount}</div>
        </div>
        <div className="bg-[var(--bg-interactive)]/50 rounded-lg p-3">
          <div className="text-xs text-[var(--text-muted)]">Next Assessment</div>
          <div className="text-sm font-medium text-[var(--text-secondary)]">{formatRelativeTime(status.nextAssessment)}</div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// COGNITIVE ACTIVITY FEED — Real-Time with Pillar Colors
// =============================================================================

function CognitiveActivityFeed({ activities }: { activities: CognitiveActivity[] }) {
  return (
    <div className="bg-[var(--bg-card)] backdrop-blur-md rounded-xl border border-[var(--border-muted)] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Real-Time Activity</h3>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--ari-success)] animate-pulse shadow-sm shadow-[var(--ari-success)]" />
          <span className="text-xs text-[var(--text-muted)]">Live</span>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-2 opacity-50">🧠</div>
          <p className="text-[var(--text-muted)] text-sm">Waiting for cognitive activity...</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
          {activities.slice(0, 15).map((activity, index) => {
            const config = PILLAR_CONFIG[activity.pillar];
            return (
              <div
                key={activity.id}
                className="flex items-center gap-3 p-2.5 bg-[var(--bg-interactive)]/50 rounded-lg hover:bg-[var(--bg-elevated)] transition-all duration-200 animate-fade-in-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-transform hover:scale-110"
                  style={{ background: `var(--pillar-${config.cssKey}-muted)` }}
                >
                  <span className="text-sm">{config.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm" style={{ color: `var(--pillar-${config.cssKey})` }}>
                      {activity.api}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">{activity.agent}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono text-[var(--text-tertiary)]">{activity.duration}ms</div>
                  <div className={`text-[10px] font-medium ${
                    activity.confidence >= 0.8 ? 'text-[var(--ari-success)]' :
                    activity.confidence >= 0.6 ? 'text-[var(--ari-warning)]' : 'text-[var(--ari-error)]'
                  }`}>
                    {(activity.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// INSIGHT TIMELINE — Semantic Colors with Purple Accents
// =============================================================================

function InsightTimeline({ insights }: { insights: CognitiveInsight[] }) {
  const typeConfig = {
    SUCCESS: {
      icon: '✓',
      color: 'text-[var(--ari-success)]',
      bg: 'bg-[var(--ari-success-muted)]',
      borderColor: 'rgba(16, 185, 129, 0.3)'
    },
    MISTAKE: {
      icon: '✗',
      color: 'text-[var(--ari-error)]',
      bg: 'bg-[var(--ari-error-muted)]',
      borderColor: 'rgba(239, 68, 68, 0.3)'
    },
    PATTERN: {
      icon: '◉',
      color: 'text-[var(--ari-purple)]',
      bg: 'bg-[var(--ari-purple-muted)]',
      borderColor: 'rgba(168, 85, 247, 0.3)'
    },
    PRINCIPLE: {
      icon: '★',
      color: 'text-[var(--ari-warning)]',
      bg: 'bg-[var(--ari-warning-muted)]',
      borderColor: 'rgba(245, 158, 11, 0.3)'
    },
    ANTIPATTERN: {
      icon: '⚠',
      color: 'text-[var(--pillar-ethos)]',
      bg: 'bg-[var(--pillar-ethos-muted)]',
      borderColor: 'rgba(251, 146, 60, 0.3)'
    },
  };

  return (
    <div className="bg-[var(--bg-card)] backdrop-blur-md rounded-xl border border-[var(--border-muted)] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Recent Insights</h3>
        <span className="text-xs text-[var(--text-muted)]">{insights.length} insights</span>
      </div>

      <div className="space-y-3">
        {insights.map((insight, index) => {
          const config = typeConfig[insight.type];
          return (
            <div
              key={insight.id}
              className={`p-3.5 rounded-lg ${config.bg} border transition-all duration-200 hover:scale-[1.01] animate-fade-in-up`}
              style={{
                borderColor: config.borderColor,
                animationDelay: `${index * 0.1}s`
              }}
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full ${config.bg} ${config.color} text-base font-bold`}>
                  {config.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{insight.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-muted)]">
                    <span className={config.color}>{insight.framework}</span>
                    <span className="opacity-50">•</span>
                    <span>{(insight.confidence * 100).toFixed(0)}% confidence</span>
                    <span className="opacity-50">•</span>
                    <span>{formatRelativeTime(insight.timestamp)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// FRAMEWORK USAGE CHART — Pillar-Colored Bars
// =============================================================================

function FrameworkUsageChart({ data }: { data: FrameworkUsage[] }) {
  const maxCount = Math.max(...data.map(d => d.usageCount), 1);

  return (
    <div className="bg-[var(--bg-card)] backdrop-blur-md rounded-xl border border-[var(--border-muted)] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Framework Usage</h3>
        <span className="text-xs text-[var(--text-muted)]">{data.length} frameworks</span>
      </div>

      <div className="space-y-3">
        {data.map((item, index) => {
          const config = PILLAR_CONFIG[item.pillar];
          const widthPercent = (item.usageCount / maxCount) * 100;

          return (
            <div
              key={item.framework}
              className="group animate-fade-in-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{config.icon}</span>
                  <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                    {item.framework}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--text-muted)]">{item.usageCount} uses</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    item.successRate >= 0.85 ? 'bg-[var(--ari-success-muted)] text-[var(--ari-success)]' :
                    item.successRate >= 0.7 ? 'bg-[var(--ari-warning-muted)] text-[var(--ari-warning)]' :
                    'bg-[var(--ari-error-muted)] text-[var(--ari-error)]'
                  }`}>
                    {(item.successRate * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-[var(--bg-interactive)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${widthPercent}%`,
                    background: `var(--pillar-${config.cssKey})`
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

// =============================================================================
// COUNCIL PROFILE CARD — Pillar-Themed Glassmorphism
// =============================================================================

function CouncilProfileCard({ profile, onClick }: { profile: CouncilProfile; onClick: () => void }) {
  const pillarConfig = PILLAR_CONFIG[profile.primaryPillar];

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl bg-[var(--bg-card)] backdrop-blur-md border p-4 transition-all duration-300 hover:scale-[1.02]"
      style={{
        borderColor: `var(--pillar-${pillarConfig.cssKey}-border)`,
        boxShadow: '0 0 0 0 transparent'
      }}
      onMouseEnter={(e) => e.currentTarget.style.boxShadow = `0 8px 32px var(--pillar-${pillarConfig.cssKey}-glow)`}
      onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 0 0 0 transparent'}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg text-xl transition-transform duration-300 hover:scale-110"
          style={{ background: `var(--pillar-${pillarConfig.cssKey}-muted)` }}
        >
          {profile.memberAvatar}
        </div>
        <div>
          <h4 className="font-semibold text-[var(--text-primary)]">{profile.memberName}</h4>
          <div className="flex items-center gap-2 text-xs">
            <span style={{ color: `var(--pillar-${pillarConfig.cssKey})` }}>{profile.primaryPillar}</span>
            <span className="text-[var(--text-disabled)]">•</span>
            <span className="text-[var(--text-muted)]">{profile.expertiseAreas[0]}</span>
          </div>
        </div>
      </div>

      {/* Pillar Weights Bar */}
      <div className="mb-3">
        <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-[var(--bg-interactive)]">
          <div
            className="transition-all duration-500"
            style={{
              width: `${profile.pillarWeights.logos * 100}%`,
              background: 'var(--pillar-logos)'
            }}
            title={`LOGOS: ${(profile.pillarWeights.logos * 100).toFixed(0)}%`}
          />
          <div
            className="transition-all duration-500"
            style={{
              width: `${profile.pillarWeights.ethos * 100}%`,
              background: 'var(--pillar-ethos)'
            }}
            title={`ETHOS: ${(profile.pillarWeights.ethos * 100).toFixed(0)}%`}
          />
          <div
            className="transition-all duration-500"
            style={{
              width: `${profile.pillarWeights.pathos * 100}%`,
              background: 'var(--pillar-pathos)'
            }}
            title={`PATHOS: ${(profile.pillarWeights.pathos * 100).toFixed(0)}%`}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-[var(--text-disabled)]">
          <span>🧠 {(profile.pillarWeights.logos * 100).toFixed(0)}%</span>
          <span>❤️ {(profile.pillarWeights.ethos * 100).toFixed(0)}%</span>
          <span>🌱 {(profile.pillarWeights.pathos * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Primary Framework */}
      <div className="text-xs text-[var(--text-muted)] mb-1">Primary Framework</div>
      <div className="text-sm font-medium mb-3" style={{ color: `var(--pillar-${pillarConfig.cssKey})` }}>
        {profile.primaryFrameworks[0]?.name}
      </div>

      {/* Performance Metric */}
      <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
        <span className="text-xs text-[var(--text-muted)]">{profile.performanceMetrics.keyMetric}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-tertiary)]">{(profile.performanceMetrics.baseline * 100).toFixed(0)}%</span>
          <span className="text-[var(--text-disabled)]">→</span>
          <span className="text-xs font-medium" style={{ color: `var(--pillar-${pillarConfig.cssKey})` }}>
            {(profile.performanceMetrics.target * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </button>
  );
}

// =============================================================================
// COUNCIL PROFILE MODAL — Full Detail View with Purple/Black Theme
// =============================================================================

function CouncilProfileModal({ profile, onClose }: { profile: CouncilProfile; onClose: () => void }) {
  const pillarConfig = PILLAR_CONFIG[profile.primaryPillar];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-muted)] shadow-2xl m-4 animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with pillar gradient */}
        <div
          className="sticky top-0 z-10 p-6 rounded-t-2xl"
          style={{
            background: `linear-gradient(135deg, var(--pillar-${pillarConfig.cssKey}-bright) 0%, var(--pillar-${pillarConfig.cssKey}) 100%)`
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
            <h3 className="text-sm font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Pillar Distribution</h3>
            <div className="flex gap-4">
              {(['LOGOS', 'ETHOS', 'PATHOS'] as const).map((pillar) => {
                const config = PILLAR_CONFIG[pillar];
                const weight = profile.pillarWeights[pillar.toLowerCase() as 'logos' | 'ethos' | 'pathos'];
                return (
                  <div key={pillar} className="flex-1 bg-[var(--bg-interactive)]/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{config.icon}</span>
                      <span className="text-sm text-[var(--text-secondary)]">{pillar}</span>
                    </div>
                    <div className="text-2xl font-bold text-[var(--text-primary)]">{(weight * 100).toFixed(0)}%</div>
                    <div className="h-1.5 bg-[var(--bg-interactive)] rounded-full mt-2 overflow-hidden">
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
            <h3 className="text-sm font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Primary Frameworks</h3>
            <div className="space-y-3">
              {profile.primaryFrameworks.map((fw, i) => (
                <div key={i} className="bg-[var(--bg-interactive)]/50 rounded-lg p-4 border border-[var(--border-subtle)]">
                  <div className="font-medium mb-1" style={{ color: `var(--pillar-${pillarConfig.cssKey})` }}>{fw.name}</div>
                  <div className="text-sm text-[var(--text-tertiary)] mb-2">{fw.domain} • {fw.application}</div>
                  <div className="text-xs text-[var(--text-muted)] italic">"{fw.why}"</div>
                </div>
              ))}
            </div>
          </section>

          {/* Expertise & APIs */}
          <div className="grid grid-cols-2 gap-4">
            <section>
              <h3 className="text-sm font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Expertise Areas</h3>
              <div className="flex flex-wrap gap-2">
                {profile.expertiseAreas.map((area) => (
                  <span
                    key={area}
                    className="px-3 py-1 rounded-full text-xs"
                    style={{
                      background: `var(--pillar-${pillarConfig.cssKey}-muted)`,
                      color: `var(--pillar-${pillarConfig.cssKey})`
                    }}
                  >
                    {area}
                  </span>
                ))}
              </div>
            </section>
            <section>
              <h3 className="text-sm font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Typical APIs</h3>
              <div className="flex flex-wrap gap-2">
                {profile.typicalAPIUsage.map((api) => (
                  <span key={api} className="px-3 py-1 rounded-full text-xs bg-[var(--bg-interactive)] text-[var(--text-secondary)] font-mono">
                    {api}
                  </span>
                ))}
              </div>
            </section>
          </div>

          {/* Cognitive Bias Awareness */}
          <section>
            <h3 className="text-sm font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Cognitive Self-Awareness</h3>
            <div className="bg-[var(--bg-interactive)]/50 rounded-lg p-4 space-y-3 border border-[var(--border-subtle)]">
              <div>
                <span className="text-xs text-[var(--text-muted)]">Natural Tendency</span>
                <p className="text-sm text-[var(--text-secondary)]">{profile.cognitiveBiasAwareness.naturalTendency}</p>
              </div>
              <div>
                <span className="text-xs text-[var(--text-muted)]">Compensation Strategy</span>
                <p className="text-sm text-[var(--text-secondary)]">{profile.cognitiveBiasAwareness.compensationStrategy}</p>
              </div>
              <div>
                <span className="text-xs text-[var(--ari-warning)]">Improvement Goal</span>
                <p className="text-sm text-[var(--ari-warning)]">{profile.cognitiveBiasAwareness.improvementGoal}</p>
              </div>
            </div>
          </section>

          {/* Learning Plan */}
          <section>
            <h3 className="text-sm font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Learning Plan</h3>
            <div className="bg-[var(--bg-interactive)]/50 rounded-lg p-4 border border-[var(--border-subtle)]">
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <span className="text-xs text-[var(--text-muted)]">Currently Learning</span>
                  <p className="text-sm text-[var(--text-secondary)]">{profile.learningPlan.current}</p>
                </div>
                <div>
                  <span className="text-xs text-[var(--text-muted)]">Up Next</span>
                  <p className="text-sm text-[var(--text-secondary)]">{profile.learningPlan.next}</p>
                </div>
              </div>
              <div className="pt-3 border-t border-[var(--border-subtle)]">
                <span className="text-xs text-[var(--text-muted)]">Quarterly Goals</span>
                <ul className="mt-2 space-y-1">
                  {profile.learningPlan.quarterlyGoals.map((goal, i) => (
                    <li key={i} className="text-sm text-[var(--text-secondary)] flex items-center gap-2">
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
            <h3 className="text-sm font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Performance Metrics</h3>
            <div className="bg-[var(--bg-interactive)]/50 rounded-lg p-4 border border-[var(--border-subtle)]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[var(--text-secondary)]">{profile.performanceMetrics.keyMetric}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text-muted)]">{(profile.performanceMetrics.baseline * 100).toFixed(0)}%</span>
                  <span className="text-xs text-[var(--text-disabled)]">→</span>
                  <span className="font-bold" style={{ color: `var(--pillar-${pillarConfig.cssKey})` }}>
                    {(profile.performanceMetrics.target * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="h-2 bg-[var(--bg-interactive)] rounded-full overflow-hidden">
                <div className="relative h-full">
                  <div
                    className="absolute h-full bg-[var(--bg-elevated)] rounded-full"
                    style={{ width: `${profile.performanceMetrics.target * 100}%` }}
                  />
                  <div
                    className="absolute h-full rounded-full"
                    style={{
                      width: `${profile.performanceMetrics.baseline * 100}%`,
                      background: `var(--pillar-${pillarConfig.cssKey})`
                    }}
                  />
                </div>
              </div>
              {profile.performanceMetrics.secondaryMetric && (
                <div className="text-xs text-[var(--text-muted)] mt-2">
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

// =============================================================================
// COUNCIL PROFILES GRID — Filterable by Pillar
// =============================================================================

function CouncilProfilesGrid({ profiles }: { profiles: CouncilProfile[] }) {
  const [selectedProfile, setSelectedProfile] = useState<CouncilProfile | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'LOGOS' | 'ETHOS' | 'PATHOS'>('ALL');

  const filteredProfiles = useMemo(() => {
    if (filter === 'ALL') return profiles;
    return profiles.filter(p => p.primaryPillar === filter);
  }, [profiles, filter]);

  return (
    <div>
      {/* Filter buttons */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Council Cognitive Profiles</h2>
        <div className="flex gap-2 p-1 bg-[var(--bg-tertiary)]/60 rounded-lg">
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
                    : 'bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-interactive)]'
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
            <CouncilProfileCard
              profile={profile}
              onClick={() => setSelectedProfile(profile)}
            />
          </div>
        ))}
      </div>

      {/* Modal */}
      {selectedProfile && (
        <CouncilProfileModal
          profile={selectedProfile}
          onClose={() => setSelectedProfile(null)}
        />
      )}
    </div>
  );
}

// =============================================================================
// KNOWLEDGE SOURCES SECTION — Pillar-Organized with Stats
// =============================================================================

function KnowledgeSourcesSection() {
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
    LOGOS: sourcesData.sources.filter(s => s.pillar === 'LOGOS'),
    ETHOS: sourcesData.sources.filter(s => s.pillar === 'ETHOS'),
    PATHOS: sourcesData.sources.filter(s => s.pillar === 'PATHOS'),
    CROSS_CUTTING: sourcesData.sources.filter(s => s.pillar === 'CROSS_CUTTING'),
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 stagger-children">
        <div className="bg-[var(--bg-card)] backdrop-blur-md rounded-xl p-4 border border-[var(--border-muted)] transition-all hover:border-[var(--border-purple)] hover:shadow-lg hover:shadow-[var(--ari-purple-muted)]">
          <div className="text-2xl font-bold text-[var(--ari-purple)]">{sourcesData.total}</div>
          <div className="text-xs text-[var(--text-muted)]">Total Sources</div>
        </div>
        <div className="bg-[var(--bg-card)] backdrop-blur-md rounded-xl p-4 border border-[var(--border-muted)] transition-all hover:border-[var(--ari-success)] hover:border-opacity-50">
          <div className="text-2xl font-bold text-[var(--ari-success)]">{sourcesData.byTrustLevel.verified}</div>
          <div className="text-xs text-[var(--text-muted)]">Verified</div>
        </div>
        <div className="bg-[var(--bg-card)] backdrop-blur-md rounded-xl p-4 border border-[var(--border-muted)] transition-all hover:border-[var(--ari-warning)] hover:border-opacity-50">
          <div className="text-2xl font-bold text-[var(--ari-warning)]">{sourcesData.byTrustLevel.standard}</div>
          <div className="text-xs text-[var(--text-muted)]">Standard</div>
        </div>
        <div className="bg-[var(--bg-card)] backdrop-blur-md rounded-xl p-4 border border-[var(--border-muted)] transition-all hover:border-[var(--pillar-logos)] hover:border-opacity-50">
          <div className="text-2xl font-bold text-[var(--pillar-logos)]">{new Set(sourcesData.sources.flatMap(s => s.frameworks)).size}</div>
          <div className="text-xs text-[var(--text-muted)]">Frameworks</div>
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
              className="bg-[var(--bg-card)] backdrop-blur-md rounded-xl border p-5 transition-all duration-300 hover:shadow-lg animate-fade-in-up"
              style={{
                borderColor: `var(--pillar-${config.cssKey}-border)`,
                animationDelay: `${pillarIndex * 0.1}s`
              }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = `0 8px 32px var(--pillar-${config.cssKey}-glow)`}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{config.icon}</span>
                <div>
                  <h3 className="font-semibold text-[var(--text-primary)]">{pillar}</h3>
                  <p className="text-xs text-[var(--text-muted)]">{sources.length} sources</p>
                </div>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                {sources.slice(0, 10).map((source, index) => (
                  <div
                    key={source.id}
                    className="p-2 bg-[var(--bg-interactive)]/50 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                    style={{ animationDelay: `${(pillarIndex * 10 + index) * 0.03}s` }}
                  >
                    <div className="text-sm text-[var(--text-secondary)] truncate">{source.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        source.trustLevel === 'VERIFIED'
                          ? 'bg-[var(--ari-success-muted)] text-[var(--ari-success)]'
                          : 'bg-[var(--ari-warning-muted)] text-[var(--ari-warning)]'
                      }`}>
                        {source.trustLevel}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">{source.category}</span>
                    </div>
                  </div>
                ))}
                {sources.length > 10 && (
                  <div className="text-center text-xs text-[var(--text-muted)] py-2">
                    +{sources.length - 10} more sources
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMs < 0) {
    // Future date
    const futureMins = Math.abs(diffMins);
    const futureHours = Math.abs(diffHours);
    const futureDays = Math.abs(diffDays);
    if (futureMins < 60) return `in ${futureMins}m`;
    if (futureHours < 24) return `in ${futureHours}h`;
    return `in ${futureDays}d`;
  }

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

// =============================================================================
// MAIN COMPONENT — Cognitive Layer 0 Dashboard
// =============================================================================

export function Cognition() {
  const { status: wsStatus } = useWebSocketContext();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [realtimeActivity, setRealtimeActivity] = useState<CognitiveActivity[]>([]);

  // Fetch cognitive health
  const healthQuery = useQuery({
    queryKey: ['cognition', 'health'],
    queryFn: getCognitiveHealth,
    refetchInterval: 30000,
  });

  // Fetch learning status
  const learningQuery = useQuery({
    queryKey: ['cognition', 'learning'],
    queryFn: getLearningStatus,
    refetchInterval: 60000,
  });

  // Fetch framework usage
  const usageQuery = useQuery({
    queryKey: ['cognition', 'frameworks'],
    queryFn: getFrameworkUsage,
    refetchInterval: 60000,
  });

  // Fetch insights
  const insightsQuery = useQuery({
    queryKey: ['cognition', 'insights'],
    queryFn: () => getCognitiveInsights(10),
    refetchInterval: 60000,
  });

  // Fetch council profiles
  const profilesQuery = useQuery({
    queryKey: ['cognition', 'council-profiles'],
    queryFn: getCouncilProfiles,
    staleTime: 300000,
  });

  // Simulate real-time activity (in production, this would come from WebSocket)
  useEffect(() => {
    const apis = [
      { api: 'updateBelief', pillar: 'LOGOS' as const },
      { api: 'calculateExpectedValue', pillar: 'LOGOS' as const },
      { api: 'calculateKellyFraction', pillar: 'LOGOS' as const },
      { api: 'analyzeSystem', pillar: 'LOGOS' as const },
      { api: 'detectCognitiveBias', pillar: 'ETHOS' as const },
      { api: 'assessEmotionalState', pillar: 'ETHOS' as const },
      { api: 'checkDiscipline', pillar: 'ETHOS' as const },
      { api: 'reframeThought', pillar: 'PATHOS' as const },
      { api: 'queryWisdom', pillar: 'PATHOS' as const },
      { api: 'analyzeDichotomy', pillar: 'PATHOS' as const },
      { api: 'reflect', pillar: 'PATHOS' as const },
    ];

    const agents = ['Guardian', 'Strategic', 'Financial', 'Risk', 'Ethics', 'Planner', 'Memory', 'Core'];

    const simulateActivity = () => {
      const randomApi = apis[Math.floor(Math.random() * apis.length)];
      const randomAgent = agents[Math.floor(Math.random() * agents.length)];

      const newActivity: CognitiveActivity = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        agent: randomAgent,
        pillar: randomApi.pillar,
        api: randomApi.api,
        confidence: 0.7 + Math.random() * 0.25,
        duration: Math.floor(50 + Math.random() * 200),
      };

      setRealtimeActivity(prev => [newActivity, ...prev].slice(0, 50));
    };

    // Initial burst of activity
    for (let i = 0; i < 5; i++) {
      setTimeout(simulateActivity, i * 300);
    }

    // Ongoing simulation
    const interval = setInterval(simulateActivity, 2500 + Math.random() * 4000);
    return () => clearInterval(interval);
  }, []);

  // Loading state with purple shimmer
  if (healthQuery.isLoading) {
    return (
      <div className="p-6 space-y-6 bg-ari-radial min-h-screen">
        <Skeleton className="h-16 rounded-xl shimmer-purple" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-56 rounded-xl shimmer-purple" />
          <Skeleton className="h-56 rounded-xl shimmer-purple" />
          <Skeleton className="h-56 rounded-xl shimmer-purple" />
        </div>
      </div>
    );
  }

  // Error state
  if (healthQuery.isError) {
    return <ErrorState message="Failed to load cognitive health data" />;
  }

  const health = healthQuery.data!;
  const learningStatus = learningQuery.data;
  const frameworkUsage = usageQuery.data ?? [];
  const insights = insightsQuery.data ?? [];
  const profiles = profilesQuery.data ?? [];

  return (
    <div className="p-6 space-y-6 bg-ari-radial min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Cognitive Layer 0</h1>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">
            <span className="text-[var(--pillar-logos)]">LOGOS</span>
            <span className="mx-2 opacity-30">•</span>
            <span className="text-[var(--pillar-ethos)]">ETHOS</span>
            <span className="mx-2 opacity-30">•</span>
            <span className="text-[var(--pillar-pathos)]">PATHOS</span>
            <span className="mx-3 opacity-20">—</span>
            <span className="text-[var(--text-tertiary)]">The Three Pillars of Cognition</span>
          </p>
        </div>
        <div className="flex items-center gap-6">
          <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="flex items-center gap-4 pl-4 border-l border-[var(--border-muted)]">
            <div className="text-right">
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Sources</div>
              <div className="text-lg font-bold text-[var(--ari-purple)]">{health.knowledgeSources}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Health</div>
              <div className={`text-lg font-bold ${
                health.overall >= 0.8 ? 'text-[var(--ari-success)]' :
                health.overall >= 0.6 ? 'text-[var(--ari-warning)]' : 'text-[var(--ari-error)]'
              }`}>
                {(health.overall * 100).toFixed(0)}%
              </div>
            </div>
            <div className={`w-3 h-3 rounded-full transition-all ${
              wsStatus === 'connected' ? 'bg-[var(--ari-success)] shadow-md shadow-[var(--ari-success-muted)]' :
              wsStatus === 'connecting' || wsStatus === 'reconnecting' ? 'bg-[var(--ari-warning)] animate-pulse' :
              'bg-[var(--text-disabled)]'
            }`} title={wsStatus} />
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Three Pillars */}
          <section className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <h2 className="text-sm font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-4">Three Pillars</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 stagger-children">
              {health.pillars.map((pillar, index) => (
                <div key={pillar.pillar} style={{ animationDelay: `${index * 0.1}s` }}>
                  <PillarHealthCard pillar={pillar} />
                </div>
              ))}
            </div>
          </section>

          {/* Activity & Learning */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <CognitiveActivityFeed activities={realtimeActivity} />
            {learningStatus && <LearningLoopProgress status={learningStatus} />}
          </div>

          {/* Framework Usage & Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <FrameworkUsageChart data={frameworkUsage} />
            <InsightTimeline insights={insights} />
          </div>
        </>
      )}

      {activeTab === 'council' && (
        <div className="animate-fade-in-up">
          <CouncilProfilesGrid profiles={profiles} />
        </div>
      )}

      {activeTab === 'sources' && (
        <div className="animate-fade-in-up">
          <KnowledgeSourcesSection />
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up">
          <InsightTimeline insights={insights} />
          <div className="bg-[var(--bg-card)] backdrop-blur-md rounded-xl border border-[var(--border-muted)] p-5">
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-4">Insight Types</h3>
            <div className="space-y-3">
              {[
                { type: 'SUCCESS', label: 'Success', icon: '✓', desc: 'Strategies that worked well', color: 'var(--ari-success)' },
                { type: 'MISTAKE', label: 'Mistake', icon: '✗', desc: 'Errors to learn from', color: 'var(--ari-error)' },
                { type: 'PATTERN', label: 'Pattern', icon: '◉', desc: 'Recurring behaviors detected', color: 'var(--ari-purple)' },
                { type: 'PRINCIPLE', label: 'Principle', icon: '★', desc: 'General rules extracted', color: 'var(--ari-warning)' },
                { type: 'ANTIPATTERN', label: 'Antipattern', icon: '⚠', desc: 'Behaviors to avoid', color: 'var(--pillar-ethos)' },
              ].map((item, index) => (
                <div
                  key={item.type}
                  className="flex items-center gap-3 p-3 bg-[var(--bg-interactive)]/50 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors animate-fade-in-up"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                    style={{ background: `color-mix(in srgb, ${item.color} 20%, transparent)`, color: item.color }}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[var(--text-secondary)]">{item.label}</div>
                    <div className="text-xs text-[var(--text-muted)]">{item.desc}</div>
                  </div>
                  <div className="ml-auto text-lg font-bold" style={{ color: item.color }}>
                    {insights.filter(i => i.type === item.type).length}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
