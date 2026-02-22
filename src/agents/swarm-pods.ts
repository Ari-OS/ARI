import { createLogger } from '../kernel/logger.js';
import type { EventBus } from '../kernel/event-bus.js';
import type { AgentCoordinator } from './coordinator.js';

const log = createLogger('swarm-pods');

import type { CoordinatorTask } from './coordinator.js';

export type PodType = 'core' | 'production' | 'growth';

export interface PodConfig {
  coordinator: AgentCoordinator;
  eventBus: EventBus;
}

/**
 * Swarm Pod Manager
 * 
 * Orchestrates specialized agent teams ("Swarm Pods") for dedicated execution lanes.
 * 
 * - Core Pod: System health, memory optimization, security (Rust/WASM), financial API optimization.
 * - Production Pod: Trading Trail content generation, market analysis, video rendering.
 * - Growth Pod: Pryceless Solutions lead generation, CRM management, B2B marketing.
 */
export class SwarmPodManager {
  private coordinator: AgentCoordinator;
  private eventBus: EventBus;

  constructor(config: PodConfig) {
    this.coordinator = config.coordinator;
    this.eventBus = config.eventBus;
  }

  async dispatchToPod(podType: PodType, tasks: CoordinatorTask[]) {
    log.info({ podType, taskCount: tasks.length }, 'Dispatching to Swarm Pod');
    
    this.eventBus.emit('audit:log', {
      action: 'swarm_pod:dispatch',
      agent: 'system',
      trustLevel: 'system',
      details: { podType, taskCount: tasks.length }
    });

    return this.coordinator.dispatch(tasks);
  }

  async executeCorePodTask(task: CoordinatorTask) {
    return this.dispatchToPod('core', [task]);
  }

  async executeProductionPodTask(task: CoordinatorTask) {
    return this.dispatchToPod('production', [task]);
  }

  async executeGrowthPodTask(task: CoordinatorTask) {
    return this.dispatchToPod('growth', [task]);
  }
}
