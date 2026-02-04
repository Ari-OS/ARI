import { Command } from 'commander';
import { ensureConfigDir, saveConfig, DEFAULT_CONFIG } from '../../kernel/config.js';
import { AuditLogger } from '../../kernel/audit.js';
import { ensureContextsDir } from '../../system/storage.js';

export function registerOnboardCommand(program: Command): void {
  const onboard = program
    .command('onboard')
    .description('ARI system initialization and onboarding');

  onboard
    .command('init')
    .description('Initialize ARI V2.0 system')
    .action(async () => {
      console.log('Initializing ARI V2.0 (Aurora Protocol)...\n');

      try {
        // Step 1: Create config directory
        await ensureConfigDir();
        console.log('[✓] Created config directory');

        // Step 2: Save default configuration
        await saveConfig(DEFAULT_CONFIG);
        console.log('[✓] Saved default configuration');

        // Step 3: Initialize contexts directory
        await ensureContextsDir();
        console.log('[✓] Initialized contexts directory');

        // Step 4: Initialize audit log
        const logger = new AuditLogger();
        await logger.log('system_initialized', 'system', 'system', {
          version: '2.1.0',
          protocol: 'aurora',
          timestamp: new Date().toISOString(),
        });
        console.log('[✓] Initialized audit log');

        // Success message
        console.log('\nARI V2.1 (Aurora Protocol) initialization complete.');
        console.log("Run 'ari doctor' to verify system health.");
      } catch (error) {
        console.error('\nInitialization failed:', error);
        process.exit(1);
      }
    });
}
