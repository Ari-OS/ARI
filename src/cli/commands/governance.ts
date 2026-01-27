import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Governance CLI — read-only viewer for v12 governance docs.
 * Grounded in v12 GOVERNANCE/*.md: these are reference documents,
 * not executable rules. The CLI surfaces them for operator review.
 */

const GOVERNANCE_DIR = path.join(process.cwd(), 'docs', 'v12', 'GOVERNANCE');

export function registerGovernanceCommand(program: Command): void {
  const governance = program
    .command('governance')
    .description('View ARI governance documents (read-only)');

  governance
    .command('show')
    .description('Show a governance document')
    .argument('[doc]', 'Document name (e.g., GOVERNANCE, ARBITER, OVERSEER)', 'GOVERNANCE')
    .action(async (doc: string) => {
      const fileName = doc.toUpperCase().endsWith('.md')
        ? doc.toUpperCase()
        : `${doc.toUpperCase()}.md`;
      const filePath = path.join(GOVERNANCE_DIR, fileName);

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        console.log(content);
      } catch {
        console.error(`Governance document not found: ${fileName}`);
        console.log('\nAvailable documents:');
        try {
          const files = await fs.readdir(GOVERNANCE_DIR);
          for (const f of files) {
            if (f.endsWith('.md')) {
              console.log(`  - ${f.replace('.md', '').toLowerCase()}`);
            }
          }
        } catch {
          console.error('Governance directory not found. Run from repo root or ensure docs/v12/GOVERNANCE/ exists.');
        }
        process.exit(1);
      }
    });

  governance
    .command('list')
    .description('List all governance documents')
    .action(async () => {
      try {
        const files = await fs.readdir(GOVERNANCE_DIR);
        const mdFiles = files.filter((f) => f.endsWith('.md'));

        if (mdFiles.length === 0) {
          console.log('No governance documents found.');
          return;
        }

        console.log('Governance Documents:\n');
        for (const f of mdFiles) {
          const name = f.replace('.md', '');
          console.log(`  ${name.toLowerCase()}`);
        }
        console.log(`\nUse "ari governance show <name>" to view a document.`);
      } catch {
        console.error('Governance directory not found.');
        process.exit(1);
      }
    });
}
