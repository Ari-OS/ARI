import { Command } from 'commander';
import { AuditLogger } from '../../kernel/audit.js';

export function registerAuditCommand(program: Command): void {
  const audit = program
    .command('audit')
    .description('Audit log management and verification');

  audit
    .command('list')
    .description('List recent audit events')
    .option('-n, --count <number>', 'Number of recent events to display', '10')
    .action(async (options) => {
      const count = parseInt(options.count, 10);

      if (isNaN(count) || count < 1) {
        console.error('Error: Count must be a positive number.');
        process.exit(1);
      }

      const logger = new AuditLogger();
      await logger.load();

      const events = logger.getEvents();

      if (events.length === 0) {
        console.log('No audit events found.');
        return;
      }

      // Get the last N events
      const recentEvents = events.slice(-count);

      console.log(`Recent audit events (${recentEvents.length}):\n`);
      recentEvents.forEach((event) => {
        const timestamp = event.timestamp.toISOString();
        const action = event.action;
        const actor = event.actor;
        const trustLevel = event.trustLevel;

        console.log(`[${timestamp}] ${action} (${actor} @ ${trustLevel})`);
      });
    });

  audit
    .command('verify')
    .description('Verify the integrity of the audit chain')
    .action(async () => {
      const logger = new AuditLogger();
      await logger.load();

      const result = await logger.verify();

      if (result.valid) {
        console.log(`✓ ${result.details}`);
      } else {
        console.log(`✗ CHAIN INTEGRITY FAILURE at event ${result.brokenAt}: ${result.details}`);
        process.exit(1);
      }
    });

  audit
    .command('security')
    .description('Show security events from the audit log')
    .action(async () => {
      const logger = new AuditLogger();
      await logger.load();

      const securityEvents = logger.getSecurityEvents();

      if (securityEvents.length === 0) {
        console.log('No security events recorded.');
        return;
      }

      console.log(`Security events (${securityEvents.length}):\n`);
      securityEvents.forEach((event) => {
        const timestamp = event.timestamp.toISOString();
        const details = event.details;

        console.log(`[${timestamp}]`);
        console.log(`  Type: ${details?.eventType}`);
        console.log(`  Severity: ${details?.severity}`);
        console.log(`  Source: ${details?.source}`);
        console.log(`  Mitigated: ${details?.mitigated}`);
        if (details?.details) {
          console.log(`  Details: ${JSON.stringify(details.details, null, 2)}`);
        }
        console.log('');
      });
    });
}
