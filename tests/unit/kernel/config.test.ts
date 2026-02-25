import { describe, it, expect } from 'vitest';
import { validateApiKeyFormat, assertValidApiKey } from '../../../src/kernel/config.js';

describe('validateApiKeyFormat', () => {
  it('recognizes OpenRouter keys (sk_or_ prefix)', () => {
    expect(validateApiKeyFormat('sk_or_abc123')).toBe('openrouter');
    expect(validateApiKeyFormat('sk_or_very-long-key-with-dashes')).toBe('openrouter');
  });

  it('recognizes Anthropic direct keys (sk-ant- prefix)', () => {
    expect(validateApiKeyFormat('sk-ant-api03-abc123')).toBe('anthropic');
    expect(validateApiKeyFormat('sk-ant-admin01-xyz')).toBe('anthropic');
  });

  it('rejects invalid key formats', () => {
    expect(validateApiKeyFormat('sk-some-other-format')).toBe('invalid');
    expect(validateApiKeyFormat('Bearer tok_12345')).toBe('invalid');
    expect(validateApiKeyFormat('')).toBe('invalid');
    expect(validateApiKeyFormat('claude-max-oauth-token')).toBe('invalid');
  });

  it('rejects subscription OAuth tokens (Anthropic ToS Section 3.7)', () => {
    // These token formats represent subscription-based OAuth tokens
    // which are PROHIBITED for automated use per Anthropic ToS Section 3.7
    expect(validateApiKeyFormat('sk-proj-abc123')).toBe('invalid');
    expect(validateApiKeyFormat('oauth-token-abc')).toBe('invalid');
  });
});

describe('assertValidApiKey', () => {
  it('passes for valid OpenRouter key', () => {
    expect(() => assertValidApiKey('sk_or_abc123')).not.toThrow();
  });

  it('passes for valid Anthropic direct key', () => {
    expect(() => assertValidApiKey('sk-ant-api03-abc123')).not.toThrow();
  });

  it('throws if key is undefined', () => {
    expect(() => assertValidApiKey(undefined)).toThrow('[ARI Kernel] No API key found');
  });

  it('throws with startup-halt message for invalid format', () => {
    expect(() => assertValidApiKey('sk-invalid-format')).toThrow(
      '[ARI Kernel] INVALID API KEY FORMAT — startup aborted',
    );
  });

  it('error message references ToS Section 3.7', () => {
    let error: Error | undefined;
    try {
      assertValidApiKey('bad-key');
    } catch (e) {
      error = e as Error;
    }
    expect(error?.message).toContain('ToS Section 3.7');
    expect(error?.message).toContain('openrouter.ai/keys');
  });
});
