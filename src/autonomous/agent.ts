/**
 * ARI Autonomous Agent
 *
 * The main agent loop that:
 * 1. Polls for new tasks (from Pushover, queue, schedule)
 * 2. Processes them through Claude API
 * 3. Executes approved actions
 * 4. Reports results via Pushover
 *
 * This is what makes ARI truly autonomous.
 */

import { EventBus } from '../kernel/event-bus.js';
import { TaskQueue, taskQueue } from './task-queue.js';
import { PushoverClient } from './pushover-client.js';
import { ClaudeClient } from './claude-client.js';
import { AutonomousConfig, Task, PushoverMessage } from './types.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const CONFIG_PATH = path.join(process.env.HOME || '~', '.ari', 'autonomous.json');
const STATE_PATH = path.join(process.env.HOME || '~', '.ari', 'agent-state.json');

interface AgentState {
  running: boolean;
  startedAt: string | null;
  tasksProcessed: number;
  lastActivity: string | null;
  errors: number;
}

export class AutonomousAgent {
  private eventBus: EventBus;
  private queue: TaskQueue;
  private pushover: PushoverClient | null = null;
  private claude: ClaudeClient | null = null;
  private config: AutonomousConfig;
  private state: AgentState;
  private running = false;
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(eventBus: EventBus, config?: Partial<AutonomousConfig>) {
    this.eventBus = eventBus;
    this.queue = taskQueue;
    this.config = {
      enabled: false,
      pollIntervalMs: 5000,
      maxConcurrentTasks: 1,
      ...config,
    };
    this.state = {
      running: false,
      startedAt: null,
      tasksProcessed: 0,
      lastActivity: null,
      errors: 0,
    };
  }

  /**
   * Initialize the autonomous agent
   */
  async init(): Promise<void> {
    // Load config from file if exists
    try {
      const configData = await fs.readFile(CONFIG_PATH, 'utf-8');
      const fileConfig = JSON.parse(configData) as Partial<AutonomousConfig>;
      this.config = { ...this.config, ...fileConfig };
    } catch {
      // Use defaults
    }

    // Load previous state
    try {
      const stateData = await fs.readFile(STATE_PATH, 'utf-8');
      const prevState = JSON.parse(stateData) as Partial<AgentState>;
      this.state.tasksProcessed = prevState.tasksProcessed ?? 0;
    } catch {
      // Fresh state
    }

    // Initialize queue
    await this.queue.init();

    // Initialize Pushover if configured
    if (this.config.pushover?.userKey && this.config.pushover?.apiToken) {
      this.pushover = new PushoverClient({
        userKey: this.config.pushover.userKey,
        apiToken: this.config.pushover.apiToken,
        deviceId: this.config.pushover.deviceId,
        secret: this.config.pushover.secret,
      });
    }

    // Initialize Claude if configured
    if (this.config.claude?.apiKey) {
      this.claude = new ClaudeClient({
        apiKey: this.config.claude.apiKey,
        model: this.config.claude.model,
        maxTokens: this.config.claude.maxTokens,
      });
    }

    this.eventBus.emit('agent:started', {
      agent: 'autonomous',
      timestamp: new Date(),
    });
  }

  /**
   * Start the autonomous agent loop
   */
  async start(): Promise<void> {
    if (this.running) return;

    await this.init();

    if (!this.config.enabled) {
      // eslint-disable-next-line no-console
      console.log('Autonomous agent is disabled in config');
      return;
    }

    this.running = true;
    this.state.running = true;
    this.state.startedAt = new Date().toISOString();

    await this.saveState();

    // No notification on startup - saves tokens and reduces noise
    // Only notify on errors or important events

    // Start polling loop
    void this.poll();

    // eslint-disable-next-line no-console
    console.log('Autonomous agent started');
  }

  /**
   * Stop the autonomous agent
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;
    this.state.running = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    await this.saveState();

    // No notification on shutdown - saves tokens and reduces noise

    this.eventBus.emit('agent:stopped', {
      agent: 'autonomous',
      reason: 'manual stop',
    });

    // eslint-disable-next-line no-console
    console.log('Autonomous agent stopped');
  }

  /**
   * Main polling loop
   */
  private async poll(): Promise<void> {
    if (!this.running) return;

    try {
      // Check for Pushover messages
      await this.checkPushoverMessages();

      // Process pending tasks
      await this.processNextTask();

      // Periodic cleanup
      if (Math.random() < 0.01) { // ~1% chance each poll
        await this.queue.cleanup(24);
      }

      this.state.lastActivity = new Date().toISOString();
    } catch (error) {
      this.state.errors++;
      // eslint-disable-next-line no-console
      console.error('Poll error:', error);

      // Notify on repeated errors
      if (this.state.errors % 10 === 0 && this.pushover) {
        await this.pushover.sendStatus('error', `${this.state.errors} errors`);
      }
    }

    // Schedule next poll
    this.pollTimer = setTimeout(() => { void this.poll(); }, this.config.pollIntervalMs);
  }

  /**
   * Check for incoming Pushover messages
   */
  private async checkPushoverMessages(): Promise<void> {
    if (!this.pushover || !this.config.pushover?.secret) return;

    const messages = await this.pushover.fetchMessages();

    for (const msg of messages) {
      await this.handlePushoverMessage(msg);
    }
  }

  /**
   * Handle an incoming Pushover message as a command
   */
  private async handlePushoverMessage(msg: PushoverMessage): Promise<void> {
    // Add to task queue
    const task = await this.queue.add(
      msg.message,
      'pushover',
      msg.priority && msg.priority >= 1 ? 'high' : 'normal',
      { pushoverMessageId: msg.id, umid: msg.umid }
    );

    // Acknowledge message
    if (this.pushover) {
      await this.pushover.deleteMessages(msg.id);
    }

    // eslint-disable-next-line no-console
    console.log(`Received Pushover command: ${task.id}`);
  }

  /**
   * Process the next task in queue
   */
  private async processNextTask(): Promise<void> {
    const task = await this.queue.getNext();
    if (!task) return;

    await this.processTask(task);
  }

  /**
   * Process a single task
   */
  private async processTask(task: Task): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`Processing task: ${task.id}`);

    await this.queue.updateStatus(task.id, 'processing');

    try {
      if (!this.claude) {
        throw new Error('Claude API not configured');
      }

      // Parse the command
      const command = await this.claude.parseCommand(task.content);

      // Check if confirmation is required
      if (command.requiresConfirmation && this.config.security?.requireConfirmation) {
        // For now, auto-confirm queries, require manual confirm for executes
        if (command.type !== 'query' && command.type !== 'status' && command.type !== 'help') {
          // Send confirmation request
          if (this.pushover) {
            await this.pushover.send(
              `Confirm: ${command.content.slice(0, 200)}`,
              { title: 'ARI: Confirm?', priority: 1 }
            );
          }
          // Mark as pending confirmation
          await this.queue.updateStatus(task.id, 'pending', 'Awaiting confirmation');
          return;
        }
      }

      // Process the command
      const response = await this.claude.processCommand(command);

      // Update task
      await this.queue.updateStatus(
        task.id,
        response.success ? 'completed' : 'failed',
        response.message,
        response.success ? undefined : response.message
      );

      // Notify completion
      if (this.pushover) {
        const summary = await this.claude.summarize(response.message, 400);
        await this.pushover.sendTaskComplete(task.id, response.success, summary);
      }

      this.state.tasksProcessed++;
      await this.saveState();

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      await this.queue.updateStatus(task.id, 'failed', undefined, errorMsg);

      if (this.pushover) {
        await this.pushover.send(
          `Task failed: ${errorMsg.slice(0, 200)}`,
          { title: 'ARI: Error', priority: 1 }
        );
      }

      this.state.errors++;
      await this.saveState();
    }
  }

  /**
   * Add a task directly (from API or internal)
   */
  async addTask(
    content: string,
    priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'
  ): Promise<Task> {
    return this.queue.add(content, 'api', priority);
  }

  /**
   * Get agent status
   */
  getStatus(): AgentState & { queueStats?: Record<string, number> } {
    return { ...this.state };
  }

  /**
   * Save agent state to disk
   */
  private async saveState(): Promise<void> {
    const dir = path.dirname(STATE_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(STATE_PATH, JSON.stringify(this.state, null, 2));
  }

  /**
   * Update configuration
   */
  async updateConfig(newConfig: Partial<AutonomousConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };

    const dir = path.dirname(CONFIG_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(CONFIG_PATH, JSON.stringify(this.config, null, 2));

    // Reinitialize if running
    if (this.running) {
      await this.stop();
      await this.start();
    }
  }
}
