/**
 * Anthropic Monitor
 *
 * Autonomous monitoring of official Anthropic sources for updates that can improve ARI.
 * Only uses verified sources (anthropic.com, docs.anthropic.com, claude.com, github.com/anthropics).
 *
 * Security: No automatic installations. All recommendations require human approval.
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import fs from 'fs/promises';
import path from 'path';

// Verified sources only - Content ≠ Command principle applies
const VERIFIED_SOURCES = {
  news: 'https://www.anthropic.com/news',
  blog: 'https://claude.com/blog',
  releases: 'https://api.github.com/repos/anthropics/claude-code/releases',
  research: 'https://www.anthropic.com/research',
} as const;

export interface AnthropicUpdate {
  id: string;
  source: keyof typeof VERIFIED_SOURCES;
  title: string;
  description: string;
  url: string;
  date: string;
  relevance: 'high' | 'medium' | 'low';
  category: 'security' | 'feature' | 'api' | 'research' | 'plugin';
  actionRequired: boolean;
  hash: string;
}

export interface MonitorReport {
  timestamp: string;
  sourcesChecked: string[];
  updates: AnthropicUpdate[];
  recommendations: {
    update: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    securityImpact: boolean;
    requiresReview: boolean;
  }[];
}

export class AnthropicMonitor extends EventEmitter {
  private stateFile: string;
  private seenHashes: Set<string> = new Set();
  private lastCheck: Date | null = null;

  constructor(stateDir: string = '~/.ari') {
    super();
    const resolvedDir = stateDir.startsWith('~')
      ? stateDir.replace('~', process.env.HOME || '')
      : stateDir;
    this.stateFile = path.join(resolvedDir, 'anthropic-monitor-state.json');
  }

  /**
   * Load previously seen updates to avoid duplicates
   */
  async loadState(): Promise<void> {
    try {
      const content = await fs.readFile(this.stateFile, 'utf-8');
      const state = JSON.parse(content);
      this.seenHashes = new Set(state.seenHashes || []);
      this.lastCheck = state.lastCheck ? new Date(state.lastCheck) : null;
    } catch {
      // First run, no state to load
      this.seenHashes = new Set();
      this.lastCheck = null;
    }
  }

  /**
   * Save state for persistence
   */
  async saveState(): Promise<void> {
    const state = {
      seenHashes: Array.from(this.seenHashes),
      lastCheck: new Date().toISOString(),
    };
    await fs.mkdir(path.dirname(this.stateFile), { recursive: true });
    await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2));
  }

  /**
   * Generate content hash for deduplication
   */
  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  /**
   * Check if update is new (not seen before)
   */
  private isNewUpdate(hash: string): boolean {
    if (this.seenHashes.has(hash)) {
      return false;
    }
    this.seenHashes.add(hash);
    return true;
  }

  /**
   * Categorize update relevance for ARI
   */
  private categorizeRelevance(title: string, description: string): {
    relevance: 'high' | 'medium' | 'low';
    category: AnthropicUpdate['category'];
    actionRequired: boolean;
  } {
    const text = `${title} ${description}`.toLowerCase();

    // High relevance: Security, API changes, Claude Code updates
    if (text.includes('security') || text.includes('vulnerability') || text.includes('patch')) {
      return { relevance: 'high', category: 'security', actionRequired: true };
    }
    if (text.includes('api') && (text.includes('change') || text.includes('deprecat'))) {
      return { relevance: 'high', category: 'api', actionRequired: true };
    }
    if (text.includes('claude code') || text.includes('plugin') || text.includes('skill')) {
      return { relevance: 'high', category: 'plugin', actionRequired: false };
    }

    // Medium relevance: New features, improvements
    if (text.includes('feature') || text.includes('improv') || text.includes('enhanc')) {
      return { relevance: 'medium', category: 'feature', actionRequired: false };
    }
    if (text.includes('model') || text.includes('opus') || text.includes('sonnet')) {
      return { relevance: 'medium', category: 'api', actionRequired: false };
    }

    // Low relevance: Research, general news
    if (text.includes('research') || text.includes('paper') || text.includes('study')) {
      return { relevance: 'low', category: 'research', actionRequired: false };
    }

    return { relevance: 'low', category: 'feature', actionRequired: false };
  }

  /**
   * Parse updates from fetched content
   * Note: Actual implementation would parse HTML/JSON from fetch results
   */
  parseUpdates(source: keyof typeof VERIFIED_SOURCES, content: string): AnthropicUpdate[] {
    const updates: AnthropicUpdate[] = [];

    // This is a placeholder - actual implementation would parse the content
    // based on the source format (HTML for news/blog, JSON for GitHub releases)

    // For now, emit raw content for manual processing
    this.emit('raw_content', { source, content });

    return updates;
  }

  /**
   * Generate recommendations for ARI based on updates
   */
  generateRecommendations(updates: AnthropicUpdate[]): MonitorReport['recommendations'] {
    return updates
      .filter(u => u.relevance === 'high' || u.actionRequired)
      .map(u => ({
        update: u.title,
        priority: u.category === 'security' ? 'critical' as const :
                  u.relevance === 'high' ? 'high' as const : 'medium' as const,
        securityImpact: u.category === 'security',
        requiresReview: true, // Always require review - no auto-install
      }));
  }

  /**
   * Create a monitoring report
   */
  createReport(updates: AnthropicUpdate[]): MonitorReport {
    return {
      timestamp: new Date().toISOString(),
      sourcesChecked: Object.keys(VERIFIED_SOURCES),
      updates: updates.filter(u => this.isNewUpdate(u.hash)),
      recommendations: this.generateRecommendations(updates),
    };
  }

  /**
   * Get monitoring schedule (for autonomous operation)
   */
  getSchedule(): { interval: number; nextCheck: Date } {
    const interval = 6 * 60 * 60 * 1000; // 6 hours
    const nextCheck = this.lastCheck
      ? new Date(this.lastCheck.getTime() + interval)
      : new Date();

    return { interval, nextCheck };
  }

  /**
   * Format report for display
   */
  formatReport(report: MonitorReport): string {
    const lines: string[] = [
      '## Anthropic Updates Report',
      `**Generated**: ${report.timestamp}`,
      `**Sources Checked**: ${report.sourcesChecked.join(', ')}`,
      '',
    ];

    // Security advisories first
    const security = report.updates.filter(u => u.category === 'security');
    if (security.length > 0) {
      lines.push('### Security Advisories (PRIORITY)');
      security.forEach(u => lines.push(`- **${u.title}**: ${u.description}`));
      lines.push('');
    } else {
      lines.push('### Security Advisories');
      lines.push('None found.');
      lines.push('');
    }

    // Claude Code updates
    const plugins = report.updates.filter(u => u.category === 'plugin');
    if (plugins.length > 0) {
      lines.push('### Claude Code Updates');
      plugins.forEach(u => lines.push(`- **${u.title}**: ${u.description}`));
      lines.push('');
    }

    // API updates
    const api = report.updates.filter(u => u.category === 'api');
    if (api.length > 0) {
      lines.push('### Claude API Updates');
      api.forEach(u => lines.push(`- **${u.title}**: ${u.description}`));
      lines.push('');
    }

    // Recommendations table
    if (report.recommendations.length > 0) {
      lines.push('### Recommendations for ARI');
      lines.push('| Update | Priority | Security | Action |');
      lines.push('|--------|----------|----------|--------|');
      report.recommendations.forEach(r => {
        lines.push(`| ${r.update} | ${r.priority} | ${r.securityImpact ? 'Yes' : 'No'} | Review |`);
      });
      lines.push('');
    }

    lines.push('*No automatic installations. All updates require human approval.*');

    return lines.join('\n');
  }
}

// Export singleton
export const anthropicMonitor = new AnthropicMonitor();
