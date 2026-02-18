/**
 * Alpha Vantage Earnings Calendar
 *
 * Fetches upcoming earnings dates for tracked symbols.
 * Used by market-monitor to add earnings context to price alerts
 * and proactively warn before high-volatility earnings windows.
 *
 * API: EARNINGS_CALENDAR endpoint returns CSV with columns:
 *   symbol, name, reportDate, fiscalDateEnding, estimate, currency
 *
 * Rate limit: shares the 25 req/day Alpha Vantage budget.
 * Cache: 6 hours (earnings dates don't change intraday).
 *
 * Layer: L2 System (integrations)
 */

import { createLogger } from '../../kernel/logger.js';

const log = createLogger('earnings-calendar');

const BASE_URL = 'https://www.alphavantage.co/query';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface EarningsEvent {
  symbol: string;
  name: string;
  reportDate: Date;
  fiscalDateEnding: string;
  estimate: number | null;
  currency: string;
  daysUntil: number;
}

interface CacheEntry {
  data: EarningsEvent[];
  expiresAt: number;
}

export class EarningsCalendar {
  private readonly apiKey: string;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('Alpha Vantage API key is required');
    this.apiKey = apiKey;
  }

  /**
   * Get upcoming earnings for a symbol within a time horizon.
   * Returns events sorted by reportDate ascending.
   */
  async getUpcomingEarnings(
    symbol: string,
    horizon: '3month' | '6month' | '12month' = '3month',
  ): Promise<EarningsEvent[]> {
    const cacheKey = `${symbol}:${horizon}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    const url = `${BASE_URL}?function=EARNINGS_CALENDAR&symbol=${encodeURIComponent(symbol)}&horizon=${horizon}&apikey=${this.apiKey}`;

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });

      if (!response.ok) {
        log.warn({ symbol, status: response.status }, 'Earnings calendar request failed');
        return [];
      }

      const csv = await response.text();

      // Alpha Vantage returns "Information" message when rate limited or invalid key
      if (csv.includes('"Information"') || csv.includes('"Note"')) {
        log.warn({ symbol }, 'Alpha Vantage rate limit or invalid key for earnings calendar');
        return [];
      }

      const events = this.parseCsv(csv);
      this.cache.set(cacheKey, { data: events, expiresAt: Date.now() + CACHE_TTL_MS });
      log.info({ symbol, count: events.length }, 'Earnings calendar fetched');
      return events;
    } catch (error) {
      log.warn({ symbol, error: error instanceof Error ? error.message : String(error) }, 'Earnings calendar fetch failed');
      return [];
    }
  }

  /**
   * Check which symbols have earnings within the next N days.
   * Efficient: batches all symbols and returns only upcoming ones.
   */
  async getEarningsWithin(symbols: string[], days = 3): Promise<EarningsEvent[]> {
    const upcoming: EarningsEvent[] = [];

    await Promise.all(
      symbols.map(async symbol => {
        const events = await this.getUpcomingEarnings(symbol);
        const soon = events.filter(e => e.daysUntil >= 0 && e.daysUntil <= days);
        upcoming.push(...soon);
      }),
    );

    return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
  }

  // ── CSV parser ────────────────────────────────────────────────────────────

  private parseCsv(csv: string): EarningsEvent[] {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];

    // Skip header row
    const dataLines = lines.slice(1);
    const now = new Date();
    const events: EarningsEvent[] = [];

    for (const line of dataLines) {
      const parts = this.parseCsvLine(line);
      if (parts.length < 6) continue;

      const [symbol, name, reportDateStr, fiscalDateEnding, estimateStr, currency] = parts;
      if (!symbol || !reportDateStr) continue;

      const reportDate = new Date(reportDateStr);
      if (isNaN(reportDate.getTime())) continue;

      // Compare calendar dates only (not timestamps) to avoid TZ off-by-one
      const todayStr = now.toISOString().split('T')[0] ?? '1970-01-01';
      const today = new Date(todayStr);
      const daysUntil = Math.floor((reportDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const estimate = estimateStr ? parseFloat(estimateStr) : null;

      events.push({
        symbol: symbol.trim(),
        name: name?.trim() ?? symbol.trim(),
        reportDate,
        fiscalDateEnding: fiscalDateEnding?.trim() ?? '',
        estimate: estimate !== null && !isNaN(estimate) ? estimate : null,
        currency: currency?.trim() ?? 'USD',
        daysUntil,
      });
    }

    return events.sort((a, b) => a.reportDate.getTime() - b.reportDate.getTime());
  }

  /** Handle quoted CSV values that may contain commas */
  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }
}
