#!/usr/bin/env node
import { config } from 'dotenv';
import { join } from 'path';
import { homedir } from 'os';

// Load .env from ~/.ari/.env (primary) and project root (fallback)
config({ path: join(homedir(), '.ari', '.env') });
config(); // Also load from cwd/.env if present (won't override existing)
import { Command } from 'commander';
import { registerGatewayCommand } from './commands/gateway.js';
import { registerAuditCommand } from './commands/audit.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerOnboardCommand } from './commands/onboard.js';
import { registerContextCommand } from './commands/context.js';
import { registerGovernanceCommand } from './commands/governance.js';
import { registerDaemonCommand } from './commands/daemon.js';
import { registerCognitiveCommand } from './commands/cognitive.js';
import { createAutonomousCommand } from './commands/autonomous.js';
import { createKnowledgeCommand } from './commands/knowledge.js';
import { createAuditReportCommand } from './commands/audit-report.js';
import { registerBudgetCommand } from './commands/budget.js';
import { registerChatCommand } from './commands/chat.js';
import { registerAskCommand } from './commands/ask.js';
import { registerTaskCommand } from './commands/task.js';
import { registerNoteCommand } from './commands/note.js';
import { registerRemindCommand } from './commands/remind.js';
import { registerPlanCommand } from './commands/plan.js';
import { registerPluginCommand } from './commands/plugin.js';
import { registerProviderCommand } from './commands/provider.js';
import { registerCryptoCommand } from './commands/crypto.js';
import { registerPokemonCommand } from './commands/pokemon.js';
import { registerSpeakCommand } from './commands/speak.js';
import { registerDiagramCommand } from './commands/diagram.js';
import { registerVideoCommand } from './commands/video.js';
import { registerYouTubeCommand } from './commands/youtube.js';
import { registerMcpCommand } from './commands/mcp.js';

const program = new Command();

program
  .name('ari')
  .description('ARI — Artificial Reasoning Intelligence V2.0 (Aurora Protocol)')
  .version('2.1.0');

registerGatewayCommand(program);
registerAuditCommand(program);
registerDoctorCommand(program);
registerOnboardCommand(program);
registerContextCommand(program);
registerGovernanceCommand(program);
registerDaemonCommand(program);
registerCognitiveCommand(program);
program.addCommand(createAutonomousCommand());
program.addCommand(createKnowledgeCommand());
program.addCommand(createAuditReportCommand());
registerBudgetCommand(program);
registerChatCommand(program);
registerAskCommand(program);
registerTaskCommand(program);
registerNoteCommand(program);
registerRemindCommand(program);
registerPlanCommand(program);
registerPluginCommand(program);
registerProviderCommand(program);
registerCryptoCommand(program);
registerPokemonCommand(program);
registerSpeakCommand(program);
registerDiagramCommand(program);
registerVideoCommand(program);
registerYouTubeCommand(program);
registerMcpCommand(program);

program.parse();
