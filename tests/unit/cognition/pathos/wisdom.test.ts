import { describe, it, expect } from 'vitest';
import { queryWisdom } from '../../../../src/cognition/pathos/index.js';

describe('Wisdom Index', () => {
  describe('queryWisdom', () => {
    it('should return wisdom for a query', async () => {
      const result = await queryWisdom('How to handle uncertainty?');

      expect(result).toBeDefined();
      expect(result.principle).toBeDefined();
      expect(result.source).toBeDefined();
      expect(result.application).toBeDefined();
    });

    it('should return Stoic wisdom for control-related queries', async () => {
      const result = await queryWisdom(
        'How to accept things I cannot control?',
        ['STOIC']
      );

      expect(result.tradition).toBe('STOIC');
      expect(result.source.toLowerCase()).toMatch(/epictetus|marcus|seneca|stoic/i);
    });

    it('should return Taleb wisdom for antifragility queries', async () => {
      // Query with keywords that match TALEB principles
      const result = await queryWisdom(
        'How can I position myself to gain from volatility and antifragility?',
        ['TALEB']
      );

      expect(result.tradition).toBe('TALEB');
      expect(result.principle).toBeDefined();
    });

    it('should return Dalio wisdom for principle-based queries', async () => {
      const result = await queryWisdom(
        'How to make better decisions?',
        ['DALIO']
      );

      expect(result.tradition).toBe('DALIO');
    });

    it('should return Munger wisdom for mental model queries', async () => {
      const result = await queryWisdom(
        'How to think about complex problems?',
        ['MUNGER']
      );

      expect(result.tradition).toBe('MUNGER');
    });

    it('should include application suggestions', async () => {
      const result = await queryWisdom('How to stay disciplined?');

      expect(result.application).toBeDefined();
      expect(typeof result.application).toBe('string');
      expect(result.application.length).toBeGreaterThan(0);
    });

    it('should provide alternatives when available', async () => {
      const result = await queryWisdom('How to handle fear?');

      expect(result.alternatives).toBeDefined();
      expect(Array.isArray(result.alternatives)).toBe(true);
    });

    it('should include confidence score', async () => {
      const result = await queryWisdom('How to build good habits?');

      expect(result.confidence).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should include provenance information', async () => {
      const result = await queryWisdom('Test query');

      expect(result.provenance).toBeDefined();
      expect(result.provenance.text).toBeDefined();
      expect(result.provenance.indexedAt).toBeDefined();
    });

    it('should handle UNIVERSAL wisdom queries', async () => {
      const result = await queryWisdom(
        'What is the key to success?',
        ['UNIVERSAL']
      );

      expect(result).toBeDefined();
      expect(result.principle).toBeDefined();
    });

    it('should return quote when available', async () => {
      const result = await queryWisdom(
        'How to face adversity?',
        ['STOIC']
      );

      if (result.quote) {
        expect(typeof result.quote).toBe('string');
        expect(result.quote.length).toBeGreaterThan(0);
      }
    });

    it('should match wisdom to different queries', async () => {
      const tradingResult = await queryWisdom('How to manage trading risk?');
      const lifeResult = await queryWisdom('How to manage life decisions?');

      // Both should be valid but may differ in application
      expect(tradingResult.application).toBeDefined();
      expect(lifeResult.application).toBeDefined();
    });

    it('should return Naval wisdom for wealth/leverage queries', async () => {
      const result = await queryWisdom(
        'How to build wealth?',
        ['NAVAL']
      );

      expect(result.tradition).toBe('NAVAL');
    });

    it('should return Musashi wisdom for strategy queries', async () => {
      // Query with keywords that match MUSASHI principles
      const result = await queryWisdom(
        'How to think lightly of yourself and not be attached to ego?',
        ['MUSASHI']
      );

      expect(result.tradition).toBe('MUSASHI');
    });

    it('should return Meadows wisdom for systems queries', async () => {
      const result = await queryWisdom(
        'How to understand complex systems?',
        ['MEADOWS']
      );

      expect(result.tradition).toBe('MEADOWS');
    });

    it('should handle wisdom query without traditions', async () => {
      const result = await queryWisdom('How to be wise?');

      expect(result).toBeDefined();
      expect(result.principle).toBeDefined();
    });
  });
});
