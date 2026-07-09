import { Command } from 'commander';
import { balanceCommand } from './balance';
import { limitsCommand } from './limits';
import { settingsCommand } from './settings';

export const accountCommand = new Command('account')
  .description('Manage trading accounts and settings')
  .addCommand(balanceCommand)
  .addCommand(limitsCommand)
  .addCommand(settingsCommand);

