# 24/7 Autonomous ARI - Implementation Checklist

**Start Date:** February 3, 2026  
**Target Completion:** February 13, 2026 (10 days)  
**Budget Profile:** Balanced ($75/month)  
**Expected Outcome:** Production-ready 24/7 autonomous system

---

## Pre-Implementation

### Decision Made
- [x] Budget profile selected: **Balanced**
- [ ] Timeline confirmed: **10-day phased rollout**
- [ ] Implementation team: **Pryce + Claude**
- [ ] Success criteria reviewed and accepted
- [ ] Risk assessment reviewed and accepted

### Environment Prepared
- [ ] Mac Mini accessible via SSH (ari@100.81.73.34)
- [ ] Anthropic API key ready
- [ ] Telegram bot credentials (TELEGRAM_BOT_TOKEN + TELEGRAM_OWNER_USER_ID)
- [ ] GitHub repo access verified
- [ ] Local development environment ready
- [ ] All existing tests passing: `npm test`

---

## Phase 1: Foundation (Days 1-2) - Feb 3-4

### Task 1: TokenBudgetTracker ⏱ 4 hours

**Objective:** Build cost tracking and enforcement system

- [ ] **1.1** Create test file: `tests/unit/observability/token-budget-tracker.test.ts`
- [ ] **1.2** Write 10+ test cases covering:
  - [ ] Budget initialization
  - [ ] Usage recording
  - [ ] Cost calculation for each model
  - [ ] Throttling at 80%, 95%, 100%
  - [ ] Daily reset
  - [ ] Status reporting
- [ ] **1.3** Run tests, verify all fail
- [ ] **1.4** Implement: `src/observability/token-budget-tracker.ts`
- [ ] **1.5** Run tests, verify all pass
- [ ] **1.6** Update exports in `src/observability/index.ts`
- [ ] **1.7** Commit with message: "feat(observability): add TokenBudgetTracker"
- [ ] **1.8** Manual testing:
  ```bash
  node -e "const {TokenBudgetTracker} = require('./dist/observability/token-budget-tracker.js'); const t = new TokenBudgetTracker({dailyMaxTokens: 100000, dailyMaxCost: 1.0, reservedForUser: 50000}); console.log(t.getStatus());"
  ```

**Completion Criteria:**
- [✓] All tests passing
- [✓] Manual test successful
- [✓] TypeScript compiles without errors
- [✓] No lint errors

---

### Task 2: ModelRouter ⏱ 4 hours

**Objective:** Build intelligent model selection system

- [ ] **2.1** Create test file: `tests/unit/execution/model-router.test.ts`
- [ ] **2.2** Write 15+ test cases covering:
  - [ ] Task profiling (complexity assessment)
  - [ ] Creativity assessment
  - [ ] Risk assessment
  - [ ] Model selection for each complexity level
  - [ ] Override rules (security → Opus)
  - [ ] Cost estimation
- [ ] **2.3** Run tests, verify all fail
- [ ] **2.4** Implement: `src/execution/model-router.ts`
- [ ] **2.5** Run tests, verify all pass
- [ ] **2.6** Update exports in `src/execution/index.ts`
- [ ] **2.7** Commit with message: "feat(execution): add ModelRouter"
- [ ] **2.8** Manual testing:
  ```bash
  node -e "const {ModelRouter} = require('./dist/execution/model-router.js'); const r = new ModelRouter(); console.log(r.routeTask({type: 'test-generation', description: 'Write tests'}));"
  ```

**Completion Criteria:**
- [✓] All tests passing
- [✓] Routing logic validated
- [✓] Cost estimates accurate
- [✓] No lint errors

---

### Task 3: ClaudeClient Integration ⏱ 3 hours

**Objective:** Integrate budget tracking and model routing into Claude API client

- [ ] **3.1** Update test file: `tests/unit/autonomous/claude-client.test.ts`
- [ ] **3.2** Add budget integration tests
- [ ] **3.3** Add model routing tests
- [ ] **3.4** Modify: `src/autonomous/claude-client.ts`
  - [ ] Add budgetTracker parameter
  - [ ] Add modelRouter parameter
  - [ ] Add pre-call budget check
  - [ ] Add post-call usage recording
  - [ ] Add automatic model selection
- [ ] **3.5** Run tests, verify all pass
- [ ] **3.6** Commit: "feat(autonomous): integrate budget tracking with ClaudeClient"

**Completion Criteria:**
- [✓] Budget checks happen before every API call
- [✓] Usage recorded after every API call
- [✓] Model automatically selected when appropriate
- [✓] Tests passing

---

### Day 1 End-of-Day Checkpoint

**Expected Status:**
- [✓] 3 tasks completed
- [✓] Core components built and tested
- [✓] ~11 hours work completed
- [✓] All tests passing
- [✓] Ready for integration phase

**Metrics:**
- Files created: 6
- Tests written: 25+
- Lines of code: ~1,000
- Test coverage: 100% on new components

---

## Phase 2: Integration (Days 3-4) - Feb 5-6

### Task 4: Autonomous Agent Integration ⏱ 3 hours

**Objective:** Make autonomous agent budget-aware

- [ ] **4.1** Update: `src/autonomous/agent.ts`
  - [ ] Add TokenBudgetTracker property
  - [ ] Add ModelRouter property
  - [ ] Initialize in constructor
  - [ ] Pass to ClaudeClient in init()
  - [ ] Add budget check in poll loop
  - [ ] Add adaptive throttling logic
- [ ] **4.2** Update tests: `tests/unit/autonomous/agent.test.ts`
- [ ] **4.3** Run tests
- [ ] **4.4** Commit: "feat(autonomous): integrate budget awareness"

**Completion Criteria:**
- [✓] Agent respects budget limits
- [✓] Throttling activates at thresholds
- [✓] Tests passing

---

### Task 5: Smart Scheduler ⏱ 3 hours

**Objective:** Add model hints and budget awareness to scheduler

- [ ] **5.1** Update: `src/autonomous/scheduler.ts`
  - [ ] Add SmartScheduledTask interface
  - [ ] Update DEFAULT_TASKS with model hints and estimates
  - [ ] Add budget checking to checkAndRun()
  - [ ] Add task skipping when budget low
  - [ ] Add dependency support
- [ ] **5.2** Update tests
- [ ] **5.3** Run tests
- [ ] **5.4** Commit: "feat(scheduler): add smart scheduling with budget awareness"

**Completion Criteria:**
- [✓] Tasks have model hints
- [✓] Budget checked before execution
- [✓] Low-priority tasks skipped when budget tight

---

### Task 6: Dashboard Budget Panel ⏱ 4 hours

**Objective:** Real-time budget visibility

- [ ] **6.1** Create: `dashboard/src/components/BudgetPanel.tsx`
- [ ] **6.2** Add API endpoint: `/api/budget/status` in `src/api/routes.ts`
- [ ] **6.3** Integrate into: `dashboard/src/pages/Home.tsx`
- [ ] **6.4** Test locally with mock data
- [ ] **6.5** Commit: "feat(dashboard): add real-time budget panel"

**Completion Criteria:**
- [✓] Panel shows real-time usage
- [✓] Updates every 30 seconds
- [✓] Color-coded status
- [✓] Top consumers visible

---

### Day 3-4 End Checkpoint

**Expected Status:**
- [✓] 3 more tasks completed (6 total)
- [✓] Integration complete
- [✓] Dashboard functional
- [✓] ~10 hours work completed
- [✓] Ready for enhancement phase

---

## Phase 3: Enhancement (Days 5-6) - Feb 7-8

### Task 7: Initiative Engine Enhancement ⏱ 4 hours

**Objective:** Add enhanced scoring and safety gates

- [ ] **7.1** Create: `src/autonomous/initiative-scorer.ts`
- [ ] **7.2** Add enhanced scoring logic
- [ ] **7.3** Update: `src/autonomous/initiative-engine.ts`
  - [ ] Add cost tracking per initiative
  - [ ] Add safety gate integration
  - [ ] Add execution decision matrix
- [ ] **7.4** Tests and commit

**Completion Criteria:**
- [✓] Initiatives have cost estimates
- [✓] Safety gates block risky work
- [✓] Execution decisions based on risk/cost

---

### Task 8: Approval Queue ⏱ 3 hours

**Objective:** Queue system for user decisions

- [ ] **8.1** Create: `src/autonomous/approval-queue.ts`
- [ ] **8.2** Write comprehensive tests
- [ ] **8.3** Implement approval/reject logic
- [ ] **8.4** Add persistence
- [ ] **8.5** Commit

**Completion Criteria:**
- [✓] Items can be queued
- [✓] Approve/reject working
- [✓] Persists across restarts

---

### Task 9: Worktree Execution Safety ⏱ 3 hours

**Objective:** Ensure all code changes in isolated branches

- [ ] **9.1** Update: `src/autonomous/initiative-engine.ts`
- [ ] **9.2** Add worktree spawning for code initiatives
- [ ] **9.3** Add validation before execution
- [ ] **9.4** Add cleanup after completion
- [ ] **9.5** Test and commit

**Completion Criteria:**
- [✓] All code changes in worktrees
- [✓] Main branch never touched
- [✓] Easy rollback available

---

## Phase 4: Deliverables (Days 7-8) - Feb 9-10

### Task 10: Daily Brief Generator ⏱ 4 hours

**Objective:** Morning sync deliverable

- [ ] **10.1** Create: `src/autonomous/deliverables/daily-brief.ts`
- [ ] **10.2** Implement brief generation logic
- [ ] **10.3** Add formatting
- [ ] **10.4** Integrate with scheduler
- [ ] **10.5** Test and commit

**Completion Criteria:**
- [✓] Brief generates successfully
- [✓] Contains all required sections
- [✓] Saves to file
- [✓] Notification sent

---

### Task 11: Evening Summary ⏱ 3 hours

**Objective:** Daily wrap-up with approval queue

- [ ] **11.1** Create: `src/autonomous/deliverables/evening-summary.ts`
- [ ] **11.2** Implement summary generation
- [ ] **11.3** Include approval queue items
- [ ] **11.4** Integrate with scheduler
- [ ] **11.5** Test and commit

**Completion Criteria:**
- [✓] Summary includes day's work
- [✓] Approval queue visible
- [✓] Cost breakdown included

---

### Task 12: Dashboard Enhancement ⏱ 3 hours

**Objective:** Complete dashboard with all panels

- [ ] **12.1** Create: `dashboard/src/components/AutonomousWorkPanel.tsx`
- [ ] **12.2** Create: `dashboard/src/components/ApprovalQueuePanel.tsx`
- [ ] **12.3** Update: `dashboard/src/pages/Autonomy.tsx`
- [ ] **12.4** Add API endpoints
- [ ] **12.5** Test and commit

**Completion Criteria:**
- [✓] All panels functional
- [✓] Real-time updates
- [✓] Responsive design

---

## Phase 5: Deployment (Days 9-10) - Feb 11-12

### Task 13: Mac Mini Sync ⏱ 1 hour

**Objective:** Get Mac Mini up to date

- [ ] **13.1** Run: `./scripts/sync-mac-mini.sh`
- [ ] **13.2** Verify sync: Compare commits
- [ ] **13.3** Run diagnostics on Mini
- [ ] **13.4** Verify all tests pass on Mini

**Completion Criteria:**
- [✓] Mac Mini at same commit as local
- [✓] All dependencies installed
- [✓] Build successful
- [✓] Tests passing

---

### Task 14: Configuration Deployment ⏱ 2 hours

**Objective:** Deploy budget configuration

- [ ] **14.1** Choose profile: Balanced
- [ ] **14.2** Run: `./scripts/deploy-autonomous.sh balanced`
- [ ] **14.3** Verify budget config deployed
- [ ] **14.4** Verify autonomous config updated
- [ ] **14.5** Check daemon restart successful

**Completion Criteria:**
- [✓] Budget config in place
- [✓] Autonomous mode enabled
- [✓] Daemon running with new code

---

### Task 15: 24-Hour Monitoring ⏱ Overnight + 2 hours

**Objective:** Validate system works end-to-end

**Evening (Day 9):**
- [ ] **15.1** Start monitoring: `./scripts/monitor-mac-mini.sh`
- [ ] **15.2** Verify first scheduled tasks run
- [ ] **15.3** Check budget tracking working
- [ ] **15.4** Review audit log

**Overnight:**
- [ ] **15.5** Let system run autonomously
- [ ] **15.6** Initiative scan at 6:00 AM
- [ ] **15.7** Morning brief generation at 7:00 AM
- [ ] **15.8** Daily brief delivery at 7:30 AM

**Morning (Day 10):**
- [ ] **15.9** Read morning brief
- [ ] **15.10** Verify overnight work completed
- [ ] **15.11** Check budget usage
- [ ] **15.12** Review audit log for issues

**Expected Metrics:**
```
Overnight Cost: ~$0.20-0.30
Tasks Completed: 2-4
Morning Brief: Delivered by 7:30 AM
Issues: 0-1 minor issues expected
```

**Completion Criteria:**
- [✓] Morning brief delivered on time
- [✓] Budget tracking accurate
- [✓] Autonomous work completed
- [✓] No critical errors

---

### Task 16: First Week Validation ⏱ 1 hour/day × 7 days

**Objective:** Monitor and tune for one week

**Daily Checklist:**
```
Day 1-7:
- [ ] Morning brief received and read (2 min)
- [ ] Budget check (1 min)
- [ ] Review overnight work (2 min)
- [ ] Process approvals if any (3 min)
- [ ] Evening summary review (5 min)
- [ ] Log any issues or improvements needed

Daily time: ~13 minutes
```

**End of Week Analysis:**
```
Metrics to Collect:
├─ Total cost: $_____ (target: < $17.50)
├─ Tasks completed: _____ (target: > 70)
├─ Briefs on time: ___/7 (target: 7/7)
├─ Budget adherence: ___/7 days under limit
├─ User satisfaction: ___/5
└─ Issues encountered: _____

Tuning Needed:
├─ Model routing: _____
├─ Schedule timing: _____
├─ Budget limits: _____
├─ Initiative scoring: _____
└─ Other: _____
```

**Completion Criteria:**
- [✓] 7 consecutive days operational
- [✓] Average cost < $2/day
- [✓] Morning briefs 100% on time
- [✓] User satisfied with deliverables

---

## Post-Implementation

### Week 2: Optimization

**Tasks:**
- [ ] Analyze Week 1 data
- [ ] Identify top 3 cost drivers
- [ ] Tune model routing based on actual usage
- [ ] Adjust schedule timing if needed
- [ ] Refine initiative scoring
- [ ] Update configuration
- [ ] Deploy optimizations
- [ ] Monitor for improvements

**Expected Outcome:** 10-15% cost reduction while maintaining quality

---

### Month 1: Validation

**Metrics to Track:**
```
Cost Performance:
├─ Total month: $_____ (target: < $75)
├─ Average daily: $_____ (target: $2.00-2.50)
├─ Efficiency vs Week 1: _____% (target: +15%)
└─ Budget overruns: _____ (target: 0)

Task Performance:
├─ Total tasks: _____ (target: > 300)
├─ Success rate: _____% (target: > 85%)
├─ Tests added: _____ (target: > 40)
├─ TODOs resolved: _____ (target: > 60)
└─ Docs updated: _____ (target: > 5)

User Experience:
├─ Briefs on time: _____/30 (target: 30/30)
├─ Approval queue avg: _____ (target: < 5)
├─ Time saved: _____ hours (target: > 60)
└─ Satisfaction: ___/5 (target: 4+)
```

**Review Meeting (End of Month):**
- [ ] Review all metrics
- [ ] Identify successes
- [ ] Identify issues
- [ ] Decide: Continue, Adjust, or Pause?
- [ ] Plan Month 2 optimizations

---

## Quality Gates

### Before Moving to Next Phase

**Phase 1 → Phase 2:**
- [✓] All Phase 1 tests passing
- [✓] Manual testing successful
- [✓] No critical bugs
- [✓] Code reviewed

**Phase 2 → Phase 3:**
- [✓] Integration tests passing
- [✓] Budget tracking working in agent
- [✓] Scheduler budget-aware
- [✓] Dashboard functional

**Phase 3 → Phase 4:**
- [✓] Initiative engine enhanced
- [✓] Safety gates operational
- [✓] Approval queue working
- [✓] Worktree isolation tested

**Phase 4 → Phase 5:**
- [✓] Deliverables generating correctly
- [✓] Dashboard complete
- [✓] All tests passing
- [✓] Ready for production

**Phase 5 → Production:**
- [✓] Mac Mini deployed
- [✓] 24 hours successful operation
- [✓] Morning brief delivered
- [✓] Budget under control
- [✓] User satisfied

---

## Rollback Plan

### If Things Go Wrong

**Scenario 1: Phase 1-4 Issues (Before Deployment)**

```
Action: Fix bugs, don't deploy yet
Risk: Zero (not in production)
Recovery: Debug and test locally
```

**Scenario 2: Deployment Issues (Phase 5)**

```
Action: Immediate rollback
Steps:
1. Stop daemon on Mac Mini
2. Revert to previous commit
3. Rebuild and restart
4. Verify stable operation
Recovery time: 10 minutes
```

**Scenario 3: Production Issues (After Deployment)**

```
Action: Disable autonomous mode
Steps:
1. ssh ari@100.81.73.34 "npx ari daemon stop"
2. Investigate root cause
3. Fix and test locally
4. Re-deploy when confident
Recovery time: Hours to days (depending on issue)
```

**Worst Case: Complete Rollback**

```
1. Stop daemon
2. Restore .ari directory from backup
3. Checkout previous stable commit
4. Rebuild and restart
5. Back to current state (idle but stable)
Time: 30 minutes
```

---

## Communication Plan

### Daily Updates (During Implementation)

**Format:**
```
End of Day Update:
├─ Tasks completed: X/Y
├─ Hours worked: Z
├─ Issues encountered: [list]
├─ Tomorrow's plan: [list]
└─ On track: Yes/No
```

**Audience:** Yourself (for tracking progress)

### Weekly Summary (After Week 1)

**Format:**
```
Week 1 Summary:
├─ Implementation: Complete/Partial
├─ Deployment: Successful/Failed
├─ Cost performance: $X vs $Y target
├─ Task performance: X tasks vs Y target
├─ Quality: X/5 satisfaction
├─ Issues: [list]
└─ Next steps: [list]
```

**Audience:** Review for optimization decisions

### Monthly Review (After Month 1)

**Format:**
```
Month 1 Comprehensive Review:
├─ Financial: Total cost, ROI, efficiency
├─ Productivity: Tasks, time saved, quality
├─ Technical: Performance, reliability, errors
├─ Strategic: Continue, adjust, or pause?
└─ Roadmap: Next month's focus
```

**Audience:** Strategic decision making

---

## Dependencies

### External

- [ ] Anthropic API access (Claude 3 family)
- [ ] Anthropic API key with billing enabled
- [ ] SSH access to Mac Mini (ari@100.81.73.34)
- [ ] Telegram bot (TELEGRAM_BOT_TOKEN + TELEGRAM_OWNER_USER_ID)
- [ ] Tailscale for remote access (already set up)

### Internal

- [ ] ARI codebase at latest commit
- [ ] All existing tests passing
- [ ] TypeScript 5.3+
- [ ] Node.js 20+
- [ ] npm dependencies installed

### Human

- [ ] Time: 40 hours over 10 days
- [ ] Focus: Dedicated implementation time
- [ ] Patience: Iterative development and testing
- [ ] Monitoring: Daily checks during Week 1

---

## Success Definition

### Minimum Viable Success (Week 1)

```
✓ Mac Mini running autonomously
✓ Budget tracking working
✓ Model routing functional
✓ Morning brief delivered 5+/7 days
✓ Cost under $20 for the week
✓ No critical failures
```

### Good Success (Month 1)

```
✓ All Week 1 criteria met
✓ 300+ autonomous tasks completed
✓ Monthly cost $50-70
✓ Morning briefs 28+/30 days
✓ Test coverage increased
✓ User highly satisfied
```

### Exceptional Success (Month 3)

```
✓ All Month 1 criteria met
✓ Cost down to $40-55/month (efficiency gains)
✓ 1,000+ tasks completed over 3 months
✓ Zero manual intervention needed
✓ Self-optimizing and improving
✓ Indispensable tool in daily workflow
```

---

## Final Checklist Before Starting

### Documentation Review

- [ ] Read: `docs/AUTONOMOUS_EXECUTIVE_SUMMARY.md`
- [ ] Read: `docs/architecture/24-7-autonomous-architecture.md`
- [ ] Read: `docs/analysis/cost-benefit-analysis.md`
- [ ] Read: `docs/plans/2026-02-03-24-7-autonomous-ari-with-cost-management.md`
- [ ] Understand: Complete system architecture
- [ ] Understand: Cost model and budget strategy
- [ ] Understand: Implementation approach

### Decision Confirmation

- [ ] Budget profile: **Balanced** ($75/month)
- [ ] Timeline: **10 days** (phased rollout)
- [ ] Deployment target: **Mac Mini** (100.81.73.34)
- [ ] Start date: **February 3, 2026**
- [ ] Target completion: **February 13, 2026**

### Commitment

- [ ] I have 40 hours available over next 10 days
- [ ] I will monitor daily during Week 1
- [ ] I understand the risks and mitigations
- [ ] I'm prepared to tune and optimize
- [ ] I'm excited to see ARI come alive

---

## How to Use This Checklist

**During Implementation:**
1. Work through tasks sequentially
2. Check off sub-tasks as completed
3. Don't skip to next phase until all tasks done
4. Run validation at each checkpoint
5. Commit frequently (after each task)

**Progress Tracking:**
```
[ ] = Not started
[→] = In progress
[✓] = Complete
[✗] = Failed (needs retry)
[⊗] = Skipped (not needed)
```

**Time Tracking:**
Record actual time per task:
```
Task 1: Est 4h, Actual ___h
Task 2: Est 4h, Actual ___h
...
Total: Est 40h, Actual ___h
```

**Issue Tracking:**
Document blockers encountered:
```
Issue 1: [Description]
Resolution: [How you fixed it]
Time lost: ___h

Issue 2: ...
```

---

## Implementation Notes

### Best Practices

**1. Test-First Development**
- Write tests before implementation
- Verify tests fail before writing code
- Ensure tests pass after implementation
- Maintain >80% coverage

**2. Incremental Commits**
- Commit after each task
- Use conventional commit messages
- Keep commits focused and atomic
- Push to GitHub regularly

**3. Local Testing First**
- Test everything locally before deploying
- Use test data/mocks
- Verify in isolation
- Only deploy when confident

**4. Validation Gates**
- Run full test suite before each phase
- Verify no regressions
- Check TypeScript compilation
- Ensure lint passes

**5. Documentation As You Go**
- Comment complex logic
- Update README with new features
- Document configuration options
- Keep this checklist current

---

## Completion Certificate

```
┌──────────────────────────────────────────────────────┐
│     24/7 AUTONOMOUS ARI - IMPLEMENTATION COMPLETE     │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Completed by: ___________________________          │
│  Completion date: _________________________         │
│                                                      │
│  Phases completed: ___/5                            │
│  Tasks completed: ___/16                            │
│  Tests written: ___                                 │
│  Lines of code: ___                                 │
│  Time invested: ___ hours                           │
│                                                      │
│  Deployed to: Mac Mini (100.81.73.34)               │
│  Budget profile: Balanced ($75/month)               │
│  First brief delivered: ____________________        │
│  First week cost: $_____                            │
│                                                      │
│  Status: ✓ PRODUCTION READY                         │
│                                                      │
└──────────────────────────────────────────────────────┘

Signature: ___________________________ Date: __________
```

Fill this out when complete!

---

## Ready to Begin?

Everything is documented, planned, and ready. The implementation plan is comprehensive and detailed. All risks are addressed. Success metrics are defined.

**To start implementation:**

```bash
# 1. Verify you're ready
npm test  # Should pass

# 2. Create feature branch
git checkout -b feature/autonomous-24-7

# 3. Start Task 1
# Follow: docs/plans/2026-02-03-24-7-autonomous-ari-with-cost-management.md
# Or let Claude implement using the plan

# 4. Track progress in this checklist
```

**First command to run:**

```bash
# Create test file for Task 1
mkdir -p tests/unit/observability
touch tests/unit/observability/token-budget-tracker.test.ts
```

Then start writing tests as detailed in the implementation plan.

**Let's build this. 🚀**
