import { useQuery } from '@tanstack/react-query';
import { getTools } from '../api/client';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { ToolCardSkeleton } from '../components/ui/Skeleton';
import type { ColorName } from '../utils/colors';
import { cardClasses, textClasses, bgLightClasses, iconContainerClasses, borderClasses } from '../utils/colors';

// Tool categories with icons and colors
const TOOL_CATEGORIES = {
  system: {
    name: 'System',
    icon: '◉',
    description: 'Core system operations',
    color: { bg: 'bg-purple-900/20', text: 'text-purple-400', border: 'border-purple-800' },
  },
  memory: {
    name: 'Memory',
    icon: '⬢',
    description: 'Knowledge storage and retrieval',
    color: { bg: 'bg-cyan-900/20', text: 'text-cyan-400', border: 'border-cyan-800' },
  },
  audit: {
    name: 'Audit',
    icon: '⊞',
    description: 'Audit trail operations',
    color: { bg: 'bg-emerald-900/20', text: 'text-emerald-400', border: 'border-emerald-800' },
  },
  governance: {
    name: 'Governance',
    icon: '⚖',
    description: 'Council and proposal management',
    color: { bg: 'bg-amber-900/20', text: 'text-amber-400', border: 'border-amber-800' },
  },
  agents: {
    name: 'Agents',
    icon: '⬡',
    description: 'Agent coordination tools',
    color: { bg: 'bg-blue-900/20', text: 'text-blue-400', border: 'border-blue-800' },
  },
};

// Permission tier definitions with typed colors
const PERMISSION_TIERS: Array<{ name: string; desc: string; color: ColorName; risk: string }> = [
  { name: 'READ', desc: 'Read-only access', color: 'emerald', risk: 'Low' },
  { name: 'WRITE', desc: 'Create and modify', color: 'amber', risk: 'Medium' },
  { name: 'EXECUTE', desc: 'Run operations', color: 'red', risk: 'High' },
];

// Trust level requirements with typed colors
const TRUST_LEVELS: Array<{ name: string; multiplier: string; color: ColorName }> = [
  { name: 'SYSTEM', multiplier: '0.5x', color: 'purple' },
  { name: 'OPERATOR', multiplier: '0.6x', color: 'blue' },
  { name: 'VERIFIED', multiplier: '0.75x', color: 'emerald' },
  { name: 'STANDARD', multiplier: '1.0x', color: 'gray' },
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
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 px-8 py-6 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Tool Registry</h1>
            <p className="mt-1 text-sm text-gray-500">
              Permission-gated tool execution • Three-layer permission checks
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-gray-900 px-4 py-2">
              <div className="text-xs text-gray-500">Registered</div>
              <div className="text-lg font-bold text-purple-400">
                {isLoading ? '...' : safeTools.length}
              </div>
            </div>
            <div className="rounded-lg bg-gray-900 px-4 py-2">
              <div className="text-xs text-gray-500">Enabled</div>
              <div className="text-lg font-bold text-emerald-400">
                {isLoading ? '...' : enabledCount}
              </div>
            </div>
            <div className="rounded-lg bg-gray-900 px-4 py-2">
              <div className="text-xs text-gray-500">Success Rate</div>
              <div className="text-lg font-bold text-cyan-400">
                {isLoading ? '...' : `${successRate}%`}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-8">
        {/* Permission Tiers */}
        <div className="mb-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Permission Tiers
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {PERMISSION_TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-xl border p-4 ${borderClasses[tier.color]} ${cardClasses[tier.color]}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`text-lg font-bold ${textClasses[tier.color]}`}>{tier.name}</div>
                    <div className="text-sm text-gray-500">{tier.desc}</div>
                  </div>
                  <div className={`rounded-lg px-3 py-1 ${bgLightClasses[tier.color]}`}>
                    <span className={`text-xs font-medium ${textClasses[tier.color]}`}>{tier.risk} Risk</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trust Levels */}
        <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Trust Level Requirements
          </h2>
          <div className="grid gap-4 md:grid-cols-4">
            {TRUST_LEVELS.map((level) => (
              <div key={level.name} className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold ${iconContainerClasses[level.color]}`}>
                  {level.multiplier}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{level.name}</div>
                  <div className="text-xs text-gray-500">Risk multiplier</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Overview */}
        <div className="mb-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Tool Categories
          </h2>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            {Object.entries(TOOL_CATEGORIES).map(([key, cat]) => {
              const categoryTools = groupedTools[cat.name] || [];
              const catEnabled = categoryTools.filter((t: { enabled: boolean }) => t.enabled).length;

              return (
                <div
                  key={key}
                  className={`card-hover rounded-xl border ${cat.color.border} ${cat.color.bg} p-4`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900/50 text-xl ${cat.color.text}`}>
                      {cat.icon}
                    </div>
                    <div>
                      <div className="font-medium text-white">{cat.name}</div>
                      <div className="text-xs text-gray-500">
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
              <div className="mb-4 h-7 w-32 animate-pulse rounded bg-gray-700" />
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
                { icon: '◎', color: { bg: 'bg-gray-900/20', text: 'text-gray-400', border: 'border-gray-800' } };

              return (
                <section key={category}>
                  <div className="mb-4 flex items-center gap-3">
                    <span className={`text-xl ${catConfig.color.text}`}>{catConfig.icon}</span>
                    <h2 className="text-xl font-semibold text-white capitalize">
                      {category}
                    </h2>
                    <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                      {categoryTools.length} tools
                    </span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {categoryTools.map((tool) => (
                      <div
                        key={tool.id}
                        className={`card-hover rounded-xl border ${
                          tool.enabled ? 'border-gray-800' : 'border-gray-800/50'
                        } bg-gray-900/50 p-5 ${!tool.enabled ? 'opacity-60' : ''}`}
                      >
                        <div className="mb-3 flex items-start justify-between">
                          <h3 className="font-semibold text-white">{tool.name}</h3>
                          <span
                            className={`rounded-lg px-2 py-1 text-xs font-medium ${
                              tool.enabled
                                ? 'bg-emerald-900/30 text-emerald-400'
                                : 'bg-gray-700 text-gray-400'
                            }`}
                          >
                            {tool.enabled ? 'ENABLED' : 'DISABLED'}
                          </span>
                        </div>

                        <p className="mb-4 text-sm text-gray-400">
                          {tool.description}
                        </p>

                        <div className="mb-4 flex flex-wrap gap-2">
                          <span className={`rounded-lg px-2 py-1 text-xs font-medium ${
                            tool.trustLevel === 'SYSTEM' ? 'bg-purple-900/30 text-purple-400' :
                            tool.trustLevel === 'OPERATOR' ? 'bg-blue-900/30 text-blue-400' :
                            tool.trustLevel === 'VERIFIED' ? 'bg-emerald-900/30 text-emerald-400' :
                            'bg-gray-700 text-gray-400'
                          }`}>
                            {tool.trustLevel}
                          </span>
                          <span
                            className={`rounded-lg px-2 py-1 text-xs font-medium ${
                              tool.permissionTier === 'READ'
                                ? 'bg-emerald-900/30 text-emerald-400'
                                : tool.permissionTier === 'WRITE'
                                  ? 'bg-amber-900/30 text-amber-400'
                                  : 'bg-red-900/30 text-red-400'
                            }`}
                          >
                            {tool.permissionTier}
                          </span>
                        </div>

                        <div className="border-t border-gray-800 pt-3">
                          <div className="flex justify-between text-xs">
                            <div>
                              <span className="text-gray-500">Executions</span>
                              <div className="font-mono text-emerald-400">{tool.executionCount || 0}</div>
                            </div>
                            <div className="text-right">
                              <span className="text-gray-500">Errors</span>
                              <div className={`font-mono ${(tool.errorCount || 0) > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                {tool.errorCount || 0}
                              </div>
                            </div>
                          </div>

                          {tool.lastUsed && (
                            <div className="mt-2 text-xs text-gray-500">
                              Last used: {new Date(tool.lastUsed).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* Three-Layer Permission Check */}
        <div className="mt-8 rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Three-Layer Permission Check
          </h2>
          <div className="flex items-center justify-between gap-4 overflow-x-auto py-4">
            {([
              { layer: '1', name: 'Agent Allowlist', desc: 'Tool in agent\'s allowed set', icon: '⬡', color: 'blue' as ColorName },
              { layer: '2', name: 'Trust Level', desc: 'Caller meets minimum trust', icon: '⛨', color: 'purple' as ColorName },
              { layer: '3', name: 'Permission Tier', desc: 'Action allowed for tier', icon: '⚙', color: 'emerald' as ColorName },
            ]).map((check, i, arr) => (
              <div key={check.layer} className="flex items-center">
                <div className={`rounded-lg border p-4 text-center min-w-[180px] ${borderClasses[check.color]} ${cardClasses[check.color]}`}>
                  <div className={`mb-2 flex h-10 w-10 mx-auto items-center justify-center rounded-lg text-xl ${iconContainerClasses[check.color]}`}>
                    {check.icon}
                  </div>
                  <div className={`font-medium ${textClasses[check.color]}`}>{check.name}</div>
                  <div className="mt-1 text-xs text-gray-500">{check.desc}</div>
                </div>
                {i < arr.length - 1 && (
                  <div className="mx-4 flex items-center text-gray-600">
                    <div className="h-px w-8 bg-gray-700" />
                    <span className="mx-2 text-emerald-400">✓</span>
                    <div className="h-px w-8 bg-gray-700" />
                  </div>
                )}
              </div>
            ))}
            <div className="flex items-center">
              <div className="mx-4 flex items-center text-gray-600">
                <div className="h-px w-8 bg-gray-700" />
                <span className="mx-2">→</span>
                <div className="h-px w-8 bg-gray-700" />
              </div>
              <div className="rounded-lg border border-emerald-800 bg-emerald-900/20 p-4 text-center min-w-[140px]">
                <div className="mb-2 flex h-10 w-10 mx-auto items-center justify-center rounded-lg bg-emerald-900/30 text-emerald-400 text-xl">
                  ✓
                </div>
                <div className="font-medium text-emerald-400">EXECUTE</div>
                <div className="mt-1 text-xs text-gray-500">Tool runs</div>
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-500">
            All three checks must pass for a tool to execute. Failure at any layer blocks execution and logs the attempt.
          </p>
        </div>
      </div>
    </div>
  );
}
