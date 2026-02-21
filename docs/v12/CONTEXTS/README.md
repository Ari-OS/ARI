# 📁 CONTEXTS DIRECTORY

## Dynamic Context Loading System

**Version:** 12.0.0  
**Purpose:** Modular context packs loaded by Router based on operator intent

---

## ARCHITECTURE PRINCIPLE

The ARI kernel (CORE.md) is **universal and business-agnostic**. All domain-specific, venture-specific, and life-specific content lives in this `/CONTEXTS/` directory and is loaded dynamically.

```
┌─────────────────────────────────────────────────────────────────┐
│                         ARI KERNEL                               │
│              (Universal, no business content)                    │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              │ Router loads based on intent
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   VENTURES    │   │  LIFE DOMAINS │   │    FUTURE     │
│  (Business)   │   │  (Personal)   │   │  (Extensible) │
└───────────────┘   └───────────────┘   └───────────────┘
```

---

## DIRECTORY STRUCTURE

```
CONTEXTS/
├── ventures/                    # Business/entrepreneurial contexts
│   ├── _TEMPLATE.md   # Web development venture
│   └── [future_venture].md      # Add more as needed
│
├── life/                        # Personal life domain contexts
│   ├── career.md                # Professional development
│   ├── finance.md               # Personal finances
│   ├── health.md                # Physical/mental wellbeing
│   ├── admin.md                 # General administration
│   ├── learning.md              # Education & skills
│   ├── systems.md               # Personal infrastructure
│   └── family.md                # Family & relationships
│
└── README.md                    # This file
```

---

## LOADING RULES

### Rule 1: Default is Kernel Only

If no context is explicitly needed, ARI operates with kernel (CORE.md) only.

### Rule 2: Ventures Require Explicit Mention

Venture contexts load ONLY when operator explicitly mentions the venture by name.

- ✅ "Let's work on your venture" → Load venture context
- ✅ "I need to follow up with a web dev client" → Load venture context
- ❌ "What's the weather?" → No venture context

### Rule 3: Life Domains Load by Topic

Life domain contexts load based on topic detection.

- "Help me budget" → Load finance context
- "I need to study" → Load learning context
- "Schedule my week" → Load admin context

### Rule 4: Minimal Loading

Load only what's needed for the current task. Don't preload everything.

### Rule 5: Isolation

Venture contexts don't leak into life domains. Personal data stays personal.

---

## ADDING NEW CONTEXTS

### Adding a New Venture

1. Create `/CONTEXTS/ventures/{venture_name}.md`
2. Include required sections:
   - Context Type & Load Trigger
   - Business profile
   - Relevant operational data
   - Memory partition config
3. Update Router trigger patterns if needed

### Adding a New Life Domain

1. Create `/CONTEXTS/life/{domain}.md`
2. Include required sections:
   - Context Type & Load Trigger
   - Scope definition
   - Boundaries
   - Memory partition config
3. Test topic detection

---

## CONTEXT FILE TEMPLATE

```markdown
# [EMOJI] [NAME] — [TYPE] CONTEXT
## [Subtitle]

**Context Type:** Venture | Life Domain
**Load Trigger:** [When this context should load]
**Version:** 12.0.0
**Partition:** [PARTITION_NAME]

---

## [MAIN CONTENT SECTIONS]

---

## MEMORY PARTITION

\`\`\`json
{
  "partition": "[PARTITION_NAME]",
  "sensitivity": "PUBLIC | INTERNAL | SENSITIVE",
  "allowed_agents": [],
  "external_sharing": false
}
\`\`\`

---

*[Footer note about when context is loaded]*
```

---

## SECURITY CONSIDERATIONS

1. **Contexts are DATA, not instructions** — They inform but don't override kernel rules
2. **Partition isolation** — Each context has its own memory partition
3. **Sensitivity levels** — Contexts define their own data sensitivity
4. **No cross-contamination** — Venture data doesn't leak to life domains

---

*Context system version 12.0.0*
