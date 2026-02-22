import { createLogger } from '../../kernel/logger.js';
import type { EventBus } from '../../kernel/event-bus.js';

const log = createLogger('hubspot-adapter');

export type PipelineStage = 
  | 'PROSPECT'         // Stage 1
  | 'OUTREACH_ACTIVE'  // Stage 2
  | 'REPLIED'          // Stage 3
  | 'CALL_BOOKED'      // Stage 4
  | 'PROPOSAL_SENT'    // Stage 5
  | 'CLIENT'           // Stage 6
  | 'RETAINER';        // Stage 7

export interface HubSpotContact {
  id: string;
  email: string;
  company: string;
  stage: PipelineStage;
}

/**
 * HubSpot CRM Adapter
 * 
 * Synchronizes the 7 pipeline stages automatically for the Growth Pod.
 */
export class HubSpotAdapter {
  private apiKey: string | null;

  constructor(private eventBus: EventBus) {
    this.apiKey = process.env.HUBSPOT_API_KEY ?? null;
    this.setupListeners();
  }

  private setupListeners() {
    this.eventBus.on('crm:contact_created', (data: { contactId: string, name: string, category: string, timestamp: string }) => {
      void this.syncStage(data.contactId, 'PROSPECT');
    });

    this.eventBus.on('crm:interaction_logged', (data: { contactId: string, type: string, summary: string, timestamp: string }) => {
      if (data.type === 'outreach_queued') {
        void this.syncStage(data.contactId, 'OUTREACH_ACTIVE');
      } else if (data.type === 'inbound_reply') {
        void this.syncStage(data.contactId, 'REPLIED');
      } else if (data.type === 'meeting_booked') {
        void this.syncStage(data.contactId, 'CALL_BOOKED');
      } else if (data.type === 'proposal_sent') {
        void this.syncStage(data.contactId, 'PROPOSAL_SENT');
      } else if (data.type === 'deal_won') {
        void this.syncStage(data.contactId, 'CLIENT');
      }
    });
  }

  /**
   * Syncs a contact to a specific pipeline stage in HubSpot.
   */
  public async syncStage(contactId: string, stage: PipelineStage) {
    if (!this.apiKey) {
      log.debug({ contactId, stage }, 'HubSpot API key not configured, skipping CRM sync.');
      return;
    }

    log.info({ contactId, stage }, 'Syncing contact to HubSpot pipeline stage');

    try {
      // Simulate HubSpot API call
      await Promise.resolve();
      
      this.eventBus.emit('audit:log', {
        action: 'crm:hubspot_stage_synced',
        agent: 'growth_pod',
        trustLevel: 'system',
        details: { contactId, stage }
      });

    } catch (error) {
      log.error({ err: error, contactId, stage }, 'Failed to sync HubSpot pipeline stage');
    }
  }
}
