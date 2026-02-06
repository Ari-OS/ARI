/**
 * Cognitive CLI Tests
 *
 * Tests the cognitive command-line interface for the Layer 0 cognitive architecture.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerCognitiveCommand } from '../../../src/cli/commands/cognitive.js';

describe('Cognitive CLI', () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    program.exitOverride(); // Prevent process.exit
    registerCognitiveCommand(program);
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('cognitive status', () => {
    it('should display cognitive layer status', async () => {
      await program.parseAsync(['node', 'test', 'cognitive', 'status']);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('COGNITIVE LAYER STATUS');
      expect(output).toContain('LOGOS');
      expect(output).toContain('ETHOS');
      expect(output).toContain('PATHOS');
    });

    it('should output JSON when --json flag is used', async () => {
      await program.parseAsync(['node', 'test', 'cognitive', 'status', '--json']);

      expect(consoleSpy).toHaveBeenCalled();
      const jsonCall = consoleSpy.mock.calls.find(c => {
        try {
          JSON.parse(c[0]);
          return true;
        } catch {
          return false;
        }
      });
      expect(jsonCall).toBeDefined();
    });
  });

  describe('cognitive analyze', () => {
    it('should analyze text for biases and distortions', async () => {
      await program.parseAsync([
        'node', 'test', 'cognitive', 'analyze',
        'I always fail at everything'
      ]);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('COGNITIVE ANALYSIS');
      expect(output).toContain('Bias Detection');
      expect(output).toContain('CBT Reframe');
    });

    it('should output JSON when --json flag is used', async () => {
      await program.parseAsync([
        'node', 'test', 'cognitive', 'analyze',
        'Test text', '--json'
      ]);

      expect(consoleSpy).toHaveBeenCalled();
      const jsonCall = consoleSpy.mock.calls.find(c => {
        try {
          const parsed = JSON.parse(c[0]);
          return parsed.biasAnalysis && parsed.cbtReframe;
        } catch {
          return false;
        }
      });
      expect(jsonCall).toBeDefined();
    });
  });

  describe('cognitive wisdom', () => {
    it('should query wisdom traditions', async () => {
      await program.parseAsync([
        'node', 'test', 'cognitive', 'wisdom',
        'How should I handle uncertainty?'
      ]);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('WISDOM COUNCIL');
      expect(output).toContain('Principle');
      expect(output).toContain('Application');
    });

    it('should accept tradition filter', async () => {
      await program.parseAsync([
        'node', 'test', 'cognitive', 'wisdom',
        'Market volatility', '--tradition', 'STOIC'
      ]);

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('cognitive profile', () => {
    it('should report knowledge module removed', async () => {
      // Profile command was disabled when knowledge module was removed
      await expect(
        program.parseAsync(['node', 'test', 'cognitive', 'profile'])
      ).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalled();
      const output = errorSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('not available');
    });
  });

  describe('cognitive kelly', () => {
    it('should calculate Kelly fraction', async () => {
      await program.parseAsync([
        'node', 'test', 'cognitive', 'kelly',
        '-p', '0.6', '-w', '100', '-l', '50'
      ]);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('KELLY CRITERION');
      expect(output).toContain('Full Kelly');
      expect(output).toContain('Recommendation');
    });

    it('should calculate dollar amount with capital', async () => {
      await program.parseAsync([
        'node', 'test', 'cognitive', 'kelly',
        '-p', '0.6', '-w', '100', '-l', '50', '-c', '10000'
      ]);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('Dollar Amount');
    });
  });

  describe('cognitive bayesian', () => {
    it('should update belief probability', async () => {
      await program.parseAsync([
        'node', 'test', 'cognitive', 'bayesian',
        '-h', 'Investment will succeed',
        '-p', '0.5', '-r', '3'
      ]);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('BAYESIAN UPDATE');
      expect(output).toContain('Prior');
      expect(output).toContain('Posterior');
      expect(output).toContain('Shift');
    });

    it('should accept strength option', async () => {
      await program.parseAsync([
        'node', 'test', 'cognitive', 'bayesian',
        '-h', 'Test hypothesis',
        '-p', '0.5', '-r', '2', '-s', 'strong'
      ]);

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('cognitive decide', () => {
    it('should run full decision pipeline', async () => {
      await program.parseAsync([
        'node', 'test', 'cognitive', 'decide',
        'Buy AAPL stock'
      ]);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('Expected Value');
      expect(output).toContain('Discipline Check');
    });

    it('should accept custom outcomes JSON', async () => {
      const outcomes = JSON.stringify([
        { description: 'Win big', probability: 0.7, value: 200 },
        { description: 'Lose', probability: 0.3, value: -100 }
      ]);

      await program.parseAsync([
        'node', 'test', 'cognitive', 'decide',
        'Test decision', '--outcomes', outcomes
      ]);

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('alias', () => {
    it('should support cog alias', async () => {
      await program.parseAsync(['node', 'test', 'cog', 'status']);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('COGNITIVE LAYER STATUS');
    });
  });
});
