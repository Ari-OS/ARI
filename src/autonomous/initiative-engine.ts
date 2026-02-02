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
import { InitiativeExecutor } from './initiative-executor.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const eventBus = new EventBus();

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
    initiatives.push({
      id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      category: 'CODE_QUALITY',
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
    });
  }

  // Check for TODO/FIXME comments
  const todos = await findTodoComments(projectPath);
  for (const todo of todos.slice(0, 5)) {
    initiatives.push({
      id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      category: 'CODE_QUALITY',
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
    });
  }

  // Check for large files that could be refactored
  const largeFiles = await findLargeFiles(projectPath, 500);  // >500 lines
  for (const file of largeFiles.slice(0, 3)) {
    initiatives.push({
      id: `refactor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      category: 'CODE_QUALITY',
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
    });
  }

  return initiatives;
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
  private executor: InitiativeExecutor;

  constructor(config: Partial<InitiativeConfig> = {}) {
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

    // Create sophisticated executor
    this.executor = new InitiativeExecutor(eventBus, this.config.projectPath);
  }

  /**
   * Initialize the initiative engine
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // Load any persisted initiatives
    await this.loadState();

    // Initialize the sophisticated executor
    this.executor.init();

    this.initialized = true;

    eventBus.emit('audit:log', {
      action: 'initiative:initialized',
      agent: 'INITIATIVE',
      trustLevel: 'system',
      details: {
        categories: this.config.categories,
        autoExecute: this.config.autoExecute,
        threshold: this.config.autonomousThreshold,
        executorStrategies: this.executor.getStats().totalExecutions,
      },
    });

    // eslint-disable-next-line no-console
    console.log('[InitiativeEngine] Initialized with sophisticated executor');
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

    eventBus.emit('audit:log', {
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

      eventBus.emit('audit:log', {
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
      eventBus.emit('audit:log', {
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

    eventBus.emit('audit:log', {
      action: 'initiative:executing',
      agent: 'INITIATIVE',
      trustLevel: 'system',
      details: { initiativeId: initiative.id, title: initiative.title },
    });

    try {
      // Execute using sophisticated executor with full cognitive pipeline
      const executionResult = await this.executor.execute(initiative);

      if (executionResult.success) {
        initiative.status = 'COMPLETED';
        initiative.result = executionResult.output;

        eventBus.emit('audit:log', {
          action: 'initiative:completed',
          agent: 'INITIATIVE',
          trustLevel: 'system',
          details: {
            initiativeId: initiative.id,
            result: initiative.result,
            artifacts: executionResult.artifactsCreated,
            lessons: executionResult.lessonsLearned,
            duration: executionResult.duration,
          },
        });

        // Log lessons learned for continuous improvement
        if (executionResult.lessonsLearned.length > 0) {
          // eslint-disable-next-line no-console
          console.log(`[InitiativeEngine] Lessons learned: ${executionResult.lessonsLearned.join('; ')}`);
        }
      } else {
        // Execution failed but handled gracefully
        initiative.status = 'REJECTED';
        initiative.result = executionResult.output;

        eventBus.emit('audit:log', {
          action: 'initiative:soft_failed',
          agent: 'INITIATIVE',
          trustLevel: 'system',
          details: {
            initiativeId: initiative.id,
            reason: executionResult.output,
            lessons: executionResult.lessonsLearned,
          },
        });
      }
    } catch (error) {
      initiative.status = 'REJECTED';
      initiative.result = error instanceof Error ? error.message : String(error);

      eventBus.emit('audit:log', {
        action: 'initiative:hard_failed',
        agent: 'INITIATIVE',
        trustLevel: 'system',
        details: { initiativeId: initiative.id, error: initiative.result },
      });

      // Don't throw - allow engine to continue with other initiatives
      // eslint-disable-next-line no-console
      console.error(`[InitiativeEngine] Hard failure: ${initiative.result}`);
    }

    // Persist state after execution
    await this.saveState();
  }

  /**
   * Get execution statistics from the executor
   */
  getExecutorStats(): ReturnType<InitiativeExecutor['getStats']> {
    return this.executor.getStats();
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
    const statePath = path.join(
      process.env.HOME || '~',
      '.ari',
      'initiative-state.json'
    );

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
    const statePath = path.join(
      process.env.HOME || '~',
      '.ari',
      'initiative-state.json'
    );

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

    eventBus.emit('audit:log', {
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

    eventBus.emit('audit:log', {
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
