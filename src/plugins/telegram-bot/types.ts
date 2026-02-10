import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// TELEGRAM BOT PLUGIN TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export const TelegramBotConfigSchema = z.object({
  botToken: z.string().min(1).optional(),
  allowedUserIds: z.array(z.number()).default([]),
  ownerUserId: z.number().optional(),
  rateLimit: z.object({
    perChat: z.number().default(1),     // 1 msg/sec per chat
    global: z.number().default(30),     // 30 msg/sec global
  }).default({}),
  features: z.object({
    crypto: z.boolean().default(true),
    pokemon: z.boolean().default(true),
    tts: z.boolean().default(true),
    dev: z.boolean().default(false),
  }).default({}),
});
export type TelegramBotConfig = z.infer<typeof TelegramBotConfigSchema>;

export interface TelegramCommandContext {
  command: string;
  args: string;
  userId: number;
  chatId: number;
  username?: string;
}
