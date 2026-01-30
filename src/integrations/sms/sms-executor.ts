/**
 * ARI SMS Action Executor
 *
 * Executes real actions based on SMS commands.
 * This is what makes ARI actually DO things when you text.
 *
 * Actions:
 * - Run shell commands
 * - Query system status
 * - Manage tasks
 * - Send notifications
 * - Execute ARI commands
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { dailyAudit } from '../../autonomous/daily-audit.js';
import { taskQueue } from '../../autonomous/task-queue.js';
import { notificationManager } from '../../autonomous/notification-manager.js';

const execAsync = promisify(exec);

export interface ActionResult {
  success: boolean;
  output: string;
  action: string;
}

export interface ParsedAction {
  type: 'shell' | 'status' | 'task' | 'notify' | 'file' | 'query' | 'unknown';
  command: string;
  args: string[];
  requiresConfirmation: boolean;
}

// Safe shell commands that don't require confirmation
const SAFE_COMMANDS = new Set([
  'ls', 'pwd', 'date', 'uptime', 'whoami', 'hostname',
  'df', 'free', 'ps', 'top', 'htop', 'cat', 'head', 'tail',
  'grep', 'find', 'which', 'echo', 'wc', 'sort', 'uniq',
  'git status', 'git log', 'git branch', 'git diff',
  'npm ls', 'npm outdated', 'npm test', 'npm run build',
  'node -v', 'npm -v', 'python --version',
]);

// Dangerous patterns that are blocked
const BLOCKED_PATTERNS = [
  /rm\s+-rf?\s+[\/~]/i,        // rm -rf with root paths
  /mkfs/i,                      // Filesystem format
  /dd\s+if=/i,                  // Disk operations
  />\s*\/dev\//i,               // Writing to devices
  /chmod\s+777/i,               // Insecure permissions
  /curl.*\|\s*sh/i,             // Pipe to shell
  /wget.*\|\s*sh/i,             // Pipe to shell
  /eval\s*\(/i,                 // Eval
  /:(){.*}:/i,                  // Fork bomb
];

export class SMSExecutor {
  private ariRoot: string;
  private allowedPaths: Set<string>;

  constructor() {
    this.ariRoot = process.env.ARI_ROOT || path.join(process.env.HOME || '~', 'Work', 'ARI');
    this.allowedPaths = new Set([
      this.ariRoot,
      path.join(process.env.HOME || '~', '.ari'),
      '/tmp',
    ]);
  }

  /**
   * Parse an action from natural language
   */
  parseAction(input: string): ParsedAction {
    const lower = input.toLowerCase().trim();

    // Status queries
    if (lower.match(/^(status|how are you|health|check)/)) {
      return { type: 'status', command: 'status', args: [], requiresConfirmation: false };
    }

    // Task management
    if (lower.match(/^(task|add task|new task|todo)/)) {
      const taskContent = input.replace(/^(task|add task|new task|todo)\s*/i, '').trim();
      return { type: 'task', command: 'add', args: [taskContent], requiresConfirmation: false };
    }

    // Notifications
    if (lower.match(/^(notify|remind|alert)/)) {
      const content = input.replace(/^(notify|remind|alert)\s*/i, '').trim();
      return { type: 'notify', command: 'send', args: [content], requiresConfirmation: false };
    }

    // File operations (read only for safety)
    if (lower.match(/^(read|show|cat|view)\s+/)) {
      const filePath = input.replace(/^(read|show|cat|view)\s+/i, '').trim();
      return { type: 'file', command: 'read', args: [filePath], requiresConfirmation: false };
    }

    // Shell commands
    if (lower.startsWith('run ') || lower.startsWith('exec ') || lower.startsWith('$ ')) {
      const cmd = input.replace(/^(run|exec|\$)\s+/i, '').trim();
      const isSafe = this.isSafeCommand(cmd);
      return { type: 'shell', command: cmd, args: [], requiresConfirmation: !isSafe };
    }

    // Direct shell if it looks like a command
    if (lower.match(/^(git|npm|node|python|ls|cd|pwd|cat|grep|find|ps|df)/)) {
      const isSafe = this.isSafeCommand(input);
      return { type: 'shell', command: input, args: [], requiresConfirmation: !isSafe };
    }

    // Query - let Claude answer
    return { type: 'query', command: input, args: [], requiresConfirmation: false };
  }

  /**
   * Check if a command is safe to run without confirmation
   */
  private isSafeCommand(cmd: string): boolean {
    // Check for blocked patterns
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(cmd)) {
        return false;
      }
    }

    // Check if it's in safe list
    const baseCmd = cmd.split(' ').slice(0, 2).join(' ').toLowerCase();
    if (SAFE_COMMANDS.has(baseCmd) || SAFE_COMMANDS.has(cmd.split(' ')[0])) {
      return true;
    }

    return false;
  }

  /**
   * Execute an action
   */
  async execute(action: ParsedAction): Promise<ActionResult> {
    try {
      switch (action.type) {
        case 'status':
          return await this.executeStatus();

        case 'task':
          return await this.executeTask(action.command, action.args);

        case 'notify':
          return await this.executeNotify(action.args);

        case 'file':
          return await this.executeFile(action.command, action.args);

        case 'shell':
          return await this.executeShell(action.command);

        case 'query':
          // Query type means Claude should handle it
          return { success: true, output: '', action: 'query' };

        default:
          return { success: false, output: 'Unknown action type', action: 'unknown' };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, output: msg, action: action.type };
    }
  }

  /**
   * Execute status check
   */
  private async executeStatus(): Promise<ActionResult> {
    const results: string[] = [];

    // System uptime
    try {
      const { stdout } = await execAsync('uptime');
      results.push(`Uptime: ${stdout.trim()}`);
    } catch {
      results.push('Uptime: unavailable');
    }

    // ARI task queue
    try {
      const pending = await taskQueue.list('pending');
      const completed = await taskQueue.list('completed');
      results.push(`Tasks: ${pending.length} pending, ${completed.length} done`);
    } catch {
      results.push('Tasks: unavailable');
    }

    // Notification status
    const notifyStatus = notificationManager.getStatus();
    results.push(`SMS: ${notifyStatus.sms.ready ? 'OK' : 'Down'}`);
    results.push(`Notion: ${notifyStatus.notion.ready ? 'OK' : 'Down'}`);

    return {
      success: true,
      output: results.join('. '),
      action: 'status',
    };
  }

  /**
   * Execute task management
   */
  private async executeTask(command: string, args: string[]): Promise<ActionResult> {
    if (command === 'add' && args[0]) {
      await taskQueue.init();
      const task = await taskQueue.add(args[0], 'api', 'normal', { source: 'sms' });

      await dailyAudit.logActivity(
        'task_completed',
        'Task Added via SMS',
        args[0],
        { outcome: 'success', details: { taskId: task.id } }
      );

      return {
        success: true,
        output: `Task added: ${task.id}`,
        action: 'task:add',
      };
    }

    return { success: false, output: 'Invalid task command', action: 'task' };
  }

  /**
   * Execute notification
   */
  private async executeNotify(args: string[]): Promise<ActionResult> {
    if (args[0]) {
      const result = await notificationManager.notify({
        category: 'milestone',
        title: 'SMS Reminder',
        body: args[0],
        priority: 'normal',
      });

      return {
        success: result.sent,
        output: result.sent ? 'Notification sent' : `Failed: ${result.reason}`,
        action: 'notify',
      };
    }

    return { success: false, output: 'No message provided', action: 'notify' };
  }

  /**
   * Execute file operation
   */
  private async executeFile(command: string, args: string[]): Promise<ActionResult> {
    if (command === 'read' && args[0]) {
      let filePath = args[0];

      // Resolve relative paths
      if (!path.isAbsolute(filePath)) {
        filePath = path.join(this.ariRoot, filePath);
      }

      // Security check - only allow reading from safe paths
      const isAllowed = [...this.allowedPaths].some((p) => filePath.startsWith(p));
      if (!isAllowed) {
        return { success: false, output: 'Path not allowed', action: 'file:read' };
      }

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        // Truncate for SMS
        const truncated = content.length > 500 ? content.slice(0, 497) + '...' : content;
        return { success: true, output: truncated, action: 'file:read' };
      } catch {
        return { success: false, output: 'File not found', action: 'file:read' };
      }
    }

    return { success: false, output: 'Invalid file command', action: 'file' };
  }

  /**
   * Execute shell command
   */
  private async executeShell(command: string): Promise<ActionResult> {
    // Final safety check
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(command)) {
        return { success: false, output: 'Command blocked for safety', action: 'shell' };
      }
    }

    await dailyAudit.logActivity(
      'api_call',
      'Shell Command via SMS',
      command.slice(0, 100),
      { outcome: 'pending' }
    );

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 30000, // 30 second timeout
        cwd: this.ariRoot,
        maxBuffer: 1024 * 1024, // 1MB
      });

      const output = stdout || stderr || 'Command completed';
      const truncated = output.length > 500 ? output.slice(0, 497) + '...' : output;

      await dailyAudit.logActivity(
        'task_completed',
        'Shell Command Success',
        command.slice(0, 50),
        { outcome: 'success' }
      );

      return { success: true, output: truncated.trim(), action: 'shell' };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Command failed';

      await dailyAudit.logActivity(
        'error_occurred',
        'Shell Command Failed',
        msg.slice(0, 100),
        { outcome: 'failure' }
      );

      return { success: false, output: msg.slice(0, 200), action: 'shell' };
    }
  }
}

export const smsExecutor = new SMSExecutor();
