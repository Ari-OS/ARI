import { Command } from 'commander';
import path from 'path';
import { homedir } from 'os';
import {
  generateDiagram,
  saveDiagrams,
  getAvailableTypes,
} from '../../skills/diagram-generator.js';
import type { DiagramType } from '../../skills/diagram-generator.js';

const DEFAULT_OUTPUT_DIR = path.join(homedir(), '.ari', 'diagrams');

export function registerDiagramCommand(program: Command): void {
  program
    .command('diagram')
    .description('Generate architecture diagrams (Mermaid)')
    .argument('[type]', `Diagram type: ${getAvailableTypes().join(', ')}`, 'all')
    .option('-o, --output <dir>', 'Output directory', DEFAULT_OUTPUT_DIR)
    .option('--stdout', 'Print to stdout instead of saving files')
    .action(async (type: string, options: { output: string; stdout?: boolean }) => {
      const validTypes = getAvailableTypes();
      if (!validTypes.includes(type)) {
        console.error(`Unknown diagram type: ${type}`);
        console.error(`Available types: ${validTypes.join(', ')}`);
        process.exit(1);
      }

      const diagrams = generateDiagram(type as DiagramType);

      if (options.stdout) {
        for (const diagram of diagrams) {
          console.log(`# ${diagram.title}\n`);
          console.log('```mermaid');
          console.log(diagram.mermaid);
          console.log('```\n');
        }
        return;
      }

      const paths = await saveDiagrams(diagrams, options.output);
      console.log(`Generated ${paths.length} diagram${paths.length > 1 ? 's' : ''}:`);
      for (const p of paths) {
        console.log(`  ${p}`);
      }
    });
}
