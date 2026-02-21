---
name: ari-monitoring-alerting
description: Real-time monitoring and alerting system for ARI
triggers:
  - "monitoring"
  - "alerting"
  - "metrics"
  - "system health"
---

# ARI Monitoring & Alerting

## Purpose

Real-time monitoring of ARI's health, performance, and security with automated alerting.

## Metrics Collection

### System Metrics

```typescript
interface SystemMetrics {
  cpu: {
    usage: number;        // 0-100%
    loadAvg: number[];    // 1, 5, 15 min
  };
  memory: {
    used: number;         // bytes
    total: number;        // bytes
    heapUsed: number;     // V8 heap
    heapTotal: number;
  };
  uptime: number;         // seconds
  eventLoop: {
    lag: number;          // ms
    utilization: number;  // 0-1
  };
}
```

### Application Metrics

```typescript
interface AppMetrics {
  requests: {
    total: number;
    perSecond: number;
    latencyP50: number;
    latencyP95: number;
    latencyP99: number;
  };
  agents: {
    [agent: string]: {
      tasksCompleted: number;
      tasksFailed: number;
      avgDuration: number;
    };
  };
  security: {
    threatsBlocked: number;
    riskScoreAvg: number;
    injectionAttempts: number;
  };
  governance: {
    votesHeld: number;
    proposalsPassed: number;
    proposalsRejected: number;
  };
  audit: {
    eventCount: number;
    chainValid: boolean;
    lastVerified: string;
  };
}
```

## Health Checks

```typescript
// src/ops/health.ts
interface HealthCheck {
  name: string;
  check: () => Promise<boolean>;
  critical: boolean;
}

const healthChecks: HealthCheck[] = [
  {
    name: 'gateway',
    check: async () => {
      const res = await fetch('http://127.0.0.1:3141/health');
      return res.ok;
    },
    critical: true
  },
  {
    name: 'audit_chain',
    check: async () => {
      const result = await Audit.verifyChain();
      return result.valid;
    },
    critical: true
  },
  {
    name: 'agents',
    check: async () => {
      const statuses = await checkAllAgents();
      return Object.values(statuses).every(s => s);
    },
    critical: true
  },
  {
    name: 'memory_manager',
    check: async () => {
      return await memoryManager.healthCheck();
    },
    critical: false
  },
  {
    name: 'disk_space',
    check: async () => {
      const free = await getDiskSpace();
      return free > 1024 * 1024 * 100; // 100MB
    },
    critical: false
  }
];
```

## Alert Rules

```typescript
interface AlertRule {
  name: string;
  condition: (metrics: Metrics) => boolean;
  severity: 'critical' | 'warning' | 'info';
  cooldown: number; // ms between alerts
}

const alertRules: AlertRule[] = [
  {
    name: 'high_memory',
    condition: (m) => m.system.memory.used / m.system.memory.total > 0.9,
    severity: 'warning',
    cooldown: 300000 // 5 min
  },
  {
    name: 'security_threat',
    condition: (m) => m.app.security.threatsBlocked > 10,
    severity: 'critical',
    cooldown: 60000 // 1 min
  },
  {
    name: 'audit_invalid',
    condition: (m) => !m.app.audit.chainValid,
    severity: 'critical',
    cooldown: 0 // Always alert
  },
  {
    name: 'high_latency',
    condition: (m) => m.app.requests.latencyP95 > 500,
    severity: 'warning',
    cooldown: 300000
  },
  {
    name: 'agent_failure_rate',
    condition: (m) => {
      const agents = Object.values(m.app.agents);
      const totalFailed = agents.reduce((sum, a) => sum + a.tasksFailed, 0);
      const totalTasks = agents.reduce((sum, a) => sum + a.tasksCompleted + a.tasksFailed, 0);
      return totalTasks > 0 && (totalFailed / totalTasks) > 0.1;
    },
    severity: 'warning',
    cooldown: 600000
  }
];
```

## Alert Actions

```typescript
async function triggerAlert(rule: AlertRule, metrics: Metrics) {
  const alert = {
    rule: rule.name,
    severity: rule.severity,
    timestamp: new Date().toISOString(),
    metrics: extractRelevantMetrics(rule, metrics)
  };

  // Log to audit
  await eventBus.emit('audit:log', {
    action: 'alert_triggered',
    ...alert
  });

  // Broadcast to dashboard
  await eventBus.emit('monitoring:alert', alert);

  // Log
  logger[rule.severity === 'critical' ? 'error' : 'warn'](
    alert,
    `Alert: ${rule.name}`
  );
}
```

## Dashboard Integration

```typescript
// Metrics endpoint for dashboard
gateway.get('/metrics', async () => ({
  system: await collectSystemMetrics(),
  app: await collectAppMetrics(),
  health: await runHealthChecks(),
  alerts: getActiveAlerts()
}));

// WebSocket real-time updates
setInterval(async () => {
  const metrics = await collectAllMetrics();
  broadcaster.broadcast('metrics:update', metrics);
}, 5000);
```

## CLI Commands

```bash
# View current metrics
npx ari metrics

# View health status
npx ari doctor

# View active alerts
npx ari alerts

# Clear alert (with acknowledgment)
npx ari alerts ack <alert-id>
```

## Metrics Storage

```typescript
// Time-series storage for historical analysis
interface MetricPoint {
  timestamp: string;
  value: number;
}

// Store metrics with retention policy
const RETENTION = {
  '1m': 24 * 60,      // 24 hours of 1-min data
  '5m': 7 * 24 * 12,  // 7 days of 5-min data
  '1h': 30 * 24       // 30 days of hourly data
};
```
