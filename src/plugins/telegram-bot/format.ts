/**
 * Markdown to Telegram HTML Converter
 *
 * Converts markdown formatting to Telegram-compatible HTML.
 * Handles nested formatting, edge cases, and message splitting.
 */

const TELEGRAM_MAX_LENGTH = 4096;

/**
 * HTML entities that need escaping in Telegram messages.
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};

/**
 * Check if text already contains HTML tags.
 */
export function isAlreadyHtml(text: string): boolean {
  const htmlTagPattern = /<\/?(?:b|i|code|pre|a|s|u|strike|tg-spoiler|tg-emoji)\b[^>]*>/i;
  return htmlTagPattern.test(text);
}

/**
 * Escape HTML entities in plain text.
 */
function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, (char) => HTML_ENTITIES[char] || char);
}

interface LinkData {
  text: string;
  url: string;
}

/**
 * Convert markdown to Telegram HTML.
 */
export function markdownToTelegramHtml(markdown: string): string {
  if (!markdown || markdown.trim() === '') {
    return markdown;
  }

  // If already HTML, return as-is
  if (isAlreadyHtml(markdown)) {
    return markdown;
  }

  let html = markdown;

  // Store protected content temporarily
  const codeBlocks: string[] = [];
  const inlineCode: string[] = [];
  const links: LinkData[] = [];

  // Protect triple-backtick code blocks (use null char to avoid markdown conflicts)
  // Use [\s\S] instead of . with s flag for better compatibility
  html = html.replace(/```([\s\S]+?)```/g, (_match: string, code: string) => {
    const placeholder = `\x00CODEBLOCK_${codeBlocks.length}\x00`;
    codeBlocks.push(code.trim());
    return placeholder;
  });

  // Protect inline code (use unique delimiters that won't be caught by markdown)
  html = html.replace(/`([^`]+?)`/g, (_match: string, code: string) => {
    const placeholder = `\x00INLINECODE_${inlineCode.length}\x00`;
    inlineCode.push(code);
    return placeholder;
  });

  // Protect links [text](url) (use unique delimiters)
  html = html.replace(/\[([^\]]+?)\]\(([^)]+?)\)/g, (_match: string, text: string, url: string) => {
    const placeholder = `\x00LINK_${links.length}\x00`;
    links.push({ text, url });
    return placeholder;
  });

  // Convert strikethrough ~~text~~
  html = html.replace(/~~([^~]+?)~~/g, '<s>$1</s>');

  // Convert bold FIRST (longer markers, avoid placeholders)
  // Use [^\x00] to exclude placeholders but allow everything else including tags
  /* eslint-disable no-control-regex */
  html = html.replace(/\*\*([^\x00]+?)\*\*/g, '<b>$1</b>');
  html = html.replace(/__([^\x00]+?)__/g, '<b>$1</b>');

  // Convert italic AFTER bold (shorter markers)
  html = html.replace(/\*([^\x00]+?)\*/g, '<i>$1</i>');
  html = html.replace(/(?<!_)_([^\x00]+?)_(?!_)/g, '<i>$1</i>');
  /* eslint-enable no-control-regex */

  // Convert headings to bold (Telegram doesn't have heading tags)
  html = html.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>');

  // Convert unordered list items
  html = html.replace(/^[-*+]\s+(.+)$/gm, '• $1');

  // Numbered lists - keep as-is

  // Now escape HTML entities in the plain text parts
  html = escapeHtmlInText(html);

  // Restore links with escaped content
  links.forEach((linkData, i) => {
    const escapedText = escapeHtml(linkData.text);
    const escapedUrl = escapeHtml(linkData.url);
    html = html.replace(`\x00LINK_${i}\x00`, `<a href="${escapedUrl}">${escapedText}</a>`);
  });

  // Restore code blocks with escaped content
  codeBlocks.forEach((code, i) => {
    const escapedCode = escapeHtml(code);
    html = html.replace(`\x00CODEBLOCK_${i}\x00`, `<pre>${escapedCode}</pre>`);
  });

  // Restore inline code with escaped content
  inlineCode.forEach((code, i) => {
    const escapedCode = escapeHtml(code);
    html = html.replace(`\x00INLINECODE_${i}\x00`, `<code>${escapedCode}</code>`);
  });

  return html;
}

/**
 * Escape HTML entities in text while preserving HTML tags.
 */
function escapeHtmlInText(html: string): string {
  const parts: string[] = [];
  let lastIndex = 0;
  const tagRegex = /<\/?[a-z][^>]*>/gi;

  const matches = Array.from(html.matchAll(tagRegex));

  for (const match of matches) {
    // Add escaped text before tag
    if (match.index !== undefined && match.index > lastIndex) {
      const textBefore = html.substring(lastIndex, match.index);
      parts.push(escapeHtml(textBefore));
    }
    // Add tag as-is
    parts.push(match[0]);
    lastIndex = (match.index || 0) + match[0].length;
  }

  // Add remaining text
  if (lastIndex < html.length) {
    parts.push(escapeHtml(html.substring(lastIndex)));
  }

  return parts.join('');
}

/**
 * Split a long message into chunks that fit Telegram's character limit.
 * Tries to split on paragraph boundaries for better readability.
 */
export function splitTelegramMessage(
  html: string,
  maxLength: number = TELEGRAM_MAX_LENGTH
): string[] {
  // Handle empty/whitespace strings
  const trimmed = html.trim();
  if (!trimmed) {
    return [''];
  }

  if (html.length <= maxLength) {
    return [html];
  }

  const chunks: string[] = [];
  let currentChunk = '';

  // Split on double newlines (paragraphs) first
  const paragraphs = html.split(/\n\n+/);

  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed the limit
    if (currentChunk.length + paragraph.length + 2 > maxLength) {
      // If current chunk has content, save it
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }

      // If single paragraph is too long, split it by sentences or words
      if (paragraph.length > maxLength) {
        const subChunks = splitLongParagraph(paragraph, maxLength);
        chunks.push(...subChunks.slice(0, -1));
        currentChunk = subChunks[subChunks.length - 1];
      } else {
        currentChunk = paragraph;
      }
    } else {
      // Add paragraph to current chunk
      if (currentChunk) {
        currentChunk += '\n\n' + paragraph;
      } else {
        currentChunk = paragraph;
      }
    }
  }

  // Add remaining chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [''];
}

/**
 * Split a single long paragraph into smaller chunks.
 * Tries to split on sentence boundaries, then word boundaries.
 */
function splitLongParagraph(paragraph: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let currentChunk = '';

  // Try splitting by sentences
  const sentences = paragraph.split(/([.!?]+\s+)/);

  for (const part of sentences) {
    if (currentChunk.length + part.length > maxLength) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }

      // If single part is still too long, split by words
      if (part.length > maxLength) {
        const words = part.split(/(\s+)/);
        for (const word of words) {
          if (currentChunk.length + word.length > maxLength) {
            if (currentChunk.trim()) {
              chunks.push(currentChunk.trim());
            }
            // Hard cut: if a single word exceeds maxLength, slice it
            if (word.length > maxLength) {
              for (let i = 0; i < word.length; i += maxLength) {
                const slice = word.slice(i, i + maxLength);
                if (i + maxLength < word.length) {
                  chunks.push(slice);
                } else {
                  currentChunk = slice;
                }
              }
            } else {
              currentChunk = word;
            }
          } else {
            currentChunk += word;
          }
        }
      } else {
        currentChunk = part;
      }
    } else {
      currentChunk += part;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [''];
}

/**
 * Main entry point: detect format, convert if needed, and return Telegram HTML.
 */
export function formatForTelegram(text: string): string {
  if (!text || text.trim() === '') {
    return text;
  }

  // If already HTML, return as-is
  if (isAlreadyHtml(text)) {
    return text;
  }

  // Convert markdown to HTML
  return markdownToTelegramHtml(text);
}
