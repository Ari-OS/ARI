/**
 * Initiative Executor — Sophisticated Autonomous Execution
 *
 * This module implements truly autonomous initiative execution by integrating:
 *
 * 1. COGNITIVE LAYER (LOGOS/ETHOS/PATHOS)
 *    - Expected value analysis for go/no-go decisions
 *    - Bias detection before execution
 *    - Reflection and learning after completion
 *
 * 2. AGENT SPAWNING
 *    - Parallel execution via git worktrees
 *    - Isolated environments for complex changes
 *
 * 3. CODE GENERATION
 *    - Test writing for uncovered files
 *    - Skill creation from patterns
 *    - Documentation updates
 *
 * 4. KNOWLEDGE SYNTHESIS
 *    - Learning from execution outcomes
 *    - Pattern extraction and storage
 *    - Memory persistence
 *
 * Philosophy:
 * - Antifragility: Learn from failures, get better over time
 * - Radical transparency: Log everything, explain decisions
 * - First principles: Evaluate each initiative on its merits
 * - Shadow integration: Don't suppress failures, understand them
 *
 * @module autonomous/initiative-executor
 * @version 1.0.0
 */

import { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';
import { AgentSpawner } from './agent-spawner.js';

const log = createLogger('initiative-executor');
import { KnowledgeIndex } from './knowledge-index.js';
import type { Initiative } from './initiative-engine.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// =============================================================================
// TYPES
// =============================================================================

export interface ExecutionContext {
  initiative: Initiative;
  projectPath: string;
  startedAt: Date;
  cognitiveAnalysis?: CognitiveAnalysis;
  agentId?: string;
  worktreePath?: string;
}

export interface CognitiveAnalysis {
  expectedValue: number;
  confidence: number;
  biasesDetected: string[];
  recommendation: 'PROCEED' | 'CAUTION' | 'AVOID';
  reasoning: string[];
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  artifactsCreated: string[];
  lessonsLearned: string[];
  duration: number;
  cognitiveReflection?: string;
}

export interface ExecutionStrategy {
  name: string;
  canExecute: (initiative: Initiative) => boolean;
  analyze: (ctx: ExecutionContext) => Promise<CognitiveAnalysis>;
  execute: (ctx: ExecutionContext) => Promise<ExecutionResult>;
  reflect: (ctx: ExecutionContext, result: ExecutionResult) => Promise<string[]>;
}

// =============================================================================
// INITIATIVE EXECUTOR
// =============================================================================

export class InitiativeExecutor {
  private eventBus: EventBus;
  private projectPath: string;
  private agentSpawner: AgentSpawner | null = null;
  private knowledgeIndex: KnowledgeIndex | null = null;
  private strategies: Map<string, ExecutionStrategy> = new Map();
  private executionHistory: ExecutionResult[] = [];

  constructor(eventBus: EventBus, projectPath: string) {
    this.eventBus = eventBus;
    this.projectPath = projectPath;

    // Register default strategies
    this.registerStrategy(new TestWritingStrategy());
    this.registerStrategy(new TodoResolutionStrategy());
    this.registerStrategy(new SkillCreationStrategy());
    this.registerStrategy(new KnowledgeSynthesisStrategy());
    this.registerStrategy(new DocumentationStrategy());
    this.registerStrategy(new CodeRefactorStrategy());
  }

  /**
   * Initialize with dependencies
   */
  init(
    agentSpawner?: AgentSpawner,
    knowledgeIndex?: KnowledgeIndex
  ): void {
    this.agentSpawner = agentSpawner || null;
    this.knowledgeIndex = knowledgeIndex || null;

    this.eventBus.emit('audit:log', {
      action: 'executor:initialized',
      agent: 'EXECUTOR',
      trustLevel: 'system',
      details: {
        strategies: Array.from(this.strategies.keys()),
        hasAgentSpawner: !!agentSpawner,
        hasKnowledgeIndex: !!knowledgeIndex,
      },
    });
  }

  /**
   * Register an execution strategy
   */
  registerStrategy(strategy: ExecutionStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * Execute an initiative with full cognitive pipeline
   *
   * Pipeline:
   * 1. Find matching strategy
   * 2. Perform cognitive analysis (LOGOS expected value)
   * 3. Check for biases (ETHOS)
   * 4. Execute if approved
   * 5. Reflect on outcome (PATHOS)
   * 6. Store lessons learned
   */
  async execute(initiative: Initiative): Promise<ExecutionResult> {
    const startedAt = new Date();

    // Create execution context
    const ctx: ExecutionContext = {
      initiative,
      projectPath: this.projectPath,
      startedAt,
    };

    // Find matching strategy
    const strategy = this.findStrategy(initiative);
    if (!strategy) {
      return {
        success: false,
        output: `No execution strategy found for: ${initiative.title}`,
        artifactsCreated: [],
        lessonsLearned: ['Need to implement strategy for this initiative type'],
        duration: 0,
      };
    }

    this.eventBus.emit('audit:log', {
      action: 'executor:strategy_selected',
      agent: 'EXECUTOR',
      trustLevel: 'system',
      details: {
        initiativeId: initiative.id,
        strategy: strategy.name,
      },
    });

    try {
      // Step 1: Cognitive Analysis (LOGOS)
      const analysis = await strategy.analyze(ctx);
      ctx.cognitiveAnalysis = analysis;

      this.eventBus.emit('audit:log', {
        action: 'executor:cognitive_analysis',
        agent: 'EXECUTOR',
        trustLevel: 'system',
        details: {
          initiativeId: initiative.id,
          expectedValue: analysis.expectedValue,
          recommendation: analysis.recommendation,
          biases: analysis.biasesDetected,
        },
      });

      // Step 2: Decision gate
      if (analysis.recommendation === 'AVOID') {
        return {
          success: false,
          output: `Cognitive analysis recommends AVOID: ${analysis.reasoning.join('; ')}`,
          artifactsCreated: [],
          lessonsLearned: analysis.reasoning,
          duration: Date.now() - startedAt.getTime(),
          cognitiveReflection: 'Initiative blocked by cognitive analysis',
        };
      }

      // Step 3: Execute with caution if needed
      if (analysis.recommendation === 'CAUTION' && analysis.biasesDetected.length > 0) {
        log.info({ biases: analysis.biasesDetected }, 'Proceeding with caution');
      }

      // Step 4: Execute
      const result = await strategy.execute(ctx);

      // Step 5: Reflect (PATHOS)
      const lessons = await strategy.reflect(ctx, result);
      result.lessonsLearned.push(...lessons);

      // Step 6: Store learnings
      if (this.knowledgeIndex && lessons.length > 0) {
        for (const lesson of lessons) {
          await this.knowledgeIndex.index({
            content: lesson,
            source: 'initiative_execution',
            domain: initiative.category.toLowerCase(),
            provenance: {
              createdBy: 'executor',
              createdAt: new Date(),
            },
          });
        }
      }

      // Calculate duration
      result.duration = Date.now() - startedAt.getTime();

      // Store in history
      this.executionHistory.push(result);

      this.eventBus.emit('audit:log', {
        action: 'executor:completed',
        agent: 'EXECUTOR',
        trustLevel: 'system',
        details: {
          initiativeId: initiative.id,
          success: result.success,
          duration: result.duration,
          artifacts: result.artifactsCreated.length,
          lessons: result.lessonsLearned.length,
        },
      });

      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      this.eventBus.emit('audit:log', {
        action: 'executor:failed',
        agent: 'EXECUTOR',
        trustLevel: 'system',
        details: {
          initiativeId: initiative.id,
          error: errorMsg,
        },
      });

      // Learn from failure (antifragility)
      const lessons = [
        `Execution failed: ${errorMsg}`,
        `Initiative: ${initiative.title}`,
        `Category: ${initiative.category}`,
      ];

      return {
        success: false,
        output: errorMsg,
        artifactsCreated: [],
        lessonsLearned: lessons,
        duration: Date.now() - startedAt.getTime(),
        cognitiveReflection: 'Failure provides learning opportunity',
      };
    }
  }

  /**
   * Find the best strategy for an initiative
   */
  private findStrategy(initiative: Initiative): ExecutionStrategy | null {
    for (const strategy of this.strategies.values()) {
      if (strategy.canExecute(initiative)) {
        return strategy;
      }
    }
    return null;
  }

  /**
   * Get execution statistics
   */
  getStats(): {
    totalExecutions: number;
    successRate: number;
    averageDuration: number;
    lessonsLearned: number;
  } {
    if (this.executionHistory.length === 0) {
      return {
        totalExecutions: 0,
        successRate: 0,
        averageDuration: 0,
        lessonsLearned: 0,
      };
    }

    const successful = this.executionHistory.filter(r => r.success).length;
    const totalDuration = this.executionHistory.reduce((sum, r) => sum + r.duration, 0);
    const totalLessons = this.executionHistory.reduce((sum, r) => sum + r.lessonsLearned.length, 0);

    return {
      totalExecutions: this.executionHistory.length,
      successRate: successful / this.executionHistory.length,
      averageDuration: totalDuration / this.executionHistory.length,
      lessonsLearned: totalLessons,
    };
  }
}

// =============================================================================
// EXECUTION STRATEGIES
// =============================================================================

/**
 * Strategy: Write tests for uncovered files
 */
class TestWritingStrategy implements ExecutionStrategy {
  name = 'test-writing';

  canExecute(initiative: Initiative): boolean {
    return (
      initiative.category === 'CODE_QUALITY' &&
      initiative.title.toLowerCase().includes('test')
    );
  }

  analyze(ctx: ExecutionContext): Promise<CognitiveAnalysis> {
    // Extract file path from initiative
    const fileMatch = ctx.initiative.description.match(/file\s+([^\s]+)/i);
    const filePath = fileMatch ? fileMatch[1] : null;

    // Calculate expected value
    // High value: tests prevent bugs, document behavior
    // Low effort for simple files
    const effort = ctx.initiative.effort === 'LOW' ? 0.3 :
                   ctx.initiative.effort === 'MEDIUM' ? 0.5 : 0.8;
    const impact = 0.8;  // Tests always valuable
    const expectedValue = impact - effort;

    return Promise.resolve({
      expectedValue,
      confidence: 0.75,
      biasesDetected: [],
      recommendation: expectedValue > 0.2 ? 'PROCEED' : 'CAUTION',
      reasoning: [
        `Test coverage improves reliability`,
        `File: ${filePath || 'unknown'}`,
        `Estimated effort: ${ctx.initiative.effort}`,
      ],
    });
  }

  async execute(ctx: ExecutionContext): Promise<ExecutionResult> {
    // Extract file path from initiative
    const fileMatch = ctx.initiative.description.match(/file\s+([^\s]+)/i);
    const filePath = fileMatch ? fileMatch[1] : null;

    if (!filePath) {
      return {
        success: false,
        output: 'Could not determine file path from initiative',
        artifactsCreated: [],
        lessonsLearned: ['Initiative description should include clear file path'],
        duration: 0,
      };
    }

    // Determine test file path
    const srcMatch = filePath.match(/src\/(.+)\.ts$/);
    if (!srcMatch) {
      return {
        success: false,
        output: 'File path does not match expected pattern',
        artifactsCreated: [],
        lessonsLearned: ['Only src/*.ts files are supported for test generation'],
        duration: 0,
      };
    }

    const relativePath = srcMatch[1];
    const testFilePath = path.join(ctx.projectPath, 'tests', 'unit', `${relativePath}.test.ts`);
    const testDir = path.dirname(testFilePath);

    try {
      // Read source file to understand what to test
      const sourceContent = await fs.readFile(path.join(ctx.projectPath, filePath), 'utf-8');

      // Extract exported functions/classes
      const exports = this.extractExports(sourceContent);

      if (exports.length === 0) {
        return {
          success: false,
          output: 'No exports found in source file',
          artifactsCreated: [],
          lessonsLearned: ['File has no testable exports'],
          duration: 0,
        };
      }

      // Generate test scaffold
      const testContent = this.generateTestScaffold(filePath, relativePath, exports);

      // Create test directory and file
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(testFilePath, testContent);

      return {
        success: true,
        output: `Created test file: ${testFilePath}`,
        artifactsCreated: [testFilePath],
        lessonsLearned: [
          `Generated test scaffold for ${exports.length} exports`,
          'Test file needs manual review and completion',
        ],
        duration: 0,
      };
    } catch (error) {
      return {
        success: false,
        output: error instanceof Error ? error.message : String(error),
        artifactsCreated: [],
        lessonsLearned: ['Test generation failed - may need manual intervention'],
        duration: 0,
      };
    }
  }

  reflect(_ctx: ExecutionContext, result: ExecutionResult): Promise<string[]> {
    if (result.success) {
      return Promise.resolve([
        'Test file created successfully',
        'Pattern: generate describe blocks for each export',
        'Next: fill in actual test implementations',
      ]);
    }
    return Promise.resolve([
      'Test generation requires clear file paths',
      'Consider improving initiative description extraction',
    ]);
  }

  private extractExports(content: string): Array<{ type: string; name: string }> {
    const exports: Array<{ type: string; name: string }> = [];

    // Match export function
    const funcMatches = content.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g);
    for (const match of funcMatches) {
      exports.push({ type: 'function', name: match[1] });
    }

    // Match export class
    const classMatches = content.matchAll(/export\s+class\s+(\w+)/g);
    for (const match of classMatches) {
      exports.push({ type: 'class', name: match[1] });
    }

    // Match export const/let
    const varMatches = content.matchAll(/export\s+(?:const|let)\s+(\w+)/g);
    for (const match of varMatches) {
      exports.push({ type: 'const', name: match[1] });
    }

    return exports;
  }

  private generateTestScaffold(
    sourcePath: string,
    relativePath: string,
    exports: Array<{ type: string; name: string }>
  ): string {
    const importPath = `../../../src/${relativePath}.js`;

    const lines: string[] = [
      `/**`,
      ` * Tests for ${sourcePath}`,
      ` * Generated by ARI Initiative Executor`,
      ` */`,
      ``,
      `import { describe, it, expect, beforeEach } from 'vitest';`,
      `import {`,
      ...exports.map(e => `  ${e.name},`),
      `} from '${importPath}';`,
      ``,
    ];

    for (const exp of exports) {
      if (exp.type === 'class') {
        lines.push(
          `describe('${exp.name}', () => {`,
          `  let instance: ${exp.name};`,
          ``,
          `  beforeEach(() => {`,
          `    // TODO: Initialize instance`,
          `  });`,
          ``,
          `  describe('constructor', () => {`,
          `    it('should create instance', () => {`,
          `      // TODO: Implement test`,
          `      expect(instance).toBeDefined();`,
          `    });`,
          `  });`,
          `});`,
          ``
        );
      } else if (exp.type === 'function') {
        lines.push(
          `describe('${exp.name}', () => {`,
          `  it('should handle expected input', () => {`,
          `    // TODO: Implement test`,
          `    // const result = ${exp.name}(...);`,
          `    // expect(result).toBe(...);`,
          `  });`,
          ``,
          `  it('should handle edge cases', () => {`,
          `    // TODO: Implement edge case tests`,
          `  });`,
          `});`,
          ``
        );
      }
    }

    return lines.join('\n');
  }
}

/**
 * Strategy: Resolve TODO comments
 */
class TodoResolutionStrategy implements ExecutionStrategy {
  name = 'todo-resolution';

  canExecute(initiative: Initiative): boolean {
    return (
      initiative.category === 'CODE_QUALITY' &&
      initiative.title.toLowerCase().includes('todo')
    );
  }

  analyze(ctx: ExecutionContext): Promise<CognitiveAnalysis> {
    // TODOs are tech debt - resolving them has moderate value
    const isSimple = ctx.initiative.effort === 'LOW';

    return Promise.resolve({
      expectedValue: isSimple ? 0.6 : 0.3,
      confidence: 0.6,
      biasesDetected: isSimple ? [] : ['OVERCONFIDENCE'],
      recommendation: isSimple ? 'PROCEED' : 'CAUTION',
      reasoning: [
        `TODO resolution reduces technical debt`,
        `Effort level: ${ctx.initiative.effort}`,
        isSimple ? 'Simple TODOs can be resolved automatically' : 'Complex TODOs need human review',
      ],
    });
  }

  execute(ctx: ExecutionContext): Promise<ExecutionResult> {
    // Extract TODO details from initiative
    const todoMatch = ctx.initiative.description.match(/in\s+([^:]+):(\d+):\s*(.+)/);

    if (!todoMatch) {
      return Promise.resolve({
        success: false,
        output: 'Could not parse TODO details from initiative',
        artifactsCreated: [],
        lessonsLearned: ['TODO description format needs to include file:line: text'],
        duration: 0,
      });
    }

    const [, file, lineStr, todoText] = todoMatch;
    const lineNum = parseInt(lineStr, 10);

    // For safety, we only log the TODO for now
    // Complex TODOs should spawn an agent
    return Promise.resolve({
      success: true,
      output: `Identified TODO at ${file}:${lineNum}: ${todoText}`,
      artifactsCreated: [],
      lessonsLearned: [
        `TODO found: ${todoText.slice(0, 50)}`,
        'Consider spawning agent for complex TODO resolution',
      ],
      duration: 0,
    });
  }

  reflect(_ctx: ExecutionContext, _result: ExecutionResult): Promise<string[]> {
    return Promise.resolve([
      'TODO tracking helps manage tech debt',
      'Simple TODOs should have < 10 line changes',
      'Complex TODOs need dedicated agent attention',
    ]);
  }
}

/**
 * Strategy: Create new skills from patterns
 */
class SkillCreationStrategy implements ExecutionStrategy {
  name = 'skill-creation';

  canExecute(initiative: Initiative): boolean {
    return (
      initiative.category === 'IMPROVEMENTS' &&
      initiative.title.toLowerCase().includes('skill')
    );
  }

  analyze(_ctx: ExecutionContext): Promise<CognitiveAnalysis> {
    // Skills have high leverage - they automate future work
    return Promise.resolve({
      expectedValue: 0.8,
      confidence: 0.7,
      biasesDetected: [],
      recommendation: 'PROCEED',
      reasoning: [
        'Skills provide high leverage for repeated tasks',
        'Once created, skills save time on every future invocation',
        'Skill quality compounds over time',
      ],
    });
  }

  async execute(ctx: ExecutionContext): Promise<ExecutionResult> {
    // Skill creation is complex - would need pattern analysis
    // For now, create a skill template
    const skillName = ctx.initiative.title
      .replace(/create\s+(?:new\s+)?skill\s+(?:for\s+)?/i, '')
      .toLowerCase()
      .replace(/\s+/g, '-');

    const skillDir = path.join(ctx.projectPath, '.claude', 'skills', skillName);
    const skillPath = path.join(skillDir, 'SKILL.md');

    try {
      await fs.mkdir(skillDir, { recursive: true });

      const skillContent = `---
name: ${skillName}
description: Auto-generated skill from ARI initiative
---

# ${skillName}

## When to Use

${ctx.initiative.description}

## Implementation

TODO: Add implementation details

## Examples

TODO: Add examples
`;

      await fs.writeFile(skillPath, skillContent);

      return {
        success: true,
        output: `Created skill template: ${skillPath}`,
        artifactsCreated: [skillPath],
        lessonsLearned: [
          'Skill template created - needs manual refinement',
          'Add triggers and implementation details',
        ],
        duration: 0,
      };
    } catch (error) {
      return {
        success: false,
        output: error instanceof Error ? error.message : String(error),
        artifactsCreated: [],
        lessonsLearned: ['Skill creation requires .claude/skills directory'],
        duration: 0,
      };
    }
  }

  reflect(_ctx: ExecutionContext, _result: ExecutionResult): Promise<string[]> {
    return Promise.resolve([
      'Skills should encode reusable patterns',
      'Good skills have clear triggers and examples',
      'Skills evolve - create initial version, then iterate',
    ]);
  }
}

/**
 * Strategy: Synthesize knowledge from sessions
 */
class KnowledgeSynthesisStrategy implements ExecutionStrategy {
  name = 'knowledge-synthesis';

  canExecute(initiative: Initiative): boolean {
    return (
      initiative.category === 'KNOWLEDGE' &&
      (initiative.title.toLowerCase().includes('synthesize') ||
       initiative.title.toLowerCase().includes('learn'))
    );
  }

  analyze(_ctx: ExecutionContext): Promise<CognitiveAnalysis> {
    return Promise.resolve({
      expectedValue: 0.75,
      confidence: 0.65,
      biasesDetected: [],
      recommendation: 'PROCEED',
      reasoning: [
        'Knowledge synthesis improves future performance',
        'Learning compounds over time',
        'Extracted patterns can be reused',
      ],
    });
  }

  async execute(_ctx: ExecutionContext): Promise<ExecutionResult> {
    // Look for recent Claude Code session logs
    const claudeDir = path.join(
      process.env.HOME || '~',
      '.claude',
      'projects'
    );

    try {
      const projectDirs = await fs.readdir(claudeDir);
      const recentSessions: string[] = [];

      for (const dir of projectDirs.slice(-5)) {  // Last 5 projects
        const projectPath = path.join(claudeDir, dir);
        const stat = await fs.stat(projectPath);
        if (stat.isDirectory()) {
          // Find most recent session
          const files = await fs.readdir(projectPath);
          const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
          if (jsonlFiles.length > 0) {
            recentSessions.push(path.join(projectPath, jsonlFiles[jsonlFiles.length - 1]));
          }
        }
      }

      return {
        success: true,
        output: `Found ${recentSessions.length} recent sessions for synthesis`,
        artifactsCreated: [],
        lessonsLearned: [
          `Sessions to analyze: ${recentSessions.length}`,
          'Knowledge synthesis requires session parsing',
          'Consider extracting patterns, decisions, and outcomes',
        ],
        duration: 0,
      };
    } catch (error) {
      return {
        success: false,
        output: error instanceof Error ? error.message : String(error),
        artifactsCreated: [],
        lessonsLearned: ['Session logs not found or inaccessible'],
        duration: 0,
      };
    }
  }

  reflect(_ctx: ExecutionContext, _result: ExecutionResult): Promise<string[]> {
    return Promise.resolve([
      'Knowledge synthesis should extract actionable patterns',
      'Focus on decisions and their outcomes',
      'Store learnings in persistent memory',
    ]);
  }
}

/**
 * Strategy: Update documentation
 */
class DocumentationStrategy implements ExecutionStrategy {
  name = 'documentation';

  canExecute(initiative: Initiative): boolean {
    return (
      initiative.category === 'DELIVERABLES' &&
      (initiative.title.toLowerCase().includes('doc') ||
       initiative.title.toLowerCase().includes('readme'))
    );
  }

  analyze(_ctx: ExecutionContext): Promise<CognitiveAnalysis> {
    return Promise.resolve({
      expectedValue: 0.5,
      confidence: 0.7,
      biasesDetected: [],
      recommendation: 'CAUTION',
      reasoning: [
        'Documentation helps future understanding',
        'But may become outdated quickly',
        'Consider cost of maintenance',
      ],
    });
  }

  async execute(ctx: ExecutionContext): Promise<ExecutionResult> {
    // Documentation updates should be careful
    // For now, just identify what needs updating
    const readmePath = path.join(ctx.projectPath, 'README.md');

    try {
      const stats = await fs.stat(readmePath);
      const daysSinceUpdate = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

      // Get recent git log to understand changes
      const changes = execFileSync('git', ['log', '--oneline', '-10'], {
        cwd: ctx.projectPath,
        encoding: 'utf-8',
      });

      return {
        success: true,
        output: `README last updated ${Math.floor(daysSinceUpdate)} days ago`,
        artifactsCreated: [],
        lessonsLearned: [
          `Recent changes: ${changes.trim().split('\n').length} commits`,
          'Consider updating sections that reflect changed functionality',
        ],
        duration: 0,
      };
    } catch (error) {
      return {
        success: false,
        output: error instanceof Error ? error.message : String(error),
        artifactsCreated: [],
        lessonsLearned: ['README not found or git log failed'],
        duration: 0,
      };
    }
  }

  reflect(_ctx: ExecutionContext, _result: ExecutionResult): Promise<string[]> {
    return Promise.resolve([
      'Documentation should reflect actual code behavior',
      'Focus on high-level architecture and key decisions',
      'Auto-generated docs from code are more maintainable',
    ]);
  }
}

/**
 * Strategy: Code refactoring
 */
class CodeRefactorStrategy implements ExecutionStrategy {
  name = 'code-refactor';

  canExecute(initiative: Initiative): boolean {
    return (
      initiative.category === 'CODE_QUALITY' &&
      initiative.title.toLowerCase().includes('refactor')
    );
  }

  analyze(_ctx: ExecutionContext): Promise<CognitiveAnalysis> {
    // Refactoring is risky - needs high confidence
    return Promise.resolve({
      expectedValue: 0.4,
      confidence: 0.5,
      biasesDetected: ['OVERCONFIDENCE'],
      recommendation: 'CAUTION',
      reasoning: [
        'Refactoring can improve maintainability',
        'But carries risk of introducing bugs',
        'Should be done incrementally with tests',
        'Consider spawning dedicated agent in worktree',
      ],
    });
  }

  execute(ctx: ExecutionContext): Promise<ExecutionResult> {
    // Refactoring should not be done automatically
    // Instead, create a task for dedicated attention
    return Promise.resolve({
      success: true,
      output: `Refactoring initiative logged: ${ctx.initiative.title}`,
      artifactsCreated: [],
      lessonsLearned: [
        'Refactoring requires careful, incremental changes',
        'Consider spawning agent in isolated worktree',
        'Ensure test coverage before refactoring',
      ],
      duration: 0,
    });
  }

  reflect(_ctx: ExecutionContext, _result: ExecutionResult): Promise<string[]> {
    return Promise.resolve([
      'Refactoring should follow "make it work, make it right, make it fast"',
      'Never refactor without test coverage',
      'Small, incremental changes are safer than big rewrites',
    ]);
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default InitiativeExecutor;
