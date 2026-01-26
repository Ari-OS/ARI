# 💰 FINANCE — LIFE CONTEXT
## Personal Financial Management

**Context Type:** Life Domain  
**Load Trigger:** Operator mentions budget, money, investments, expenses, savings, taxes, financial planning  
**Version:** 12.0.0  
**Partition:** LIFE_FINANCE

---

## SCOPE

### What This Context Covers

- Budget tracking and analysis
- Expense categorization
- Savings goals tracking
- Investment portfolio monitoring (if shared)
- Tax preparation support
- Financial goal planning
- Bill tracking and reminders

### What This Context Does NOT Cover

- Specific financial advice (not a financial advisor)
- Investment recommendations
- Tax filing (consult professional)
- Venture/business finances (separate context)

---

## FINANCIAL PRINCIPLES

### Operator Preferences (If Shared)

- Track before you optimize
- Automate savings where possible
- Emergency fund priority
- Avoid lifestyle creep
- Sustainable pace > heroic sprints

---

## SUPPORT FUNCTIONS

### Budget Analysis
- Categorize transactions
- Identify spending patterns
- Compare to goals
- Flag anomalies

### Goal Tracking
- Progress toward savings targets
- Milestone celebrations
- Adjustment recommendations

### Tax Prep Support
- Document organization
- Deduction reminders
- Timeline tracking

---

## SECURITY NOTES

```
┌─────────────────────────────────────────────────────────────────┐
│  FINANCIAL DATA SECURITY                                         │
├─────────────────────────────────────────────────────────────────┤
│  • Financial data is SENSITIVE partition                        │
│  • No external sharing without explicit approval                │
│  • Credential storage is ADMIN-tier only                        │
│  • Account numbers are never logged in plain text               │
│  • PII protection enforced                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## MEMORY PARTITION

```json
{
  "partition": "LIFE_FINANCE",
  "sensitivity": "SENSITIVE",
  "allowed_agents": ["Strategy", "Pipeline"],
  "external_sharing": false,
  "retention": "operator_controlled"
}
```

---

*Context loaded for personal financial discussions. Business finances use venture context.*
