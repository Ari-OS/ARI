/**
 * Session State — Daemon Orientation
 *
 * After restart, ARI reads what she was working on. Persisted as
 * structured markdown to ~/.ari/SESSION_STATE.md for human readability.
 *
 * Events: session:state_saved, session:state_restored
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { EventBus } from '../kernel/event-bus.js';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface SessionSnapshot {
  lastActive: string;        // ISO timestamp
  currentTask?: string;      // What ARI was working on
  pendingItems: string[];    // Items waiting for attention
  activeAgents: string[];    // Which agents were running
  systemHealth: 'healthy' | 'degraded' | 'critical';
  context: Record<string, unknown>;  // Arbitrary context
  uptime: number;            // Seconds since last restart
  version: string;           // ARI version
}

// ─── Default State ──────────────────────────────────────────────────────────

const DEFAULT_STATE: SessionSnapshot = {
  lastActive: new Date().toISOString(),
  pendingItems: [],
  activeAgents: [],
  systemHealth: 'healthy',
  context: {},
  uptime: 0,
  version: '0.0.0',
};

const DEFAULT_PATH = join(homedir(), '.ari', 'SESSION_STATE.md');

// ─── Markdown Serialization ─────────────────────────────────────────────────

function toMarkdown(state: SessionSnapshot): string {
  const lines: string[] = [
    '# ARI Session State',
    '',
    `> Last updated: ${state.lastActive}`,
    '',
    '## Status',
    '',
    `- **Health**: ${state.systemHealth}`,
    `- **Version**: ${state.version}`,
    `- **Uptime**: ${state.uptime}s`,
  ];

  if (state.currentTask) {
    lines.push(`- **Current Task**: ${state.currentTask}`);
  }

  lines.push('', '## Pending Items', '');
  if (state.pendingItems.length > 0) {
    for (const item of state.pendingItems) {
      lines.push(`- [ ] ${item}`);
    }
  } else {
    lines.push('_No pending items._');
  }

  lines.push('', '## Active Agents', '');
  if (state.activeAgents.length > 0) {
    for (const agent of state.activeAgents) {
      lines.push(`- ${agent}`);
    }
  } else {
    lines.push('_No active agents._');
  }

  lines.push('', '## Context', '', '```json');
  lines.push(JSON.stringify(state.context, null, 2));
  lines.push('```', '');

  return lines.join('\n');
}

function fromMarkdown(content: string): SessionSnapshot | null {
  try {
    const state: SessionSnapshot = { ...DEFAULT_STATE };

    // Parse last active from blockquote
    const lastActiveMatch = content.match(/Last updated:\s*(.+)/);
    if (lastActiveMatch) {
      state.lastActive = lastActiveMatch[1].trim();
    }

    // Parse status fields
    const healthMatch = content.match(/\*\*Health\*\*:\s*(\w+)/);
    if (healthMatch) {
      state.systemHealth = healthMatch[1] as SessionSnapshot['systemHealth'];
    }

    const versionMatch = content.match(/\*\*Version\*\*:\s*(.+)/);
    if (versionMatch) {
      state.version = versionMatch[1].trim();
    }

    const uptimeMatch = content.match(/\*\*Uptime\*\*:\s*(\d+)/);
    if (uptimeMatch) {
      state.uptime = parseInt(uptimeMatch[1], 10);
    }

    const taskMatch = content.match(/\*\*Current Task\*\*:\s*(.+)/);
    if (taskMatch) {
      state.currentTask = taskMatch[1].trim();
    }

    // Parse pending items (checkbox lines)
    const pendingMatches = content.matchAll(/- \[[ x]\]\s+(.+)/g);
    state.pendingItems = [...pendingMatches].map((m) => m[1].trim());

    // Parse active agents (bullet list under Active Agents)
    const agentsSection = content.split('## Active Agents')[1]?.split('## Context')[0];
    if (agentsSection) {
      const agentMatches = agentsSection.matchAll(/^- ([^_].+)/gm);
      state.activeAgents = [...agentMatches].map((m) => m[1].trim());
    }

    // Parse context JSON block
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      state.context = JSON.parse(jsonMatch[1]) as Record<string, unknown>;
    }

    return state;
  } catch {
    return null;
  }
}

// ─── SessionState Class ─────────────────────────────────────────────────────

export class SessionState {
  private readonly statePath: string;
  private eventBus?: EventBus;

  constructor(statePath?: string, eventBus?: EventBus) {
    this.statePath = statePath ?? DEFAULT_PATH;
    this.eventBus = eventBus;
  }

  /**
   * Save current session state to markdown file.
   */
  save(state: SessionSnapshot): void {
    const dir = dirname(this.statePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const markdown = toMarkdown(state);
    writeFileSync(this.statePath, markdown, 'utf-8');

    this.eventBus?.emit('session:state_saved', {
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Load last session state from markdown file.
   * Returns null if no state file exists or parsing fails.
   */
  load(): SessionSnapshot | null {
    if (!existsSync(this.statePath)) {
      return null;
    }

    try {
      const content = readFileSync(this.statePath, 'utf-8');
      const state = fromMarkdown(content);

      if (state) {
        this.eventBus?.emit('session:state_restored', {
          lastActive: state.lastActive,
          pendingItems: state.pendingItems.length,
        });
      }

      return state;
    } catch {
      return null;
    }
  }

  /**
   * Update specific fields without overwriting the entire state.
   */
  update(partial: Partial<SessionSnapshot>): void {
    const current = this.load() ?? { ...DEFAULT_STATE };
    const updated: SessionSnapshot = { ...current, ...partial };
    updated.lastActive = new Date().toISOString();
    this.save(updated);
  }

  /**
   * Clear state file (called on clean shutdown).
   */
  clear(): void {
    if (existsSync(this.statePath)) {
      unlinkSync(this.statePath);
    }
  }
}
