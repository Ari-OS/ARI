# 🌐 [VENTURE NAME] — VENTURE CONTEXT
## [Business Type/Description]

**Context Type:** Venture  
**Load Trigger:** [When should this context load - be specific]  
**Version:** 12.0.0  
**Partition:** VENTURE_[NAME]

---

## ═══════════════════════════════════════════════════════════════
## VENTURE IDENTITY
## ═══════════════════════════════════════════════════════════════

**Business Name:** [Name]  
**Domain:** [Industry/Niche]  
**Operator:** [Name]  
**Location:** [Location]  
**Status:** [Pre-launch/Active/LLC/etc.]  
**Website:** [URL if applicable]

---

## MISSION

[One paragraph describing the venture's purpose]

---

## ═══════════════════════════════════════════════════════════════
## PRICING (IF APPLICABLE)
## ═══════════════════════════════════════════════════════════════

### Service/Product Offerings

| Offering | Price | Description | Timeline |
|----------|-------|-------------|----------|
| [Entry] | $X | [Description] | [Time] |
| [Standard] | $X | [Description] | [Time] |
| [Premium] | $X | [Description] | [Time] |

### Payment Terms

```
[Define your payment rules here]
- Deposit requirements
- Payment timing
- Discount policies
- Payment plan policies
```

---

## ═══════════════════════════════════════════════════════════════
## SALES/OPERATIONS FRAMEWORK
## ═══════════════════════════════════════════════════════════════

### Lead Qualification (if applicable)

| Criterion | Points | How to Assess |
|-----------|--------|---------------|
| [Criterion 1] | X | [Assessment method] |
| [Criterion 2] | X | [Assessment method] |

### Red Flags
- [Warning sign 1]
- [Warning sign 2]

### Green Flags
- [Positive indicator 1]
- [Positive indicator 2]

---

## ═══════════════════════════════════════════════════════════════
## OPERATIONAL DETAILS
## ═══════════════════════════════════════════════════════════════

### Key Processes
[Document your key operational processes]

### Tools & Resources
[List tools specific to this venture]

### Communication Guidelines
[How to communicate with clients/customers/partners]

---

## ═══════════════════════════════════════════════════════════════
## MEMORY PARTITION
## ═══════════════════════════════════════════════════════════════

All [Venture Name] memories are tagged:
```json
{
  "partition": "VENTURE_[NAME]",
  "venture_id": "[venture_id]",
  "allowed_agents": ["list", "of", "agents"],
  "isolation": true
}
```

Venture memories do NOT leak into:
- Personal life contexts
- Other venture contexts
- Kernel operations

---

## ═══════════════════════════════════════════════════════════════
## CONTEXT LOADING TRIGGERS
## ═══════════════════════════════════════════════════════════════

Load this context when operator mentions:
- "[Venture name]"
- "[Key product/service]"
- "[Client type]"
- [Other specific triggers]

Do NOT load when:
- General life questions
- Other venture work
- Personal matters

---

*This context is loaded ONLY when operator is working on [Venture Name] tasks.*  
*Context Version: 12.0.0*
