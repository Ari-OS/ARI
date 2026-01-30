/**
 * ARI SMS Integration
 *
 * Two-way SMS communication via Gmail SMTP/IMAP and carrier gateways.
 * Free alternative to Twilio that works with most US carriers.
 *
 * Key components:
 * - GmailSMS: Send SMS via SMTP
 * - GmailReceiver: Receive SMS via IMAP
 * - SMSExecutor: Execute actions from SMS commands
 * - SMSConversation: Full two-way conversation handler
 */

export { GmailSMS, type SMSResult } from './gmail-sms.js';
export { GmailReceiver, type IncomingSMS, type ReceiverConfig } from './gmail-receiver.js';
export { SMSExecutor, smsExecutor, type ActionResult, type ParsedAction } from './sms-executor.js';
export {
  SMSConversation,
  createSMSConversation,
  type ConversationMessage,
  type ConversationContext,
  type SMSConversationConfig,
} from './sms-conversation.js';
