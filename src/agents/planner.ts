import { randomUUID } from 'crypto';
import type { AuditLogger } from '../kernel/audit.js';
import type { EventBus } from '../kernel/event-bus.js';
import type { AgentId } from '../kernel/types.js';

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
type PlanStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

interface Task {
  id: string;
  name: string;
  description: string;
  status: TaskStatus;
  dependencies: string[];
  assigned_to?: AgentId;
  priority: TaskPriority;
  created_at: Date;
  completed_at?: Date;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  tasks: Task[];
  status: PlanStatus;
  created_by: AgentId;
  created_at: Date;
}

/**
 * Planner - Task decomposition and dependency management
 * Breaks down complex tasks into manageable steps with dependency tracking
 */
export class Planner {
  private readonly auditLogger: AuditLogger;
  private readonly eventBus: EventBus;
  private plans = new Map<string, Plan>();

  constructor(auditLogger: AuditLogger, eventBus: EventBus) {
    this.auditLogger = auditLogger;
    this.eventBus = eventBus;
  }

  /**
   * Create a new plan
   */
  async createPlan(name: string, description: string, agent: AgentId): Promise<string> {
    const id = randomUUID();
    const plan: Plan = {
      id,
      name,
      description,
      tasks: [],
      status: 'pending',
      created_by: agent,
      created_at: new Date(),
    };

    this.plans.set(id, plan);

    await this.auditLogger.log('plan:create', agent, 'standard', {
      plan_id: id,
      name,
    });

    return id;
  }

  /**
   * Add a task to a plan
   */
  async addTask(
    planId: string,
    task: Omit<Task, 'id' | 'created_at' | 'completed_at'>
  ): Promise<string> {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    // Validate dependencies exist
    for (const depId of task.dependencies) {
      const depExists = plan.tasks.some((t) => t.id === depId);
      if (!depExists) {
        throw new Error(`Dependency task ${depId} not found in plan`);
      }
    }

    // Validate no circular dependencies
    const taskId = randomUUID();
    const wouldCreateCycle = this.wouldCreateCycle(plan, taskId, task.dependencies);
    if (wouldCreateCycle) {
      throw new Error('Adding this task would create a circular dependency');
    }

    const newTask: Task = {
      id: taskId,
      ...task,
      created_at: new Date(),
    };

    plan.tasks.push(newTask);

    // Update plan status if it was pending
    if (plan.status === 'pending') {
      plan.status = 'in_progress';
    }

    await this.auditLogger.log('plan:add_task', plan.created_by, 'standard', {
      plan_id: planId,
      task_id: taskId,
      task_name: task.name,
      dependencies: task.dependencies,
    });

    return taskId;
  }

  /**
   * Update task status
   */
  async updateTaskStatus(
    planId: string,
    taskId: string,
    status: TaskStatus
  ): Promise<void> {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    const task = plan.tasks.find((t) => t.id === taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found in plan ${planId}`);
    }

    const oldStatus = task.status;
    task.status = status;

    if (status === 'completed' || status === 'failed') {
      task.completed_at = new Date();
    }

    // Update plan status
    this.updatePlanStatus(plan);

    await this.auditLogger.log('plan:update_task', plan.created_by, 'standard', {
      plan_id: planId,
      task_id: taskId,
      old_status: oldStatus,
      new_status: status,
    });
  }

  /**
   * Get next available tasks (all dependencies met)
   */
  getNextTasks(planId: string): Task[] {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    return plan.tasks.filter((task) => {
      // Task must be pending
      if (task.status !== 'pending') {
        return false;
      }

      // All dependencies must be completed
      return task.dependencies.every((depId) => {
        const dep = plan.tasks.find((t) => t.id === depId);
        return dep?.status === 'completed';
      });
    });
  }

  /**
   * Get a plan by ID
   */
  getPlan(planId: string): Plan | null {
    const plan = this.plans.get(planId);
    return plan || null;
  }

  /**
   * Get all plans
   */
  getPlans(): Plan[] {
    return Array.from(this.plans.values());
  }

  /**
   * Update plan status based on task statuses
   */
  private updatePlanStatus(plan: Plan): void {
    const allCompleted = plan.tasks.every((t) => t.status === 'completed');
    const anyFailed = plan.tasks.some((t) => t.status === 'failed');
    const anyInProgress = plan.tasks.some((t) => t.status === 'in_progress');

    if (allCompleted && plan.tasks.length > 0) {
      plan.status = 'completed';
    } else if (anyFailed) {
      plan.status = 'failed';
    } else if (anyInProgress || plan.tasks.some((t) => t.status === 'pending')) {
      plan.status = 'in_progress';
    }
  }

  /**
   * Check if adding a task with given dependencies would create a cycle
   */
  private wouldCreateCycle(
    plan: Plan,
    newTaskId: string,
    dependencies: string[]
  ): boolean {
    // Build adjacency list including the new task
    const graph = new Map<string, string[]>();

    // Add existing tasks
    for (const task of plan.tasks) {
      graph.set(task.id, task.dependencies);
    }

    // Add new task
    graph.set(newTaskId, dependencies);

    // Detect cycle using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (taskId: string): boolean => {
      if (!visited.has(taskId)) {
        visited.add(taskId);
        recursionStack.add(taskId);

        const deps = graph.get(taskId) || [];
        for (const dep of deps) {
          if (!visited.has(dep)) {
            if (hasCycle(dep)) {
              return true;
            }
          } else if (recursionStack.has(dep)) {
            return true;
          }
        }
      }

      recursionStack.delete(taskId);
      return false;
    };

    // Check from the new task
    return hasCycle(newTaskId);
  }
}
