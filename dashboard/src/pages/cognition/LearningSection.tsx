/**
 * LearningSection Component
 * Displays learning loop progress and analytics (retention + practice quality)
 */

import type { LearningStatus, LearningAnalytics } from '../../api/client';
import { LEARNING_STAGES, formatRelativeTime } from './constants';

interface LearningSectionProps {
  status: LearningStatus | undefined;
  analytics: LearningAnalytics | undefined;
}

export function LearningSection({ status, analytics }: LearningSectionProps) {
  if (!status && !analytics) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
      {status && <LearningLoopProgress status={status} />}
      {analytics && <LearningAnalyticsCard analytics={analytics} />}
    </div>
  );
}

function LearningLoopProgress({ status }: { status: LearningStatus }) {
  const currentIndex = LEARNING_STAGES.findIndex((s) => s.id === status.currentStage);

  return (
    <div className="bg-bg-card backdrop-blur-md rounded-xl border border-border-muted p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-semibold text-text-primary">Learning Loop</h3>
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
            status.improvementTrend === 'improving'
              ? 'bg-ari-success-muted text-ari-success'
              : status.improvementTrend === 'declining'
              ? 'bg-ari-error-muted text-ari-error'
              : 'bg-ari-warning-muted text-ari-warning'
          }`}
        >
          {status.improvementTrend === 'improving' ? '↑' : status.improvementTrend === 'declining' ? '↓' : '→'}
          {status.improvementTrend.charAt(0).toUpperCase() + status.improvementTrend.slice(1)}
        </div>
      </div>

      {/* Stage Progress */}
      <div className="relative mb-6">
        {/* Progress line background */}
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-bg-interactive" />
        {/* Progress line filled */}
        <div
          className="absolute top-4 left-4 h-0.5 bg-ari-success transition-all duration-700"
          style={{ width: `${(currentIndex / (LEARNING_STAGES.length - 1)) * (100 - 8)}%` }}
        />

        {/* Stage indicators */}
        <div className="relative flex justify-between">
          {LEARNING_STAGES.map((stage, index) => (
            <div key={stage.id} className="flex flex-col items-center" title={stage.fullName}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                  index === currentIndex
                    ? 'bg-ari-purple text-white ring-2 ring-[var(--ari-purple-400)] ring-offset-2 ring-offset-bg-card'
                    : index < currentIndex
                    ? 'bg-ari-success text-white'
                    : 'bg-bg-interactive text-text-muted'
                }`}
              >
                <span className="text-sm">{stage.icon}</span>
              </div>
              <span
                className={`mt-2 text-[10px] font-medium ${
                  index === currentIndex
                    ? 'text-ari-purple'
                    : index < currentIndex
                    ? 'text-ari-success'
                    : 'text-text-muted'
                }`}
              >
                {stage.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-bg-interactive/50 rounded-lg p-3">
          <div className="text-xs text-text-muted">Last Review</div>
          <div className="text-sm font-medium text-text-secondary">{formatRelativeTime(status.lastReview)}</div>
        </div>
        <div className="bg-bg-interactive/50 rounded-lg p-3">
          <div className="text-xs text-text-muted">Next Review</div>
          <div className="text-sm font-medium text-text-secondary">{formatRelativeTime(status.nextReview)}</div>
        </div>
        <div className="bg-bg-interactive/50 rounded-lg p-3">
          <div className="text-xs text-text-muted">Recent Insights</div>
          <div className="text-lg font-bold text-ari-purple">{status.recentInsightsCount}</div>
        </div>
        <div className="bg-bg-interactive/50 rounded-lg p-3">
          <div className="text-xs text-text-muted">Next Assessment</div>
          <div className="text-sm font-medium text-text-secondary">{formatRelativeTime(status.nextAssessment)}</div>
        </div>
      </div>
    </div>
  );
}

function LearningAnalyticsCard({ analytics }: { analytics: LearningAnalytics }) {
  const retentionPct = analytics.retentionMetrics.retentionRate * 100;
  const focusPct = analytics.practiceQuality.focusRatio * 100;

  return (
    <div className="bg-bg-card backdrop-blur-md rounded-xl border border-border-muted p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-text-primary">Learning Analytics</h3>
        <span className="text-xs text-text-muted">{analytics.retentionMetrics.dueNow} due</span>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-text-muted">Retention rate</span>
            <span className="text-xs font-medium text-text-secondary">{retentionPct.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-bg-interactive rounded-full overflow-hidden">
            <div className="h-full bg-ari-success" style={{ width: `${retentionPct}%` }} />
          </div>
          <div className="text-[10px] text-text-muted mt-1">
            {analytics.retentionMetrics.successfulReviews}/{analytics.retentionMetrics.reviews} successful reviews
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-text-muted">Focus ratio</span>
            <span className="text-xs font-medium text-text-secondary">{focusPct.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-bg-interactive rounded-full overflow-hidden">
            <div className="h-full bg-ari-purple" style={{ width: `${focusPct}%` }} />
          </div>
          <div className="text-[10px] text-text-muted mt-1">
            {analytics.practiceQuality.deliberateHours.toFixed(1)}h focused •{' '}
            {analytics.practiceQuality.distractedHours.toFixed(1)}h distracted
          </div>
        </div>

        {analytics.insights.length > 0 && (
          <div className="pt-3 border-t border-border-subtle">
            <div className="text-xs text-text-muted mb-2">Insights</div>
            <div className="space-y-2">
              {analytics.insights.slice(0, 3).map((i, idx) => (
                <div key={idx} className="text-xs text-text-secondary">
                  <span className="text-ari-warning">•</span> {i.pattern} — {i.recommendation}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
