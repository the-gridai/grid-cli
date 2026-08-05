import { Command } from 'commander';
import { modelsCommand } from './models';
import { balanceCommand } from './balance';
import { transferCommand } from './transfer';
import { statsCommand } from './stats';
import { consumptionKeysCommand } from './keys';
import { usageCommand } from './usage';

export const consumptionCommandGroup = new Command('consumption')
  .description('Manage consumption API resources (models, balance, stats, usage, transfers, keys)')
  .addCommand(modelsCommand)
  .addCommand(balanceCommand)
  .addCommand(statsCommand)
  .addCommand(transferCommand)
  .addCommand(consumptionKeysCommand)
  .addCommand(usageCommand);

export {
  modelsCommand,
  balanceCommand,
  statsCommand,
  transferCommand,
  consumptionKeysCommand,
  usageCommand,
};
