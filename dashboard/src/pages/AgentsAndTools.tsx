import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAgents, getAgentStats, getTools } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { PageHeader } from '../components/ui/PageHeader';
import { TabGroup } from '../components/ui/TabGroup';
import { Card } from '../components/ui/Card';
import { MetricCard } from '../components/ui/MetricCard';
import { CollapsibleSection } from '../components/ui/CollapsibleSection';
import { DataTable } from '../components/ui/DataTable';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { AgentCardSkeleton, ToolCardSkeleton } from '../components/ui/Skeleton';

// Agent roles (from Agents.tsx)
const AGENT_ROLES = {
  CORE: {
    name: 'Core Orchestrator',
    role: 'Strategic reasoning',
    description: 'Master orchestrator - analyzes context, coordinates agents',
    trustLevel: 'Critical',
    permissions: ['orchestrate', 'coordinate', 'delegate'],
    icon: '◉',
    cssColor: 'var(--ari-purple)',
    cssBgColor: 'var(--ari-purple-muted)',
  },
  GUARDIAN: {
    name: 'Guardian',
    role: 'Safety enforcement',
    description: 'Checks invariants, can veto unsafe actions',
    trustLevel: 'Critical',
    permissions: ['read:proposal', 'veto:action', 'halt:execution'],
    icon: '⛨',
    cssColor: 'var(--ari-error)',
    cssBgColor: 'var(--ari-error-muted)',
  },
  PLANNER: {
    name: 'Planner',
    role: 'Task decomposition',
    description: 'Breaks down goals into executable DAG steps',
    trustLevel: 'Medium',
    permissions: ['read:context', 'propose:plan', 'create:dag'],
    icon: '◇',
    cssColor: 'var(--ari-info)',
    cssBgColor: 'var(--ari-info-muted)',
  },
  EXECUTOR: {
    name: 'Executor',
    role: 'Action execution',
    description: 'Executes approved plans using tools (with permission)',
    trustLevel: 'High',
    permissions: ['execute:tools', 'read:plan'],
    icon: '⚙',
    cssColor: 'var(--ari-success)',
    cssBgColor: 'var(--ari-success-muted)',
  },
  MEMORY: {
    name: 'Memory Manager',
    role: 'Context management',
    description: 'Provenance-tracked knowledge storage and retrieval',
    trustLevel: 'Medium',
    permissions: ['read:memory', 'write:memory', 'search:memory'],
    icon: '⬢',
    cssColor: 'var(--ari-cyan)',
    cssBgColor: 'var(--ari-cyan-muted)',
  },
};

// Advisor Pattern Flow
const ADVISOR_FLOW = [
  { icon: '⚡', label: 'Event', sub: 'message.received', cssColor: 'var(--ari-info)', cssBg: 'var(--ari-info-muted)' },
  { icon: '◇', label: 'Planner', sub: 'proposes action', cssColor: 'var(--ari-purple)', cssBg: 'var(--ari-purple-muted)' },
  { icon: '⛨', label: 'Guardian', sub: 'safety check', cssColor: 'var(--ari-error)', cssBg: 'var(--ari-error-muted)' },
  { icon: '👤', label: 'Operator', sub: 'approves/rejects', cssColor: 'var(--ari-warning)', cssBg: 'var(--ari-warning-muted)' },
  { icon: '⚙', label: 'Executor', sub: 'executes', cssColor: 'var(--ari-success)', cssBg: 'var(--ari-success-muted)' },
  { icon: '📋', label: 'Audit', sub: 'logged', cssColor: 'var(--ari-cyan)', cssBg: 'var(--ari-cyan-muted)' },
];

// Tool categories
const TOOL_CATEGORIES = {
  system: {
    name: 'System',
    icon: '◉',
    description: 'Core system operations',
    cssColor: 'var(--ari-purple)',
    cssBg: 'var(--ari-purple-muted)',
  },
  memory: {
    name: 'Memory',
    icon: '⬢',
    description: 'Knowledge storage and retrieval',
    cssColor: 'var(--ari-cyan)',
    cssBg: 'var(--ari-cyan-muted)',
  },
  audit: {
    name: 'Audit',
    icon: '⊞',
    description: 'Audit trail operations',
    cssColor: 'var(--ari-success)',
    cssBg: 'var(--ari-success-muted)',
  },
  governance: {
    name: 'Governance',
    icon: '⚖',
    description: 'Council and proposal management',
    cssColor: 'var(--ari-warning)',
    cssBg: 'var(--ari-warning-muted)',
  },
  agents: {
    name: 'Agents',
    icon: '⬡',
    description: 'Agent coordination tools',
    cssColor: 'var(--ari-info)',
    cssBg: 'var(--ari-info-muted)',
  },
};

// Permission tiers
const PERMISSION_TIERS = [
  { name: 'READ', desc: 'Read-only access', cssColor: 'var(--ari-success)', cssBg: 'var(--ari-success-muted)', risk: 'Low' },
  { name: 'WRITE', desc: 'Create and modify', cssColor: 'var(--ari-warning)', cssBg: 'var(--ari-warning-muted)', risk: 'Medium' },
  { name: 'EXECUTE', desc: 'Run operations', cssColor: 'var(--ari-error)', cssBg: 'var(--ari-error-muted)', risk: 'High' },
];

// Trust levels
const TRUST_LEVELS = [
  { name: 'SYSTEM', multiplier: '0.5x', cssColor: 'var(--ari-purple)', cssBg: 'var(--ari-purple-muted)' },
  { name: 'OPERATOR', multiplier: '0.6x', cssColor: 'var(--ari-info)', cssBg: 'var(--ari-info-muted)' },
  { name: 'VERIFIED', multiplier: '0.75x', cssColor: 'var(--ari-success)', cssBg: 'var(--ari-success-muted)' },
  { name: 'STANDARD', multiplier: '1.0x', cssColor: 'var(--text-tertiary)', cssBg: 'var(--bg-tertiary)' },
];

export default function AgentsAndTools() {
  const [activeTab, setActiveTab] = useState('agents');

  const { data: agents, isLoading: agentsLoading, isError: agentsError, refetch: refetchAgents } = useQuery({
    queryKey: ['agents'],
    queryFn: getAgents,
    refetchInterval: 10000,
  });

  const { data: tools, isLoading: toolsLoading, isError: toolsError, refetch: refetchTools } = useQuery({
    queryKey: ['tools'],
    queryFn: getTools,
    refetchInterval: 30000,
  });

  const safeAgents = Array.isArray(agents) ? agents : [];
  const safeTools = Array.isArray(tools) ? tools : [];

  const activeAgentCount = safeAgents.filter(a => a.status === 'active').length;
  const enabledToolCount = safeTools.filter(t => t.enabled).length;

  const tabs = [
    { id: 'agents', label: 'Agents', icon: '⬡', badge: <span className="ml-1 rounded-full bg-ari-purple-muted px-2 py-0.5 text-xs font-medium text-ari-purple">{Object.keys(AGENT_ROLES).length}</span> },
    { id: 'tools', label: 'Tools', icon: '⚙', badge: <span className="ml-1 rounded-full bg-ari-cyan-muted px-2 py-0.5 text-xs font-medium text-ari-cyan">{safeTools.length}</span> },
  ];

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="p-8">
        <PageHeader
          icon="⬡"
          title="Agents & Tools"
          subtitle="Multi-agent coordination with permission-gated tool execution"
          actions={
            <div className="flex items-center gap-3">
              <MetricCard label="Active Agents" value={agentsLoading ? '...' : activeAgentCount} color="success" size="sm" />
              <MetricCard label="Enabled Tools" value={toolsLoading ? '...' : enabledToolCount} color="purple" size="sm" />
            </div>
          }
        />

        <TabGroup tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="mt-6">
          {activeTab === 'agents' && (
            <AgentsTab
              agents={safeAgents}
              isLoading={agentsLoading}
              isError={agentsError}
              refetch={refetchAgents}
            />
          )}
          {activeTab === 'tools' && (
            <ToolsTab
              tools={safeTools}
              isLoading={toolsLoading}
              isError={toolsError}
              refetch={refetchTools}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Agents Tab Component
interface Agent {
  id: string;
  type: string;
  status: string;
  tasksCompleted: number;
  errorCount: number;
}

function AgentsTab({ agents, isLoading, isError, refetch }: { agents: Agent[]; isLoading: boolean; isError: boolean; refetch: () => void }) {
  return (
    <div className="space-y-6">
      {/* Agent Council Grid */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
          Agent Council
        </h2>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-children">
            {[1, 2, 3, 4, 5].map((i) => (
              <AgentCardSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Failed to load agents"
            message="Could not retrieve agent status. Please try again."
            onRetry={refetch}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-children">
            {Object.entries(AGENT_ROLES).map(([key, role]) => {
              const liveAgent = agents.find(a => a.type === key);
              const status = liveAgent?.status || 'active';

              return (
                <Card
                  key={key}
                  hoverable
                  padding="lg"
                  className="border"
                  style={{
                    background: role.cssBgColor,
                    borderColor: `color-mix(in srgb, ${role.cssColor} 30%, transparent)`,
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
                        style={{
                          background: `color-mix(in srgb, ${role.cssColor} 20%, transparent)`,
                          color: role.cssColor,
                        }}
                      >
                        {role.icon}
                      </div>
                      <div>
                        <div className="font-medium text-text-primary">
                          {role.name}
                        </div>
                        <div className="text-xs" style={{ color: role.cssColor }}>
                          {role.role}
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={status} size="sm" />
                  </div>

                  <p className="mt-4 text-sm text-text-tertiary">
                    {role.description}
                  </p>

                  <div className="mt-4 border-t border-border-muted pt-4">
                    <div className="mb-2 text-xs text-text-muted">
                      Permissions
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.map((perm) => (
                        <span
                          key={perm}
                          className="rounded bg-bg-tertiary px-2 py-0.5 font-mono text-[10px] text-text-tertiary"
                        >
                          {perm}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="text-text-muted">Trust Level</span>
                    <span
                      className="font-medium"
                      style={{
                        color: role.trustLevel === 'Critical'
                          ? 'var(--ari-error)'
                          : role.trustLevel === 'High'
                            ? 'var(--ari-warning)'
                            : 'var(--text-secondary)',
                      }}
                    >
                      {role.trustLevel}
                    </span>
                  </div>

                  {liveAgent && (
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border-muted pt-3 text-xs">
                      <div>
                        <span className="text-text-muted">Completed</span>
                        <div className="font-mono text-ari-success">
                          {liveAgent.tasksCompleted}
                        </div>
                      </div>
                      <div>
                        <span className="text-text-muted">Errors</span>
                        <div
                          className="font-mono"
                          style={{
                            color: liveAgent.errorCount > 0
                              ? 'var(--ari-error)'
                              : 'var(--text-muted)',
                          }}
                        >
                          {liveAgent.errorCount}
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Advisor Pattern Flow */}
      <CollapsibleSection
        title="Advisor Pattern Flow"
        summary="Event → Planner → Guardian → Operator → Executor → Audit"
        defaultCollapsed={true}
      >
        <div className="overflow-x-auto pt-4">
          <div className="flex items-center justify-between gap-2 min-w-[700px] py-4">
            {ADVISOR_FLOW.map((step, i, arr) => (
              <div key={step.label} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full text-xl"
                    style={{
                      background: step.cssBg,
                      color: step.cssColor,
                    }}
                  >
                    {step.icon}
                  </div>
                  <div className="mt-2 text-xs text-text-primary">
                    {step.label}
                  </div>
                  <div className="text-[10px] text-text-muted">
                    {step.sub}
                  </div>
                </div>
                {i < arr.length - 1 && (
                  <div
                    className="mx-2 h-px w-8"
                    style={{
                      background: 'linear-gradient(to right, var(--border-muted), var(--border-subtle))',
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </CollapsibleSection>

      {/* Live Agent Stats */}
      {agents.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
            Live Agent Statistics
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-children">
            {agents.map((agent) => (
              <AgentStatsCard key={agent.id} agentId={agent.id} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// Tools Tab Component
interface Tool {
  id: string;
  name: string;
  description: string;
  category?: string;
  enabled: boolean;
  trustLevel: string;
  permissionTier: string;
  executionCount: number;
  errorCount: number;
  lastUsed?: string;
}

function ToolsTab({ tools, isLoading, isError, refetch }: { tools: Tool[]; isLoading: boolean; isError: boolean; refetch: () => void }) {
  const groupedTools = tools.reduce(
    (acc, tool) => {
      const category = tool.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(tool);
      return acc;
    },
    {} as Record<string, Tool[]>,
  );

  // Tool registry table columns
  const columns = [
    {
      key: 'name',
      header: 'Tool Name',
      render: (tool: Tool) => (
        <div>
          <div className="font-medium text-text-primary">{tool.name}</div>
          <div className="text-xs text-text-muted">{tool.category || 'Uncategorized'}</div>
        </div>
      ),
      sortable: true,
    },
    {
      key: 'description',
      header: 'Description',
      render: (tool: Tool) => (
        <div className="text-sm text-text-tertiary max-w-xs truncate">{tool.description}</div>
      ),
    },
    {
      key: 'trustLevel',
      header: 'Trust',
      render: (tool: Tool) => {
        const trustStyle = {
          SYSTEM: { cssColor: 'var(--ari-purple)', cssBg: 'var(--ari-purple-muted)' },
          OPERATOR: { cssColor: 'var(--ari-info)', cssBg: 'var(--ari-info-muted)' },
          VERIFIED: { cssColor: 'var(--ari-success)', cssBg: 'var(--ari-success-muted)' },
          STANDARD: { cssColor: 'var(--text-tertiary)', cssBg: 'var(--bg-tertiary)' },
        }[tool.trustLevel] || { cssColor: 'var(--text-tertiary)', cssBg: 'var(--bg-tertiary)' };

        return (
          <span
            className="rounded-lg px-2 py-1 text-xs font-medium"
            style={{ background: trustStyle.cssBg, color: trustStyle.cssColor }}
          >
            {tool.trustLevel}
          </span>
        );
      },
      align: 'center' as const,
      sortable: true,
    },
    {
      key: 'permissionTier',
      header: 'Permission',
      render: (tool: Tool) => {
        const permStyle = {
          READ: { cssColor: 'var(--ari-success)', cssBg: 'var(--ari-success-muted)' },
          WRITE: { cssColor: 'var(--ari-warning)', cssBg: 'var(--ari-warning-muted)' },
          EXECUTE: { cssColor: 'var(--ari-error)', cssBg: 'var(--ari-error-muted)' },
        }[tool.permissionTier] || { cssColor: 'var(--text-tertiary)', cssBg: 'var(--bg-tertiary)' };

        return (
          <span
            className="rounded-lg px-2 py-1 text-xs font-medium"
            style={{ background: permStyle.cssBg, color: permStyle.cssColor }}
          >
            {tool.permissionTier}
          </span>
        );
      },
      align: 'center' as const,
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      render: (tool: Tool) => (
        <span
          className="rounded-lg px-2 py-1 text-xs font-medium"
          style={{
            background: tool.enabled ? 'var(--ari-success-muted)' : 'var(--bg-tertiary)',
            color: tool.enabled ? 'var(--ari-success)' : 'var(--text-muted)',
          }}
        >
          {tool.enabled ? 'ENABLED' : 'DISABLED'}
        </span>
      ),
      align: 'center' as const,
      sortable: true,
    },
    {
      key: 'executions',
      header: 'Executions',
      render: (tool: Tool) => (
        <div className="text-center">
          <div className="font-mono text-ari-success">{tool.executionCount || 0}</div>
          <div className="text-[10px] text-text-muted">runs</div>
        </div>
      ),
      align: 'center' as const,
      sortable: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Tool Registry Table */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
          Tool Registry
        </h2>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <ToolCardSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Failed to load tools"
            message="Could not retrieve tool registry. Please try again."
            onRetry={refetch}
          />
        ) : tools.length === 0 ? (
          <EmptyState
            title="No tools registered"
            message="No tools are currently registered in the system"
            icon="⚙"
          />
        ) : (
          <DataTable
            columns={columns}
            data={tools}
            getRowKey={(tool) => tool.id}
            emptyMessage="No tools registered"
          />
        )}
      </section>

      {/* Permission Tiers */}
      <CollapsibleSection
        title="Permission Tiers"
        summary="READ • WRITE • EXECUTE"
        defaultCollapsed={false}
      >
        <div className="grid gap-4 md:grid-cols-3 pt-4">
          {PERMISSION_TIERS.map((tier) => (
            <div
              key={tier.name}
              className="rounded-xl p-4 border"
              style={{
                background: tier.cssBg,
                borderColor: `color-mix(in srgb, ${tier.cssColor} 30%, transparent)`,
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold" style={{ color: tier.cssColor }}>
                    {tier.name}
                  </div>
                  <div className="text-sm text-text-muted">
                    {tier.desc}
                  </div>
                </div>
                <div
                  className="rounded-xl px-3 py-1"
                  style={{
                    background: `color-mix(in srgb, ${tier.cssColor} 20%, transparent)`,
                  }}
                >
                  <span className="text-xs font-medium" style={{ color: tier.cssColor }}>
                    {tier.risk} Risk
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Trust Level Requirements */}
      <CollapsibleSection
        title="Trust Level Requirements"
        summary="Risk multipliers for tool execution"
        defaultCollapsed={false}
      >
        <div className="grid gap-4 md:grid-cols-4 pt-4">
          {TRUST_LEVELS.map((level) => (
            <div key={level.name} className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold"
                style={{
                  background: level.cssBg,
                  color: level.cssColor,
                }}
              >
                {level.multiplier}
              </div>
              <div>
                <div className="text-sm font-medium text-text-primary">
                  {level.name}
                </div>
                <div className="text-xs text-text-muted">
                  Risk multiplier
                </div>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}

// Agent Stats Card Component
function AgentStatsCard({ agentId }: { agentId: string }) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['agents', agentId, 'stats'],
    queryFn: () => getAgentStats(agentId),
    refetchInterval: 15000,
  });

  if (isLoading || !stats) {
    return <AgentCardSkeleton />;
  }

  const tasksCompleted = stats.tasksCompleted ?? 0;
  const tasksFailed = stats.tasksFailed ?? 0;
  const tasksInProgress = stats.tasksInProgress ?? 0;
  const successRate = tasksCompleted + tasksFailed > 0
    ? ((tasksCompleted / (tasksCompleted + tasksFailed)) * 100).toFixed(1)
    : '100';

  return (
    <Card hoverable padding="md" className="border border-border-muted">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-medium text-text-primary">
            {stats.type}
          </div>
          <div className="font-mono text-[10px] text-text-muted">
            {stats.agentId.slice(0, 12)}...
          </div>
        </div>
        <StatusBadge
          status={tasksInProgress > 0 ? 'active' : 'idle'}
          size="sm"
        />
      </div>

      <div className="mb-3">
        <div className="mb-1 flex justify-between text-xs">
          <span className="text-text-muted">Success Rate</span>
          <span className="font-mono text-ari-success">
            {successRate}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-bg-tertiary">
          <div
            className="h-full transition-all duration-500 bg-ari-success"
            style={{ width: `${successRate}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <div className="font-mono text-ari-success">
            {tasksCompleted}
          </div>
          <div className="text-text-disabled">Done</div>
        </div>
        <div>
          <div className="font-mono text-ari-warning">
            {tasksInProgress}
          </div>
          <div className="text-text-disabled">Active</div>
        </div>
        <div>
          <div className="font-mono text-ari-error">
            {tasksFailed}
          </div>
          <div className="text-text-disabled">Failed</div>
        </div>
      </div>
    </Card>
  );
}
