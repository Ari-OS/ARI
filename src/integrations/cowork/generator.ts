/**
 * Cowork Plugin Generator
 *
 * AI-powered plugin generation for Claude Cowork ecosystem.
 * Creates domain-specific plugins from natural language descriptions.
 */

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import {
  CoworkPlugin,
  CoworkSkill,
  CoworkConnector,
  CoworkSlashCommand,
  CoworkSubAgent,
} from './types.js';

// ── Generator Input Schema ───────────────────────────────────────────────────

export const PluginGeneratorInputSchema = z.object({
  /** Plugin name */
  name: z.string(),
  /** Domain/purpose description */
  description: z.string(),
  /** Target domains */
  domains: z.array(z.string()),
  /** Detailed requirements */
  requirements: z.string().optional(),
  /** Skills to include */
  skills: z.array(z.object({
    name: z.string(),
    purpose: z.string(),
    triggers: z.array(z.string()).optional(),
  })).optional(),
  /** Connectors to include */
  connectors: z.array(z.object({
    name: z.string(),
    type: z.enum(['api', 'oauth', 'webhook', 'database', 'file']),
    service: z.string(),
  })).optional(),
  /** Sub-agents to include */
  agents: z.array(z.object({
    name: z.string(),
    role: z.string(),
    personality: z.string().optional(),
  })).optional(),
  /** Author information */
  author: z.object({
    name: z.string(),
    email: z.string().optional(),
  }).optional(),
});
export type PluginGeneratorInput = z.infer<typeof PluginGeneratorInputSchema>;

// ── Plugin Templates ─────────────────────────────────────────────────────────

const DOMAIN_TEMPLATES: Record<string, Partial<CoworkPlugin['components']>> = {
  sales: {
    skills: [
      {
        id: 'lead-qualification',
        name: 'Lead Qualification',
        description: 'Qualify leads based on BANT criteria',
        instructions: `Analyze the lead information and qualify using BANT framework:
- Budget: Can they afford the solution?
- Authority: Are they decision makers?
- Need: Do they have a genuine need?
- Timeline: Is there urgency?

Provide a qualification score (1-10) and recommended next steps.`,
        triggers: [{ pattern: 'qualify lead', type: 'keyword', priority: 0 }],
        capabilities: ['memory:read', 'memory:write'],
      },
      {
        id: 'deal-analysis',
        name: 'Deal Analysis',
        description: 'Analyze deal health and provide recommendations',
        instructions: `Review the deal data and provide:
1. Deal health score (1-100)
2. Risk factors
3. Opportunity accelerators
4. Recommended actions
5. Win probability estimate`,
        triggers: [{ pattern: 'analyze deal', type: 'keyword', priority: 0 }],
        capabilities: ['memory:read'],
      },
    ],
    commands: [
      { command: 'qualify', description: 'Qualify a new lead', arguments: [], skillId: 'lead-qualification' },
      { command: 'deal', description: 'Analyze deal health', arguments: [], skillId: 'deal-analysis' },
    ],
  },
  marketing: {
    skills: [
      {
        id: 'content-strategy',
        name: 'Content Strategy',
        description: 'Generate content strategy recommendations',
        instructions: `Create a content strategy based on:
- Target audience analysis
- Competitor content gaps
- Trending topics in the industry
- Content calendar recommendations
- Distribution channel strategy`,
        triggers: [{ pattern: 'content strategy', type: 'keyword', priority: 0 }],
        capabilities: ['memory:read', 'memory:write'],
      },
      {
        id: 'campaign-planner',
        name: 'Campaign Planner',
        description: 'Plan marketing campaigns end-to-end',
        instructions: `Design a comprehensive campaign plan including:
1. Campaign objectives (SMART goals)
2. Target audience segments
3. Key messages and value props
4. Channel mix and timing
5. Budget allocation
6. KPIs and measurement plan`,
        triggers: [{ pattern: 'plan campaign', type: 'keyword', priority: 0 }],
        capabilities: ['memory:read', 'memory:write'],
      },
    ],
    commands: [
      { command: 'content', description: 'Generate content strategy', arguments: [], skillId: 'content-strategy' },
      { command: 'campaign', description: 'Plan a campaign', arguments: [], skillId: 'campaign-planner' },
    ],
  },
  finance: {
    skills: [
      {
        id: 'expense-analyzer',
        name: 'Expense Analyzer',
        description: 'Analyze and categorize expenses',
        instructions: `Analyze expense data and provide:
1. Category breakdown
2. Month-over-month trends
3. Anomaly detection
4. Budget variance analysis
5. Cost optimization recommendations`,
        triggers: [{ pattern: 'analyze expenses', type: 'keyword', priority: 0 }],
        capabilities: ['file:read', 'memory:read'],
      },
      {
        id: 'financial-report',
        name: 'Financial Report Generator',
        description: 'Generate financial reports and summaries',
        instructions: `Generate a financial report including:
- Revenue summary
- Expense breakdown
- Profit/loss statement
- Cash flow overview
- Key financial metrics
- Trend analysis`,
        triggers: [{ pattern: 'financial report', type: 'keyword', priority: 0 }],
        capabilities: ['file:read', 'memory:read', 'file:write'],
      },
    ],
    commands: [
      { command: 'expenses', description: 'Analyze expenses', arguments: [], skillId: 'expense-analyzer' },
      { command: 'finance-report', description: 'Generate financial report', arguments: [], skillId: 'financial-report' },
    ],
  },
  development: {
    skills: [
      {
        id: 'code-review',
        name: 'Code Review',
        description: 'Perform thorough code reviews',
        instructions: `Review code for:
1. Security vulnerabilities (OWASP top 10)
2. Performance issues
3. Code style and consistency
4. Best practices adherence
5. Test coverage gaps
6. Documentation completeness

Provide actionable feedback with severity levels.`,
        triggers: [{ pattern: 'review code', type: 'keyword', priority: 0 }],
        capabilities: ['file:read'],
      },
      {
        id: 'architecture-advisor',
        name: 'Architecture Advisor',
        description: 'Provide architectural guidance and recommendations',
        instructions: `Analyze the codebase architecture and provide:
1. Current architecture assessment
2. Scalability considerations
3. Coupling/cohesion analysis
4. Technical debt identification
5. Improvement recommendations
6. Migration path if needed`,
        triggers: [{ pattern: 'architecture review', type: 'keyword', priority: 0 }],
        capabilities: ['file:read', 'memory:read'],
      },
    ],
    commands: [
      { command: 'review', description: 'Review code', arguments: [], skillId: 'code-review' },
      { command: 'arch', description: 'Architecture review', arguments: [], skillId: 'architecture-advisor' },
    ],
  },
  legal: {
    skills: [
      {
        id: 'contract-review',
        name: 'Contract Review',
        description: 'Review contracts for risks and issues',
        instructions: `Review the contract and identify:
1. Key terms and obligations
2. Risk clauses (liability, indemnification)
3. Unusual or missing provisions
4. Compliance requirements
5. Negotiation points
6. Recommended changes

Flag severity: Low/Medium/High/Critical`,
        triggers: [{ pattern: 'review contract', type: 'keyword', priority: 0 }],
        capabilities: ['file:read'],
      },
      {
        id: 'nda-triage',
        name: 'NDA Triage',
        description: 'Quick NDA review and risk assessment',
        instructions: `Quickly assess the NDA for:
1. Duration and survival terms
2. Definition of confidential information
3. Permitted disclosures
4. Return/destruction obligations
5. Non-solicitation provisions
6. Overall risk level`,
        triggers: [{ pattern: 'nda review', type: 'keyword', priority: 0 }],
        capabilities: ['file:read'],
      },
    ],
    commands: [
      { command: 'contract', description: 'Review a contract', arguments: [], skillId: 'contract-review' },
      { command: 'nda', description: 'Quick NDA review', arguments: [], skillId: 'nda-triage' },
    ],
  },
  support: {
    skills: [
      {
        id: 'ticket-triage',
        name: 'Ticket Triage',
        description: 'Categorize and prioritize support tickets',
        instructions: `Analyze the support ticket and:
1. Categorize the issue type
2. Assess priority (P1-P4)
3. Identify affected product area
4. Check for similar past tickets
5. Suggest initial response
6. Route to appropriate team`,
        triggers: [{ pattern: 'triage ticket', type: 'keyword', priority: 0 }],
        capabilities: ['memory:read', 'memory:write'],
      },
      {
        id: 'response-generator',
        name: 'Response Generator',
        description: 'Generate customer-friendly responses',
        instructions: `Generate a support response that:
1. Acknowledges the customer's issue
2. Provides clear explanation
3. Offers solution steps
4. Sets appropriate expectations
5. Maintains brand voice
6. Includes relevant links/resources`,
        triggers: [{ pattern: 'generate response', type: 'keyword', priority: 0 }],
        capabilities: ['memory:read'],
      },
    ],
    commands: [
      { command: 'triage', description: 'Triage a ticket', arguments: [], skillId: 'ticket-triage' },
      { command: 'respond', description: 'Generate response', arguments: [], skillId: 'response-generator' },
    ],
  },
};

// ── Plugin Generator ─────────────────────────────────────────────────────────

export class PluginGenerator {
  /**
   * Generate a Cowork plugin from natural language description
   */
  generate(input: PluginGeneratorInput): CoworkPlugin {
    const id = this.generatePluginId(input.name);

    // Get template components for matching domains
    const templateComponents = this.getTemplateComponents(input.domains);

    // Merge with custom skills/connectors/agents
    const skills = [
      ...templateComponents.skills,
      ...this.generateCustomSkills(input.skills || []),
    ];

    const connectors = [
      ...templateComponents.connectors,
      ...this.generateCustomConnectors(input.connectors || []),
    ];

    const agents = [
      ...templateComponents.agents,
      ...this.generateCustomAgents(input.agents || []),
    ];

    const commands = [
      ...templateComponents.commands,
      ...this.generateCommandsFromSkills(input.skills || []),
    ];

    // Build plugin manifest
    const plugin: CoworkPlugin = {
      manifestVersion: '1.0',
      metadata: {
        id,
        name: input.name,
        description: input.description,
        version: '1.0.0',
        author: {
          name: input.author?.name || 'ARI Plugin Generator',
          email: input.author?.email,
        },
        license: 'MIT',
        tags: ['ari-generated', ...input.domains],
        domains: input.domains,
      },
      components: {
        skills,
        connectors,
        commands,
        agents,
      },
      config: {
        requiredEnv: this.inferRequiredEnv(connectors),
        settings: {},
      },
      security: {
        minTrustLevel: 'standard',
        permissions: this.inferPermissions(skills),
        requiresNetwork: connectors.some(c => c.type === 'api' || c.type === 'oauth'),
        sandboxed: true,
      },
    };

    return plugin;
  }

  /**
   * Generate plugin and save to file
   */
  async generateAndSave(
    input: PluginGeneratorInput,
    outputDir: string
  ): Promise<{ plugin: CoworkPlugin; path: string }> {
    const plugin = this.generate(input);

    const resolvedDir = outputDir.startsWith('~')
      ? outputDir.replace('~', process.env.HOME || '')
      : outputDir;

    const pluginDir = path.join(resolvedDir, plugin.metadata.id);
    await fs.mkdir(pluginDir, { recursive: true });

    // Write plugin.json
    const pluginPath = path.join(pluginDir, 'plugin.json');
    await fs.writeFile(pluginPath, JSON.stringify(plugin, null, 2));

    // Write README
    const readmePath = path.join(pluginDir, 'README.md');
    await fs.writeFile(readmePath, this.generateReadme(plugin));

    return { plugin, path: pluginDir };
  }

  // ── Helper Methods ───────────────────────────────────────────────────────

  private generatePluginId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private getTemplateComponents(domains: string[]): {
    skills: CoworkSkill[];
    connectors: CoworkConnector[];
    commands: CoworkSlashCommand[];
    agents: CoworkSubAgent[];
  } {
    const result = {
      skills: [] as CoworkSkill[],
      connectors: [] as CoworkConnector[],
      commands: [] as CoworkSlashCommand[],
      agents: [] as CoworkSubAgent[],
    };

    for (const domain of domains) {
      const template = DOMAIN_TEMPLATES[domain.toLowerCase()];
      if (template) {
        if (template.skills) result.skills.push(...template.skills);
        if (template.connectors) result.connectors.push(...template.connectors);
        if (template.commands) result.commands.push(...template.commands);
        if (template.agents) result.agents.push(...template.agents);
      }
    }

    return result;
  }

  private generateCustomSkills(
    skills: NonNullable<PluginGeneratorInput['skills']>
  ): CoworkSkill[] {
    return skills.map(s => ({
      id: s.name.toLowerCase().replace(/\s+/g, '-'),
      name: s.name,
      description: s.purpose,
      instructions: `Execute the "${s.name}" skill:\n\n${s.purpose}`,
      triggers: (s.triggers || []).map(t => ({
        pattern: t,
        type: 'keyword' as const,
        priority: 0,
      })),
      capabilities: [],
    }));
  }

  private generateCustomConnectors(
    connectors: NonNullable<PluginGeneratorInput['connectors']>
  ): CoworkConnector[] {
    return connectors.map(c => ({
      id: c.name.toLowerCase().replace(/\s+/g, '-'),
      name: c.name,
      type: c.type,
      config: {
        settings: { service: c.service },
      },
      operations: [],
    }));
  }

  private generateCustomAgents(
    agents: NonNullable<PluginGeneratorInput['agents']>
  ): CoworkSubAgent[] {
    return agents.map(a => ({
      id: a.name.toLowerCase().replace(/\s+/g, '-'),
      name: a.name,
      role: a.role,
      systemPrompt: `You are ${a.name}, ${a.role}.${a.personality ? ` ${a.personality}` : ''}`,
      personality: {
        tone: 'professional' as const,
        verbosity: 'balanced' as const,
      },
      skills: [],
      connectors: [],
      delegation: { canDelegate: false, delegateTo: [] },
    }));
  }

  private generateCommandsFromSkills(
    skills: NonNullable<PluginGeneratorInput['skills']>
  ): CoworkSlashCommand[] {
    return skills.map(s => ({
      command: s.name.toLowerCase().replace(/\s+/g, '-'),
      description: s.purpose,
      arguments: [],
      skillId: s.name.toLowerCase().replace(/\s+/g, '-'),
    }));
  }

  private inferRequiredEnv(connectors: CoworkConnector[]): string[] {
    const envVars: string[] = [];
    for (const c of connectors) {
      if (c.type === 'api' || c.type === 'oauth') {
        const prefix = c.id.toUpperCase().replace(/-/g, '_');
        envVars.push(`${prefix}_API_KEY`);
      }
    }
    return envVars;
  }

  private inferPermissions(skills: CoworkSkill[]): ('read_files' | 'write_files' | 'execute_bash' | 'network_access' | 'memory_read' | 'memory_write' | 'session_access' | 'channel_send' | 'tool_execute' | 'governance_vote')[] {
    type ValidPerm = 'read_files' | 'write_files' | 'execute_bash' | 'network_access' | 'memory_read' | 'memory_write' | 'session_access' | 'channel_send' | 'tool_execute' | 'governance_vote';
    const perms = new Set<ValidPerm>();
    for (const skill of skills) {
      for (const cap of skill.capabilities) {
        // Map Cowork capabilities to ARI permissions
        if (cap.includes('file:read')) perms.add('read_files');
        if (cap.includes('file:write')) perms.add('write_files');
        if (cap.includes('memory')) perms.add('memory_read');
      }
    }
    return Array.from(perms);
  }

  private generateReadme(plugin: CoworkPlugin): string {
    return `# ${plugin.metadata.name}

${plugin.metadata.description}

## Installation

\`\`\`
/plugin install ${plugin.metadata.id}
\`\`\`

## Components

### Skills (${plugin.components.skills.length})
${plugin.components.skills.map(s => `- **${s.name}**: ${s.description}`).join('\n')}

### Commands (${plugin.components.commands.length})
${plugin.components.commands.map(c => `- \`/${c.command}\`: ${c.description}`).join('\n')}

### Connectors (${plugin.components.connectors.length})
${plugin.components.connectors.map(c => `- **${c.name}** (${c.type})`).join('\n') || 'None'}

### Agents (${plugin.components.agents.length})
${plugin.components.agents.map(a => `- **${a.name}**: ${a.role}`).join('\n') || 'None'}

## Configuration

${plugin.config.requiredEnv.length > 0 ? `### Required Environment Variables\n${plugin.config.requiredEnv.map(e => `- \`${e}\``).join('\n')}` : 'No configuration required.'}

## Generated by ARI

This plugin was generated by [ARI (Artificial Reasoning Intelligence)](https://github.com/PryceHedrick/ARI).

Version: ${plugin.metadata.version}
`;
  }
}

// ── Export Singleton ─────────────────────────────────────────────────────────

export const pluginGenerator = new PluginGenerator();
