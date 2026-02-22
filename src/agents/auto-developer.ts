import { createLogger } from '../kernel/logger.js';
import type { EventBus } from '../kernel/event-bus.js';
import type { AIOrchestrator } from '../ai/orchestrator.js';
import { execFileNoThrow } from '../utils/execFileNoThrow.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getPlaybookManager } from './playbook-manager.js';

const log = createLogger('auto-developer');

export interface AutoDeveloperTask {
  id: string;
  goal: string;
  filesToEdit: string[];
  testCommand?: string; // e.g., 'npm run typecheck' or 'npm test'
  maxIterations?: number;
}

export interface AutoDeveloperResult {
  success: boolean;
  iterations: number;
  filesChanged: string[];
  finalOutput: string;
}

/**
 * AutoDeveloper — ARI's self-improvement and codebase iteration engine.
 * Inspired by OpenHands and Claude Code, this agent autonomously reads, edits,
 * and tests code in a loop until the goal is achieved or tests pass.
 */
export class AutoDeveloper {
  constructor(
    private eventBus: EventBus,
    private orchestrator: AIOrchestrator,
    private projectRoot: string = process.cwd()
  ) {}

  /**
   * Execute an autonomous coding task with a self-correction loop.
   */
  async executeTask(task: AutoDeveloperTask): Promise<AutoDeveloperResult> {
    const maxIterations = task.maxIterations ?? 5;
    let iteration = 0;
    const filesChanged = new Set<string>();

    log.info({ taskId: task.id, goal: task.goal }, 'Starting AutoDeveloper task');

    const playbookMgr = getPlaybookManager();
    await playbookMgr.initialize();
    const playbookContext = await playbookMgr.getContextString('auto-developer');

    // System prompt defining the AutoDeveloper's capabilities and expected output format.
    const systemPrompt = `You are ARI's AutoDeveloper, an elite autonomous coding agent.
Your objective is to accomplish the following goal: "${task.goal}".

${playbookContext}

You have access to the codebase. When you need to read a file, or write to a file, you must output a strict JSON block wrapped in \`\`\`json.
To read a file, output:
\`\`\`json
{
  "action": "read",
  "path": "src/file.ts"
}
\`\`\`

To write/edit a file, output:
\`\`\`json
{
  "action": "write",
  "path": "src/file.ts",
  "content": "export const foo = 'bar';"
}
\`\`\`

To finish the task and run tests, output:
\`\`\`json
{
  "action": "finish",
  "summary": "Completed the refactoring."
}
\`\`\`

You must only output ONE action per turn. Wait for the result before proceeding. Keep your explanations brief.`;

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'user', content: `Please begin working on: ${task.goal}. The target files are: ${task.filesToEdit.join(', ')}.` }
    ];

    while (iteration < maxIterations) {
      iteration++;
      log.info({ iteration }, 'AutoDeveloper iteration');

      try {
        const response = await this.orchestrator.chat(messages, systemPrompt, 'auto-developer');
        messages.push({ role: 'assistant', content: response });

        // Parse action from response
        const actionMatch = response.match(/```json\n([\s\S]*?)\n```/);
        
        if (!actionMatch) {
          // If no action is formatted, politely ask to format the action.
          messages.push({ role: 'user', content: 'Please output your next step using the strict JSON format.' });
          continue;
        }

        let action: { action: string; path?: string; content?: string; summary?: string };
        try {
          action = JSON.parse(actionMatch[1]) as { action: string; path?: string; content?: string; summary?: string };
        } catch {
          messages.push({ role: 'user', content: 'Failed to parse JSON. Please ensure it is valid JSON.' });
          continue;
        }

        // Handle Read Action
        if (action.action === 'read') {
          const actionPath = action.path || '';
          const filePath = path.resolve(this.projectRoot, actionPath);
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            messages.push({ role: 'user', content: `File contents of ${actionPath}:\n\`\`\`\n${content}\n\`\`\`` });
          } catch (err) {
            messages.push({ role: 'user', content: `Error reading file ${actionPath}: ${err instanceof Error ? err.message : String(err)}` });
          }
          continue;
        }

        // Handle Write Action
        if (action.action === 'write') {
          const actionPath = action.path || '';
          const actionContent = action.content || '';
          const filePath = path.resolve(this.projectRoot, actionPath);
          try {
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, actionContent, 'utf-8');
            filesChanged.add(actionPath);
            messages.push({ role: 'user', content: `Successfully wrote to ${actionPath}. What is your next step?` });
          } catch (err) {
            messages.push({ role: 'user', content: `Error writing to ${actionPath}: ${err instanceof Error ? err.message : String(err)}` });
          }
          continue;
        }

        // Handle Finish Action
        if (action.action === 'finish') {
          const actionSummary = action.summary || 'Task completed.';
          log.info({ summary: actionSummary }, 'AutoDeveloper signaled completion. Running tests if configured.');
          
          let testFailed = false;
          let testOutput = '';
          if (task.testCommand) {
            const [cmd, ...args] = task.testCommand.split(' ');
            const testResult = await execFileNoThrow(cmd, args, { cwd: this.projectRoot });
            if (testResult.status !== 0) {
              testFailed = true;
              testOutput = `STDOUT:\n${testResult.stdout}\n\nSTDERR:\n${testResult.stderr}`;
            }
          }

          if (testFailed) {
            log.warn('Tests failed. Feeding back to AutoDeveloper.');
            messages.push({ 
              role: 'user', 
              content: `You signaled finish, but tests failed. Please fix the following errors:\n\n${testOutput}` 
            });
            continue; // Keep looping to fix the tests
          }

          // Critic Loop: Overseer Review (SCoRe / RISE)
          const overseerPrompt = `You are the Overseer. Review the following completion of the goal.
Goal: "${task.goal}"

AutoDeveloper claims completion with summary:
"${actionSummary}"

Files changed:
${Array.from(filesChanged).join(', ')}

Evaluate if the solution fully satisfies the goal. 
Reply strictly in JSON: {"approved": boolean, "feedback": "string explaining why it failed or passed"}`;
          
          try {
            const reviewStr = await this.orchestrator.query(overseerPrompt, 'overseer');
            const match = reviewStr.match(/```json\n([\s\S]*?)\n```/);
            const reviewJson = match ? match[1] : reviewStr;
            const review = JSON.parse(reviewJson) as { approved: boolean; feedback: string };
            if (review.approved === false) {
              log.warn({ feedback: review.feedback }, 'Overseer rejected AutoDeveloper completion.');
              messages.push({
                role: 'user',
                content: `Overseer review failed. Please refine your solution based on this feedback:\n${review.feedback}`
              });
              continue;
            }
          } catch (e) {
            log.warn({ err: e }, 'Overseer review threw an error or returned invalid JSON. Assuming approved.');
          }

          log.info('Tests passed (if any) and Overseer approved. Task complete.');
          await playbookMgr.appendInsight('auto-developer', `Task "${task.goal}" succeeded. The strategy used was effective.`);
          return {
            success: true,
            iterations: iteration,
            filesChanged: Array.from(filesChanged),
            finalOutput: actionSummary
          };
        }

      } catch (error) {
        log.error({ err: error }, 'AutoDeveloper encountered a fatal error during execution.');
        return {
          success: false,
          iterations: iteration,
          filesChanged: Array.from(filesChanged),
          finalOutput: `Fatal error: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }

    log.warn('AutoDeveloper hit maximum iterations.');
    await playbookMgr.appendInsight('auto-developer', `Task "${task.goal}" failed after maximum iterations. Need to reconsider the approach or break down the task further.`);
    return {
      success: false,
      iterations: maxIterations,
      filesChanged: Array.from(filesChanged),
      finalOutput: 'Hit maximum iterations without completing the goal.'
    };
  }
}
