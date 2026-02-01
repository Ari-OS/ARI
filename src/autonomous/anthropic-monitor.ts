/**
 * Anthropic Monitor
 *
 * Autonomous monitoring of official Anthropic sources for updates that can improve ARI.
 * Only uses verified sources (anthropic.com, docs.anthropic.com, claude.com, github.com/anthropics).
 *
 * Governance Flow:
 * 1. Monitor detects update from verified source
 * 2. Guardian assesses security implications
 * 3. Council votes on whether to proceed (13 agents)
 * 4. If approved, implementation plan is generated
 * 5. Comprehensive decision report sent to operator
 * 6. Operator approves/rejects final implementation
 *
 * Security: Content ≠ Command principle. All external content is DATA, never executable.
 */

import { EventEmitter } from 'events';
import { createHash, randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { AgentId, VoteThreshold, RiskLevel } from '../kernel/types.js';
import { VOTING_AGENTS } from '../kernel/types.js';

// ── Verified Sources ─────────────────────────────────────────────────────────

export const VERIFIED_SOURCES = {
  news: 'https://www.anthropic.com/news',
  blog: 'https://claude.com/blog',
  releases: 'https://api.github.com/repos/anthropics/claude-code/releases',
  research: 'https://www.anthropic.com/research',
} as const;

export type SourceKey = keyof typeof VERIFIED_SOURCES;

// ── Types ────────────────────────────────────────────────────────────────────

export interface AnthropicUpdate {
  id: string;
  source: SourceKey;
  title: string;
  description: string;
  url: string;
  date: string;
  relevance: 'critical' | 'high' | 'medium' | 'low';
  category: 'security' | 'feature' | 'api' | 'research' | 'plugin' | 'model';
  hash: string;
}

export interface SecurityAssessment {
  riskLevel: RiskLevel;
  threats: string[];
  mitigations: string[];
  architectureImpact: 'none' | 'minor' | 'moderate' | 'significant';
  requiresAudit: boolean;
  affectedLayers: string[];
}

export interface ImplementationPlan {
  summary: string;
  phases: {
    phase: number;
    name: string;
    description: string;
    tasks: string[];
    estimatedComplexity: 'trivial' | 'simple' | 'moderate' | 'complex';
    rollbackStrategy: string;
  }[];
  dependencies: string[];
  testingRequirements: string[];
  monitoringChanges: string[];
}

export interface CouncilDecision {
  voteId: string;
  topic: string;
  threshold: VoteThreshold;
  result: 'PASSED' | 'FAILED' | 'EXPIRED' | 'PENDING';
  votes: {
    agent: AgentId;
    vote: 'APPROVE' | 'REJECT' | 'ABSTAIN';
    reasoning: string;
  }[];
  quorumMet: boolean;
  approvalPercentage: number;
}

export interface DecisionReport {
  id: string;
  timestamp: string;
  update: AnthropicUpdate;
  securityAssessment: SecurityAssessment;
  ariAnalysis: {
    benefitScore: number; // 0-100
    alignmentWithGoals: string[];
    potentialImprovements: string[];
    risks: string[];
    recommendation: 'strongly_recommend' | 'recommend' | 'neutral' | 'caution' | 'reject';
    reasoning: string;
  };
  councilDecision: CouncilDecision;
  implementationPlan: ImplementationPlan | null;
  operatorAction: {
    required: boolean;
    options: ('approve' | 'reject' | 'defer' | 'modify')[];
    deadline: string | null;
    defaultAction: 'approve' | 'reject' | 'defer';
  };
}

export interface NotificationPayload {
  type: 'anthropic_update_decision';
  priority: 'critical' | 'high' | 'normal' | 'low';
  report: DecisionReport;
  summary: string;
  actionUrl: string | null;
}

// ── Anthropic Monitor ────────────────────────────────────────────────────────

export class AnthropicMonitor extends EventEmitter {
  private stateFile: string;
  private reportsDir: string;
  private seenHashes: Set<string> = new Set();
  private lastCheck: Date | null = null;
  private pendingReports: Map<string, DecisionReport> = new Map();

  constructor(stateDir: string = '~/.ari') {
    super();
    const resolvedDir = stateDir.startsWith('~')
      ? stateDir.replace('~', process.env.HOME || '')
      : stateDir;
    this.stateFile = path.join(resolvedDir, 'anthropic-monitor-state.json');
    this.reportsDir = path.join(resolvedDir, 'update-reports');
  }

  // ── State Management ─────────────────────────────────────────────────────

  async loadState(): Promise<void> {
    try {
      const content = await fs.readFile(this.stateFile, 'utf-8');
      const state = JSON.parse(content) as { seenHashes?: string[]; lastCheck?: string };
      this.seenHashes = new Set(state.seenHashes ?? []);
      this.lastCheck = state.lastCheck ? new Date(state.lastCheck) : null;
    } catch {
      this.seenHashes = new Set();
      this.lastCheck = null;
    }
  }

  async saveState(): Promise<void> {
    const state = {
      seenHashes: Array.from(this.seenHashes),
      lastCheck: new Date().toISOString(),
    };
    await fs.mkdir(path.dirname(this.stateFile), { recursive: true });
    await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2));
  }

  // ── Update Detection ─────────────────────────────────────────────────────

  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  isNewUpdate(hash: string): boolean {
    if (this.seenHashes.has(hash)) {
      return false;
    }
    this.seenHashes.add(hash);
    return true;
  }

  categorizeUpdate(title: string, description: string): {
    relevance: AnthropicUpdate['relevance'];
    category: AnthropicUpdate['category'];
  } {
    const text = `${title} ${description}`.toLowerCase();

    // Critical: Security vulnerabilities
    if (text.includes('vulnerability') || text.includes('cve-') || text.includes('security patch')) {
      return { relevance: 'critical', category: 'security' };
    }

    // High: Security, breaking API changes, major features
    if (text.includes('security') || text.includes('breaking change')) {
      return { relevance: 'high', category: 'security' };
    }
    if (text.includes('deprecat') || (text.includes('api') && text.includes('removed'))) {
      return { relevance: 'high', category: 'api' };
    }
    if (text.includes('claude code') || text.includes('plugin') || text.includes('cowork')) {
      return { relevance: 'high', category: 'plugin' };
    }

    // Medium: New features, model updates
    if (text.includes('opus') || text.includes('sonnet') || text.includes('haiku')) {
      return { relevance: 'medium', category: 'model' };
    }
    if (text.includes('feature') || text.includes('new') || text.includes('introducing')) {
      return { relevance: 'medium', category: 'feature' };
    }
    if (text.includes('api') || text.includes('sdk')) {
      return { relevance: 'medium', category: 'api' };
    }

    // Low: Research, general news
    if (text.includes('research') || text.includes('paper')) {
      return { relevance: 'low', category: 'research' };
    }

    return { relevance: 'low', category: 'feature' };
  }

  // ── Security Assessment ──────────────────────────────────────────────────

  assessSecurity(update: AnthropicUpdate): SecurityAssessment {
    const assessment: SecurityAssessment = {
      riskLevel: 'LOW',
      threats: [],
      mitigations: [],
      architectureImpact: 'none',
      requiresAudit: false,
      affectedLayers: [],
    };

    // Assess based on category
    switch (update.category) {
      case 'security':
        assessment.riskLevel = update.relevance === 'critical' ? 'CRITICAL' : 'HIGH';
        assessment.requiresAudit = true;
        assessment.threats.push('Potential vulnerability if not applied');
        assessment.mitigations.push('Apply update after review');
        assessment.affectedLayers.push('kernel');
        break;

      case 'api':
        assessment.riskLevel = update.relevance === 'high' ? 'HIGH' : 'MEDIUM';
        assessment.architectureImpact = 'moderate';
        assessment.threats.push('Breaking changes may affect integrations');
        assessment.mitigations.push('Review API compatibility', 'Update affected modules');
        assessment.affectedLayers.push('kernel', 'agents');
        break;

      case 'plugin':
        assessment.riskLevel = 'MEDIUM';
        assessment.architectureImpact = 'minor';
        assessment.threats.push('New plugin patterns may conflict');
        assessment.mitigations.push('Test in isolated environment');
        assessment.affectedLayers.push('skills', 'integrations');
        break;

      case 'model':
        assessment.riskLevel = 'LOW';
        assessment.architectureImpact = 'none';
        assessment.mitigations.push('Update model configuration if beneficial');
        break;

      default:
        assessment.riskLevel = 'LOW';
        assessment.architectureImpact = 'none';
    }

    return assessment;
  }

  // ── ARI Analysis ─────────────────────────────────────────────────────────

  analyzeForARI(update: AnthropicUpdate, security: SecurityAssessment): DecisionReport['ariAnalysis'] {
    let benefitScore = 50; // Base score
    const alignmentWithGoals: string[] = [];
    const potentialImprovements: string[] = [];
    const risks: string[] = [];

    // Evaluate benefit based on category
    switch (update.category) {
      case 'security':
        benefitScore = 95;
        alignmentWithGoals.push('Maintaining security posture');
        potentialImprovements.push('Patched vulnerabilities', 'Improved security model');
        break;

      case 'plugin':
        benefitScore = 85;
        alignmentWithGoals.push('Extensibility and integration');
        potentialImprovements.push('New plugin capabilities', 'Better Claude Code integration');
        break;

      case 'api':
        benefitScore = 70;
        alignmentWithGoals.push('API compatibility');
        potentialImprovements.push('Access to new features', 'Performance improvements');
        risks.push('Potential breaking changes');
        break;

      case 'model':
        benefitScore = 65;
        alignmentWithGoals.push('Leveraging latest capabilities');
        potentialImprovements.push('Better reasoning', 'Improved accuracy');
        break;

      case 'feature':
        benefitScore = 60;
        alignmentWithGoals.push('Capability expansion');
        potentialImprovements.push('New functionality');
        break;

      case 'research':
        benefitScore = 40;
        alignmentWithGoals.push('Knowledge acquisition');
        potentialImprovements.push('Insights for future development');
        break;
    }

    // Adjust for security risk
    if (security.riskLevel === 'CRITICAL') {
      benefitScore = Math.max(benefitScore, 95);
      risks.push('Critical security issue requires immediate attention');
    } else if (security.riskLevel === 'HIGH') {
      risks.push('High-risk changes require careful review');
    }

    // Determine recommendation
    let recommendation: DecisionReport['ariAnalysis']['recommendation'];
    if (benefitScore >= 90) {
      recommendation = 'strongly_recommend';
    } else if (benefitScore >= 70) {
      recommendation = 'recommend';
    } else if (benefitScore >= 50) {
      recommendation = 'neutral';
    } else if (benefitScore >= 30) {
      recommendation = 'caution';
    } else {
      recommendation = 'reject';
    }

    // Generate reasoning
    const reasoning = this.generateReasoning(update, security, benefitScore, recommendation);

    return {
      benefitScore,
      alignmentWithGoals,
      potentialImprovements,
      risks,
      recommendation,
      reasoning,
    };
  }

  private generateReasoning(
    update: AnthropicUpdate,
    security: SecurityAssessment,
    benefitScore: number,
    recommendation: string
  ): string {
    const parts: string[] = [];

    parts.push(`This ${update.category} update from Anthropic has been assessed with a benefit score of ${benefitScore}/100.`);

    if (security.riskLevel === 'CRITICAL' || security.riskLevel === 'HIGH') {
      parts.push(`Security assessment indicates ${security.riskLevel} risk level, requiring immediate attention.`);
    }

    if (security.architectureImpact !== 'none') {
      parts.push(`Architecture impact is ${security.architectureImpact}, affecting: ${security.affectedLayers.join(', ')}.`);
    }

    switch (recommendation) {
      case 'strongly_recommend':
        parts.push('Strong recommendation to proceed based on significant benefits and/or security requirements.');
        break;
      case 'recommend':
        parts.push('Recommendation to proceed based on positive benefit-risk analysis.');
        break;
      case 'neutral':
        parts.push('Neutral stance - benefits and risks are balanced. Operator discretion advised.');
        break;
      case 'caution':
        parts.push('Caution advised - potential risks may outweigh benefits. Careful review required.');
        break;
      case 'reject':
        parts.push('Recommendation to reject - risks outweigh benefits or update is not relevant.');
        break;
    }

    return parts.join(' ');
  }

  // ── Implementation Planning ──────────────────────────────────────────────

  generateImplementationPlan(update: AnthropicUpdate, security: SecurityAssessment): ImplementationPlan {
    const phases: ImplementationPlan['phases'] = [];

    // Phase 1: Always start with assessment
    phases.push({
      phase: 1,
      name: 'Assessment & Preparation',
      description: 'Detailed review of changes and preparation of implementation environment',
      tasks: [
        'Review full changelog/documentation',
        'Identify affected ARI components',
        'Create backup of current state',
        'Set up isolated test environment',
      ],
      estimatedComplexity: 'simple',
      rollbackStrategy: 'No changes made yet - abort process',
    });

    // Phase 2: Implementation based on category
    switch (update.category) {
      case 'security':
        phases.push({
          phase: 2,
          name: 'Security Patch Application',
          description: 'Apply security updates with full audit trail',
          tasks: [
            'Apply security patches to affected modules',
            'Update security configurations',
            'Run security test suite',
            'Verify audit chain integrity',
          ],
          estimatedComplexity: security.riskLevel === 'CRITICAL' ? 'complex' : 'moderate',
          rollbackStrategy: 'Restore from backup, revert git commits',
        });
        break;

      case 'api':
        phases.push({
          phase: 2,
          name: 'API Integration Update',
          description: 'Update API integrations and adapters',
          tasks: [
            'Update SDK/API client versions',
            'Modify affected API calls',
            'Update type definitions',
            'Run integration tests',
          ],
          estimatedComplexity: 'moderate',
          rollbackStrategy: 'Revert package versions, restore previous API handlers',
        });
        break;

      case 'plugin':
        phases.push({
          phase: 2,
          name: 'Plugin System Update',
          description: 'Integrate new plugin capabilities',
          tasks: [
            'Update Cowork bridge if needed',
            'Add new skill/tool definitions',
            'Update MCP server handlers',
            'Test plugin import/export',
          ],
          estimatedComplexity: 'moderate',
          rollbackStrategy: 'Remove new plugin components, restore previous skill definitions',
        });
        break;

      case 'model':
        phases.push({
          phase: 2,
          name: 'Model Configuration Update',
          description: 'Update model references and configurations',
          tasks: [
            'Update model identifiers in config',
            'Adjust prompts if needed',
            'Test with new model',
            'Benchmark performance',
          ],
          estimatedComplexity: 'simple',
          rollbackStrategy: 'Revert config to previous model',
        });
        break;

      default:
        phases.push({
          phase: 2,
          name: 'Feature Integration',
          description: 'Integrate new feature or capability',
          tasks: [
            'Implement feature changes',
            'Add necessary tests',
            'Update documentation',
          ],
          estimatedComplexity: 'moderate',
          rollbackStrategy: 'Revert feature commits',
        });
    }

    // Phase 3: Validation
    phases.push({
      phase: 3,
      name: 'Validation & Testing',
      description: 'Comprehensive testing before production deployment',
      tasks: [
        'Run full test suite (2107+ tests)',
        'Verify 80%+ code coverage maintained',
        'Security path verification (100% coverage)',
        'Manual validation of critical paths',
      ],
      estimatedComplexity: 'simple',
      rollbackStrategy: 'If tests fail, rollback to Phase 1 state',
    });

    // Phase 4: Deployment
    phases.push({
      phase: 4,
      name: 'Production Deployment',
      description: 'Deploy to production with monitoring',
      tasks: [
        'Build production artifacts',
        'Deploy to Mac Mini',
        'Restart daemon service',
        'Verify health endpoints',
        'Monitor for 24 hours',
      ],
      estimatedComplexity: 'simple',
      rollbackStrategy: 'launchctl kickstart with previous build',
    });

    return {
      summary: `Implementation plan for: ${update.title}`,
      phases,
      dependencies: this.identifyDependencies(update, security),
      testingRequirements: [
        'All existing tests must pass',
        'New functionality requires test coverage',
        'Security tests for affected paths',
        'Integration tests with external services',
      ],
      monitoringChanges: [
        'Add metrics for new functionality',
        'Update alerting thresholds if needed',
        'Log new event types to audit trail',
      ],
    };
  }

  private identifyDependencies(update: AnthropicUpdate, security: SecurityAssessment): string[] {
    const deps: string[] = [];

    if (security.affectedLayers.includes('kernel')) {
      deps.push('Full system restart required');
    }
    if (update.category === 'api') {
      deps.push('API client library updates');
    }
    if (update.category === 'plugin') {
      deps.push('Cowork bridge compatibility');
    }

    return deps;
  }

  // ── Council Decision Simulation ──────────────────────────────────────────

  simulateCouncilVote(
    update: AnthropicUpdate,
    security: SecurityAssessment,
    ariAnalysis: DecisionReport['ariAnalysis']
  ): CouncilDecision {
    const voteId = randomUUID();
    // Use the 15-member Council voting agents
    const agents: AgentId[] = VOTING_AGENTS as unknown as AgentId[];

    // Determine threshold based on risk
    let threshold: VoteThreshold;
    if (security.riskLevel === 'CRITICAL') {
      threshold = 'UNANIMOUS';
    } else if (security.riskLevel === 'HIGH') {
      threshold = 'SUPERMAJORITY';
    } else {
      threshold = 'MAJORITY';
    }

    // Simulate agent votes based on their roles and the update
    const votes = agents.map(agent => this.simulateAgentVote(agent, update, security, ariAnalysis));

    const approveCount = votes.filter(v => v.vote === 'APPROVE').length;
    const rejectCount = votes.filter(v => v.vote === 'REJECT').length;
    const approvalPercentage = (approveCount / agents.length) * 100;

    // Determine result
    let result: CouncilDecision['result'];
    if (threshold === 'UNANIMOUS' && rejectCount > 0) {
      result = 'FAILED';
    } else if (threshold === 'SUPERMAJORITY' && approvalPercentage < 66) {
      result = 'FAILED';
    } else if (threshold === 'MAJORITY' && approvalPercentage <= 50) {
      result = 'FAILED';
    } else {
      result = 'PASSED';
    }

    return {
      voteId,
      topic: `Anthropic Update: ${update.title}`,
      threshold,
      result,
      votes,
      quorumMet: true, // All agents vote
      approvalPercentage: Math.round(approvalPercentage),
    };
  }

  private simulateAgentVote(
    agent: AgentId,
    update: AnthropicUpdate,
    security: SecurityAssessment,
    ariAnalysis: DecisionReport['ariAnalysis']
  ): CouncilDecision['votes'][0] {
    // Each Council member has different priorities based on their role
    // The 15 voting members of the Council:
    // Infrastructure: router (ATLAS), executor (BOLT), memory_keeper (ECHO)
    // Protection: guardian (AEGIS), risk_assessor (SCOUT)
    // Strategy: planner (TRUE), scheduler (TEMPO), resource_manager (OPAL)
    // Domains: wellness (PULSE), relationships (EMBER), creative (PRISM), wealth (MINT), growth (BLOOM)
    // Meta: ethics (VERA), integrator (NEXUS)
    const agentPriorities: Partial<Record<AgentId, { categories: string[]; riskTolerance: number }>> = {
      // Infrastructure pillar
      router: { categories: ['api', 'plugin'], riskTolerance: 0.5 },       // ATLAS - guides
      executor: { categories: ['plugin', 'api'], riskTolerance: 0.6 },     // BOLT - executes
      memory_keeper: { categories: ['feature'], riskTolerance: 0.4 },      // ECHO - remembers
      // Protection pillar
      guardian: { categories: ['security'], riskTolerance: 0.3 },          // AEGIS - shields (cautious)
      risk_assessor: { categories: ['security', 'api'], riskTolerance: 0.3 }, // SCOUT - spots risks (cautious)
      // Strategy pillar
      planner: { categories: ['feature', 'api'], riskTolerance: 0.6 },     // TRUE - plans (progressive)
      scheduler: { categories: ['feature'], riskTolerance: 0.5 },          // TEMPO - schedules
      resource_manager: { categories: ['feature'], riskTolerance: 0.5 },   // OPAL - resources
      // Life domains pillar
      wellness: { categories: ['feature'], riskTolerance: 0.5 },           // PULSE - health
      relationships: { categories: ['feature'], riskTolerance: 0.5 },      // EMBER - connections
      creative: { categories: ['feature', 'model'], riskTolerance: 0.7 },  // PRISM - creative (progressive)
      wealth: { categories: ['feature', 'api'], riskTolerance: 0.4 },      // MINT - financial
      growth: { categories: ['feature', 'research'], riskTolerance: 0.7 }, // BLOOM - growth (progressive)
      // Meta pillar
      ethics: { categories: ['security'], riskTolerance: 0.3 },            // VERA - truth (cautious)
      integrator: { categories: ['api', 'feature'], riskTolerance: 0.5 },  // NEXUS - ties together
      // System agents (non-voting but included for completeness)
      core: { categories: ['security', 'api'], riskTolerance: 0.5 },
      arbiter: { categories: ['security'], riskTolerance: 0.3 },
      overseer: { categories: ['security', 'api'], riskTolerance: 0.4 },
      autonomous: { categories: ['feature', 'plugin'], riskTolerance: 0.6 },
    };

    const prefs = agentPriorities[agent] || { categories: [], riskTolerance: 0.5 };
    const categoryMatch = prefs.categories.includes(update.category);
    const riskScore = security.riskLevel === 'CRITICAL' ? 1.0 :
                      security.riskLevel === 'HIGH' ? 0.7 :
                      security.riskLevel === 'MEDIUM' ? 0.4 : 0.1;

    // Decision logic
    let vote: 'APPROVE' | 'REJECT' | 'ABSTAIN';
    let reasoning: string;

    if (security.riskLevel === 'CRITICAL' && update.category === 'security') {
      // Everyone approves critical security patches
      vote = 'APPROVE';
      reasoning = 'Critical security update must be applied.';
    } else if (riskScore > prefs.riskTolerance && !categoryMatch) {
      vote = 'REJECT';
      reasoning = `Risk level (${security.riskLevel}) exceeds tolerance for non-priority category.`;
    } else if (ariAnalysis.benefitScore >= 70 || categoryMatch) {
      vote = 'APPROVE';
      reasoning = categoryMatch
        ? `Update aligns with ${agent} priorities (${update.category}).`
        : `Benefit score of ${ariAnalysis.benefitScore} justifies implementation.`;
    } else if (ariAnalysis.benefitScore >= 40) {
      vote = 'ABSTAIN';
      reasoning = 'Neutral on this update - neither significant benefit nor risk.';
    } else {
      vote = 'REJECT';
      reasoning = `Low benefit score (${ariAnalysis.benefitScore}) does not justify implementation effort.`;
    }

    return { agent, vote, reasoning };
  }

  // ── Decision Report Generation ───────────────────────────────────────────

  async generateDecisionReport(update: AnthropicUpdate): Promise<DecisionReport> {
    const security = this.assessSecurity(update);
    const ariAnalysis = this.analyzeForARI(update, security);
    const councilDecision = this.simulateCouncilVote(update, security, ariAnalysis);

    // Only generate implementation plan if council approved
    const implementationPlan = councilDecision.result === 'PASSED'
      ? this.generateImplementationPlan(update, security)
      : null;

    // Determine operator action requirements
    const operatorAction = this.determineOperatorAction(update, security, councilDecision);

    const report: DecisionReport = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      update,
      securityAssessment: security,
      ariAnalysis,
      councilDecision,
      implementationPlan,
      operatorAction,
    };

    // Save report to disk
    await this.saveReport(report);

    // Store in pending for tracking
    this.pendingReports.set(report.id, report);

    // Emit event for notification system
    this.emit('decision:ready', report);

    return report;
  }

  private determineOperatorAction(
    update: AnthropicUpdate,
    security: SecurityAssessment,
    council: CouncilDecision
  ): DecisionReport['operatorAction'] {
    // Critical security always requires operator action
    if (security.riskLevel === 'CRITICAL') {
      return {
        required: true,
        options: ['approve', 'defer'],
        deadline: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours
        defaultAction: 'approve',
      };
    }

    // Council rejected - inform operator but no action needed
    if (council.result === 'FAILED') {
      return {
        required: false,
        options: ['approve', 'reject'], // Can override
        deadline: null,
        defaultAction: 'reject',
      };
    }

    // Council approved - get operator confirmation
    return {
      required: true,
      options: ['approve', 'reject', 'defer', 'modify'],
      deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      defaultAction: 'approve',
    };
  }

  private async saveReport(report: DecisionReport): Promise<void> {
    await fs.mkdir(this.reportsDir, { recursive: true });
    const filename = `${report.timestamp.split('T')[0]}-${report.id.slice(0, 8)}.json`;
    await fs.writeFile(
      path.join(this.reportsDir, filename),
      JSON.stringify(report, null, 2)
    );
  }

  // ── Notification Formatting ──────────────────────────────────────────────

  formatNotification(report: DecisionReport): NotificationPayload {
    const priority = report.securityAssessment.riskLevel === 'CRITICAL' ? 'critical' :
                     report.securityAssessment.riskLevel === 'HIGH' ? 'high' :
                     report.councilDecision.result === 'PASSED' ? 'normal' : 'low';

    const summary = this.formatSummary(report);

    return {
      type: 'anthropic_update_decision',
      priority,
      report,
      summary,
      actionUrl: null, // Would be dashboard URL
    };
  }

  private formatSummary(report: DecisionReport): string {
    const r = report;
    const emoji = r.councilDecision.result === 'PASSED' ? '✅' :
                  r.councilDecision.result === 'FAILED' ? '❌' : '⏳';

    return `${emoji} **Anthropic Update: ${r.update.title}**

**Category:** ${r.update.category.toUpperCase()}
**Relevance:** ${r.update.relevance}
**Source:** ${r.update.source}

---

**Security Assessment**
• Risk Level: ${r.securityAssessment.riskLevel}
• Architecture Impact: ${r.securityAssessment.architectureImpact}
• Affected Layers: ${r.securityAssessment.affectedLayers.join(', ') || 'None'}

---

**ARI Analysis**
• Benefit Score: ${r.ariAnalysis.benefitScore}/100
• Recommendation: ${r.ariAnalysis.recommendation.replace('_', ' ').toUpperCase()}
• Reasoning: ${r.ariAnalysis.reasoning}

**Potential Improvements:**
${r.ariAnalysis.potentialImprovements.map(i => `• ${i}`).join('\n')}

**Risks:**
${r.ariAnalysis.risks.map(i => `• ${i}`).join('\n') || '• None identified'}

---

**Council Decision**
• Result: ${r.councilDecision.result}
• Threshold: ${r.councilDecision.threshold}
• Approval: ${r.councilDecision.approvalPercentage}%
• Quorum: ${r.councilDecision.quorumMet ? 'Met' : 'Not Met'}

**Votes:**
${r.councilDecision.votes.map(v => `• ${v.agent}: ${v.vote} - ${v.reasoning}`).join('\n')}

---

${r.implementationPlan ? `**Implementation Plan**
${r.implementationPlan.phases.map(p => `
**Phase ${p.phase}: ${p.name}**
${p.description}
Tasks:
${p.tasks.map(t => `  • ${t}`).join('\n')}
Complexity: ${p.estimatedComplexity}
Rollback: ${p.rollbackStrategy}
`).join('\n')}

**Dependencies:** ${r.implementationPlan.dependencies.join(', ') || 'None'}

**Testing Requirements:**
${r.implementationPlan.testingRequirements.map(t => `• ${t}`).join('\n')}
` : '*No implementation plan generated (Council rejected)*'}

---

**Your Action Required**
${r.operatorAction.required ? `
Please respond with one of: ${r.operatorAction.options.join(', ')}
${r.operatorAction.deadline ? `Deadline: ${r.operatorAction.deadline}` : ''}
Default action (if no response): ${r.operatorAction.defaultAction}
` : 'No action required. Update has been rejected by Council.'}`;
  }

  // ── Public Interface ─────────────────────────────────────────────────────

  getSchedule(): { interval: number; nextCheck: Date } {
    const interval = 6 * 60 * 60 * 1000; // 6 hours
    const nextCheck = this.lastCheck
      ? new Date(this.lastCheck.getTime() + interval)
      : new Date();
    return { interval, nextCheck };
  }

  getPendingReports(): DecisionReport[] {
    return Array.from(this.pendingReports.values());
  }

  processOperatorDecision(reportId: string, action: 'approve' | 'reject' | 'defer' | 'modify'): void {
    const report = this.pendingReports.get(reportId);
    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }

    this.emit('operator:decision', { reportId, action, report });

    if (action === 'approve' && report.implementationPlan) {
      this.emit('implementation:start', report);
    }

    if (action !== 'defer') {
      this.pendingReports.delete(reportId);
    }
  }
}

// ── Export Singleton ─────────────────────────────────────────────────────────

export const anthropicMonitor = new AnthropicMonitor();
