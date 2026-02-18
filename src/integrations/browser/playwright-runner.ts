/**
 * PLAYWRIGHT RUNNER — URL-allowlist browser automation for ARI
 *
 * Security-first browser automation that restricts access to whitelisted
 * domains only. All browse attempts are audited via EventBus.
 *
 * Phase 14: Browser Automation
 */

import { chromium, type Browser, type Page } from 'playwright';
import type { EventBus } from '../../kernel/event-bus.js';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('playwright-runner');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BrowseResult {
  url: string;
  title: string;
  content: string;
  screenshot?: Buffer;
  loadTimeMs: number;
  statusCode: number;
  extractedAt: string;
}

export interface BrowseOptions {
  waitForSelector?: string;
  extractText?: boolean;
  takeScreenshot?: boolean;
  timeoutMs?: number;
}

const DEFAULT_ALLOWED_DOMAINS: string[] = [
  'prycehedrick.com',
  'linkedin.com',
  'github.com',
  'perplexity.ai',
  'anthropic.com',
  'x.com',
  'twitter.com',
  'youtube.com',
  'pokemontcg.io',
  'tcgplayer.com',
];

const DEFAULT_TIMEOUT_MS = 30_000;

// ─── Runner ─────────────────────────────────────────────────────────────────

export class PlaywrightRunner {
  private readonly eventBus: EventBus;
  private readonly allowedDomains: string[];
  private browser: Browser | null = null;

  constructor(params: { eventBus: EventBus; allowedDomains?: string[] }) {
    this.eventBus = params.eventBus;
    this.allowedDomains = params.allowedDomains ?? [...DEFAULT_ALLOWED_DOMAINS];
  }

  /**
   * Check whether a URL's hostname is in the allowlist.
   */
  isAllowed(url: string): boolean {
    try {
      const { hostname } = new URL(url);
      return this.allowedDomains.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
      );
    } catch {
      return false;
    }
  }

  /**
   * Return the current allowlist (copy to prevent mutation).
   */
  getAllowedDomains(): string[] {
    return [...this.allowedDomains];
  }

  /**
   * Browse a URL and return extracted content.
   * Throws if the domain is not in the allowlist.
   */
  async browse(url: string, options: BrowseOptions = {}): Promise<BrowseResult> {
    // ── Security check first — always ──────────────────────────────────────
    let hostname: string;
    try {
      hostname = new URL(url).hostname;
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }

    if (!this.isAllowed(url)) {
      this.eventBus.emit('audit:log', {
        action: 'browser:blocked',
        agent: 'playwright-runner',
        trustLevel: 'system',
        details: { url, hostname, reason: 'domain_not_in_allowlist' },
      });
      log.warn({ url, hostname }, 'Browse blocked — domain not in allowlist');
      throw new Error(`Domain not in allowlist: ${hostname}`);
    }

    this.eventBus.emit('audit:log', {
      action: 'browser:browse_attempt',
      agent: 'playwright-runner',
      trustLevel: 'system',
      details: { url, hostname },
    });

    log.info({ url }, 'Browsing URL');

    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const startMs = Date.now();

    const browser = await this.getBrowser();
    const page: Page = await browser.newPage();

    try {
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: timeoutMs,
      });

      if (options.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, { timeout: timeoutMs });
      }

      const title = await page.title();
      const statusCode = response?.status() ?? 0;

      const content =
        options.extractText !== false
          ? await page.evaluate(() => document.body.innerText)
          : '';

      let screenshot: Buffer | undefined;
      if (options.takeScreenshot) {
        const raw = await page.screenshot({ type: 'png' });
        screenshot = Buffer.from(raw);
      }

      const loadTimeMs = Date.now() - startMs;
      const extractedAt = new Date().toISOString();

      const result: BrowseResult = {
        url,
        title,
        content,
        screenshot,
        loadTimeMs,
        statusCode,
        extractedAt,
      };

      this.eventBus.emit('audit:log', {
        action: 'browser:browse_complete',
        agent: 'playwright-runner',
        trustLevel: 'system',
        details: { url, statusCode, loadTimeMs, contentLength: content.length },
      });

      log.info({ url, statusCode, loadTimeMs }, 'Browse complete');
      return result;
    } finally {
      await page.close();
    }
  }

  /**
   * Lazily initialise and reuse a single browser instance.
   */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
    }
    return this.browser;
  }

  /**
   * Close the browser and release resources.
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
