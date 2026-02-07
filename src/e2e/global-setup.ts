import { chromium, FullConfig } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createLogger } from '../kernel/logger.js';

const logger = createLogger('e2e-setup');

async function globalSetup(config: FullConfig) {
  logger.info('E2E Global Setup');

  // 1. Ensure output directories exist
  const e2eDir = path.join(process.env.HOME || '~', '.ari', 'e2e');
  await fs.mkdir(path.join(e2eDir, 'reports'), { recursive: true });
  await fs.mkdir(path.join(e2eDir, 'artifacts'), { recursive: true });
  await fs.mkdir(path.join(e2eDir, 'screenshots'), { recursive: true });

  // 2. Wait for gateway to be ready
  const browser = await chromium.launch();
  const page = await browser.newPage();

  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    try {
      const baseURL = config.projects[0]?.use?.baseURL || 'http://127.0.0.1:3141';
      const response = await page.request.get(`${baseURL}/api/health`);
      if (response.ok()) {
        logger.info('Gateway is ready');
        break;
      }
    } catch {
      // Gateway not ready yet
    }

    attempts++;
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (attempts === maxAttempts) {
      await browser.close();
      throw new Error('Gateway did not become ready in time');
    }
  }

  await browser.close();

  // 3. Store test run metadata
  const runId = randomUUID();
  process.env.E2E_RUN_ID = runId;

  await fs.writeFile(
    path.join(e2eDir, 'current-run.json'),
    JSON.stringify({
      runId,
      startedAt: new Date().toISOString(),
      config: {
        workers: config.workers,
        projects: config.projects.map(p => p.name),
      },
    }, null, 2)
  );

  logger.info({ runId: runId.slice(0, 8) }, 'Test run initialized');
}

export default globalSetup;
