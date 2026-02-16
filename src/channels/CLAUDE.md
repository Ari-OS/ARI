# Channels Layer

Abstraction layer for multi-channel communication.

## Components

| Component | Purpose |
|-----------|---------|
| types.ts | Channel interface definitions |
| registry.ts | Channel registry and lookup |
| router.ts | Message routing across channels |
| message-bridge.ts | Bridge between EventBus and channels |
| index.ts | Module exports |

## Channel Interface

```typescript
interface Channel {
  name: string;
  send(message: Message): Promise<void>;
  receive(): AsyncIterable<Message>;
  isConnected(): boolean;
}
```

## Usage

```typescript
import { ChannelManager } from './channels';

const manager = new ChannelManager();
await manager.register('telegram', telegramChannel);
await manager.broadcast({
  content: 'Alert: High CPU usage',
  priority: 'high',
});
```

## Security

- All channels validate messages
- Trust levels propagated
- Audit logging for all sends/receives
