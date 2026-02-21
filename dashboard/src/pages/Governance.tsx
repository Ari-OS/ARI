import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getProposals,
  getGovernanceRules,
  getQualityGates,
  approveProposal,
  rejectProposal,
} from '../api/client';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { CardSkeleton, ProposalCardSkeleton } from '../components/ui/Skeleton';

// 15-member council from ARI's governance design
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
  { id: 3, name: 'Injection Detection', desc: '27 patterns across 10 categories', threshold: 1.0 },
  { id: 4, name: 'Rate Limiting', desc: 'Token bucket per sender', threshold: 0.9 },
  { id: 5, name: 'Permission Checks', desc: 'Agent allowlist, trust level, permission tier', threshold: 1.0 },
];

// Member type styling
const MEMBER_TYPE_STYLES = {
  agent: {
    cssColor: 'var(--ari-purple)',
    cssBg: 'var(--ari-purple-muted)',
  },
  system: {
    cssColor: 'var(--ari-info)',
    cssBg: 'var(--ari-info-muted)',
  },
  domain: {
    cssColor: 'var(--text-tertiary)',
    cssBg: 'var(--bg-tertiary)',
  },
};

export function Governance() {
  const queryClient = useQueryClient();

  const { data: proposals, isLoading: proposalsLoading, isError: proposalsError, refetch: refetchProposals } = useQuery({
    queryKey: ['proposals'],
    queryFn: getProposals,
    refetchInterval: 15000,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveProposal(id, 'Approved via Actionable UI'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proposals'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectProposal(id, 'Rejected via Actionable UI'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proposals'] }),
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
              Governance
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              Constitutional rules, quality gates, and council voting
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div
              className="rounded-xl px-4 py-2"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Council</div>
              <div className="text-lg font-bold" style={{ color: 'var(--ari-purple)' }}>15</div>
            </div>
            <div
              className="rounded-xl px-4 py-2"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Quorum</div>
              <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>8</div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-8">
        {/* Council Members */}
        <section className="mb-8">
          <h2
            className="mb-4 text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Governance Council (15 Members)
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 stagger-children">
            {COUNCIL_MEMBERS.map((member) => {
              const typeStyle = MEMBER_TYPE_STYLES[member.type as keyof typeof MEMBER_TYPE_STYLES];
              return (
                <div
                  key={member.id}
                  className="card-ari rounded-xl p-4"
                  style={{
                    background: typeStyle.cssBg,
                    border: `1px solid color-mix(in srgb, ${typeStyle.cssColor} 30%, transparent)`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {member.name}
                    </span>
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px]"
                      style={{
                        background: `color-mix(in srgb, ${typeStyle.cssColor} 20%, transparent)`,
                        color: typeStyle.cssColor,
                      }}
                    >
                      {member.type}
                    </span>
                  </div>
                  <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {member.role}
                  </div>
                </div>
              );
            })}
          </div>
          <div
            className="mt-4 rounded-xl p-4 text-sm"
            style={{
              background: 'var(--bg-card)',
              color: 'var(--text-tertiary)',
            }}
          >
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Voting:</span> 50%+1 (simple majority) required.
            <span className="ml-2 font-medium" style={{ color: 'var(--text-primary)' }}>Quorum:</span> 8/15 members.
            <span className="ml-2 font-medium" style={{ color: 'var(--text-primary)' }}>Operator:</span> Can override council decision (logged).
          </div>
        </section>

        {/* Constitutional Rules */}
        <section className="mb-8">
          <h2
            className="mb-4 text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Constitutional Rules (Arbiter)
          </h2>
          <div className="space-y-3 stagger-children">
            {CONSTITUTIONAL_RULES.map((rule) => (
              <div
                key={rule.id}
                className="card-ari flex items-center justify-between rounded-xl p-4"
                style={{
                  background: 'var(--ari-success-muted)',
                  border: '1px solid color-mix(in srgb, var(--ari-success) 30%, transparent)',
                }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl font-mono text-sm"
                    style={{
                      background: 'color-mix(in srgb, var(--ari-success) 20%, transparent)',
                      color: 'var(--ari-success)',
                    }}
                  >
                    R{rule.id}
                  </div>
                  <div>
                    <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {rule.name}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {rule.desc}
                    </div>
                  </div>
                </div>
                <span
                  className="rounded px-2 py-1 text-xs font-medium"
                  style={{
                    background: 'color-mix(in srgb, var(--ari-success) 20%, transparent)',
                    color: 'var(--ari-success)',
                  }}
                >
                  ENFORCED
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Quality Gates */}
        <section className="mb-8">
          <h2
            className="mb-4 text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Quality Gates (Overseer)
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-children">
            {QUALITY_GATES.map((gate) => (
              <div
                key={gate.id}
                className="card-ari card-ari-hover rounded-xl p-4"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-muted)',
                }}
              >
                <div className="mb-2 flex items-start justify-between">
                  <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {gate.name}
                  </h3>
                  <span
                    className="rounded px-2 py-0.5 text-xs"
                    style={{
                      background: 'var(--ari-info-muted)',
                      color: 'var(--ari-info)',
                    }}
                  >
                    {(gate.threshold * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {gate.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Active Proposals */}
        <section className="mb-8">
          <h2
            className="mb-4 text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
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
                  onRetry={() => { void refetchProposals(); }}
                />
              );
            }

            if (safeProposals.length === 0) {
              return (
                <div
                  className="rounded-xl border-dashed p-8 text-center"
                  style={{
                    border: '2px dashed var(--border-muted)',
                  }}
                >
                  <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    No active proposals
                  </div>
                  <div className="mt-1 text-xs" style={{ color: 'var(--text-disabled)' }}>
                    Proposals will appear here when agents submit them
                  </div>
                </div>
              );
            }

            return (
              <div className="space-y-4 stagger-children">
                {safeProposals.map((proposal) => (
                  <div
                    key={proposal.id}
                    className="card-ari rounded-xl p-6"
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-muted)',
                    }}
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {proposal.title}
                        </h3>
                        <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                          {proposal.description}
                        </p>
                      </div>
                      <span
                        className="rounded px-3 py-1 text-xs font-semibold"
                        style={{
                          background: proposal.status === 'PASSED'
                            ? 'var(--ari-success-muted)'
                            : proposal.status === 'FAILED' || proposal.status === 'VETOED'
                              ? 'var(--ari-error-muted)'
                              : proposal.status === 'EXPIRED'
                                ? 'var(--bg-tertiary)'
                                : 'var(--ari-warning-muted)',
                          color: proposal.status === 'PASSED'
                            ? 'var(--ari-success)'
                            : proposal.status === 'FAILED' || proposal.status === 'VETOED'
                              ? 'var(--ari-error)'
                              : proposal.status === 'EXPIRED'
                                ? 'var(--text-muted)'
                                : 'var(--ari-warning)',
                        }}
                      >
                        {proposal.status}
                      </span>
                    </div>

                    <div className="mb-4 flex gap-4 text-sm">
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Type: </span>
                        <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                          {proposal.type}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Threshold: </span>
                        <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                          {proposal.threshold * 100}%
                        </span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="mb-2 flex justify-between text-sm">
                        <span style={{ color: 'var(--text-tertiary)' }}>Votes</span>
                        <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                          {proposal.votes.approve}/{proposal.votes.total}
                        </span>
                      </div>
                      <div
                        className="h-2 overflow-hidden rounded-full"
                        style={{ background: 'var(--bg-tertiary)' }}
                      >
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${proposal.votes.total > 0 ? (proposal.votes.approve / proposal.votes.total) * 100 : 0}%`,
                            background: 'var(--ari-success)',
                          }}
                        />
                      </div>
                    </div>

                    <div
                      className="flex justify-between font-mono text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <span>
                        Created: {new Date(proposal.createdAt).toLocaleString()}
                      </span>
                      <span>
                        Expires: {new Date(proposal.expiresAt).toLocaleString()}
                      </span>
                    </div>

                    {proposal.status === 'OPEN' && (
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => approveMutation.mutate(proposal.id)}
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                          className="flex-1 rounded-lg py-2 text-sm font-medium transition-colors"
                          style={{
                            background: 'var(--ari-success-muted)',
                            color: 'var(--ari-success)',
                            border: '1px solid color-mix(in srgb, var(--ari-success) 30%, transparent)'
                          }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => rejectMutation.mutate(proposal.id)}
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                          className="flex-1 rounded-lg py-2 text-sm font-medium transition-colors"
                          style={{
                            background: 'var(--ari-error-muted)',
                            color: 'var(--ari-error)',
                            border: '1px solid color-mix(in srgb, var(--ari-error) 30%, transparent)'
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    )}
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
            <h2
              className="mb-4 text-sm font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
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
                    onRetry={() => { void refetchRules(); }}
                  />
                );
              }

              if (safeRules.length === 0) {
                return <EmptyState title="No rules defined" message="No rules from API" icon="○" />;
              }

              return (
                <div className="space-y-3 stagger-children">
                  {safeRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="card-ari rounded-xl p-4"
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-muted)',
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {rule.name}
                        </h3>
                        <span
                          className="rounded px-2 py-0.5 text-xs"
                          style={{
                            background: rule.enabled
                              ? 'var(--ari-success-muted)'
                              : 'var(--bg-tertiary)',
                            color: rule.enabled
                              ? 'var(--ari-success)'
                              : 'var(--text-muted)',
                          }}
                        >
                          {rule.enabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                      </div>
                      <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {rule.description}
                      </p>
                      <div className="mt-2 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
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
            <h2
              className="mb-4 text-sm font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
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
                    onRetry={() => { void refetchGates(); }}
                  />
                );
              }

              if (safeGates.length === 0) {
                return <EmptyState title="No gates defined" message="No gates from API" icon="○" />;
              }

              return (
                <div className="space-y-3 stagger-children">
                  {safeGates.map((gate) => (
                    <div
                      key={gate.id}
                      className="card-ari rounded-xl p-4"
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-muted)',
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {gate.name}
                        </h3>
                        <span
                          className="rounded px-2 py-0.5 text-xs"
                          style={{
                            background: gate.enabled
                              ? 'var(--ari-success-muted)'
                              : 'var(--bg-tertiary)',
                            color: gate.enabled
                              ? 'var(--ari-success)'
                              : 'var(--text-muted)',
                          }}
                        >
                          {gate.enabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                      </div>
                      <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {gate.description}
                      </p>
                      <div className="mt-2 flex gap-4 font-mono text-xs">
                        <span style={{ color: 'var(--ari-success)' }}>Pass: {gate.passCount}</span>
                        <span style={{ color: 'var(--ari-error)' }}>Fail: {gate.failCount}</span>
                        <span style={{ color: 'var(--text-muted)' }}>Threshold: {gate.threshold}</span>
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
