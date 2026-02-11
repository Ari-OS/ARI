/**
 * ARI Telegram Integration
 *
 * Outbound notification delivery via the Telegram Bot API.
 * For bidirectional chat, see src/plugins/telegram-bot/.
 */

export { TelegramSender, type TelegramSendResult, type TelegramSenderConfig } from './sender.js';
