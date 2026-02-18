/**
 * Unit tests for LangfuseWrapper
 *
 * Tests the null-object pattern, disabled mode behavior, singleton,
 * and enabled mode construction (no live Langfuse connection required).
 *
 * vi.mock() is hoisted above all variable declarations by Vitest, so
 * all mock state that the factory references must be created with vi.hoisted().
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Hoisted mock state (safe to reference inside vi.mock factory) ─────────────

const {
  mockScore,
  mockTraceEnd,
  mockGenEnd,
  mockSpanEnd,
  mockFlushAsync,
  mockShutdownAsync,
  mockGeneration,
  mockSpan,
  mockTrace,
  MockLangfuse,
} = vi.hoisted(() => {
  const mockScore = vi.fn();
  const mockTraceEnd = vi.fn();
  const mockGenEnd = vi.fn();
  const mockSpanEnd = vi.fn();
  const mockFlushAsync = vi.fn().mockResolvedValue(undefined);
  const mockShutdownAsync = vi.fn().mockResolvedValue(undefined);

  const mockGeneration = vi.fn().mockReturnValue({ end: mockGenEnd });
  const mockSpan = vi.fn().mockReturnValue({ end: mockSpanEnd });

  const mockTrace = vi.fn().mockReturnValue({
    id: 'mock-trace-id',
    generation: mockGeneration,
    span: mockSpan,
    update: mockTraceEnd,
  });

  const MockLangfuse = vi.fn().mockImplementation(() => ({
    trace: mockTrace,
    score: mockScore,
    flushAsync: mockFlushAsync,
    shutdownAsync: mockShutdownAsync,
  }));

  return {
    mockScore,
    mockTraceEnd,
    mockGenEnd,
    mockSpanEnd,
    mockFlushAsync,
    mockShutdownAsync,
    mockGeneration,
    mockSpan,
    mockTrace,
    MockLangfuse,
  };
});

// ── vi.mock factories (hoisted; may reference vi.hoisted() values) ────────────

vi.mock('langfuse', () => ({ Langfuse: MockLangfuse }));

vi.mock('../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ── Import under test (after mocks are declared) ──────────────────────────────

import {
  LangfuseWrapper,
  getLangfuse,
  type LangfuseTraceHandle,
} from '../../../src/observability/langfuse-wrapper.js';

// ═════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════════

function makeDisabledWrapper(): LangfuseWrapper {
  delete process.env.LANGFUSE_PUBLIC_KEY;
  delete process.env.LANGFUSE_SECRET_KEY;
  return new LangfuseWrapper();
}

// ═════════════════════════════════════════════════════════════════════════════
// TESTS
// ═════════════════════════════════════════════════════════════════════════════

describe('LangfuseWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
    delete process.env.LANGFUSE_BASE_URL;
  });

  // ── 1. Disabled mode construction ─────────────────────────────────────────

  it('creates in disabled mode when no keys provided', () => {
    const wrapper = makeDisabledWrapper();

    expect(wrapper.isEnabled).toBe(false);
    expect(MockLangfuse).not.toHaveBeenCalled();
  });

  // ── 2. trace() returns a usable null trace ────────────────────────────────

  it('trace() returns null trace when disabled', () => {
    const wrapper = makeDisabledWrapper();
    const handle: LangfuseTraceHandle = wrapper.trace({ name: 'test-trace' });

    expect(handle).toBeDefined();
    expect(typeof handle.id).toBe('string');
    expect(handle.id.length).toBeGreaterThan(0);
    expect(typeof handle.generation).toBe('function');
    expect(typeof handle.span).toBe('function');
    expect(typeof handle.score).toBe('function');
    expect(typeof handle.end).toBe('function');
  });

  // ── 3. Null trace generation.end() is a no-op ────────────────────────────

  it('null trace generation.end() is a no-op', () => {
    const wrapper = makeDisabledWrapper();
    const handle = wrapper.trace({ name: 'gen-test' });

    const gen = handle.generation({
      name: 'claude',
      model: 'claude-sonnet-4-6',
      input: [{ role: 'user', content: 'hello' }],
    });

    expect(() =>
      gen.end({
        output: 'hi',
        inputTokens: 10,
        outputTokens: 5,
        latencyMs: 200,
      }),
    ).not.toThrow();
  });

  // ── 4. Null trace span.end() is a no-op ──────────────────────────────────

  it('null trace span.end() is a no-op', () => {
    const wrapper = makeDisabledWrapper();
    const handle = wrapper.trace({ name: 'span-test' });

    const spanHandle = handle.span('my-span', { key: 'value' });

    expect(() => spanHandle.end()).not.toThrow();
  });

  // ── 5. Null trace score() is a no-op ─────────────────────────────────────

  it('null trace score() is a no-op', () => {
    const wrapper = makeDisabledWrapper();
    const handle = wrapper.trace({ name: 'score-test' });

    expect(() => handle.score('quality', 0.9, 'optional comment')).not.toThrow();
  });

  // ── 6. Null trace end() is a no-op ───────────────────────────────────────

  it('null trace end() is a no-op', () => {
    const wrapper = makeDisabledWrapper();
    const handle = wrapper.trace({ name: 'end-test' });

    expect(() => handle.end({ extra: 'metadata' })).not.toThrow();
    expect(() => handle.end()).not.toThrow();
  });

  // ── 7. getStatus() returns enabled=false when disabled ───────────────────

  it('getStatus() returns enabled=false when disabled', () => {
    const wrapper = makeDisabledWrapper();
    const status = wrapper.getStatus();

    expect(status.enabled).toBe(false);
  });

  // ── 8. getStatus() returns correct baseUrl ───────────────────────────────

  it('getStatus() returns correct baseUrl', () => {
    const wrapper = makeDisabledWrapper();
    const status = wrapper.getStatus();

    expect(status.baseUrl).toBe('https://cloud.langfuse.com');
  });

  it('getStatus() reflects LANGFUSE_BASE_URL env var', () => {
    process.env.LANGFUSE_BASE_URL = 'https://my.langfuse.instance.com';
    const wrapper = makeDisabledWrapper();
    const status = wrapper.getStatus();

    expect(status.baseUrl).toBe('https://my.langfuse.instance.com');
  });

  // ── 9. flush() resolves without error when disabled ──────────────────────

  it('flush() resolves without error when disabled', async () => {
    const wrapper = makeDisabledWrapper();
    await expect(wrapper.flush()).resolves.toBeUndefined();
    expect(mockFlushAsync).not.toHaveBeenCalled();
  });

  // ── 10. shutdown() resolves without error when disabled ──────────────────

  it('shutdown() resolves without error when disabled', async () => {
    const wrapper = makeDisabledWrapper();
    await expect(wrapper.shutdown()).resolves.toBeUndefined();
    expect(mockShutdownAsync).not.toHaveBeenCalled();
  });

  // ── 11. getLangfuse() returns singleton ──────────────────────────────────

  it('getLangfuse() returns singleton', () => {
    const first = getLangfuse();
    const second = getLangfuse();

    expect(first).toBe(second);
    expect(first.isEnabled).toBe(false);
  });

  // ── 12. Enabled mode when keys provided ──────────────────────────────────

  it('creates in enabled mode when keys provided', () => {
    const wrapper = new LangfuseWrapper({
      publicKey: 'pk-dummy-key',
      secretKey: 'sk-dummy-key',
      baseUrl: 'https://cloud.langfuse.com',
    });

    expect(wrapper.isEnabled).toBe(true);
    expect(MockLangfuse).toHaveBeenCalledOnce();
    expect(MockLangfuse).toHaveBeenCalledWith(
      expect.objectContaining({
        publicKey: 'pk-dummy-key',
        secretKey: 'sk-dummy-key',
      }),
    );
  });
});

// ─── Enabled mode trace behavior ──────────────────────────────────────────────

describe('LangfuseWrapper — enabled mode trace passthrough', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
  });

  function makeEnabledWrapper(): LangfuseWrapper {
    return new LangfuseWrapper({
      publicKey: 'pk-test',
      secretKey: 'sk-test',
    });
  }

  it('trace() returns handle with string id from Langfuse client', () => {
    const wrapper = makeEnabledWrapper();
    const handle = wrapper.trace({ name: 'my-trace', userId: 'pryce' });

    expect(typeof handle.id).toBe('string');
    expect(mockTrace).toHaveBeenCalledOnce();
  });

  it('trace.generation().end() delegates to Langfuse generation', () => {
    const wrapper = makeEnabledWrapper();
    const handle = wrapper.trace({ name: 'gen-passthrough' });

    const gen = handle.generation({
      name: 'claude',
      model: 'claude-sonnet-4-6',
      input: [{ role: 'user', content: 'test' }],
    });

    expect(mockGeneration).toHaveBeenCalledOnce();

    gen.end({ output: 'response', inputTokens: 50, outputTokens: 100, latencyMs: 500 });
    expect(mockGenEnd).toHaveBeenCalledOnce();
  });

  it('trace.span() delegates to Langfuse span', () => {
    const wrapper = makeEnabledWrapper();
    const handle = wrapper.trace({ name: 'span-passthrough' });

    const spanHandle = handle.span('retrieval', { docs: 3 });
    expect(mockSpan).toHaveBeenCalledWith({ name: 'retrieval', metadata: { docs: 3 } });

    spanHandle.end();
    expect(mockSpanEnd).toHaveBeenCalledOnce();
  });

  it('trace.score() calls client.score', () => {
    const wrapper = makeEnabledWrapper();
    const handle = wrapper.trace({ name: 'score-passthrough' });

    handle.score('helpfulness', 0.8, 'good answer');
    expect(mockScore).toHaveBeenCalledOnce();
    expect(mockScore).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'helpfulness', value: 0.8 }),
    );
  });

  it('flush() calls flushAsync on the client', async () => {
    const wrapper = makeEnabledWrapper();
    await wrapper.flush();
    expect(mockFlushAsync).toHaveBeenCalledOnce();
  });

  it('shutdown() calls shutdownAsync on the client', async () => {
    const wrapper = makeEnabledWrapper();
    await wrapper.shutdown();
    expect(mockShutdownAsync).toHaveBeenCalledOnce();
  });

  it('getStatus() returns enabled=true when client is active', () => {
    const wrapper = makeEnabledWrapper();
    const status = wrapper.getStatus();
    expect(status.enabled).toBe(true);
  });
});
