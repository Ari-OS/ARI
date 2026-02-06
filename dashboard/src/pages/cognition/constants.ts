/**
 * Cognition Page Constants
 * Pillar configuration, type mappings, and stage definitions
 */

export type PillarType = 'LOGOS' | 'ETHOS' | 'PATHOS';

export interface PillarConfig {
  icon: string;
  name: string;
  cssKey: string;
  bgClass: string;
  bgClassMuted: string;
  textClass: string;
  borderClass: string;
  gradientClass: string;
  glowClass: string;
  cardClass: string;
  badgeClass: string;
  description: string;
}

export const PILLAR_CONFIG: Record<PillarType, PillarConfig> = {
  LOGOS: {
    icon: '🧠',
    name: 'Reason',
    cssKey: 'logos',
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

export const LEARNING_STAGES = [
  { id: 'performance_review', name: 'Review', icon: '📊', fullName: 'Performance Review' },
  { id: 'gap_analysis', name: 'Analysis', icon: '🔍', fullName: 'Gap Analysis' },
  { id: 'source_discovery', name: 'Discovery', icon: '📚', fullName: 'Source Discovery' },
  { id: 'knowledge_integration', name: 'Integration', icon: '🧩', fullName: 'Knowledge Integration' },
  { id: 'self_assessment', name: 'Assessment', icon: '📝', fullName: 'Self-Assessment' },
];

export const INSIGHT_TYPE_CONFIG = {
  SUCCESS: {
    icon: '✓',
    color: 'text-ari-success',
    bg: 'bg-ari-success-muted',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  MISTAKE: {
    icon: '✗',
    color: 'text-ari-error',
    bg: 'bg-ari-error-muted',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  PATTERN: {
    icon: '◉',
    color: 'text-ari-purple',
    bg: 'bg-ari-purple-muted',
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  PRINCIPLE: {
    icon: '★',
    color: 'text-ari-warning',
    bg: 'bg-ari-warning-muted',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  ANTIPATTERN: {
    icon: '⚠',
    color: 'text-pillar-ethos',
    bg: 'bg-pillar-ethos-muted',
    borderColor: 'rgba(251, 146, 60, 0.3)',
  },
};

export function formatRelativeTime(isoString: string): string {
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
