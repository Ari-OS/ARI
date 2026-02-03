import { FullConfig } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

async function globalTeardown(_config: FullConfig) {
  console.log('E2E Global Teardown');

  const e2eDir = path.join(process.env.HOME || '~', '.ari', 'e2e');

  // Clean up current run file
  try {
    await fs.unlink(path.join(e2eDir, 'current-run.json'));
  } catch {
    // File may not exist
  }

  // Archive old reports (keep last 30 days)
  const reportsDir = path.join(e2eDir, 'reports');
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  try {
    const entries = await fs.readdir(reportsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const stat = await fs.stat(path.join(reportsDir, entry.name));
        if (stat.mtime.getTime() < thirtyDaysAgo) {
          await fs.rm(path.join(reportsDir, entry.name), { recursive: true });
          console.log(`Cleaned old report: ${entry.name}`);
        }
      }
    }
  } catch {
    // Reports dir may not exist
  }

  console.log('Teardown complete');
}

export default globalTeardown;
