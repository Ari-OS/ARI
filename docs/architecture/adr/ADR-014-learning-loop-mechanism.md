# ADR-014: Continuous Learning Loop Mechanism

**Status**: PROPOSED (Pending Council Vote)

**Date**: 2026-02-01

**Related**: ADR-008 (RL Deferred), ADR-009 (Cognitive Layer), ADR-011 (Knowledge Sources)

---

## Context

ARI's mission is to be a **Life Operating System** that continuously improves. Currently:

**What ARI Has**:
- Knowledge fetching ([`knowledge-fetcher.ts`](../../src/autonomous/knowledge-fetcher.ts))
- Knowledge indexing ([`knowledge-index.ts`](../../src/autonomous/knowledge-index.ts))
- Scheduled tasks ([`scheduler.ts`](../../src/autonomous/scheduler.ts))
- Audit trail of all decisions (SHA-256 hash chain)

**What ARI Lacks**:
- **Learning from outcomes** - Decisions are made, outcomes happen, but no reflection
- **Knowledge gap analysis** - Don't identify what we don't know
- **Self-improvement mechanism** - No way to measure if getting better
- **Continuous evolution** - Knowledge base grows, but Council members don't adapt their strategies

### The Learning Challenge

**Feedback Loop Theory**: Systems improve through feedback cycles:
```
Action → Outcome → Reflection → Learning → Better Action
```

**ARI's Current State**: Broken loop:
```
Action → Outcome → [GAP] → No learning → Same action (repeat mistakes)
```

**Goal**: Close the loop with **supervised learning** (respects ADR-008: no autonomous self-modification).

### Why Supervised (Not Autonomous)?

**ADR-008** defers reinforcement learning to Phase 3+. Reasons:
1. **Safety**: Autonomous self-modification can violate security boundaries
2. **Alignment**: Reward functions can be misspecified (Goodhart's Law)
3. **Stability**: Phase 2 focuses on architecture, not optimization
4. **Transparency**: Human oversight maintains control

**Supervised Learning**: 
- System **proposes** improvements
- Human **approves** changes
- Balance: Automation where safe, human judgment where critical

---

## Decision

Implement a **5-stage continuous learning loop** that runs automatically (via scheduler) but requires **human approval** for critical changes.

### Learning Loop Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 1: Performance Review (Daily, 9 PM)                      │
│  ───────────────────────────────────────────────────────────    │
│  - Analyze last 24h decisions                                   │
│  - Measure outcomes (success/failure rates)                     │
│  - Compare expected vs actual values                            │
│  - Identify patterns (what worked, what didn't)                 │
│  - Store in ~/.ari/cognition/performance/YYYY-MM-DD.json        │
│                                                                 │
│  AUTO-RUNS: ✅ (no human approval needed - just analysis)       │
├─────────────────────────────────────────────────────────────────┤
│  STAGE 2: Gap Analysis (Weekly, Sunday 8 PM)                    │
│  ───────────────────────────────────────────────────────────    │
│  - Review last 7 days of decisions                              │
│  - Identify unanswered questions (no framework available)       │
│  - Detect missing knowledge (queries with no results)           │
│  - Suggest new frameworks to add                                │
│  - Suggest new sources to integrate                             │
│  - Store in ~/.ari/cognition/gaps/YYYY-WW.json                  │
│                                                                 │
│  AUTO-RUNS: ✅ (proposes additions, doesn't auto-integrate)     │
│  HUMAN REVIEW: Required for adding sources/frameworks           │
├─────────────────────────────────────────────────────────────────┤
│  STAGE 3: Source Discovery (As Needed, triggered by gaps)       │
│  ───────────────────────────────────────────────────────────    │
│  - Search for papers/books addressing identified gaps           │
│  - Evaluate source quality (official? peer-reviewed? reputable?)│
│  - Assess trust tier (VERIFIED vs STANDARD vs UNTRUSTED)        │
│  - Propose adding to KNOWLEDGE_SOURCES                          │
│  - Queue for human approval                                     │
│                                                                 │
│  AUTO-RUNS: ❌ (search only, no auto-fetch)                     │
│  HUMAN APPROVAL: Required to add new source                     │
├─────────────────────────────────────────────────────────────────┤
│  STAGE 4: Knowledge Integration (Daily, 8 AM)                   │
│  ───────────────────────────────────────────────────────────    │
│  - Fetch content from approved sources (80+ sources)            │
│  - Validate (sanitize → bias-check → fact-check)                │
│  - Index for semantic search                                    │
│  - Update Council member specialization knowledge               │
│  - Store new documents in ~/.ari/cognition/sources/             │
│                                                                 │
│  AUTO-RUNS: ✅ (for VERIFIED/STANDARD sources)                  │
│  HUMAN REVIEW: Required for UNTRUSTED sources                   │
├─────────────────────────────────────────────────────────────────┤
│  STAGE 5: Self-Assessment (Monthly, 1st at 9 AM)                │
│  ───────────────────────────────────────────────────────────    │
│  - Compare decision quality: This month vs last month           │
│  - Measure knowledge retention (query success rate)             │
│  - Calculate learning velocity (insights/week)                  │
│  - Assess framework effectiveness (which frameworks improve decisions?)│
│  - Generate improvement report                                  │
│  - Store in ~/.ari/cognition/assessment/YYYY-MM.json            │
│                                                                 │
│  AUTO-RUNS: ✅ (measurement only, no changes)                   │
│  HUMAN REVIEW: Review monthly report                            │
└─────────────────────────────────────────────────────────────────┘
```

### Integration with Existing Scheduler

**Uses**: Existing [`scheduler.ts`](../../src/autonomous/scheduler.ts) for automation.

**New Scheduled Tasks**:

| Time | Task | Handler | Auto-Approve? |
|------|------|---------|---------------|
| 09:00 PM daily | Performance review | `performance_review` | ✅ Yes (read-only) |
| 08:00 PM Sunday | Gap analysis | `gap_analysis` | ✅ Yes (proposes only) |
| 08:00 AM daily | Knowledge integration | `knowledge_integration` | ✅ Yes (VERIFIED/STANDARD) |
| 09:00 AM 1st of month | Self-assessment | `self_assessment` | ✅ Yes (measurement only) |

**Conditional Task**:
- **Source discovery**: Triggered by gap analysis (not scheduled)
- Runs when >= 3 gaps identified
- Proposes sources, queues for approval

---

## Stage 1: Performance Review (Daily)

### Purpose

Measure decision quality over last 24 hours:
- What decisions were made?
- What were the outcomes?
- Were expectations accurate? (expected value vs actual)
- What patterns emerged? (successes, failures, biases)

### Implementation

**File**: `src/cognition/learning/performance-review.ts`

```typescript
export interface PerformanceReview {
  period: {
    start: Date;
    end: Date;
    durationHours: number;
  };
  decisions: {
    total: number;
    successful: number;
    failed: number;
    partial: number;
    successRate: number;          // 0.0 - 1.0
  };
  expectedValueAccuracy: {
    meanError: number;            // Avg(expected - actual)
    rmse: number;                 // Root mean squared error
    calibration: number;          // 0-1, how well-calibrated are expectations?
  };
  biasesDetected: {
    total: number;
    byType: Record<CognitiveBias, number>;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  emotionalRisk: {
    avgRisk: number;              // Average emotional risk across decisions
    highRiskDecisions: number;    // Count where risk > 0.6
  };
  patterns: string[];             // Identified success/failure patterns
  insights: Insight[];            // Auto-generated insights
  recommendations: string[];      // What to improve tomorrow
}

export async function runPerformanceReview(
  period: { start: Date; end: Date }
): Promise<PerformanceReview> {
  // 1. Query audit log for all decisions in period
  const decisions = await queryDecisions(period);
  
  // 2. For each decision, get outcome
  const outcomes = await getOutcomes(decisions);
  
  // 3. Calculate success rate
  const successRate = outcomes.filter(o => o.result === 'success').length / outcomes.length;
  
  // 4. Calculate EV accuracy (how close were predictions to reality?)
  const evErrors = outcomes.map(o => o.expectedValue - o.actualValue);
  const meanError = average(evErrors);
  const rmse = Math.sqrt(average(evErrors.map(e => e * e)));
  
  // 5. Aggregate biases detected during period
  const biases = aggregateBiases(outcomes);
  
  // 6. Calculate average emotional risk
  const emotionalRisk = calculateEmotionalRisk(outcomes);
  
  // 7. Identify patterns
  const patterns = identifyPatterns(outcomes);
  
  // 8. Generate insights
  const insights = await generateInsights(patterns, biases, emotionalRisk);
  
  // 9. Recommendations for tomorrow
  const recommendations = generateRecommendations(insights);
  
  return {
    period,
    decisions: { total: outcomes.length, successful: ..., successRate },
    expectedValueAccuracy: { meanError, rmse, calibration: ... },
    biasesDetected: biases,
    emotionalRisk,
    patterns,
    insights,
    recommendations,
  };
}
```

**Storage**: `~/.ari/cognition/performance/2026-02-01.json`

**Notifications**: If success rate drops below 70%, alert Operator.

---

## Stage 2: Gap Analysis (Weekly)

### Purpose

Identify what knowledge is missing:
- What questions couldn't be answered?
- What frameworks would have helped?
- What sources should be added?

### Implementation

**File**: `src/cognition/learning/gap-analysis.ts`

```typescript
export interface KnowledgeGap {
  id: string;
  description: string;            // "Need framework for X"
  context: string;                // When was this needed?
  frequency: number;              // How often does this gap appear?
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestedFrameworks: string[];  // What would fill this gap?
  suggestedSources: string[];     // Where to find this knowledge?
  affectedMembers: string[];      // Which Council members need this?
  priority: number;               // Calculated: frequency × severity
}

export interface GapAnalysisResult {
  period: {
    start: Date;
    end: Date;
  };
  gaps: KnowledgeGap[];
  topGaps: KnowledgeGap[];        // Top 5 by priority
  recommendations: string[];      // Concrete actions
  newSourceSuggestions: Array<{
    name: string;
    url: string;
    rationale: string;
    estimatedTrust: TrustLevel;
  }>;
}

export async function runGapAnalysis(
  period: { start: Date; end: Date }
): Promise<GapAnalysisResult> {
  // 1. Review last week's decisions
  const decisions = await queryDecisions(period);
  
  // 2. Identify queries with no/low results
  const knowledgeQueries = decisions.flatMap(d => d.knowledgeQueries || []);
  const lowResultQueries = knowledgeQueries.filter(q => q.resultCount < 3);
  
  // 3. Identify decisions that cited "no framework available"
  const noFramework = decisions.filter(d => d.reasoning?.includes('no framework'));
  
  // 4. Group into gaps
  const gaps = groupIntoGaps(lowResultQueries, noFramework);
  
  // 5. For each gap, suggest sources
  const suggestions = await suggestSourcesForGaps(gaps);
  
  // 6. Prioritize
  const topGaps = gaps.sort((a, b) => b.priority - a.priority).slice(0, 5);
  
  return {
    period,
    gaps,
    topGaps,
    recommendations: gaps.map(g => g.description),
    newSourceSuggestions: suggestions,
  };
}
```

**Example Output**:
```json
{
  "period": { "start": "2026-01-26", "end": "2026-02-01" },
  "topGaps": [
    {
      "id": "gap_supply_chain_risk",
      "description": "Need framework for supply chain risk assessment",
      "context": "AEGIS needed to assess vendor reliability, no framework available",
      "frequency": 3,
      "severity": "high",
      "suggestedFrameworks": [
        "Supply Chain Risk Management (SCRM)",
        "Resilience Engineering"
      ],
      "suggestedSources": [
        "MIT Supply Chain Management research",
        "Resilience Engineering journal"
      ],
      "affectedMembers": ["AEGIS", "SCOUT"],
      "priority": 0.85
    }
  ]
}
```

**Action**: Operator reviews gaps, approves sources to add, system integrates.

---

## Stage 3: Source Discovery (Triggered)

### Purpose

Find new knowledge sources to fill identified gaps.

### Trigger Conditions

Run source discovery when:
- Gap analysis identifies >= 3 gaps with severity "high" or "critical"
- OR: >= 5 gaps total
- OR: Manual trigger: `ari cognition discover-sources`

### Implementation

**File**: `src/cognition/learning/source-discovery.ts`

```typescript
export interface SourceProposal {
  proposedSource: {
    name: string;
    url: string;
    category: 'OFFICIAL' | 'RESEARCH' | 'DOCUMENTATION';
    estimatedTrust: TrustLevel;
    pillar: 'LOGOS' | 'ETHOS' | 'PATHOS';
  };
  rationale: {
    fillsGaps: string[];          // Gap IDs this would address
    relevance: number;            // 0-1
    quality: number;              // 0-1
    accessibility: string;        // "Free", "Paid", "Requires subscription"
  };
  risk: {
    userGenerated: boolean;
    requiresPaywall: boolean;
    unknownReputation: boolean;
    overallRisk: number;          // 0-1
  };
  recommendation: 'approve' | 'review_carefully' | 'reject';
}

export async function discoverSources(
  gaps: KnowledgeGap[]
): Promise<SourceProposal[]> {
  const proposals: SourceProposal[] = [];
  
  for (const gap of gaps) {
    // Search for potential sources
    // NOTE: This is manual research, not automated web search
    // (automated search would require network access and risk low-quality sources)
    
    // For now: Use curated lists (operator maintains)
    const candidates = await findCandidateSources(gap);
    
    for (const candidate of candidates) {
      // Evaluate quality
      const quality = await evaluateSourceQuality(candidate);
      
      // Estimate trust tier
      const estimatedTrust = estimateTrustTier(candidate, quality);
      
      // Assess risk
      const risk = assessIntegrationRisk(candidate);
      
      proposals.push({
        proposedSource: {
          name: candidate.name,
          url: candidate.url,
          category: candidate.category,
          estimatedTrust,
          pillar: gap.pillar || 'LOGOS',
        },
        rationale: {
          fillsGaps: [gap.id],
          relevance: quality.relevance,
          quality: quality.overall,
          accessibility: candidate.accessibility,
        },
        risk,
        recommendation: determineRecommendation(quality, risk),
      });
    }
  }
  
  return proposals.sort((a, b) => b.rationale.quality - a.rationale.quality);
}
```

**Approval Flow**:
```bash
$ ari cognition review-proposals

Source Proposals: 3 pending

[1/3] MIT Supply Chain Management Research
URL: https://mitscm.edu/research
Category: RESEARCH
Estimated Trust: VERIFIED
Pillar: LOGOS

Fills Gaps:
  - gap_supply_chain_risk (severity: high)

Quality: 0.92 (excellent)
Risk: 0.08 (low - official university source)

Recommendation: APPROVE

[a] Approve - Add to knowledge sources
[r] Reject - Don't add
[d] Defer - Decide later

Your choice: a

✓ Source approved and added to knowledge-sources.ts
  Next knowledge fetch (tomorrow 8 AM) will include this source.
```

---

## Stage 4: Knowledge Integration (Daily)

### Purpose

Fetch and index new content from approved sources.

### Implementation

**Extends**: Existing [`knowledge-fetcher.ts`](../../src/autonomous/knowledge-fetcher.ts)

**Process**:
1. **Fetch** from all enabled sources (respects `updateFrequency`)
2. **Validate** through 5-stage pipeline (ADR-011)
3. **Index** in TF-IDF search ([`knowledge-index.ts`](../../src/autonomous/knowledge-index.ts))
4. **Update** Council member specializations (load new knowledge for their domains)

**Scheduled**: Daily 8 AM (existing `knowledge_index` task)

**Auto-Approval**:
- **VERIFIED sources**: Auto-integrate (high trust)
- **STANDARD sources**: Auto-integrate after validation
- **UNTRUSTED sources**: Queue for human review

**Metrics Tracked**:
```typescript
interface IntegrationMetrics {
  sourcesFetched: number;
  documentsAdded: number;
  validationFailures: number;
  humanReviewQueued: number;
  successRate: number;            // 0-1
}
```

**Notification**: If success rate < 80%, alert Operator (possible source issues).

---

## Stage 5: Self-Assessment (Monthly)

### Purpose

Measure if learning is actually improving ARI's performance.

### Implementation

**File**: `src/cognition/learning/self-assessment.ts`

```typescript
export interface SelfAssessment {
  period: {
    start: Date;
    end: Date;
    previousPeriod: { start: Date; end: Date };
  };
  
  decisionQuality: {
    thisPeriod: number;           // Success rate 0-1
    lastPeriod: number;
    change: number;               // Delta
    trend: 'improving' | 'declining' | 'stable';
  };
  
  biasReduction: {
    biasesThisPeriod: number;
    biasesLastPeriod: number;
    reduction: number;            // Should be negative (fewer biases)
    mostCommonBias: CognitiveBias;
  };
  
  knowledgeGrowth: {
    documentsAdded: number;
    sourcesAdded: number;
    queriesAnswered: number;      // Queries with good results
    querySuccessRate: number;     // Improved?
  };
  
  learningVelocity: {
    insightsPerWeek: number;
    principlesExtracted: number;
    transferLearnings: number;    // Insights that generalized
  };
  
  frameworkEffectiveness: Array<{
    framework: string;
    usageCount: number;
    successRate: number;          // When this framework was used
    impact: number;               // How much did it improve decisions?
  }>;
  
  overallImprovement: number;     // Composite score: 0-1
  grade: 'A' | 'B' | 'C' | 'D' | 'F'; // Letter grade
  recommendations: string[];
}

export async function runSelfAssessment(
  thisPeriod: { start: Date; end: Date },
  lastPeriod: { start: Date; end: Date }
): Promise<SelfAssessment> {
  // 1. Get performance reviews for both periods
  const thisPerf = await aggregatePerformance(thisPeriod);
  const lastPerf = await aggregatePerformance(lastPeriod);
  
  // 2. Compare decision quality
  const qualityChange = thisPerf.successRate - lastPerf.successRate;
  
  // 3. Compare bias rates
  const biasChange = thisPerf.biasCount - lastPerf.biasCount;
  
  // 4. Measure knowledge growth
  const knowledgeGrowth = await measureKnowledgeGrowth(thisPeriod);
  
  // 5. Calculate learning velocity
  const velocity = await calculateLearningVelocity(thisPeriod);
  
  // 6. Assess framework effectiveness
  const frameworks = await assessFrameworks(thisPeriod);
  
  // 7. Composite improvement score
  const improvement = calculateCompositeImprovement({
    qualityChange,
    biasReduction: -biasChange, // Negative is good
    knowledgeGrowth,
    learningVelocity: velocity,
  });
  
  // 8. Generate recommendations
  const recommendations = generateImprovementRecommendations({
    qualityChange,
    biasChange,
    frameworks,
  });
  
  return {
    period: { thisPeriod, lastPeriod },
    decisionQuality: { thisPeriod: thisPerf.successRate, lastPeriod: lastPerf.successRate, change: qualityChange },
    biasReduction: { reduction: biasChange },
    knowledgeGrowth,
    learningVelocity: velocity,
    frameworkEffectiveness: frameworks,
    overallImprovement: improvement,
    grade: scoreToGrade(improvement),
    recommendations,
  };
}

function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 0.90) return 'A'; // Excellent improvement
  if (score >= 0.75) return 'B'; // Good improvement
  if (score >= 0.60) return 'C'; // Moderate improvement
  if (score >= 0.50) return 'D'; // Minimal improvement
  return 'F';                     // No improvement or decline
}
```

**Report Format**:
```
═══════════════════════════════════════════════════════════
ARI SELF-ASSESSMENT: January 2026
═══════════════════════════════════════════════════════════

OVERALL GRADE: B+ (0.82/1.00)

Decision Quality:
  This Month: 87.5% success rate
  Last Month: 79.2% success rate
  Change: +8.3% ↑ (IMPROVING)

Bias Reduction:
  This Month: 12 biases detected
  Last Month: 23 biases detected
  Reduction: -11 biases ↓ (IMPROVING)
  Most Common: Recency Bias (4 occurrences)

Knowledge Growth:
  Documents Added: 127
  Sources Added: 3 (MIT Supply Chain, CBT Institute, Stoicism Today)
  Query Success Rate: 89% (up from 78%)

Learning Velocity:
  Insights/Week: 8.2 (target: 5+)
  Principles Extracted: 15
  Transfer Learnings: 7 (applied across domains)

Top Framework Effectiveness:
  1. Kelly Criterion: 94% success when used (12 uses)
  2. Bayesian Updating: 91% success when used (18 uses)
  3. CBT Reframing: 88% success when used (8 uses)
  4. Bias Detection: 85% success when used (34 uses)
  5. Stoic Dichotomy: 82% success when used (11 uses)

Recommendations for February:
  1. Continue using Kelly Criterion for financial decisions (high effectiveness)
  2. Address Recency Bias (most common - implement recency check in discipline)
  3. Add source for supply chain risk (gap identified)
  4. Practice Stoic techniques more (low usage, high success rate)

VERDICT: Strong improvement. Keep current trajectory.
═══════════════════════════════════════════════════════════
```

**Distribution**:
- Saved to `~/.ari/cognition/assessment/2026-01.json`
- Notification to Operator (monthly report ready)
- Optionally: Include in monthly newsletter/summary

---

## Approval Workflows

### What Requires Human Approval?

| Action | Auto-Approve? | Rationale |
|--------|---------------|-----------|
| **Performance review** | ✅ Yes | Read-only analysis |
| **Gap analysis** | ✅ Yes | Proposes, doesn't change |
| **Add VERIFIED source** | ⚠️ Usually | If from known institution (Stanford, Anthropic), yes. If new institution, review. |
| **Add STANDARD source** | ❌ No | Requires quality evaluation |
| **Add UNTRUSTED source** | ❌ No | Always requires review |
| **Fetch from VERIFIED** | ✅ Yes | Auto-integrate |
| **Fetch from STANDARD** | ✅ Yes | Auto-integrate after validation |
| **Fetch from UNTRUSTED** | ❌ No | Queue for human review |
| **Update specialization** | ⚠️ Minor changes yes, major no | Small additions auto-approve, restructuring requires review |
| **Update framework** | ❌ No | Any framework logic changes require review |

### Approval CLI

```bash
$ ari cognition pending-approvals

Pending Approvals: 5 items

[SOURCES] 2 new sources proposed
[CONTENT] 3 UNTRUSTED items fetched, pending review
[FRAMEWORKS] 0 framework updates

Review sources? [y/N]: y

─────────────────────────────────────────────────────────
[1/2] Source: Trading Psychology Institute
URL: https://trading-psych.org
Trust: STANDARD
Pillar: ETHOS
Fills Gaps: gap_revenge_trading, gap_emotional_regulation

Sample Content:
"Revenge trading occurs when traders increase position size after a loss..."

Quality Assessment:
  - Author: PhD in Psychology ✓
  - Peer reviewed: No ✗
  - Citations provided: Yes ✓
  - Bias score: 0.22 (low)
  - Accessibility: Free

Recommendation: APPROVE (reputable, but monitor quality)

[a] Approve
[r] Reject
[e] Edit details first
[d] Defer

Your choice: a

✓ Approved. Will fetch starting tomorrow.

─────────────────────────────────────────────────────────
```

---

## Respects ADR-008 (RL Deferred)

### What This Does (Allowed)

✅ **Supervised learning**:
- Analyzes performance (read-only)
- Identifies gaps (proposes sources)
- Fetches approved sources (human approves)
- Measures improvement (reports to human)

✅ **Human-in-the-loop**:
- Operator approves new sources
- Operator reviews UNTRUSTED content
- Operator approves major changes
- Operator can override any decision

✅ **Transparent**:
- All learning logged in audit chain
- Reports generated monthly
- Operator always knows what's happening

### What This Doesn't Do (Deferred to Phase 3+)

❌ **Autonomous self-modification**:
- Doesn't automatically change framework logic
- Doesn't automatically adjust Council member weights
- Doesn't autonomously add sources (proposes only)

❌ **Reinforcement learning**:
- Doesn't use reward signals to optimize
- Doesn't update decision weights autonomously
- Doesn't train models on outcomes

❌ **Autonomous experimentation**:
- Doesn't A/B test different strategies
- Doesn't try new frameworks without approval

**Boundary**: System can **measure** and **propose**, but cannot **change** without human approval.

---

## Storage Structure

### Learning Data Organization

```
~/.ari/cognition/
├── performance/                  # Stage 1: Daily performance reviews
│   ├── 2026-02-01.json
│   ├── 2026-02-02.json
│   └── ...
├── gaps/                         # Stage 2: Weekly gap analyses
│   ├── 2026-W05.json            # Week 5 of 2026
│   ├── 2026-W06.json
│   └── ...
├── proposals/                    # Stage 3: Source proposals
│   ├── pending.json             # Awaiting approval
│   └── approved.json            # Historical approvals
├── sources/                      # Stage 4: Integrated knowledge
│   ├── logos/
│   ├── ethos/
│   └── pathos/
├── assessment/                   # Stage 5: Monthly self-assessments
│   ├── 2026-01.json
│   ├── 2026-02.json
│   └── ...
└── learning-log.json             # Aggregate: All learning events
```

---

## Performance Considerations

### Computational Cost

**Daily Performance Review**:
- Query audit log: ~100ms (scan last 24h)
- Analyze 10-50 decisions: ~500ms
- Generate insights: ~200ms
- **Total**: <1 second (acceptable for daily 9 PM task)

**Weekly Gap Analysis**:
- Query audit log: ~500ms (scan 7 days)
- Analyze 50-300 decisions: ~2 seconds
- Identify gaps: ~1 second
- Search for sources: Manual (not automated)
- **Total**: <5 seconds (acceptable for weekly Sunday task)

**Monthly Self-Assessment**:
- Aggregate 30 days of reviews: ~3 seconds
- Calculate metrics: ~2 seconds
- Generate report: ~1 second
- **Total**: <10 seconds (acceptable for monthly task)

### Storage Growth

**Per Day**:
- Performance review: ~10 KB
- Knowledge integration: ~500 KB (new documents)

**Per Month**:
- Performance reviews: ~300 KB (30 days)
- Gap analysis: ~40 KB (4 weeks)
- Self-assessment: ~20 KB
- Knowledge: ~15 MB (500 KB × 30 days)

**Per Year**:
- Performance: ~3.6 MB
- Gaps: ~2 MB
- Assessments: ~240 KB
- Knowledge: ~180 MB

**Mitigation**: Archive content >90 days old, compress to `~/.ari/cognition/archive/YYYY.tar.gz`

---

## Success Metrics

### After 30 Days

- ✅ 30 performance reviews completed
- ✅ 4 gap analyses completed
- ✅ 1 self-assessment completed
- ✅ 80+ sources being fetched daily
- ✅ Knowledge base grown by 15+ MB
- ✅ >= 5 gaps identified
- ✅ >= 2 new sources added (operator-approved)

### After 90 Days

- ✅ Decision quality improved by >= 5% (vs baseline)
- ✅ Bias rate reduced by >= 30% (fewer biases detected)
- ✅ Knowledge base contains 1000+ documents
- ✅ Query success rate > 90% (most queries find relevant knowledge)
- ✅ Learning velocity >= 5 insights/week

### After 6 Months

- ✅ Decision quality >= 85% (target)
- ✅ Bias rate < 10% (target)
- ✅ All 15 Council members using cognitive APIs regularly (>10/day)
- ✅ Measurable improvement in all Council members' decisions
- ✅ Knowledge base self-sustaining (gaps identified → sources added → gaps filled)

---

## Alternatives Considered

### 1. Fully Autonomous Learning (No Human Approval)

**Description**: System automatically adds sources, integrates content, updates frameworks based on performance.

**Pros**: Fastest learning, no human bottleneck

**Cons**:
- **Violates ADR-008** (RL deferred)
- **Security risk** (could integrate malicious sources)
- **Alignment risk** (could optimize for wrong metrics)
- **Loss of control** (humans unaware of changes)

**Rejected**: Too risky. ADR-008 explicitly defers autonomous self-modification.

---

### 2. Manual Learning Only (No Automation)

**Description**: Operator manually reviews performance, manually identifies gaps, manually adds sources.

**Pros**: Complete human control, zero automation risk

**Cons**:
- **Slow** (human bottleneck for everything)
- **Inconsistent** (depends on operator availability)
- **Misses patterns** (humans can't analyze 1000s of decisions)
- **Doesn't scale** (operator effort grows linearly with decisions)

**Rejected**: Too slow. Automation handles analysis, human handles judgment.

---

### 3. Reinforcement Learning (Optimize via Rewards)

**Description**: Define reward function (success = +1, failure = -1), use RL to optimize Council member behavior.

**Pros**: State-of-the-art ML, automatic optimization, proven in games/robotics

**Cons**:
- **Violates ADR-008** (RL deferred to Phase 3+)
- **Reward hacking** (Goodhart's Law - optimize metric, not goal)
- **Alignment difficulty** (hard to define "good decision" reward)
- **Black box** (hard to explain why RL agent made decision)
- **Requires infrastructure** (training loop, model storage, hyperparameter tuning)

**Deferred to Phase 3+**: Good future direction, but premature for Phase 2.

---

## References

- **ADR-008**: RL Deferred ([`DECISIONS.md`](../DECISIONS.md))
- **Scheduler**: [`src/autonomous/scheduler.ts`](../../src/autonomous/scheduler.ts)
- **Knowledge Fetcher**: [`src/autonomous/knowledge-fetcher.ts`](../../src/autonomous/knowledge-fetcher.ts)
- **Audit Log**: [`src/kernel/audit.ts`](../../src/kernel/audit.ts)

---

**Last Updated**: 2026-02-01  
**Status**: PROPOSED  
**Dependencies**: ADR-008, ADR-009, ADR-011  
**Implementation**: Phases 0-6 of roadmap (weeks 1-14)

---

## Appendix: Sample Learning Cycle

### Week 1

**Monday**: MINT makes investment decision using Kelly Criterion
- Decision: Invest $2,000 (20% of capital)
- Expected value: +$400
- Kelly fraction: 0.20 (half-Kelly)

**Friday**: Outcome known
- Actual value: +$350 (close to expected)
- Result: SUCCESS

**Sunday 8 PM**: Gap analysis runs
- No gaps (Kelly Criterion worked well)
- Note: Kelly accuracy high (expected $400, got $350 = 87.5% accurate)

**Sunday 9 PM**: Performance review runs
- Week's success rate: 85% (6/7 decisions successful)
- Kelly Criterion effectiveness: 100% (1/1 success)
- Recommendation: "Kelly working well, continue using"

### Week 2

**Tuesday**: MINT makes investment decision
- Feels euphoric (recent win streak)
- Emotional risk: 0.72 (high)
- Discipline check: FAILED (emotional risk > 0.6)
- Recommendation: Wait 24h

**Wednesday**: MINT waits (cooling-off period), re-evaluates
- Emotional risk: 0.28 (normalized)
- Discipline check: PASSED
- Proceeds with Kelly-sized bet
- Outcome: SUCCESS (avoided emotional over-bet)

**Sunday 8 PM**: Gap analysis runs
- No gaps
- Note: Emotional risk detection prevented mistake (valuable)

**Sunday 9 PM**: Performance review runs
- Week's success rate: 100% (5/5 decisions successful)
- Discipline system effectiveness: 100% (prevented 1 emotional mistake)
- Insight: "Cooling-off period after wins prevents greed chase"
- Store insight in memory for future reference

### Month End (Feb 1, 9 AM)

**Self-Assessment Runs**:
- January success rate: 87.5% (vs December: 79.0%)
- Improvement: +8.5% ↑
- Biases detected: 15 (vs December: 28)
- Reduction: -13 biases
- Overall grade: B+ (0.82)
- Recommendation: "Strong month. Kelly + discipline system working well. Continue current approach."

**Operator Reviews**:
- Reads report: "This is good progress"
- No changes needed: System is improving as intended

**Result**: Learning loop is functional and effective.

---

**Last Updated**: 2026-02-01  
**Complete**: All 6 ADRs now documented
