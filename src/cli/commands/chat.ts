import { Command } from 'commander';
import { createInterface } from 'readline';
import chalk from 'chalk';
import { AIOrchestrator } from '../../ai/orchestrator.js';
import { EventBus } from '../../kernel/event-bus.js';

export function registerChatCommand(program: Command): void {
  program
    .command('chat')
    .description('Start an interactive AI chat session')
    .action(() => {
      // Check for API key
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.error(chalk.red('Error: ANTHROPIC_API_KEY environment variable not set'));
        console.error(chalk.yellow('Please set your Anthropic API key to use chat:'));
        console.error(chalk.cyan('  export ANTHROPIC_API_KEY=your-key-here'));
        process.exit(1);
      }

      // Initialize minimal components
      const eventBus = new EventBus();
      const orchestrator = new AIOrchestrator(eventBus, {
        apiKey,
        defaultModel: 'claude-sonnet-4.6',
      });

      // Conversation history
      const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

      // Setup readline
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.cyan('You > '),
      });

      // Welcome message
      console.log(chalk.bold.blue('\n╔═══════════════════════════════════════╗'));
      console.log(chalk.bold.blue('║      ARI Interactive Chat Session     ║'));
      console.log(chalk.bold.blue('╚═══════════════════════════════════════╝\n'));
      console.log(chalk.gray('Type /help for commands, /exit to quit\n'));

      // Show prompt
      rl.prompt();

      // Handle input
      rl.on('line', (input: string) => {
        void (async () => {
        const trimmed = input.trim();

        // Handle empty input
        if (!trimmed) {
          rl.prompt();
          return;
        }

        // Handle commands
        if (trimmed.startsWith('/')) {
          const command = trimmed.toLowerCase();

          if (command === '/exit' || command === '/quit') {
            console.log(chalk.yellow('\nGoodbye!\n'));
            rl.close();
            process.exit(0);
          } else if (command === '/clear') {
            messages.length = 0;
            console.log(chalk.green('Conversation history cleared\n'));
            rl.prompt();
            return;
          } else if (command === '/context') {
            console.log(chalk.blue(`\nConversation length: ${messages.length} messages`));
            if (messages.length > 0) {
              const userMessages = messages.filter((m) => m.role === 'user').length;
              const assistantMessages = messages.filter((m) => m.role === 'assistant').length;
              console.log(chalk.gray(`  User: ${userMessages}, Assistant: ${assistantMessages}`));
            }
            console.log();
            rl.prompt();
            return;
          } else if (command === '/help') {
            console.log(chalk.blue('\nAvailable commands:'));
            console.log(chalk.gray('  /exit or /quit   - Exit chat session'));
            console.log(chalk.gray('  /clear           - Clear conversation history'));
            console.log(chalk.gray('  /context         - Show conversation length'));
            console.log(chalk.gray('  /help            - Show this help message\n'));
            rl.prompt();
            return;
          } else {
            console.log(chalk.red(`Unknown command: ${command}`));
            console.log(chalk.gray('Type /help for available commands\n'));
            rl.prompt();
            return;
          }
        }

        // Add user message to history
        messages.push({ role: 'user', content: trimmed });

        // Show thinking indicator
        process.stdout.write(chalk.gray('Thinking...\n'));

        try {
          // Get AI response
          const response = await orchestrator.chat(messages);

          // Add assistant response to history
          messages.push({ role: 'assistant', content: response });

          // Display response
          console.log(chalk.green('ARI > ') + response + '\n');
        } catch (error) {
          // Remove user message if request failed
          messages.pop();

          console.error(chalk.red('Error: ') + (error instanceof Error ? error.message : String(error)) + '\n');
        }

        // Show prompt again
        rl.prompt();
        })();
      });

      // Handle Ctrl+C
      rl.on('SIGINT', () => {
        console.log(chalk.yellow('\n\nReceived SIGINT. Exiting...\n'));
        rl.close();
        process.exit(0);
      });

      // Handle close
      rl.on('close', () => {
        process.exit(0);
      });
    });
}
