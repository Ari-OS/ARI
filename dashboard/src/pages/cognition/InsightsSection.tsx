/**
 * InsightsSection Component
 * Displays cognitive insights timeline and type breakdown
 */

import type { CognitiveInsight } from '../../api/client';
import { INSIGHT_TYPE_CONFIG, formatRelativeTime } from './constants';

interface InsightsSectionProps {
  insights: CognitiveInsight[];
}

export function InsightsSection({ insights }: InsightsSectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up">
      <InsightTimeline insights={insights} />
      <InsightTypeBreakdown insights={insights} />
    </div>
  );
}

function InsightTimeline({ insights }: { insights: CognitiveInsight[] }) {
  return (
    <div className="bg-bg-card backdrop-blur-md rounded-xl border border-border-muted p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-text-primary">Recent Insights</h3>
        <span className="text-xs text-text-muted">{insights.length} insights</span>
      </div>

      <div className="space-y-3">
        {insights.map((insight, index) => {
          const config = INSIGHT_TYPE_CONFIG[insight.type];
          return (
            <div
              key={insight.id}
              className={`p-3.5 rounded-lg ${config.bg} border transition-all duration-200 hover:scale-[1.01] animate-fade-in-up`}
              style={{
                borderColor: config.borderColor,
                animationDelay: `${index * 0.1}s`,
              }}
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full ${config.bg} ${config.color} text-base font-bold`}>
                  {config.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-text-secondary text-sm leading-relaxed">{insight.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
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

function InsightTypeBreakdown({ insights }: { insights: CognitiveInsight[] }) {
  const typeData = [
    {
      type: 'SUCCESS',
      label: 'Success',
      icon: '✓',
      desc: 'Strategies that worked well',
      color: 'var(--ari-success)',
    },
    { type: 'MISTAKE', label: 'Mistake', icon: '✗', desc: 'Errors to learn from', color: 'var(--ari-error)' },
    { type: 'PATTERN', label: 'Pattern', icon: '◉', desc: 'Recurring behaviors detected', color: 'var(--ari-purple)' },
    { type: 'PRINCIPLE', label: 'Principle', icon: '★', desc: 'General rules extracted', color: 'var(--ari-warning)' },
    {
      type: 'ANTIPATTERN',
      label: 'Antipattern',
      icon: '⚠',
      desc: 'Behaviors to avoid',
      color: 'var(--pillar-ethos)',
    },
  ];

  return (
    <div className="bg-bg-card backdrop-blur-md rounded-xl border border-border-muted p-5">
      <h3 className="text-base font-semibold text-text-primary mb-4">Insight Types</h3>
      <div className="space-y-3">
        {typeData.map((item, index) => (
          <div
            key={item.type}
            className="flex items-center gap-3 p-3 bg-bg-interactive/50 rounded-lg hover:bg-bg-elevated transition-colors animate-fade-in-up"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
              style={{
                background: `color-mix(in srgb, ${item.color} 20%, transparent)`,
                color: item.color,
              }}
            >
              {item.icon}
            </div>
            <div>
              <div className="text-sm font-medium text-text-secondary">{item.label}</div>
              <div className="text-xs text-text-muted">{item.desc}</div>
            </div>
            <div className="ml-auto text-lg font-bold" style={{ color: item.color }}>
              {insights.filter((i) => i.type === item.type).length}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
