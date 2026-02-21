---
name: ari-status
description: Check ARI system status, health, and configuration
---

# /ari-status

Quick system status check for ARI.

## What This Command Does

1. **Build Status**

   ```bash
   npm run build 2>&1 | tail -5
   ```

2. **Test Status**

   ```bash
   npm test -- --reporter=dot 2>&1 | tail -10
   ```

3. **Audit Chain Integrity**

   ```bash
   npx ari audit verify
   ```

4. **Daemon Status**

   ```bash
   npx ari daemon status
   ```

5. **System Diagnostics**

   ```bash
   npx ari doctor
   ```

## Output Format

```
╔═══════════════════════════════════════════╗
║            ARI SYSTEM STATUS              ║
╠═══════════════════════════════════════════╣
║ Build:        ✅ Passing                  ║
║ Tests:        ✅ 187/187 passing          ║
║ Coverage:     ✅ 84.2%                    ║
║ Audit Chain:  ✅ Valid (1,234 events)     ║
║ Daemon:       🔴 Not running              ║
║ Gateway:      🔴 Offline                  ║
╚═══════════════════════════════════════════╝
```

## Usage

Just type `/ari-status` in Claude Code when in the ARI directory.
