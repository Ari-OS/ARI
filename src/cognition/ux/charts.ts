/**
 * Chart Generator — ASCII/Unicode visualizations
 *
 * Creates beautiful text-based charts that work everywhere:
 * - CLI output
 * - Dashboard
 * - Markdown files
 * - Log files
 * - Claude Code responses
 *
 * All charts are designed for instant comprehension.
 */

import { renderMiniGauge, type NormalizedMetric } from './normalizer.js';
import {
  PILLAR_CONFIG,
  TRAFFIC_LIGHT_CONFIG,
  CHART_DIMENSIONS,
  SPARKLINE_CONFIG,
  SCORE_QUALITY_THRESHOLDS,
} from './constants.js';

// =============================================================================
// RENDERING CONFIGURATION
// =============================================================================

export interface RenderOptions {
  /** Detail level for output: minimal (1-line), standard (15 lines), or full (50 lines) */
  detail?: 'minimal' | 'standard' | 'full';
  /** Enable accessibility mode (screen reader compatible) */
  accessible?: boolean;
  /** Custom width constraint (defaults to 70 for readability) */
  width?: number;
}

// Import chart dimensions from centralized constants
const {
  MAX_WIDTH,
  DEFAULT_WIDTH,
  DECORATED_GAUGE_WIDTH,
  COMPARISON_WIDTH,
  HISTOGRAM_WIDTH,
  PROGRESS_BAR_WIDTH,
  GAUGE_BAR_WIDTH,
  PILLAR_BAR_WIDTH,
  TREE_INDENT,
} = CHART_DIMENSIONS;

// Import score thresholds from centralized constants
const { EXCELLENT: SCORE_EXCELLENT, GOOD: SCORE_GOOD } = SCORE_QUALITY_THRESHOLDS;

// Import sparkline config from centralized constants
const {
  SINGLE_VALUE_THRESHOLD: SPARKLINE_SINGLE_VALUE_THRESHOLD,
  CHAR_DIVISOR: SPARKLINE_CHAR_DIVISOR,
  CHAR_COUNT: SPARKLINE_CHAR_COUNT,
} = SPARKLINE_CONFIG;

/** Action configuration for recommendations */
const ACTION_CONFIG = {
  DO: {
    label: 'PROCEED',
    emoji: '✅',
    ariaLabel: 'Checkmark: proceed with action',
  },
  DONT: {
    label: 'DO NOT PROCEED',
    emoji: '❌',
    ariaLabel: 'Cross mark: do not proceed',
  },
  CAUTION: {
    label: 'PROCEED WITH CAUTION',
    emoji: '⚠️',
    ariaLabel: 'Warning sign: proceed with caution',
  },
} as const;

/** Sparkline characters */
const SPARKLINE_CHARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

// =============================================================================
// EMOJI SUPPORT DETECTION
// =============================================================================

let emojiSupportCache: boolean | null = null;

/**
 * Detect if environment supports emoji rendering
 * Checks for terminal emoji support or browser environment
 */
export function isEmojiSupported(): boolean {
  if (emojiSupportCache !== null) return emojiSupportCache;

  // Check if we're in a browser environment (without accessing globals directly)
  try {
    // This will not throw in browser environments
    const isBrowser = typeof globalThis !== 'undefined' &&
                      'window' in globalThis &&
                      'document' in globalThis;
    if (isBrowser) {
      emojiSupportCache = true;
      return true;
    }
  } catch {
    // Not in browser, continue to terminal detection
  }

  // Check environment variables for terminal emoji support
  const term = process.env.TERM || '';
  const termProgram = process.env.TERM_PROGRAM || '';
  const lang = process.env.LANG || '';

  // Modern terminals with emoji support
  const supportsEmoji =
    termProgram.includes('iTerm') ||
    termProgram.includes('Apple_Terminal') ||
    termProgram.includes('vscode') ||
    term.includes('256color') ||
    term.includes('truecolor') ||
    lang.includes('UTF-8');

  emojiSupportCache = supportsEmoji;
  return supportsEmoji;
}

/**
 * Get emoji or text fallback based on environment
 */
function getEmoji(emoji: string, fallback: string): string {
  return isEmojiSupported() ? emoji : fallback;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAUGE CHARTS — Show single metric scores
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Render a large decorated gauge for a single metric
 */
export function renderDecoratedGauge(
  metric: NormalizedMetric,
  opts?: RenderOptions
): string {
  const width = Math.min(opts?.width ?? DECORATED_GAUGE_WIDTH, MAX_WIDTH);
  const accessible = opts?.accessible ?? false;

  const lines: string[] = [];

  if (accessible) {
    // Screen reader friendly format
    lines.push(`Metric: ${metric.name}`);
    lines.push(`Score: ${metric.score.toFixed(1)} out of 10`);
    lines.push(`Category: ${metric.category}`);
    lines.push(`Status: ${metric.trafficLight}`);
    if (metric.comparable) {
      lines.push(`Comparable to: ${metric.comparable}`);
    }
    return lines.join('\n');
  }

  // Header
  lines.push(`┌${'─'.repeat(width)}┐`);
  lines.push(`│ ${metric.name.padEnd(width - 2)} │`);
  lines.push(`├${'─'.repeat(width)}┤`);

  // Score gauge
  const position = Math.round((metric.score / 10) * GAUGE_BAR_WIDTH);
  const filled = '█'.repeat(position);
  const empty = '░'.repeat(GAUGE_BAR_WIDTH - position);
  const emoji = getEmoji(
    metric.score >= SCORE_EXCELLENT ? TRAFFIC_LIGHT_CONFIG.PROCEED.emoji :
    metric.score >= SCORE_GOOD ? TRAFFIC_LIGHT_CONFIG.CAUTION.emoji :
    TRAFFIC_LIGHT_CONFIG.STOP.emoji,
    metric.score >= SCORE_EXCELLENT ? 'OK' :
    metric.score >= SCORE_GOOD ? '!!' :
    'XX'
  );

  lines.push(`│ ${emoji} [${filled}${empty}] ${metric.score.toFixed(1)}/10 │`);

  // Category and traffic light
  const categoryLine = `  ${metric.category} — ${metric.trafficLight}`;
  lines.push(`│${categoryLine.padEnd(width)}│`);

  // Comparable
  if (metric.comparable) {
    const comparableLine = `  ≈ ${metric.comparable.slice(0, width - 6)}`;
    lines.push(`│${comparableLine.padEnd(width)}│`);
  }

  lines.push(`└${'─'.repeat(width)}┘`);

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPARISON CHARTS — Compare multiple metrics side-by-side
// ═══════════════════════════════════════════════════════════════════════════════

export interface ComparisonItem {
  name: string;
  score: number;
}

/**
 * Render a side-by-side comparison of multiple metrics
 */
export function renderComparison(
  items: ComparisonItem[],
  opts?: RenderOptions & { width?: number }
): string {
  const width = Math.min(opts?.width ?? COMPARISON_WIDTH, MAX_WIDTH);
  const accessible = opts?.accessible ?? false;
  const barWidth = width - 10; // Leave room for label and score

  const lines: string[] = [];

  if (accessible) {
    // Screen reader friendly format
    for (const item of items) {
      lines.push(`${item.name}: ${item.score.toFixed(1)} out of 10`);
    }
    return lines.join('\n');
  }

  for (const item of items) {
    const emoji = getEmoji(
      item.score >= SCORE_EXCELLENT ? TRAFFIC_LIGHT_CONFIG.PROCEED.emoji :
      item.score >= SCORE_GOOD ? TRAFFIC_LIGHT_CONFIG.CAUTION.emoji :
      TRAFFIC_LIGHT_CONFIG.STOP.emoji,
      item.score >= SCORE_EXCELLENT ? 'OK' :
      item.score >= SCORE_GOOD ? '!!' :
      'XX'
    );
    const filled = Math.round((item.score / 10) * barWidth);
    const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
    const nameStr = item.name.slice(0, 15).padEnd(15);
    lines.push(`${nameStr} ${emoji} ${bar} ${item.score.toFixed(1)}`);
  }

  return lines.join('\n');
}

/**
 * Render pillar comparison (LOGOS vs ETHOS vs PATHOS)
 */
export function renderPillarComparison(
  logos: number,
  ethos: number,
  pathos: number,
  opts?: RenderOptions
): string {
  const accessible = opts?.accessible ?? false;

  if (accessible) {
    return [
      `LOGOS (Reason): ${logos.toFixed(1)} out of 10`,
      `ETHOS (Character): ${ethos.toFixed(1)} out of 10`,
      `PATHOS (Growth): ${pathos.toFixed(1)} out of 10`,
    ].join('\n');
  }

  const renderBar = (score: number, color: string): string => {
    const filled = Math.round((score / 10) * PILLAR_BAR_WIDTH);
    return `${color}${'█'.repeat(filled)}${'░'.repeat(PILLAR_BAR_WIDTH - filled)} ${score.toFixed(1)}/10`;
  };

  return [
    `LOGOS  ${getEmoji(PILLAR_CONFIG.LOGOS.icon, 'L')} ${renderBar(logos, '')}`,
    `ETHOS  ${getEmoji(PILLAR_CONFIG.ETHOS.icon, 'E')} ${renderBar(ethos, '')}`,
    `PATHOS ${getEmoji(PILLAR_CONFIG.PATHOS.icon, 'P')} ${renderBar(pathos, '')}`,
  ].join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPARKLINE — Inline trend visualization
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Render a sparkline for a series of values
 */
export function renderSparkline(
  values: number[],
  opts?: { showTrend?: boolean; accessible?: boolean }
): string {
  if (values.length === 0) return '';

  if (opts?.accessible) {
    // Screen reader friendly format
    const first = values[0];
    const last = values[values.length - 1];
    const trend = last > first ? 'increasing' : last < first ? 'decreasing' : 'stable';
    const change = values.length > 1 ? ((last - first) / first * 100).toFixed(0) : '0';
    return `Trend: ${trend} (${change}% change from ${first} to ${last})`;
  }

  if (values.length === SPARKLINE_SINGLE_VALUE_THRESHOLD) {
    return SPARKLINE_CHARS[Math.floor(values[0] / SPARKLINE_CHAR_DIVISOR * 7)];
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const line = values.map(v => {
    const normalized = (v - min) / range;
    const index = Math.min(7, Math.floor(normalized * SPARKLINE_CHAR_COUNT));
    return SPARKLINE_CHARS[index];
  }).join('');

  if (opts?.showTrend !== false) {
    const first = values[0];
    const last = values[values.length - 1];
    const trendEmoji = getEmoji(
      last > first ? '↗' : last < first ? '↘' : '→',
      last > first ? '^' : last < first ? 'v' : '-'
    );
    const change = ((last - first) / first * 100).toFixed(0);
    return `${line} ${trendEmoji} ${change}%`;
  }

  return line;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISTRIBUTION CHARTS — Show probability/frequency distributions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Render a horizontal histogram
 */
export function renderHistogram(
  data: Array<{ label: string; value: number }>,
  opts?: RenderOptions & { showPercent?: boolean }
): string {
  const width = Math.min(opts?.width ?? HISTOGRAM_WIDTH, MAX_WIDTH);
  const accessible = opts?.accessible ?? false;
  const maxValue = Math.max(...data.map(d => d.value));

  const lines: string[] = [];

  if (accessible) {
    for (const item of data) {
      const valueStr = opts?.showPercent
        ? `${(item.value * 100).toFixed(0)}%`
        : item.value.toFixed(1);
      lines.push(`${item.label}: ${valueStr}`);
    }
    return lines.join('\n');
  }

  for (const item of data) {
    const normalizedWidth = Math.round((item.value / maxValue) * width);
    const bar = '█'.repeat(normalizedWidth);
    const label = item.label.slice(0, 12).padEnd(12);
    const valueStr = opts?.showPercent
      ? `${(item.value * 100).toFixed(0)}%`
      : item.value.toFixed(1);
    lines.push(`${label} ${bar.padEnd(width)} ${valueStr}`);
  }

  return lines.join('\n');
}

/**
 * Render outcome probabilities
 */
export function renderOutcomes(
  outcomes: Array<{ label: string; probability: number; value: number }>,
  opts?: RenderOptions
): string {
  const accessible = opts?.accessible ?? false;
  const lines: string[] = [];

  if (accessible) {
    for (const outcome of outcomes) {
      const prob = (outcome.probability * 100).toFixed(0);
      const sign = outcome.value >= 0 ? 'positive' : 'negative';
      lines.push(`${outcome.label}: ${prob}% probability, ${sign} $${Math.abs(outcome.value)}`);
    }
    return lines.join('\n');
  }

  for (const outcome of outcomes) {
    const prob = (outcome.probability * 100).toFixed(0);
    const bar = '█'.repeat(Math.round(outcome.probability * 20));
    const emoji = getEmoji(
      outcome.value >= 0 ? '✅' : '❌',
      outcome.value >= 0 ? '+' : '-'
    );
    const sign = outcome.value >= 0 ? '+' : '';
    lines.push(`${emoji} ${prob.padStart(3)}% ${bar.padEnd(20)} ${sign}$${outcome.value}`);
  }

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// DECISION TREE — Visualize decision paths
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChartDecisionNode {
  label: string;
  probability?: number;
  value?: number;
  children?: ChartDecisionNode[];
}

/**
 * Render a decision tree
 */
export function renderDecisionTree(
  root: ChartDecisionNode,
  opts?: RenderOptions,
  depth = 0
): string {
  const accessible = opts?.accessible ?? false;

  if (accessible && depth === 0) {
    // Convert tree to accessible format
    return renderDecisionTreeAccessible(root, 0);
  }

  const lines: string[] = [];
  const indent = ' '.repeat(TREE_INDENT * depth);
  const prefix = depth === 0 ? '' : (depth === 1 ? '├── ' : '│   ');

  let label = root.label;
  if (root.probability !== undefined) {
    label += ` (${(root.probability * 100).toFixed(0)}%)`;
  }
  if (root.value !== undefined) {
    const sign = root.value >= 0 ? '+' : '';
    const emoji = getEmoji(
      root.value >= 0 ? '✅' : '❌',
      root.value >= 0 ? '+' : '-'
    );
    label += ` → ${emoji} ${sign}$${root.value}`;
  }

  lines.push(`${indent}${prefix}${label}`);

  if (root.children) {
    for (let i = 0; i < root.children.length; i++) {
      const child = root.children[i];
      const isLast = i === root.children.length - 1;
      const childLines = renderDecisionTreeNode(child, depth + 1, isLast, accessible);
      lines.push(...childLines);
    }
  }

  return lines.join('\n');
}

function renderDecisionTreeAccessible(node: ChartDecisionNode, level: number): string {
  const lines: string[] = [];
  const indent = '  '.repeat(level);

  let label = `${indent}Level ${level}: ${node.label}`;
  if (node.probability !== undefined) {
    label += ` (${(node.probability * 100).toFixed(0)}% probability)`;
  }
  if (node.value !== undefined) {
    const sign = node.value >= 0 ? 'positive' : 'negative';
    label += ` (${sign} value: $${Math.abs(node.value)})`;
  }

  lines.push(label);

  if (node.children) {
    for (const child of node.children) {
      lines.push(renderDecisionTreeAccessible(child, level + 1));
    }
  }

  return lines.join('\n');
}

function renderDecisionTreeNode(
  node: ChartDecisionNode,
  depth: number,
  isLast: boolean,
  accessible: boolean
): string[] {
  if (accessible) {
    return [renderDecisionTreeAccessible(node, depth)];
  }

  const lines: string[] = [];
  const indent = ' '.repeat(TREE_INDENT * (depth - 1)) + (isLast ? '└── ' : '├── ');

  let label = node.label;
  if (node.probability !== undefined) {
    label += ` (${(node.probability * 100).toFixed(0)}%)`;
  }
  if (node.value !== undefined) {
    const sign = node.value >= 0 ? '+' : '';
    const emoji = getEmoji(
      node.value >= 0 ? '✅' : '❌',
      node.value >= 0 ? '+' : '-'
    );
    label += ` → ${emoji} ${sign}$${node.value}`;
  }

  lines.push(`${indent}${label}`);

  if (node.children) {
    const childIndent = ' '.repeat(TREE_INDENT * (depth - 1)) + (isLast ? '    ' : '│   ');
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const childIsLast = i === node.children.length - 1;
      const childPrefix = childIsLast ? '└── ' : '├── ';

      let childLabel = child.label;
      if (child.probability !== undefined) {
        childLabel += ` (${(child.probability * 100).toFixed(0)}%)`;
      }
      if (child.value !== undefined) {
        const sign = child.value >= 0 ? '+' : '';
        const emoji = getEmoji(
          child.value >= 0 ? '✅' : '❌',
          child.value >= 0 ? '+' : '-'
        );
        childLabel += ` → ${emoji} ${sign}$${child.value}`;
      }

      lines.push(`${childIndent}${childPrefix}${childLabel}`);
    }
  }

  return lines;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESS BARS — Show completion/progress
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Render a styled progress bar
 */
export function renderStyledProgressBar(
  current: number,
  max: number,
  opts?: RenderOptions & { label?: string; showPercent?: boolean }
): string {
  const width = Math.min(opts?.width ?? PROGRESS_BAR_WIDTH, MAX_WIDTH);
  const accessible = opts?.accessible ?? false;
  const percent = Math.min(100, Math.max(0, (current / max) * 100));

  if (accessible) {
    const label = opts?.label ? `${opts.label}: ` : '';
    return `${label}${percent.toFixed(0)}% complete (${current} of ${max})`;
  }

  const filled = Math.round((percent / 100) * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  const percentStr = opts?.showPercent !== false ? ` ${percent.toFixed(0)}%` : '';
  const label = opts?.label ? `${opts.label}: ` : '';

  return `${label}[${bar}]${percentStr}`;
}

/**
 * Render a learning progress bar with stages
 */
export function renderLearningProgress(
  stage: 'PERFORMANCE_REVIEW' | 'GAP_ANALYSIS' | 'SOURCE_DISCOVERY' | 'KNOWLEDGE_INTEGRATION' | 'SELF_ASSESSMENT',
  opts?: RenderOptions
): string {
  const accessible = opts?.accessible ?? false;

  const stages = [
    { id: 'PERFORMANCE_REVIEW', icon: '📊', name: 'Review' },
    { id: 'GAP_ANALYSIS', icon: '🔍', name: 'Gaps' },
    { id: 'SOURCE_DISCOVERY', icon: '📚', name: 'Discover' },
    { id: 'KNOWLEDGE_INTEGRATION', icon: '🧩', name: 'Integrate' },
    { id: 'SELF_ASSESSMENT', icon: '📝', name: 'Assess' },
  ];

  const currentIndex = stages.findIndex(s => s.id === stage);

  if (accessible) {
    return stages.map((s, i) => {
      if (i < currentIndex) return `Completed: ${s.name}`;
      if (i === currentIndex) return `Current: ${s.name}`;
      return `Pending: ${s.name}`;
    }).join(', ');
  }

  return stages.map((s, i) => {
    const icon = getEmoji(s.icon, s.name.charAt(0));
    if (i < currentIndex) return `${getEmoji('✅', 'OK')} ${icon}`;
    if (i === currentIndex) return `${getEmoji('🔄', '>>')} ${icon}`;
    return `${getEmoji('⬜', '[ ]')} ${icon}`;
  }).join(' → ');
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECOMMENDATION BOX — Clear DO/DON'T display
// ═══════════════════════════════════════════════════════════════════════════════

export interface RecommendationData {
  action: 'DO' | 'DONT' | 'CAUTION';
  statement: string;
  reasons: string[];
  alternatives?: string[];
  overallScore: number;
}

/**
 * Render a recommendation box with clear action
 *
 * Detail levels:
 * - minimal: 1-line summary
 * - standard: 15-line overview with key points (default)
 * - full: Complete 50-line analysis with all details
 */
export function renderRecommendation(
  data: RecommendationData,
  opts?: RenderOptions
): string {
  const detail = opts?.detail ?? 'standard';
  const accessible = opts?.accessible ?? false;
  const width = Math.min(opts?.width ?? DEFAULT_WIDTH, MAX_WIDTH);

  // MINIMAL: 1-line summary
  if (detail === 'minimal') {
    const actionConfig = ACTION_CONFIG[data.action];
    if (accessible) {
      return `${actionConfig.label}: ${data.statement} (Score: ${data.overallScore.toFixed(1)}/10)`;
    }
    const actionEmoji = getEmoji(actionConfig.emoji, actionConfig.label.charAt(0));
    return `${actionEmoji} ${actionConfig.label}: ${data.statement}`;
  }

  // ACCESSIBLE: Screen reader friendly format
  if (accessible) {
    const lines: string[] = [];
    const actionConfig = ACTION_CONFIG[data.action];

    lines.push(`RECOMMENDATION: ${actionConfig.label}`);
    lines.push(`Statement: ${data.statement}`);
    lines.push(`Overall Score: ${data.overallScore.toFixed(1)} out of 10`);

    if (data.reasons.length > 0) {
      lines.push('Reasoning:');
      const reasonLimit = detail === 'standard' ? 4 : data.reasons.length;
      for (let i = 0; i < Math.min(reasonLimit, data.reasons.length); i++) {
        lines.push(`  ${i + 1}. ${data.reasons[i]}`);
      }
    }

    if (data.action === 'DONT' && data.alternatives && data.alternatives.length > 0) {
      lines.push('Alternatives to consider:');
      const altLimit = detail === 'standard' ? 3 : data.alternatives.length;
      for (let i = 0; i < Math.min(altLimit, data.alternatives.length); i++) {
        lines.push(`  ${i + 1}. ${data.alternatives[i]}`);
      }
    }

    return lines.join('\n');
  }

  const lines: string[] = [];

  // Action banner
  const actionConfig = ACTION_CONFIG[data.action];
  const actionEmoji = getEmoji(actionConfig.emoji, actionConfig.label.charAt(0));
  const actionColor = getEmoji(
    data.action === 'DO' ? TRAFFIC_LIGHT_CONFIG.PROCEED.emoji :
    data.action === 'DONT' ? TRAFFIC_LIGHT_CONFIG.STOP.emoji :
    TRAFFIC_LIGHT_CONFIG.CAUTION.emoji,
    data.action === 'DO' ? 'OK' : data.action === 'DONT' ? 'XX' : '!!'
  );

  lines.push(`╔${'═'.repeat(width)}╗`);
  lines.push(`║ ${actionColor} ${actionEmoji} ${actionConfig.label.padEnd(width - 8)} ║`);
  lines.push(`╠${'═'.repeat(width)}╣`);

  // Statement
  const statementLines = wrapText(data.statement, width - 4);
  for (const line of statementLines) {
    lines.push(`║  ${line.padEnd(width - 2)} ║`);
  }

  // Score gauge
  lines.push(`╟${'─'.repeat(width)}╢`);
  const gauge = renderMiniGauge(data.overallScore);
  lines.push(`║  Overall: ${gauge.padEnd(width - 12)} ║`);

  // STANDARD: Show first 4 reasons
  // FULL: Show all reasons
  const reasonLimit = detail === 'standard' ? 4 : data.reasons.length;
  if (data.reasons.length > 0) {
    lines.push(`╟${'─'.repeat(width)}╢`);
    lines.push(`║  Reasoning:${' '.repeat(width - 13)} ║`);
    for (const reason of data.reasons.slice(0, reasonLimit)) {
      const reasonLines = wrapText(`• ${reason}`, width - 6);
      for (const reasonLine of reasonLines) {
        lines.push(`║    ${reasonLine.padEnd(width - 4)} ║`);
      }
    }
    if (detail === 'standard' && data.reasons.length > 4) {
      const more = `    (${data.reasons.length - 4} more reasons...)`;
      lines.push(`║${more.padEnd(width)} ║`);
    }
  }

  // Alternatives (if DON'T)
  const altLimit = detail === 'standard' ? 3 : (data.alternatives?.length ?? 0);
  if (data.action === 'DONT' && data.alternatives && data.alternatives.length > 0) {
    lines.push(`╟${'─'.repeat(width)}╢`);
    lines.push(`║  Instead, consider:${' '.repeat(width - 21)} ║`);
    for (const alt of data.alternatives.slice(0, altLimit)) {
      const altLines = wrapText(`• ${alt}`, width - 6);
      for (const altLine of altLines) {
        lines.push(`║    ${altLine.padEnd(width - 4)} ║`);
      }
    }
    if (detail === 'standard' && data.alternatives.length > 3) {
      const more = `    (${data.alternatives.length - 3} more alternatives...)`;
      lines.push(`║${more.padEnd(width)} ║`);
    }
  }

  lines.push(`╚${'═'.repeat(width)}╝`);

  return lines.join('\n');
}

/**
 * Wrap text to fit width
 */
function wrapText(text: string, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= width) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE ANALYSIS — Full multi-pillar view
// ═══════════════════════════════════════════════════════════════════════════════

export interface AnalysisData {
  title: string;
  pillar: 'LOGOS' | 'ETHOS' | 'PATHOS' | 'MULTI';
  metrics: NormalizedMetric[];
  recommendation: RecommendationData;
}

/**
 * Render a comprehensive analysis block
 *
 * Detail levels:
 * - minimal: 1-line summary with pillar and recommendation
 * - standard: 15-line overview with metrics and key recommendation (default)
 * - full: Complete analysis with all metrics and full recommendation
 */
export function renderAnalysis(data: AnalysisData, opts?: RenderOptions): string {
  const detail = opts?.detail ?? 'standard';
  const accessible = opts?.accessible ?? false;
  const width = Math.min(opts?.width ?? MAX_WIDTH, MAX_WIDTH);

  // MINIMAL: 1-line summary
  if (detail === 'minimal') {
    const pillarIcon = getEmoji(PILLAR_CONFIG[data.pillar].icon, data.pillar.charAt(0));
    const action = ACTION_CONFIG[data.recommendation.action];
    if (accessible) {
      return `${data.pillar} - ${data.title}: ${action.label}`;
    }
    const actionEmoji = getEmoji(action.emoji, action.label.charAt(0));
    return `${pillarIcon} ${data.pillar} - ${data.title}: ${actionEmoji} ${action.label}`;
  }

  const lines: string[] = [];
  const pillarIcon = getEmoji(PILLAR_CONFIG[data.pillar].icon, data.pillar.charAt(0));

  if (accessible) {
    lines.push(`Analysis: ${data.pillar} - ${data.title}`);
    lines.push('');

    if (data.metrics.length > 0) {
      lines.push('Metrics:');
      const metricLimit = detail === 'standard' ? 5 : data.metrics.length;
      for (let i = 0; i < Math.min(metricLimit, data.metrics.length); i++) {
        const m = data.metrics[i];
        lines.push(`  ${m.name}: ${m.score.toFixed(1)}/10`);
      }
      lines.push('');
    }

    lines.push(renderRecommendation(data.recommendation, { detail, accessible }));
    return lines.join('\n');
  }

  // Header
  lines.push('═'.repeat(width));
  lines.push(`${pillarIcon} ${data.pillar}: ${data.title}`);
  lines.push('═'.repeat(width));
  lines.push('');

  // Metrics comparison (standard: first 5, full: all)
  if (data.metrics.length > 0) {
    const metricsIcon = getEmoji('📊', 'M');
    lines.push(`${metricsIcon} Metric Breakdown`);
    lines.push('─'.repeat(width));

    const metricLimit = detail === 'standard' ? 5 : data.metrics.length;
    const metricsToShow = data.metrics.slice(0, metricLimit);

    lines.push(renderComparison(
      metricsToShow.map(m => ({ name: m.name, score: m.score })),
      { width: 50 }
    ));

    if (detail === 'standard' && data.metrics.length > 5) {
      lines.push(`... and ${data.metrics.length - 5} more metrics`);
    }
    lines.push('');
  }

  // Recommendation
  lines.push(renderRecommendation(data.recommendation, { detail, width }));
  lines.push('');

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUICK STATUS — One-line summaries for inline display
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Render a quick inline status
 */
export function renderQuickStatus(
  metrics: NormalizedMetric[],
  opts?: RenderOptions
): string {
  const accessible = opts?.accessible ?? false;

  if (accessible) {
    return metrics.map(m => `${m.name}: ${m.score.toFixed(1)}/10`).join(', ');
  }

  return metrics.map(m => `${m.name}: ${renderMiniGauge(m.score)}`).join(' | ');
}

/**
 * Render agent activity status
 */
export function renderAgentStatus(
  agent: string,
  status: 'idle' | 'working' | 'complete' | 'error',
  task?: string,
  opts?: RenderOptions
): string {
  const accessible = opts?.accessible ?? false;

  if (accessible) {
    const statusText = status === 'idle' ? 'Idle' :
                       status === 'working' ? 'Working' :
                       status === 'complete' ? 'Complete' :
                       'Error';
    const taskStr = task ? ` on ${task}` : '';
    return `Agent ${agent}: ${statusText}${taskStr}`;
  }

  const statusEmoji = getEmoji(
    status === 'idle' ? '💤' :
    status === 'working' ? '⚡' :
    status === 'complete' ? '✅' :
    '❌',
    status === 'idle' ? 'Z' :
    status === 'working' ? '>' :
    status === 'complete' ? 'OK' :
    'X'
  );

  const spinner = status === 'working' ? '▓░░' : '';
  const taskStr = task ? ` — ${task.slice(0, 40)}` : '';

  return `${statusEmoji} ${agent}${spinner}${taskStr}`;
}

/**
 * Render code edit status
 */
export function renderEditStatus(
  file: string,
  action: 'reading' | 'writing' | 'editing' | 'complete',
  progress?: number,
  opts?: RenderOptions
): string {
  const accessible = opts?.accessible ?? false;

  if (accessible) {
    const actionText = action === 'reading' ? 'Reading' :
                       action === 'writing' ? 'Writing' :
                       action === 'editing' ? 'Editing' :
                       'Complete';
    const progressStr = progress !== undefined ? ` (${progress}% complete)` : '';
    return `${actionText} file ${file}${progressStr}`;
  }

  const actionEmoji = getEmoji(
    action === 'reading' ? '📖' :
    action === 'writing' ? '✍️' :
    action === 'editing' ? '✏️' :
    '✅',
    action === 'reading' ? 'R' :
    action === 'writing' ? 'W' :
    action === 'editing' ? 'E' :
    'OK'
  );

  const progressBar = progress !== undefined
    ? ` [${renderStyledProgressBar(progress, 100, { width: 10, showPercent: false })}]`
    : '';

  return `${actionEmoji} ${action.toUpperCase()} ${file}${progressBar}`;
}
