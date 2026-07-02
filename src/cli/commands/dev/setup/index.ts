import { Command } from 'commander';
import { setupActivitySimulatorCommand } from './activity-simulator.js';

export const setupCommand = new Command('setup')
  .description('Local environment bootstrap helpers')
  .addCommand(setupActivitySimulatorCommand);
