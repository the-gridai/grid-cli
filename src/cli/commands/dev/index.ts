import { Command } from 'commander';
import { buildCommand } from './build.js';
import { versionCommand } from './version.js';
import { presentCommand } from './present.js';
import { benchCommand } from './bench.js';
import { setupCommand } from './setup/index.js';

export const devCommand = new Command('dev')
  .description('Developer tools and utilities')
  .addCommand(buildCommand)
  .addCommand(versionCommand)
  .addCommand(presentCommand)
  .addCommand(benchCommand)
  .addCommand(setupCommand);
