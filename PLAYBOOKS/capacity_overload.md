# PLAYBOOK-003: CAPACITY OVERLOAD RESPONSE
## Managing Resource Exhaustion and System Overload

**Severity:** SEV-2 to SEV-3  
**Owner:** Planner + Reliability Ops Council Member  
**Last Updated:** 2026-01-26

---

## 1. OVERVIEW

### What is Capacity Overload?
Capacity overload occurs when system demand exceeds available resources, potentially causing degraded performance, task failures, or service disruption.

### Resource Types
```
├── API Quota Resources
│   ├── LLM API calls/tokens
│   ├── Tool API rate limits
│   └── External service quotas
├── Computational Resources
│   ├── Context window utilization
│   ├── Processing time limits
│   └── Memory constraints
├── Operational Resources
│   ├── Concurrent task limits
│   ├── Queue depth limits
│   └── Operator attention bandwidth
└── Financial Resources
    ├── API cost thresholds
    ├── Budget limits
    └── Cost-per-action limits
```

---

## 2. MONITORING & THRESHOLDS

### Resource Monitoring
```yaml
monitors:
  api_quota:
    llm_tokens:
      current: {CURRENT_USAGE}
      limit: {QUOTA_LIMIT}
      period: daily
      alert_at: [50%, 75%, 90%]
      
    tool_calls:
      current: {CURRENT_CALLS}
      limit: {RATE_LIMIT}
      period: per_minute
      alert_at: [60%, 80%, 95%]
      
  context_window:
    current_utilization: {PERCENTAGE}
    threshold_warning: 70%
    threshold_critical: 90%
    
  task_queue:
    current_depth: {COUNT}
    max_depth: 50
    alert_at: [30, 40, 48]
    
  cost:
    current_period: {AMOUNT}
    budget: {LIMIT}
    alert_at: [50%, 75%, 90%]
```

### Alert Thresholds
```yaml
thresholds:
  warning:
    api_quota: 75%
    context_window: 70%
    queue_depth: 60%
    cost: 75%
    
  critical:
    api_quota: 90%
    context_window: 90%
    queue_depth: 90%
    cost: 90%
    
  emergency:
    api_quota: 98%
    context_window: 95%
    queue_depth: 100%
    cost: 100%
```

---

## 3. DETECTION & ALERTING

### Automatic Detection
```python
def monitor_capacity():
    """Continuous capacity monitoring"""
    
    status = CapacityStatus()
    
    # Check API quotas
    for api, metrics in api_quotas.items():
        utilization = metrics.current / metrics.limit
        if utilization >= THRESHOLD_CRITICAL:
            status.add_critical(f"{api}_quota", utilization)
        elif utilization >= THRESHOLD_WARNING:
            status.add_warning(f"{api}_quota", utilization)
    
    # Check context window
    context_util = get_context_utilization()
    if context_util >= 0.90:
        status.add_critical("context_window", context_util)
    elif context_util >= 0.70:
        status.add_warning("context_window", context_util)
    
    # Check queue depth
    queue_depth = task_queue.depth()
    if queue_depth >= MAX_QUEUE_DEPTH * 0.9:
        status.add_critical("queue_depth", queue_depth)
    elif queue_depth >= MAX_QUEUE_DEPTH * 0.6:
        status.add_warning("queue_depth", queue_depth)
    
    # Check cost
    current_cost = get_current_period_cost()
    if current_cost >= BUDGET * 0.90:
        status.add_critical("cost", current_cost)
    elif current_cost >= BUDGET * 0.75:
        status.add_warning("cost", current_cost)
    
    return status
```

### Alert Formats
```markdown
## ⚠️ CAPACITY WARNING

**Resource:** {RESOURCE_NAME}
**Current:** {CURRENT_VALUE} ({PERCENTAGE}%)
**Threshold:** {THRESHOLD}
**Trend:** {INCREASING/STABLE/DECREASING}

**Projected Exhaustion:** {TIME_ESTIMATE}

**Automatic Actions:**
- {ACTIONS_TAKEN}

**Manual Actions Available:**
- {OPTIONS}
```

```markdown
## 🚨 CAPACITY CRITICAL

**Resource:** {RESOURCE_NAME}
**Current:** {CURRENT_VALUE} ({PERCENTAGE}%)
**Limit:** {LIMIT}

**Impact:**
- {CURRENT_IMPACT}
- {PROJECTED_IMPACT}

**Immediate Actions Taken:**
- {AUTOMATIC_ACTIONS}

**Operator Action Required:**
{YES/NO - IF YES, WHAT}
```

---

## 4. RESPONSE PROCEDURES

### Warning Level Response
```yaml
automatic_actions:
  - Enable efficiency optimizations
  - Reduce non-essential operations
  - Start resource reclamation
  - Increase monitoring frequency
  
operator_notification:
  - Informational alert
  - Suggested actions
  - No immediate action required
```

### Critical Level Response
```yaml
automatic_actions:
  - Enable resource conservation mode
  - Queue low-priority tasks
  - Reduce context window usage
  - Optimize API call batching
  - Alert operator
  
operator_options:
  - Approve capacity increase
  - Cancel pending operations
  - Prioritize specific tasks
  - Wait for reset/quota refresh
```

### Emergency Level Response
```yaml
automatic_actions:
  - Enter degraded mode
  - Pause all non-essential operations
  - Preserve critical functions only
  - Alert operator urgently
  
critical_functions_only:
  - Operator direct commands
  - Security operations
  - Data preservation
  - Status reporting
```

---

## 5. DEGRADATION STRATEGIES

### Graceful Degradation Tiers
```
┌─────────────────────────────────────────────────────────────────┐
│ TIER 0: NORMAL OPERATION                                        │
│ All features available at full capacity                         │
├─────────────────────────────────────────────────────────────────┤
│ TIER 1: EFFICIENCY MODE (Warning)                               │
│ - Batch API calls where possible                                │
│ - Reduce response verbosity                                     │
│ - Cache aggressively                                            │
│ - Defer non-urgent background tasks                             │
├─────────────────────────────────────────────────────────────────┤
│ TIER 2: CONSERVATION MODE (Critical)                            │
│ - Queue low-priority requests                                   │
│ - Reduce tool usage to essential only                           │
│ - Compress context aggressively                                 │
│ - Limit concurrent operations                                   │
├─────────────────────────────────────────────────────────────────┤
│ TIER 3: PRESERVATION MODE (Emergency)                           │
│ - Essential operations only                                     │
│ - Minimal response generation                                   │
│ - No background processing                                      │
│ - Await operator intervention                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Feature Priority Matrix
```yaml
priority_levels:
  essential:  # Never disabled
    - Operator direct commands
    - Security monitoring
    - Error handling
    - Status reporting
    
  high:  # Disabled only in emergency
    - Client-facing operations
    - Memory operations
    - Core agent functions
    
  medium:  # Disabled in conservation mode
    - Background learning
    - Optimization tasks
    - Proactive suggestions
    
  low:  # Disabled first
    - Verbose explanations
    - Optional enhancements
    - Preemptive caching
```

### Context Window Management
```python
def manage_context_pressure():
    """Strategies for context window conservation"""
    
    strategies = [
        # Tier 1: Summarization
        summarize_old_context(),
        
        # Tier 2: Pruning
        prune_low_relevance_entries(),
        
        # Tier 3: Compression
        compress_verbose_sections(),
        
        # Tier 4: Truncation
        truncate_to_essentials()
    ]
    
    current_util = get_context_utilization()
    target_util = 0.70  # Target comfortable level
    
    for strategy in strategies:
        if current_util <= target_util:
            break
        current_util = strategy.execute()
        
    return current_util
```

---

## 6. RECOVERY PROCEDURES

### Post-Overload Recovery
```yaml
steps:
  1. verify_resource_availability:
     - Check quota reset
     - Confirm capacity restored
     - Validate system health
     
  2. gradual_restoration:
     - Re-enable features tier by tier
     - Monitor closely for regression
     - Process queued items gradually
     
  3. queue_processing:
     - Process high-priority queued items first
     - Validate each before continuing
     - Maintain capacity headroom
     
  4. return_to_normal:
     - Full feature restoration
     - Normal monitoring levels
     - Document incident
```

### Queue Recovery Priority
```yaml
queue_priority:
  1. Operator-initiated requests
  2. Client-facing operations
  3. Time-sensitive tasks
  4. Background operations
  5. Optimization tasks
```

---

## 7. PREVENTION MEASURES

### Proactive Management
```yaml
daily_checks:
  - Quota utilization trends
  - Cost projection
  - Capacity forecasting
  - Resource optimization opportunities
  
weekly_checks:
  - Usage pattern analysis
  - Efficiency improvements
  - Capacity planning review
  - Cost optimization review
```

### Capacity Planning
```python
def project_capacity_needs():
    """Forecast capacity requirements"""
    
    # Historical analysis
    usage_trend = analyze_usage_trend(days=30)
    
    # Growth projection
    projected_growth = calculate_growth_rate()
    
    # Buffer calculation
    safety_margin = 0.20  # 20% buffer
    
    # Recommendation
    return CapacityRecommendation(
        current_usage=usage_trend.current,
        projected_usage=usage_trend.project(days=30),
        recommended_capacity=projected_growth * (1 + safety_margin),
        confidence=usage_trend.confidence
    )
```

### Rate Limiting
```yaml
rate_limits:
  api_calls:
    per_minute: 60
    per_hour: 1000
    burst_allowance: 10
    
  tool_usage:
    per_minute: 20
    per_hour: 200
    
  memory_writes:
    per_minute: 30
    per_hour: 300
```

---

## 8. METRICS & REPORTING

### Key Metrics
```yaml
metrics:
  utilization:
    - Peak utilization by resource
    - Average utilization
    - Time spent in each tier
    
  incidents:
    - Overload events count
    - Time to recovery
    - Impact duration
    
  efficiency:
    - Requests per API call
    - Context utilization efficiency
    - Cost per operation
```

### Capacity Dashboard
```
┌─────────────────────────────────────────┐
│        CAPACITY STATUS                  │
├─────────────────────────────────────────┤
│ API Quota      [████████░░] 78%   ⚠️    │
│ Context Window [██████░░░░] 62%   ✓    │
│ Task Queue     [████░░░░░░] 38%   ✓    │
│ Daily Cost     [██████░░░░] 58%   ✓    │
├─────────────────────────────────────────┤
│ Mode: EFFICIENCY (Tier 1)              │
│ Trend: Utilization increasing          │
│ Forecast: Critical in ~2 hours         │
└─────────────────────────────────────────┘
```

---

## 9. ESCALATION PATH

```
Monitoring → Warning Detected
                  ↓
            Efficiency Mode (automatic)
                  ↓
    ┌────────────────────────────────┐
    │ If stabilizes:                 │
    │ - Continue monitoring          │
    │ - Log event                    │
    └────────────────────────────────┘
                  ↓
    ┌────────────────────────────────┐
    │ If reaches critical:           │
    │ - Conservation mode            │
    │ - Operator notification        │
    │ - Request intervention         │
    └────────────────────────────────┘
                  ↓
    ┌────────────────────────────────┐
    │ If reaches emergency:          │
    │ - Preservation mode            │
    │ - Operator URGENT              │
    │ - Essential only               │
    └────────────────────────────────┘
```

---

## 10. OPERATOR ACTIONS

### Available Interventions
```yaml
capacity_increase:
  - Increase API quota (if available)
  - Extend budget
  - Add processing time
  
task_management:
  - Cancel pending tasks
  - Reprioritize queue
  - Clear non-essential work
  
mode_override:
  - Force normal mode (accept risk)
  - Extend degraded mode
  - Initiate controlled shutdown
```

### Decision Matrix
```
| Situation              | Recommended Action                |
|------------------------|-----------------------------------|
| Temporary spike        | Wait for natural recovery         |
| Sustained high usage   | Consider capacity increase        |
| Cost approaching limit | Review and adjust budget          |
| Quota near exhaustion  | Reduce usage or increase quota    |
| Repeated overloads     | Capacity planning review needed   |
```

---

## 11. DRILL SCENARIOS

### Drill 1: API Quota Exhaustion
```
Scenario: API quota reaches 95%
Expected: Conservation mode, operator alert, queue low-priority
```

### Drill 2: Context Window Pressure
```
Scenario: Context reaches 90% utilization
Expected: Summarization, pruning, compression in sequence
```

### Drill 3: Cost Limit Approach
```
Scenario: Daily cost reaches budget limit
Expected: Degraded mode, operator notification, await approval
```

### Drill 4: Multi-Resource Crisis
```
Scenario: Multiple resources reach critical simultaneously
Expected: Preservation mode, prioritized response, operator URGENT
```

---

**Related Documents:**
- ARCHITECTURE.md
- RUNBOOK.md
- PROMPTS/ARI_PLANNER.md
- WORKFLOWS/incident_response.md
