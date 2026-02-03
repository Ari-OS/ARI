import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

// Environment configuration
const BASE_URL = process.env.ARI_BASE_URL || 'http://127.0.0.1:3141';
const CI = !!process.env.CI;
const E2E_OUTPUT_DIR = process.env.E2E_OUTPUT_DIR || path.join(process.env.HOME || '~', '.ari', 'e2e');

export default defineConfig({
  testDir: './src/e2e/scenarios',

  // Test execution
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: CI, // Fail if .only is left in CI
  retries: CI ? 2 : 0,
  workers: CI ? 1 : undefined, // Serial in CI, parallel locally

  // Reporting
  reporter: [
    ['list'], // Console output
    ['html', {
      outputFolder: path.join(E2E_OUTPUT_DIR, 'reports', 'html'),
      open: 'never',
    }],
    ['json', {
      outputFile: path.join(E2E_OUTPUT_DIR, 'results.json'),
    }],
  ],

  // Output artifacts
  outputDir: path.join(E2E_OUTPUT_DIR, 'artifacts'),

  // Global setup/teardown
  globalSetup: './src/e2e/global-setup.ts',
  globalTeardown: './src/e2e/global-teardown.ts',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',

    // Extra HTTP headers for trust level
    extraHTTPHeaders: {
      'X-Trust-Level': 'operator',
      'X-E2E-Test': 'true',
    },
  },

  // Test projects for different scenarios
  projects: [
    {
      name: 'api',
      testMatch: /api\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'security',
      testMatch: /security\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'cognition',
      testMatch: /cognition\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'dashboard',
      testMatch: /dashboard\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'websocket',
      testMatch: /websocket\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Web server — start ARI gateway before tests
  webServer: {
    command: 'npm run gateway:start',
    url: BASE_URL,
    reuseExistingServer: !CI,
    timeout: 120000,
  },
});
