---
name: ari-performance-optimization
description: Performance optimization patterns for ARI's real-time processing
triggers:
  - "optimize performance"
  - "speed up ari"
  - "performance tuning"
  - "latency reduction"
---

# ARI Performance Optimization

## Purpose

Optimize ARI for maximum throughput and minimum latency in real-time agent operations.

## Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| Message latency | <100ms | <500ms |
| Sanitization | <10ms | <50ms |
| Agent response | <1s | <5s |
| Memory usage | <256MB | <512MB |
| Audit write | <5ms | <20ms |

## Optimization Areas

### 1. EventBus Optimization

```typescript
// Use async event emission
eventBus.emit('event', data); // Fire and forget

// Batch related events
eventBus.emitBatch([
  { event: 'task:started', data: {...} },
  { event: 'audit:log', data: {...} }
]);

// Priority queues for critical events
eventBus.emitPriority('security:threat', data, 'high');
```

### 2. Sanitizer Performance

```typescript
// Pre-compile regex patterns
const COMPILED_PATTERNS = PATTERNS.map(p => new RegExp(p, 'gi'));

// Early exit on first high-risk match
function fastScan(content: string): boolean {
  for (const pattern of HIGH_RISK_PATTERNS) {
    if (pattern.test(content)) return true;
  }
  return false;
}

// Use string methods when possible (faster than regex)
if (content.includes('DROP TABLE')) {
  return { risk: 1.0, immediate: true };
}
```

### 3. Memory Management

```typescript
// Stream large payloads
async function processLargeMessage(stream: Readable) {
  for await (const chunk of stream) {
    await processChunk(chunk);
  }
}

// Clear references after use
function cleanup(task: Task) {
  task.context = null;
  task.result = null;
}

// Use WeakMap for caches
const cache = new WeakMap<Message, ProcessedResult>();
```

### 4. Audit Trail Optimization

```typescript
// Batch audit writes
const auditBuffer: AuditEvent[] = [];
const BATCH_SIZE = 100;
const FLUSH_INTERVAL = 1000;

function queueAudit(event: AuditEvent) {
  auditBuffer.push(event);
  if (auditBuffer.length >= BATCH_SIZE) {
    flush();
  }
}

setInterval(flush, FLUSH_INTERVAL);
```

### 5. Agent Pipeline Optimization

```typescript
// Parallel independent operations
const [guardianResult, plannerPrep] = await Promise.all([
  guardian.assess(message),
  planner.prepare(message.intent)
]);

// Cache frequent lookups
const trustCache = new LRUCache<string, TrustLevel>({
  max: 1000,
  ttl: 1000 * 60 * 5 // 5 minutes
});
```

### 6. Node.js Tuning

```bash
# Increase memory limit
node --max-old-space-size=512 dist/index.js

# Enable V8 optimizations
node --optimize-for-size dist/index.js

# Use cluster mode for multi-core
node --experimental-cluster dist/index.js
```

## Profiling

```bash
# CPU profiling
node --cpu-prof dist/index.js

# Memory profiling
node --heap-prof dist/index.js

# Trace GC
node --trace-gc dist/index.js
```

## Benchmarks

```typescript
// Built-in benchmarking
import { performance } from 'node:perf_hooks';

const start = performance.now();
await operation();
const duration = performance.now() - start;

logger.info({ operation: 'sanitize', duration }, 'Benchmark');
```

## Monitoring

Key metrics to track:
- Event queue depth
- Memory heap size
- GC pause duration
- Request latency percentiles (p50, p95, p99)
- Agent response times
