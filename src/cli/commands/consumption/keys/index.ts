import { Command } from 'commander';
import { createCommand } from './create';
import { listCommand } from './list';
import { revokeCommand } from './revoke';

export const consumptionKeysCommand = new Command('keys')
  .description('Manage consumption API keys (requires OAuth keys:manage)')
  .addCommand(listCommand)
  .addCommand(createCommand)
  .addCommand(revokeCommand);
