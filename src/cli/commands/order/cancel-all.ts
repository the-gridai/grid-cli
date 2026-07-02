import { Command } from 'commander';
import { ApiClient } from '../../../sdk/http/client';
import { logger } from '../../../core/logging/logger';
import chalk from 'chalk';

export const cancelAllOrdersCommand = new Command('cancel-all')
  .description('Cancel all open orders (account-wide or per market)')
  .option('-m, --market <marketId>', 'Cancel only orders on this market')
  .option('-y, --yes', 'Skip confirmation')
  .action(async (opts: { market?: string; yes?: boolean }) => {
    const client = ApiClient.getInstance();

    try {
      const summary = await client.countOpenOrders();
      const expected =
        opts.market != null && opts.market !== ''
          ? summary.by_market.find((m) => m.market_id === opts.market)?.count ?? 0
          : summary.count;

      if (expected === 0) {
        console.log(chalk.green('No open orders to cancel.'));
        return;
      }

      const scope =
        opts.market != null && opts.market !== ''
          ? `market ${opts.market}`
          : 'all markets';
      console.log(
        `Found ${chalk.bold(expected)} open order(s) on ${scope}. Cancelling via bulk API...`
      );

      const result = await client.cancelAllOrders(opts.market);

      console.log(
        chalk.green(`\n✓ Bulk cancel accepted (${result.cancelled} reported open before cancel).`)
      );
    } catch (err: any) {
      logger.error('Failed to cancel orders:', { error: err });
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
