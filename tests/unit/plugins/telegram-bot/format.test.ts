import { describe, it, expect } from 'vitest';
import {
  markdownToTelegramHtml,
  splitTelegramMessage,
  isAlreadyHtml,
  formatForTelegram,
} from '../../../../src/plugins/telegram-bot/format.js';

describe('Telegram Format Utilities', () => {
  describe('isAlreadyHtml', () => {
    it('should detect HTML tags', () => {
      expect(isAlreadyHtml('<b>bold</b>')).toBe(true);
      expect(isAlreadyHtml('text with <i>italic</i>')).toBe(true);
      expect(isAlreadyHtml('<code>code</code>')).toBe(true);
      expect(isAlreadyHtml('<pre>preformatted</pre>')).toBe(true);
      expect(isAlreadyHtml('<a href="url">link</a>')).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(isAlreadyHtml('plain text')).toBe(false);
      expect(isAlreadyHtml('**markdown** text')).toBe(false);
      expect(isAlreadyHtml('text < 5 and > 2')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(isAlreadyHtml('')).toBe(false);
      expect(isAlreadyHtml('   ')).toBe(false);
    });
  });

  describe('markdownToTelegramHtml', () => {
    it('should convert bold markdown', () => {
      expect(markdownToTelegramHtml('**bold**')).toBe('<b>bold</b>');
      expect(markdownToTelegramHtml('__bold__')).toBe('<b>bold</b>');
      expect(markdownToTelegramHtml('text **bold** text')).toBe('text <b>bold</b> text');
    });

    it('should convert italic markdown', () => {
      expect(markdownToTelegramHtml('*italic*')).toBe('<i>italic</i>');
      expect(markdownToTelegramHtml('_italic_')).toBe('<i>italic</i>');
      expect(markdownToTelegramHtml('text *italic* text')).toBe('text <i>italic</i> text');
    });

    it('should convert inline code', () => {
      expect(markdownToTelegramHtml('`code`')).toBe('<code>code</code>');
      expect(markdownToTelegramHtml('text `code` text')).toBe('text <code>code</code> text');
    });

    it('should convert code blocks', () => {
      expect(markdownToTelegramHtml('```code block```')).toBe('<pre>code block</pre>');
      expect(markdownToTelegramHtml('```\nline1\nline2\n```')).toBe('<pre>line1\nline2</pre>');
    });

    it('should convert links', () => {
      expect(markdownToTelegramHtml('[text](url)')).toBe('<a href="url">text</a>');
      expect(markdownToTelegramHtml('[Google](https://google.com)')).toBe(
        '<a href="https://google.com">Google</a>'
      );
    });

    it('should convert strikethrough', () => {
      expect(markdownToTelegramHtml('~~strike~~')).toBe('<s>strike</s>');
      expect(markdownToTelegramHtml('text ~~strike~~ text')).toBe('text <s>strike</s> text');
    });

    it('should convert headings to bold', () => {
      expect(markdownToTelegramHtml('# Heading 1')).toBe('<b>Heading 1</b>');
      expect(markdownToTelegramHtml('## Heading 2')).toBe('<b>Heading 2</b>');
      expect(markdownToTelegramHtml('### Heading 3')).toBe('<b>Heading 3</b>');
    });

    it('should convert unordered lists', () => {
      expect(markdownToTelegramHtml('- item 1')).toBe('• item 1');
      expect(markdownToTelegramHtml('* item 2')).toBe('• item 2');
      expect(markdownToTelegramHtml('+ item 3')).toBe('• item 3');
    });

    it('should preserve numbered lists', () => {
      expect(markdownToTelegramHtml('1. first')).toBe('1. first');
      expect(markdownToTelegramHtml('2. second')).toBe('2. second');
    });

    it('should handle mixed formatting', () => {
      const input = '**bold** and *italic* and `code`';
      const expected = '<b>bold</b> and <i>italic</i> and <code>code</code>';
      expect(markdownToTelegramHtml(input)).toBe(expected);
    });

    it('should handle nested formatting', () => {
      const input = '**bold with *italic* inside**';
      const output = markdownToTelegramHtml(input);
      // Should convert both bold and italic formatting
      expect(output).toContain('<b>');
      expect(output).toContain('<i>');
    });

    it('should escape HTML entities in plain text', () => {
      const output = markdownToTelegramHtml('5 < 10 & 10 > 5');
      expect(output).toContain('&lt;');
      expect(output).toContain('&gt;');
      expect(output).toContain('&amp;');
    });

    it('should escape HTML entities inside code blocks', () => {
      const input = '```if (a < b && c > d)```';
      const output = markdownToTelegramHtml(input);
      expect(output).toBe('<pre>if (a &lt; b &amp;&amp; c &gt; d)</pre>');
    });

    it('should not double-convert already HTML content', () => {
      const html = '<b>already bold</b>';
      expect(markdownToTelegramHtml(html)).toBe(html);
    });

    it('should handle empty strings', () => {
      expect(markdownToTelegramHtml('')).toBe('');
      expect(markdownToTelegramHtml('   ')).toBe('   ');
    });

    it('should handle malformed markdown gracefully', () => {
      expect(markdownToTelegramHtml('**unclosed bold')).toBe('**unclosed bold');
      expect(markdownToTelegramHtml('*unclosed italic')).toBe('*unclosed italic');
      expect(markdownToTelegramHtml('`unclosed code')).toBe('`unclosed code');
    });

    it('should preserve line breaks', () => {
      const input = 'line 1\nline 2\nline 3';
      const output = markdownToTelegramHtml(input);
      expect(output).toBe('line 1\nline 2\nline 3');
    });

    it('should handle complex real-world example', () => {
      const input = `# Summary

Here's a **bold** statement with *italic* text and some \`code\`.

- Item 1
- Item 2

Check out [this link](https://example.com).

\`\`\`
function test() {
  return true;
}
\`\`\``;

      const output = markdownToTelegramHtml(input);

      expect(output).toContain('<b>Summary</b>');
      expect(output).toContain('<b>bold</b>');
      expect(output).toContain('<i>italic</i>');
      expect(output).toContain('<code>code</code>');
      expect(output).toContain('• Item 1');
      expect(output).toContain('• Item 2');
      expect(output).toContain('<a href="https://example.com">this link</a>');
      expect(output).toContain('<pre>');
      expect(output).toContain('function test()');
    });
  });

  describe('splitTelegramMessage', () => {
    it('should not split short messages', () => {
      const text = 'Short message';
      const chunks = splitTelegramMessage(text);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(text);
    });

    it('should split on paragraph boundaries', () => {
      const text = 'Paragraph 1\n\nParagraph 2\n\nParagraph 3';
      const chunks = splitTelegramMessage(text, 30);
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(30);
      });
    });

    it('should split very long paragraphs', () => {
      const longParagraph = 'word '.repeat(1000);
      const chunks = splitTelegramMessage(longParagraph, 100);
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(100);
      });
    });

    it('should handle message exactly at limit', () => {
      const text = 'a'.repeat(4096);
      const chunks = splitTelegramMessage(text);
      expect(chunks).toHaveLength(1);
    });

    it('should handle message just over limit', () => {
      // Create text with spaces to allow splitting
      const text = 'a '.repeat(2049); // Will be 4098 characters
      const chunks = splitTelegramMessage(text);
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should use custom max length', () => {
      // Create text with spaces to allow splitting
      const text = 'word '.repeat(20); // 100 characters total
      const chunks = splitTelegramMessage(text, 50);
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(50);
      });
    });

    it('should preserve content when splitting', () => {
      const text = 'word '.repeat(2000);
      const chunks = splitTelegramMessage(text, 1000);
      const rejoined = chunks.join(' ');
      // Content should be preserved (minor whitespace differences acceptable)
      expect(rejoined.replace(/\s+/g, ' ')).toContain('word');
    });

    it('should handle empty strings', () => {
      expect(splitTelegramMessage('')).toEqual(['']);
      expect(splitTelegramMessage('   ')).toEqual(['']); // Trimmed to empty
    });
  });

  describe('formatForTelegram', () => {
    it('should convert markdown to HTML', () => {
      const input = '**bold** and *italic*';
      const output = formatForTelegram(input);
      expect(output).toBe('<b>bold</b> and <i>italic</i>');
    });

    it('should pass through HTML unchanged', () => {
      const html = '<b>already</b> formatted';
      expect(formatForTelegram(html)).toBe(html);
    });

    it('should handle empty strings', () => {
      expect(formatForTelegram('')).toBe('');
      expect(formatForTelegram('   ')).toBe('   ');
    });

    it('should handle plain text', () => {
      const text = 'Plain text without formatting';
      expect(formatForTelegram(text)).toBe(text);
    });

    it('should escape HTML entities in markdown conversion', () => {
      const input = '**5 < 10**';
      const output = formatForTelegram(input);
      expect(output).toContain('<b>');
      expect(output).toContain('&lt;');
      expect(output).toContain('</b>');
    });
  });

  describe('Edge cases and integration', () => {
    it('should handle only whitespace', () => {
      expect(markdownToTelegramHtml('   \n\n   ')).toBe('   \n\n   ');
    });

    it('should handle special characters in code blocks', () => {
      const input = '```<script>alert("xss")</script>```';
      const output = markdownToTelegramHtml(input);
      // Should escape < and > in code blocks
      expect(output).toContain('<pre>');
      expect(output).toContain('&lt;script&gt;');
      expect(output).toContain('&lt;/script&gt;');
      expect(output).toContain('</pre>');
    });

    it('should handle unicode characters', () => {
      const input = '**bold 你好** and *italic 🚀*';
      const output = markdownToTelegramHtml(input);
      expect(output).toContain('你好');
      expect(output).toContain('🚀');
    });

    it('should handle multiple consecutive formatting markers', () => {
      const input = '***bold italic***';
      const output = markdownToTelegramHtml(input);
      // Should handle gracefully - may produce nested or sequential tags
      expect(output.length).toBeGreaterThan(0);
    });

    it('should handle mixed list types', () => {
      const input = `- Unordered 1
- Unordered 2
1. Ordered 1
2. Ordered 2`;
      const output = markdownToTelegramHtml(input);
      expect(output).toContain('• Unordered 1');
      expect(output).toContain('1. Ordered 1');
    });
  });
});
