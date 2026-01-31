/**
 * ARI Changelog Generator
 *
 * Generates changelog entries from git commits following
 * Keep a Changelog format and Conventional Commits spec.
 *
 * Features:
 * - Parse git commits since last changelog
 * - Categorize using conventional commits (feat, fix, docs, etc.)
 * - Semantic grouping for related changes
 * - Integration with scheduler for 7pm daily generation
 */

import { EventBus } from '../kernel/event-bus.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';

const execFileAsync = promisify(execFile);

const CHANGELOG_PATH = path.join(
  process.env.HOME || '~',
  '.ari',
  'changelogs'
);

export interface ParsedCommit {
  hash: string;
  shortHash: string;
  type: string; // feat, fix, docs, refactor, etc.
  scope?: string;
  subject: string;
  body?: string;
  author: string;
  date: Date;
  breaking: boolean;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  added: string[];
  changed: string[];
  deprecated: string[];
  removed: string[];
  fixed: string[];
  security: string[];
}

/**
 * Conventional commit type to changelog category mapping
 */
const TYPE_TO_CATEGORY: Record<string, keyof ChangelogEntry> = {
  feat: 'added',
  feature: 'added',
  add: 'added',
  fix: 'fixed',
  bugfix: 'fixed',
  docs: 'changed',
  style: 'changed',
  refactor: 'changed',
  perf: 'changed',
  test: 'changed',
  chore: 'changed',
  build: 'changed',
  ci: 'changed',
  deprecate: 'deprecated',
  remove: 'removed',
  security: 'security',
  sec: 'security',
};

export class ChangelogGenerator {
  private eventBus: EventBus;
  private projectRoot: string;

  constructor(eventBus: EventBus, projectRoot: string) {
    this.eventBus = eventBus;
    this.projectRoot = projectRoot;
  }

  /**
   * Get commits since a reference point
   * @param since Git ref or date (e.g., "HEAD~10", "2024-01-01", tag name)
   */
  async getCommitsSince(since: string = 'HEAD~20'): Promise<ParsedCommit[]> {
    const format = '%H|%h|%s|%b|%an|%aI';

    try {
      const { stdout } = await execFileAsync(
        'git',
        ['log', `${since}..HEAD`, `--format=${format}`, '--no-merges'],
        { cwd: this.projectRoot, maxBuffer: 10 * 1024 * 1024 }
      );

      if (!stdout.trim()) {
        return [];
      }

      const commits: ParsedCommit[] = [];
      const lines = stdout.trim().split('\n');

      for (const line of lines) {
        const parts = line.split('|');
        if (parts.length < 6) continue;

        const [hash, shortHash, subject, body, author, dateStr] = parts;
        const parsed = this.parseConventionalCommit(subject);

        commits.push({
          hash,
          shortHash,
          type: parsed.type,
          scope: parsed.scope,
          subject: parsed.subject,
          body: body || undefined,
          author,
          date: new Date(dateStr),
          breaking: parsed.breaking,
        });
      }

      return commits;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to get git commits:', error);
      return [];
    }
  }

  /**
   * Parse a conventional commit message
   */
  private parseConventionalCommit(message: string): {
    type: string;
    scope?: string;
    subject: string;
    breaking: boolean;
  } {
    // Conventional commit pattern: type(scope)!: subject
    const match = message.match(
      /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/
    );

    if (match) {
      return {
        type: match[1].toLowerCase(),
        scope: match[2] || undefined,
        subject: match[4],
        breaking: match[3] === '!',
      };
    }

    // Fallback: try to detect type from common patterns
    const lowerMessage = message.toLowerCase();
    let type = 'changed';

    if (lowerMessage.startsWith('add') || lowerMessage.startsWith('feat')) {
      type = 'feat';
    } else if (lowerMessage.startsWith('fix')) {
      type = 'fix';
    } else if (lowerMessage.startsWith('remove') || lowerMessage.startsWith('delete')) {
      type = 'remove';
    } else if (lowerMessage.includes('security') || lowerMessage.includes('vuln')) {
      type = 'security';
    }

    return {
      type,
      subject: message,
      breaking: lowerMessage.includes('breaking'),
    };
  }

  /**
   * Generate changelog entry from commits
   */
  generateEntry(
    commits: ParsedCommit[],
    version: string = 'Unreleased'
  ): ChangelogEntry {
    const entry: ChangelogEntry = {
      version,
      date: new Date().toISOString().split('T')[0],
      added: [],
      changed: [],
      deprecated: [],
      removed: [],
      fixed: [],
      security: [],
    };

    for (const commit of commits) {
      const category = TYPE_TO_CATEGORY[commit.type] || 'changed';
      const scope = commit.scope ? `**${commit.scope}:** ` : '';
      const breaking = commit.breaking ? '[BREAKING] ' : '';
      const text = `${breaking}${scope}${commit.subject}`;

      if (category in entry) {
        (entry[category] as string[]).push(text);
      }
    }

    return entry;
  }

  /**
   * Format changelog entry as markdown
   */
  formatEntry(entry: ChangelogEntry): string {
    const sections: string[] = [];
    sections.push(`## [${entry.version}] - ${entry.date}\n`);

    const categories: Array<[keyof ChangelogEntry, string]> = [
      ['added', 'Added'],
      ['changed', 'Changed'],
      ['deprecated', 'Deprecated'],
      ['removed', 'Removed'],
      ['fixed', 'Fixed'],
      ['security', 'Security'],
    ];

    for (const [key, title] of categories) {
      const items = entry[key] as string[];
      if (items && items.length > 0) {
        sections.push(`### ${title}\n`);
        for (const item of items) {
          sections.push(`- ${item}`);
        }
        sections.push('');
      }
    }

    return sections.join('\n');
  }

  /**
   * Generate daily changelog
   */
  async generateDaily(): Promise<{
    entry: ChangelogEntry;
    markdown: string;
    savedPath?: string;
  }> {
    // Get today's date for filename
    const today = new Date().toISOString().split('T')[0];

    // Try to find last changelog or use commits from last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const sinceDate = yesterday.toISOString().split('T')[0];

    // Get commits since yesterday
    const commits = await this.getCommitsSince(`--since="${sinceDate}"`);

    if (commits.length === 0) {
      return {
        entry: {
          version: 'Unreleased',
          date: today,
          added: [],
          changed: [],
          deprecated: [],
          removed: [],
          fixed: [],
          security: [],
        },
        markdown: `## [Unreleased] - ${today}\n\nNo changes today.\n`,
      };
    }

    const entry = this.generateEntry(commits);
    const markdown = this.formatEntry(entry);

    // Save to file
    await fs.mkdir(CHANGELOG_PATH, { recursive: true });
    const filePath = path.join(CHANGELOG_PATH, `${today}.md`);
    await fs.writeFile(filePath, markdown);

    return {
      entry,
      markdown,
      savedPath: filePath,
    };
  }

  /**
   * Generate full changelog from all commits
   */
  async generateFull(): Promise<string> {
    // Get all commits
    const commits = await this.getCommitsSince('--all');

    // Group by version tags if available
    const entry = this.generateEntry(commits);
    const markdown = this.formatEntry(entry);

    const header = `# Changelog

All notable changes to ARI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`;

    return header + markdown;
  }

  /**
   * Get summary for briefings
   */
  async getSummaryForBriefing(): Promise<string> {
    const commits = await this.getCommitsSince('--since="24 hours ago"');

    if (commits.length === 0) {
      return 'No code changes in the last 24 hours.';
    }

    const entry = this.generateEntry(commits);
    const parts: string[] = [];

    if (entry.added.length > 0) {
      parts.push(`${entry.added.length} new features`);
    }
    if (entry.fixed.length > 0) {
      parts.push(`${entry.fixed.length} bug fixes`);
    }
    if (entry.changed.length > 0) {
      parts.push(`${entry.changed.length} improvements`);
    }
    if (entry.security.length > 0) {
      parts.push(`${entry.security.length} security updates`);
    }

    if (parts.length === 0) {
      return `${commits.length} commits, mostly maintenance.`;
    }

    return `Code changes: ${parts.join(', ')}.`;
  }
}

/**
 * Create a changelog generator for a project
 */
export function createChangelogGenerator(
  eventBus: EventBus,
  projectRoot: string
): ChangelogGenerator {
  return new ChangelogGenerator(eventBus, projectRoot);
}
