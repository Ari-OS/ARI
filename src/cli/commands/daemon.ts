import { Command } from 'commander';
import { installDaemon, uninstallDaemon, getDaemonStatus, getLogPaths } from '../../ops/daemon.js';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { spawn } from 'child_process';

interface DaemonInstallOptions {
  port: string;
  production?: boolean;
}

interface DaemonLogsOptions {
  follow?: boolean;
  lines: string;
}

export function registerDaemonCommand(program: Command): void {
  const daemon = program
    .command('daemon')
    .description('Manage ARI Gateway launchd daemon');

  daemon
    .command('install')
    .description('Install and start the ARI Gateway as a launchd daemon')
    .option('-p, --port <number>', 'Port to bind the gateway to', '3141')
    .option('--production', 'Enable production optimizations for Mac Mini M4 (24GB RAM)')
    .action(async (options: DaemonInstallOptions) => {
      const port = parseInt(options.port, 10);

      if (isNaN(port) || port < 1 || port > 65535) {
        console.error('Error: Invalid port number. Must be between 1 and 65535.');
        process.exit(1);
      }

      try {
        await installDaemon({ port, production: options.production });
        console.log(`Daemon installed successfully at port ${port}`);
        if (options.production) {
          console.log('Production mode enabled with optimized resource limits.');
        }
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

  daemon
    .command('logs')
    .description('View gateway log files')
    .option('-f, --follow', 'Follow log output (like tail -f)')
    .option('-n, --lines <number>', 'Number of lines to show', '50')
    .action(async (options: DaemonLogsOptions) => {
      try {
        const logPaths = getLogPaths();
        const lines = parseInt(options.lines, 10);

        if (isNaN(lines) || lines < 1) {
          console.error('Error: Invalid number of lines. Must be a positive integer.');
          process.exit(1);
        }

        const stdoutExists = existsSync(logPaths.stdout);
        const stderrExists = existsSync(logPaths.stderr);

        if (!stdoutExists && !stderrExists) {
          console.error('No log files found.');
          console.error(`Expected locations:`);
          console.error(`  ${logPaths.stdout}`);
          console.error(`  ${logPaths.stderr}`);
          console.error('');
          console.error('Is the daemon installed and running?');
          process.exit(1);
        }

        if (options.follow) {
          console.log('Following ARI Gateway logs (Ctrl+C to stop)...');
          console.log('');

          // Use tail -f to follow both logs
          const files = [];
          if (stdoutExists) files.push(logPaths.stdout);
          if (stderrExists) files.push(logPaths.stderr);

          const tail = spawn('tail', ['-f', ...files], {
            stdio: 'inherit',
          });

          tail.on('error', (error) => {
            console.error('Failed to follow logs:', error);
            process.exit(1);
          });

          // Handle Ctrl+C gracefully
          process.on('SIGINT', () => {
            tail.kill();
            process.exit(0);
          });
        } else {
          console.log(`ARI Gateway Logs (last ${lines} lines)`);
          console.log('='.repeat(50));
          console.log('');

          if (stdoutExists) {
            console.log('--- STDOUT ---');
            const stdout = await readFile(logPaths.stdout, 'utf-8');
            const stdoutLines = stdout.split('\n').filter(Boolean);
            const displayLines = stdoutLines.slice(-lines);
            console.log(displayLines.join('\n'));
            console.log('');
          }

          if (stderrExists) {
            console.log('--- STDERR ---');
            const stderr = await readFile(logPaths.stderr, 'utf-8');
            const stderrLines = stderr.split('\n').filter(Boolean);
            const displayLines = stderrLines.slice(-lines);
            console.log(displayLines.join('\n'));
            console.log('');
          }

          console.log('Log files:');
          console.log(`  ${logPaths.stdout}`);
          console.log(`  ${logPaths.stderr}`);
        }
      } catch (error) {
        console.error('Failed to read logs:', error);
        process.exit(1);
      }
    });
}
