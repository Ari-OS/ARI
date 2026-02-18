/**
 * ARI Project Generator — Opportunity Detection & Project Scaffolding
 *
 * Detects opportunities from market intelligence, learnings, and user
 * interests, then proposes and scaffolds project structures using
 * LLM-powered generation.
 *
 * Features:
 *   - Opportunity → project proposal pipeline
 *   - LLM-powered project scaffolding
 *   - Proposal tracking and lifecycle
 *   - EventBus events for notifications
 *
 * Layer: L5 (Autonomous Operations)
 */

import { randomUUID } from 'node:crypto';
import type { EventBus } from '../kernel/event-bus.js';
import type { AIOrchestrator } from '../ai/orchestrator.js';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('project-generator');

// ─── Types ──────────────────────────────────────────────────────────────────

export type ProjectStatus = 'proposed' | 'approved' | 'scaffolded' | 'in_progress' | 'completed' | 'rejected';
export type ProjectCategory = 'saas' | 'content' | 'automation' | 'research' | 'side_project' | 'client_work';

export interface Opportunity {
  title: string;
  description: string;
  category: ProjectCategory;
  signals: string[];
  estimatedEffort: 'low' | 'medium' | 'high';
  estimatedValue: 'low' | 'medium' | 'high';
  source: string;
}

export interface ProjectProposal {
  id: string;
  opportunity: Opportunity;
  projectName: string;
  summary: string;
  techStack: string[];
  milestones: string[];
  risks: string[];
  score: number; // 0-100
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ScaffoldResult {
  proposalId: string;
  structure: ProjectStructure;
  scaffoldedAt: string;
}

export interface ProjectStructure {
  directories: string[];
  files: Array<{ path: string; description: string }>;
  dependencies: string[];
  scripts: Record<string, string>;
  readme: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const EFFORT_SCORES: Record<string, number> = {
  low: 30,
  medium: 20,
  high: 10,
};

const VALUE_SCORES: Record<string, number> = {
  low: 10,
  medium: 25,
  high: 40,
};

const PROPOSAL_PROMPT = `You are a project planner for Pryceless Solutions.
Given an opportunity, generate a structured project proposal.

Return JSON with:
{
  "projectName": "kebab-case-name",
  "summary": "1-2 sentence description",
  "techStack": ["typescript", "nextjs", ...],
  "milestones": ["M1: Setup", "M2: Core feature", ...],
  "risks": ["Risk 1", "Risk 2"]
}

Opportunity:
`;

const SCAFFOLD_PROMPT = `You are a project scaffolder for Pryceless Solutions.
Given a project proposal, generate the directory/file structure.

Return JSON with:
{
  "directories": ["src/", "src/components/", "tests/", ...],
  "files": [
    {"path": "package.json", "description": "Project manifest"},
    {"path": "src/index.ts", "description": "Entry point"},
    ...
  ],
  "dependencies": ["zod", "fastify", ...],
  "scripts": {"dev": "tsx watch src/index.ts", "build": "tsc", "test": "vitest"},
  "readme": "# Project Name\\n\\nDescription..."
}

Project:
`;

// ─── ProjectGenerator ───────────────────────────────────────────────────────

export class ProjectGenerator {
  private readonly eventBus: EventBus;
  private readonly orchestrator: AIOrchestrator;
  private proposals: Map<string, ProjectProposal> = new Map();

  constructor(params: {
    eventBus: EventBus;
    orchestrator: AIOrchestrator;
  }) {
    this.eventBus = params.eventBus;
    this.orchestrator = params.orchestrator;
  }

  /**
   * Generate a project proposal from an opportunity
   */
  async proposeProject(opportunity: Opportunity): Promise<ProjectProposal> {
    const id = randomUUID();
    const now = new Date().toISOString();

    let projectName = opportunity.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    let summary = opportunity.description;
    let techStack: string[] = ['typescript'];
    let milestones: string[] = ['M1: Research', 'M2: Prototype', 'M3: MVP'];
    let risks: string[] = ['Scope creep', 'Market timing'];

    // Use LLM for proposal generation
    try {
      const response = await this.orchestrator.query(
        `${PROPOSAL_PROMPT}Title: ${opportunity.title}\nDescription: ${opportunity.description}\nCategory: ${opportunity.category}\nSignals: ${opportunity.signals.join(', ')}`,
        'core',
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        if (typeof parsed.projectName === 'string') projectName = parsed.projectName;
        if (typeof parsed.summary === 'string') summary = parsed.summary;
        if (Array.isArray(parsed.techStack)) techStack = parsed.techStack.map(String);
        if (Array.isArray(parsed.milestones)) milestones = parsed.milestones.map(String);
        if (Array.isArray(parsed.risks)) risks = parsed.risks.map(String);
      }
    } catch (error) {
      log.warn({ error, opportunity: opportunity.title }, 'LLM proposal generation failed, using defaults');
    }

    // Calculate score based on effort vs value
    const effortScore = EFFORT_SCORES[opportunity.estimatedEffort] ?? 20;
    const valueScore = VALUE_SCORES[opportunity.estimatedValue] ?? 25;
    const signalBonus = Math.min(30, opportunity.signals.length * 10);
    const score = Math.min(100, effortScore + valueScore + signalBonus);

    const proposal: ProjectProposal = {
      id,
      opportunity,
      projectName,
      summary,
      techStack,
      milestones,
      risks,
      score,
      status: 'proposed',
      createdAt: now,
      updatedAt: now,
    };

    this.proposals.set(id, proposal);

    this.eventBus.emit('project:proposed', {
      timestamp: now,
      name: projectName,
      description: summary,
    });

    log.info({ id, projectName, score }, 'Project proposed');

    return proposal;
  }

  /**
   * Scaffold a proposed project (generate structure)
   */
  async scaffoldProject(proposalId: string): Promise<ScaffoldResult | null> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      log.warn({ proposalId }, 'Proposal not found for scaffolding');
      return null;
    }

    const structure: ProjectStructure = {
      directories: ['src/', 'tests/', 'docs/'],
      files: [
        { path: 'package.json', description: 'Project manifest' },
        { path: 'tsconfig.json', description: 'TypeScript config' },
        { path: 'src/index.ts', description: 'Entry point' },
      ],
      dependencies: proposal.techStack.filter(t => t !== 'typescript'),
      scripts: {
        dev: 'tsx watch src/index.ts',
        build: 'tsc',
        test: 'vitest',
      },
      readme: `# ${proposal.projectName}\n\n${proposal.summary}`,
    };

    // Use LLM for scaffold generation
    try {
      const response = await this.orchestrator.query(
        `${SCAFFOLD_PROMPT}Name: ${proposal.projectName}\nSummary: ${proposal.summary}\nTech Stack: ${proposal.techStack.join(', ')}\nMilestones: ${proposal.milestones.join(', ')}`,
        'core',
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        if (Array.isArray(parsed.directories)) {
          structure.directories = parsed.directories.map(String);
        }
        if (Array.isArray(parsed.files)) {
          structure.files = (parsed.files as Array<Record<string, string>>).map(f => ({
            path: f.path ?? '',
            description: f.description ?? '',
          }));
        }
        if (Array.isArray(parsed.dependencies)) {
          structure.dependencies = parsed.dependencies.map(String);
        }
        if (parsed.scripts && typeof parsed.scripts === 'object') {
          structure.scripts = Object.fromEntries(
            Object.entries(parsed.scripts as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
          );
        }
        if (typeof parsed.readme === 'string') {
          structure.readme = parsed.readme;
        }
      }
    } catch (error) {
      log.warn({ error, proposalId }, 'LLM scaffold generation failed, using defaults');
    }

    // Update proposal status
    proposal.status = 'scaffolded';
    proposal.updatedAt = new Date().toISOString();

    const result: ScaffoldResult = {
      proposalId,
      structure,
      scaffoldedAt: proposal.updatedAt,
    };

    this.eventBus.emit('project:approved', {
      timestamp: proposal.updatedAt,
      name: proposal.projectName,
      scaffoldedAt: proposal.updatedAt,
    });

    log.info(
      { proposalId, projectName: proposal.projectName, files: structure.files.length },
      'Project scaffolded',
    );

    return result;
  }

  /**
   * List all proposals, optionally filtered by status
   */
  listProposals(status?: ProjectStatus): ProjectProposal[] {
    const proposals = Array.from(this.proposals.values());

    if (status) {
      return proposals.filter(p => p.status === status);
    }

    return proposals.sort((a, b) => b.score - a.score);
  }

  /**
   * Get a specific proposal by ID
   */
  getProposal(proposalId: string): ProjectProposal | null {
    return this.proposals.get(proposalId) ?? null;
  }

  /**
   * Update a proposal's status
   */
  updateStatus(proposalId: string, status: ProjectStatus): boolean {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return false;

    proposal.status = status;
    proposal.updatedAt = new Date().toISOString();

    log.info({ proposalId, status }, 'Proposal status updated');
    return true;
  }
}
