import { describe, it, expect } from 'vitest';
import { humanizeQuick } from '../../../../src/plugins/content-engine/humanizer.js';

describe('humanizeQuick', () => {
  it('strips "Certainly!" opener', () => {
    expect(humanizeQuick('Certainly! Here is the answer.')).toBe('Here is the answer.');
  });

  it('strips "Absolutely!" opener', () => {
    expect(humanizeQuick('Absolutely! Let me explain.')).toBe('Let me explain.');
  });

  it('strips "I\'d be happy to" opener', () => {
    expect(humanizeQuick("I'd be happy to help you with that.")).toBe('help you with that.');
  });

  it('strips sycophantic openers', () => {
    expect(humanizeQuick("That's a great question! The answer is 42.")).toBe('The answer is 42.');
  });

  it('strips "I hope this helps" closer', () => {
    expect(humanizeQuick('The answer is 42. I hope this helps!')).toBe('The answer is 42.');
  });

  it('strips "Let me know if you have any questions" closer', () => {
    const result = humanizeQuick('Here is the info. Let me know if you have any questions!');
    expect(result).toBe('Here is the info.');
  });

  it('strips "Feel free to ask" closer', () => {
    const result = humanizeQuick('Done. Feel free to ask more questions.');
    expect(result).toBe('Done.');
  });

  it('strips "As an AI" self-reference', () => {
    const result = humanizeQuick('As an AI language model, I can help you with that.');
    expect(result).toBe('I can help you with that.');
  });

  it('replaces "Utilize" with "use"', () => {
    expect(humanizeQuick('You should utilize this feature.')).toBe('You should use this feature.');
  });

  it('replaces "delve into" with "explore"', () => {
    expect(humanizeQuick("Let's delve into the problem.")).toBe("Let's explore the problem.");
  });

  it('replaces "Facilitate" with "help"', () => {
    expect(humanizeQuick('This will facilitate the process.')).toBe('This will help the process.');
  });

  it('preserves content without AI patterns', () => {
    const clean = 'BTC is at $68,400. Up 2% overnight. Fear & Greed: 72.';
    expect(humanizeQuick(clean)).toBe(clean);
  });

  it('handles multiple AI phrases in one message', () => {
    const msg = "Certainly! That's a great question! As an AI, I can explain. I hope this helps!";
    const result = humanizeQuick(msg);
    expect(result).not.toContain('Certainly');
    expect(result).not.toContain("great question");
    expect(result).not.toContain('As an AI');
    expect(result).not.toContain('I hope this helps');
  });

  it('cleans up whitespace from stripping', () => {
    const result = humanizeQuick('Certainly! \n\n\n The answer is 42.');
    expect(result).not.toMatch(/\n{3,}/);
  });

  it('strips "It\'s important to note that" hedge', () => {
    const result = humanizeQuick("It's important to note that BTC is volatile.");
    expect(result).toBe('BTC is volatile.');
  });
});
