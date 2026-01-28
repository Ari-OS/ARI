import { Command } from 'commander';
import { Gateway } from '../../kernel/gateway.js';

export function registerGatewayCommand(program: Command): void {
  const gateway = program
    .command('gateway')
    .description('Manage ARI Gateway server');

  gateway
    .command('start')
    .description('Start the ARI Gateway server')
    .option('-p, --port <number>', 'Port to bind the gateway to', '3141')
    .action(async (options) => {
      const port = parseInt(options.port, 10);

      if (isNaN(port) || port < 1 || port > 65535) {
        console.error('Error: Invalid port number. Must be between 1 and 65535.');
        process.exit(1);
      }

      const gatewayInstance = new Gateway(port);

      // Graceful shutdown handlers
      const shutdown = async (signal: string) => {
        console.log(`\nReceived ${signal}, shutting down gracefully...`);
        try {
          await gatewayInstance.stop();
          console.log('Gateway stopped successfully');
          process.exit(0);
        } catch (error) {
          console.error('Error during shutdown:', error);
          process.exit(1);
        }
      };

      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));

      try {
        await gatewayInstance.start();
        console.log(`ARI Gateway running at ${gatewayInstance.getAddress()}`);
      } catch (error) {
        console.error('Failed to start gateway:', error);
        process.exit(1);
      }
    });

  gateway
    .command('status')
    .description('Check if the ARI Gateway is running')
    .option('-p, --port <number>', 'Port the gateway is running on', '3141')
    .action(async (options) => {
      const port = parseInt(options.port, 10);
      const url = `http://127.0.0.1:${port}/health`;

      try {
        const response = await fetch(url);
        const data = await response.json();
        console.log('Gateway Status:');
        console.log(JSON.stringify(data, null, 2));
      } catch (error) {
        console.log('Gateway is not running');
        process.exit(1);
      }
    });
}
