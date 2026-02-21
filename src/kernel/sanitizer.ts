import type { TrustLevel, SanitizeResult } from './types.js';
import { INJECTION_PATTERNS, SEVERITY_WEIGHTS } from './sanitizer-patterns.js';
export { INJECTION_PATTERNS, SEVERITY_WEIGHTS };

/**
 * Trust level multipliers for risk score calculation
 */
const TRUST_MULTIPLIERS: Record<TrustLevel, number> = {
  system: 0.5,
  operator: 0.6,
  verified: 0.75,
  standard: 1.0,
  untrusted: 1.5,
  hostile: 2.0,
};

interface WasmSanitizer {
  new (patterns: string): WasmSanitizerInstance;
}

interface WasmSanitizerInstance {
  sanitize(content: string, trustMultiplier: number): { safe: boolean; threats: Array<{ pattern: string; category: string; severity: string }>; risk_score: number };
}

let wasmSanitizerInstance: WasmSanitizerInstance | null = null;

try {
  // Attempt to load the WASM module if it has been compiled
  // The user needs to run `wasm-pack build --target nodejs` inside `src/kernel/sanitizer-rs`
  // @ts-expect-error WASM module may not be built yet
  const wasmModule = await import('./sanitizer-rs/pkg/ari_sanitizer.js').catch(() => null) as { Sanitizer: WasmSanitizer } | null;
  if (wasmModule) {
    // Format patterns for Aho-Corasick
    const patternsForWasm = INJECTION_PATTERNS.map((p) => ({
      pattern: p.pattern.source,
      category: p.category,
      severity: p.severity,
      description: p.description
    }));
    wasmSanitizerInstance = new wasmModule.Sanitizer(JSON.stringify(patternsForWasm));
    // eslint-disable-next-line no-console
    console.log('[ARI Kernel] Successfully loaded high-performance Rust/WASM Sanitizer.');
  }
} catch {
  // WASM module not built or available, fallback to JS regex
}

/**
 * Sanitizes input content by detecting potential injection patterns
 *
 * @param content - The content to scan for injection attempts
 * @param trustLevel - The trust level of the content source
 * @returns SanitizeResult containing safety status, threats, and risk score
 */
export function sanitize(content: string, trustLevel: TrustLevel): SanitizeResult {
  const trustMultiplier = TRUST_MULTIPLIERS[trustLevel];

  // Fast Path: WASM Aho-Corasick Implementation
  if (wasmSanitizerInstance) {
    try {
      const wasmResult = wasmSanitizerInstance.sanitize(content, trustMultiplier);
      return {
        safe: wasmResult.safe,
        threats: wasmResult.threats,
        sanitizedContent: content,
        riskScore: wasmResult.risk_score,
      };
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[ARI Kernel] WASM Sanitizer failed, falling back to JS.', e);
    }
  }

  // Fallback: Native JavaScript RegExp Implementation
  const threats: Array<{ pattern: string; category: string; severity: string }> = [];

  // Scan content against all injection patterns
  for (const injectionPattern of INJECTION_PATTERNS) {
    if (injectionPattern.pattern.test(content)) {
      threats.push({
        pattern: injectionPattern.description,
        category: injectionPattern.category,
        severity: injectionPattern.severity,
      });
    }
  }

  // Calculate risk score
  let riskScore = 0;
  for (const threat of threats) {
    const severityWeight = SEVERITY_WEIGHTS[threat.severity as keyof typeof SEVERITY_WEIGHTS] || 0;
    riskScore += severityWeight;
  }

  // Apply trust level multiplier
  riskScore = Math.min(riskScore * trustMultiplier, 100);

  return {
    safe: threats.length === 0,
    threats,
    sanitizedContent: content, // Don't modify content, just flag threats
    riskScore,
  };
}

/**
 * Convenience function to check if content is safe
 *
 * @param content - The content to check
 * @param trustLevel - The trust level of the content source (defaults to 'untrusted')
 * @returns true if content is safe, false otherwise
 */
export function isSafe(content: string, trustLevel: TrustLevel = 'untrusted'): boolean {
  return sanitize(content, trustLevel).safe;
}

import type { EventBus } from './event-bus.js';

/**
 * Checks the status of the WASM sanitizer module and emits an event if it is degraded.
 */
export function emitSanitizerMetrics(eventBus: EventBus): void {
  if (!wasmSanitizerInstance) {
    eventBus.emit('security:degraded', {
      reason: 'WASM Sanitizer failed to load, falling back to slower JS RegExp implementation',
      timestamp: new Date(),
    });
  }
}
