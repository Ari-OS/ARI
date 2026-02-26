/**
 * ObsidianClient — read-only REST API client for Obsidian Local REST API plugin.
 *
 * ARI reads vault, Pryce writes vault. Agent-generated content NEVER enters
 * the vault — preserving integrity so pattern analysis reflects Pryce's thinking.
 *
 * Requires: Obsidian Local REST API plugin (coddingtonbear) at 127.0.0.1:27123
 * Environment:
 *   OBSIDIAN_BASE_URL   — default: http://127.0.0.1:27123
 *   OBSIDIAN_API_KEY    — from Local REST API plugin settings
 */

export type VaultFile = {
  path: string;
  basename: string;
  extension: string;
  stat: {
    ctime: number;
    mtime: number;
    size: number;
  };
  tags?: string[];
  frontmatter?: Record<string, unknown>;
};

export type VaultNote = {
  path: string;
  content: string;
  tags: string[];
  wikilinks: string[];
  frontmatter: Record<string, unknown>;
};

export type SearchResult = {
  filename: string;
  score: number;
  matches: Array<{ context: string; match: { start: number; end: number } }>;
};

export type ObsidianClientConfig = {
  baseUrl: string;
  apiKey: string;
};

export class ObsidianClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: ObsidianClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
  }

  private headers(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private async get(path: string): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, { headers: this.headers() });
  }

  /** Read a vault file by relative path. Returns null if not found. */
  async readFile(filePath: string): Promise<string | null> {
    const encoded = filePath.split('/').map(encodeURIComponent).join('/');
    const response = await this.get(`/vault/${encoded}`);
    if (response.status === 404) return null;
    if (!response.ok) return null;
    return response.text();
  }

  /** Read a daily note by date (YYYY-MM-DD). Returns null if not found. */
  async getDaily(date: string): Promise<VaultNote | null> {
    // Try common daily note paths
    const paths = [
      `001-DAILY/${date}.md`,
      `Daily Notes/${date}.md`,
      `Journal/${date}.md`,
      `${date}.md`,
    ];

    for (const path of paths) {
      const content = await this.readFile(path);
      if (content !== null) {
        return {
          path,
          content,
          tags: extractTags(content),
          wikilinks: extractWikilinks(content),
          frontmatter: extractFrontmatter(content),
        };
      }
    }
    return null;
  }

  /** Simple full-text search across the vault. */
  async search(query: string): Promise<SearchResult[]> {
    const response = await this.get(`/search/simple/?query=${encodeURIComponent(query)}`);
    if (!response.ok) return [];
    const data = (await response.json()) as SearchResult[];
    return data;
  }

  /** List all files in the vault (optionally filtered by folder). */
  async listFiles(folder?: string): Promise<VaultFile[]> {
    const path = folder ? `/vault/${encodeURIComponent(folder)}/` : '/vault/';
    const response = await this.get(path);
    if (!response.ok) return [];
    const data = (await response.json()) as { files: VaultFile[] };
    return data.files ?? [];
  }
}

// ─── Parsing utilities (no external deps, pure TypeScript) ───────────────────

export function extractTags(content: string): string[] {
  const frontmatterTags = extractFrontmatterTags(content);
  const inlineTags = [...content.matchAll(/#([a-zA-Z][a-zA-Z0-9_/-]*)/g)].map(m => m[1]);
  return [...new Set([...frontmatterTags, ...inlineTags])];
}

export function extractWikilinks(content: string): string[] {
  const matches = [...content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)];
  return [...new Set(matches.map(m => m[1].trim()))];
}

export function extractQuestions(content: string): string[] {
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.endsWith('?') && line.length > 10)
    .slice(0, 5);
}

export function extractContext(content: string, term: string, windowChars = 120): string {
  const idx = content.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return '';
  const start = Math.max(0, idx - windowChars / 2);
  const end = Math.min(content.length, idx + term.length + windowChars / 2);
  return content.slice(start, end).replace(/\n+/g, ' ').trim();
}

function extractFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, unknown> = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w[\w-]*):\s*(.+)$/);
    if (kv) result[kv[1]] = kv[2].trim();
  }
  return result;
}

function extractFrontmatterTags(content: string): string[] {
  const match = content.match(/^---\n[\s\S]*?tags:\s*\[([^\]]+)\][\s\S]*?\n---/);
  if (!match) return [];
  return match[1].split(',').map(t => t.trim().replace(/['"]/g, ''));
}

export function dateMinusDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function daysAgo(n: number): number {
  return Date.now() - n * 24 * 60 * 60 * 1000;
}
