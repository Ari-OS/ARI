import { useQuery } from '@tanstack/react-query';
import { getTools } from '../api/client';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { ToolCardSkeleton } from '../components/ui/Skeleton';

// Tool categories with icons and colors
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

// Permission tier definitions
const PERMISSION_TIERS = [
  { name: 'READ', desc: 'Read-only access', cssColor: 'var(--ari-success)', cssBg: 'var(--ari-success-muted)', risk: 'Low' },
  { name: 'WRITE', desc: 'Create and modify', cssColor: 'var(--ari-warning)', cssBg: 'var(--ari-warning-muted)', risk: 'Medium' },
  { name: 'EXECUTE', desc: 'Run operations', cssColor: 'var(--ari-error)', cssBg: 'var(--ari-error-muted)', risk: 'High' },
];

// Trust level requirements
const TRUST_LEVELS = [
  { name: 'SYSTEM', multiplier: '0.5x', cssColor: 'var(--ari-purple)', cssBg: 'var(--ari-purple-muted)' },
  { name: 'OPERATOR', multiplier: '0.6x', cssColor: 'var(--ari-info)', cssBg: 'var(--ari-info-muted)' },
  { name: 'VERIFIED', multiplier: '0.75x', cssColor: 'var(--ari-success)', cssBg: 'var(--ari-success-muted)' },
  { name: 'STANDARD', multiplier: '1.0x', cssColor: 'var(--text-tertiary)', cssBg: 'var(--bg-tertiary)' },
];

// Permission check flow
const PERMISSION_CHECKS = [
  { layer: '1', name: 'Agent Allowlist', desc: "Tool in agent's allowed set", icon: '⬡', cssColor: 'var(--ari-info)', cssBg: 'var(--ari-info-muted)' },
  { layer: '2', name: 'Trust Level', desc: 'Caller meets minimum trust', icon: '⛨', cssColor: 'var(--ari-purple)', cssBg: 'var(--ari-purple-muted)' },
  { layer: '3', name: 'Permission Tier', desc: 'Action allowed for tier', icon: '⚙', cssColor: 'var(--ari-success)', cssBg: 'var(--ari-success-muted)' },
];

export function Tools() {
  const { data: tools, isLoading, isError, refetch } = useQuery({
    queryKey: ['tools'],
    queryFn: getTools,
    refetchInterval: 30000,
  });

  const safeTools = Array.isArray(tools) ? tools : [];

  const groupedTools = safeTools.reduce(
    (acc, tool) => {
      const category = tool.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(tool);
      return acc;
    },
    {} as Record<string, typeof safeTools>,
  );

  // Calculate stats
  const enabledCount = safeTools.filter(t => t.enabled).length;
  const totalExecutions = safeTools.reduce((sum, t) => sum + (t.executionCount || 0), 0);
  const totalErrors = safeTools.reduce((sum, t) => sum + (t.errorCount || 0), 0);
  const successRate = totalExecutions > 0
    ? (((totalExecutions - totalErrors) / totalExecutions) * 100).toFixed(1)
    : '100';

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header
        className="px-8 py-6 backdrop-blur-sm"
        style={{
          background: 'var(--bg-glass)',
          borderBottom: '1px solid var(--border-muted)',
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Tool Registry
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              Permission-gated tool execution • Three-layer permission checks
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div
              className="rounded-xl px-4 py-2"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Registered</div>
              <div className="text-lg font-bold" style={{ color: 'var(--ari-purple)' }}>
                {isLoading ? '...' : safeTools.length}
              </div>
            </div>
            <div
              className="rounded-xl px-4 py-2"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Enabled</div>
              <div className="text-lg font-bold" style={{ color: 'var(--ari-success)' }}>
                {isLoading ? '...' : enabledCount}
              </div>
            </div>
            <div
              className="rounded-xl px-4 py-2"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Success Rate</div>
              <div className="text-lg font-bold" style={{ color: 'var(--ari-cyan)' }}>
                {isLoading ? '...' : `${successRate}%`}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-8">
        {/* Permission Tiers */}
        <div className="mb-8">
          <h2
            className="mb-4 text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Permission Tiers
          </h2>
          <div className="grid gap-4 md:grid-cols-3 stagger-children">
            {PERMISSION_TIERS.map((tier) => (
              <div
                key={tier.name}
                className="card-ari rounded-xl p-4"
                style={{
                  background: tier.cssBg,
                  border: `1px solid color-mix(in srgb, ${tier.cssColor} 30%, transparent)`,
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold" style={{ color: tier.cssColor }}>
                      {tier.name}
                    </div>
                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
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
        </div>

        {/* Trust Levels */}
        <div
          className="card-ari mb-8 rounded-xl p-6"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-muted)',
          }}
        >
          <h2
            className="mb-4 text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Trust Level Requirements
          </h2>
          <div className="grid gap-4 md:grid-cols-4">
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
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {level.name}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Risk multiplier
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Overview */}
        <div className="mb-8">
          <h2
            className="mb-4 text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Tool Categories
          </h2>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5 stagger-children">
            {Object.entries(TOOL_CATEGORIES).map(([key, cat]) => {
              const categoryTools = groupedTools[cat.name] || [];
              const catEnabled = categoryTools.filter((t: { enabled: boolean }) => t.enabled).length;

              return (
                <div
                  key={key}
                  className="card-ari card-ari-hover rounded-xl p-4"
                  style={{
                    background: cat.cssBg,
                    border: `1px solid color-mix(in srgb, ${cat.cssColor} 30%, transparent)`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
                      style={{
                        background: 'var(--bg-card)',
                        color: cat.cssColor,
                      }}
                    >
                      {cat.icon}
                    </div>
                    <div>
                      <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {cat.name}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {catEnabled}/{categoryTools.length} enabled
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tools List */}
        {isLoading ? (
          <div className="space-y-8">
            <section>
              <div
                className="mb-4 h-7 w-32 animate-pulse rounded-lg"
                style={{ background: 'var(--bg-tertiary)' }}
              />
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <ToolCardSkeleton key={i} />
                ))}
              </div>
            </section>
          </div>
        ) : isError ? (
          <ErrorState
            title="Failed to load tools"
            message="Could not retrieve tool registry. Please try again."
            onRetry={() => refetch()}
          />
        ) : safeTools.length === 0 ? (
          <EmptyState
            title="No tools registered"
            message="No tools are currently registered in the system"
            icon="⚙"
          />
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedTools).map(([category, categoryTools]) => {
              const catConfig = Object.values(TOOL_CATEGORIES).find(c => c.name === category) ||
                { icon: '◎', cssColor: 'var(--text-tertiary)', cssBg: 'var(--bg-tertiary)' };

              return (
                <section key={category}>
                  <div className="mb-4 flex items-center gap-3">
                    <span className="text-xl" style={{ color: catConfig.cssColor }}>
                      {catConfig.icon}
                    </span>
                    <h2 className="text-xl font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
                      {category}
                    </h2>
                    <span
                      className="rounded-full px-2 py-0.5 text-xs"
                      style={{
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      {categoryTools.length} tools
                    </span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-children">
                    {categoryTools.map((tool) => (
                      <ToolCard key={tool.id} tool={tool} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* Three-Layer Permission Check */}
        <div
          className="card-ari mt-8 rounded-xl p-6"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-muted)',
          }}
        >
          <h2
            className="mb-4 text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Three-Layer Permission Check
          </h2>
          <div className="flex items-center justify-between gap-4 overflow-x-auto py-4">
            {PERMISSION_CHECKS.map((check, i, arr) => (
              <div key={check.layer} className="flex items-center">
                <div
                  className="rounded-xl p-4 text-center min-w-[180px]"
                  style={{
                    background: check.cssBg,
                    border: `1px solid color-mix(in srgb, ${check.cssColor} 30%, transparent)`,
                  }}
                >
                  <div
                    className="mb-2 flex h-10 w-10 mx-auto items-center justify-center rounded-xl text-xl"
                    style={{
                      background: `color-mix(in srgb, ${check.cssColor} 20%, transparent)`,
                      color: check.cssColor,
                    }}
                  >
                    {check.icon}
                  </div>
                  <div className="font-medium" style={{ color: check.cssColor }}>
                    {check.name}
                  </div>
                  <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {check.desc}
                  </div>
                </div>
                {i < arr.length - 1 && (
                  <div className="mx-4 flex items-center" style={{ color: 'var(--text-disabled)' }}>
                    <div className="h-px w-8" style={{ background: 'var(--border-muted)' }} />
                    <span className="mx-2" style={{ color: 'var(--ari-success)' }}>✓</span>
                    <div className="h-px w-8" style={{ background: 'var(--border-muted)' }} />
                  </div>
                )}
              </div>
            ))}
            <div className="flex items-center">
              <div className="mx-4 flex items-center" style={{ color: 'var(--text-disabled)' }}>
                <div className="h-px w-8" style={{ background: 'var(--border-muted)' }} />
                <span className="mx-2">→</span>
                <div className="h-px w-8" style={{ background: 'var(--border-muted)' }} />
              </div>
              <div
                className="rounded-xl p-4 text-center min-w-[140px]"
                style={{
                  background: 'var(--ari-success-muted)',
                  border: '1px solid color-mix(in srgb, var(--ari-success) 30%, transparent)',
                }}
              >
                <div
                  className="mb-2 flex h-10 w-10 mx-auto items-center justify-center rounded-xl text-xl"
                  style={{
                    background: 'color-mix(in srgb, var(--ari-success) 20%, transparent)',
                    color: 'var(--ari-success)',
                  }}
                >
                  ✓
                </div>
                <div className="font-medium" style={{ color: 'var(--ari-success)' }}>
                  EXECUTE
                </div>
                <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Tool runs
                </div>
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            All three checks must pass for a tool to execute. Failure at any layer blocks execution and logs the attempt.
          </p>
        </div>
      </div>
    </div>
  );
}

// Tool card component
function ToolCard({ tool }: { tool: { id: string; name: string; description: string; enabled: boolean; trustLevel: string; permissionTier: string; executionCount: number; errorCount: number; lastUsed?: string } }) {
  const trustStyle = {
    SYSTEM: { cssColor: 'var(--ari-purple)', cssBg: 'var(--ari-purple-muted)' },
    OPERATOR: { cssColor: 'var(--ari-info)', cssBg: 'var(--ari-info-muted)' },
    VERIFIED: { cssColor: 'var(--ari-success)', cssBg: 'var(--ari-success-muted)' },
    STANDARD: { cssColor: 'var(--text-tertiary)', cssBg: 'var(--bg-tertiary)' },
  }[tool.trustLevel] || { cssColor: 'var(--text-tertiary)', cssBg: 'var(--bg-tertiary)' };

  const permStyle = {
    READ: { cssColor: 'var(--ari-success)', cssBg: 'var(--ari-success-muted)' },
    WRITE: { cssColor: 'var(--ari-warning)', cssBg: 'var(--ari-warning-muted)' },
    EXECUTE: { cssColor: 'var(--ari-error)', cssBg: 'var(--ari-error-muted)' },
  }[tool.permissionTier] || { cssColor: 'var(--text-tertiary)', cssBg: 'var(--bg-tertiary)' };

  return (
    <div
      className={`card-ari card-ari-hover rounded-xl p-5 ${!tool.enabled ? 'opacity-60' : ''}`}
      style={{
        background: 'var(--bg-card)',
        border: tool.enabled ? '1px solid var(--border-muted)' : '1px solid var(--border-subtle)',
      }}
    >
      <div className="mb-3 flex items-start justify-between">
        <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
          {tool.name}
        </h3>
        <span
          className="rounded-lg px-2 py-1 text-xs font-medium"
          style={{
            background: tool.enabled ? 'var(--ari-success-muted)' : 'var(--bg-tertiary)',
            color: tool.enabled ? 'var(--ari-success)' : 'var(--text-muted)',
          }}
        >
          {tool.enabled ? 'ENABLED' : 'DISABLED'}
        </span>
      </div>

      <p className="mb-4 text-sm" style={{ color: 'var(--text-tertiary)' }}>
        {tool.description}
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <span
          className="rounded-lg px-2 py-1 text-xs font-medium"
          style={{ background: trustStyle.cssBg, color: trustStyle.cssColor }}
        >
          {tool.trustLevel}
        </span>
        <span
          className="rounded-lg px-2 py-1 text-xs font-medium"
          style={{ background: permStyle.cssBg, color: permStyle.cssColor }}
        >
          {tool.permissionTier}
        </span>
      </div>

      <div
        className="pt-3"
        style={{ borderTop: '1px solid var(--border-muted)' }}
      >
        <div className="flex justify-between text-xs">
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Executions</span>
            <div className="font-mono" style={{ color: 'var(--ari-success)' }}>
              {tool.executionCount || 0}
            </div>
          </div>
          <div className="text-right">
            <span style={{ color: 'var(--text-muted)' }}>Errors</span>
            <div
              className="font-mono"
              style={{
                color: (tool.errorCount || 0) > 0 ? 'var(--ari-error)' : 'var(--text-muted)',
              }}
            >
              {tool.errorCount || 0}
            </div>
          </div>
        </div>

        {tool.lastUsed && (
          <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            Last used: {new Date(tool.lastUsed).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}
