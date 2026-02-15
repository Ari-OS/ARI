/**
 * ARI Telegram Integration
 *
 * Outbound notification delivery via the Telegram Bot API.
 * For bidirectional chat, see src/plugins/telegram-bot/.
 */

export { TelegramSender, type TelegramSendResult, type TelegramSenderConfig } from './sender.js';
export {
  TelegramTopicManager,
  type TopicKey,
  type TopicConfig,
  type TopicSendOptions,
  type TopicSendResult,
} from './topic-manager.js';
