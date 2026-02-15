/**
 * ARI Autonomous Agent Types
 *
 * These types define the autonomous operation layer that allows ARI
 * to work independently and receive commands via Telegram, queue, or schedule.
 */

import { z } from 'zod';

// ── Task Types ─────────────────────────────────────────────────────────────

export const TaskPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const TaskStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskSourceSchema = z.enum(['telegram', 'queue', 'schedule', 'internal', 'api']);
export type TaskSource = z.infer<typeof TaskSourceSchema>;

export const TaskSchema = z.object({
  id: z.string().uuid(),
  content: z.string().min(1).max(10000),
  source: TaskSourceSchema,
  priority: TaskPrioritySchema.default('normal'),
  status: TaskStatusSchema.default('pending'),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  result: z.string().optional(),
  error: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type Task = z.infer<typeof TaskSchema>;

// ── Agent Config ───────────────────────────────────────────────────────────

export const AutonomousConfigSchema = z.object({
  enabled: z.boolean().default(false),
  pollIntervalMs: z.number().min(1000).default(5000),
  maxConcurrentTasks: z.number().min(1).max(5).default(1),
  claude: z.object({
    apiKey: z.string().optional(),
    model: z.string().default('claude-sonnet-4-20250514'),
    maxTokens: z.number().default(4096),
  }).optional(),
  security: z.object({
    requireConfirmation: z.boolean().default(true),
    allowedCommands: z.array(z.string()).default([]),
    blockedPatterns: z.array(z.string()).default([]),
  }).optional(),
});

export type AutonomousConfig = z.infer<typeof AutonomousConfigSchema>;

// ── Command Types ──────────────────────────────────────────────────────────

export const CommandTypeSchema = z.enum([
  'query',      // Ask a question, get information
  'execute',    // Run a command/task
  'status',     // Check system status
  'config',     // Configuration change
  'cancel',     // Cancel a task
  'help',       // Get help
]);

export type CommandType = z.infer<typeof CommandTypeSchema>;

export interface ParsedCommand {
  type: CommandType;
  content: string;
  parameters: Record<string, unknown>;
  requiresConfirmation: boolean;
}

// ── Response Types ─────────────────────────────────────────────────────────

export interface AgentResponse {
  success: boolean;
  message: string;
  data?: unknown;
  taskId?: string;
  duration?: number;
}

// ── AI Provider Interface ─────────────────────────────────────────────────

/**
 * AI capabilities required by AutonomousAgent.
 * AIOrchestrator satisfies this interface natively.
 */
export interface AutonomousAIProvider {
  query(question: string, agent?: string): Promise<string>;
  summarize(text: string, maxLength?: number, agent?: string): Promise<string>;
  chat(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemPrompt?: string,
    agent?: string,
  ): Promise<string>;
}

// ── Notification Channel Types ─────────────────────────────────────────────

export const NotificationPrioritySchema = z.enum(['P0', 'P1', 'P2', 'P3', 'P4']);
export type NotificationPriority = z.infer<typeof NotificationPrioritySchema>;

export const NotificationChannelSchema = z.enum(['sms', 'notion', 'both']);
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;

export const SMSConfigSchema = z.object({
  enabled: z.boolean().default(false),
  gmailUser: z.string().email().optional(),
  gmailAppPassword: z.string().optional(),
  carrierGateway: z.string().default('vtext.com'), // Verizon gateway
  phoneNumber: z.string().optional(), // 10-digit, no country code
  quietHoursStart: z.number().min(0).max(23).default(22), // 10 PM
  quietHoursEnd: z.number().min(0).max(23).default(7), // 7 AM
  maxPerHour: z.number().default(5), // Rate limit (except P0)
  timezone: z.string().default('America/Indiana/Indianapolis'),
});

export type SMSConfig = z.infer<typeof SMSConfigSchema>;

export const NotionConfigSchema = z.object({
  enabled: z.boolean().default(false),
  apiKey: z.string().optional(),
  inboxDatabaseId: z.string().optional(),
  dailyLogParentId: z.string().optional(), // Parent page for daily logs
});

export type NotionConfig = z.infer<typeof NotionConfigSchema>;

export const NotificationEntrySchema = z.object({
  id: z.string().uuid(),
  priority: NotificationPrioritySchema,
  title: z.string().max(100),
  body: z.string().max(2000),
  category: z.string(),
  channel: NotificationChannelSchema,
  sentAt: z.string().datetime().optional(),
  queuedAt: z.string().datetime().optional(),
  queuedFor: z.string().datetime().optional(), // Scheduled delivery time
  notionPageId: z.string().optional(),
  smsSent: z.boolean().default(false),
  notionSent: z.boolean().default(false),
  dedupKey: z.string().optional(), // For deduplication
  escalationCount: z.number().default(0), // Track repeated issues
});

export type NotificationEntry = z.infer<typeof NotificationEntrySchema>;

export const QueuedNotificationSchema = z.object({
  entry: NotificationEntrySchema,
  scheduledFor: z.string().datetime(),
  reason: z.string(), // Why it was queued (quiet hours, rate limit, etc.)
});

export type QueuedNotification = z.infer<typeof QueuedNotificationSchema>
