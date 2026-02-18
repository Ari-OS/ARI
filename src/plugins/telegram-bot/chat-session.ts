import { loadWorkspaceFile } from '../../system/workspace-loader.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT SESSION — Per-user conversation memory for Telegram
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface Session {
  messages: ChatMessage[];
  lastActivity: number;
}

const MAX_MESSAGES = 20; // Rolling window — keep last 20 exchanges
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes of inactivity clears session

/**
 * Manages per-user conversation sessions with a rolling window.
 * ARI can "reflect" on recent messages within the same session.
 * Sessions auto-expire after 30 minutes of inactivity.
 */
export class ChatSessionManager {
  private readonly sessions: Map<number, Session> = new Map();
  private cachedPrompt: string | null = null;
  private promptCacheTime = 0;
  private static readonly PROMPT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // System prompt built on-demand with TTL cache
  }

  /**
   * Add a user message and get the full conversation history for the AI.
   */
  addUserMessage(chatId: number, content: string): ChatMessage[] {
    const session = this.getOrCreateSession(chatId);
    session.messages.push({ role: 'user', content, timestamp: Date.now() });
    session.lastActivity = Date.now();
    this.trimSession(session);
    return [...session.messages];
  }

  /**
   * Record ARI's response in the session.
   */
  addAssistantMessage(chatId: number, content: string): void {
    const session = this.getOrCreateSession(chatId);
    session.messages.push({ role: 'assistant', content, timestamp: Date.now() });
    session.lastActivity = Date.now();
    this.trimSession(session);
  }

  /**
   * Get the system prompt built from workspace files.
   * Cached for 5 minutes to avoid rebuilding on every message.
   */
  async getSystemPrompt(): Promise<string> {
    const now = Date.now();
    if (!this.cachedPrompt || (now - this.promptCacheTime) > ChatSessionManager.PROMPT_CACHE_TTL) {
      this.cachedPrompt = await buildSystemPrompt();
      this.promptCacheTime = now;
    }
    return this.cachedPrompt;
  }

  /**
   * Clear a specific session (e.g., on /start or /clear).
   */
  clearSession(chatId: number): void {
    this.sessions.delete(chatId);
  }

  /**
   * Get session stats for debugging.
   */
  getSessionCount(): number {
    this.pruneExpired();
    return this.sessions.size;
  }

  private getOrCreateSession(chatId: number): Session {
    const existing = this.sessions.get(chatId);
    if (existing && Date.now() - existing.lastActivity < SESSION_TTL_MS) {
      return existing;
    }
    // Expired or new — start fresh
    const session: Session = { messages: [], lastActivity: Date.now() };
    this.sessions.set(chatId, session);
    return session;
  }

  private trimSession(session: Session): void {
    if (session.messages.length > MAX_MESSAGES) {
      session.messages = session.messages.slice(-MAX_MESSAGES);
    }
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [chatId, session] of this.sessions) {
      if (now - session.lastActivity >= SESSION_TTL_MS) {
        this.sessions.delete(chatId);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT BUILDER — Loads from ~/.ari/workspace/ via shared workspace-loader
// ═══════════════════════════════════════════════════════════════════════════════

function getTimeOfDayContext(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 7) return 'early-morning';
  if (hour >= 7 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 16) return 'afternoon';
  if (hour >= 16 && hour < 21) return 'evening';
  return 'night';
}

async function buildSystemPrompt(): Promise<string> {
  const [soul, identity, user, goals, preferences] = await Promise.all([
    loadWorkspaceFile('SOUL.md'),
    loadWorkspaceFile('IDENTITY.md'),
    loadWorkspaceFile('USER.md'),
    loadWorkspaceFile('GOALS.md'),
    loadWorkspaceFile('PREFERENCES.md'),
  ]);

  const timeOfDay = getTimeOfDayContext();

  const parts: string[] = [
    'You are ARI (Artificial Reasoning Intelligence) — Pryce Hedrick\'s personal AI operating system.',
    'You are talking to Pryce via Telegram. Keep responses concise and conversational.',
    '',
    '## Conversation Rules',
    '- You have memory of this conversation session. Reference earlier messages naturally when relevant.',
    '- Use subtle emojis sparingly — one or two per message max, only where they add warmth.',
    '- Never start a message with an emoji. Place them mid-sentence or at the end.',
    '- Be direct. Pryce has limited time.',
    '- Every response should include an actionable next step when appropriate.',
    '- Use Telegram-safe HTML formatting: <b>bold</b>, <i>italic</i>, <code>code</code>.',
    '',
    `## Current Context`,
    `- Time of day: ${timeOfDay}`,
    `- Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`,
  ];

  if (timeOfDay === 'early-morning' || timeOfDay === 'morning') {
    parts.push('- Mode: Brief and scannable. Pryce is getting ready or heading to work.');
  } else if (timeOfDay === 'afternoon') {
    parts.push('- Mode: Minimal. Only respond if directly asked. Pryce is at work.');
  } else if (timeOfDay === 'evening') {
    parts.push('- Mode: Full detail. Build session active. Deep dives welcome.');
  } else {
    parts.push('- Mode: Build session. Full context, detailed analysis, proactive suggestions.');
  }

  if (soul) {
    parts.push('', soul);
  }

  if (identity) {
    parts.push('', identity);
  }

  if (user) {
    parts.push('', user);
  }

  if (goals) {
    parts.push('', goals);
  }

  if (preferences) {
    parts.push('', preferences);
  }

  return parts.join('\n');
}
