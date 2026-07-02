import { Command } from 'commander';
import { startStrategyCommand } from './start';
import { listStrategiesCommand } from './list';
import { configCommand } from './config';

export const strategyCommand = new Command('strategy')
  .description('Manage and run trading strategies')
  .addCommand(startStrategyCommand)
  .addCommand(listStrategiesCommand)
  .addCommand(configCommand);

