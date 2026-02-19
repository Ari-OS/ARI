/**
 * Web Navigation Tool Tests
 *
 * Tests URL validation, domain blocking, SSRF protection,
 * action handlers, and integration with the Executor.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  webNavigateHandler,
  webSearchHandler,
  webScreenshotHandler,
  webExtractHandler,
  closeBrowser,
} from '../../../src/execution/tools/web-navigate.js';

// Mock playwright so browser launch always fails fast (no real network calls in unit tests)
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockRejectedValue(new Error('Browser launch unavailable in test environment')),
  },
}));
import type { ExecutionContext } from '../../../src/execution/types.js';
import { Executor } from '../../../src/agents/executor.js';
import { PolicyEngine } from '../../../src/governance/policy-engine.js';
import { AuditLogger } from '../../../src/kernel/audit.js';
import { EventBus } from '../../../src/kernel/event-bus.js';

// ── Test Context Factory ────────────────────────────────────────────────

function makeContext(overrides?: Partial<ExecutionContext>): ExecutionContext {
  return {
    callId: 'test-call-001',
    tokenId: 'test-token-001',
    agentId: 'planner',
    trustLevel: 'verified',
    startTime: new Date(),
    timeout: 30000,
    ...overrides,
  };
}

// ── URL Validation Tests ────────────────────────────────────────────────

describe('URL Validation', () => {
  const ctx = makeContext();

  it('should reject empty URL', async () => {
    await expect(
      webNavigateHandler({ url: '' }, ctx)
    ).rejects.toThrow('URL is required');
  });

  it('should reject missing URL', async () => {
    await expect(
      webNavigateHandler({}, ctx)
    ).rejects.toThrow('URL is required');
  });

  it('should reject javascript: URLs', async () => {
    await expect(
      webNavigateHandler({ url: 'javascript:alert(1)' }, ctx)
    ).rejects.toThrow('Blocked scheme');
  });

  it('should reject file: URLs', async () => {
    await expect(
      webNavigateHandler({ url: 'file:///etc/passwd' }, ctx)
    ).rejects.toThrow('Blocked scheme');
  });

  it('should reject data: URLs', async () => {
    await expect(
      webNavigateHandler({ url: 'data:text/html,<h1>test</h1>' }, ctx)
    ).rejects.toThrow('Blocked scheme');
  });

  it('should reject blob: URLs', async () => {
    await expect(
      webNavigateHandler({ url: 'blob:http://example.com/uuid' }, ctx)
    ).rejects.toThrow('Blocked scheme');
  });

  it('should reject ftp: URLs', async () => {
    await expect(
      webNavigateHandler({ url: 'ftp://files.example.com' }, ctx)
    ).rejects.toThrow('Blocked scheme');
  });
});

// ── SSRF Protection Tests ───────────────────────────────────────────────

describe('SSRF Protection', () => {
  const ctx = makeContext();

  it('should block localhost', async () => {
    await expect(
      webNavigateHandler({ url: 'http://localhost' }, ctx)
    ).rejects.toThrow('Blocked domain');
  });

  it('should block 127.0.0.1', async () => {
    await expect(
      webNavigateHandler({ url: 'http://127.0.0.1' }, ctx)
    ).rejects.toThrow('Blocked domain');
  });

  it('should block 0.0.0.0', async () => {
    await expect(
      webNavigateHandler({ url: 'http://0.0.0.0' }, ctx)
    ).rejects.toThrow('Blocked domain');
  });

  it('should block IPv6 loopback', async () => {
    await expect(
      webNavigateHandler({ url: 'http://[::1]' }, ctx)
    ).rejects.toThrow('Blocked domain');
  });

  it('should block AWS metadata endpoint', async () => {
    await expect(
      webNavigateHandler({ url: 'http://169.254.169.254/latest/meta-data/' }, ctx)
    ).rejects.toThrow('Blocked domain');
  });

  it('should block GCP metadata endpoint', async () => {
    await expect(
      webNavigateHandler({ url: 'http://metadata.google.internal' }, ctx)
    ).rejects.toThrow('Blocked domain');
  });

  it('should block private 10.x.x.x IPs', async () => {
    await expect(
      webNavigateHandler({ url: 'http://10.0.0.1' }, ctx)
    ).rejects.toThrow('Blocked private IP');
  });

  it('should block private 192.168.x.x IPs', async () => {
    await expect(
      webNavigateHandler({ url: 'http://192.168.1.1' }, ctx)
    ).rejects.toThrow('Blocked private IP');
  });

  it('should block private 172.16-31.x.x IPs', async () => {
    await expect(
      webNavigateHandler({ url: 'http://172.16.0.1' }, ctx)
    ).rejects.toThrow('Blocked private IP');
  });
});

// ── Action Validation Tests ─────────────────────────────────────────────

describe('Action Validation', () => {
  const ctx = makeContext();

  it('should require selector for click action', async () => {
    await expect(
      webNavigateHandler({ url: 'https://example.com', action: 'click' }, ctx)
    ).rejects.toThrow('selector required');
  });

  it('should require selector for type action', async () => {
    await expect(
      webNavigateHandler({ url: 'https://example.com', action: 'type' }, ctx)
    ).rejects.toThrow('selector required');
  });

  it('should require text for type action', async () => {
    await expect(
      webNavigateHandler({ url: 'https://example.com', action: 'type', selector: '#input' }, ctx)
    ).rejects.toThrow('text required');
  });

  it('should require selector for fill action', async () => {
    await expect(
      webNavigateHandler({ url: 'https://example.com', action: 'fill' }, ctx)
    ).rejects.toThrow('selector required');
  });

  it('should require text for fill action', async () => {
    await expect(
      webNavigateHandler({ url: 'https://example.com', action: 'fill', selector: '#input' }, ctx)
    ).rejects.toThrow('text required');
  });

  it('should require selector for select action', async () => {
    await expect(
      webNavigateHandler({ url: 'https://example.com', action: 'select' }, ctx)
    ).rejects.toThrow('selector required');
  });

  it('should require selector for wait action', async () => {
    await expect(
      webNavigateHandler({ url: 'https://example.com', action: 'wait' }, ctx)
    ).rejects.toThrow('selector required');
  });

  it('should require script for evaluate action', async () => {
    await expect(
      webNavigateHandler({ url: 'https://example.com', action: 'evaluate' }, ctx)
    ).rejects.toThrow('script required');
  });

  it('should reject unknown actions', async () => {
    await expect(
      webNavigateHandler({ url: 'https://example.com', action: 'destroy' }, ctx)
    ).rejects.toThrow('Unknown action');
  });
});

// ── Search Validation Tests ─────────────────────────────────────────────

describe('Web Search Validation', () => {
  const ctx = makeContext();

  it('should require query parameter', async () => {
    await expect(
      webSearchHandler({ query: '' }, ctx)
    ).rejects.toThrow('query is required');
  });

  it('should require non-empty query', async () => {
    await expect(
      webSearchHandler({}, ctx)
    ).rejects.toThrow('query is required');
  });
});

// ── Screenshot Validation Tests ─────────────────────────────────────────

describe('Web Screenshot Validation', () => {
  const ctx = makeContext();

  it('should reject invalid URLs', async () => {
    await expect(
      webScreenshotHandler({ url: '' }, ctx)
    ).rejects.toThrow('URL is required');
  });

  it('should reject localhost', async () => {
    await expect(
      webScreenshotHandler({ url: 'http://localhost:3000' }, ctx)
    ).rejects.toThrow('Blocked domain');
  });
});

// ── Extract Validation Tests ────────────────────────────────────────────

describe('Web Extract Validation', () => {
  const ctx = makeContext();

  it('should reject invalid URLs', async () => {
    await expect(
      webExtractHandler({ url: '' }, ctx)
    ).rejects.toThrow('URL is required');
  });

  it('should reject SSRF targets', async () => {
    await expect(
      webExtractHandler({ url: 'http://169.254.169.254' }, ctx)
    ).rejects.toThrow('Blocked domain');
  });
});

// ── Executor Integration Tests ──────────────────────────────────────────

describe('Executor Web Tool Registration', () => {
  let executor: Executor;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    const auditLogger = new AuditLogger('/tmp/ari-test-audit.json');
    executor = new Executor(auditLogger, eventBus, new PolicyEngine(auditLogger, eventBus));
  });

  it('should register web_navigate tool', () => {
    const tools = executor.getTools();
    const webNav = tools.find(t => t.id === 'web_navigate');
    expect(webNav).toBeDefined();
    expect(webNav?.permission_tier).toBe('WRITE_SAFE');
    expect(webNav?.required_trust_level).toBe('verified');
    expect(webNav?.timeout_ms).toBe(60000);
    expect(webNav?.sandboxed).toBe(true);
  });

  it('should register web_search tool', () => {
    const tools = executor.getTools();
    const webSearch = tools.find(t => t.id === 'web_search');
    expect(webSearch).toBeDefined();
    expect(webSearch?.permission_tier).toBe('READ_ONLY');
    expect(webSearch?.required_trust_level).toBe('standard');
  });

  it('should register web_screenshot tool', () => {
    const tools = executor.getTools();
    const webScreenshot = tools.find(t => t.id === 'web_screenshot');
    expect(webScreenshot).toBeDefined();
    expect(webScreenshot?.permission_tier).toBe('READ_ONLY');
    expect(webScreenshot?.required_trust_level).toBe('standard');
  });

  it('should register web_extract tool', () => {
    const tools = executor.getTools();
    const webExtract = tools.find(t => t.id === 'web_extract');
    expect(webExtract).toBeDefined();
    expect(webExtract?.permission_tier).toBe('READ_ONLY');
    expect(webExtract?.required_trust_level).toBe('standard');
  });

  it('should register all 4 web tools', () => {
    const tools = executor.getTools();
    const webTools = tools.filter(t => t.id.startsWith('web_'));
    expect(webTools).toHaveLength(4);
  });

  it('should have proper parameter definitions for web_navigate', () => {
    const tools = executor.getTools();
    const webNav = tools.find(t => t.id === 'web_navigate')!;
    expect(webNav.parameters).toHaveProperty('url');
    expect(webNav.parameters).toHaveProperty('action');
    expect(webNav.parameters).toHaveProperty('selector');
    expect(webNav.parameters).toHaveProperty('text');
    expect(webNav.parameters).toHaveProperty('waitFor');
    expect(webNav.parameters).toHaveProperty('timeout');
    expect(webNav.parameters.url.required).toBe(true);
    expect(webNav.parameters.action.required).toBe(false);
  });

  it('should deny web_navigate to untrusted callers', async () => {
    const result = await executor.execute({
      id: 'test-001',
      tool_id: 'web_navigate',
      parameters: { url: 'https://example.com' },
      requesting_agent: 'planner',
      trust_level: 'untrusted',
      timestamp: new Date(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Permission denied');
  });

  it('should allow web_search to standard trust', async () => {
    // web_search requires standard trust level, so this should pass permission check
    // but may fail on actual browser launch (which is fine for this test)
    const result = await executor.execute({
      id: 'test-002',
      tool_id: 'web_search',
      parameters: { query: '' },
      requesting_agent: 'planner',
      trust_level: 'standard',
      timestamp: new Date(),
    });

    // Should fail with validation error, not permission error
    if (!result.success) {
      expect(result.error).not.toContain('Permission denied');
    }
  });

  it('should deny web_navigate to hostile callers', async () => {
    const result = await executor.execute({
      id: 'test-003',
      tool_id: 'web_navigate',
      parameters: { url: 'https://example.com' },
      requesting_agent: 'planner',
      trust_level: 'hostile',
      timestamp: new Date(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Permission denied');
  });
});

// ── URL Auto-Prefix Tests ───────────────────────────────────────────────

describe('URL Auto-Prefix', () => {
  const ctx = makeContext();

  // These will fail on actual navigation (no browser in CI) but should
  // NOT fail on URL validation — proving the auto-prefix works
  it('should not throw on URLs without scheme', async () => {
    // This should get past URL validation and fail on browser launch, not URL parsing
    try {
      await webNavigateHandler({ url: 'example.com' }, ctx);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      // Should NOT be a URL validation error
      expect(msg).not.toContain('Invalid URL');
      expect(msg).not.toContain('Blocked');
    }
  });

  it('should accept https:// URLs', async () => {
    try {
      await webNavigateHandler({ url: 'https://example.com' }, ctx);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      expect(msg).not.toContain('Invalid URL');
      expect(msg).not.toContain('Blocked');
    }
  });

  it('should accept http:// URLs', async () => {
    try {
      await webNavigateHandler({ url: 'http://example.com' }, ctx);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      expect(msg).not.toContain('Invalid URL');
      expect(msg).not.toContain('Blocked');
    }
  });
});

// ── Browser Cleanup ─────────────────────────────────────────────────────

afterEach(async () => {
  // Clean up shared browser between tests
  await closeBrowser();
});
