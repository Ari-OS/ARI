# ARI Dashboard Enhancement Plan

> **Current State**: Solid MVP with real-time monitoring, component status, and interactive controls.  
> **Target State**: World-class observability platform matching Datadog/Grafana/Vercel standards.

---

## Phase 1: Critical Data Visualization (High Impact, 2-3 days)

### 1.1 Time-Series Charts

**Problem**: No historical trends, only current state.  
**Solution**: Add chart library (recharts or chart.js) for time-series visualization.

**Components to Add:**

```tsx
// dashboard/src/components/charts/TimeSeriesChart.tsx
- Memory usage over time (line chart)
- Event processing rate (area chart)  
- Task execution timeline (bar chart)
- Agent activity heatmap
```

**New API Endpoints Needed:**

```typescript
// Backend: src/api/routes.ts
GET /api/metrics/timeseries?metric=memory&range=24h
GET /api/metrics/timeseries?metric=events&range=7d
GET /api/scheduler/tasks/:id/history?limit=10
GET /api/audit/stats?groupBy=agent&range=24h
```

**Implementation:**

1. Add `recharts` dependency to dashboard
2. Create reusable `TimeSeriesChart` component
3. Add `/api/metrics/timeseries` endpoint (store metrics in memory or Redis)
4. Update Health page with memory/events charts
5. Update Autonomy page with task success rate chart

**Estimated Impact**: 🔥🔥🔥 **CRITICAL** - Transforms from "status monitor" to "observability platform"

---

### 1.2 Health Score Calculation

**Problem**: No quantified health metric.  
**Solution**: Calculate 0-100% health score based on component statuses.

**Algorithm:**

```typescript
function calculateHealthScore(health: DetailedHealth): number {
  const components = [
    { name: 'gateway', status: health.gateway.status, weight: 20 },
    { name: 'eventBus', status: health.eventBus.status, weight: 15 },
    { name: 'audit', status: health.audit.status, weight: 20 },
    { name: 'sanitizer', status: health.sanitizer.status, weight: 15 },
    { name: 'agents', status: health.agents.status, weight: 15 },
    { name: 'governance', status: health.governance.status, weight: 15 },
  ];
  
  const totalScore = components.reduce((sum, comp) => {
    const score = comp.status === 'healthy' ? 100 : 
                  comp.status === 'degraded' ? 50 : 0;
    return sum + (score * comp.weight / 100);
  }, 0);
  
  return Math.round(totalScore);
}
```

**Display:**

- Large circular progress indicator on Health page header
- Color-coded: 90-100% (green), 70-89% (yellow), <70% (red)
- Trend indicator (↑↓) compared to 1h ago

**Estimated Impact**: 🔥🔥 **HIGH** - Instant health visibility

---

### 1.3 Task Execution History

**Problem**: Can't see what happened when a task ran.  
**Solution**: Store task execution logs and display them.

**Data Model:**

```typescript
interface TaskExecution {
  id: string;
  taskId: string;
  taskName: string;
  startedAt: string;
  completedAt: string;
  duration: number; // ms
  status: 'success' | 'failed';
  output?: string;
  error?: string;
  triggeredBy: 'scheduler' | 'manual';
}
```

**Storage:**

- Append to `~/.ari/task-executions.json` (or SQLite for better querying)
- Keep last 100 executions per task

**UI Enhancement:**

```tsx
// In Autonomy page, clicking a task shows execution history
<TaskDetailModal task={task}>
  <ExecutionHistory executions={recentExecutions}>
    - Timeline view of last 10 runs
    - Success/failure status
    - Duration chart (bar chart)
    - Error messages for failures
    - "View full logs" button
  </ExecutionHistory>
</TaskDetailModal>
```

**Estimated Impact**: 🔥🔥🔥 **CRITICAL** - Essential for debugging

---

## Phase 2: Advanced Filtering & Search (High Impact, 2 days)

### 2.1 Global Search

**Problem**: No way to find specific data across pages.  
**Solution**: Add command palette (⌘K) for quick navigation and search.

**Implementation:**

1. Add `cmdk` (command palette library) to dashboard
2. Create `<CommandPalette>` component with keyboard shortcut (⌘K / Ctrl+K)
3. Index searchable data:
   - Pages (navigate to Health, Autonomy, etc.)
   - Actions ("Trigger morning briefing", "View audit log")
   - Agents (search by ID or type)
   - Tasks (search by name or handler)
   - Audit events (search by action or agent)

**Example:**

```tsx
<CommandPalette>
  <SearchInput placeholder="Search or jump to..." />
  <Results>
    <Group title="Pages">
      <Item>Health → Navigate to Health page</Item>
      <Item>Autonomy → Navigate to Autonomy page</Item>
    </Group>
    <Group title="Actions">
      <Item>Trigger task: Morning Briefing</Item>
      <Item>View audit chain verification</Item>
    </Group>
    <Group title="Recent Events">
      <Item>task_completed (7m ago)</Item>
    </Group>
  </Results>
</CommandPalette>
```

**Estimated Impact**: 🔥🔥 **HIGH** - Dramatically improves UX

---

### 2.2 Advanced Filters

**Problem**: Can't filter large datasets (100+ audit events).  
**Solution**: Add filter controls on Audit and other data-heavy pages.

**Filters for Audit Page:**

- **Agent filter**: Dropdown (All, GUARDIAN, PLANNER, EXECUTOR, etc.)
- **Action filter**: Dropdown (All, task_completed, threat_detected, etc.)
- **Time range**: Dropdown (Last hour, Last 24h, Last 7d, Custom)
- **Search**: Text input (searches action, agent, details)

**Filters for Autonomy Page:**

- **Task status**: All, Enabled, Disabled
- **Task handler**: All, briefings, health_check, etc.
- **Subagent status**: All, Running, Completed, Failed

**Estimated Impact**: 🔥🔥 **HIGH** - Essential for large datasets

---

## Phase 3: Real-Time Updates (Medium Impact, 1 day)

### 3.1 Migrate to WebSocket

**Problem**: Polling every 5-10s is inefficient and not truly real-time.  
**Solution**: Use existing WebSocket connection for instant updates.

**Backend Changes:**

```typescript
// src/api/ws.ts - already exists, enhance it
eventBus.on('audit:logged', (event) => {
  wss.clients.forEach((client) => {
    client.send(JSON.stringify({ 
      type: 'audit:event', 
      data: event 
    }));
  });
});

eventBus.on('scheduler:task_triggered', (event) => {
  wss.clients.forEach((client) => {
    client.send(JSON.stringify({ 
      type: 'scheduler:update', 
      data: event 
    }));
  });
});
```

**Frontend Changes:**

```tsx
// dashboard/src/hooks/useWebSocket.ts
export function useWebSocket() {
  useEffect(() => {
    const ws = connectWebSocket((event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'audit:event':
          queryClient.setQueryData(['audit'], (old) => 
            [message.data, ...old].slice(0, 100)
          );
          break;
        case 'scheduler:update':
          queryClient.invalidateQueries(['scheduler-tasks']);
          break;
      }
    });
    
    return () => ws.close();
  }, []);
}
```

**Estimated Impact**: 🔥🔥 **HIGH** - Instant updates, lower server load

---

## Phase 4: Export & Reporting (Medium Impact, 1 day)

### 4.1 Export Functionality

**Problem**: Can't download data for offline analysis.  
**Solution**: Add export buttons on each page.

**Formats:**

- **CSV**: Audit log, scheduler tasks, subagent list
- **JSON**: Full data export for programmatic access
- **PDF**: System health report (visual summary)

**Implementation:**

```tsx
// dashboard/src/components/ExportButton.tsx
<ExportButton 
  data={auditEvents}
  filename="ari-audit-log"
  formats={['csv', 'json']}
  onExport={(format) => {
    if (format === 'csv') {
      const csv = convertToCSV(auditEvents);
      downloadFile(csv, `audit-log-${Date.now()}.csv`);
    }
  }}
/>
```

**Estimated Impact**: 🔥 **MEDIUM** - Nice-to-have for reporting

---

## Phase 5: Drill-Down Detail Views (High Impact, 2 days)

### 5.1 Subagent Detail Page

**Problem**: Can only see summary info, not full execution details.  
**Solution**: Create detail page/modal for each subagent.

**Route:** `/autonomy/subagent/:id`

**Components:**

```tsx
<SubagentDetailPage agent={agent}>
  {/* Header */}
  <Header>
    <StatusBadge status={agent.status} />
    <ID>{agent.id}</ID>
    <Actions>
      <Button onClick={kill}>Kill Process</Button>
      <Button onClick={viewLogs}>View Full Logs</Button>
    </Actions>
  </Header>
  
  {/* Timeline */}
  <ExecutionTimeline>
    <Event time="10:15:32">Worktree created</Event>
    <Event time="10:15:35">Agent spawned in tmux</Event>
    <Event time="10:15:40">Task started</Event>
    <Event time="10:16:15">Progress: 50%</Event>
    <Event time="10:16:45">Task completed</Event>
  </ExecutionTimeline>
  
  {/* Logs */}
  <LogViewer logs={agent.logs} />
  
  {/* Metadata */}
  <Metadata>
    <Field label="Branch">{agent.branch}</Field>
    <Field label="Worktree">{agent.worktreePath}</Field>
    <Field label="Tmux Session">{agent.tmuxSession}</Field>
    <Field label="Duration">{duration}</Field>
  </Metadata>
</SubagentDetailPage>
```

**Estimated Impact**: 🔥🔥🔥 **CRITICAL** - Essential for debugging subagents

---

### 5.2 Component Health Deep-Dive

**Problem**: Component cards show status, but not **why** status is degraded.  
**Solution**: Click component card → detail modal.

**Example (Gateway Deep-Dive):**

```tsx
<GatewayDetailModal>
  <Metrics>
    <Metric>
      <Label>Connection History</Label>
      <Chart data={connectionHistory} /> {/* Last 24h */}
    </Metric>
    <Metric>
      <Label>Request Rate</Label>
      <Value>15 req/min</Value>
      <Trend>↑ 20% vs 1h ago</Trend>
    </Metric>
    <Metric>
      <Label>Error Rate</Label>
      <Value>0.1%</Value>
      <Chart data={errorRate} />
    </Metric>
  </Metrics>
  
  <RecentConnections>
    <Connection time="10:15:32" ip="127.0.0.1" status="active" />
    <Connection time="10:10:15" ip="127.0.0.1" status="closed" />
  </RecentConnections>
</GatewayDetailModal>
```

**Estimated Impact**: 🔥🔥 **HIGH** - Better diagnostics

---

## Phase 6: Dashboard Customization (Low-Medium Impact, 2-3 days)

### 6.1 Widget-Based Layout

**Problem**: Fixed layout, everyone sees the same thing.  
**Solution**: Modular widget system with drag-and-drop.

**Implementation:**

1. Add `react-grid-layout` for drag-and-drop widgets
2. Create widget library:
   - `<SystemHealthWidget />`
   - `<MemoryChartWidget />`
   - `<RecentAuditWidget />`
   - `<SchedulerStatusWidget />`
   - `<SubagentStatsWidget />`
3. Save layout to localStorage or backend
4. Allow users to:
   - Add/remove widgets
   - Resize widgets
   - Rearrange layout
   - Reset to default

**Estimated Impact**: 🔥 **MEDIUM** - Power user feature

---

### 6.2 Theme & Display Settings

**Problem**: No dark/light theme toggle, no customization.  
**Solution**: Add settings panel.

**Settings:**

- Theme: Dark (default), Light
- Auto-refresh interval: 5s, 10s, 30s, Off
- Default date range for charts: 1h, 24h, 7d
- Compact/comfortable density
- Show/hide sections

**Estimated Impact**: 🔥 **LOW** - Nice-to-have

---

## Phase 7: Alerts & Notifications (High Impact, 2 days)

### 7.1 Alert System

**Problem**: No visual indication of critical issues.  
**Solution**: Add alert banner and notification center.

**Alert Types:**

1. **Critical**: Hash chain invalid, gateway down, agent crash
2. **Warning**: Memory >80%, task failed, degraded component
3. **Info**: Task completed, agent spawned

**UI:**

```tsx
<AlertBanner>
  <Alert severity="critical">
    <Icon>⚠️</Icon>
    <Message>Audit hash chain verification failed</Message>
    <Action onClick={viewDetails}>View Details</Action>
    <Dismiss />
  </Alert>
</AlertBanner>

<NotificationBell count={3}>
  <NotificationDropdown>
    <Notification time="2m ago" severity="warning">
      Task "Morning Briefing" failed
    </Notification>
    <Notification time="15m ago" severity="info">
      Subagent completed successfully
    </Notification>
  </NotificationDropdown>
</NotificationBell>
```

**Backend:**

```typescript
// Store alerts in ~/.ari/alerts.json or Redis
interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

GET /api/alerts?unacknowledged=true
POST /api/alerts/:id/acknowledge
```

**Estimated Impact**: 🔥🔥🔥 **CRITICAL** - Essential for monitoring

---

## Phase 8: Performance & UX Polish (Medium Impact, 1-2 days)

### 8.1 Data Refresh Indicators

**Problem**: Don't know when data was last updated.  
**Solution**: Add "Last updated" timestamp and refresh button.

```tsx
<RefreshIndicator>
  <Text>Updated {formatTimeAgo(lastUpdate)}</Text>
  <RefreshButton onClick={refetch} isLoading={isRefetching} />
</RefreshIndicator>
```

---

### 8.2 Keyboard Shortcuts

**Problem**: Mouse-only navigation.  
**Solution**: Add keyboard shortcuts.

**Shortcuts:**

- `⌘K` / `Ctrl+K`: Open command palette
- `G H`: Go to Health page
- `G A`: Go to Autonomy page
- `G M`: Go to Memory page
- `R`: Refresh current page
- `?`: Show keyboard shortcuts help
- `Esc`: Close modals

---

### 8.3 Mobile Responsiveness

**Problem**: Likely breaks on mobile.  
**Solution**: Add mobile breakpoints and touch optimization.

**Changes:**

- Stack cards vertically on mobile
- Hide less important columns in tables
- Add swipe gestures for navigation
- Increase touch target sizes (44x44px minimum)
- Simplify charts for small screens

**Estimated Impact**: 🔥 **MEDIUM** - Important for mobile users

---

## Phase 9: Advanced Analytics (Low-Medium Impact, 2-3 days)

### 9.1 Comparative Metrics

**Problem**: Can't compare "now" vs "before".  
**Solution**: Add comparison mode.

**Examples:**

- Memory usage: 85MB (↑ 15% vs 1h ago)
- Event rate: 120/min (↓ 10% vs yesterday)
- Task success rate: 98% (→ no change vs last week)

---

### 9.2 Audit Event Analytics

**Problem**: Just a list of events, no insights.  
**Solution**: Add analytics dashboard.

**Charts:**

- Event types pie chart (task_completed, threat_detected, etc.)
- Events by agent (bar chart)
- Event rate over time (line chart)
- Most active agents (leaderboard)

---

## Implementation Priority

| Phase | Impact | Effort | Priority | When |
|-------|--------|--------|----------|------|
| **1. Time-Series Charts** | 🔥🔥🔥 CRITICAL | 2-3 days | **P0** | Now |
| **7. Alerts & Notifications** | 🔥🔥🔥 CRITICAL | 2 days | **P0** | After P0 |
| **5. Drill-Down Detail Views** | 🔥🔥🔥 CRITICAL | 2 days | **P1** | Week 2 |
| **3. Real-Time WebSocket** | 🔥🔥 HIGH | 1 day | **P1** | Week 2 |
| **2. Global Search & Filters** | 🔥🔥 HIGH | 2 days | **P2** | Week 3 |
| **4. Export & Reporting** | 🔥 MEDIUM | 1 day | **P3** | Week 4 |
| **8. Performance & UX Polish** | 🔥 MEDIUM | 1-2 days | **P3** | Week 4 |
| **6. Dashboard Customization** | 🔥 MEDIUM | 2-3 days | **P4** | Future |
| **9. Advanced Analytics** | 🔥 MEDIUM | 2-3 days | **P4** | Future |

---

## Recommended Next Steps (This Week)

### Day 1-2: Add Time-Series Charts

1. Install `recharts`: `npm install recharts`
2. Create `/api/metrics/timeseries` endpoint with in-memory storage
3. Add `<MemoryChart>` to Health page
4. Add `<EventRateChart>` to Health page
5. Add `<TaskSuccessRateChart>` to Autonomy page

### Day 3: Add Health Score

1. Implement `calculateHealthScore()` function
2. Add circular progress indicator to Health header
3. Add trend indicator (compare to 1h ago)

### Day 4: Add Task Execution History

1. Create `TaskExecution` data model
2. Store executions in `~/.ari/task-executions.json`
3. Add `/api/scheduler/tasks/:id/history` endpoint
4. Create `<TaskDetailModal>` with execution history

### Day 5: Add Alert System

1. Create `Alert` data model
2. Add `/api/alerts` endpoints
3. Create `<AlertBanner>` component
4. Create `<NotificationBell>` component
5. Emit alerts for critical events (hash chain fail, component down, task fail)

---

## Metrics to Track Success

- **Time to Insight**: How fast can you diagnose an issue? (Target: <30 seconds)
- **Data Freshness**: How recent is displayed data? (Target: <1 second with WebSocket)
- **User Actions per Session**: How many interactions per visit? (Target: 5+)
- **Mobile Usage**: % of sessions on mobile (Target: >10%)
- **Export Usage**: % of users exporting data (Target: >20%)

---

## Inspiration Sources

Study these dashboards for best practices:

1. **Datadog APM**: Time-series charts, drill-down, alerts
2. **Grafana**: Customizable widgets, powerful queries
3. **Vercel Dashboard**: Clean UI, real-time deployment logs
4. **Railway Dashboard**: Beautiful service cards, live logs
5. **New Relic**: Health scores, SLA tracking, comparative metrics
6. **Linear**: Command palette (⌘K), keyboard shortcuts
7. **GitHub Actions**: Workflow execution detail, logs viewer

---

## Conclusion

The current implementation is **a solid foundation**, but to match world-class standards, you need:

1. ✅ **Data visualization** (charts, graphs, trends)
2. ✅ **Historical context** (compare over time)
3. ✅ **Deep drill-down** (detail views for every entity)
4. ✅ **Real-time updates** (WebSocket, not polling)
5. ✅ **Search & filter** (find anything fast)
6. ✅ **Alerts & notifications** (critical issues visible)
7. ✅ **Export & reporting** (data portability)
8. ✅ **Mobile optimization** (works everywhere)

**Start with Phase 1 (Time-Series Charts)** — it's the highest impact change that transforms the dashboard from "status monitor" to "observability platform".
