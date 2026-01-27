import { Command } from 'commander';
import { randomUUID } from 'crypto';
import {
  listContexts,
  getContext,
  saveContext,
  getActiveContext,
  setActiveContext,
  ensureContextsDir,
} from '../../system/storage.js';
import type { Context } from '../../system/types.js';

export function registerContextCommand(program: Command): void {
  const context = program
    .command('context')
    .description('Manage ARI contexts (ventures + life domains)');

  context
    .command('init')
    .description('Initialize the contexts directory')
    .action(async () => {
      await ensureContextsDir();
      console.log('[✓] Contexts directory initialized');
    });

  context
    .command('list')
    .description('List all available contexts')
    .action(async () => {
      const contexts = await listContexts();
      const active = await getActiveContext();

      if (contexts.length === 0) {
        console.log('No contexts found. Use "ari context create" to add one.');
        return;
      }

      console.log('Contexts:\n');
      for (const ctx of contexts) {
        const marker = active.contextId === ctx.id ? ' [ACTIVE]' : '';
        console.log(`  ${ctx.id} — ${ctx.name} (${ctx.type})${marker}`);
        if (ctx.description) console.log(`    ${ctx.description}`);
        console.log(`    triggers: ${ctx.triggers.join(', ')}`);
        console.log('');
      }
    });

  context
    .command('create')
    .description('Create a new context')
    .requiredOption('-n, --name <name>', 'Context name')
    .requiredOption('-t, --type <type>', 'Context type (venture or life)')
    .option('-d, --description <desc>', 'Context description')
    .option('--triggers <triggers>', 'Comma-separated trigger words')
    .action(async (options) => {
      const type = options.type;
      if (type !== 'venture' && type !== 'life') {
        console.error('Error: type must be "venture" or "life"');
        process.exit(1);
      }

      const id = options.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const partition = type === 'venture'
        ? `VENTURE_${id.toUpperCase()}`
        : `LIFE_${id.toUpperCase()}`;

      const ctx: Context = {
        id,
        name: options.name,
        type,
        description: options.description,
        partition,
        triggers: options.triggers
          ? options.triggers.split(',').map((t: string) => t.trim())
          : [options.name.toLowerCase()],
        active: false,
        createdAt: new Date().toISOString(),
      };

      await saveContext(ctx);
      console.log(`[✓] Created context: ${ctx.name} (${ctx.type})`);
      console.log(`    partition: ${ctx.partition}`);
      console.log(`    triggers: ${ctx.triggers.join(', ')}`);
    });

  context
    .command('select')
    .description('Set the active context')
    .argument('<id>', 'Context ID to activate')
    .action(async (id: string) => {
      const ctx = await getContext(id);
      if (!ctx) {
        console.error(`Error: context "${id}" not found`);
        process.exit(1);
      }
      await setActiveContext(id);
      console.log(`[✓] Active context: ${ctx.name} (${ctx.type})`);
    });

  context
    .command('show')
    .description('Show details of a context')
    .argument('<id>', 'Context ID')
    .action(async (id: string) => {
      const ctx = await getContext(id);
      if (!ctx) {
        console.error(`Error: context "${id}" not found`);
        process.exit(1);
      }
      console.log(JSON.stringify(ctx, null, 2));
    });
}
