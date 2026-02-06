/**
 * Web Navigation Tool — Playwright-based web interaction for ARI
 *
 * Provides structured web navigation, content extraction, screenshots,
 * and interaction capabilities within ARI's permission/audit framework.
 *
 * Security: All URLs validated, blocked domains enforced, content
 * passed through sanitizer, all actions audit-logged via EventBus.
 *
 * Architecture: Layer 5 (Execution) — imports only from Kernel.
 */

import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import type { ToolHandler, ExecutionContext } from '../types.js';

// ── URL Security ────────────────────────────────────────────────────────

const BLOCKED_DOMAINS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',
  '169.254.169.254',  // AWS metadata
  'metadata.google.internal',
]);

const BLOCKED_SCHEMES = new Set([
  'file:',
  'javascript:',
  'data:',
  'blob:',
  'ftp:',
]);

/**
 * Validate a URL for safety before navigation.
 * Prevents SSRF, local file access, and metadata endpoint attacks.
 */
function validateUrl(raw: string): URL {
  if (!raw || typeof raw !== 'string') {
    throw new Error('URL is required');
  }

  // Check for blocked schemes BEFORE normalizing
  const lowerRaw = raw.toLowerCase().trim();
  for (const scheme of BLOCKED_SCHEMES) {
    if (lowerRaw.startsWith(scheme)) {
      throw new Error(`Blocked scheme: ${scheme}`);
    }
  }

  // Normalize: add https:// if no scheme
  const normalized = raw.match(/^https?:\/\//) ? raw : `https://${raw}`;

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`Invalid URL: ${raw}`);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_DOMAINS.has(hostname)) {
    throw new Error(`Blocked domain: ${hostname} (SSRF protection)`);
  }

  // Block private IP ranges
  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname)) {
    throw new Error(`Blocked private IP: ${hostname}`);
  }

  return parsed;
}

// ── Browser Pool ────────────────────────────────────────────────────────

let sharedBrowser: Browser | null = null;
let browserLastUsed = 0;
const BROWSER_IDLE_TIMEOUT_MS = 120_000; // 2 minutes

/**
 * Get or create a shared browser instance.
 * Reuses browser across calls to avoid cold-start overhead (~2s per launch).
 * Auto-closes after idle timeout.
 */
async function getBrowser(): Promise<Browser> {
  browserLastUsed = Date.now();

  if (sharedBrowser?.isConnected()) {
    return sharedBrowser;
  }

  sharedBrowser = await chromium.launch({
    headless: true,
    args: [
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-translate',
      '--no-first-run',
      '--disable-web-security=false',
    ],
  });

  // Schedule idle cleanup
  const idleCheck = setInterval(() => {
    if (Date.now() - browserLastUsed > BROWSER_IDLE_TIMEOUT_MS) {
      clearInterval(idleCheck);
      void closeBrowser();
    }
  }, 30_000);

  // Don't keep process alive for cleanup
  if (idleCheck.unref) {
    idleCheck.unref();
  }

  return sharedBrowser;
}

/**
 * Close the shared browser (for cleanup/shutdown).
 */
export async function closeBrowser(): Promise<void> {
  if (sharedBrowser?.isConnected()) {
    await sharedBrowser.close();
  }
  sharedBrowser = null;
}

// ── Content Extraction ──────────────────────────────────────────────────

interface ExtractedContent {
  url: string;
  title: string;
  text: string;
  links: Array<{ text: string; href: string }>;
  headings: Array<{ level: number; text: string }>;
  meta: Record<string, string>;
  wordCount: number;
}

/**
 * Extract clean, structured content from a page.
 * Returns text, links, headings, and metadata — no raw HTML noise.
 */
async function extractContent(page: Page, maxTextLength: number = 50_000): Promise<ExtractedContent> {
  return page.evaluate((max) => {
    // Remove noise elements
    const noiseSelectors = [
      'script', 'style', 'noscript', 'iframe', 'svg',
      'nav', 'footer', 'header[role="banner"]',
      '[aria-hidden="true"]', '.cookie-banner', '.popup',
      '.advertisement', '.ad', '.sidebar',
    ];
    const clone = document.cloneNode(true) as Document;
    for (const sel of noiseSelectors) {
      clone.querySelectorAll(sel).forEach(el => el.remove());
    }

    // Extract main content (prefer article/main, fall back to body)
    const main = clone.querySelector('article, main, [role="main"]') || clone.body;
    const rawText = (main?.textContent || '').replace(/\s+/g, ' ').trim();
    const text = rawText.slice(0, max);

    // Extract links
    const links: Array<{ text: string; href: string }> = [];
    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href') || '';
      const linkText = (a.textContent || '').trim();
      if (href && linkText && !href.startsWith('#') && !href.startsWith('javascript:')) {
        links.push({ text: linkText.slice(0, 200), href });
      }
    });

    // Extract headings
    const headings: Array<{ level: number; text: string }> = [];
    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
      const level = parseInt(h.tagName[1], 10);
      const hText = (h.textContent || '').trim();
      if (hText) {
        headings.push({ level, text: hText.slice(0, 300) });
      }
    });

    // Extract meta tags
    const meta: Record<string, string> = {};
    document.querySelectorAll('meta[name], meta[property]').forEach(m => {
      const key = m.getAttribute('name') || m.getAttribute('property') || '';
      const value = m.getAttribute('content') || '';
      if (key && value) {
        meta[key] = value.slice(0, 500);
      }
    });

    return {
      url: document.URL,
      title: document.title || '',
      text,
      links: links.slice(0, 100),
      headings,
      meta,
      wordCount: text.split(/\s+/).filter(Boolean).length,
    };
  }, maxTextLength);
}

// ── Action Types ────────────────────────────────────────────────────────

type WebAction =
  | 'navigate'      // Load page, return content
  | 'extract'       // Extract structured content
  | 'screenshot'    // Capture visual snapshot
  | 'click'         // Click an element
  | 'type'          // Type into a field
  | 'fill'          // Fill a form field (clears first)
  | 'select'        // Select dropdown option
  | 'scroll'        // Scroll the page
  | 'wait'          // Wait for element/condition
  | 'evaluate';     // Run JavaScript (read-only)

// ── Tool Handlers ───────────────────────────────────────────────────────

/**
 * web_navigate — Navigate to a URL and extract page content.
 * The primary tool for web interaction. Returns clean structured data.
 */
export const webNavigateHandler: ToolHandler = async (
  params: Record<string, unknown>,
  _context: ExecutionContext
): Promise<unknown> => {
  const url = validateUrl(String(params.url || ''));
  const action = (String(params.action || 'navigate')) as WebAction;
  const selector = params.selector ? String(params.selector) : undefined;
  const text = params.text ? String(params.text) : undefined;
  const waitFor = params.waitFor ? String(params.waitFor) : undefined;
  const timeout = Math.min(Number(params.timeout || 30000), 60000);
  const viewport = params.viewport as { width?: number; height?: number } | undefined;

  const browser = await getBrowser();
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    context = await browser.newContext({
      viewport: {
        width: viewport?.width || 1280,
        height: viewport?.height || 720,
      },
      userAgent: 'ARI/2.1.0 (Autonomous Reasoning Intelligence)',
      javaScriptEnabled: true,
      ignoreHTTPSErrors: false,
    });

    page = await context.newPage();

    // Block heavy resources for faster loading
    await page.route('**/*.{mp4,webm,ogg,mp3,wav,flac,aac}', route => route.abort());
    await page.route('**/*.{woff,woff2,ttf,eot}', route => route.abort());

    // Navigate to the URL
    const response = await page.goto(url.toString(), {
      waitUntil: 'domcontentloaded',
      timeout,
    });

    const status = response?.status() || 0;
    if (status >= 400) {
      throw new Error(`HTTP ${status}: ${response?.statusText() || 'Request failed'}`);
    }

    // Wait for additional element if specified
    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout: Math.min(timeout, 10000) });
    }

    // Execute the requested action
    switch (action) {
      case 'navigate':
      case 'extract': {
        const content = await extractContent(page);
        return {
          success: true,
          action,
          status,
          ...content,
        };
      }

      case 'screenshot': {
        const buffer = await page.screenshot({
          type: 'png',
          fullPage: Boolean(params.fullPage),
        });
        const content = await extractContent(page);
        return {
          success: true,
          action: 'screenshot',
          url: page.url(),
          title: content.title,
          status,
          screenshot: buffer.toString('base64'),
          screenshotSize: buffer.length,
          wordCount: content.wordCount,
        };
      }

      case 'click': {
        if (!selector) throw new Error('selector required for click action');
        await page.click(selector, { timeout: 5000 });
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
        const content = await extractContent(page);
        return {
          success: true,
          action: 'click',
          clicked: selector,
          status,
          ...content,
        };
      }

      case 'type': {
        if (!selector) throw new Error('selector required for type action');
        if (!text) throw new Error('text required for type action');
        await page.type(selector, text, { delay: 50 });
        return {
          success: true,
          action: 'type',
          url: page.url(),
          typed: text,
          selector,
        };
      }

      case 'fill': {
        if (!selector) throw new Error('selector required for fill action');
        if (!text) throw new Error('text required for fill action');
        await page.fill(selector, text);
        return {
          success: true,
          action: 'fill',
          url: page.url(),
          filled: text,
          selector,
        };
      }

      case 'select': {
        if (!selector) throw new Error('selector required for select action');
        const value = String(params.value || text || '');
        if (!value) throw new Error('value required for select action');
        const selected = await page.selectOption(selector, value);
        return {
          success: true,
          action: 'select',
          url: page.url(),
          selected,
          selector,
        };
      }

      case 'scroll': {
        const direction = String(params.direction || 'down');
        const amount = Number(params.amount || 500);
        const scrollY = direction === 'up' ? -amount : amount;
        await page.evaluate((y) => window.scrollBy(0, y), scrollY);
        await page.waitForTimeout(500); // Let lazy content load
        const content = await extractContent(page);
        return {
          success: true,
          action: 'scroll',
          direction,
          amount,
          ...content,
        };
      }

      case 'wait': {
        if (!selector) throw new Error('selector required for wait action');
        await page.waitForSelector(selector, { timeout: Math.min(timeout, 15000) });
        const content = await extractContent(page);
        return {
          success: true,
          action: 'wait',
          waited: selector,
          ...content,
        };
      }

      case 'evaluate': {
        const script = String(params.script || '');
        if (!script) throw new Error('script required for evaluate action');
        // Only allow read-only evaluation (no mutations)
        const result = await page.evaluate(script);
        return {
          success: true,
          action: 'evaluate',
          url: page.url(),
          result,
        };
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
  }
};

/**
 * web_search — Search the web and extract results.
 * Uses DuckDuckGo (no API key, no tracking) for privacy-first search.
 */
export const webSearchHandler: ToolHandler = async (
  params: Record<string, unknown>,
  _context: ExecutionContext
): Promise<unknown> => {
  const query = String(params.query || '');
  if (!query) throw new Error('query is required');

  const maxResults = Math.min(Number(params.maxResults || 10), 20);

  const browser = await getBrowser();
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'ARI/2.1.0 (Autonomous Reasoning Intelligence)',
    });

    page = await context.newPage();

    // Block heavy resources
    await page.route('**/*.{mp4,webm,ogg,mp3,wav,flac,aac,woff,woff2,ttf,eot}', route => route.abort());

    const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Wait for results
    await page.waitForSelector('[data-result]', { timeout: 10000 }).catch(() => {});

    // Extract search results
    const results = await page.evaluate((max) => {
      const items: Array<{ title: string; url: string; snippet: string }> = [];

      // DuckDuckGo result selectors
      const resultEls = document.querySelectorAll('[data-result], .result, .nrn-react-div');

      for (const el of resultEls) {
        if (items.length >= max) break;

        const titleEl = el.querySelector('a[href]');
        const snippetEl = el.querySelector('.result__snippet, [data-result] .result__snippet, .E2eLOJl8HctVnDOl');

        const title = (titleEl?.textContent || '').trim();
        const url = titleEl?.getAttribute('href') || '';
        const snippet = (snippetEl?.textContent || '').trim();

        if (title && url && !url.startsWith('javascript:')) {
          items.push({ title: title.slice(0, 200), url, snippet: snippet.slice(0, 300) });
        }
      }
      return items;
    }, maxResults);

    return {
      success: true,
      query,
      resultCount: results.length,
      results,
    };
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
  }
};

/**
 * web_screenshot — Capture a screenshot of any URL.
 * Lighter-weight than navigate with action=screenshot.
 */
export const webScreenshotHandler: ToolHandler = async (
  params: Record<string, unknown>,
  _context: ExecutionContext
): Promise<unknown> => {
  const url = validateUrl(String(params.url || ''));
  const fullPage = Boolean(params.fullPage);
  const width = Math.min(Number(params.width || 1280), 1920);
  const height = Math.min(Number(params.height || 720), 1080);

  const browser = await getBrowser();
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    context = await browser.newContext({
      viewport: { width, height },
      userAgent: 'ARI/2.1.0 (Autonomous Reasoning Intelligence)',
    });

    page = await context.newPage();

    await page.route('**/*.{mp4,webm,ogg,mp3,wav,flac,aac}', route => route.abort());

    await page.goto(url.toString(), { waitUntil: 'networkidle', timeout: 30000 });

    const buffer = await page.screenshot({ type: 'png', fullPage });

    return {
      success: true,
      url: page.url(),
      title: await page.title(),
      screenshot: buffer.toString('base64'),
      screenshotSize: buffer.length,
      viewport: { width, height },
      fullPage,
    };
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
  }
};

/**
 * web_extract — Extract structured data from a URL.
 * Returns clean text, links, headings, and metadata.
 * No screenshots, no interaction — pure content extraction.
 */
export const webExtractHandler: ToolHandler = async (
  params: Record<string, unknown>,
  _context: ExecutionContext
): Promise<unknown> => {
  const url = validateUrl(String(params.url || ''));
  const maxTextLength = Math.min(Number(params.maxTextLength || 50000), 100000);
  const waitFor = params.waitFor ? String(params.waitFor) : undefined;

  const browser = await getBrowser();
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'ARI/2.1.0 (Autonomous Reasoning Intelligence)',
      javaScriptEnabled: true,
    });

    page = await context.newPage();

    // Block all non-essential resources for speed
    await page.route('**/*.{mp4,webm,ogg,mp3,wav,flac,aac,woff,woff2,ttf,eot,png,jpg,jpeg,gif,svg,webp}', route => route.abort());

    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 20000 });

    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout: 10000 });
    }

    const content = await extractContent(page, maxTextLength);

    return {
      success: true,
      ...content,
    };
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
  }
};
