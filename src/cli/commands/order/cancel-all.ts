import { Command } from 'commander';
import { ApiClient } from '../../../sdk/http/client';
import { logger } from '../../../core/logging/logger';
import chalk from 'chalk';

export const cancelAllOrdersCommand = new Command('cancel-all')
  .description('Cancel all active orders')
  .option('-y, --yes', 'Skip confirmation')
  .action(async () => {
    const client = ApiClient.getInstance();

    try {
      const orders = await client.listOrders({ status: 'active' } as any);

      if (orders.length === 0) {
        console.log(chalk.green('No active orders to cancel.'));
        return;
      }

      console.log(`Found ${chalk.bold(orders.length)} active orders. Cancelling...`);

      const result = await client.cancelAllOrders();

      console.log(chalk.green(`\n✓ Cancelled ${result.cancelled}/${orders.length} orders.`));

      if (result.cancelled < orders.length) {
        console.log(chalk.yellow(`  ${orders.length - result.cancelled} orders failed to cancel.`));
      }
    } catch (err: any) {
      logger.error('Failed to cancel orders:', { error: err });
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
