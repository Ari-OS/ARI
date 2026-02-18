/**
 * Soul Evolution Types — Shared type definitions for ARI's personality
 * evolution system.
 *
 * ARI can propose changes to her own identity files (SOUL.md, IDENTITY.md,
 * PREFERENCES.md), subject to Pryce's approval for protected files.
 *
 * @module autonomous/soul-evolution-types
 */

// =============================================================================
// SOUL PROPOSAL
// =============================================================================

export interface SoulProposal {
  /** Unique identifier for this proposal */
  id: string;
  /** Target file (e.g., 'SOUL.md', 'IDENTITY.md', 'PREFERENCES.md') */
  file: string;
  /** Section within the file to modify */
  section: string;
  /** Current content of the section */
  currentContent: string;
  /** Proposed replacement content */
  proposedContent: string;
  /** ARI's rationale for why this change is needed */
  rationale: string;
  /** Current status of the proposal */
  status: 'pending' | 'approved' | 'rejected';
  /** ISO timestamp of when the proposal was created */
  createdAt: string;
  /** Unified-diff-style showing - old lines / + new lines */
  diff: string;
  /** Whether this proposal requires Pryce's explicit approval */
  requiresPryceApproval: boolean;
}

// =============================================================================
// SOUL REFLECTION
// =============================================================================

export interface SoulReflection {
  /** Key insights from the week's interactions */
  insights: string[];
  /** Proposed changes based on the reflection */
  proposedChanges: SoulProposal[];
  /** ARI's overall sentiment about her growth */
  overallSentiment: 'growing' | 'stable' | 'struggling';
  /** Summary of the week */
  weekSummary: string;
}
