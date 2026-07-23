import { Command } from 'commander';
import { modelsCommand } from './models';
import { balanceCommand } from './balance';
import { transferCommand } from './transfer';
import { consumptionKeysCommand } from './keys';
import { usageCommand } from './usage';

export const consumptionCommandGroup = new Command('consumption')
  .description('Manage consumption API resources (models, balance, transfers, keys, usage)')
  .addCommand(modelsCommand)
  .addCommand(balanceCommand)
  .addCommand(transferCommand)
  .addCommand(consumptionKeysCommand)
  .addCommand(usageCommand);

export { modelsCommand, balanceCommand, transferCommand, consumptionKeysCommand, usageCommand };
