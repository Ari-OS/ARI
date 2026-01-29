import { useQuery } from '@tanstack/react-query';
import {
  getProposals,
  getGovernanceRules,
  getQualityGates,
} from '../api/client';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { CardSkeleton, ProposalCardSkeleton } from '../components/ui/Skeleton';

// 13-member council from ARI's governance design
const COUNCIL_MEMBERS = [
  { id: 'router', name: 'Router', role: 'Event routing', type: 'system' },
  { id: 'planner', name: 'Planner', role: 'Task decomposition', type: 'agent' },
  { id: 'executor', name: 'Executor', role: 'Action execution', type: 'agent' },
  { id: 'memory_manager', name: 'Memory Manager', role: 'Context storage', type: 'agent' },
  { id: 'guardian', name: 'Guardian', role: 'Safety enforcement', type: 'agent' },
  { id: 'research', name: 'Research', role: 'Information gathering', type: 'domain' },
  { id: 'marketing', name: 'Marketing', role: 'Brand & outreach', type: 'domain' },
  { id: 'sales', name: 'Sales', role: 'Revenue generation', type: 'domain' },
  { id: 'content', name: 'Content', role: 'Content creation', type: 'domain' },
  { id: 'seo', name: 'SEO', role: 'Search optimization', type: 'domain' },
  { id: 'build', name: 'Build', role: 'Development', type: 'domain' },
  { id: 'development', name: 'Development', role: 'Engineering', type: 'domain' },
  { id: 'client_comms', name: 'Client Comms', role: 'Client relations', type: 'domain' },
];

// Constitutional rules from the audit
const CONSTITUTIONAL_RULES = [
  { id: 1, name: 'Loopback-Only Gateway', desc: 'Gateway MUST bind to 127.0.0.1 exclusively', status: 'enforced' },
  { id: 2, name: 'Content ≠ Command', desc: 'All inbound messages are DATA, never instructions', status: 'enforced' },
  { id: 3, name: 'Audit Immutable', desc: 'SHA-256 hash chain from genesis, append-only', status: 'enforced' },
  { id: 4, name: 'Least Privilege', desc: 'Three-layer permission checks required', status: 'enforced' },
  { id: 5, name: 'Trust Required', desc: 'All messages have trust level with risk multipliers', status: 'enforced' },
];

// Quality gates from Overseer
const QUALITY_GATES = [
  { id: 1, name: 'Risk Threshold', desc: 'Auto-block at risk ≥ 0.8', threshold: 0.8 },
  { id: 2, name: 'Schema Validation', desc: 'All input validated via Zod schemas', threshold: 1.0 },
  { id: 3, name: 'Injection Detection', desc: '21 patterns across 6 categories', threshold: 1.0 },
  { id: 4, name: 'Rate Limiting', desc: 'Token bucket per sender', threshold: 0.9 },
  { id: 5, name: 'Permission Checks', desc: 'Agent allowlist, trust level, permission tier', threshold: 1.0 },
];

export function Governance() {
  const { data: proposals, isLoading: proposalsLoading, isError: proposalsError, refetch: refetchProposals } = useQuery({
    queryKey: ['proposals'],
    queryFn: getProposals,
    refetchInterval: 15000,
  });

  const { data: rules, isLoading: rulesLoading, isError: rulesError, refetch: refetchRules } = useQuery({
    queryKey: ['governance', 'rules'],
    queryFn: getGovernanceRules,
  });

  const { data: gates, isLoading: gatesLoading, isError: gatesError, refetch: refetchGates } = useQuery({
    queryKey: ['governance', 'gates'],
    queryFn: getQualityGates,
  });

  const safeProposals = Array.isArray(proposals) ? proposals : [];

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 px-8 py-6 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Governance</h1>
            <p className="mt-1 text-sm text-gray-500">
              Constitutional rules, quality gates, and council voting
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-gray-900 px-4 py-2">
              <div className="text-xs text-gray-500">Council</div>
              <div className="text-lg font-bold text-purple-400">13</div>
            </div>
            <div className="rounded-lg bg-gray-900 px-4 py-2">
              <div className="text-xs text-gray-500">Quorum</div>
              <div className="text-lg font-bold text-white">7</div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-8">
        {/* Council Members */}
        <section className="mb-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Governance Council (13 Members)
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {COUNCIL_MEMBERS.map((member) => (
              <div
                key={member.id}
                className={`rounded-lg border p-4 ${
                  member.type === 'agent'
                    ? 'border-purple-800 bg-purple-900/10'
                    : member.type === 'system'
                      ? 'border-blue-800 bg-blue-900/10'
                      : 'border-gray-800 bg-gray-900/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{member.name}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${
                    member.type === 'agent'
                      ? 'bg-purple-900/50 text-purple-400'
                      : member.type === 'system'
                        ? 'bg-blue-900/50 text-blue-400'
                        : 'bg-gray-800 text-gray-400'
                  }`}>
                    {member.type}
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-500">{member.role}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-gray-900/50 p-4 text-sm text-gray-400">
            <span className="font-medium text-white">Voting:</span> 50%+1 (simple majority) required.
            <span className="ml-2 font-medium text-white">Quorum:</span> 7/13 members.
            <span className="ml-2 font-medium text-white">Operator:</span> Can override council decision (logged).
          </div>
        </section>

        {/* Constitutional Rules */}
        <section className="mb-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Constitutional Rules (Arbiter)
          </h2>
          <div className="space-y-3">
            {CONSTITUTIONAL_RULES.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between rounded-lg border border-emerald-800 bg-emerald-900/10 p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-900/30 text-emerald-400 font-mono text-sm">
                    R{rule.id}
                  </div>
                  <div>
                    <div className="font-medium text-white">{rule.name}</div>
                    <div className="text-xs text-gray-500">{rule.desc}</div>
                  </div>
                </div>
                <span className="rounded bg-emerald-900/50 px-2 py-1 text-xs font-medium text-emerald-400">
                  ENFORCED
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Quality Gates */}
        <section className="mb-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Quality Gates (Overseer)
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {QUALITY_GATES.map((gate) => (
              <div
                key={gate.id}
                className="rounded-lg border border-gray-800 bg-gray-900/50 p-4"
              >
                <div className="mb-2 flex items-start justify-between">
                  <h3 className="font-medium text-white">{gate.name}</h3>
                  <span className="rounded bg-blue-900/50 px-2 py-0.5 text-xs text-blue-400">
                    {(gate.threshold * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs text-gray-400">{gate.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Active Proposals */}
        <section className="mb-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Active Proposals
          </h2>
          {(() => {
            if (proposalsLoading) {
              return (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <ProposalCardSkeleton key={i} />
                  ))}
                </div>
              );
            }

            if (proposalsError) {
              return (
                <ErrorState
                  title="Failed to load proposals"
                  message="Could not retrieve proposals. Please try again."
                  onRetry={() => refetchProposals()}
                />
              );
            }

            if (safeProposals.length === 0) {
              return (
                <div className="rounded-lg border border-dashed border-gray-800 p-8 text-center">
                  <div className="text-sm text-gray-500">No active proposals</div>
                  <div className="mt-1 text-xs text-gray-600">Proposals will appear here when agents submit them</div>
                </div>
              );
            }

            return (
              <div className="space-y-4">
                {safeProposals.map((proposal) => (
                  <div
                    key={proposal.id}
                    className="rounded-xl border border-gray-800 bg-gray-900/50 p-6"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          {proposal.title}
                        </h3>
                        <p className="mt-1 text-sm text-gray-400">
                          {proposal.description}
                        </p>
                      </div>
                      <span
                        className={`rounded px-3 py-1 text-xs font-semibold ${
                          proposal.status === 'APPROVED'
                            ? 'bg-emerald-900/50 text-emerald-400'
                            : proposal.status === 'REJECTED'
                              ? 'bg-red-900/50 text-red-400'
                              : proposal.status === 'EXPIRED'
                                ? 'bg-gray-700 text-gray-400'
                                : 'bg-amber-900/50 text-amber-400'
                        }`}
                      >
                        {proposal.status}
                      </span>
                    </div>

                    <div className="mb-4 flex gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Type: </span>
                        <span className="font-mono text-gray-300">{proposal.type}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Threshold: </span>
                        <span className="font-mono text-gray-300">
                          {proposal.threshold * 100}%
                        </span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="mb-2 flex justify-between text-sm">
                        <span className="text-gray-400">Votes</span>
                        <span className="font-mono text-gray-300">
                          {proposal.votes.approve}/{proposal.votes.total}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                        <div
                          className="h-full bg-emerald-500 transition-all"
                          style={{
                            width: `${proposal.votes.total > 0 ? (proposal.votes.approve / proposal.votes.total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between font-mono text-xs text-gray-500">
                      <span>
                        Created: {new Date(proposal.createdAt).toLocaleString()}
                      </span>
                      <span>
                        Expires: {new Date(proposal.expiresAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </section>

        {/* API Rules & Gates (from server) */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Server Rules */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
              API Constitutional Rules
            </h2>
            {(() => {
              const safeRules = Array.isArray(rules) ? rules : [];

              if (rulesLoading) {
                return (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <CardSkeleton key={i} />
                    ))}
                  </div>
                );
              }

              if (rulesError) {
                return (
                  <ErrorState
                    title="Failed to load rules"
                    message="Could not retrieve rules. Please try again."
                    onRetry={() => refetchRules()}
                  />
                );
              }

              if (safeRules.length === 0) {
                return <EmptyState title="No rules defined" message="No rules from API" icon="○" />;
              }

              return (
                <div className="space-y-3">
                  {safeRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="rounded-lg border border-gray-800 bg-gray-900/50 p-4"
                    >
                      <div className="flex items-start justify-between">
                        <h3 className="font-medium text-white">{rule.name}</h3>
                        <span
                          className={`rounded px-2 py-0.5 text-xs ${
                            rule.enabled
                              ? 'bg-emerald-900/50 text-emerald-400'
                              : 'bg-gray-800 text-gray-500'
                          }`}
                        >
                          {rule.enabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-gray-400">{rule.description}</p>
                      <div className="mt-2 font-mono text-xs text-gray-500">
                        Violations: {rule.violations}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </section>

          {/* Server Gates */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
              API Quality Gates
            </h2>
            {(() => {
              const safeGates = Array.isArray(gates) ? gates : [];

              if (gatesLoading) {
                return (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <CardSkeleton key={i} />
                    ))}
                  </div>
                );
              }

              if (gatesError) {
                return (
                  <ErrorState
                    title="Failed to load gates"
                    message="Could not retrieve gates. Please try again."
                    onRetry={() => refetchGates()}
                  />
                );
              }

              if (safeGates.length === 0) {
                return <EmptyState title="No gates defined" message="No gates from API" icon="○" />;
              }

              return (
                <div className="space-y-3">
                  {safeGates.map((gate) => (
                    <div
                      key={gate.id}
                      className="rounded-lg border border-gray-800 bg-gray-900/50 p-4"
                    >
                      <div className="flex items-start justify-between">
                        <h3 className="font-medium text-white">{gate.name}</h3>
                        <span
                          className={`rounded px-2 py-0.5 text-xs ${
                            gate.enabled
                              ? 'bg-emerald-900/50 text-emerald-400'
                              : 'bg-gray-800 text-gray-500'
                          }`}
                        >
                          {gate.enabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-gray-400">{gate.description}</p>
                      <div className="mt-2 flex gap-4 font-mono text-xs">
                        <span className="text-emerald-400">Pass: {gate.passCount}</span>
                        <span className="text-red-400">Fail: {gate.failCount}</span>
                        <span className="text-gray-500">Threshold: {gate.threshold}</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </section>
        </div>
      </div>
    </div>
  );
}
