---
name: ari-openclaw-plugin-development
description: OpenClaw plugin development patterns — hooks, manifest structure, plugin SDK, APEX/CODEX enforcement
triggers: ["openclaw plugin", "ari plugin", "plugin sdk", "hook registration", "before_prompt_build", "before_tool_call"]
---

# ARI OpenClaw Plugin Development

## Plugin Structure

Every ARI plugin follows this structure:
```
openclaw/plugins/ari-{name}/
├── index.ts              # Plugin entry point (exports default plugin object)
├── package.json          # pnpm dependencies
├── tsconfig.json         # TypeScript strict config
└── src/
    └── {feature}.ts      # Implementation
```

## Plugin Entry Point Pattern

```typescript
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { emptyPluginConfigSchema } from 'openclaw/plugin-sdk';
import { registerMyFeature } from './src/my-feature.js';

const plugin = {
  id: 'ari-{name}',
  name: 'ARI {Name}',
  description: 'What this plugin does',
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi): void {
    registerMyFeature(api);
  },
};

export default plugin;
```

## Hook Patterns

### before_prompt_build (inject context)
```typescript
api.on('before_prompt_build', (event) => {
  // event.prompt is the current prompt text
  const context = buildContext();
  if (!context) return undefined;

  return {
    prependContext: ['[SECTION-TAG]', context].join('\n\n'),
  };
});
```

### before_tool_call (block or allow)
```typescript
api.on('before_tool_call', (event) => {
  const verdict = evaluate(event);
  if (!verdict.block) return undefined;

  return {
    block: true,
    blockReason: verdict.reason,
  };
});
```

## Config Coercion Pattern (type-safe)

```typescript
type PluginConfigShape = {
  path?: string;
  enabled?: boolean;
};

function coerceConfig(raw: unknown): PluginConfigShape {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const rec = raw as Record<string, unknown>;
  return {
    path: typeof rec.path === 'string' ? rec.path : undefined,
    enabled: typeof rec.enabled === 'boolean' ? rec.enabled : undefined,
  };
}
```

## APEX/CODEX Plane Enforcement

In ari-agents, every agent spawn validates context plane:

```typescript
function validateContextBundlePlane(bundle: ContextBundle, agent: AgentRecord): void {
  if (agent.plane === 'codex') {
    if (bundle.soulFile) throw new Error('CODEX agents CANNOT receive SOUL files');
    if (bundle.workspaceFiles?.length) throw new Error('CODEX agents CANNOT receive workspace files');
    if (bundle.businessContext) throw new Error('CODEX agents CANNOT receive business context');
  }
}
// Called before every agent spawn — cannot be bypassed
```

## Workspace File Loading Pattern (ari-workspace)

```typescript
const DEFAULT_WORKSPACE_DIR = '~/.ari/workspace';
const DEFAULT_FILES = ['SOUL.md', 'USER.md', 'HEARTBEAT.md', 'AGENTS.md', 'RECOVERY.md'];
const MAX_FILE_CHARS = 10_000;

function readFileSnippet(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  if (!raw.trim()) return null;
  return raw.slice(0, MAX_FILE_CHARS);
}

// Per-agent SOUL file loading:
// ~/.ari/workspace/agents/{agentName}/SOUL.md
function loadAgentSoulFile(workspaceDir: string, agentName: string): string | null {
  const soulPath = path.join(workspaceDir, 'agents', agentName.toLowerCase(), 'SOUL.md');
  return readFileSnippet(soulPath);
}
```

## Plugin EventBus Integration

Plugins communicate across plugins via EventBus (never direct imports):

```typescript
// Emitting from ari-market:
api.emit('market:snapshot-ready', { snapshot, timestamp });

// Consuming in ari-briefings:
api.on('market:snapshot-ready', (event) => {
  briefingBuilder.addSection('market', event.snapshot);
});
```

## Security Rules (ari-kernel)

ari-kernel runs BEFORE all other plugins. Its hooks execute first.
- sanitizePromptText() → removes unsafe control characters
- assessPromptRisk() → returns { score: 0-1, flags: string[] }
- shouldBlockToolCall() → checks HIGH_RISK_TOOLS + HIGH_RISK_ARGUMENT_MARKERS
- Auto-block at risk ≥ 0.8

API key validation at startup:
```typescript
// sk_or_* = OpenRouter ✅ | sk-ant-* = Anthropic ✅ | other = REJECT
function validateApiKeyFormat(key: string): 'openrouter' | 'anthropic' | 'invalid' {
  if (key.startsWith('sk_or_')) return 'openrouter';
  if (key.startsWith('sk-ant-')) return 'anthropic';
  return 'invalid';
}
```

## Development Commands

```bash
# From openclaw/ repo root:
pnpm install
pnpm build
pnpm test

# Test a specific plugin:
pnpm test -- packages/plugins/ari-kernel/

# Start gateway:
npx openclaw gateway start   # 127.0.0.1:3141
```

## Common Mistakes to Avoid

1. **Wrong path for workspace files:** Use `~/.ari/workspace` NOT `~/.openclaw/workspace`
2. **Direct plugin imports:** Use EventBus, not `import from 'ari-other-plugin'`
3. **Mutable config:** Always use `coerceConfig()` pattern — never trust `api.config` shape
4. **Missing `.js` extensions:** ESM requires `import { x } from './module.js'`
5. **Forgetting APEX/CODEX enforcement:** RUNE/CODEX agents NEVER get SOUL files
