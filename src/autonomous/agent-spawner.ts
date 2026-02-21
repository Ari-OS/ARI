/**
 * ARI Agent Spawner
 *
 * Manages spawned subagents running in isolated git worktrees.
 * Enables parallel task execution with full isolation:
 * - Each agent gets its own worktree on a dedicated branch
 * - Tmux sessions for process management
 * - Progress tracking and result collection
 * - Health checks every 15 minutes via scheduler
 *
 * This is how ARI scales to complex multi-step tasks.
 */

import { EventBus } from '../kernel/event-bus.js';
import type { AgentId } from '../kernel/types.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';

const execFileAsync = promisify(execFile);

const SPAWNER_STATE_PATH = path.join(
  process.env.HOME || '~',
  '.ari',
  'spawned-agents.json'
);

const WORKTREES_PATH = path.join(
  process.env.HOME || '~',
  '.ari',
  'worktrees'
);

export interface SpawnedAgent {
  id: string;
  worktreePath: string;
  branch: string;
  task: string;
  status: 'spawning' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  pid?: number;
  tmuxSession?: string;
  result?: unknown;
  error?: string;
  progress?: number;
  lastMessage?: string;
}

interface SpawnerState {
  agents: Record<string, SpawnedAgent>;
  lastCheck: string;
}

export class AgentSpawner {
  private eventBus: EventBus;
  private projectRoot: string;
  private agents: Map<string, SpawnedAgent> = new Map();

  constructor(eventBus: EventBus, projectRoot: string) {
    this.eventBus = eventBus;
    this.projectRoot = projectRoot;
  }

  /**
   * Initialize the spawner
   */
  async init(): Promise<void> {
    await fs.mkdir(WORKTREES_PATH, { recursive: true });
    await this.loadState();
  }

  /**
   * Spawn an agent in a new git worktree
   */
  async spawnInWorktree(
    task: string,
    branch: string,
    options: {
      baseBranch?: string;
      useExistingBranch?: boolean;
    } = {}
  ): Promise<SpawnedAgent> {
    const { baseBranch = 'main', useExistingBranch = false } = options;

    const agentId = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const worktreePath = path.join(WORKTREES_PATH, agentId);
    const branchName = useExistingBranch ? branch : `ari/${agentId}/${branch}`;

    const agent: SpawnedAgent = {
      id: agentId,
      worktreePath,
      branch: branchName,
      task,
      status: 'spawning',
      createdAt: new Date(),
    };

    this.agents.set(agentId, agent);
    await this.saveState();

    try {
      // Create branch if not using existing
      if (!useExistingBranch) {
        await execFileAsync('git', ['branch', branchName, baseBranch], {
          cwd: this.projectRoot,
        });
      }

      // Create worktree
      await execFileAsync(
        'git',
        ['worktree', 'add', worktreePath, branchName],
        { cwd: this.projectRoot }
      );

      // Start the agent in a tmux session
      const tmuxSession = `ari-${agentId}`;
      agent.tmuxSession = tmuxSession;

      // Create a task file for the agent to read
      const taskFilePath = path.join(worktreePath, '.ari-task.md');
      await fs.writeFile(taskFilePath, `# Task\n\n${task}\n`);

      // Spawn AutoDeveloper autonomously inside the worktree
      try {
        await execFileAsync(
          'tmux',
          ['new-session', '-d', '-s', tmuxSession, `cd ${worktreePath} && npx ari autodev --task .ari-task.md`],
          { cwd: worktreePath }
        );
      } catch {
        // If tmux fails (e.g. not installed), fallback to a simple background spawn
        // (In a real scenario, we might use pm2 or just let it run via child_process.spawn)
        const { spawn } = await import('node:child_process');
        const child = spawn('npx', ['ari', 'autodev', '--task', '.ari-task.md'], {
          cwd: worktreePath,
          detached: true,
          stdio: 'ignore'
        });
        child.unref();
      }

      agent.status = 'running';

      this.eventBus.emit('subagent:spawned', {
        taskId: task.slice(0, 50),
        agentId: 'executor' as AgentId,
        worktree: worktreePath,
      });

      await this.saveState();

      return agent;
    } catch (error) {
      agent.status = 'failed';
      agent.error =
        error instanceof Error ? error.message : 'Unknown error';
      await this.saveState();
      throw error;
    }
  }

  /**
   * Check status of all spawned agents
   * Called every 15 minutes by scheduler
   */
  async checkAgents(): Promise<void> {
    for (const agent of this.agents.values()) {
      if (agent.status !== 'running') continue;

      try {
        // Check if worktree still exists
        await fs.access(agent.worktreePath);

        // Check for completion marker
        const completionPath = path.join(
          agent.worktreePath,
          '.ari-completed'
        );
        try {
          const result = await fs.readFile(completionPath, 'utf-8');
          agent.status = 'completed';
          agent.completedAt = new Date();
          agent.result = JSON.parse(result);

          this.eventBus.emit('subagent:completed', {
            taskId: agent.task.slice(0, 50),
            success: true,
            result: agent.result,
          });
        } catch {
          // Not completed yet, check for progress
          const progressPath = path.join(
            agent.worktreePath,
            '.ari-progress'
          );
          try {
            const progress = await fs.readFile(progressPath, 'utf-8');
            const parsed = JSON.parse(progress) as { progress: number; message: string };
            agent.progress = parsed.progress;
            agent.lastMessage = parsed.message;

            this.eventBus.emit('subagent:progress', {
              taskId: agent.task.slice(0, 50),
              progress: parsed.progress,
              message: parsed.message,
            });
          } catch {
            // No progress file, agent still working
          }
        }

        // Check for failure marker
        const failurePath = path.join(agent.worktreePath, '.ari-failed');
        try {
          const errorContent = await fs.readFile(failurePath, 'utf-8');
          agent.status = 'failed';
          agent.completedAt = new Date();
          agent.error = errorContent;

          this.eventBus.emit('subagent:completed', {
            taskId: agent.task.slice(0, 50),
            success: false,
          });
        } catch {
          // Not failed
        }
      } catch {
        // Worktree doesn't exist anymore
        agent.status = 'failed';
        agent.error = 'Worktree removed unexpectedly';
      }
    }

    await this.saveState();
  }

  /**
   * Collect results from a completed agent
   */
  collectResults(agentId: string): unknown {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    if (agent.status !== 'completed') {
      throw new Error(`Agent ${agentId} not completed (status: ${agent.status})`);
    }

    return agent.result;
  }

  /**
   * Clean up a completed agent's worktree
   */
  async cleanup(agentId: string, options: { deleteBranch?: boolean } = {}): Promise<void> {
    const { deleteBranch = false } = options;
    const agent = this.agents.get(agentId);

    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Remove worktree
    try {
      await execFileAsync('git', ['worktree', 'remove', agent.worktreePath], {
        cwd: this.projectRoot,
      });
    } catch {
      // Force remove if normal remove fails
      try {
        await execFileAsync(
          'git',
          ['worktree', 'remove', '--force', agent.worktreePath],
          { cwd: this.projectRoot }
        );
      } catch {
        // Worktree might already be removed
      }
    }

    // Optionally delete the branch
    if (deleteBranch && agent.branch.startsWith('ari/')) {
      try {
        await execFileAsync('git', ['branch', '-D', agent.branch], {
          cwd: this.projectRoot,
        });
      } catch {
        // Branch might not exist
      }
    }

    // Remove from tracking
    this.agents.delete(agentId);
    await this.saveState();
  }

  /**
   * Get all agents
   */
  getAgents(): SpawnedAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get a specific agent
   */
  getAgent(agentId: string): SpawnedAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get agents by status
   */
  getAgentsByStatus(
    status: SpawnedAgent['status']
  ): SpawnedAgent[] {
    return Array.from(this.agents.values()).filter(
      (a) => a.status === status
    );
  }

  /**
   * Clean up all completed/failed agents older than N hours
   */
  async cleanupOld(maxAgeHours: number = 24): Promise<number> {
    const now = Date.now();
    const maxAge = maxAgeHours * 60 * 60 * 1000;
    let cleaned = 0;

    for (const [agentId, agent] of this.agents.entries()) {
      if (
        agent.status === 'completed' ||
        agent.status === 'failed'
      ) {
        const age = now - agent.createdAt.getTime();
        if (age > maxAge) {
          await this.cleanup(agentId, { deleteBranch: true });
          cleaned++;
        }
      }
    }

    return cleaned;
  }

  /**
   * Load state from disk
   */
  private async loadState(): Promise<void> {
    try {
      const data = await fs.readFile(SPAWNER_STATE_PATH, 'utf-8');
      const state = JSON.parse(data) as SpawnerState;

      for (const [id, agentData] of Object.entries(state.agents)) {
        const agent = agentData;
        agent.createdAt = new Date(agent.createdAt);
        if (agent.completedAt) {
          agent.completedAt = new Date(agent.completedAt);
        }
        this.agents.set(id, agent);
      }
    } catch {
      // No state file
    }
  }

  /**
   * Save state to disk
   */
  private async saveState(): Promise<void> {
    const state: SpawnerState = {
      agents: Object.fromEntries(this.agents),
      lastCheck: new Date().toISOString(),
    };

    const dir = path.dirname(SPAWNER_STATE_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(SPAWNER_STATE_PATH, JSON.stringify(state, null, 2));
  }
}

/**
 * Create an agent spawner for a project
 */
export function createAgentSpawner(
  eventBus: EventBus,
  projectRoot: string
): AgentSpawner {
  return new AgentSpawner(eventBus, projectRoot);
}
