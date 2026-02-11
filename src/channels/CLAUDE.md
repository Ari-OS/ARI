# Channels Layer

Abstraction layer for multi-channel communication.

## Components

| Component | Purpose |
|-----------|---------|
| base.ts | Base channel interface |
| telegram.ts | Telegram channel adapter |
| email.ts | Email communication channel |
| discord.ts | Discord integration |

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
