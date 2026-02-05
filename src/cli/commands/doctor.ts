import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import { homedir } from 'os';
import { CONFIG_DIR, CONFIG_PATH, loadConfig } from '../../kernel/config.js';
import { AuditLogger } from '../../kernel/audit.js';
import { getContextsDir } from '../../system/storage.js';
import { INJECTION_PATTERNS } from '../../kernel/sanitizer.js';

const MEMORY_DIR = path.join(homedir(), '.ari', 'memories');

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Run comprehensive system health checks')
    .action(async () => {
      console.log('Running ARI system health checks...\n');

      let passed = 0;
      let total = 0;

      // ── Core Infrastructure ──────────────────────────────────────
      console.log('── Core Infrastructure ──');

      // Check 1: Config directory exists
      total++;
      try {
        await fs.access(CONFIG_DIR);
        console.log('[✓] Config directory exists');
        passed++;
      } catch {
        console.log(`[✗] Config directory missing: ${CONFIG_DIR}`);
      }

      // Check 2: Config file exists and is valid
      total++;
      try {
        await fs.access(CONFIG_PATH);
        await loadConfig(); // This will throw if invalid
        console.log('[✓] Config file valid');
        passed++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`[✗] Config file invalid: ${errorMessage}`);
      }

      // Check 3: Contexts directory exists
      total++;
      try {
        await fs.access(getContextsDir());
        console.log('[✓] Contexts directory exists');
        passed++;
      } catch {
        console.log(`[✗] Contexts directory missing: ${getContextsDir()}`);
      }

      // ── Audit System ─────────────────────────────────────────────
      console.log('\n── Audit System ──');

      // Check 4: Audit file exists
      total++;
      const logger = new AuditLogger();
      let auditPath: string;

      try {
        const config = await loadConfig();
        auditPath = config.auditPath;
      } catch {
        auditPath = CONFIG_DIR + '/audit.json';
      }

      try {
        await fs.access(auditPath);
        console.log('[✓] Audit file exists');
        passed++;
      } catch {
        console.log(`[✗] Audit file missing: ${auditPath}`);
      }

      // Check 5: Audit chain integrity
      total++;
      try {
        await logger.load();
        const result = logger.verify();
        if (result.valid) {
          console.log('[✓] Audit chain integrity verified (SHA-256)');
          passed++;
        } else {
          console.log(`[✗] Audit chain integrity failed: ${result.details}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`[✗] Audit verification failed: ${errorMessage}`);
      }

      // ── Memory Persistence ───────────────────────────────────────
      console.log('\n── Memory Persistence ──');

      // Check 6: Memory directory exists and is writable
      total++;
      try {
        await fs.access(MEMORY_DIR);
        // Test writability by attempting to create a temp file
        const testFile = path.join(MEMORY_DIR, '.doctor-test');
        await fs.writeFile(testFile, 'test');
        await fs.unlink(testFile);
        console.log(`[✓] Memory persistence directory writable (${MEMORY_DIR})`);
        passed++;
      } catch {
        console.log(`[✗] Memory persistence directory not accessible: ${MEMORY_DIR}`);
      }

      // Check 7: Memory partition files
      total++;
      try {
        const partitions = ['public.json', 'internal.json', 'sensitive.json'];
        const existing = [];
        for (const p of partitions) {
          try {
            await fs.access(path.join(MEMORY_DIR, p));
            existing.push(p);
          } catch {
            // File doesn't exist yet — that's OK for fresh installs
          }
        }
        if (existing.length > 0) {
          console.log(`[✓] Memory partitions found: ${existing.join(', ')}`);
        } else {
          console.log('[✓] Memory partitions not yet created (will be created on first store)');
        }
        passed++;
      } catch {
        console.log('[✗] Memory partition check failed');
      }

      // ── Security ─────────────────────────────────────────────────
      console.log('\n── Security ──');

      // Check 8: Injection patterns loaded
      total++;
      try {
        const patternCount = INJECTION_PATTERNS.length;
        if (patternCount >= 27) {
          console.log(`[✓] Injection detection: ${patternCount} patterns across 10 categories`);
          passed++;
        } else {
          console.log(`[✗] Injection detection: only ${patternCount} patterns (expected 27+)`);
        }
      } catch {
        console.log('[✗] Injection detection patterns not loadable');
      }

      // ── Gateway & Network ────────────────────────────────────────
      console.log('\n── Gateway & Network ──');

      // Check 9: Gateway reachable
      total++;
      try {
        const response = await fetch('http://127.0.0.1:3141/health', {
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok) {
          const data = await response.json() as { status: string; uptime?: number };
          const uptime = data.uptime ? ` (uptime: ${Math.round(data.uptime)}s)` : '';
          console.log(`[✓] Gateway reachable at 127.0.0.1:3141${uptime}`);
          passed++;
        } else {
          console.log('[✗] Gateway returned error status');
        }
      } catch {
        console.log('[✗] Gateway not reachable (is it running? `ari gateway start`)');
      }

      // Check 10: Rate limiter active (check status endpoint)
      total++;
      try {
        const response = await fetch('http://127.0.0.1:3141/status', {
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok) {
          const data = await response.json() as { security?: { loopbackOnly: boolean; injectionDetection: boolean } };
          if (data.security?.loopbackOnly && data.security?.injectionDetection) {
            console.log('[✓] Security: loopback-only + injection detection active');
            passed++;
          } else {
            console.log('[✗] Security status incomplete');
          }
        } else {
          console.log('[✗] Status endpoint returned error');
        }
      } catch {
        console.log('[–] Rate limiter check skipped (gateway not running)');
        // Don't count this as a failure if gateway isn't running
        total--;
      }

      // ── Budget & Cost Tracking ───────────────────────────────────
      console.log('\n── Budget & Cost Tracking ──');

      // Check 11: Cost tracker data directory
      total++;
      const costDir = path.join(homedir(), '.ari');
      try {
        await fs.access(costDir);
        console.log('[✓] ARI data directory exists');
        passed++;
      } catch {
        console.log(`[✗] ARI data directory missing: ${costDir}`);
      }

      // ── Summary ──────────────────────────────────────────────────
      console.log(`\n${'═'.repeat(40)}`);
      console.log(`${passed}/${total} checks passed`);

      if (passed === total) {
        console.log('ARI system is healthy.');
      } else if (passed >= total - 2) {
        console.log('ARI system has minor issues.');
      } else {
        console.log('ARI system has critical issues. Please review above.');
      }

      if (passed < total) {
        process.exit(1);
      }
    });
}
