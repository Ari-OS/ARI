---
name: ari-websocket-patterns
description: WebSocket communication patterns for ARI's real-time features
triggers:
  - "websocket"
  - "real-time communication"
  - "ws connection"
  - "live updates"
---

# ARI WebSocket Patterns

## Purpose

Real-time bidirectional communication for ARI's dashboard and live monitoring features.

## WebSocket Server Setup

```typescript
// src/kernel/websocket.ts
import { WebSocketServer, WebSocket } from 'ws';
import { gateway } from './gateway.js';

const wss = new WebSocketServer({
  server: gateway.server,
  path: '/ws'
});

// Connection handling
wss.on('connection', (ws: WebSocket, request) => {
  // Verify local connection only
  const clientIp = request.socket.remoteAddress;
  if (clientIp !== '127.0.0.1' && clientIp !== '::1') {
    ws.close(1008, 'Only local connections allowed');
    return;
  }

  setupClient(ws);
});
```

## Message Protocol

```typescript
interface WSMessage {
  type: 'event' | 'command' | 'response' | 'error';
  id: string;
  timestamp: string;
  payload: unknown;
}

// Outbound events to dashboard
interface WSEvent extends WSMessage {
  type: 'event';
  payload: {
    event: string;
    data: unknown;
  };
}

// Inbound commands from dashboard
interface WSCommand extends WSMessage {
  type: 'command';
  payload: {
    command: string;
    args: unknown;
  };
}
```

## Event Broadcasting

```typescript
class WSBroadcaster {
  private clients = new Set<WebSocket>();

  addClient(ws: WebSocket) {
    this.clients.add(ws);
    ws.on('close', () => this.clients.delete(ws));
  }

  broadcast(event: string, data: unknown) {
    const message: WSEvent = {
      type: 'event',
      id: uuid(),
      timestamp: new Date().toISOString(),
      payload: { event, data }
    };

    const json = JSON.stringify(message);

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(json);
      }
    }
  }
}

// Connect EventBus to WebSocket
eventBus.on('*', (event, data) => {
  broadcaster.broadcast(event, data);
});
```

## Dashboard Integration

```typescript
// Dashboard-specific events
const DASHBOARD_EVENTS = [
  'agent:status_change',
  'task:progress',
  'governance:vote_cast',
  'security:threat_detected',
  'audit:new_event',
  'memory:stats_update'
];

// Filter events for dashboard
eventBus.on('*', (event, data) => {
  if (DASHBOARD_EVENTS.some(e => event.startsWith(e.split(':')[0]))) {
    broadcaster.broadcast(event, sanitizeForDashboard(data));
  }
});
```

## Command Handling

```typescript
ws.on('message', async (raw: Buffer) => {
  try {
    const message: WSCommand = JSON.parse(raw.toString());

    if (message.type !== 'command') return;

    // Validate command
    const { command, args } = message.payload;

    // All WS commands run as OPERATOR trust
    const result = await executeCommand(command, args, 'OPERATOR');

    ws.send(JSON.stringify({
      type: 'response',
      id: message.id,
      timestamp: new Date().toISOString(),
      payload: result
    }));

  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      id: message.id,
      timestamp: new Date().toISOString(),
      payload: { error: error.message }
    }));
  }
});
```

## Heartbeat

```typescript
const HEARTBEAT_INTERVAL = 30000;

wss.on('connection', (ws) => {
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });
});

setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);
```

## Security Considerations

1. **Loopback only** - Enforced at connection time
2. **Message validation** - All messages parsed and validated
3. **Rate limiting** - Prevent DoS from malicious local process
4. **Audit logging** - All commands logged
5. **No sensitive data** - Sanitize before broadcast

```typescript
function sanitizeForDashboard(data: unknown): unknown {
  // Remove sensitive fields
  if (typeof data === 'object' && data !== null) {
    const sanitized = { ...data };
    delete sanitized.apiKey;
    delete sanitized.secret;
    delete sanitized.token;
    return sanitized;
  }
  return data;
}
```
