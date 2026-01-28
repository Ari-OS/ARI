import { Command } from 'commander';
import { installDaemon, uninstallDaemon, getDaemonStatus } from '../../ops/daemon.js';

export function registerDaemonCommand(program: Command): void {
  const daemon = program
    .command('daemon')
    .description('Manage ARI Gateway launchd daemon');

  daemon
    .command('install')
    .description('Install and start the ARI Gateway as a launchd daemon')
    .option('-p, --port <number>', 'Port to bind the gateway to', '3141')
    .action(async (options) => {
      const port = parseInt(options.port, 10);

      if (isNaN(port) || port < 1 || port > 65535) {
        console.error('Error: Invalid port number. Must be between 1 and 65535.');
        process.exit(1);
      }

      try {
        await installDaemon({ port });
        console.log(`Daemon installed successfully at port ${port}`);
        console.log('The gateway will start automatically on login.');
      } catch (error) {
        console.error('Failed to install daemon:', error);
        process.exit(1);
      }
    });

  daemon
    .command('uninstall')
    .description('Stop and remove the ARI Gateway launchd daemon')
    .action(async () => {
      try {
        await uninstallDaemon();
        console.log('Daemon uninstalled successfully');
      } catch (error) {
        console.error('Failed to uninstall daemon:', error);
        process.exit(1);
      }
    });

  daemon
    .command('status')
    .description('Check if the ARI Gateway daemon is installed and running')
    .action(async () => {
      try {
        const status = await getDaemonStatus();
        console.log('Daemon Status:');
        console.log(`  Installed: ${status.installed}`);
        console.log(`  Running: ${status.running}`);
        console.log(`  Plist path: ${status.plistPath}`);
      } catch (error) {
        console.error('Failed to get daemon status:', error);
        process.exit(1);
      }
    });
}
