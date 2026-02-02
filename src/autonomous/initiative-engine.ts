/**
 * Initiative Engine — ARI's Proactive Autonomy System
 *
 * This is the core of ARI taking initiative. Instead of waiting for tasks,
 * ARI actively discovers opportunities and creates value.
 *
 * Initiative Categories:
 * 1. CODE_QUALITY    - Find and fix code issues, add tests, improve patterns
 * 2. KNOWLEDGE       - Learn new things, synthesize insights, update memory
 * 3. OPPORTUNITIES   - Identify things the user should know about
 * 4. DELIVERABLES    - Create things the user will find valuable
 * 5. IMPROVEMENTS    - Make ARI itself better
 *
 * @module autonomous/initiative-engine
 * @version 1.0.0
 */

import { EventBus } from '../kernel/event-bus.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { detectCognitiveBias, runDisciplineCheck } from '../cognition/ethos/index.js';
import type { AgentSpawner } from './agent-spawner.js';
import type { KnowledgeIndex } from './knowledge-index.js';
import { homedir } from 'node:os';

// =============================================================================
// TYPES
// =============================================================================

export type InitiativeCategory =
  | 'CODE_QUALITY'
  | 'KNOWLEDGE'
  | 'OPPORTUNITIES'
  | 'DELIVERABLES'
  | 'IMPROVEMENTS';

export interface Initiative {
  id: string;
  category: InitiativeCategory;
  kind?: string; // More specific subtype within a category (e.g. WRITE_TESTS)
  title: string;
  description: string;
  rationale: string;  // Why this is valuable
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  priority: number;   // Calculated from effort/impact
  forUser: boolean;   // Is this something to present to user, or for ARI to do?
  autonomous: boolean; // Can ARI do this without user approval?
  createdAt: Date;
  status: 'DISCOVERED' | 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  result?: string;
  resultDetails?: Record<string, unknown>;
  target?: InitiativeTarget;
}

export interface InitiativeConfig {
  enabled: boolean;
  categories: InitiativeCategory[];
  maxConcurrent: number;
  maxInitiativesPerScan: number;  // Limit initiatives discovered per scan
  scanIntervalMs: number;
  autonomousThreshold: number;    // Priority threshold for auto-execution (0-100)
  autoExecute: boolean;           // Execute autonomous initiatives automatically
  projectPath: string;
}

export interface InitiativeTarget {
  /** Path relative to project root */
  filePath?: string;
  /** Suggested path relative to project root */
  testPath?: string;
  todo?: { file: string; line: number; text: string };
  docsPath?: string;
}

export interface InitiativeExecutionPlan {
  initiativeId: string;
  title: string;
  category: InitiativeCategory;
  kind?: string;
  steps: Array<{ id: string; description: string; risk: 'LOW' | 'MEDIUM' | 'HIGH' }>;
  safetyGates: {
    discipline: { passed: boolean; score: number; blockers: string[]; recommendations: string[] };
    bias: { riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'; overallRisk: number; recommendations: string[] };
  };
  recommendedExecution: 'IN_PROCESS' | 'SPAWN_WORKTREE' | 'USER_REVIEW';
}

interface InitiativeExecutionOutcome {
  status: Initiative['status'];
  summary: string;
  details?: Record<string, unknown>;
}

// =============================================================================
// INITIATIVE DISCOVERY
// =============================================================================

/**
 * Discover initiatives by scanning for opportunities
 */
export async function discoverInitiatives(
  config: InitiativeConfig
): Promise<Initiative[]> {
  const initiatives: Initiative[] = [];

  for (const category of config.categories) {
    switch (category) {
      case 'CODE_QUALITY':
        initiatives.push(...await discoverCodeQualityInitiatives(config.projectPath));
        break;
      case 'KNOWLEDGE':
        initiatives.push(...discoverKnowledgeInitiatives());
        break;
      case 'OPPORTUNITIES':
        initiatives.push(...discoverOpportunityInitiatives());
        break;
      case 'DELIVERABLES':
        initiatives.push(...await discoverDeliverableInitiatives(config.projectPath));
        break;
      case 'IMPROVEMENTS':
        initiatives.push(...discoverImprovementInitiatives(config.projectPath));
        break;
    }
  }

  // Sort by priority (impact/effort ratio)
  initiatives.sort((a, b) => b.priority - a.priority);

  return initiatives;
}

// =============================================================================
// CODE QUALITY INITIATIVES
// =============================================================================

async function discoverCodeQualityInitiatives(projectPath: string): Promise<Initiative[]> {
  const initiatives: Initiative[] = [];

  // Check for missing tests
  const missingTests = await findFilesWithoutTests(projectPath);
  for (const file of missingTests.slice(0, 5)) {  // Limit to top 5
    const rel = file.replace(projectPath + '/', '');
    initiatives.push({
      id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      category: 'CODE_QUALITY',
      kind: 'WRITE_TESTS',
      title: `Write tests for ${path.basename(file)}`,
      description: `The file ${file} has no corresponding test file. Writing tests would improve reliability and catch bugs early.`,
      rationale: 'Test coverage prevents regressions and documents expected behavior.',
      effort: 'MEDIUM',
      impact: 'HIGH',
      priority: 0.8,
      forUser: false,
      autonomous: true,  // ARI can write tests without asking
      createdAt: new Date(),
      status: 'DISCOVERED',
      target: {
        filePath: rel,
        testPath: suggestTestPathForSource(rel),
      },
    });
  }

  // Check for TODO/FIXME comments
  const todos = await findTodoComments(projectPath);
  for (const todo of todos.slice(0, 5)) {
    initiatives.push({
      id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      category: 'CODE_QUALITY',
      kind: 'RESOLVE_TODO',
      title: `Address TODO: ${todo.text.slice(0, 50)}...`,
      description: `Found TODO in ${todo.file}:${todo.line}: ${todo.text}`,
      rationale: 'Resolving TODOs improves code quality and reduces technical debt.',
      effort: todo.text.toLowerCase().includes('simple') ? 'LOW' : 'MEDIUM',
      impact: 'MEDIUM',
      priority: 0.6,
      forUser: false,
      autonomous: true,
      createdAt: new Date(),
      status: 'DISCOVERED',
      target: {
        todo: { file: todo.file, line: todo.line, text: todo.text },
      },
    });
  }

  // Check for large files that could be refactored
  const largeFiles = await findLargeFiles(projectPath, 500);  // >500 lines
  for (const file of largeFiles.slice(0, 3)) {
    initiatives.push({
      id: `refactor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      category: 'CODE_QUALITY',
      kind: 'REFACTOR_SUGGESTION',
      title: `Consider refactoring ${path.basename(file.path)}`,
      description: `${file.path} has ${file.lines} lines. Large files are harder to maintain.`,
      rationale: 'Smaller, focused files are easier to understand and test.',
      effort: 'HIGH',
      impact: 'MEDIUM',
      priority: 0.4,
      forUser: true,  // Suggest to user, don't auto-refactor
      autonomous: false,
      createdAt: new Date(),
      status: 'DISCOVERED',
      target: { filePath: file.path },
    });
  }

  return initiatives;
}

function suggestTestPathForSource(sourceRelPath: string): string {
  // Convention: src/foo/bar.ts => tests/unit/foo/bar.test.ts
  const normalized = sourceRelPath.replace(/\\/g, '/');
  const withoutPrefix = normalized.startsWith('src/') ? normalized.slice('src/'.length) : normalized;
  const testRel = withoutPrefix.replace(/\.ts$/, '.test.ts');
  return path.posix.join('tests', 'unit', testRel);
}

async function findFilesWithoutTests(projectPath: string): Promise<string[]> {
  const srcFiles: string[] = [];
  const testFiles = new Set<string>();

  // Scan src directory
  const srcDir = path.join(projectPath, 'src');
  try {
    await scanDirectory(srcDir, srcFiles, /\.ts$/);
  } catch {
    return [];
  }

  // Scan test directory
  const testDir = path.join(projectPath, 'tests');
  const testFileList: string[] = [];
  try {
    await scanDirectory(testDir, testFileList, /\.test\.ts$/);
    for (const tf of testFileList) {
      // Extract the base name being tested
      const basename = path.basename(tf).replace('.test.ts', '');
      testFiles.add(basename);
    }
  } catch {
    // No tests directory
  }

  // Find source files without corresponding tests
  return srcFiles.filter(sf => {
    const basename = path.basename(sf, '.ts');
    // Skip index files and type files
    if (basename === 'index' || basename === 'types') return false;
    return !testFiles.has(basename);
  });
}

async function scanDirectory(dir: string, results: string[], pattern: RegExp): Promise<void> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await scanDirectory(fullPath, results, pattern);
      } else if (entry.isFile() && pattern.test(entry.name)) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
}

async function findTodoComments(projectPath: string): Promise<Array<{ file: string; line: number; text: string }>> {
  const todos: Array<{ file: string; line: number; text: string }> = [];
  const srcDir = path.join(projectPath, 'src');

  const files: string[] = [];
  await scanDirectory(srcDir, files, /\.ts$/);

  for (const file of files.slice(0, 20)) {  // Limit scanning
    try {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(/(?:TODO|FIXME|HACK|XXX)[\s:]+(.+)/i);
        if (match) {
          todos.push({
            file: file.replace(projectPath + '/', ''),
            line: i + 1,
            text: match[1].trim(),
          });
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  return todos;
}

async function findLargeFiles(projectPath: string, threshold: number): Promise<Array<{ path: string; lines: number }>> {
  const largeFiles: Array<{ path: string; lines: number }> = [];
  const srcDir = path.join(projectPath, 'src');

  const files: string[] = [];
  await scanDirectory(srcDir, files, /\.ts$/);

  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const lineCount = content.split('\n').length;
      if (lineCount > threshold) {
        largeFiles.push({
          path: file.replace(projectPath + '/', ''),
          lines: lineCount,
        });
      }
    } catch {
      // Skip unreadable files
    }
  }

  return largeFiles.sort((a, b) => b.lines - a.lines);
}

// =============================================================================
// KNOWLEDGE INITIATIVES
// =============================================================================

function discoverKnowledgeInitiatives(): Initiative[] {
  const initiatives: Initiative[] = [];

  // Check for new Anthropic releases
  initiatives.push({
    id: `anthropic-${Date.now()}`,
    category: 'KNOWLEDGE',
    title: 'Check for new Claude/Anthropic updates',
    description: 'Scan Anthropic news, changelog, and API updates for improvements ARI could use.',
    rationale: 'Staying current with Claude capabilities enables ARI to improve.',
    effort: 'LOW',
    impact: 'HIGH',
    priority: 0.85,
    forUser: false,
    autonomous: true,
    createdAt: new Date(),
    status: 'DISCOVERED',
  });

  // Synthesize session learnings
  initiatives.push({
    id: `synthesize-${Date.now()}`,
    category: 'KNOWLEDGE',
    title: 'Synthesize recent session learnings',
    description: 'Review recent Claude Code sessions and extract patterns, preferences, and insights.',
    rationale: 'Learning from past sessions makes ARI more helpful over time.',
    effort: 'MEDIUM',
    impact: 'HIGH',
    priority: 0.75,
    forUser: false,
    autonomous: true,
    createdAt: new Date(),
    status: 'DISCOVERED',
  });

  return initiatives;
}

// =============================================================================
// OPPORTUNITY INITIATIVES
// =============================================================================

function discoverOpportunityInitiatives(): Initiative[] {
  const initiatives: Initiative[] = [];

  // Generate daily focus suggestion
  initiatives.push({
    id: `focus-${Date.now()}`,
    category: 'OPPORTUNITIES',
    title: 'Generate daily focus recommendation',
    description: 'Analyze current projects, deadlines, and priorities to suggest what to focus on today.',
    rationale: 'Clear focus reduces decision fatigue and increases productivity.',
    effort: 'LOW',
    impact: 'HIGH',
    priority: 0.9,
    forUser: true,  // This is FOR the user
    autonomous: true,
    createdAt: new Date(),
    status: 'DISCOVERED',
  });

  // Check for blocked work
  initiatives.push({
    id: `unblock-${Date.now()}`,
    category: 'OPPORTUNITIES',
    title: 'Identify and resolve blockers',
    description: 'Find work that is blocked and determine if blockers can be resolved.',
    rationale: 'Unblocking work enables progress without user intervention.',
    effort: 'MEDIUM',
    impact: 'HIGH',
    priority: 0.8,
    forUser: false,
    autonomous: true,
    createdAt: new Date(),
    status: 'DISCOVERED',
  });

  return initiatives;
}

// =============================================================================
// DELIVERABLE INITIATIVES
// =============================================================================

async function discoverDeliverableInitiatives(projectPath: string): Promise<Initiative[]> {
  const initiatives: Initiative[] = [];

  // Generate project status report
  initiatives.push({
    id: `status-${Date.now()}`,
    category: 'DELIVERABLES',
    title: 'Generate project status summary',
    description: 'Create a summary of current project state, recent changes, and next steps.',
    rationale: 'Clear status helps the user understand where things stand.',
    effort: 'LOW',
    impact: 'MEDIUM',
    priority: 0.65,
    forUser: true,
    autonomous: true,
    createdAt: new Date(),
    status: 'DISCOVERED',
  });

  // Check if documentation needs updating
  const hasOutdatedDocs = await checkOutdatedDocs(projectPath);
  if (hasOutdatedDocs) {
    initiatives.push({
      id: `docs-${Date.now()}`,
      category: 'DELIVERABLES',
      title: 'Update project documentation',
      description: 'Documentation appears out of date with recent code changes.',
      rationale: 'Current documentation reduces onboarding time and confusion.',
      effort: 'MEDIUM',
      impact: 'MEDIUM',
      priority: 0.5,
      forUser: false,
      autonomous: true,
      createdAt: new Date(),
      status: 'DISCOVERED',
    });
  }

  return initiatives;
}

async function checkOutdatedDocs(projectPath: string): Promise<boolean> {
  try {
    const readmePath = path.join(projectPath, 'README.md');
    const packagePath = path.join(projectPath, 'package.json');

    const [readmeStat, packageStat] = await Promise.all([
      fs.stat(readmePath),
      fs.stat(packagePath),
    ]);

    // If package.json is newer than README, docs might be outdated
    return packageStat.mtime > readmeStat.mtime;
  } catch {
    return false;
  }
}

// =============================================================================
// IMPROVEMENT INITIATIVES
// =============================================================================

function discoverImprovementInitiatives(_projectPath: string): Initiative[] {
  const initiatives: Initiative[] = [];

  // Check for skill gaps
  initiatives.push({
    id: `skill-${Date.now()}`,
    category: 'IMPROVEMENTS',
    title: 'Create new skill for common pattern',
    description: 'Identify frequently repeated operations that could become a skill.',
    rationale: 'Skills automate common workflows and reduce errors.',
    effort: 'MEDIUM',
    impact: 'HIGH',
    priority: 0.7,
    forUser: false,
    autonomous: true,
    createdAt: new Date(),
    status: 'DISCOVERED',
  });

  // Self-improvement
  initiatives.push({
    id: `self-${Date.now()}`,
    category: 'IMPROVEMENTS',
    title: 'Review and improve ARI configuration',
    description: 'Analyze ARI settings and suggest optimizations based on usage patterns.',
    rationale: 'Continuous self-improvement makes ARI more effective.',
    effort: 'LOW',
    impact: 'MEDIUM',
    priority: 0.6,
    forUser: false,
    autonomous: true,
    createdAt: new Date(),
    status: 'DISCOVERED',
  });

  return initiatives;
}

// =============================================================================
// INITIATIVE ENGINE
// =============================================================================

export class InitiativeEngine {
  private config: InitiativeConfig;
  private initiatives: Initiative[] = [];
  private running = false;
  private initialized = false;
  private scanTimer: NodeJS.Timeout | null = null;
  private eventBus: EventBus;
  private agentSpawner?: AgentSpawner;
  private knowledgeIndex?: KnowledgeIndex;

  constructor(
    config: Partial<InitiativeConfig> = {},
    deps: { eventBus?: EventBus; agentSpawner?: AgentSpawner; knowledgeIndex?: KnowledgeIndex } = {}
  ) {
    this.eventBus = deps.eventBus ?? new EventBus();
    this.agentSpawner = deps.agentSpawner;
    this.knowledgeIndex = deps.knowledgeIndex;
    this.config = {
      enabled: true,
      categories: ['CODE_QUALITY', 'KNOWLEDGE', 'OPPORTUNITIES', 'DELIVERABLES', 'IMPROVEMENTS'],
      maxConcurrent: 3,
      maxInitiativesPerScan: 10,
      scanIntervalMs: 60 * 60 * 1000,  // 1 hour
      autonomousThreshold: 70,         // Priority 0-100 threshold
      autoExecute: true,
      projectPath: process.cwd(),
      ...config,
    };
  }

  /**
   * Initialize the initiative engine
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // Load any persisted initiatives
    await this.loadState();

    this.initialized = true;

    this.eventBus.emit('audit:log', {
      action: 'initiative:initialized',
      agent: 'INITIATIVE',
      trustLevel: 'system',
      details: {
        categories: this.config.categories,
        autoExecute: this.config.autoExecute,
        threshold: this.config.autonomousThreshold,
      },
    });

    // eslint-disable-next-line no-console
    console.log('[InitiativeEngine] Initialized');
  }

  /**
   * Start the initiative engine
   */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // eslint-disable-next-line no-console
    console.log('[InitiativeEngine] Starting proactive autonomy...');

    // Initial scan
    await this.scan();

    // Schedule periodic scans
    this.scanTimer = setInterval(() => {
      this.scan().catch(err => {
        // eslint-disable-next-line no-console
        console.error('[InitiativeEngine] Scan error:', err);
      });
    }, this.config.scanIntervalMs);

    this.eventBus.emit('audit:log', {
      action: 'initiative:engine_started',
      agent: 'INITIATIVE',
      trustLevel: 'system',
      details: { categories: this.config.categories },
    });
  }

  /**
   * Stop the initiative engine
   */
  stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }

    // eslint-disable-next-line no-console
    console.log('[InitiativeEngine] Stopped');
  }

  /**
   * Scan for new initiatives
   *
   * Discovery flow:
   * 1. Scan all enabled categories for potential initiatives
   * 2. Deduplicate against existing initiatives
   * 3. Limit to configured max per scan
   * 4. Auto-execute high-priority autonomous items if enabled
   * 5. Persist state
   */
  async scan(): Promise<Initiative[]> {
    if (!this.initialized) {
      await this.init();
    }

    // eslint-disable-next-line no-console
    console.log('[InitiativeEngine] Scanning for initiatives...');

    const discovered = await discoverInitiatives(this.config);

    // Filter out duplicates (by title similarity) and limit
    const newInitiatives = discovered
      .filter(d =>
        !this.initiatives.some(existing =>
          existing.title === d.title && existing.status !== 'COMPLETED' && existing.status !== 'REJECTED'
        )
      )
      .slice(0, this.config.maxInitiativesPerScan);

    this.initiatives.push(...newInitiatives);

    // eslint-disable-next-line no-console
    console.log(`[InitiativeEngine] Discovered ${newInitiatives.length} new initiatives`);

    // Auto-execute high-priority autonomous initiatives if enabled
    if (this.config.autoExecute) {
      // Priority is 0-100, threshold is typically 60-80
      const toExecute = newInitiatives.filter(i =>
        i.autonomous &&
        !i.forUser &&
        (i.priority * 100) >= this.config.autonomousThreshold
      );

      // Execute up to maxConcurrent
      for (const initiative of toExecute.slice(0, this.config.maxConcurrent)) {
        // Don't await - execute in background
        this.executeInitiative(initiative).catch(err => {
          // eslint-disable-next-line no-console
          console.error(`[InitiativeEngine] Failed to execute ${initiative.id}:`, err);
        });
      }

      if (toExecute.length > 0) {
        // eslint-disable-next-line no-console
        console.log(`[InitiativeEngine] Auto-executing ${Math.min(toExecute.length, this.config.maxConcurrent)} initiatives`);
      }

      this.eventBus.emit('audit:log', {
        action: 'initiative:scan_complete',
        agent: 'INITIATIVE',
        trustLevel: 'system',
        details: {
          discovered: discovered.length,
          newInitiatives: newInitiatives.length,
          autoExecuting: Math.min(toExecute.length, this.config.maxConcurrent),
        },
      });
    } else {
      this.eventBus.emit('audit:log', {
        action: 'initiative:scan_complete',
        agent: 'INITIATIVE',
        trustLevel: 'system',
        details: {
          discovered: discovered.length,
          newInitiatives: newInitiatives.length,
          autoExecute: false,
        },
      });
    }

    // Persist state
    await this.saveState();

    return newInitiatives;
  }

  /**
   * Build an execution plan for an initiative, including cognitive safety gates.
   * This is safe to call for user review.
   */
  async planInitiative(initiativeOrId: Initiative | string): Promise<InitiativeExecutionPlan> {
    const initiative = typeof initiativeOrId === 'string'
      ? this.initiatives.find(i => i.id === initiativeOrId)
      : initiativeOrId;
    if (!initiative) {
      const idStr = typeof initiativeOrId === 'string' ? initiativeOrId : initiativeOrId.id;
      throw new Error(`Initiative not found: ${idStr}`);
    }

    const steps = this.buildPlanSteps(initiative);
    const decisionText = `Execute initiative: ${initiative.title}\n\nRationale: ${initiative.rationale}\n\nSteps:\n- ${steps.map(s => s.description).join('\n- ')}`;

    // ETHOS gate: discipline check (readiness + caution)
    const discipline = await runDisciplineCheck(decisionText, 'INITIATIVE', {
      alternativesConsidered: ['skip', 'user_review', 'spawn_worktree_agent', 'in_process'],
      researchDocuments: initiative.target?.filePath ? [initiative.target.filePath] : undefined,
    });

    // ETHOS gate: bias detection on the plan itself
    const bias = await detectCognitiveBias(decisionText, {
      domain: `initiative:${initiative.category.toLowerCase()}`,
      expertise: 'intermediate',
    });

    const recommendedExecution =
      initiative.category === 'CODE_QUALITY' ? 'SPAWN_WORKTREE' :
      initiative.category === 'DELIVERABLES' ? 'IN_PROCESS' :
      initiative.category === 'KNOWLEDGE' ? 'IN_PROCESS' :
      'USER_REVIEW';

    return {
      initiativeId: initiative.id,
      title: initiative.title,
      category: initiative.category,
      kind: initiative.kind,
      steps,
      safetyGates: {
        discipline: {
          passed: discipline.shouldProceed,
          score: discipline.overallScore,
          blockers: discipline.blockers,
          recommendations: discipline.recommendations,
        },
        bias: {
          riskLevel: bias.riskLevel,
          overallRisk: bias.overallRisk,
          recommendations: bias.recommendations,
        },
      },
      recommendedExecution,
    };
  }

  /**
   * Execute an initiative by ID or reference
   */
  async executeInitiative(initiativeOrId: Initiative | string): Promise<void> {
    // Resolve the initiative
    let initiative: Initiative | undefined;
    if (typeof initiativeOrId === 'string') {
      initiative = this.initiatives.find(i => i.id === initiativeOrId);
      if (!initiative) {
        throw new Error(`Initiative not found: ${initiativeOrId}`);
      }
    } else {
      initiative = initiativeOrId;
    }

    initiative.status = 'IN_PROGRESS';

    // eslint-disable-next-line no-console
    console.log(`[InitiativeEngine] Executing: ${initiative.title}`);

    this.eventBus.emit('audit:log', {
      action: 'initiative:executing',
      agent: 'INITIATIVE',
      trustLevel: 'system',
      details: { initiativeId: initiative.id, title: initiative.title },
    });

    try {
      const plan = await this.planInitiative(initiative);

      // Hard gate: do not proceed if discipline gate fails or bias is CRITICAL.
      if (!plan.safetyGates.discipline.passed || plan.safetyGates.bias.riskLevel === 'CRITICAL') {
        initiative.status = 'QUEUED';
        initiative.result = 'Execution deferred by safety gates';
        initiative.resultDetails = {
          reason: 'SAFETY_GATES',
          discipline: plan.safetyGates.discipline,
          bias: plan.safetyGates.bias,
        };
        await this.saveState();
        return;
      }

      const outcome = await this.executeByCategory(initiative, plan);
      initiative.status = outcome.status;
      initiative.result = outcome.summary;
      initiative.resultDetails = outcome.details;

      this.eventBus.emit('audit:log', {
        action: initiative.status === 'COMPLETED' ? 'initiative:completed' : 'initiative:orchestrated',
        agent: 'INITIATIVE',
        trustLevel: 'system',
        details: {
          initiativeId: initiative.id,
          status: initiative.status,
          result: initiative.result,
          kind: initiative.kind,
        },
      });
    } catch (error) {
      initiative.status = 'REJECTED';
      initiative.result = error instanceof Error ? error.message : String(error);

      this.eventBus.emit('audit:log', {
        action: 'initiative:failed',
        agent: 'INITIATIVE',
        trustLevel: 'system',
        details: { initiativeId: initiative.id, error: initiative.result },
      });

      throw error;
    }

    // Persist state after execution
    await this.saveState();
  }

  /**
   * Execute initiative based on its category
   */
  private async executeByCategory(
    initiative: Initiative,
    plan: InitiativeExecutionPlan
  ): Promise<InitiativeExecutionOutcome> {
    switch (initiative.category) {
      case 'CODE_QUALITY':
        return await this.executeCodeQuality(initiative, plan);
      case 'KNOWLEDGE':
        return await this.executeKnowledge(initiative, plan);
      case 'OPPORTUNITIES':
        return await this.executeOpportunity(initiative, plan);
      case 'DELIVERABLES':
        return await this.executeDeliverable(initiative, plan);
      case 'IMPROVEMENTS':
        return await this.executeImprovement(initiative, plan);
      default:
        return { status: 'REJECTED', summary: 'Unknown category' };
    }
  }

  private buildPlanSteps(initiative: Initiative): InitiativeExecutionPlan['steps'] {
    if (initiative.category === 'CODE_QUALITY' && initiative.kind === 'WRITE_TESTS' && initiative.target?.filePath) {
      return [
        { id: 'identify-test-target', description: `Target module: ${initiative.target.filePath}`, risk: 'LOW' },
        { id: 'create-worktree', description: 'Create isolated worktree branch for changes', risk: 'LOW' },
        { id: 'write-tests', description: `Write/extend tests at ${initiative.target.testPath ?? 'tests/unit/...'} covering public API and error paths`, risk: 'MEDIUM' },
        { id: 'verify', description: 'Run unit tests and ensure no lint/build regressions', risk: 'MEDIUM' },
        { id: 'handoff', description: 'Provide summary + next steps for review/merge', risk: 'LOW' },
      ];
    }

    if (initiative.category === 'CODE_QUALITY' && initiative.kind === 'RESOLVE_TODO' && initiative.target?.todo) {
      return [
        { id: 'locate-todo', description: `Locate TODO at ${initiative.target.todo.file}:${initiative.target.todo.line}`, risk: 'LOW' },
        { id: 'design-fix', description: 'Design the smallest correct fix with tests if applicable', risk: 'MEDIUM' },
        { id: 'implement', description: 'Implement fix in isolated worktree', risk: 'MEDIUM' },
        { id: 'verify', description: 'Run tests/lint/build as appropriate', risk: 'MEDIUM' },
      ];
    }

    if (initiative.category === 'DELIVERABLES') {
      return [
        { id: 'collect-signals', description: 'Collect project signals (git status, recent commits, failing tasks)', risk: 'LOW' },
        { id: 'generate-artifact', description: 'Generate deliverable artifact and persist it', risk: 'LOW' },
        { id: 'index', description: 'Index deliverable into KnowledgeIndex for retrieval', risk: 'LOW' },
      ];
    }

    return [
      { id: 'review', description: 'Review and execute with appropriate safety gates', risk: 'MEDIUM' },
    ];
  }

  private async executeCodeQuality(
    initiative: Initiative,
    plan: InitiativeExecutionPlan
  ): Promise<InitiativeExecutionOutcome> {
    // Prefer isolated worktrees for any code modifications.
    if (!this.agentSpawner) {
      return {
        status: 'QUEUED',
        summary: `Code quality initiative ready, but AgentSpawner not available: ${initiative.title}`,
        details: { recommended: plan.recommendedExecution, missing: 'agentSpawner' },
      };
    }

    const worktreeTask = [
      `You are executing an ARI Initiative in an isolated git worktree.`,
      ``,
      `## Initiative`,
      `- id: ${initiative.id}`,
      `- category: ${initiative.category}`,
      `- kind: ${initiative.kind ?? 'unknown'}`,
      `- title: ${initiative.title}`,
      ``,
      `## Rationale`,
      initiative.rationale,
      ``,
      `## Target`,
      initiative.target ? JSON.stringify(initiative.target, null, 2) : 'none',
      ``,
      `## Plan`,
      plan.steps.map(s => `- [ ] (${s.risk}) ${s.description}`).join('\n'),
      ``,
      `## Safety constraints`,
      `- Keep changes minimal and test-backed.`,
      `- No secrets, no credentials, no hardcoded user paths.`,
      `- Prefer unit tests under ${initiative.target?.testPath ?? 'tests/unit/...'} when applicable.`,
      `- Leave clear summary + how to validate.`,
      ``,
      `## Completion protocol`,
      `Write a JSON file named ".ari-completed" at the worktree root with:`,
      `{ "initiativeId": "${initiative.id}", "summary": "...", "filesChanged": ["..."], "testsRun": ["..."], "notes": "..." }`,
    ].join('\n');

    const spawned = await this.agentSpawner.spawnInWorktree(
      worktreeTask,
      `initiative-${initiative.id}`,
      { baseBranch: 'main' }
    );

    return {
      status: 'IN_PROGRESS',
      summary: `Spawned worktree agent ${spawned.id} for: ${initiative.title}`,
      details: {
        subagentId: spawned.id,
        worktreePath: spawned.worktreePath,
        branch: spawned.branch,
        safetyGates: plan.safetyGates,
      },
    };
  }

  private async executeKnowledge(
    initiative: Initiative,
    plan: InitiativeExecutionPlan
  ): Promise<InitiativeExecutionOutcome> {
    // For now: index the plan itself as a retrievable knowledge artifact.
    if (this.knowledgeIndex) {
      await this.knowledgeIndex.index({
        content: [
          `Initiative: ${initiative.title}`,
          `Category: ${initiative.category}`,
          `Kind: ${initiative.kind ?? 'unknown'}`,
          ``,
          `Rationale: ${initiative.rationale}`,
          ``,
          `Plan:`,
          plan.steps.map(s => `- (${s.risk}) ${s.description}`).join('\n'),
        ].join('\n'),
        title: `Initiative Plan: ${initiative.title}`,
        source: 'file',
        domain: 'decisions',
        tags: ['initiative', 'plan', initiative.category.toLowerCase()],
        provenance: { createdBy: 'initiative-engine', createdAt: new Date() },
      });
    }

    return {
      status: 'COMPLETED',
      summary: `Knowledge initiative processed: ${initiative.title}`,
      details: { safetyGates: plan.safetyGates },
    };
  }

  private executeOpportunity(
    initiative: Initiative,
    plan: InitiativeExecutionPlan
  ): Promise<InitiativeExecutionOutcome> {
    // Opportunities are generally user-facing; record for review.
    return Promise.resolve({
      status: 'COMPLETED',
      summary: `Opportunity recorded: ${initiative.title}`,
      details: { forUser: initiative.forUser, safetyGates: plan.safetyGates },
    });
  }

  private async executeDeliverable(
    initiative: Initiative,
    plan: InitiativeExecutionPlan
  ): Promise<InitiativeExecutionOutcome> {
    // Minimal in-process deliverable: write a status summary file and index it.
    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, '-');
    const relOut = path.join('deliverables', `status-${stamp}.md`);
    const outDir = path.join(homedir(), '.ari', 'deliverables');
    const outPath = path.join(outDir, `status-${stamp}.md`);

    await fs.mkdir(outDir, { recursive: true });

    const content = [
      `# Project Status Summary`,
      ``,
      `- Generated: ${now.toISOString()}`,
      `- Initiative: ${initiative.id} (${initiative.title})`,
      ``,
      `## Summary`,
      initiative.description,
      ``,
      `## Notes`,
      `This is an automated deliverable artifact generated by ARI.`,
    ].join('\n');

    await fs.writeFile(outPath, content, 'utf-8');

    if (this.knowledgeIndex) {
      await this.knowledgeIndex.index({
        content,
        title: `Deliverable: ${initiative.title}`,
        source: 'file',
        sourcePath: relOut,
        domain: 'docs',
        tags: ['deliverable', 'status'],
        provenance: { createdBy: 'initiative-engine', createdAt: now },
      });
    }

    return {
      status: 'COMPLETED',
      summary: `Deliverable generated at ${outPath}`,
      details: { path: outPath, indexed: !!this.knowledgeIndex, safetyGates: plan.safetyGates },
    };
  }

  private executeImprovement(
    initiative: Initiative,
    plan: InitiativeExecutionPlan
  ): Promise<InitiativeExecutionOutcome> {
    // Improvements are intentionally conservative: log + require review.
    return Promise.resolve({
      status: 'QUEUED',
      summary: `Improvement queued for review: ${initiative.title}`,
      details: { safetyGates: plan.safetyGates },
    });
  }

  /**
   * Get initiatives for user review
   */
  getForUserReview(): Initiative[] {
    return this.initiatives.filter(i =>
      i.forUser && i.status === 'DISCOVERED'
    );
  }

  /**
   * Get all active initiatives
   */
  getActive(): Initiative[] {
    return this.initiatives.filter(i =>
      i.status === 'DISCOVERED' || i.status === 'QUEUED' || i.status === 'IN_PROGRESS'
    );
  }

  /**
   * Get initiatives by status
   */
  getInitiativesByStatus(status: Initiative['status']): Initiative[] {
    return this.initiatives.filter(i => i.status === status);
  }

  /**
   * Get initiative by ID
   */
  getInitiative(id: string): Initiative | undefined {
    return this.initiatives.find(i => i.id === id);
  }

  /**
   * Get initiative stats
   */
  getStats(): {
    total: number;
    byCategory: Record<InitiativeCategory, number>;
    byStatus: Record<Initiative['status'], number>;
  } {
    const byCategory = {} as Record<InitiativeCategory, number>;
    const byStatus = {} as Record<Initiative['status'], number>;

    for (const initiative of this.initiatives) {
      byCategory[initiative.category] = (byCategory[initiative.category] || 0) + 1;
      byStatus[initiative.status] = (byStatus[initiative.status] || 0) + 1;
    }

    return {
      total: this.initiatives.length,
      byCategory,
      byStatus,
    };
  }

  /**
   * Load persisted state
   */
  private async loadState(): Promise<void> {
    const statePath = path.join(homedir(), '.ari', 'initiative-state.json');

    try {
      const data = await fs.readFile(statePath, 'utf-8');
      const state = JSON.parse(data) as { initiatives: Initiative[] };

      // Restore initiatives with Date objects
      this.initiatives = state.initiatives.map(i => ({
        ...i,
        createdAt: new Date(i.createdAt),
      }));

      // eslint-disable-next-line no-console
      console.log(`[InitiativeEngine] Loaded ${this.initiatives.length} initiatives from state`);
    } catch {
      // No state file, start fresh
    }
  }

  /**
   * Save state to disk
   */
  private async saveState(): Promise<void> {
    const statePath = path.join(homedir(), '.ari', 'initiative-state.json');

    const dir = path.dirname(statePath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(
      statePath,
      JSON.stringify({ initiatives: this.initiatives }, null, 2)
    );
  }

  /**
   * Reject an initiative
   */
  rejectInitiative(id: string, reason?: string): boolean {
    const initiative = this.initiatives.find(i => i.id === id);
    if (!initiative) return false;

    initiative.status = 'REJECTED';
    initiative.result = reason || 'Rejected by user';

    this.eventBus.emit('audit:log', {
      action: 'initiative:rejected',
      agent: 'INITIATIVE',
      trustLevel: 'system',
      details: { initiativeId: id, reason },
    });

    void this.saveState();
    return true;
  }

  /**
   * Queue an initiative for execution
   */
  queueInitiative(id: string): boolean {
    const initiative = this.initiatives.find(i => i.id === id);
    if (!initiative || initiative.status !== 'DISCOVERED') return false;

    initiative.status = 'QUEUED';

    this.eventBus.emit('audit:log', {
      action: 'initiative:queued',
      agent: 'INITIATIVE',
      trustLevel: 'system',
      details: { initiativeId: id },
    });

    void this.saveState();
    return true;
  }

  /**
   * Clear completed/rejected initiatives older than specified days
   */
  async cleanup(olderThanDays: number = 7): Promise<number> {
    const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    const before = this.initiatives.length;

    this.initiatives = this.initiatives.filter(i => {
      if (i.status === 'COMPLETED' || i.status === 'REJECTED') {
        return i.createdAt.getTime() > cutoff;
      }
      return true;
    });

    const removed = before - this.initiatives.length;
    if (removed > 0) {
      await this.saveState();
    }

    return removed;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let engineInstance: InitiativeEngine | null = null;

export function getInitiativeEngine(config?: Partial<InitiativeConfig>): InitiativeEngine {
  if (!engineInstance) {
    engineInstance = new InitiativeEngine(config);
  }
  return engineInstance;
}

export default InitiativeEngine;
