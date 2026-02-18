/**
 * Confidence Signals — Data Freshness & Reliability Indicators
 *
 * Provides visual confidence indicators for ARI's responses so Pryce
 * knows how much to trust the data she's presenting.
 *
 * Thresholds:
 * - High: data < 5 min, reliability > 0.8, multiple sources
 * - Medium: data < 1 hour, reliability > 0.5
 * - Low: data > 1 hour or single unreliable source
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ConfidenceSignal {
  level: ConfidenceLevel;
  icon: string;       // green / yellow / red circle
  source: string;     // Where the data comes from
  freshness: string;  // "2 min ago", "last week", etc.
  message: string;    // Human-readable confidence note
}

export interface ConfidenceParams {
  dataAge: number;             // milliseconds since data was fetched
  sourceReliability: number;   // 0-1 (0 = unreliable, 1 = authoritative)
  hasMultipleSources: boolean;
  sourceName?: string;         // Optional source name for display
}

// ─── Constants ──────────────────────────────────────────────────────────────

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;

const ICON_HIGH = '\u{1F7E2}';   // green circle
const ICON_MEDIUM = '\u{1F7E1}'; // yellow circle
const ICON_LOW = '\u{1F534}';    // red circle

// ─── Freshness Formatting ───────────────────────────────────────────────────

function formatFreshness(ageMs: number): string {
  if (ageMs < 60_000) {
    return 'just now';
  }
  if (ageMs < ONE_HOUR_MS) {
    const minutes = Math.floor(ageMs / 60_000);
    return `${minutes} min ago`;
  }
  if (ageMs < ONE_DAY_MS) {
    const hours = Math.floor(ageMs / ONE_HOUR_MS);
    return `${hours}h ago`;
  }
  if (ageMs < ONE_WEEK_MS) {
    const days = Math.floor(ageMs / ONE_DAY_MS);
    return days === 1 ? 'yesterday' : `${days} days ago`;
  }
  return 'last week';
}

// ─── Confidence Assessment ──────────────────────────────────────────────────

/**
 * Determine confidence level based on data freshness and source reliability.
 */
export function assessConfidence(params: ConfidenceParams): ConfidenceSignal {
  const {
    dataAge,
    sourceReliability,
    hasMultipleSources,
    sourceName = 'unknown source',
  } = params;

  const freshness = formatFreshness(dataAge);

  // High confidence: fresh data from reliable, corroborated sources
  if (
    dataAge < FIVE_MINUTES_MS &&
    sourceReliability > 0.8 &&
    hasMultipleSources
  ) {
    return {
      level: 'high',
      icon: ICON_HIGH,
      source: sourceName,
      freshness,
      message: `from ${sourceName} ${freshness}`,
    };
  }

  // Medium confidence: reasonably fresh or reliable
  if (dataAge < ONE_HOUR_MS && sourceReliability > 0.5) {
    return {
      level: 'medium',
      icon: ICON_MEDIUM,
      source: sourceName,
      freshness,
      message: `based on ${freshness} data`,
    };
  }

  // Low confidence: stale data or unreliable source
  return {
    level: 'low',
    icon: ICON_LOW,
    source: sourceName,
    freshness,
    message: "I'm not sure \u2014 want me to verify?",
  };
}

// ─── Display Formatting ─────────────────────────────────────────────────────

/**
 * Format confidence signal for Telegram display.
 * Returns a compact one-line string suitable for inline display.
 */
export function formatConfidence(signal: ConfidenceSignal): string {
  return `${signal.icon} ${signal.message}`;
}
