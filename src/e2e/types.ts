import { z } from 'zod';

export const E2EScenarioResultSchema = z.object({
  scenario: z.string(),
  passed: z.boolean(),
  duration: z.number(), // milliseconds
  error: z.string().optional(),
  screenshot: z.string().optional(), // Path to screenshot
  retries: z.number().default(0),
  tags: z.array(z.string()).default([]),
});

export const E2ETestRunSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  duration: z.number(), // milliseconds
  scenarios: z.array(E2EScenarioResultSchema),
  consecutiveFailures: z.number().int().nonnegative(),
  triggeredBy: z.enum(['manual', 'scheduled', 'ci']),
  issuesFiled: z.array(z.number()).default([]), // GitHub issue numbers
});

export type E2EScenarioResult = z.infer<typeof E2EScenarioResultSchema>;
export type E2ETestRun = z.infer<typeof E2ETestRunSchema>;

export interface E2ELiveRun {
  runId: string;
  scenarioCount: number;
  timestamp: string;
  scenarios: E2EScenarioResult[];
}

export interface E2ERunnerConfig {
  projectRoot: string;
  outputDir: string;
  alertThreshold: number;
  maxRetries: number;
}

export interface RunOptions {
  category?: string;
  tag?: string;
  verbose?: boolean;
  triggeredBy?: 'manual' | 'scheduled' | 'ci';
}
