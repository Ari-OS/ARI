/**
 * User Deliverables — Things ARI Creates For You
 *
 * ARI proactively generates deliverables to move you forward:
 *
 * - **Daily Focus**: What to focus on today
 * - **Action Items**: Specific things you could do
 * - **Insights**: Observations and learnings
 * - **Status Summaries**: Where things stand
 * - **Opportunities**: Things you might want to know about
 *
 * @module autonomous/user-deliverables
 * @version 1.0.0
 */

import { EventBus } from '../kernel/event-bus.js';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const eventBus = new EventBus();

// =============================================================================
// TYPES
// =============================================================================

export interface Deliverable {
  id: string;
  type: 'DAILY_FOCUS' | 'ACTION_ITEM' | 'INSIGHT' | 'STATUS' | 'OPPORTUNITY' | 'RECOMMENDATION';
  title: string;
  content: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  createdAt: Date;
  expiresAt?: Date;
  acknowledged: boolean;
  actionable?: {
    action: string;
    estimatedTime?: string;
    impact?: string;
  };
}

export interface DailyBrief {
  date: Date;
  greeting: string;
  focusAreas: string[];
  actionItems: Deliverable[];
  insights: Deliverable[];
  opportunities: Deliverable[];
  quote?: { text: string; source: string };
}

// =============================================================================
// DELIVERABLE GENERATION
// =============================================================================

/**
 * Generate daily brief for the user
 */
export async function generateDailyBrief(projectPath: string): Promise<DailyBrief> {
  const now = new Date();
  const hour = now.getHours();

  // Time-appropriate greeting
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Analyze project state
  const projectState = analyzeProjectState(projectPath);
  const recentActivity = getRecentActivity(projectPath);

  // Generate focus areas based on analysis
  const focusAreas = generateFocusAreas(projectState, recentActivity);

  // Generate action items
  const actionItems = generateActionItems(projectPath, projectState);

  // Generate insights
  const insights = generateInsights(projectState, recentActivity);

  // Generate opportunities
  const opportunities = await generateOpportunities(projectPath);

  // Select context-aware wisdom quote
  const quoteContext = determineQuoteContext(projectState, recentActivity);
  const quote = selectQuote(quoteContext);

  const brief: DailyBrief = {
    date: now,
    greeting,
    focusAreas,
    actionItems,
    insights,
    opportunities,
    quote,
  };

  eventBus.emit('audit:log', {
    action: 'deliverable:daily_brief_generated',
    agent: 'DELIVERABLES',
    trustLevel: 'system',
    details: {
      focusCount: focusAreas.length,
      actionCount: actionItems.length,
      insightCount: insights.length,
    },
  });

  return brief;
}

// =============================================================================
// PROJECT ANALYSIS
// =============================================================================

interface ProjectState {
  hasUncommittedChanges: boolean;
  uncommittedFiles: number;
  recentCommitCount: number;
  testsPassng: boolean | null;
  coveragePercent: number | null;
  openTodos: number;
  lastCommitAge: string;
  branchName: string;
}

function analyzeProjectState(projectPath: string): ProjectState {
  const state: ProjectState = {
    hasUncommittedChanges: false,
    uncommittedFiles: 0,
    recentCommitCount: 0,
    testsPassng: null,
    coveragePercent: null,
    openTodos: 0,
    lastCommitAge: 'unknown',
    branchName: 'unknown',
  };

  try {
    // Check git status using safe execFileSync
    const gitStatus = execFileSync('git', ['status', '--porcelain'], {
      cwd: projectPath,
      encoding: 'utf-8',
    });
    const changedFiles = gitStatus.trim().split('\n').filter(l => l.length > 0);
    state.hasUncommittedChanges = changedFiles.length > 0;
    state.uncommittedFiles = changedFiles.length;

    // Get branch name
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: projectPath,
      encoding: 'utf-8',
    }).trim();
    state.branchName = branch;

    // Count recent commits (last 24 hours)
    const dayAgo = Math.floor(Date.now() / 1000) - 86400;
    const recentCommits = execFileSync('git', ['log', `--since=${dayAgo}`, '--oneline'], {
      cwd: projectPath,
      encoding: 'utf-8',
    });
    state.recentCommitCount = recentCommits.trim().split('\n').filter(l => l.length > 0).length;

    // Get last commit age
    const lastCommitTime = execFileSync('git', ['log', '-1', '--format=%ct'], {
      cwd: projectPath,
      encoding: 'utf-8',
    }).trim();
    const ageMs = Date.now() - parseInt(lastCommitTime) * 1000;
    const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
    state.lastCommitAge = ageHours < 1 ? 'just now' :
      ageHours < 24 ? `${ageHours} hours ago` :
      `${Math.floor(ageHours / 24)} days ago`;

  } catch {
    // Not a git repo or git not available
  }

  return state;
}

function getRecentActivity(projectPath: string): string[] {
  const activities: string[] = [];

  try {
    // Get recent commit messages using safe execFileSync
    const commits = execFileSync('git', ['log', '-5', '--format=%s'], {
      cwd: projectPath,
      encoding: 'utf-8',
    });
    activities.push(...commits.trim().split('\n').filter(l => l.length > 0));
  } catch {
    // Ignore
  }

  return activities;
}

// =============================================================================
// FOCUS AREAS
// =============================================================================

function generateFocusAreas(state: ProjectState, recentActivity: string[]): string[] {
  const focuses: string[] = [];

  // Priority 1: Uncommitted changes
  if (state.hasUncommittedChanges) {
    focuses.push(`Review and commit ${state.uncommittedFiles} uncommitted file${state.uncommittedFiles > 1 ? 's' : ''}`);
  }

  // Priority 2: No recent commits
  if (state.recentCommitCount === 0 && !state.hasUncommittedChanges) {
    focuses.push('Start on a new task or feature');
  }

  // Priority 3: Based on recent activity
  if (recentActivity.some(a => a.toLowerCase().includes('wip') || a.toLowerCase().includes('work in progress'))) {
    focuses.push('Complete work in progress from previous session');
  }

  // Default focus
  if (focuses.length === 0) {
    focuses.push('Continue making progress on current priorities');
  }

  return focuses.slice(0, 3);  // Max 3 focus areas
}

// =============================================================================
// ACTION ITEMS
// =============================================================================

function generateActionItems(_projectPath: string, state: ProjectState): Deliverable[] {
  const items: Deliverable[] = [];
  const now = new Date();

  // Commit reminder
  if (state.hasUncommittedChanges) {
    items.push({
      id: `action-commit-${Date.now()}`,
      type: 'ACTION_ITEM',
      title: 'Commit your changes',
      content: `You have ${state.uncommittedFiles} file${state.uncommittedFiles > 1 ? 's' : ''} with uncommitted changes.`,
      priority: 'HIGH',
      createdAt: now,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      acknowledged: false,
      actionable: {
        action: 'Run: git add -A && git commit',
        estimatedTime: '2 minutes',
        impact: 'Preserves your work and creates checkpoint',
      },
    });
  }

  // Test reminder
  if (state.testsPassng === false) {
    items.push({
      id: `action-tests-${Date.now()}`,
      type: 'ACTION_ITEM',
      title: 'Fix failing tests',
      content: 'Some tests are failing. This should be addressed before continuing.',
      priority: 'URGENT',
      createdAt: now,
      acknowledged: false,
      actionable: {
        action: 'Run: npm test',
        estimatedTime: '15-30 minutes',
        impact: 'Ensures code quality and prevents regressions',
      },
    });
  }

  // Push reminder (if on branch with unpushed commits)
  if (state.branchName !== 'main' && state.recentCommitCount > 0) {
    items.push({
      id: `action-push-${Date.now()}`,
      type: 'ACTION_ITEM',
      title: 'Push your branch',
      content: `Branch "${state.branchName}" has local commits. Push to backup your work.`,
      priority: 'MEDIUM',
      createdAt: now,
      acknowledged: false,
      actionable: {
        action: 'Run: git push origin ' + state.branchName,
        estimatedTime: '1 minute',
        impact: 'Backs up your work remotely',
      },
    });
  }

  return items;
}

// =============================================================================
// INSIGHTS
// =============================================================================

function generateInsights(state: ProjectState, recentActivity: string[]): Deliverable[] {
  const insights: Deliverable[] = [];
  const now = new Date();

  // Productivity insight
  if (state.recentCommitCount >= 5) {
    insights.push({
      id: `insight-productive-${Date.now()}`,
      type: 'INSIGHT',
      title: 'Great momentum!',
      content: `You made ${state.recentCommitCount} commits in the last 24 hours. Keep up the productive pace.`,
      priority: 'LOW',
      createdAt: now,
      acknowledged: false,
    });
  }

  // Pattern insight from activity
  const featureCommits = recentActivity.filter(a =>
    a.toLowerCase().includes('feat') || a.toLowerCase().includes('feature')
  );
  if (featureCommits.length >= 2) {
    insights.push({
      id: `insight-features-${Date.now()}`,
      type: 'INSIGHT',
      title: 'Feature development in progress',
      content: `You've been actively adding features. Consider writing tests to lock in the behavior.`,
      priority: 'MEDIUM',
      createdAt: now,
      acknowledged: false,
    });
  }

  return insights;
}

// =============================================================================
// OPPORTUNITIES
// =============================================================================

async function generateOpportunities(projectPath: string): Promise<Deliverable[]> {
  const opportunities: Deliverable[] = [];
  const now = new Date();

  // Check for README that could use updating
  try {
    const readmePath = path.join(projectPath, 'README.md');
    const stats = await fs.stat(readmePath);
    const daysSinceUpdate = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceUpdate > 30) {
      opportunities.push({
        id: `opp-readme-${Date.now()}`,
        type: 'OPPORTUNITY',
        title: 'Update README',
        content: `README.md hasn't been updated in ${Math.floor(daysSinceUpdate)} days. Consider refreshing it.`,
        priority: 'LOW',
        createdAt: now,
        acknowledged: false,
      });
    }
  } catch {
    // No README
  }

  return opportunities;
}

// =============================================================================
// WISDOM QUOTES — Drawn from Cognitive Layer PATHOS traditions
// =============================================================================

/**
 * Curated quotes from wisdom traditions that inform ARI's cognitive layer.
 * Each quote is tagged with its tradition for context-aware selection.
 */
const WISDOM_QUOTES: Array<{
  text: string;
  source: string;
  tradition: 'stoic' | 'dalio' | 'munger' | 'taleb' | 'musashi' | 'naval' | 'meadows' | 'jobs';
  context: string;  // When this quote is most relevant
}> = [
  // Stoic Tradition (PATHOS core)
  { text: "Make the best use of what is in your power, and take the rest as it happens.", source: "Epictetus", tradition: 'stoic', context: 'control' },
  { text: "We suffer more often in imagination than in reality.", source: "Seneca", tradition: 'stoic', context: 'anxiety' },
  { text: "The happiness of your life depends upon the quality of your thoughts.", source: "Marcus Aurelius", tradition: 'stoic', context: 'mindset' },
  { text: "No man is free who is not master of himself.", source: "Epictetus", tradition: 'stoic', context: 'discipline' },
  { text: "Waste no more time arguing about what a good man should be. Be one.", source: "Marcus Aurelius", tradition: 'stoic', context: 'action' },

  // Dalio (Principles-based thinking)
  { text: "Pain + Reflection = Progress.", source: "Ray Dalio", tradition: 'dalio', context: 'learning' },
  { text: "Embrace reality and deal with it.", source: "Ray Dalio", tradition: 'dalio', context: 'objectivity' },
  { text: "Be radically open-minded and radically transparent.", source: "Ray Dalio", tradition: 'dalio', context: 'growth' },

  // Munger (Mental models)
  { text: "Invert, always invert.", source: "Charlie Munger", tradition: 'munger', context: 'problem-solving' },
  { text: "The big money is not in the buying and selling, but in the waiting.", source: "Charlie Munger", tradition: 'munger', context: 'patience' },
  { text: "It's not supposed to be easy. Anyone who finds it easy is stupid.", source: "Charlie Munger", tradition: 'munger', context: 'difficulty' },

  // Taleb (Antifragility)
  { text: "Antifragility is beyond resilience or robustness. The resilient resists shocks and stays the same; the antifragile gets better.", source: "Nassim Taleb", tradition: 'taleb', context: 'resilience' },
  { text: "Wind extinguishes a candle and energizes fire. You want to be the fire and wish for the wind.", source: "Nassim Taleb", tradition: 'taleb', context: 'adversity' },
  { text: "The three most harmful addictions are heroin, carbohydrates, and a monthly salary.", source: "Nassim Taleb", tradition: 'taleb', context: 'independence' },

  // Musashi (Warrior's way)
  { text: "Think lightly of yourself and deeply of the world.", source: "Miyamoto Musashi", tradition: 'musashi', context: 'humility' },
  { text: "Do nothing which is of no use.", source: "Miyamoto Musashi", tradition: 'musashi', context: 'efficiency' },
  { text: "The Way is in training.", source: "Miyamoto Musashi", tradition: 'musashi', context: 'practice' },

  // Naval (Modern wisdom)
  { text: "Play long-term games with long-term people.", source: "Naval Ravikant", tradition: 'naval', context: 'relationships' },
  { text: "Specific knowledge is found by pursuing your genuine curiosity.", source: "Naval Ravikant", tradition: 'naval', context: 'learning' },
  { text: "A calm mind, a fit body, a house full of love. These things cannot be bought—they must be earned.", source: "Naval Ravikant", tradition: 'naval', context: 'priorities' },

  // Meadows (Systems thinking)
  { text: "You think that because you understand 'one' that you must therefore understand 'two' because one and one make two. But you forget that you must also understand 'and'.", source: "Donella Meadows", tradition: 'meadows', context: 'systems' },

  // Jobs (Design & simplicity)
  { text: "Simple can be harder than complex: You have to work hard to get your thinking clean to make it simple.", source: "Steve Jobs", tradition: 'jobs', context: 'simplicity' },
  { text: "The only way to do great work is to love what you do.", source: "Steve Jobs", tradition: 'jobs', context: 'passion' },
  { text: "Innovation distinguishes between a leader and a follower.", source: "Steve Jobs", tradition: 'jobs', context: 'innovation' },
];

/**
 * Select a quote based on context or day
 *
 * If project state suggests a particular context (e.g., lots of changes = 'action'),
 * we'll try to find a relevant quote. Otherwise, rotate daily.
 */
function selectQuote(context?: string): { text: string; source: string } {
  // Try context-based selection first
  if (context) {
    const contextQuotes = WISDOM_QUOTES.filter(q => q.context === context);
    if (contextQuotes.length > 0) {
      const idx = Math.floor(Date.now() / (1000 * 60 * 60)) % contextQuotes.length;  // Rotate hourly within context
      const q = contextQuotes[idx];
      return { text: q.text, source: q.source };
    }
  }

  // Fallback to day-based selection for variety
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  const q = WISDOM_QUOTES[dayOfYear % WISDOM_QUOTES.length];
  return { text: q.text, source: q.source };
}

/**
 * Determine context from project state for quote selection
 */
function determineQuoteContext(state: ProjectState, recentActivity: string[]): string | undefined {
  // No commits = action/motivation needed
  if (state.recentCommitCount === 0 && !state.hasUncommittedChanges) {
    return 'action';
  }

  // Many uncommitted changes = discipline to commit
  if (state.uncommittedFiles > 5) {
    return 'discipline';
  }

  // WIP in progress = patience/persistence
  if (recentActivity.some(a => a.toLowerCase().includes('wip'))) {
    return 'patience';
  }

  // High productivity = don't burn out, maintain perspective
  if (state.recentCommitCount >= 10) {
    return 'mindset';
  }

  // Default contexts based on time of day
  const hour = new Date().getHours();
  if (hour < 10) return 'action';       // Morning: get started
  if (hour < 14) return 'efficiency';   // Midday: stay focused
  if (hour < 18) return 'patience';     // Afternoon: persist
  return 'mindset';                      // Evening: reflect
}

// =============================================================================
// FORMAT FOR DISPLAY
// =============================================================================

/**
 * Format daily brief for CLI display
 */
export function formatDailyBrief(brief: DailyBrief): string {
  const lines: string[] = [];
  const divider = '═'.repeat(60);
  const thinDivider = '─'.repeat(60);

  lines.push(divider);
  lines.push(`${brief.greeting}, Pryce.`);
  lines.push(`📅 ${brief.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`);
  lines.push(divider);

  // Focus Areas
  if (brief.focusAreas.length > 0) {
    lines.push('');
    lines.push('🎯 TODAY\'S FOCUS');
    lines.push(thinDivider);
    for (const focus of brief.focusAreas) {
      lines.push(`  • ${focus}`);
    }
  }

  // Action Items
  if (brief.actionItems.length > 0) {
    lines.push('');
    lines.push('⚡ ACTION ITEMS');
    lines.push(thinDivider);
    for (const item of brief.actionItems) {
      const priorityIcon = item.priority === 'URGENT' ? '🔴' :
        item.priority === 'HIGH' ? '🟠' :
        item.priority === 'MEDIUM' ? '🟡' : '🟢';
      lines.push(`  ${priorityIcon} ${item.title}`);
      lines.push(`     ${item.content}`);
      if (item.actionable) {
        lines.push(`     → ${item.actionable.action}`);
      }
    }
  }

  // Insights
  if (brief.insights.length > 0) {
    lines.push('');
    lines.push('💡 INSIGHTS');
    lines.push(thinDivider);
    for (const insight of brief.insights) {
      lines.push(`  • ${insight.title}`);
      lines.push(`    ${insight.content}`);
    }
  }

  // Opportunities
  if (brief.opportunities.length > 0) {
    lines.push('');
    lines.push('🌟 OPPORTUNITIES');
    lines.push(thinDivider);
    for (const opp of brief.opportunities) {
      lines.push(`  • ${opp.title}: ${opp.content}`);
    }
  }

  // Quote
  if (brief.quote) {
    lines.push('');
    lines.push(thinDivider);
    lines.push(`"${brief.quote.text}"`);
    lines.push(`  — ${brief.quote.source}`);
  }

  lines.push('');
  lines.push(divider);

  return lines.join('\n');
}

export default {
  generateDailyBrief,
  formatDailyBrief,
};
