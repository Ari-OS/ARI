/**
 * Visual Constants Module
 *
 * Centralizes all visual configurations, magic numbers, and styling constants
 * used across the cognition visualization system. This ensures consistency
 * and maintainability of visual elements.
 *
 * @module cognition/ux/constants
 */

/**
 * Box widths for different display contexts
 * Used for CLI output and terminal rendering
 */
export const BOX_WIDTHS = {
  /** Narrow boxes for compact displays or nested content (40 chars) */
  NARROW: 40,
  /** Standard box width for most content (60 chars) */
  STANDARD: 60,
  /** Wide boxes for detailed information or dashboards (80 chars) */
  WIDE: 80,
  /** Extra wide for full terminal width utilization (100 chars) */
  EXTRA_WIDE: 100,
} as const;

/**
 * Gauge/progress bar widths for visual indicators
 */
export const GAUGE_WIDTHS = {
  /** Small gauges for inline indicators (10 chars) */
  SMALL: 10,
  /** Medium gauges for standard progress bars (20 chars) */
  MEDIUM: 20,
  /** Large gauges for prominent displays (30 chars) */
  LARGE: 30,
  /** Full-width gauges for emphasis (40 chars) */
  FULL: 40,
} as const;

/**
 * Chart and visualization dimensions
 */
export const CHART_DIMENSIONS = {
  /** Height for standard charts (8 rows) */
  CHART_HEIGHT: 8,
  /** Height for sparklines (3 rows) */
  SPARKLINE_HEIGHT: 3,
  /** Width for sparklines (20 chars) */
  SPARKLINE_WIDTH: 20,
  /** Width for mini charts (30 chars) */
  MINI_CHART_WIDTH: 30,
  /** Width for full charts (60 chars) */
  FULL_CHART_WIDTH: 60,
  /** Padding around chart content */
  CHART_PADDING: 2,
  /** Maximum width for any chart (70 chars) */
  MAX_WIDTH: 70,
  /** Default chart width (60 chars) */
  DEFAULT_WIDTH: 60,
  /** Width for decorated gauges (50 chars) */
  DECORATED_GAUGE_WIDTH: 50,
  /** Width for comparison charts (30 chars) */
  COMPARISON_WIDTH: 30,
  /** Width for histograms (30 chars) */
  HISTOGRAM_WIDTH: 30,
  /** Width for progress bars (30 chars) */
  PROGRESS_BAR_WIDTH: 30,
  /** Width for gauge bars (40 chars) */
  GAUGE_BAR_WIDTH: 40,
  /** Width for pillar comparison bars (25 chars) */
  PILLAR_BAR_WIDTH: 25,
  /** Tree structure indentation (4 spaces) */
  TREE_INDENT: 4,
} as const;

/**
 * Sparkline configuration
 */
export const SPARKLINE_CONFIG = {
  /** Single value threshold for showing trend */
  SINGLE_VALUE_THRESHOLD: 1,
  /** Divisor for character selection (12.5) */
  CHAR_DIVISOR: 12.5,
  /** Number of sparkline characters available (8) */
  CHAR_COUNT: 8,
} as const;

/**
 * Score thresholds for rating quality
 */
export const SCORE_QUALITY_THRESHOLDS = {
  /** Scores >= 7 are excellent */
  EXCELLENT: 7,
  /** Scores >= 5 are good */
  GOOD: 5,
} as const;

/**
 * Cognitive Pillar Configurations
 *
 * Complete styling and metadata for the three pillars:
 * - LOGOS (rational/logical thinking)
 * - ETHOS (ethical/value-based reasoning)
 * - PATHOS (emotional/empathetic intelligence)
 * - MULTI (combined/balanced approach)
 */
export const PILLAR_CONFIG = {
  LOGOS: {
    /** Human-readable name */
    name: 'Logos',
    /** Full description of the pillar */
    description: 'Rational, logical, and analytical thinking',
    /** Visual icon/emoji representation */
    icon: '🧠',
    /** CSS custom property name for theming */
    cssVar: '--color-logos',
    /** Tailwind classes for dashboard (explicit, not dynamic) */
    tailwind: {
      bg: 'bg-blue-500',
      bgLight: 'bg-blue-100',
      bgDark: 'bg-blue-900',
      text: 'text-blue-700',
      textLight: 'text-blue-500',
      textDark: 'text-blue-900',
      border: 'border-blue-500',
      ring: 'ring-blue-500',
      hover: 'hover:bg-blue-600',
    },
    /** ANSI color codes for terminal output */
    ansi: {
      primary: '\x1b[34m', // Blue
      bright: '\x1b[94m',  // Bright blue
      dim: '\x1b[2;34m',   // Dim blue
    },
    /** Hex color values for web rendering */
    hex: {
      primary: '#3B82F6',   // blue-500
      light: '#DBEAFE',     // blue-100
      dark: '#1E3A8A',      // blue-900
    },
  },
  ETHOS: {
    name: 'Ethos',
    description: 'Character & Discipline — value-based reasoning',
    icon: '❤️',
    cssVar: '--color-ethos',
    tailwind: {
      bg: 'bg-green-500',
      bgLight: 'bg-green-100',
      bgDark: 'bg-green-900',
      text: 'text-green-700',
      textLight: 'text-green-500',
      textDark: 'text-green-900',
      border: 'border-green-500',
      ring: 'ring-green-500',
      hover: 'hover:bg-green-600',
    },
    ansi: {
      primary: '\x1b[32m', // Green
      bright: '\x1b[92m',  // Bright green
      dim: '\x1b[2;32m',   // Dim green
    },
    hex: {
      primary: '#10B981',   // green-500
      light: '#D1FAE5',     // green-100
      dark: '#064E3B',      // green-900
    },
  },
  PATHOS: {
    name: 'Pathos',
    description: 'Growth & Wisdom — emotional and intuitive intelligence',
    icon: '🌱',
    cssVar: '--color-pathos',
    tailwind: {
      bg: 'bg-red-500',
      bgLight: 'bg-red-100',
      bgDark: 'bg-red-900',
      text: 'text-red-700',
      textLight: 'text-red-500',
      textDark: 'text-red-900',
      border: 'border-red-500',
      ring: 'ring-red-500',
      hover: 'hover:bg-red-600',
    },
    ansi: {
      primary: '\x1b[31m', // Red
      bright: '\x1b[91m',  // Bright red
      dim: '\x1b[2;31m',   // Dim red
    },
    hex: {
      primary: '#EF4444',   // red-500
      light: '#FEE2E2',     // red-100
      dark: '#7F1D1D',      // red-900
    },
  },
  MULTI: {
    name: 'Multi-Pillar',
    description: 'Balanced integration of logical, ethical, and emotional reasoning',
    icon: '🌟',
    cssVar: '--color-multi',
    tailwind: {
      bg: 'bg-purple-500',
      bgLight: 'bg-purple-100',
      bgDark: 'bg-purple-900',
      text: 'text-purple-700',
      textLight: 'text-purple-500',
      textDark: 'text-purple-900',
      border: 'border-purple-500',
      ring: 'ring-purple-500',
      hover: 'hover:bg-purple-600',
    },
    ansi: {
      primary: '\x1b[35m', // Magenta
      bright: '\x1b[95m',  // Bright magenta
      dim: '\x1b[2;35m',   // Dim magenta
    },
    hex: {
      primary: '#A855F7',   // purple-500
      light: '#F3E8FF',     // purple-100
      dark: '#581C87',      // purple-900
    },
  },
} as const;

/**
 * Traffic Light Configurations
 *
 * Visual indicators for confidence/quality levels:
 * - PROCEED: High confidence, good to go (green)
 * - CAUTION: Medium confidence, review needed (yellow)
 * - STOP: Low confidence, intervention required (red)
 */
export const TRAFFIC_LIGHT_CONFIG = {
  PROCEED: {
    /** Visual emoji representation */
    emoji: '🟢',
    /** Text fallback for non-emoji contexts */
    text: '[PROCEED]',
    /** ANSI color code for terminal */
    ansi: '\x1b[32m', // Green
    /** Hex color for web */
    hex: '#10B981', // green-500
    /** Tailwind classes */
    tailwind: {
      bg: 'bg-green-500',
      text: 'text-green-700',
      border: 'border-green-500',
    },
    /** Accessibility label */
    ariaLabel: 'Proceed - High confidence',
    /** Semantic meaning */
    meaning: 'High confidence, proceed with action',
  },
  CAUTION: {
    emoji: '🟡',
    text: '[CAUTION]',
    ansi: '\x1b[33m', // Yellow
    hex: '#F59E0B', // yellow-500
    tailwind: {
      bg: 'bg-yellow-500',
      text: 'text-yellow-700',
      border: 'border-yellow-500',
    },
    ariaLabel: 'Caution - Medium confidence',
    meaning: 'Medium confidence, review recommended',
  },
  STOP: {
    emoji: '🔴',
    text: '[STOP]',
    ansi: '\x1b[31m', // Red
    hex: '#EF4444', // red-500
    tailwind: {
      bg: 'bg-red-500',
      text: 'text-red-700',
      border: 'border-red-500',
    },
    ariaLabel: 'Stop - Low confidence',
    meaning: 'Low confidence, intervention required',
  },
} as const;

/**
 * Score thresholds for traffic light mapping
 *
 * Used to convert numerical scores (0.0-1.0) to traffic light states
 */
export const SCORE_THRESHOLDS = {
  /** Scores above this are PROCEED (green) */
  PROCEED: 0.7,
  /** Scores above this but below PROCEED are CAUTION (yellow) */
  CAUTION: 0.4,
  /** Scores at or below CAUTION are STOP (red) */
  STOP: 0.0,
} as const;

/**
 * Animation duration configurations
 *
 * Respects prefers-reduced-motion accessibility preference
 */
export const ANIMATION_DURATIONS = {
  /** Fast animations for micro-interactions (150ms) */
  fast: {
    normal: 150,
    reduced: 0, // Instant when motion is reduced
  },
  /** Standard animations for most transitions (300ms) */
  standard: {
    normal: 300,
    reduced: 50, // Very brief when motion is reduced
  },
  /** Slow animations for emphasis (500ms) */
  slow: {
    normal: 500,
    reduced: 100, // Minimal when motion is reduced
  },
  /** Very slow for complex transitions (800ms) */
  verySlow: {
    normal: 800,
    reduced: 150, // Brief when motion is reduced
  },
} as const;

/**
 * Detail level enumeration
 *
 * Controls how much information is displayed in visualizations
 */
export const DETAIL_LEVELS = {
  /** Minimal: Only essential information (e.g., final score) */
  MINIMAL: 'minimal',
  /** Standard: Balanced view with key metrics */
  STANDARD: 'standard',
  /** Full: Comprehensive view with all available data */
  FULL: 'full',
} as const;

export type DetailLevel = typeof DETAIL_LEVELS[keyof typeof DETAIL_LEVELS];

/**
 * Box Drawing Characters
 *
 * Unicode characters for creating visual hierarchies in CLI output
 */
export const BOX_DRAWING_CHARS = {
  /** Top-level sections (double-line for prominence) */
  topLevel: {
    topLeft: '╔',
    topRight: '╗',
    bottomLeft: '╚',
    bottomRight: '╝',
    horizontal: '═',
    vertical: '║',
    horizontalDown: '╦', // T-junction pointing down
    horizontalUp: '╩',   // T-junction pointing up
    verticalRight: '╠',  // T-junction pointing right
    verticalLeft: '╣',   // T-junction pointing left
    cross: '╬',          // Four-way intersection
  },
  /** Subsections (single-line with double connections) */
  subsection: {
    topLeft: '╔',
    topRight: '╗',
    bottomLeft: '╚',
    bottomRight: '╝',
    horizontal: '═',
    vertical: '║',
    horizontalDown: '╤',
    horizontalUp: '╧',
    verticalRight: '╟',
    verticalLeft: '╢',
    cross: '╫',
  },
  /** Supporting elements (single-line for subtle hierarchy) */
  supporting: {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
    horizontalDown: '┬', // T-junction pointing down
    horizontalUp: '┴',   // T-junction pointing up
    verticalRight: '├',  // T-junction pointing right
    verticalLeft: '┤',   // T-junction pointing left
    cross: '┼',          // Four-way intersection
  },
  /** Light elements for minimal visual weight */
  light: {
    topLeft: '╭',
    topRight: '╮',
    bottomLeft: '╰',
    bottomRight: '╯',
    horizontal: '─',
    vertical: '│',
  },
} as const;

/**
 * Accessibility Constants
 *
 * WCAG 2.1 compliant values for accessible design
 */
export const ACCESSIBILITY = {
  /** Minimum contrast ratios for text (WCAG 2.1) */
  contrastRatios: {
    /** Normal text: 4.5:1 (AA standard) */
    normalText: 4.5,
    /** Large text (18pt+ or 14pt+ bold): 3:1 (AA standard) */
    largeText: 3.0,
    /** Enhanced normal text: 7:1 (AAA standard) */
    enhancedNormalText: 7.0,
    /** Enhanced large text: 4.5:1 (AAA standard) */
    enhancedLargeText: 4.5,
  },
  /** Touch target sizes for interactive elements */
  touchTargets: {
    /** Minimum size for touch targets (44x44px per WCAG 2.1) */
    minimum: 44,
    /** Recommended size for comfortable interaction (48x48px) */
    recommended: 48,
  },
  /** Focus indicator requirements */
  focus: {
    /** Minimum outline width (2px) */
    outlineWidth: 2,
    /** Recommended outline offset (2px) */
    outlineOffset: 2,
  },
  /** Animation timing for accessibility */
  timing: {
    /** Maximum auto-advance time without user control (5s) */
    maxAutoAdvance: 5000,
    /** Minimum time to read content (based on avg reading speed) */
    minReadTime: (wordCount: number) => (wordCount / 200) * 60 * 1000, // 200 wpm
  },
} as const;

/**
 * Typography Scale
 *
 * Font sizes and line heights for consistent text hierarchy
 */
export const TYPOGRAPHY = {
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
    loose: 2,
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

/**
 * Spacing Scale
 *
 * Consistent spacing values for layout (in pixels)
 */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

/**
 * Z-Index Scale
 *
 * Layering hierarchy for overlapping elements
 */
export const Z_INDEX = {
  /** Base content layer */
  base: 0,
  /** Dropdown menus */
  dropdown: 1000,
  /** Sticky headers/footers */
  sticky: 1100,
  /** Fixed positioned elements */
  fixed: 1200,
  /** Modal backdrops */
  modalBackdrop: 1300,
  /** Modal content */
  modal: 1400,
  /** Popover content */
  popover: 1500,
  /** Tooltips */
  tooltip: 1600,
  /** Toast notifications */
  toast: 1700,
} as const;

/**
 * Breakpoints for responsive design
 *
 * Mobile-first breakpoint system
 */
export const BREAKPOINTS = {
  /** Small devices (phones, 640px and up) */
  sm: 640,
  /** Medium devices (tablets, 768px and up) */
  md: 768,
  /** Large devices (desktops, 1024px and up) */
  lg: 1024,
  /** Extra large devices (large desktops, 1280px and up) */
  xl: 1280,
  /** 2X large devices (larger desktops, 1536px and up) */
  '2xl': 1536,
} as const;

/**
 * Common icon/emoji sets for visual feedback
 */
export const ICONS = {
  /** Status indicators */
  status: {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ',
  },
  /** Progress indicators */
  progress: {
    spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    dots: ['⠁', '⠂', '⠄', '⡀', '⢀', '⠠', '⠐', '⠈'],
  },
  /** Cognitive pillars (already defined in PILLAR_CONFIG, but useful shorthand) */
  pillars: {
    logos: '🧠',
    ethos: '❤️',
    pathos: '🌱',
    multi: '🌟',
  },
  /** Learning elements */
  learning: {
    concept: '💡',
    practice: '📝',
    review: '🔄',
    mastery: '🎯',
    weak: '⚠️',
    strong: '✨',
  },
} as const;

/**
 * Helper function to get traffic light state from score
 *
 * @param score - Numerical score between 0.0 and 1.0
 * @returns Traffic light configuration object
 */
export function getTrafficLightFromScore(score: number) {
  if (score >= SCORE_THRESHOLDS.PROCEED) {
    return TRAFFIC_LIGHT_CONFIG.PROCEED;
  } else if (score >= SCORE_THRESHOLDS.CAUTION) {
    return TRAFFIC_LIGHT_CONFIG.CAUTION;
  } else {
    return TRAFFIC_LIGHT_CONFIG.STOP;
  }
}

/**
 * Helper function to get animation duration based on user preference
 *
 * @param speed - Animation speed category
 * @param prefersReducedMotion - Whether user prefers reduced motion
 * @returns Duration in milliseconds
 */
export function getAnimationDuration(
  speed: keyof typeof ANIMATION_DURATIONS,
  prefersReducedMotion: boolean = false
): number {
  return prefersReducedMotion
    ? ANIMATION_DURATIONS[speed].reduced
    : ANIMATION_DURATIONS[speed].normal;
}

/**
 * Helper function to get pillar configuration by name
 *
 * @param pillar - Pillar name (case-insensitive)
 * @returns Pillar configuration object or undefined
 */
export function getPillarConfig(pillar: string) {
  const key = pillar.toUpperCase() as keyof typeof PILLAR_CONFIG;
  return PILLAR_CONFIG[key];
}

/**
 * Type exports for TypeScript consumers
 */
export type PillarName = keyof typeof PILLAR_CONFIG;
export type TrafficLight = keyof typeof TRAFFIC_LIGHT_CONFIG;
export type BoxDrawingStyle = keyof typeof BOX_DRAWING_CHARS;
