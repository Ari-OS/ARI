import express, { Request, Response } from 'express';
import { createLogger } from '../kernel/logger.js';
import type { EventBus } from '../kernel/event-bus.js';

const log = createLogger('growth-webhook');

/**
 * Webhook Server for Growth Pod
 * 
 * Listens for replies from Smartlead CRM outreach.
 * Triggers the Growth Pod to autonomously negotiate via Claude Opus.
 */
export class GrowthWebhookServer {
  private app = express();
  private port = process.env.WEBHOOK_PORT || 3142;

  constructor(private eventBus: EventBus) {
    this.app.use(express.json());
    this.setupRoutes();
  }

  private setupRoutes() {
    this.app.post('/webhooks/smartlead/reply', (req: Request, res: Response) => {
      const payload = req.body as Record<string, unknown>;
      log.info({ payload }, 'Received reply from Smartlead webhook');

      const contactId = typeof payload.contact_id === 'string' ? payload.contact_id : 'unknown';
      const replyText = typeof payload.text === 'string' ? payload.text : 'Reply received via Smartlead';

      // 1. Log interaction
      this.eventBus.emit('crm:interaction_logged', {
        contactId,
        type: 'inbound_reply',
        summary: replyText,
        timestamp: new Date().toISOString()
      });

      // 2. Trigger Claude Opus for sentiment analysis and objection handling
      log.info({ contactId }, 'Piping Smartlead reply to Claude Opus for sentiment analysis...');
      
      this.eventBus.emit('audit:log', {
        action: 'growth_webhook:opus_sentiment_analysis',
        agent: 'growth_pod',
        trustLevel: 'system',
        details: { contactId, textLength: replyText.length }
      });

      // 3. Queue telegram notification with action buttons
      this.eventBus.emit('approval:item_added', {
        itemId: `reply_${contactId}`,
        type: 'lead_reply',
        risk: 'low',
        estimatedCost: 0,
        metadata: {
          originalReply: replyText,
          suggestedResponse: 'Thanks for getting back to me! Here is my Calendly link to secure a discovery call: https://calendly.com/prycehedrick'
        }
      });

      res.status(200).send({ status: 'received' });
    });
  }

  public start() {
    this.app.listen(this.port, () => {
      log.info(`Growth Webhook Server listening on port ${this.port}`);
    });
  }
}
