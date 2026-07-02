import { Command } from 'commander';
import { importCommand } from './import';

export const configCommand = new Command('config')
  .description('Persisted strategy configuration (SQLite strategy_configs table)')
  .addCommand(importCommand);
