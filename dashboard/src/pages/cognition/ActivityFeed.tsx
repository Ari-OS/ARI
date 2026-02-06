/**
 * ActivityFeed Component
 * Real-time cognitive activity feed
 */

import { PILLAR_CONFIG } from './constants';

export interface CognitiveActivity {
  id: string;
  timestamp: string;
  agent: string;
  pillar: 'LOGOS' | 'ETHOS' | 'PATHOS';
  api: string;
  confidence: number;
  duration: number;
}

interface ActivityFeedProps {
  activities: CognitiveActivity[];
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <div className="bg-bg-card backdrop-blur-md rounded-xl border border-border-muted p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-text-primary">Real-Time Activity</h3>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-ari-success animate-pulse shadow-sm shadow-ari-success" />
          <span className="text-xs text-text-muted">Live</span>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-2 opacity-50">🧠</div>
          <p className="text-text-muted text-sm">Waiting for cognitive activity...</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
          {activities.slice(0, 15).map((activity, index) => {
            const config = PILLAR_CONFIG[activity.pillar];
            return (
              <div
                key={activity.id}
                className="flex items-center gap-3 p-2.5 bg-bg-interactive/50 rounded-lg hover:bg-bg-elevated transition-all duration-200 animate-fade-in-up"
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
                  <div className="text-xs text-text-muted">{activity.agent}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono text-text-tertiary">{activity.duration}ms</div>
                  <div
                    className={`text-[10px] font-medium ${
                      activity.confidence >= 0.8
                        ? 'text-ari-success'
                        : activity.confidence >= 0.6
                        ? 'text-ari-warning'
                        : 'text-ari-error'
                    }`}
                  >
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
