import { Command } from 'commander';
import { promises as fs } from 'fs';
import { CONFIG_DIR, CONFIG_PATH, loadConfig } from '../../kernel/config.js';
import { AuditLogger } from '../../kernel/audit.js';
import { getContextsDir } from '../../system/storage.js';

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Run system health checks')
    .action(async () => {
      console.log('Running ARI system health checks...\n');

      let passed = 0;
      let total = 0;

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

      // Check 3: Audit file exists
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

      // Check 4: Audit integrity
      total++;
      try {
        await logger.load();
        const result = await logger.verify();
        if (result.valid) {
          console.log('[✓] Audit chain integrity verified');
          passed++;
        } else {
          console.log(`[✗] Audit chain integrity failed: ${result.details}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`[✗] Audit verification failed: ${errorMessage}`);
      }

      // Check 5: Contexts directory exists
      total++;
      try {
        await fs.access(getContextsDir());
        console.log('[✓] Contexts directory exists');
        passed++;
      } catch {
        console.log(`[✗] Contexts directory missing: ${getContextsDir()}`);
      }

      // Check 6: Gateway reachable
      total++;
      try {
        const response = await fetch('http://127.0.0.1:3141/health', {
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok) {
          console.log('[✓] Gateway reachable');
          passed++;
        } else {
          console.log('[✗] Gateway returned error status');
        }
      } catch {
        console.log('[✗] Gateway not reachable');
      }

      // Summary
      console.log(`\n${passed}/${total} checks passed`);

      if (passed < total) {
        process.exit(1);
      }
    });
}
