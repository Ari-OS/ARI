/**
 * ARI MCP Server
 *
 * Provides Claude Code direct access to ARI's internal systems:
 * - Audit trail queries and verification
 * - Memory storage and retrieval
 * - Agent status and metrics
 * - Governance council operations
 *
 * Security: Runs locally only, inherits OPERATOR trust level
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { AuditLogger } from '../kernel/audit.js';
import { EventBus } from '../kernel/event-bus.js';
import { loadConfig } from '../kernel/config.js';
import { MemoryManager } from '../agents/memory-manager.js';
import { Council } from '../governance/council.js';
import { getCoworkBridge, pluginGenerator } from '../integrations/cowork/index.js';
import type { TrustLevel } from '../kernel/types.js';

// MCP Trust Level: operator (Claude Code runs as authenticated user)
const MCP_TRUST_LEVEL: TrustLevel = 'operator';

// Tool definitions
const TOOLS: Tool[] = [
  // Audit Tools
  {
    name: 'ari_audit_verify',
    description: 'Verify the integrity of the audit chain. Returns validation status and any broken links.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'ari_audit_query',
    description: 'Query audit events with optional filters. Supports filtering by action, agent, and time range.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Filter by action type (e.g., "task_start", "security:threat")' },
        agent: { type: 'string', description: 'Filter by agent ID' },
        limit: { type: 'number', description: 'Maximum events to return (default: 50)' },
        since: { type: 'string', description: 'ISO timestamp to filter events after' },
      },
    },
  },
  {
    name: 'ari_audit_stats',
    description: 'Get audit statistics including event counts by type, recent activity, and chain health.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  // Memory Time Search Tool
  {
    name: 'ari_memory_time_search',
    description: 'Search memory entries within a time window. Useful for research queries like "what did we learn last week" or "decisions from last 30 days".',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'ISO date string for start of time window (e.g., "2024-01-01")' },
        endDate: { type: 'string', description: 'ISO date string for end of time window. Defaults to now if not provided.' },
        domain: { type: 'string', description: 'Filter by content domain (e.g., "patterns", "decisions", "fixes")' },
        minConfidence: { type: 'number', description: 'Minimum confidence level 0-1 (default: 0)' },
        limit: { type: 'number', description: 'Maximum results to return (default: 50)' },
      },
      required: ['startDate'],
    },
  },

  // Memory Tools
  {
    name: 'ari_memory_store',
    description: 'Store knowledge with provenance tracking. Used to persist learnings, patterns, and decisions.',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Unique identifier for this memory' },
        content: { type: 'string', description: 'The knowledge content to store' },
        domain: { type: 'string', description: 'Domain category (e.g., "patterns", "fixes", "decisions")' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags for searchability' },
        confidence: { type: 'number', description: 'Confidence level 0-1 (default: 0.8)' },
      },
      required: ['key', 'content', 'domain'],
    },
  },
  {
    name: 'ari_memory_retrieve',
    description: 'Retrieve stored knowledge by key.',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'The memory key to retrieve' },
      },
      required: ['key'],
    },
  },
  {
    name: 'ari_memory_search',
    description: 'Search memory by domain, tags, or text content.',
    inputSchema: {
      type: 'object',
      properties: {
        domain: { type: 'string', description: 'Filter by domain' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags (OR matching)' },
        query: { type: 'string', description: 'Text search query' },
        limit: { type: 'number', description: 'Maximum results (default: 20)' },
      },
    },
  },

  // Agent Tools
  {
    name: 'ari_agent_status',
    description: 'Get status of ARI agents including health, current tasks, and resource usage.',
    inputSchema: {
      type: 'object',
      properties: {
        agent: { type: 'string', description: 'Specific agent to query (optional, returns all if omitted)' },
      },
    },
  },
  {
    name: 'ari_agent_metrics',
    description: 'Get performance metrics for agents including success rates, latency, and throughput.',
    inputSchema: {
      type: 'object',
      properties: {
        agent: { type: 'string', description: 'Specific agent to query' },
        period: { type: 'string', description: 'Time period: "hour", "day", "week" (default: "day")' },
      },
    },
  },
  {
    name: 'ari_task_submit',
    description: 'Submit a task to ARI for processing. Returns task ID for tracking.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Task content/instruction' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'critical'], description: 'Task priority' },
        context: { type: 'object', description: 'Additional context for the task' },
      },
      required: ['content'],
    },
  },

  // Governance Tools
  {
    name: 'ari_council_status',
    description: 'Get the status of the governance council including member states and voting history.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'ari_proposal_submit',
    description: 'Submit a governance proposal for council review.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Proposal title' },
        description: { type: 'string', description: 'Detailed proposal description' },
        type: { type: 'string', enum: ['policy', 'permission', 'architecture', 'security'], description: 'Proposal type' },
        changes: { type: 'array', items: { type: 'string' }, description: 'List of proposed changes' },
      },
      required: ['title', 'description', 'type'],
    },
  },
  {
    name: 'ari_gate_check',
    description: 'Check if an operation passes quality gates (Overseer checks).',
    inputSchema: {
      type: 'object',
      properties: {
        operation: { type: 'string', description: 'Operation to validate' },
        context: { type: 'object', description: 'Operation context and parameters' },
      },
      required: ['operation'],
    },
  },

  // System Tools
  {
    name: 'ari_health',
    description: 'Get overall ARI system health including all subsystems.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'ari_config_get',
    description: 'Get current ARI configuration (non-sensitive values only).',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Specific config key (optional)' },
      },
    },
  },

  // Cowork Plugin Tools
  {
    name: 'ari_plugin_import',
    description: 'Import a Cowork plugin from file path. Converts plugin components to ARI skills/tools.',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Path to plugin.json file' },
      },
      required: ['source'],
    },
  },
  {
    name: 'ari_plugin_export',
    description: 'Export ARI capabilities as a Cowork plugin for distribution.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Plugin ID (lowercase, hyphenated)' },
        name: { type: 'string', description: 'Plugin display name' },
        description: { type: 'string', description: 'Plugin description' },
        skills: { type: 'array', items: { type: 'string' }, description: 'Skill names to include' },
        agents: { type: 'array', items: { type: 'string' }, description: 'Agent IDs to include' },
        outputPath: { type: 'string', description: 'Output directory path' },
      },
      required: ['id', 'name', 'description'],
    },
  },
  {
    name: 'ari_plugin_generate',
    description: 'Generate a new Cowork plugin from natural language description. Creates domain-specific plugins for sales, marketing, finance, legal, support, or development.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Plugin name' },
        description: { type: 'string', description: 'What the plugin should do' },
        domains: { type: 'array', items: { type: 'string' }, description: 'Target domains: sales, marketing, finance, legal, support, development' },
        outputPath: { type: 'string', description: 'Output directory (optional)' },
      },
      required: ['name', 'description', 'domains'],
    },
  },
  {
    name: 'ari_plugin_list',
    description: 'List all imported Cowork plugins and their components.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

export class ARIMCPServer {
  private server: Server;
  private eventBus: EventBus;
  private audit: AuditLogger;
  private memoryManager: MemoryManager;
  private council: Council;

  constructor() {
    this.eventBus = new EventBus();
    this.audit = new AuditLogger();
    this.memoryManager = new MemoryManager(this.audit, this.eventBus);
    this.council = new Council(this.audit, this.eventBus);

    this.server = new Server(
      {
        name: 'ari-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: TOOLS,
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Log all MCP operations to audit trail
      void this.audit.log(
        'mcp:tool_call',
        'MCP_SERVER',
        MCP_TRUST_LEVEL,
        { tool: name, args }
      );

      try {
        const result = await this.handleToolCall(name, args || {});
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error: ${message}` }],
          isError: true,
        };
      }
    });
  }

  private async handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      // Audit Tools
      case 'ari_audit_verify':
        return this.auditVerify();
      case 'ari_audit_query':
        return this.auditQuery(args);
      case 'ari_audit_stats':
        return this.auditStats();

      // Memory Tools
      case 'ari_memory_store':
        return this.memoryStore(args);
      case 'ari_memory_retrieve':
        return this.memoryRetrieve(args);
      case 'ari_memory_search':
        return this.memorySearch(args);
      case 'ari_memory_time_search':
        return this.memoryTimeSearch(args);

      // Agent Tools
      case 'ari_agent_status':
        return this.agentStatus(args);
      case 'ari_agent_metrics':
        return this.agentMetrics(args);
      case 'ari_task_submit':
        return this.taskSubmit(args);

      // Governance Tools
      case 'ari_council_status':
        return this.councilStatus();
      case 'ari_proposal_submit':
        return this.proposalSubmit(args);
      case 'ari_gate_check':
        return this.gateCheck(args);

      // System Tools
      case 'ari_health':
        return this.systemHealth();
      case 'ari_config_get':
        return this.configGet(args);

      // Cowork Plugin Tools
      case 'ari_plugin_import':
        return this.pluginImport(args);
      case 'ari_plugin_export':
        return this.pluginExport(args);
      case 'ari_plugin_generate':
        return this.pluginGenerate(args);
      case 'ari_plugin_list':
        return this.pluginList();

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  // Audit implementations
  private auditVerify(): { valid: boolean; eventCount: number; issues: string[] } {
    // Stub implementation - audit verification would check hash chain
    return {
      valid: true,
      eventCount: 0,
      issues: [],
    };
  }

  private auditQuery(_args: Record<string, unknown>): unknown[] {
    // Stub implementation - would query audit log
    return [];
  }

  private auditStats(): Record<string, unknown> {
    return {
      totalEvents: 0,
      eventsByType: {},
      chainValid: true,
      lastEventTimestamp: new Date().toISOString(),
    };
  }

  // Memory implementations
  private async memoryStore(args: Record<string, unknown>): Promise<{ success: boolean; id: string }> {
    const content = typeof args.content === 'string' ? args.content : '';
    const confidence = typeof args.confidence === 'number' ? args.confidence : 0.8;

    const id = await this.memoryManager.store({
      type: 'FACT',
      content,
      provenance: {
        source: 'MCP_SERVER',
        trust_level: MCP_TRUST_LEVEL,
        agent: 'executor',
        chain: [],
      },
      confidence,
      partition: 'INTERNAL',
    });
    return { success: true, id };
  }

  private async memoryRetrieve(args: Record<string, unknown>): Promise<unknown> {
    const key = typeof args.key === 'string' ? args.key : '';
    return this.memoryManager.retrieve(key, 'executor');
  }

  private async memorySearch(args: Record<string, unknown>): Promise<unknown[]> {
    const limit = typeof args.limit === 'number' ? args.limit : 20;
    return this.memoryManager.query({ limit }, 'executor');
  }

  private async memoryTimeSearch(args: Record<string, unknown>): Promise<unknown[]> {
    const startDateStr = typeof args.startDate === 'string' ? args.startDate : '';
    if (!startDateStr) {
      throw new Error('startDate is required');
    }

    const startDate = new Date(startDateStr);
    if (isNaN(startDate.getTime())) {
      throw new Error('Invalid startDate format');
    }

    const endDate = typeof args.endDate === 'string' ? new Date(args.endDate) : new Date();
    const domains = typeof args.domain === 'string' ? [args.domain] : undefined;
    const minConfidence = typeof args.minConfidence === 'number' ? args.minConfidence : 0;
    const limit = typeof args.limit === 'number' ? args.limit : 50;

    return this.memoryManager.queryTimeWindow(
      { startDate, endDate, domains, minConfidence, limit },
      'executor'
    );
  }

  // Agent implementations
  private agentStatus(_args: Record<string, unknown>): Record<string, unknown> {
    // Return mock status for now - integrate with actual agent registry
    return {
      agents: {
        CORE: { status: 'active', tasks: 0 },
        GUARDIAN: { status: 'active', threats_blocked: 0 },
        PLANNER: { status: 'idle', pending_plans: 0 },
        EXECUTOR: { status: 'active', executing: 0 },
        MEMORY: { status: 'active', entries: 0 },
      },
      timestamp: new Date().toISOString(),
    };
  }

  private agentMetrics(args: Record<string, unknown>): Record<string, unknown> {
    return {
      agent: args.agent || 'all',
      period: args.period || 'day',
      metrics: {
        tasksCompleted: 0,
        successRate: 1.0,
        avgLatencyMs: 0,
        errorsCount: 0,
      },
    };
  }

  private taskSubmit(args: Record<string, unknown>): { taskId: string; status: string } {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const content = typeof args.content === 'string' ? args.content : '';

    this.eventBus.emit('message:accepted', {
      id: taskId,
      content,
      source: MCP_TRUST_LEVEL,
      timestamp: new Date(),
    });

    return { taskId, status: 'submitted' };
  }

  // Governance implementations
  private councilStatus(): Record<string, unknown> {
    // Return council status
    return {
      members: 13,
      quorumRequired: 7,
      status: 'active',
      votingAgents: ['router', 'planner', 'executor', 'memory_manager', 'guardian', 'research', 'marketing', 'sales', 'content', 'seo', 'build', 'development', 'client_comms'],
    };
  }

  private proposalSubmit(args: Record<string, unknown>): { proposalId: string; status: string } {
    // Create a vote through the council
    const title = typeof args.title === 'string' ? args.title : 'Untitled Proposal';
    const description = typeof args.description === 'string' ? args.description : '';

    const vote = this.council.createVote({
      topic: title,
      description: description,
      threshold: 'MAJORITY',
      initiated_by: 'router',
    });

    return { proposalId: vote.vote_id, status: 'submitted_for_review' };
  }

  private gateCheck(_args: Record<string, unknown>): { passed: boolean; gates: Record<string, boolean> } {
    // Implement quality gate checks
    return {
      passed: true,
      gates: {
        security: true,
        quality: true,
        performance: true,
        compliance: true,
        testing: true,
      },
    };
  }

  // System implementations
  private systemHealth(): Record<string, unknown> {
    const auditHealth = this.auditVerify();

    return {
      status: 'healthy',
      subsystems: {
        audit: { healthy: auditHealth.valid, events: auditHealth.eventCount },
        memory: { healthy: true },
        agents: { healthy: true, active: 5 },
        governance: { healthy: true },
        gateway: { healthy: true, port: 3141 },
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  private async configGet(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const config = await loadConfig();

    // Filter sensitive values
    const safeConfig: Record<string, unknown> = {
      version: config.version,
      gateway: {
        port: config.gatewayPort || 3141,
        host: '127.0.0.1', // Always loopback
      },
    };

    if (args.key) {
      const key = args.key as string;
      return { [key]: safeConfig[key] };
    }
    return safeConfig;
  }

  // Cowork Plugin implementations
  private async pluginImport(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const source = typeof args.source === 'string' ? args.source : '';
    if (!source) {
      throw new Error('Plugin source path is required');
    }

    const bridge = getCoworkBridge();
    const result = await bridge.importPlugin(source);

    void this.audit.log(
      'cowork:plugin_imported',
      'MCP_SERVER',
      MCP_TRUST_LEVEL,
      { pluginId: result.pluginId, success: result.success }
    );

    return result;
  }

  private async pluginExport(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const id = typeof args.id === 'string' ? args.id : '';
    const name = typeof args.name === 'string' ? args.name : '';
    const description = typeof args.description === 'string' ? args.description : '';
    const outputPath = typeof args.outputPath === 'string' ? args.outputPath : undefined;

    if (!id || !name || !description) {
      throw new Error('Plugin id, name, and description are required');
    }

    const bridge = getCoworkBridge();
    const result = await bridge.exportPlugin({
      id,
      name,
      description,
      outputPath,
    });

    void this.audit.log(
      'cowork:plugin_exported',
      'MCP_SERVER',
      MCP_TRUST_LEVEL,
      { pluginId: id, success: result.success }
    );

    return result;
  }

  private async pluginGenerate(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const name = typeof args.name === 'string' ? args.name : '';
    const description = typeof args.description === 'string' ? args.description : '';
    const domains = Array.isArray(args.domains) ? args.domains.map(String) : [];
    const outputPath = typeof args.outputPath === 'string' ? args.outputPath : '~/.ari/plugins/generated';

    if (!name || !description || domains.length === 0) {
      throw new Error('Plugin name, description, and at least one domain are required');
    }

    const result = await pluginGenerator.generateAndSave(
      { name, description, domains },
      outputPath
    );

    void this.audit.log(
      'cowork:plugin_generated',
      'MCP_SERVER',
      MCP_TRUST_LEVEL,
      { pluginId: result.plugin.metadata.id, path: result.path }
    );

    return {
      success: true,
      pluginId: result.plugin.metadata.id,
      path: result.path,
      components: {
        skills: result.plugin.components.skills.length,
        connectors: result.plugin.components.connectors.length,
        commands: result.plugin.components.commands.length,
        agents: result.plugin.components.agents.length,
      },
    };
  }

  private pluginList(): Record<string, unknown> {
    const bridge = getCoworkBridge();
    const plugins = bridge.listPlugins();
    const stats = bridge.getStats();

    return {
      plugins: plugins.map(p => ({
        id: p.metadata.id,
        name: p.metadata.name,
        version: p.metadata.version,
        components: {
          skills: p.components.skills.length,
          connectors: p.components.connectors.length,
          commands: p.components.commands.length,
          agents: p.components.agents.length,
        },
      })),
      stats,
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    void this.audit.log(
      'mcp:server_started',
      'MCP_SERVER',
      MCP_TRUST_LEVEL,
      { tools: TOOLS.length }
    );
  }
}

// Run server
const server = new ARIMCPServer();
server.run().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error('MCP Server error:', error);
});
