/**
 * NotificationRouter — Event-to-Notification Bridge
 *
 * Subscribes to critical EventBus events and routes them to the
 * NotificationManager for Telegram/SMS/Notion delivery.
 *
 * This is the missing link between components that emit events
 * (BudgetTracker, MarketMonitor, OpportunityScanner, etc.)
 * and the NotificationManager that delivers to the user.
 *
 * @module autonomous/notification-router
 */

import { createLogger } from '../kernel/logger.js';
import type { EventBus } from '../kernel/event-bus.js';
import { notificationManager } from './notification-manager.js';

const log = createLogger('notification-router');

export class NotificationRouter {
  private readonly eventBus: EventBus;
  private unsubscribers: Array<() => void> = [];
  private initialized = false;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.subscribeBudgetEvents();
    this.subscribeSecurityEvents();
    this.subscribeMarketEvents();
    this.subscribeOpsEvents();
    this.subscribeCareerEvents();
    this.subscribeGovernanceEvents();

    log.info('NotificationRouter initialized — %d event subscriptions active', this.unsubscribers.length);
  }

  // ── Budget Events ──────────────────────────────────────────────────────

  private subscribeBudgetEvents(): void {
    this.unsubscribers.push(
      this.eventBus.on('budget:warning', (payload) => {
        const pct = Math.round((payload.spent / (payload.spent + payload.remaining)) * 100);
        void notificationManager.budgetWarning(
          pct,
          payload.remaining,
          `Reduce non-essential operations. ${payload.remaining.toFixed(2)} remaining.`,
        );
        log.info('Routed budget:warning → Telegram (%d%% used)', pct);
      }),
    );

    this.unsubscribers.push(
      this.eventBus.on('budget:critical', (payload) => {
        const pct = Math.round((payload.spent / (payload.spent + payload.remaining)) * 100);
        void notificationManager.budgetCritical(pct);
        log.warn('Routed budget:critical → Telegram (%d%% used)', pct);
      }),
    );

    this.unsubscribers.push(
      this.eventBus.on('budget:pause', (payload) => {
        void notificationManager.budgetCritical(payload.percentUsed);
        log.warn('Routed budget:pause → Telegram (%d%% used)', payload.percentUsed);
      }),
    );

    this.unsubscribers.push(
      this.eventBus.on('budget:projection_exceeded', (payload) => {
        void notificationManager.notify({
          category: 'budget',
          title: 'Budget Projection Exceeded',
          body: `At current burn rate ($${payload.burnRate.toFixed(4)}/hr), projected spend exceeds budget by ${payload.percentOver}%. ~${payload.hoursRemaining.toFixed(1)}h until limit.`,
          priority: 'high',
          dedupKey: 'budget_projection',
        });
        log.warn('Routed budget:projection_exceeded → Telegram');
      }),
    );
  }

  // ── Security Events ────────────────────────────────────────────────────

  private subscribeSecurityEvents(): void {
    this.unsubscribers.push(
      this.eventBus.on('security:alert', (payload) => {
        void notificationManager.security(
          `Security Alert: ${payload.type}`,
          `Source: ${payload.source}\nDetails: ${JSON.stringify(payload.data)}`,
        );
        log.warn('Routed security:alert → Telegram (type: %s)', payload.type);
      }),
    );
  }

  // ── Market & Investment Events ─────────────────────────────────────────

  private subscribeMarketEvents(): void {
    this.unsubscribers.push(
      this.eventBus.on('investment:opportunity_detected', (payload) => {
        // Only forward opportunities scoring >= 75 (filter out noise)
        if (payload.score < 75) {
          log.info('Suppressed investment:opportunity_detected (score: %d < 75)', payload.score);
          return;
        }
        void notificationManager.opportunity(
          `${payload.category}: ${payload.title}`,
          `Score: ${payload.score}/100`,
          payload.score >= 85 ? 'high' : 'medium',
        );
        log.info('Routed investment:opportunity_detected → Telegram (score: %d)', payload.score);
      }),
    );
  }

  // ── Operations Events ──────────────────────────────────────────────────

  private subscribeOpsEvents(): void {
    this.unsubscribers.push(
      this.eventBus.on('ops:backup_failed', (payload) => {
        void notificationManager.error(
          'Backup Failed',
          `Type: ${payload.type}\nError: ${payload.error}`,
        );
        log.error('Routed ops:backup_failed → Telegram (type: %s)', payload.type);
      }),
    );
  }

  // ── Career Events ──────────────────────────────────────────────────────

  private subscribeCareerEvents(): void {
    this.unsubscribers.push(
      this.eventBus.on('career:new_matches', (payload) => {
        if (payload.count > 0) {
          void notificationManager.opportunity(
            `${payload.count} Career Match${payload.count > 1 ? 'es' : ''} Found`,
            `Top match: ${payload.topMatch}`,
            'medium',
          );
          log.info('Routed career:new_matches → Telegram (%d matches)', payload.count);
        }
      }),
    );
  }

  // ── Governance Events ─────────────────────────────────────────────

  private subscribeGovernanceEvents(): void {
    this.unsubscribers.push(
      this.eventBus.on('vote:completed', (payload) => {
        void notificationManager.notify({
          category: 'governance',
          title: `Vote: ${payload.status}`,
          body: `Vote ${payload.voteId} resolved: ${payload.status}`,
          priority: payload.status === 'VETOED' ? 'high' : 'normal',
          dedupKey: `vote_${payload.voteId}`,
        });
        log.info('Routed vote:completed → Telegram (status: %s)', payload.status);
      }),
    );

    this.unsubscribers.push(
      this.eventBus.on('vote:vetoed', (payload) => {
        void notificationManager.notify({
          category: 'governance',
          title: `Veto: ${payload.domain}`,
          body: `${payload.vetoer} vetoed ${payload.domain}: ${payload.reason}`,
          priority: 'high',
          dedupKey: `veto_${payload.voteId}`,
        });
        log.warn('Routed vote:vetoed → Telegram (vetoer: %s)', payload.vetoer);
      }),
    );
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  destroy(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    this.initialized = false;
    log.info('NotificationRouter destroyed');
  }

  getStatus(): { initialized: boolean; subscriptionCount: number } {
    return {
      initialized: this.initialized,
      subscriptionCount: this.unsubscribers.length,
    };
  }
}
