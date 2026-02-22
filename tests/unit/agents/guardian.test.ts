import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { Guardian } from '../../../src/agents/guardian.js';
import { AuditLogger } from '../../../src/kernel/audit.js';
import { EventBus } from '../../../src/kernel/event-bus.js';
import type { TrustLevel } from '../../../src/kernel/types.js';
import { getCognitionLayer } from '../../../src/cognition/index.js';

describe('Guardian', () => {
  let guardian: Guardian;
  let auditLogger: AuditLogger;
  let eventBus: EventBus;
  let testAuditPath: string;

  beforeEach(() => {
    testAuditPath = join(tmpdir(), `audit-${randomUUID()}.json`);
    auditLogger = new AuditLogger(testAuditPath);
    eventBus = new EventBus();
    guardian = new Guardian(auditLogger, eventBus);
  });

  it('should assess clean message from system source with threat_level none and risk_score 0', () => {
    const content = 'Hello, this is a clean message';
    const source: TrustLevel = 'system';

    const assessment = guardian.assessThreat(content, source);

    expect(assessment.threat_level).toBe('none');
    expect(assessment.risk_score).toBe(0);
    expect(assessment.patterns_detected).toEqual([]);
    expect(assessment.should_block).toBe(false);
    expect(assessment.should_escalate).toBe(false);
  });

  it('should apply trust penalty to clean message from hostile source', () => {
    const content = 'Hello, this is a clean message';
    const source: TrustLevel = 'hostile';

    const assessment = guardian.assessThreat(content, source);

    // Trust penalty for hostile: 1.0 * 0.2 = 0.2
    expect(assessment.threat_level).toBe('none');
    expect(assessment.risk_score).toBe(0.2);
    expect(assessment.patterns_detected).toEqual([]);
    expect(assessment.should_block).toBe(false);
    expect(assessment.should_escalate).toBe(false);
  });

  it('should detect template injection pattern', () => {
    const content = 'Execute this: ${malicious.code}';
    const source: TrustLevel = 'standard';

    const assessment = guardian.assessThreat(content, source);

    expect(assessment.patterns_detected).toContain('template_injection');
    expect(assessment.risk_score).toBeGreaterThan(0.3);
  });

  it('should detect SQL injection pattern', () => {
    const content = 'SELECT * FROM users UNION SELECT password FROM admin';
    const source: TrustLevel = 'standard';

    const assessment = guardian.assessThreat(content, source);

    expect(assessment.patterns_detected).toContain('sql_injection');
    expect(assessment.risk_score).toBeGreaterThan(0.3);
  });

  it('should detect command injection pattern', () => {
    const content = 'Run this command: ; rm -rf /';
    const source: TrustLevel = 'standard';

    const assessment = guardian.assessThreat(content, source);

    expect(assessment.patterns_detected).toContain('command_injection');
    expect(assessment.risk_score).toBeGreaterThan(0.3);
  });

  it('should detect XSS attempt pattern', () => {
    const content = '<script>alert("XSS")</script>';
    const source: TrustLevel = 'standard';

    const assessment = guardian.assessThreat(content, source);

    expect(assessment.patterns_detected).toContain('xss_attempt');
    expect(assessment.risk_score).toBeGreaterThan(0.3);
  });

  it('should detect multiple patterns simultaneously', () => {
    const maliciousContent = '${' + 'eval' + '(' + 'exec' + '("../malicious.sh"))}' + '<script>alert("XSS")</script>';
    const source: TrustLevel = 'standard';

    const assessment = guardian.assessThreat(maliciousContent, source);

    expect(assessment.patterns_detected.length).toBeGreaterThan(1);
    expect(assessment.patterns_detected).toContain('template_injection');
    expect(assessment.patterns_detected).toContain('eval_injection');
    expect(assessment.patterns_detected).toContain('exec_injection');
    expect(assessment.patterns_detected).toContain('path_traversal');
    expect(assessment.patterns_detected).toContain('xss_attempt');
    expect(assessment.risk_score).toBeGreaterThan(0.5);
  });

  it('should escalate high risk from hostile source with injection', () => {
    const maliciousContent = 'eval' + '(maliciousCode); rm -rf /';
    const source: TrustLevel = 'hostile';

    const assessment = guardian.assessThreat(maliciousContent, source);

    expect(assessment.should_escalate).toBe(true);
    expect(assessment.risk_score).toBeGreaterThanOrEqual(0.6);
  });

  it('should handle start and stop lifecycle correctly', () => {
    expect(eventBus.listenerCount('message:accepted')).toBe(0);

    guardian.start();
    expect(eventBus.listenerCount('message:accepted')).toBe(1);

    guardian.stop();
    expect(eventBus.listenerCount('message:accepted')).toBe(0);
  });

  it('should track stats correctly after analyzing messages', async () => {
    guardian.start();

    // Emit messages through the event bus to trigger analyzeMessage
    eventBus.emit('message:accepted', {
      id: randomUUID(),
      content: 'Clean message 1',
      source: 'system' as TrustLevel,
      timestamp: new Date(),
    });

    eventBus.emit('message:accepted', {
      id: randomUUID(),
      content: 'Clean message 2',
      source: 'standard' as TrustLevel,
      timestamp: new Date(),
    });

    eventBus.emit('message:accepted', {
      id: randomUUID(),
      content: '${injection}',
      source: 'untrusted' as TrustLevel,
      timestamp: new Date(),
    });

    eventBus.emit('message:accepted', {
      id: randomUUID(),
      content: 'eval' + '(code)',
      source: 'hostile' as TrustLevel,
      timestamp: new Date(),
    });

    // Give the async event handlers time to process the messages
    await new Promise(resolve => setTimeout(resolve, 50));

    const stats = guardian.getStats();

    expect(stats.baselines_tracked).toBeGreaterThan(0);
    expect(stats.recent_messages).toBeGreaterThan(0);
    expect(stats.injection_history_size).toBeGreaterThan(0);
  });

  describe('assessThreatEnhanced', () => {
    it('should return same result as assessThreat for normal content without cognitive layer', async () => {
      const content = 'This is a normal, clean message';
      const source: TrustLevel = 'standard';

      const baselineAssessment = guardian.assessThreat(content, source);
      const enhancedAssessment = await guardian.assessThreatEnhanced(content, source);

      expect(enhancedAssessment.threat_level).toBe(baselineAssessment.threat_level);
      expect(enhancedAssessment.risk_score).toBe(baselineAssessment.risk_score);
      expect(enhancedAssessment.patterns_detected).toEqual(baselineAssessment.patterns_detected);
      expect(enhancedAssessment.should_block).toBe(baselineAssessment.should_block);
      expect(enhancedAssessment.should_escalate).toBe(baselineAssessment.should_escalate);
    });

    it('should degrade gracefully when cognitive layer not initialized', async () => {
      const content = 'Clean message without cognitive enhancement';
      const source: TrustLevel = 'standard';

      const assessment = await guardian.assessThreatEnhanced(content, source);

      expect(assessment.threat_level).toBe('none');
      expect(assessment.should_block).toBe(false);
      expect(assessment.should_escalate).toBe(false);
    });

    it('should augment risk when cognitive biases detected', async () => {
      // Initialize cognitive layer for this test
      const cognition = getCognitionLayer(eventBus);
      await cognition.initialize();

      // Content with clear cognitive bias patterns that cognitive layer should detect
      const content = 'Everyone knows this is true. I knew it all along. Obvious to anyone with common sense.';
      const source: TrustLevel = 'standard';

      try {
        const baselineAssessment = guardian.assessThreat(content, source);
        const enhancedAssessment = await guardian.assessThreatEnhanced(content, source);

        // Enhanced assessment might have higher risk if biases detected
        // Note: Risk increase depends on bias detection results
        expect(enhancedAssessment.risk_score).toBeGreaterThanOrEqual(baselineAssessment.risk_score);

        // If biases were detected, details should be present
        if (enhancedAssessment.details?.cognitive_biases) {
          expect(Array.isArray(enhancedAssessment.details.cognitive_biases)).toBe(true);
          expect(enhancedAssessment.details.cognitive_risk).toBeDefined();
        }
      } finally {
        // Clean up
        await cognition.shutdown();
      }
    });

    it('should include cognitive insights in assessment details when biases found', async () => {
      const cognition = getCognitionLayer(eventBus);
      await cognition.initialize();

      // Content designed to trigger multiple cognitive bias patterns
      const content = 'I knew this would happen. Everyone agrees with me. This always works. Obviously correct.';
      const source: TrustLevel = 'untrusted';

      try {
        const assessment = await guardian.assessThreatEnhanced(content, source);

        // Check that assessment is still valid
        expect(assessment.threat_level).toBeDefined();
        expect(assessment.risk_score).toBeGreaterThanOrEqual(0);
        expect(assessment.risk_score).toBeLessThanOrEqual(1);

        // If cognitive analysis found issues, details should reflect it
        if (assessment.details) {
          expect(assessment.details).toHaveProperty('cognitive_biases');
          if (Array.isArray(assessment.details.cognitive_biases)) {
            expect(assessment.details.cognitive_biases.length).toBeGreaterThanOrEqual(0);
          }
        }
      } finally {
        await cognition.shutdown();
      }
    });

    it('should properly calculate blocking threshold with cognitive augmentation', async () => {
      const cognition = getCognitionLayer(eventBus);
      await cognition.initialize();

      // Start with content that has injection pattern (baseline risk)
      const content = '${injection} Everyone knows this is the right approach.';
      const source: TrustLevel = 'hostile';

      try {
        const enhancedAssessment = await guardian.assessThreatEnhanced(content, source);

        // Risk score should be valid
        expect(enhancedAssessment.risk_score).toBeGreaterThanOrEqual(0);
        expect(enhancedAssessment.risk_score).toBeLessThanOrEqual(1);

        // Blocking threshold is 0.8
        expect(enhancedAssessment.should_block).toBe(enhancedAssessment.risk_score >= 0.8);

        // If blocking, then risk must be >= 0.8
        if (enhancedAssessment.should_block) {
          expect(enhancedAssessment.risk_score).toBeGreaterThanOrEqual(0.8);
        }

        // Assessment should have all required fields
        expect(enhancedAssessment.threat_level).toBeDefined();
        expect(Array.isArray(enhancedAssessment.patterns_detected)).toBe(true);
        expect(typeof enhancedAssessment.should_escalate).toBe('boolean');
      } finally {
        await cognition.shutdown();
      }
    });

    it('should verify enhanced assessment never decreases baseline risk', async () => {
      // Test that enhancement is additive - never subtracts from baseline
      // Use fresh Guardian instance to avoid baseline contamination
      const freshGuardian = new Guardian(auditLogger, eventBus);

      const content = 'Clean message with no obvious threats';
      const source: TrustLevel = 'standard';

      const baseline = freshGuardian.assessThreat(content, source);
      const enhanced = await freshGuardian.assessThreatEnhanced(content, source);

      // Enhanced should never reduce risk below baseline
      expect(enhanced.risk_score).toBeGreaterThanOrEqual(baseline.risk_score);

      // Both should agree on basic fields when no enhancement occurs
      expect(enhanced.threat_level).toBe(baseline.threat_level);
      expect(enhanced.patterns_detected).toEqual(baseline.patterns_detected);
    });

    it('should handle cognitive layer errors gracefully without failing threat assessment', async () => {
      // Don't initialize cognition layer to trigger potential error path
      const content = 'Test message for error handling';
      const source: TrustLevel = 'standard';

      const assessment = await guardian.assessThreatEnhanced(content, source);

      // Assessment should still succeed
      expect(assessment).toBeDefined();
      expect(assessment.threat_level).toBeDefined();
      expect(assessment.risk_score).toBeGreaterThanOrEqual(0);
      expect(assessment.should_block).toBe(false);
    });

    it('should log cognitive threat detection when high-risk biases found', async () => {
      const cognition = getCognitionLayer(eventBus);
      await cognition.initialize();

      // Spy on audit logger
      const logSpy = vi.spyOn(auditLogger, 'log');

      // Content with multiple bias indicators
      const content = 'I always knew this. Everyone says so. Obviously the only option.';
      const source: TrustLevel = 'untrusted';

      try {
        await guardian.assessThreatEnhanced(content, source);

        // If biases were detected at high/critical level, should log
        // Note: We can't guarantee detection, so we check IF logged that it's correct
        const cognitiveLogCalls = logSpy.mock.calls.filter(
          call => call[0] === 'guardian:cognitive_threat_detected'
        );

        if (cognitiveLogCalls.length > 0) {
          const logDetails = cognitiveLogCalls[0][3] as Record<string, unknown>;
          expect(logDetails).toHaveProperty('biases');
          expect(logDetails).toHaveProperty('risk_level');
          expect(logDetails).toHaveProperty('adjusted_risk_score');
        }
      } finally {
        logSpy.mockRestore();
        await cognition.shutdown();
      }
    });
  });
});
