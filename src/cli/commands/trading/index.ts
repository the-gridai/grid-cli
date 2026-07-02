import { Command } from 'commander';
import { tradingKeysCommand } from './keys';

export const tradingCommandGroup = new Command('trading')
  .description('Trading account utilities (OAuth)')
  .addCommand(tradingKeysCommand);
