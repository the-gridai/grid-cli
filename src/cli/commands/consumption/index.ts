import { Command } from 'commander';
import { modelsCommand } from './models';
import { balanceCommand } from './balance';
import { transferCommand } from './transfer';
import { consumptionKeysCommand } from './keys';

export const consumptionCommandGroup = new Command('consumption')
  .description('Manage consumption API resources (models, balance, transfers, keys)')
  .addCommand(modelsCommand)
  .addCommand(balanceCommand)
  .addCommand(transferCommand)
  .addCommand(consumptionKeysCommand);

export { modelsCommand, balanceCommand, transferCommand, consumptionKeysCommand };
