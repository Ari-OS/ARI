import fs from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';

// Minimal L0 emitter interface
interface EventEmitterLike {
  on(event: string, handler: (payload: unknown) => void): () => void;
}

// Local payload types to avoid cross-layer imports
interface ToolEndPayload {
  success?: boolean;
  toolName?: string;
  toolId?: string;
  error?: string;
}

interface SubagentCompletedPayload {
  success?: boolean;
  taskId?: string;
  result?: unknown;
}

interface FeedbackSignalPayload {
  signal?: string;
  messageId?: string;
}

interface PatternLearnedPayload {
  pattern?: string;
  confidence?: number;
}

/**
 * FoundryObserver — OpenClaw-inspired Workflow Observer
 *
 * Silently monitors the EventBus for interactions, corrections, and errors.
 * Logs structured data to ~/.ari/LEARNINGS.md and ~/.ari/ERRORS.md for
 * zero-token-cost skill crystallization.
 */
export class FoundryObserver {
  private readonly dir = path.join(homedir(), '.ari');
  private readonly learningsFile = path.join(this.dir, 'LEARNINGS.md');
  private readonly errorsFile = path.join(this.dir, 'ERRORS.md');
  private unsubscribers: Array<() => void> = [];

  constructor(private eventBus?: EventEmitterLike) {}

  public async initialize(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });

    // Ensure files exist with headers if new
    try { await fs.access(this.learningsFile); } catch {
      await fs.writeFile(this.learningsFile, '# ARI Learnings & Patterns\n\n');
    }
    try { await fs.access(this.errorsFile); } catch {
      await fs.writeFile(this.errorsFile, '# ARI Error Log & Corrections\n\n');
    }

    if (this.eventBus) {
      this.subscribe();
    }
  }

  private subscribe(): void {
    // ── Log Errors ───────────────────────────────────────────────────────────
    this.unsubscribers.push(
      this.eventBus!.on('system:error', (payload: unknown) => {
        void this.appendError('System Error', JSON.stringify(payload));
      })
    );
    this.unsubscribers.push(
      this.eventBus!.on('system:handler_error', (payload: unknown) => {
        void this.appendError('Handler Error', JSON.stringify(payload));
      })
    );
    this.unsubscribers.push(
      this.eventBus!.on('tool:end', (payload: unknown) => {
        const p = payload as ToolEndPayload;
        if (!p.success) {
          void this.appendError(`Tool Failed: ${p.toolName ?? p.toolId ?? 'unknown'}`, p.error ?? 'Unknown error');
        }
      })
    );
    this.unsubscribers.push(
      this.eventBus!.on('subagent:completed', (payload: unknown) => {
        const p = payload as SubagentCompletedPayload;
        if (!p.success) {
          void this.appendError(`Subagent Failed: ${p.taskId ?? 'unknown'}`, JSON.stringify(p.result ?? 'Unknown error'));
        }
      })
    );

    // ── Log Learnings / Patterns ──────────────────────────────────────────────
    this.unsubscribers.push(
      this.eventBus!.on('feedback:signal', (payload: unknown) => {
        const p = payload as FeedbackSignalPayload;
        void this.appendLearning('User Feedback Signal', `Received ${p.signal ?? 'unknown'} on message ${p.messageId ?? 'unknown'}`);
      })
    );
    this.unsubscribers.push(
      this.eventBus!.on('subagent:completed', (payload: unknown) => {
        const p = payload as SubagentCompletedPayload;
        if (p.success) {
          void this.appendLearning(`Successful Subagent Task: ${p.taskId ?? 'unknown'}`, JSON.stringify(p.result));
        }
      })
    );
    this.unsubscribers.push(
      this.eventBus!.on('pattern:learned', (payload: unknown) => {
        const p = payload as PatternLearnedPayload;
        void this.appendLearning('Pattern Recognized', `${p.pattern ?? 'unknown'} (Confidence: ${p.confidence ?? 0})`);
      })
    );
  }

  private async appendError(context: string, details: string): Promise<void> {
    const entry = `\n## [${new Date().toISOString()}] ${context}\n\`\`\`\n${details}\n\`\`\`\n`;
    try {
      await fs.appendFile(this.errorsFile, entry);
    } catch {
      // Best effort logging
    }
  }

  private async appendLearning(context: string, details: string): Promise<void> {
    const entry = `\n## [${new Date().toISOString()}] ${context}\n\`\`\`\n${details}\n\`\`\`\n`;
    try {
      await fs.appendFile(this.learningsFile, entry);
    } catch {
      // Best effort logging
    }
  }

  public shutdown(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
  }
}
