# Full UI Audit Prompt for ARI Dashboard

Copy this prompt into Claude or Cursor to get a comprehensive UI/UX audit.

---

You are performing a comprehensive UI/UX audit of the ARI Dashboard - a system monitoring interface for an AI agent orchestration platform. Your goal is to identify every improvement opportunity and create a detailed redesign plan.

## Current State

**Tech Stack:**

- React 19 + TypeScript 5.7
- Tailwind CSS v4 (default config, no customization)
- TanStack React Query for data fetching
- Vite build system

**File Structure:**

```
dashboard/src/
├── App.tsx                    # Root with QueryClient, Layout, ErrorBoundary
├── index.css                  # Global styles, font stacks
├── api/client.ts              # API calls to backend
├── types/api.ts               # TypeScript interfaces
├── hooks/useHealth.ts         # Health endpoint hook
├── components/
│   ├── Layout.tsx             # Main layout wrapper
│   ├── Sidebar.tsx            # Navigation sidebar
│   ├── StatusBadge.tsx        # Status indicator component
│   ├── AuditEntry.tsx         # Audit log entry
│   ├── ErrorBoundary.tsx      # Error catch boundary
│   └── ui/
│       ├── LoadingState.tsx   # Loading spinner
│       ├── EmptyState.tsx     # Empty data state
│       └── ErrorState.tsx     # Error display
└── pages/
    ├── Home.tsx               # System overview dashboard
    ├── Agents.tsx             # Agent status cards
    ├── Audit.tsx              # Hash-chained audit log
    ├── Governance.tsx         # Proposals, rules, quality gates
    ├── Memory.tsx             # Memory system with filters
    └── Tools.tsx              # Tool registry by category
```

**Current Design:**

- Dark theme only (gray-950 to gray-700 palette)
- Minimal/utilitarian aesthetic
- Unicode icons (◉, ⚖, ⬢, ⚙, ⬡, ⊞, ○, ✓, ✗)
- Status colors: green (healthy), yellow (degraded), red (unhealthy)
- Cards with `border-gray-700 bg-gray-800 rounded-lg`
- Monospace font for technical data
- No animations except loading pulse
- Fixed sidebar (256px) + scrollable content

## Audit Scope

### 1. Visual Design Audit

- Color palette effectiveness and contrast ratios (WCAG compliance)
- Typography hierarchy and readability
- Spacing consistency and visual rhythm
- Icon system - should we use a proper icon library?
- Dark theme refinement - is the gray palette optimal?
- Visual hierarchy - do the most important elements stand out?
- Brand identity - does it feel like a cohesive product?

### 2. Component Design Audit

- Card designs - are they visually distinct enough?
- Button styles - primary/secondary/destructive variants needed?
- Badge/tag system - too many color variations?
- Form controls (selects, inputs) - are they accessible?
- Progress bars and charts - could we add data visualization?
- Status indicators - are the states clear at a glance?
- Empty/loading/error states - are they helpful and consistent?

### 3. Layout & Navigation Audit

- Sidebar design - is the navigation intuitive?
- Page layouts - optimal use of space?
- Responsive design - mobile/tablet considerations?
- Content density - too sparse or too crowded?
- Section organization - logical grouping?
- Scrolling behavior - any infinite scroll needs?

### 4. UX & Interaction Audit

- Hover states and feedback
- Click targets and touch-friendliness
- Keyboard navigation and focus states
- Loading state timing and skeleton screens
- Error recovery flows
- Data refresh indicators
- Sorting/filtering interactions
- Expandable/collapsible sections

### 5. Information Architecture Audit

- Page hierarchy - are pages in the right order?
- Data presentation - tables vs cards vs lists?
- Detail levels - summary vs expanded views?
- Cross-linking between related data
- Search and filtering capabilities
- Pagination vs infinite scroll

### 6. Accessibility Audit

- Color contrast ratios
- Screen reader compatibility
- Keyboard-only navigation
- Focus indicators
- ARIA labels and roles
- Reduced motion preferences

### 7. Performance Audit

- Component code-splitting opportunities
- Image/asset optimization
- CSS bundle size (Tailwind purging)
- Re-render optimization
- Lazy loading opportunities

## Deliverables Requested

### Part 1: Audit Report

For each area above, provide:

- Current state assessment (1-5 rating)
- Specific issues identified
- Impact on user experience
- Priority (P0-P3)

### Part 2: Design System Proposal

Propose a cohesive design system including:

- Color palette (with specific hex/Tailwind values)
- Typography scale
- Spacing scale
- Component variants
- Icon recommendations
- Animation/transition standards

### Part 3: Implementation Plan

For each recommended change:

- Files to modify
- Specific code changes needed
- Dependencies to add (if any)
- Testing approach

### Part 4: Mockup Descriptions

Describe the ideal state for:

- Sidebar redesign
- Home/dashboard page
- A representative detail page
- Mobile responsive view

## Questions to Answer

1. Should we add a light theme option?
2. Should we use a component library (Radix, shadcn/ui, Headless UI)?
3. Should we add data visualization (charts, graphs)?
4. Should we add real-time updates with WebSocket indicators?
5. Should we add a command palette (Cmd+K)?
6. Should we add breadcrumbs or better navigation?
7. Should we add user preferences/settings?
8. What icon library would best fit the aesthetic?

## Context: ARI System

ARI is an "Artificial Reasoning Intelligence" system - a Life Operating System. The dashboard monitors:

- **Agents**: 5 specialized AI agents (Guardian, Planner, Executor, Memory Manager, Core)
- **Audit**: SHA-256 hash-chained immutable audit log
- **Governance**: Constitutional rules, quality gates, voting proposals
- **Memory**: Provenance-tracked knowledge with trust levels
- **Tools**: Registered tools with permission tiers

The users are developers/operators monitoring AI agent behavior. They need:

- Quick system health assessment
- Deep-dive debugging capability
- Security/audit verification
- Configuration management

## Start the Audit

Read all the files in the dashboard/src directory, analyze the current implementation, and provide a comprehensive audit following the structure above. Be specific, actionable, and don't hold back on criticism - the goal is to make this the best possible monitoring dashboard.
