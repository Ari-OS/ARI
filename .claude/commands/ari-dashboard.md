---
name: ari-dashboard
description: Comprehensive ARI system dashboard
---

# /ari-dashboard

Display comprehensive ARI system status and metrics.

## Dashboard Output

```
╔═══════════════════════════════════════════════════════════════════╗
║                        ARI DASHBOARD                               ║
║                     Artificial Reasoning Intelligence              ║
╠═══════════════════════════════════════════════════════════════════╣
║ SYSTEM STATUS                                                      ║
║ ┌─────────────┬─────────┬─────────────────────────────────────┐   ║
║ │ Component   │ Status  │ Details                             │   ║
║ ├─────────────┼─────────┼─────────────────────────────────────┤   ║
║ │ Gateway     │ ● OK    │ 127.0.0.1:3141                      │   ║
║ │ Daemon      │ ● OK    │ PID 12345, uptime 2d 4h             │   ║
║ │ Audit       │ ● OK    │ Chain valid, 1,234 events           │   ║
║ │ Memory      │ ● OK    │ 456 entries, 12MB                   │   ║
║ │ Council     │ ● OK    │ 15 members, quorum active           │   ║
║ └─────────────┴─────────┴─────────────────────────────────────┘   ║
╠═══════════════════════════════════════════════════════════════════╣
║ AGENTS                                                             ║
║ ┌──────────────┬─────────┬────────┬────────────┐                  ║
║ │ Agent        │ Status  │ Tasks  │ Success    │                  ║
║ ├──────────────┼─────────┼────────┼────────────┤                  ║
║ │ CORE         │ Active  │ 0      │ 99.8%      │                  ║
║ │ GUARDIAN     │ Active  │ 0      │ 100%       │                  ║
║ │ PLANNER      │ Idle    │ 0      │ 98.5%      │                  ║
║ │ EXECUTOR     │ Active  │ 2      │ 97.2%      │                  ║
║ │ MEMORY       │ Active  │ 0      │ 100%       │                  ║
║ └──────────────┴─────────┴────────┴────────────┘                  ║
╠═══════════════════════════════════════════════════════════════════╣
║ SECURITY                                                           ║
║ ┌────────────────────────────────────────────────────────────┐    ║
║ │ Threats blocked (24h): 0                                   │    ║
║ │ Audit chain integrity: VALID                               │    ║
║ │ Last security scan: 2h ago                                 │    ║
║ │ Trust level distribution:                                  │    ║
║ │   SYSTEM: 5%  OPERATOR: 80%  VERIFIED: 10%  OTHER: 5%      │    ║
║ └────────────────────────────────────────────────────────────┘    ║
╠═══════════════════════════════════════════════════════════════════╣
║ PERFORMANCE                                                        ║
║ ┌────────────────────────────────────────────────────────────┐    ║
║ │ Avg message latency: 8ms                                   │    ║
║ │ Messages processed (24h): 1,234                            │    ║
║ │ Memory usage: 45MB / 256MB                                 │    ║
║ │ CPU usage: 2.3%                                            │    ║
║ └────────────────────────────────────────────────────────────┘    ║
╠═══════════════════════════════════════════════════════════════════╣
║ RECENT ACTIVITY                                                    ║
║ • 10:30 - Task completed: Code review                             ║
║ • 10:25 - Memory stored: circuit_breaker_pattern                  ║
║ • 10:20 - Audit: user_login                                       ║
║ • 10:15 - Council vote: APPROVED policy_update                    ║
╚═══════════════════════════════════════════════════════════════════╝
```

## Dashboard Sections

### 1. System Status
Core component health:
- Gateway: API server status
- Daemon: Background service
- Audit: Chain integrity
- Memory: Storage health
- Council: Governance status

### 2. Agents
Agent operational status:
- Current activity
- Task queue
- Success rates

### 3. Security
Security posture:
- Threat activity
- Audit integrity
- Trust distribution

### 4. Performance
Resource utilization:
- Latency metrics
- Throughput
- Resource usage

### 5. Recent Activity
Latest events:
- Task completions
- Memory operations
- Audit events
- Governance actions

## Options

```
/ari-dashboard          # Full dashboard
/ari-dashboard agents   # Agents section only
/ari-dashboard security # Security section only
/ari-dashboard perf     # Performance section only
/ari-dashboard activity # Recent activity only
```
