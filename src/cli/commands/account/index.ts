import { Command } from 'commander';
import { balanceCommand } from './balance';
import { settingsCommand } from './settings';

export const accountCommand = new Command('account')
  .description('Manage trading accounts and settings')
  .addCommand(balanceCommand)
  .addCommand(settingsCommand);

