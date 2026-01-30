import { randomUUID } from 'crypto';
import type { EventBus } from '../kernel/event-bus.js';
import type { AuditLogger } from '../kernel/audit.js';
import type { TrustLevel } from '../kernel/types.js';
import {
  type SkillDefinition,
  type SkillExecutionContext,
  type SkillExecutionResult,
} from './types.js';
import { SkillValidator } from './validator.js';
import { SkillRegistry } from './registry.js';

/**
 * Execution Options
 */
export interface ExecutionOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Maximum tool executions */
  maxToolExecutions?: number;
  /** Dry run (don't actually execute) */
  dryRun?: boolean;
}

const DEFAULT_OPTIONS: ExecutionOptions = {
  timeout: 30000,
  maxToolExecutions: 10,
  dryRun: false,
};

/**
 * SkillExecutor
 *
 * Executes skills with permission checking and governance integration.
 */
export class SkillExecutor {
  private registry: SkillRegistry;
  private validator: SkillValidator;
  private eventBus: EventBus;
  private audit: AuditLogger;
  private activeExecutions: Map<string, { skill: string; startTime: Date }> = new Map();

  constructor(
    registry: SkillRegistry,
    eventBus: EventBus,
    audit: AuditLogger
  ) {
    this.registry = registry;
    this.validator = registry.getLoader().getValidator();
    this.eventBus = eventBus;
    this.audit = audit;
  }

  /**
   * Execute a skill by name
   */
  async execute(
    skillName: string,
    context: SkillExecutionContext,
    options?: ExecutionOptions
  ): Promise<SkillExecutionResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const startTime = Date.now();
    const executionId = randomUUID();

    // Get the skill
    const skill = this.registry.get(skillName);
    if (!skill) {
      return this.createResult(skillName, false, undefined, `Skill not found: ${skillName}`, startTime);
    }

    // Check skill status
    if (skill.status !== 'active') {
      return this.createResult(skillName, false, undefined, `Skill is not active: ${skill.status}`, startTime);
    }

    // Check if skill is enabled
    if (!skill.metadata.enabled) {
      return this.createResult(skillName, false, undefined, 'Skill is disabled', startTime);
    }

    // Validate permissions
    const permissionCheck = this.validator.validatePermissions(
      skill.metadata.permissions,
      context.trustLevel
    );

    if (permissionCheck.denied.length > 0) {
      await this.audit.log('skill_permission_denied', 'system', context.trustLevel, {
        skillName,
        deniedPermissions: permissionCheck.denied,
        reason: permissionCheck.reason,
      });

      return this.createResult(
        skillName,
        false,
        undefined,
        permissionCheck.reason || 'Permission denied',
        startTime
      );
    }

    // Check trust requirement
    if (!this.meetsRequirement(context.trustLevel, skill.metadata.trustRequired)) {
      await this.audit.log('skill_trust_denied', 'system', context.trustLevel, {
        skillName,
        required: skill.metadata.trustRequired,
        actual: context.trustLevel,
      });

      return this.createResult(
        skillName,
        false,
        undefined,
        `Insufficient trust level: requires ${skill.metadata.trustRequired}`,
        startTime
      );
    }

    // Track active execution
    this.activeExecutions.set(executionId, { skill: skillName, startTime: new Date() });

    try {
      // Log execution start
      await this.audit.log('skill_execution_start', 'system', context.trustLevel, {
        skillName,
        executionId,
        sessionId: context.sessionId,
        input: context.input.substring(0, 100), // Truncate for audit
      });

      // Dry run check
      if (opts.dryRun) {
        return this.createResult(
          skillName,
          true,
          `[DRY RUN] Would execute skill: ${skillName}\n\nContent:\n${skill.content}`,
          undefined,
          startTime
        );
      }

      // Execute the skill
      // Note: In a full implementation, this would:
      // 1. Parse the skill content for tool invocations
      // 2. Execute tools through the Executor agent
      // 3. Track tool executions
      // 4. Handle timeouts
      //
      // For now, we return the skill content as the "output"
      // The actual execution would be handled by the AI model
      // interpreting the skill instructions

      const output = this.formatSkillOutput(skill, context);

      await this.audit.log('skill_execution_complete', 'system', context.trustLevel, {
        skillName,
        executionId,
        duration: Date.now() - startTime,
        success: true,
      });

      return this.createResult(skillName, true, output, undefined, startTime);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.audit.log('skill_execution_error', 'system', context.trustLevel, {
        skillName,
        executionId,
        error: errorMessage,
        duration: Date.now() - startTime,
      });

      return this.createResult(skillName, false, undefined, errorMessage, startTime);
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Execute a skill matched from input
   */
  async executeMatch(
    input: string,
    trustLevel: TrustLevel,
    sessionId?: string,
    channelId?: string,
    options?: ExecutionOptions
  ): Promise<SkillExecutionResult | null> {
    const match = this.registry.findBestMatch(input);
    if (!match) return null;

    return this.execute(
      match.skill.metadata.name,
      {
        input,
        trustLevel,
        sessionId,
        channelId,
        trigger: match.trigger,
        context: { matchConfidence: match.confidence },
      },
      options
    );
  }

  /**
   * Format skill output for the AI model
   */
  private formatSkillOutput(skill: SkillDefinition, context: SkillExecutionContext): string {
    return `
<skill name="${skill.metadata.name}" version="${skill.metadata.version}">
<description>${skill.metadata.description}</description>
<permissions>${skill.metadata.permissions.join(', ') || 'none'}</permissions>
<tools>${skill.metadata.tools.map(t => typeof t === 'string' ? t : t.name).join(', ') || 'none'}</tools>

<instructions>
${skill.content}
</instructions>

<context>
Input: ${context.input}
Trust Level: ${context.trustLevel}
Session: ${context.sessionId || 'none'}
Channel: ${context.channelId || 'none'}
</context>
</skill>
`.trim();
  }

  /**
   * Check if trust level meets requirement
   */
  private meetsRequirement(actual: TrustLevel, required: string): boolean {
    const hierarchy = ['hostile', 'untrusted', 'standard', 'verified', 'operator', 'system'];
    const actualIndex = hierarchy.indexOf(actual);
    const requiredIndex = hierarchy.indexOf(required);
    return actualIndex >= requiredIndex;
  }

  /**
   * Create an execution result
   */
  private createResult(
    skillName: string,
    success: boolean,
    output?: string,
    error?: string,
    startTime?: number
  ): SkillExecutionResult {
    return {
      skillName,
      success,
      output,
      error,
      duration: startTime ? Date.now() - startTime : 0,
      toolsExecuted: [],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get active executions
   */
  getActiveExecutions(): Array<{ executionId: string; skill: string; startTime: Date }> {
    return Array.from(this.activeExecutions.entries()).map(([id, data]) => ({
      executionId: id,
      ...data,
    }));
  }

  /**
   * Cancel an active execution
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return false;

    // In a full implementation, this would interrupt the execution
    this.activeExecutions.delete(executionId);

    await this.audit.log('skill_execution_cancelled', 'system', 'system', {
      executionId,
      skill: execution.skill,
    });

    return true;
  }

  /**
   * Get execution count
   */
  get activeCount(): number {
    return this.activeExecutions.size;
  }
}
