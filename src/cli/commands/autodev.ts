import { Command } from 'commander';
import { EventBus } from '../../kernel/event-bus.js';
import { AIOrchestrator } from '../../ai/orchestrator.js';
import { AutoDeveloper } from '../../agents/auto-developer.js';
import { loadConfig } from '../../kernel/config.js';
import fs from 'node:fs/promises';
import path from 'node:path';

export function registerAutoDevCommand(program: Command): void {
  program
    .command('autodev')
    .description('Run the autonomous AutoDeveloper on a specific task')
    .option('-t, --task <file>', 'Path to the task file containing instructions')
    .option('--test-command <cmd>', 'Command to run tests (e.g. "npm test")')
    .option('--max-iterations <num>', 'Maximum self-correction loops', '5')
    .action(async (options: { task?: string; testCommand?: string; maxIterations: string }) => {
      console.log('Initializing AutoDeveloper...');
      
      const config = await loadConfig();
      const eventBus = new EventBus();
      const orchestrator = new AIOrchestrator(eventBus, {
        featureFlags: (config as { ai?: { featureFlags?: Record<string, boolean> } }).ai?.featureFlags,
      });

      const developer = new AutoDeveloper(eventBus, orchestrator, process.cwd());

      let goal = 'Improve the codebase';
      if (options.task) {
        try {
          goal = await fs.readFile(path.resolve(options.task), 'utf-8');
          console.log(`Loaded task from ${options.task}`);
        } catch (e) {
          console.error(`Failed to read task file: ${String(e)}`);
          process.exit(1);
        }
      }

      const result = await developer.executeTask({
        id: `autodev-${Date.now()}`,
        goal,
        filesToEdit: [], // the agent will decide which files to read/write based on the goal
        testCommand: options.testCommand,
        maxIterations: parseInt(options.maxIterations, 10),
      });

      if (result.success) {
        console.log('✅ AutoDeveloper finished successfully.');
        console.log(`Iterations: ${result.iterations}`);
        console.log(`Files changed: ${result.filesChanged.join(', ')}`);
        
        // Write the completion file for AgentSpawner to pick up
        await fs.writeFile(
          path.resolve(process.cwd(), '.ari-completed'),
          JSON.stringify({
            initiativeId: 'manual',
            summary: result.finalOutput,
            filesChanged: result.filesChanged,
          }, null, 2),
          'utf-8'
        );
        process.exit(0);
      } else {
        console.error('❌ AutoDeveloper failed or hit maximum iterations.');
        console.error(result.finalOutput);
        
        await fs.writeFile(
          path.resolve(process.cwd(), '.ari-failed'),
          result.finalOutput,
          'utf-8'
        );
        process.exit(1);
      }
    });
}
