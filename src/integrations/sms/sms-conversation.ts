/**
 * ARI SMS Conversation Handler
 *
 * Manages two-way SMS conversations:
 * 1. Receives incoming SMS (via GmailReceiver)
 * 2. Processes through Claude for intelligent responses
 * 3. Sends response back via SMS
 * 4. Maintains conversation context
 *
 * This is what makes ARI truly conversational via text message.
 */

import { GmailReceiver, type IncomingSMS } from './gmail-receiver.js';
import { GmailSMS } from './gmail-sms.js';
import { SMSExecutor, smsExecutor } from './sms-executor.js';
import { ClaudeClient } from '../../autonomous/claude-client.js';
import { dailyAudit } from '../../autonomous/daily-audit.js';
import { EventEmitter } from 'node:events';
import type { SMSConfig } from '../../autonomous/types.js';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ConversationContext {
  messages: ConversationMessage[];
  startedAt: Date;
  lastActivity: Date;
}

export interface SMSConversationConfig {
  sms: SMSConfig;
  claude: {
    apiKey: string;
    model?: string;
    maxTokens?: number;
  };
  maxContextMessages?: number;
  contextTimeoutMinutes?: number;
  systemPrompt?: string;
}

export class SMSConversation extends EventEmitter {
  private receiver: GmailReceiver | null = null;
  private sender: GmailSMS;
  private claude: ClaudeClient;
  private config: SMSConversationConfig;
  private context: ConversationContext;
  private processing = false;
  private messageQueue: IncomingSMS[] = [];

  constructor(config: SMSConversationConfig) {
    super();
    this.config = {
      maxContextMessages: 10,
      contextTimeoutMinutes: 30,
      systemPrompt: this.getDefaultSystemPrompt(),
      ...config,
    };

    this.sender = new GmailSMS(config.sms);
    this.claude = new ClaudeClient(config.claude);

    this.context = {
      messages: [],
      startedAt: new Date(),
      lastActivity: new Date(),
    };
  }

  /**
   * Default system prompt for SMS conversations
   */
  private getDefaultSystemPrompt(): string {
    return `You are ARI, Pryce Hedrick's autonomous AI assistant. You DECIDE what to do and EXECUTE.

For every message, you must return a JSON response specifying what action(s) to take:

{
  "thinking": "brief analysis of what user wants",
  "actions": [
    {"type": "shell", "command": "git status"},
    {"type": "task", "command": "add", "args": ["task description"]},
    {"type": "status"},
    {"type": "file", "command": "read", "args": ["path/to/file"]},
    {"type": "notify", "args": ["message"]},
    {"type": "respond_only"}
  ],
  "response": "What to tell user (max 160 chars)"
}

ACTION TYPES:
- shell: Run any shell command (git, npm, ls, python, etc.)
- task: Task queue ops (add)
- status: System status check
- file: Read files (read)
- notify: Send notification
- respond_only: Just respond, no action needed

DECISION RULES:
1. If user asks about files, code, or system → run shell commands
2. If user wants something done → decide the right command
3. If user asks a question → respond_only OR check system first
4. Be proactive - if they ask "how's the project" → run git status
5. Multiple actions allowed - chain them logically

EXAMPLES:
"what's the git status" → shell: git status
"add task fix login" → task: add, args: ["fix login"]
"how are you" → respond_only
"check disk space" → shell: df -h
"run tests" → shell: npm test
"what's in package.json" → file: read, args: ["package.json"]

Always return valid JSON. The response field is what gets texted to user.`;
  }

  /**
   * Initialize the conversation system
   */
  async init(): Promise<boolean> {
    // Initialize sender
    if (!this.sender.init()) {
      this.emit('error', new Error('Failed to initialize SMS sender'));
      return false;
    }

    // Initialize receiver
    this.receiver = GmailReceiver.fromSMSConfig(this.config.sms);
    if (!this.receiver) {
      this.emit('error', new Error('Failed to create SMS receiver'));
      return false;
    }

    // Set up message handler
    this.receiver.on('message', (msg: IncomingSMS) => {
      void this.handleIncomingMessage(msg);
    });

    this.receiver.on('error', (err: Error) => {
      this.emit('error', err);
    });

    this.emit('initialized');
    return true;
  }

  /**
   * Start listening for incoming messages
   */
  async start(): Promise<void> {
    if (!this.receiver) {
      throw new Error('Not initialized. Call init() first.');
    }

    await this.receiver.start();
    this.emit('started');

    // eslint-disable-next-line no-console
    console.log('[SMSConversation] Started - listening for SMS replies');
  }

  /**
   * Stop the conversation system
   */
  async stop(): Promise<void> {
    if (this.receiver) {
      await this.receiver.stop();
    }
    this.emit('stopped');
  }

  /**
   * Handle an incoming SMS message
   */
  private async handleIncomingMessage(msg: IncomingSMS): Promise<void> {
    // Queue message if already processing
    if (this.processing) {
      this.messageQueue.push(msg);
      return;
    }

    this.processing = true;

    try {
      // Log receipt
      await dailyAudit.logActivity(
        'api_call',
        'SMS Received',
        msg.body.slice(0, 100),
        { outcome: 'success', details: { from: msg.from } }
      );

      this.emit('message_received', msg);

      // Check for special commands
      const command = this.parseCommand(msg.body);
      if (command) {
        await this.handleCommand(command, msg);
      } else {
        // Normal conversation
        await this.processConversation(msg);
      }

      // Process any queued messages
      while (this.messageQueue.length > 0) {
        const queued = this.messageQueue.shift();
        if (queued) {
          await this.processConversation(queued);
        }
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error', new Error(`Message processing failed: ${errMsg}`));

      // Try to send error response
      await this.sender.send('Sorry, I had trouble processing that. Try again?', {
        forceDelivery: true,
      });
    } finally {
      this.processing = false;
    }
  }

  /**
   * Parse special commands from message
   */
  private parseCommand(body: string): string | null {
    const text = body.trim().toLowerCase();

    // Special commands
    if (text === 'status' || text === 'ari status') return 'status';
    if (text === 'help' || text === '?') return 'help';
    if (text === 'more') return 'more';
    if (text === 'clear' || text === 'reset') return 'clear';
    if (text.startsWith('remind ')) return 'remind';
    if (text.startsWith('note ')) return 'note';

    return null;
  }

  /**
   * Handle special commands
   */
  private async handleCommand(command: string, msg: IncomingSMS): Promise<void> {
    switch (command) {
      case 'status':
        await this.sendStatusResponse();
        break;

      case 'help':
        await this.sender.send(
          'ARI commands: STATUS, HELP, CLEAR, REMIND [text], NOTE [text]. Or just text me!',
          { forceDelivery: true }
        );
        break;

      case 'more':
        await this.sendMoreDetails();
        break;

      case 'clear':
        this.clearContext();
        await this.sender.send('Conversation cleared. Fresh start!', {
          forceDelivery: true,
        });
        break;

      case 'remind':
      case 'note':
        await this.processConversation(msg); // Let Claude handle these
        break;
    }
  }

  /**
   * Send status response
   */
  private async sendStatusResponse(): Promise<void> {
    const smsStats = this.sender.getStats();
    const receiverStats = this.receiver?.getStats();

    const status = `ARI OK. SMS: ${smsStats.rateLimitRemaining} left/hr. ` +
      `Msgs processed: ${receiverStats?.processedCount ?? 0}. ` +
      `Context: ${this.context.messages.length} msgs`;

    await this.sender.send(status, { forceDelivery: true });
  }

  /**
   * Send more details from last response
   */
  private async sendMoreDetails(): Promise<void> {
    // Find last assistant message
    const lastAssistant = [...this.context.messages]
      .reverse()
      .find((m) => m.role === 'assistant');

    if (!lastAssistant) {
      await this.sender.send('No previous message to expand on.', {
        forceDelivery: true,
      });
      return;
    }

    // Ask Claude to expand
    const expandPrompt = `The user wants more details on your last response. ` +
      `Your last response was: "${lastAssistant.content}". ` +
      `Provide additional details, but still keep it under 160 characters if possible. ` +
      `If you need more space, you can use up to 300 characters.`;

    const response = await this.claude.chat([
      { role: 'user', content: expandPrompt },
    ], this.config.systemPrompt);

    await this.sender.send(response.slice(0, 300), { forceDelivery: true });
  }

  /**
   * Process a conversation message - Claude DECIDES, then EXECUTES
   */
  private async processConversation(msg: IncomingSMS): Promise<void> {
    // Check if context is stale
    this.refreshContextIfStale();

    // Add user message to context
    this.context.messages.push({
      role: 'user',
      content: msg.body,
      timestamp: new Date(),
    });

    // Trim context if too long
    while (this.context.messages.length > (this.config.maxContextMessages ?? 10)) {
      this.context.messages.shift();
    }

    // Build messages for Claude
    const messages = this.context.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      // STEP 1: Ask Claude what to do
      const decisionPrompt = this.config.systemPrompt ?? this.getDefaultSystemPrompt();
      const claudeResponse = await this.claude.chat(messages, decisionPrompt);

      // STEP 2: Parse Claude's decision
      let decision: {
        thinking?: string;
        actions?: Array<{ type: string; command?: string; args?: string[] }>;
        response?: string;
      };

      try {
        // Try to parse JSON from response
        const jsonMatch = claudeResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          decision = JSON.parse(jsonMatch[0]);
        } else {
          // If no JSON, treat as simple response
          decision = { actions: [{ type: 'respond_only' }], response: claudeResponse };
        }
      } catch {
        // Parse failed, use response as-is
        decision = { actions: [{ type: 'respond_only' }], response: claudeResponse };
      }

      // STEP 3: Execute all actions Claude decided on
      const actionResults: Array<{ type: string; success: boolean; output: string }> = [];

      for (const action of (decision.actions ?? [])) {
        if (action.type === 'respond_only') continue;

        this.emit('action_executing', action);

        const parsedAction = {
          type: action.type as 'shell' | 'status' | 'task' | 'notify' | 'file' | 'query' | 'unknown',
          command: action.command ?? '',
          args: action.args ?? [],
          requiresConfirmation: false,
        };

        const result = await smsExecutor.execute(parsedAction);
        actionResults.push({ type: action.type, ...result });

        this.emit('action_completed', result);

        await dailyAudit.logActivity(
          result.success ? 'task_completed' : 'error_occurred',
          `SMS Action: ${action.type}`,
          (action.command ?? action.type).slice(0, 100),
          { outcome: result.success ? 'success' : 'failure' }
        );
      }

      // STEP 4: Build final response
      let finalResponse = decision.response ?? 'Done.';

      // If actions were executed, augment response with results
      if (actionResults.length > 0) {
        const outputs = actionResults
          .filter((r) => r.output)
          .map((r) => r.output)
          .join(' | ');

        if (outputs && !finalResponse.includes(outputs.slice(0, 20))) {
          // If Claude's response doesn't include output, append a summary
          const maxResponseLen = 160 - Math.min(outputs.length, 80) - 3;
          if (finalResponse.length > maxResponseLen) {
            finalResponse = finalResponse.slice(0, maxResponseLen - 3) + '...';
          }
          // Don't append if it would make response too long
          if (finalResponse.length + outputs.length < 300) {
            finalResponse = `${finalResponse}`;
          }
        }
      }

      // Ensure response fits SMS
      if (finalResponse.length > 160) {
        finalResponse = finalResponse.slice(0, 157) + '...';
      }

      // Add to context
      this.context.messages.push({
        role: 'assistant',
        content: finalResponse,
        timestamp: new Date(),
      });
      this.context.lastActivity = new Date();

      // Send response via SMS
      const result = await this.sender.send(finalResponse, { forceDelivery: true });

      if (result.sent) {
        this.emit('message_sent', { original: msg, response: finalResponse, actions: actionResults });

        await dailyAudit.logActivity(
          'api_call',
          'SMS Response Sent',
          finalResponse.slice(0, 100),
          { outcome: 'success' }
        );
      } else {
        this.emit('error', new Error(`Failed to send SMS: ${result.reason}`));
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';

      await dailyAudit.logActivity(
        'error_occurred',
        'SMS Processing Error',
        errMsg,
        { outcome: 'failure' }
      );

      await this.sender.send(
        'Having trouble processing. Try again?',
        { forceDelivery: true }
      );
    }
  }

  /**
   * Clear conversation context if stale
   */
  private refreshContextIfStale(): void {
    const timeoutMs = (this.config.contextTimeoutMinutes ?? 30) * 60 * 1000;
    const elapsed = Date.now() - this.context.lastActivity.getTime();

    if (elapsed > timeoutMs) {
      this.clearContext();
    }
  }

  /**
   * Clear conversation context
   */
  clearContext(): void {
    this.context = {
      messages: [],
      startedAt: new Date(),
      lastActivity: new Date(),
    };
  }

  /**
   * Send a proactive message (not in response to user)
   */
  async sendProactive(message: string, options?: { forceDelivery?: boolean }): Promise<boolean> {
    const result = await this.sender.send(message, options);
    return result.sent;
  }

  /**
   * Get conversation stats
   */
  getStats(): {
    contextMessages: number;
    lastActivity: Date;
    receiverRunning: boolean;
    smsStats: ReturnType<GmailSMS['getStats']>;
  } {
    return {
      contextMessages: this.context.messages.length,
      lastActivity: this.context.lastActivity,
      receiverRunning: this.receiver?.isRunning() ?? false,
      smsStats: this.sender.getStats(),
    };
  }
}

/**
 * Factory function for creating SMS conversation handler
 */
export function createSMSConversation(config: SMSConversationConfig): SMSConversation {
  return new SMSConversation(config);
}
