# Troubleshooting Guide

Common issues and solutions for ARI setup and operation.

---

## Installation Issues

### `better-sqlite3` build fails

**Symptom:** `Error: Cannot find module '../build/Release/better_sqlite3.node'`

**Cause:** Native module not compiled for current Node.js version.

**Fix:**

```bash
cd node_modules/better-sqlite3
npx node-gyp rebuild
cd ../..
npm test -- tests/unit/system/vector-store.test.ts
```

If `node-gyp` is not installed:

```bash
npm install -g node-gyp
```

If Xcode command line tools missing (macOS):

```bash
xcode-select --install
```

---

### `npm install` fails with husky error

**Symptom:** `husky: command not found` during `npm install`

**Cause:** Husky post-install script requires husky to be installed first.

**Fix (Mac Mini and CI):**

```bash
npm install --ignore-scripts
# Then manually run build:
npm run build
```

---

### `NODE_ENV=production` causes dev dependency issues

**Symptom:** Missing modules like `vitest` during test run on Mac Mini.

**Cause:** Mac Mini shell profile sets `NODE_ENV=production`, skipping devDependencies.

**Fix:**

```bash
NODE_ENV=development npm install --ignore-scripts
NODE_ENV=development npm run build
```

---

## Gateway Issues

### Gateway won't start (port conflict)

**Symptom:** `EADDRINUSE: address already in use 127.0.0.1:3141`

**Fix:**

```bash
# Find what's on port 3141
lsof -i :3141
# Kill it
kill -9 <PID>
# Or restart:
npm run build && npx ari gateway start
```

---

### Gateway starts but health check fails

**Symptom:** `curl http://127.0.0.1:3141/health` returns connection refused

**Fix:**

```bash
# Check gateway is actually running:
ps aux | grep "ari gateway"
# Check logs:
tail -20 ~/.ari/logs/gateway-stdout.log
tail -20 ~/.ari/logs/gateway-stderr.log
# Verify env:
cat ~/.ari/.env | grep -c "=" # Should show 20+ vars
```

---

## Daemon Issues

### Daemon not starting

**Symptom:** `launchctl list | grep ari.daemon` shows no entry

**Fix:**

```bash
# Check plist exists:
ls ~/Library/LaunchAgents/com.ari.daemon.plist
# If missing, install:
npm run build && npx ari daemon install
# Load:
launchctl load ~/Library/LaunchAgents/com.ari.daemon.plist
launchctl start com.ari.daemon
# Verify:
launchctl list | grep ari.daemon
```

---

### Daemon exits immediately

**Symptom:** PID shows briefly then daemon is gone

**Fix:**

```bash
tail -50 ~/.ari/logs/daemon.log
tail -50 ~/.ari/logs/daemon-error.log
# Most common cause: missing ANTHROPIC_API_KEY
cat ~/.ari/.env | grep ANTHROPIC_API_KEY
```

---

### No morning briefings received

**Symptom:** Last briefing was days ago; daemon is running but nothing in Telegram

**Diagnosis:**

```bash
# Check briefing log:
grep "morning" ~/.ari/logs/daemon.log | tail -10
# Check scheduler tasks:
curl http://127.0.0.1:3141/api/scheduler/tasks | python3 -m json.tool | grep -A3 "morning"
# Manually trigger:
npx ari autonomous trigger morning-briefing
```

**Common causes:**

- Scheduler tasks disabled (check task enabled status)
- Telegram bot token expired
- ANTHROPIC_API_KEY rate limited

---

## Test Failures

### VectorStore tests all failing (~70 failures)

**Symptom:** All vector-store.test.ts tests fail with database errors

**Cause:** `~/.ari/data/` directory doesn't exist for SQLite database

**Fix:**

```bash
mkdir -p ~/.ari/data
npm rebuild better-sqlite3 --ignore-scripts=false
npm test -- tests/unit/system/vector-store.test.ts
```

---

### ConversationStore shutdown() undefined

**Symptom:** `Cannot read properties of undefined (reading 'shutdown')`

**Cause:** ConversationStore constructor returned undefined or missing shutdown() method

**Fix:**

```bash
# Check the class:
grep -n "shutdown" src/plugins/telegram-bot/conversation-store.ts
# Verify the class exports correctly and has async shutdown(): Promise<void>
npm test -- tests/unit/plugins/telegram-bot/conversation-store.test.ts 2>&1 | head -30
```

---

### executor.ts tests fail with `registerPolicy` error

**Symptom:** `Cannot read properties of undefined (reading 'registerPolicy')`

**Cause:** `PolicyEngine` not injected; dynamic import resolves after test synchronously calls methods

**Fix:**

```typescript
// In test files, inject PolicyEngine via constructor:
import { PolicyEngine } from '../../../src/governance/policy-engine.js';
executor = new Executor(auditLogger, eventBus, new PolicyEngine(auditLogger, eventBus));
```

---

### Pre-commit hook `npm: command not found`

**Symptom:** Commit fails with npm not found in husky

**Cause:** Husky runs in minimal PATH that doesn't include Homebrew Node.js

**Fix (already applied):**

```bash
# .husky/pre-commit already has this line:
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
```

If still failing, check Node.js path:

```bash
which node
# Should be: /opt/homebrew/opt/node@22/bin/node
```

---

### health-monitor test fails intermittently

**Symptom:** Expected 4 calls, received 5 after `stop()`

**Cause:** Timing race — one in-flight tick may fire just before stop() cancels interval

**This is already fixed** — assertion now uses `toBeLessThanOrEqual(1)` instead of exact count.

---

## Telegram Issues

### Bot not responding

**Symptom:** Messages sent to @ari_pryce_bot get no response

**Diagnosis:**

```bash
# Check bot token is valid:
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe"
# Check Telegram plugin running:
curl http://127.0.0.1:3141/api/status
# Check logs:
grep "telegram" ~/.ari/logs/daemon.log | tail -20
```

---

### Telegram typing indicator not appearing

**Symptom:** Bot responds without typing indicator first

**Cause:** Fast chain model (haiku-4.5) not routing correctly, or `sendChatAction` call missing

**Diagnosis:** Check `src/plugins/telegram-bot/bot.ts` for `sendChatAction` before AI call

---

## SSH / Mac Mini Issues

### SSH connection refused

```bash
# Verify Tailscale is running on both machines:
tailscale status
# Check Mac Mini IP:
# Should be 100.81.73.34 (verify with: tailscale ip on Mac Mini)
ssh -o ConnectTimeout=10 -i ~/.ssh/id_ed25519 ari@100.81.73.34
```

---

### Node.js not found on Mac Mini via SSH

**Symptom:** `node: command not found` in SSH session

**Fix:**

```bash
ssh -i ~/.ssh/id_ed25519 ari@100.81.73.34 "source ~/.zshrc 2>/dev/null; source ~/.zprofile 2>/dev/null; node --version"
# Always source shell profiles first in SSH commands
```

---

## TypeScript / ESLint Issues

### `no-unsafe-member-access` on EventBus handler

**Symptom:** ESLint error on `payload.someField` in event handler

**Cause:** Event handler typed as `(payload: any)` -> accessing properties is "unsafe"

**Fix:** Use `(payload: unknown)` and cast inside:

```typescript
this.eventBus.on('some:event', (raw) => {
  const payload = raw as { field: string };
  // Now safe to use payload.field
});
```

---

### `async` function with no `await` error

**Symptom:** `@typescript-eslint/require-await` error

**Fix:**

```typescript
// Remove async:
function doThing(): string { return 'value'; }
// Or if return type must be Promise:
function doThing(): Promise<string> { return Promise.resolve('value'); }
```

---

### Layer import violation

**Symptom:** ESLint or architectural error: "L3 importing from L4"

**Fix:** Use EventBus for cross-layer communication:

```typescript
// WRONG (L3 directly importing L4):
import { PolicyEngine } from '../governance/policy-engine.js';

// RIGHT (L3 emits event, L4 listens):
this.eventBus.emit('policy:check_requested', { ... });
// Or use DI: inject PolicyEngine via constructor param in tests
```

---

## Common Commitlint Errors

### `subject-case: sentence-case`

**Symptom:** Commit rejected: "subject may not be sentence-case"

**Fix:** Use lowercase subject:

```bash
# WRONG:
git commit -m "Fix the bug in executor"
# RIGHT:
git commit -m "fix(agents): resolve executor race condition"
```

### Scope not in allowed list

**Allowed scopes:** `cognition, kernel, system, agents, governance, autonomous, api, cli, dashboard, ops, docs, deps, repo, changelog, learning, knowledge`

---

*Last updated: February 2026*
