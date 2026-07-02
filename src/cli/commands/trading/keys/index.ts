import { Command } from 'commander';
import { createCommand } from './create';
import { listCommand } from './list';
import { revokeCommand } from './revoke';

export const tradingKeysCommand = new Command('keys')
  .description('Manage trading signing keys (requires OAuth keys:manage)')
  .addCommand(listCommand)
  .addCommand(createCommand)
  .addCommand(revokeCommand);
