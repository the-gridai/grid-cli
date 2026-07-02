import { Command } from 'commander';
import { issueSupplyCommand } from './issue';
import { listSupplyCommand } from './list';
import { supplySummaryCommand } from './summary';
import { transferSupplyCommand } from './transfer';

export const supplyCommand = new Command('supply')
  .description('Manage supply issuance (issue, transfer, list)')
  .addCommand(issueSupplyCommand)
  .addCommand(listSupplyCommand)
  .addCommand(supplySummaryCommand)
  .addCommand(transferSupplyCommand);

