import { Command } from 'commander';
import { createOrderCommand } from './create';
import { listOrdersCommand } from './list';
import { cancelOrderCommand } from './cancel';
import { cancelAllOrdersCommand } from './cancel-all';

export const orderCommand = new Command('order')
  .description('Manage orders')
  .addCommand(createOrderCommand)
  .addCommand(listOrdersCommand)
  .addCommand(cancelOrderCommand)
  .addCommand(cancelAllOrdersCommand);

