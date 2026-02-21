---
name: ari-knowledge-synthesizer
description: Synthesize learnings from sessions into permanent knowledge
---

# ARI Knowledge Synthesizer

## Purpose

Transform session learnings, decisions, and discoveries into permanent, searchable knowledge that improves ARI's capabilities over time.

## Knowledge Categories

### 1. Patterns

Reusable solutions to common problems:

- Code patterns
- Architecture patterns
- Testing patterns
- Security patterns

### 2. Decisions

Architectural and design decisions:

- Why choices were made
- Alternatives considered
- Trade-offs accepted

### 3. Gotchas

Things that are easy to get wrong:

- Common mistakes
- Subtle bugs
- Edge cases

### 4. Fixes

Solutions to specific problems:

- Bug fixes
- Performance fixes
- Security fixes

### 5. Insights

Deeper understanding gained:

- How things work
- Why things are designed this way
- Connections between components

## Synthesis Process

### Phase 1: Extract

From the session, extract:

- Key decisions made
- Problems solved
- Patterns discovered
- Mistakes made and fixed

### Phase 2: Categorize

Assign each learning to:

- Category (pattern/decision/gotcha/fix/insight)
- Domain (kernel/system/agents/governance/ops/cli)
- Tags for searchability

### Phase 3: Formalize

Structure the knowledge:

```
Title: [Clear, searchable title]
Category: [Category]
Domain: [Domain]
Tags: [tag1, tag2, ...]
Context: [When this applies]
Content: [The actual knowledge]
Examples: [Code or usage examples]
Related: [Related knowledge items]
```

### Phase 4: Store

Persist to memory system:

- Use ari_memory_store via MCP
- Or update relevant skill files
- Or add to CLAUDE.md

### Phase 5: Index

Ensure findability:

- Add to relevant skill documentation
- Update knowledge index
- Cross-reference related items

## Storage Locations

| Knowledge Type | Storage Location |
|----------------|------------------|
| Patterns | Relevant skill SKILL.md |
| Decisions | docs/adr/ or CLAUDE.md |
| Gotchas | CONTRIBUTING.md or skill |
| Fixes | Related skill or memory |
| Insights | CLAUDE.md or architecture docs |

## Knowledge Quality Criteria

- [ ] Clear and concise title
- [ ] Searchable tags
- [ ] Specific, not generic
- [ ] Includes context for when it applies
- [ ] Has working examples
- [ ] Cross-referenced appropriately

## Output Format

```markdown
## Knowledge Synthesis Report

### Session: [Date/Context]

### Extracted Knowledge

#### 1. [Title]
- **Category**: [Category]
- **Domain**: [Domain]
- **Tags**: [tags]
- **Content**: [Knowledge content]
- **Storage**: [Where stored]

#### 2. [Title]
...

### Updates Made
- Updated [file]: [change]
- Created [file]: [description]
- Stored in memory: [key]

### Knowledge Graph Connections
- [Item 1] relates to [Item 2]
- [Item 3] extends [Item 4]
```
