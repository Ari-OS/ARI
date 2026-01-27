#!/usr/bin/env node
import { Command } from 'commander';
import { registerGatewayCommand } from './commands/gateway.js';
import { registerAuditCommand } from './commands/audit.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerOnboardCommand } from './commands/onboard.js';
import { registerContextCommand } from './commands/context.js';
import { registerGovernanceCommand } from './commands/governance.js';
import { registerDaemonCommand } from './commands/daemon.js';

const program = new Command();

program
  .name('ari')
  .description('ARI — Artificial Reasoning Intelligence V12.0 (Aurora Protocol)')
  .version('12.0.0');

registerGatewayCommand(program);
registerAuditCommand(program);
registerDoctorCommand(program);
registerOnboardCommand(program);
registerContextCommand(program);
registerGovernanceCommand(program);
registerDaemonCommand(program);

program.parse();
