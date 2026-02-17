# Sync ARI to MacBook Air

**Created**: 2026-02-17
**Status**: GitHub suspended — use local sync methods

## Quick Summary

Mac Mini is at commit `58c369b` with all work complete:
- X API pay-per-use credit system ✅
- Growth marketing engine ✅
- Figma MCP integration ✅
- Gmail client ✅
- 5,675 tests passing ✅
- Full performance analysis docs ✅

## Sync Methods

### Option 1: AirDrop Bundle (Easiest)

1. On Mac Mini, the bundle is at: `/tmp/ari-sync/ari-full.bundle`
2. AirDrop to MacBook Air
3. On MacBook Air:
   ```bash
   cd ~/ARI
   git fetch /path/to/ari-full.bundle main:main
   git checkout main
   ```

### Option 2: Direct Network Copy

1. Ensure both machines are on same network
2. On MacBook Air:
   ```bash
   scp ari@100.81.73.34:/tmp/ari-sync/ari-full.bundle ~/Downloads/
   cd ~/ARI
   git fetch ~/Downloads/ari-full.bundle main:main
   git checkout main
   ```

### Option 3: SMB/AFP File Sharing

1. On Mac Mini: System Settings → General → Sharing → File Sharing ON
2. On MacBook Air: Finder → Go → Connect to Server → `smb://100.81.73.34`
3. Copy `/tmp/ari-sync/ari-full.bundle` to MacBook
4. Apply as in Option 1

### Option 4: Create Fresh Clone from Backup

Mac Mini has a local backup at `/Users/ari/ARI.git`:
```bash
# On MacBook Air
git clone ssh://ari@100.81.73.34/Users/ari/ARI.git ~/ARI-fresh
cd ~/ARI-fresh
npm install
npm test
```

## What's New Since Last Sync

### Commits Added
```
58c369b test(system): add x api credit client tests and performance docs
70d6f95 feat(x-api): implement pay-per-use credit system with cost optimization
```

### New Files

**X API Credit System (4 files)**:
- `src/integrations/twitter/x-types.ts` — Pricing constants and types
- `src/integrations/twitter/x-dedup-cache.ts` — UTC-day deduplication
- `src/integrations/twitter/x-cost-tracker.ts` — Real-time spending tracker
- `src/integrations/twitter/x-credit-client.ts` — Budget-aware API client

**Tests**:
- `tests/unit/integrations/twitter/x-credit-client.test.ts` — 59 tests

**Performance Docs**:
- `docs/performance/PERFORMANCE-ANALYSIS.md`
- `docs/performance/PERFORMANCE-RECOMMENDATIONS.md`
- `docs/performance/PERFORMANCE-SUMMARY.md`
- `docs/performance/PERFORMANCE-INDEX.md`

## Verification After Sync

```bash
cd ~/ARI
npm install
npm run typecheck  # Should pass
npm test           # 5,675 tests should pass
git log --oneline -5  # Should show 58c369b at top
```

## GitHub Account

Account is currently suspended. After resolving:
```bash
git push origin main
```

Contact: https://support.github.com
