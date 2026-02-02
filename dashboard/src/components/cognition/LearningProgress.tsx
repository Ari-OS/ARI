/**
 * LearningProgress — Components for displaying learning system status
 *
 * Includes:
 * - SkillProgressCard: Individual skill proficiency display
 * - ReviewCalendar: Heatmap of review activity
 * - LearningLoopProgress: Current stage in the learning loop
 * - StreakDisplay: Review streak visualization
 */

import { useMemo } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface SkillProficiency {
  skillId: string;
  skillName: string;
  domain: 'LOGOS' | 'ETHOS' | 'PATHOS';
  currentLevel: number;
  targetLevel: number;
  practiceStreak: number;
  lastPractice?: string;
  zpd: {
    lowerBound: number;
    upperBound: number;
    current: 'BELOW' | 'IN_ZPD' | 'ABOVE';
  };
  weeklyGain: number;
  plateau?: boolean;
}

export interface ReviewActivity {
  date: string;
  count: number;
  quality: number;
}

export type LearningStage =
  | 'PERFORMANCE_REVIEW'
  | 'GAP_ANALYSIS'
  | 'SOURCE_DISCOVERY'
  | 'KNOWLEDGE_INTEGRATION'
  | 'SELF_ASSESSMENT';

// =============================================================================
// SKILL PROGRESS CARD
// =============================================================================

interface SkillProgressCardProps {
  skill: SkillProficiency;
  onPractice?: () => void;
}

const DOMAIN_CONFIG = {
  LOGOS: { icon: '🧠', color: 'blue' },
  ETHOS: { icon: '❤️', color: 'orange' },
  PATHOS: { icon: '🌱', color: 'green' },
};

export function SkillProgressCard({ skill, onPractice }: SkillProgressCardProps) {
  const config = DOMAIN_CONFIG[skill.domain];
  const percentage = (skill.currentLevel / 100) * 100;
  const targetPercentage = (skill.targetLevel / 100) * 100;

  const zpdStatus = {
    BELOW: { label: 'Too Easy', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
    IN_ZPD: { label: 'Optimal', color: 'text-green-400', bg: 'bg-green-500/20' },
    ABOVE: { label: 'Too Hard', color: 'text-red-400', bg: 'bg-red-500/20' },
  }[skill.zpd.current];

  return (
    <div className="card-ari p-4 hover:border-purple-500/30 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{config.icon}</span>
          <div>
            <h4 className="font-semibold text-slate-200">{skill.skillName}</h4>
            <span className="text-xs text-slate-400">{skill.domain}</span>
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded ${zpdStatus.bg} ${zpdStatus.color}`}>
          {zpdStatus.label}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>Level {skill.currentLevel}</span>
          <span>Target: {skill.targetLevel}</span>
        </div>
        <div className="relative h-4 bg-slate-700 rounded-full overflow-hidden">
          {/* Current progress */}
          <div
            className={`absolute inset-y-0 left-0 bg-${config.color}-500 rounded-full transition-all duration-500`}
            style={{ width: `${percentage}%` }}
          />
          {/* Target marker */}
          <div
            className="absolute inset-y-0 w-0.5 bg-white/50"
            style={{ left: `${targetPercentage}%` }}
          />
        </div>
      </div>

      {/* ZPD Visualization */}
      <div className="mb-3 p-2 bg-slate-800/50 rounded-lg">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Zone of Proximal Development</span>
        </div>
        <div className="relative h-2 bg-slate-700 rounded-full">
          {/* ZPD zone */}
          <div
            className="absolute inset-y-0 bg-green-500/30 rounded-full"
            style={{
              left: `${skill.zpd.lowerBound}%`,
              width: `${skill.zpd.upperBound - skill.zpd.lowerBound}%`,
            }}
          />
          {/* Current position */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow"
            style={{ left: `${skill.currentLevel}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>{skill.zpd.lowerBound}</span>
          <span>{skill.zpd.upperBound}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="text-slate-400">
            🔥 {skill.practiceStreak} day streak
          </span>
          <span className="text-slate-400">
            📈 +{skill.weeklyGain}/week
          </span>
        </div>
        {skill.plateau && (
          <span className="text-yellow-400">⚠️ Plateau</span>
        )}
      </div>

      {/* Practice Button */}
      {onPractice && (
        <button
          onClick={onPractice}
          className="w-full mt-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-sm text-purple-300 transition-all"
        >
          Practice Now
        </button>
      )}
    </div>
  );
}

// =============================================================================
// REVIEW CALENDAR (HEATMAP)
// =============================================================================

interface ReviewCalendarProps {
  activities: ReviewActivity[];
  weeks?: number;
}

export function ReviewCalendar({ activities, weeks = 12 }: ReviewCalendarProps) {
  const activityMap = useMemo(() => {
    const map = new Map<string, ReviewActivity>();
    activities.forEach(a => map.set(a.date, a));
    return map;
  }, [activities]);

  // Generate dates for the calendar
  const dates = useMemo(() => {
    const result: (Date | null)[][] = [];
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - weeks * 7);

    // Align to start of week (Sunday)
    startDate.setDate(startDate.getDate() - startDate.getDay());

    let currentWeek: (Date | null)[] = [];
    const endDate = new Date(today);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      currentWeek.push(new Date(d));
      if (currentWeek.length === 7) {
        result.push(currentWeek);
        currentWeek = [];
      }
    }

    // Pad the last week
    while (currentWeek.length < 7 && currentWeek.length > 0) {
      currentWeek.push(null);
    }
    if (currentWeek.length > 0) {
      result.push(currentWeek);
    }

    return result;
  }, [weeks]);

  const getIntensity = (date: Date | null): string => {
    if (!date) return 'bg-transparent';
    const dateStr = date.toISOString().split('T')[0];
    const activity = activityMap.get(dateStr);
    if (!activity || activity.count === 0) return 'bg-slate-800';
    if (activity.count <= 2) return 'bg-purple-900';
    if (activity.count <= 5) return 'bg-purple-700';
    if (activity.count <= 10) return 'bg-purple-500';
    return 'bg-purple-400';
  };

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="card-ari p-4">
      <h4 className="text-sm font-semibold text-slate-300 mb-3">Review Activity</h4>
      <div className="flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col gap-1 mr-1">
          {dayLabels.map((day, i) => (
            <div key={i} className="w-3 h-3 text-[8px] text-slate-500 flex items-center justify-center">
              {i % 2 === 1 ? day : ''}
            </div>
          ))}
        </div>
        {/* Calendar grid */}
        <div className="flex gap-1">
          {dates.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-1">
              {week.map((date, dayIndex) => {
                const activity = date ? activityMap.get(date.toISOString().split('T')[0]) : null;
                return (
                  <div
                    key={dayIndex}
                    className={`w-3 h-3 rounded-sm ${getIntensity(date)} transition-colors`}
                    title={date ? `${date.toLocaleDateString()}: ${activity?.count || 0} reviews` : ''}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
        <span>Less</span>
        <div className="flex gap-1">
          <div className="w-3 h-3 rounded-sm bg-slate-800" />
          <div className="w-3 h-3 rounded-sm bg-purple-900" />
          <div className="w-3 h-3 rounded-sm bg-purple-700" />
          <div className="w-3 h-3 rounded-sm bg-purple-500" />
          <div className="w-3 h-3 rounded-sm bg-purple-400" />
        </div>
        <span>More</span>
      </div>
    </div>
  );
}

// =============================================================================
// LEARNING LOOP PROGRESS
// =============================================================================

interface LearningLoopProgressProps {
  currentStage: LearningStage;
  lastRun?: string;
}

const STAGES = [
  { id: 'PERFORMANCE_REVIEW', icon: '📊', name: 'Review', schedule: 'Daily 9PM' },
  { id: 'GAP_ANALYSIS', icon: '🔍', name: 'Gaps', schedule: 'Sunday 8PM' },
  { id: 'SOURCE_DISCOVERY', icon: '📚', name: 'Discover', schedule: 'On-demand' },
  { id: 'KNOWLEDGE_INTEGRATION', icon: '🧩', name: 'Integrate', schedule: 'Continuous' },
  { id: 'SELF_ASSESSMENT', icon: '📝', name: 'Assess', schedule: '1st of month' },
];

export function LearningLoopProgress({ currentStage, lastRun }: LearningLoopProgressProps) {
  const currentIndex = STAGES.findIndex(s => s.id === currentStage);

  return (
    <div className="card-ari p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-slate-300">Learning Loop</h4>
        {lastRun && (
          <span className="text-xs text-slate-500">
            Last: {new Date(lastRun).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Stage Progress */}
      <div className="flex items-center justify-between mb-4">
        {STAGES.map((stage, i) => {
          const isComplete = i < currentIndex;
          const isCurrent = i === currentIndex;
          const isPending = i > currentIndex;

          return (
            <div key={stage.id} className="flex flex-col items-center">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-lg
                  ${isComplete ? 'bg-green-500/20 border-green-500/50' : ''}
                  ${isCurrent ? 'bg-purple-500/20 border-purple-500/50 animate-pulse' : ''}
                  ${isPending ? 'bg-slate-800 border-slate-700' : ''}
                  border
                `}
              >
                {isComplete ? '✅' : stage.icon}
              </div>
              <span className={`text-xs mt-1 ${isCurrent ? 'text-purple-400' : 'text-slate-500'}`}>
                {stage.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress Line */}
      <div className="relative h-1 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 to-purple-500 rounded-full transition-all duration-500"
          style={{ width: `${((currentIndex + 1) / STAGES.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

// =============================================================================
// STREAK DISPLAY
// =============================================================================

interface StreakDisplayProps {
  currentStreak: number;
  longestStreak: number;
  todayComplete: boolean;
}

export function StreakDisplay({ currentStreak, longestStreak, todayComplete }: StreakDisplayProps) {
  return (
    <div className="card-ari p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-3xl">🔥</span>
            <span className="text-3xl font-bold text-orange-400">{currentStreak}</span>
          </div>
          <p className="text-sm text-slate-400 mt-1">day streak</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Longest: {longestStreak} days</p>
          <div className={`text-xs mt-1 ${todayComplete ? 'text-green-400' : 'text-yellow-400'}`}>
            {todayComplete ? '✅ Today complete' : '⏳ Review due today'}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// CARDS DUE DISPLAY
// =============================================================================

interface CardsDueProps {
  total: number;
  byPillar: {
    LOGOS: number;
    ETHOS: number;
    PATHOS: number;
  };
  onStartReview?: () => void;
}

export function CardsDue({ total, byPillar, onStartReview }: CardsDueProps) {
  if (total === 0) {
    return (
      <div className="card-ari p-4 text-center">
        <span className="text-4xl">🎉</span>
        <p className="text-slate-300 mt-2">All caught up!</p>
        <p className="text-xs text-slate-500">No cards due for review</p>
      </div>
    );
  }

  return (
    <div className="card-ari p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-2xl font-bold text-white">{total}</span>
          <span className="text-sm text-slate-400 ml-2">cards due</span>
        </div>
        {onStartReview && (
          <button
            onClick={onStartReview}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm transition-colors"
          >
            Start Review
          </button>
        )}
      </div>

      <div className="flex gap-4">
        <div className="flex items-center gap-1">
          <span>🧠</span>
          <span className="text-xs text-slate-400">{byPillar.LOGOS}</span>
        </div>
        <div className="flex items-center gap-1">
          <span>❤️</span>
          <span className="text-xs text-slate-400">{byPillar.ETHOS}</span>
        </div>
        <div className="flex items-center gap-1">
          <span>🌱</span>
          <span className="text-xs text-slate-400">{byPillar.PATHOS}</span>
        </div>
      </div>
    </div>
  );
}

export default {
  SkillProgressCard,
  ReviewCalendar,
  LearningLoopProgress,
  StreakDisplay,
  CardsDue,
};
