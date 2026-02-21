/**
 * LearningProgress — Components for displaying learning system status
 *
 * Includes:
 * - SkillProgressCard: Individual skill proficiency display
 * - ReviewCalendar: Heatmap of review activity with mobile support
 * - LearningLoopProgress: Current stage in the learning loop
 * - StreakDisplay: Review streak visualization
 * - ZPDVisualization: Reusable Zone of Proximal Development component
 *
 * Accessibility:
 * - ARIA labels on all interactive elements
 * - Keyboard navigation support
 * - Screen reader alternatives
 * - Prefers-reduced-motion support
 */

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';

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

export type DetailLevel = 'minimal' | 'standard' | 'full';

// =============================================================================
// ZPD VISUALIZATION (REUSABLE COMPONENT)
// =============================================================================

interface ZPDVisualizationProps {
  lowerBound: number;
  upperBound: number;
  currentLevel: number;
  status: 'BELOW' | 'IN_ZPD' | 'ABOVE';
  skillName?: string;
  compact?: boolean;
}

export function ZPDVisualization({
  lowerBound,
  upperBound,
  currentLevel,
  status,
  skillName,
  compact = false,
}: ZPDVisualizationProps) {
  const statusConfig = {
    BELOW: {
      label: 'Too Easy',
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/20',
      ariaDescription: 'below the optimal learning zone',
    },
    IN_ZPD: {
      label: 'Optimal',
      color: 'text-green-400',
      bg: 'bg-green-500/20',
      ariaDescription: 'in the optimal learning zone',
    },
    ABOVE: {
      label: 'Too Hard',
      color: 'text-red-400',
      bg: 'bg-red-500/20',
      ariaDescription: 'above the optimal learning zone',
    },
  }[status];

  const zpdWidth = upperBound - lowerBound;
  const currentPosition = Math.max(0, Math.min(100, currentLevel));

  return (
    <div className={compact ? '' : 'p-2 bg-slate-800/50 rounded-lg'}>
      {!compact && (
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Zone of Proximal Development</span>
          <span className={`${statusConfig.color}`}>{statusConfig.label}</span>
        </div>
      )}
      <div
        className="relative h-2 bg-slate-700 rounded-full"
        role="progressbar"
        aria-label={`${skillName ? `${skillName} ` : ''}Zone of Proximal Development`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={currentPosition}
        aria-valuetext={`Current level ${currentLevel}, ${statusConfig.ariaDescription}. Optimal zone is ${lowerBound} to ${upperBound}.`}
      >
        {/* ZPD zone */}
        <div
          className="absolute inset-y-0 bg-green-500/30 rounded-full"
          style={{
            left: `${lowerBound}%`,
            width: `${zpdWidth}%`,
          }}
          aria-hidden="true"
        />
        {/* Current position */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow transition-all motion-reduce:transition-none"
          style={{ left: `${currentPosition}%` }}
          aria-hidden="true"
        />
      </div>
      {!compact && (
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span aria-label="Lower bound">{lowerBound}</span>
          <span aria-label="Upper bound">{upperBound}</span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SKILL PROGRESS CARD
// =============================================================================

interface SkillProgressCardProps {
  skill: SkillProficiency;
  onPractice?: () => void;
  detailLevel?: DetailLevel;
}

const DOMAIN_CONFIG = {
  LOGOS: { icon: '🧠', color: 'blue', label: 'Reasoning' },
  ETHOS: { icon: '❤️', color: 'orange', label: 'Values' },
  PATHOS: { icon: '🌱', color: 'green', label: 'Emotions' },
} as const;

// Explicit Tailwind class mappings for JIT
const BG_COLOR_MAP = {
  blue: 'bg-blue-500',
  orange: 'bg-orange-500',
  green: 'bg-green-500',
} as const;

export function SkillProgressCard({
  skill,
  onPractice,
  detailLevel = 'standard',
}: SkillProgressCardProps) {
  const config = DOMAIN_CONFIG[skill.domain];
  const percentage = (skill.currentLevel / 100) * 100;
  const targetPercentage = (skill.targetLevel / 100) * 100;

  const zpdStatus = {
    BELOW: { label: 'Too Easy', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
    IN_ZPD: { label: 'Optimal', color: 'text-green-400', bg: 'bg-green-500/20' },
    ABOVE: { label: 'Too Hard', color: 'text-red-400', bg: 'bg-red-500/20' },
  }[skill.zpd.current];

  const showStats = detailLevel !== 'minimal';
  const showZPD = detailLevel === 'full';

  return (
    <article
      className="card-ari p-4 hover:border-purple-500/30 transition-all motion-reduce:transition-none"
      aria-labelledby={`skill-${skill.skillId}-title`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl" role="img" aria-label={config.label}>
            {config.icon}
          </span>
          <div>
            <h4 id={`skill-${skill.skillId}-title`} className="font-semibold text-slate-200">
              {skill.skillName}
            </h4>
            <span className="text-xs text-slate-400">{skill.domain}</span>
          </div>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded ${zpdStatus.bg} ${zpdStatus.color}`}
          role="status"
          aria-label={`Difficulty: ${zpdStatus.label}`}
        >
          {zpdStatus.label}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span aria-label={`Current level ${skill.currentLevel}`}>Level {skill.currentLevel}</span>
          <span aria-label={`Target level ${skill.targetLevel}`}>Target: {skill.targetLevel}</span>
        </div>
        <div
          className="relative h-4 bg-slate-700 rounded-full overflow-hidden"
          role="progressbar"
          aria-label={`${skill.skillName} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={skill.currentLevel}
          aria-valuetext={`${skill.currentLevel} out of ${skill.targetLevel}`}
        >
          {/* Current progress */}
          <div
            className={`absolute inset-y-0 left-0 ${BG_COLOR_MAP[config.color]} rounded-full transition-all duration-500 motion-reduce:transition-none`}
            style={{ width: `${percentage}%` }}
            aria-hidden="true"
          />
          {/* Target marker */}
          <div
            className="absolute inset-y-0 w-0.5 bg-white/50"
            style={{ left: `${targetPercentage}%` }}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* ZPD Visualization */}
      {showZPD && (
        <div className="mb-3">
          <ZPDVisualization
            lowerBound={skill.zpd.lowerBound}
            upperBound={skill.zpd.upperBound}
            currentLevel={skill.currentLevel}
            status={skill.zpd.current}
            skillName={skill.skillName}
          />
        </div>
      )}

      {/* Stats */}
      {showStats && (
        <div className="flex items-center justify-between text-xs" role="region" aria-label="Skill statistics">
          <div className="flex items-center gap-3">
            <span className="text-slate-400" aria-label={`${skill.practiceStreak} day practice streak`}>
              <span role="img" aria-label="Fire">🔥</span> {skill.practiceStreak} day streak
            </span>
            <span className="text-slate-400" aria-label={`Weekly gain of ${skill.weeklyGain} points`}>
              <span role="img" aria-label="Trending up">📈</span> +{skill.weeklyGain}/week
            </span>
          </div>
          {skill.plateau && (
            <span className="text-yellow-400" role="status" aria-label="Warning: Learning plateau detected">
              <span role="img" aria-label="Warning">⚠️</span> Plateau
            </span>
          )}
        </div>
      )}

      {/* Practice Button */}
      {onPractice && (
        <button
          onClick={onPractice}
          className="w-full mt-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 active:bg-purple-500/40 border border-purple-500/30 rounded-lg text-sm text-purple-300 transition-all motion-reduce:transition-none focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          aria-label={`Start practice session for ${skill.skillName}`}
        >
          Practice Now
        </button>
      )}
    </article>
  );
}

// =============================================================================
// REVIEW CALENDAR (HEATMAP)
// =============================================================================

interface ReviewCalendarProps {
  activities: ReviewActivity[];
  weeks?: number;
  detailLevel?: DetailLevel;
}

// Explicit intensity class mappings for Tailwind JIT
const INTENSITY_CLASSES = {
  0: 'bg-slate-800',
  1: 'bg-purple-900',
  2: 'bg-purple-700',
  3: 'bg-purple-500',
  4: 'bg-purple-400',
} as const;

export function ReviewCalendar({
  activities,
  weeks = 12,
  detailLevel = 'standard',
}: ReviewCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [focusedCell, setFocusedCell] = useState<{ week: number; day: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const activityMap = useMemo(() => {
    const map = new Map<string, ReviewActivity>();
    activities.forEach((a) => map.set(a.date, a));
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

  const getIntensityLevel = (date: Date | null): 0 | 1 | 2 | 3 | 4 => {
    if (!date) return 0;
    const dateStr = date.toISOString().split('T')[0];
    const activity = activityMap.get(dateStr);
    if (!activity || activity.count === 0) return 0;
    if (activity.count <= 2) return 1;
    if (activity.count <= 5) return 2;
    if (activity.count <= 10) return 3;
    return 4;
  };

  const getIntensityClass = (date: Date | null): string => {
    if (!date) return 'bg-transparent';
    return INTENSITY_CLASSES[getIntensityLevel(date)];
  };

  const handleCellClick = useCallback((date: Date | null) => {
    if (date) {
      setSelectedDate(date);
    }
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, weekIndex: number, dayIndex: number) => {
      let newWeek = weekIndex;
      let newDay = dayIndex;

      switch (event.key) {
        case 'ArrowRight':
          event.preventDefault();
          newWeek = Math.min(dates.length - 1, weekIndex + 1);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          newWeek = Math.max(0, weekIndex - 1);
          break;
        case 'ArrowDown':
          event.preventDefault();
          newDay = Math.min(6, dayIndex + 1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          newDay = Math.max(0, dayIndex - 1);
          break;
        case 'Enter':
        case ' ': {
          event.preventDefault();
          const date = dates[weekIndex][dayIndex];
          if (date) {
            handleCellClick(date);
          }
          break;
        }
        default:
          return;
      }

      setFocusedCell({ week: newWeek, day: newDay });
    },
    [dates, handleCellClick]
  );

  // Focus management for keyboard navigation
  useEffect(() => {
    if (focusedCell && gridRef.current) {
      const cell = gridRef.current.querySelector(
        `[data-week="${focusedCell.week}"][data-day="${focusedCell.day}"]`
      ) as HTMLElement;
      cell?.focus();
    }
  }, [focusedCell]);

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const selectedActivity = selectedDate
    ? activityMap.get(selectedDate.toISOString().split('T')[0])
    : null;

  return (
    <section className="card-ari p-4" aria-labelledby="review-calendar-title">
      <h4 id="review-calendar-title" className="text-sm font-semibold text-slate-300 mb-3">
        Review Activity
      </h4>
      <div className="flex gap-1" ref={gridRef}>
        {/* Day labels */}
        {detailLevel !== 'minimal' && (
          <div className="flex flex-col gap-1 mr-1" aria-hidden="true">
            {dayLabels.map((day, i) => (
              <div
                key={i}
                className="w-3 h-3 text-[8px] text-slate-500 flex items-center justify-center"
              >
                {i % 2 === 1 ? day : ''}
              </div>
            ))}
          </div>
        )}
        {/* Calendar grid */}
        <div
          className="flex gap-1"
          role="grid"
          aria-label="Review activity heatmap"
          aria-describedby="heatmap-instructions"
        >
          <span id="heatmap-instructions" className="sr-only">
            Use arrow keys to navigate, Enter or Space to select a date
          </span>
          {dates.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-1" role="row">
              {week.map((date, dayIndex) => {
                const activity = date ? activityMap.get(date.toISOString().split('T')[0]) : null;
                const isSelected = selectedDate?.toISOString() === date?.toISOString();

                return (
                  <button
                    key={dayIndex}
                    data-week={weekIndex}
                    data-day={dayIndex}
                    role="gridcell"
                    tabIndex={weekIndex === 0 && dayIndex === 0 ? 0 : -1}
                    className={`
                      w-3 h-3 rounded-sm transition-all motion-reduce:transition-none
                      ${getIntensityClass(date)}
                      ${isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900' : ''}
                      ${date ? 'cursor-pointer hover:ring-1 hover:ring-purple-400 active:scale-95' : 'cursor-default'}
                      focus:outline-none focus:ring-2 focus:ring-purple-500
                    `}
                    onClick={() => handleCellClick(date)}
                    onKeyDown={(e) => handleKeyDown(e, weekIndex, dayIndex)}
                    aria-label={
                      date
                        ? `${date.toLocaleDateString()}: ${activity?.count || 0} reviews, quality ${activity?.quality || 0}`
                        : 'Empty date cell'
                    }
                    aria-selected={isSelected}
                    disabled={!date}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      {detailLevel !== 'minimal' && (
        <div
          className="flex items-center gap-2 mt-3 text-xs text-slate-400"
          role="legend"
          aria-label="Activity intensity legend"
        >
          <span>Less</span>
          <div className="flex gap-1" aria-hidden="true">
            <div className="w-3 h-3 rounded-sm bg-slate-800" />
            <div className="w-3 h-3 rounded-sm bg-purple-900" />
            <div className="w-3 h-3 rounded-sm bg-purple-700" />
            <div className="w-3 h-3 rounded-sm bg-purple-500" />
            <div className="w-3 h-3 rounded-sm bg-purple-400" />
          </div>
          <span>More</span>
        </div>
      )}

      {/* Selected date details (mobile touch feedback) */}
      {selectedDate && selectedActivity && (
        <div
          className="mt-3 p-2 bg-slate-800/50 rounded-lg text-sm animate-in fade-in duration-200 motion-reduce:animate-none"
          role="status"
          aria-live="polite"
        >
          <div className="flex justify-between items-center">
            <span className="text-slate-300">
              {selectedDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </span>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-slate-500 hover:text-slate-300 transition-colors"
              aria-label="Clear selection"
            >
              ✕
            </button>
          </div>
          <div className="mt-1 flex gap-4 text-xs text-slate-400">
            <span>{selectedActivity.count} reviews</span>
            <span>Quality: {selectedActivity.quality.toFixed(1)}</span>
          </div>
        </div>
      )}
    </section>
  );
}

// =============================================================================
// LEARNING LOOP PROGRESS
// =============================================================================

interface LearningLoopProgressProps {
  currentStage: LearningStage;
  lastRun?: string;
  detailLevel?: DetailLevel;
}

const STAGES = [
  { id: 'PERFORMANCE_REVIEW', icon: '📊', name: 'Review', schedule: 'Daily 9PM' },
  { id: 'GAP_ANALYSIS', icon: '🔍', name: 'Gaps', schedule: 'Sunday 8PM' },
  { id: 'SOURCE_DISCOVERY', icon: '📚', name: 'Discover', schedule: 'On-demand' },
  { id: 'KNOWLEDGE_INTEGRATION', icon: '🧩', name: 'Integrate', schedule: 'Continuous' },
  { id: 'SELF_ASSESSMENT', icon: '📝', name: 'Assess', schedule: '1st of month' },
] as const;

export function LearningLoopProgress({
  currentStage,
  lastRun,
  detailLevel = 'standard',
}: LearningLoopProgressProps) {
  const currentIndex = STAGES.findIndex((s) => s.id === currentStage);

  return (
    <section className="card-ari p-4" aria-labelledby="learning-loop-title">
      <div className="flex items-center justify-between mb-4">
        <h4 id="learning-loop-title" className="text-sm font-semibold text-slate-300">
          Learning Loop
        </h4>
        {lastRun && detailLevel !== 'minimal' && (
          <span className="text-xs text-slate-500">
            Last: {new Date(lastRun).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Stage Progress */}
      <div
        className="flex items-center justify-between mb-4"
        role="list"
        aria-label="Learning loop stages"
      >
        {STAGES.map((stage, i) => {
          const isComplete = i < currentIndex;
          const isCurrent = i === currentIndex;
          const isPending = i > currentIndex;

          const statusLabel = isComplete ? 'completed' : isCurrent ? 'in progress' : 'pending';

          return (
            <div key={stage.id} className="flex flex-col items-center" role="listitem">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-lg border transition-all motion-reduce:transition-none
                  ${isComplete ? 'bg-green-500/20 border-green-500/50' : ''}
                  ${
                    isCurrent
                      ? 'bg-purple-500/20 border-purple-500/50 animate-pulse motion-reduce:animate-none'
                      : ''
                  }
                  ${isPending ? 'bg-slate-800 border-slate-700' : ''}
                `}
                role="img"
                aria-label={`${stage.name} stage: ${statusLabel}`}
              >
                {isComplete ? '✅' : stage.icon}
              </div>
              <span
                className={`text-xs mt-1 ${isCurrent ? 'text-purple-400' : 'text-slate-500'}`}
                aria-hidden="true"
              >
                {stage.name}
              </span>
              {detailLevel === 'full' && (
                <span className="text-[10px] text-slate-600 mt-0.5">{stage.schedule}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress Line */}
      <div
        className="relative h-1 bg-slate-700 rounded-full overflow-hidden"
        role="progressbar"
        aria-label="Learning loop progress"
        aria-valuemin={0}
        aria-valuemax={STAGES.length}
        aria-valuenow={currentIndex + 1}
        aria-valuetext={`Stage ${currentIndex + 1} of ${STAGES.length}: ${STAGES[currentIndex].name}`}
      >
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 to-purple-500 rounded-full transition-all duration-500 motion-reduce:transition-none"
          style={{ width: `${((currentIndex + 1) / STAGES.length) * 100}%` }}
          aria-hidden="true"
        />
      </div>
    </section>
  );
}

// =============================================================================
// STREAK DISPLAY
// =============================================================================

interface StreakDisplayProps {
  currentStreak: number;
  longestStreak: number;
  todayComplete: boolean;
  detailLevel?: DetailLevel;
}

export function StreakDisplay({
  currentStreak,
  longestStreak,
  todayComplete,
  detailLevel = 'standard',
}: StreakDisplayProps) {
  return (
    <section
      className="card-ari p-4"
      aria-labelledby="streak-title"
      aria-describedby="streak-description"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-3xl" role="img" aria-label="Fire">
              🔥
            </span>
            <span
              id="streak-title"
              className="text-3xl font-bold text-orange-400"
              aria-label={`${currentStreak} day streak`}
            >
              {currentStreak}
            </span>
          </div>
          <p id="streak-description" className="text-sm text-slate-400 mt-1">
            day streak
          </p>
        </div>
        {detailLevel !== 'minimal' && (
          <div className="text-right">
            <p className="text-xs text-slate-500" aria-label={`Longest streak: ${longestStreak} days`}>
              Longest: {longestStreak} days
            </p>
            <div
              className={`text-xs mt-1 ${todayComplete ? 'text-green-400' : 'text-yellow-400'}`}
              role="status"
              aria-label={todayComplete ? "Today's review is complete" : 'Review is due today'}
            >
              {todayComplete ? '✅ Today complete' : '⏳ Review due today'}
            </div>
          </div>
        )}
      </div>
    </section>
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
  detailLevel?: DetailLevel;
}

export function CardsDue({ total, byPillar, onStartReview, detailLevel = 'standard' }: CardsDueProps) {
  if (total === 0) {
    return (
      <section className="card-ari p-4 text-center" aria-labelledby="cards-due-title">
        <span className="text-4xl" role="img" aria-label="Party popper">
          🎉
        </span>
        <p id="cards-due-title" className="text-slate-300 mt-2">
          All caught up!
        </p>
        <p className="text-xs text-slate-500">No cards due for review</p>
      </section>
    );
  }

  return (
    <section className="card-ari p-4" aria-labelledby="cards-due-title">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-2xl font-bold text-white" aria-label={`${total} cards due`}>
            {total}
          </span>
          <span id="cards-due-title" className="text-sm text-slate-400 ml-2">
            cards due
          </span>
        </div>
        {onStartReview && (
          <button
            onClick={onStartReview}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 active:bg-purple-700 text-white rounded-lg text-sm transition-colors motion-reduce:transition-none focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            aria-label="Start review session"
          >
            Start Review
          </button>
        )}
      </div>

      {detailLevel !== 'minimal' && (
        <div className="flex gap-4" role="list" aria-label="Cards due by domain">
          <div className="flex items-center gap-1" role="listitem">
            <span role="img" aria-label="LOGOS">
              🧠
            </span>
            <span className="text-xs text-slate-400" aria-label={`${byPillar.LOGOS} LOGOS cards`}>
              {byPillar.LOGOS}
            </span>
          </div>
          <div className="flex items-center gap-1" role="listitem">
            <span role="img" aria-label="ETHOS">
              ❤️
            </span>
            <span className="text-xs text-slate-400" aria-label={`${byPillar.ETHOS} ETHOS cards`}>
              {byPillar.ETHOS}
            </span>
          </div>
          <div className="flex items-center gap-1" role="listitem">
            <span role="img" aria-label="PATHOS">
              🌱
            </span>
            <span className="text-xs text-slate-400" aria-label={`${byPillar.PATHOS} PATHOS cards`}>
              {byPillar.PATHOS}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

export default {
  SkillProgressCard,
  ReviewCalendar,
  LearningLoopProgress,
  StreakDisplay,
  CardsDue,
  ZPDVisualization,
};
