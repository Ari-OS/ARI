import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { AutonomyDial } from '../../../src/autonomous/autonomy-dial.js';
import type { AutonomyLevel, AutonomyConfig } from '../../../src/autonomous/autonomy-dial.js';
import { assessConfidence, formatConfidence } from '../../../src/autonomous/confidence-signals.js';
import type { ConfidenceSignal } from '../../../src/autonomous/confidence-signals.js';

describe('AutonomyDial', () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'ari-autonomy-test-'));
    configPath = join(tmpDir, 'autonomy.json');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('default levels', () => {
    it('should initialize with correct default levels', () => {
      const dial = new AutonomyDial(configPath);
      expect(dial.getLevel('publishing')).toBe('draft');
      expect(dial.getLevel('financial')).toBe('suggest');
      expect(dial.getLevel('notifications')).toBe('execute');
      expect(dial.getLevel('tasks')).toBe('execute');
      expect(dial.getLevel('research')).toBe('full');
      expect(dial.getLevel('security')).toBe('execute');
      expect(dial.getLevel('briefings')).toBe('full');
      expect(dial.getLevel('content')).toBe('draft');
    });

    it('should have 8 default categories', () => {
      const dial = new AutonomyDial(configPath);
      expect(dial.getAll()).toHaveLength(8);
    });
  });

  describe('getLevel', () => {
    it('should return configured level for known category', () => {
      const dial = new AutonomyDial(configPath);
      expect(dial.getLevel('research')).toBe('full');
    });

    it('should return monitor for unknown category', () => {
      const dial = new AutonomyDial(configPath);
      expect(dial.getLevel('unknown-category')).toBe('monitor');
    });
  });

  describe('setLevel', () => {
    it('should update the level for an existing category', () => {
      const dial = new AutonomyDial(configPath);
      dial.setLevel('publishing', 'execute');
      expect(dial.getLevel('publishing')).toBe('execute');
    });

    it('should create a new category if it does not exist', () => {
      const dial = new AutonomyDial(configPath);
      dial.setLevel('custom-ops', 'suggest');
      expect(dial.getLevel('custom-ops')).toBe('suggest');
    });

    it('should persist the change to disk', () => {
      const dial = new AutonomyDial(configPath);
      dial.setLevel('publishing', 'full');

      // Load fresh instance from same file
      const dial2 = new AutonomyDial(configPath);
      expect(dial2.getLevel('publishing')).toBe('full');
    });
  });

  describe('canProceed', () => {
    it('should return true for execute level', () => {
      const dial = new AutonomyDial(configPath);
      expect(dial.canProceed('notifications')).toBe(true);
    });

    it('should return true for full level', () => {
      const dial = new AutonomyDial(configPath);
      expect(dial.canProceed('research')).toBe(true);
    });

    it('should return false for monitor level', () => {
      const dial = new AutonomyDial(configPath);
      dial.setLevel('test-cat', 'monitor');
      expect(dial.canProceed('test-cat')).toBe(false);
    });

    it('should return false for suggest level', () => {
      const dial = new AutonomyDial(configPath);
      expect(dial.canProceed('financial')).toBe(false);
    });

    it('should return false for draft level', () => {
      const dial = new AutonomyDial(configPath);
      expect(dial.canProceed('publishing')).toBe(false);
    });

    it('should return false for unknown categories (defaults to monitor)', () => {
      const dial = new AutonomyDial(configPath);
      expect(dial.canProceed('nonexistent')).toBe(false);
    });
  });

  describe('resetDefaults', () => {
    it('should restore original default configuration', () => {
      const dial = new AutonomyDial(configPath);

      // Modify several levels
      dial.setLevel('publishing', 'full');
      dial.setLevel('financial', 'execute');
      dial.setLevel('custom', 'draft');

      // Reset
      dial.resetDefaults();

      expect(dial.getLevel('publishing')).toBe('draft');
      expect(dial.getLevel('financial')).toBe('suggest');
      expect(dial.getLevel('custom')).toBe('monitor'); // custom removed
      expect(dial.getAll()).toHaveLength(8);
    });
  });

  describe('getAll', () => {
    it('should return all configured categories', () => {
      const dial = new AutonomyDial(configPath);
      const all = dial.getAll();

      expect(all).toHaveLength(8);
      const categories = all.map((c: AutonomyConfig) => c.category);
      expect(categories).toContain('publishing');
      expect(categories).toContain('financial');
      expect(categories).toContain('notifications');
      expect(categories).toContain('tasks');
      expect(categories).toContain('research');
      expect(categories).toContain('security');
      expect(categories).toContain('briefings');
      expect(categories).toContain('content');
    });

    it('should include description and requiresApproval', () => {
      const dial = new AutonomyDial(configPath);
      const all = dial.getAll();

      const financial = all.find((c: AutonomyConfig) => c.category === 'financial');
      expect(financial).toBeDefined();
      expect(financial!.description).toContain('Recommend');
      expect(financial!.requiresApproval).toBe(true);

      const research = all.find((c: AutonomyConfig) => c.category === 'research');
      expect(research).toBeDefined();
      expect(research!.requiresApproval).toBe(false);
    });
  });

  describe('persistence', () => {
    it('should write valid JSON to disk', () => {
      const dial = new AutonomyDial(configPath);
      expect(existsSync(configPath)).toBe(true);

      const raw = readFileSync(configPath, 'utf-8');
      const data = JSON.parse(raw);
      expect(data.configs).toBeInstanceOf(Array);
      expect(data.configs).toHaveLength(8);
      expect(data.updatedAt).toBeDefined();
    });

    it('should survive round-trip through disk', () => {
      const dial = new AutonomyDial(configPath);
      dial.setLevel('publishing', 'execute');
      dial.setLevel('custom-new', 'suggest');

      const dial2 = new AutonomyDial(configPath);
      expect(dial2.getLevel('publishing')).toBe('execute');
      expect(dial2.getLevel('custom-new')).toBe('suggest');
      expect(dial2.getAll().length).toBe(9); // 8 defaults + 1 custom
    });

    it('should reset to defaults on corrupted file', () => {
      // Write garbage to the config path
      writeFileSync(configPath, 'NOT VALID JSON {{{', 'utf-8');

      const dial = new AutonomyDial(configPath);
      expect(dial.getAll()).toHaveLength(8);
      expect(dial.getLevel('publishing')).toBe('draft');
    });
  });

  describe('compareLevel', () => {
    it('should order levels correctly', () => {
      expect(AutonomyDial.compareLevel('monitor', 'full')).toBeLessThan(0);
      expect(AutonomyDial.compareLevel('full', 'monitor')).toBeGreaterThan(0);
      expect(AutonomyDial.compareLevel('execute', 'execute')).toBe(0);
      expect(AutonomyDial.compareLevel('suggest', 'draft')).toBeLessThan(0);
    });
  });
});

describe('ConfidenceSignals', () => {
  describe('assessConfidence', () => {
    it('should return high confidence for fresh, reliable, multi-source data', () => {
      const signal = assessConfidence({
        dataAge: 2 * 60 * 1000,       // 2 minutes
        sourceReliability: 0.95,
        hasMultipleSources: true,
        sourceName: 'CoinGecko',
      });

      expect(signal.level).toBe('high');
      expect(signal.icon).toBe('\u{1F7E2}');
      expect(signal.message).toContain('CoinGecko');
      expect(signal.source).toBe('CoinGecko');
    });

    it('should return medium confidence for moderately fresh data', () => {
      const signal = assessConfidence({
        dataAge: 30 * 60 * 1000,       // 30 minutes
        sourceReliability: 0.7,
        hasMultipleSources: false,
        sourceName: 'RSS Feed',
      });

      expect(signal.level).toBe('medium');
      expect(signal.icon).toBe('\u{1F7E1}');
      expect(signal.message).toContain('ago');
    });

    it('should return low confidence for stale data', () => {
      const signal = assessConfidence({
        dataAge: 2 * 60 * 60 * 1000,  // 2 hours
        sourceReliability: 0.9,
        hasMultipleSources: true,
        sourceName: 'Weather API',
      });

      expect(signal.level).toBe('low');
      expect(signal.icon).toBe('\u{1F534}');
      expect(signal.message).toContain('verify');
    });

    it('should return low confidence for unreliable source even if fresh', () => {
      const signal = assessConfidence({
        dataAge: 1 * 60 * 1000,        // 1 minute
        sourceReliability: 0.3,
        hasMultipleSources: false,
      });

      expect(signal.level).toBe('low');
    });

    it('should return medium when fresh but single source', () => {
      const signal = assessConfidence({
        dataAge: 3 * 60 * 1000,        // 3 minutes
        sourceReliability: 0.9,
        hasMultipleSources: false,
        sourceName: 'Alpha Vantage',
      });

      // Single source prevents high even though data is fresh + reliable
      expect(signal.level).toBe('medium');
    });

    it('should default source name to unknown source', () => {
      const signal = assessConfidence({
        dataAge: 100,
        sourceReliability: 0.99,
        hasMultipleSources: true,
      });

      expect(signal.source).toBe('unknown source');
    });
  });

  describe('formatConfidence', () => {
    it('should format high confidence signal', () => {
      const signal: ConfidenceSignal = {
        level: 'high',
        icon: '\u{1F7E2}',
        source: 'CoinGecko',
        freshness: '2 min ago',
        message: 'from CoinGecko 2 min ago',
      };

      const formatted = formatConfidence(signal);
      expect(formatted).toBe('\u{1F7E2} from CoinGecko 2 min ago');
    });

    it('should format low confidence signal', () => {
      const signal: ConfidenceSignal = {
        level: 'low',
        icon: '\u{1F534}',
        source: 'stale API',
        freshness: '3h ago',
        message: "I'm not sure \u2014 want me to verify?",
      };

      const formatted = formatConfidence(signal);
      expect(formatted).toContain('\u{1F534}');
      expect(formatted).toContain('verify');
    });

    it('should produce a single-line string', () => {
      const signal = assessConfidence({
        dataAge: 15 * 60 * 1000,
        sourceReliability: 0.6,
        hasMultipleSources: true,
        sourceName: 'Test',
      });

      const formatted = formatConfidence(signal);
      expect(formatted).not.toContain('\n');
    });
  });
});
