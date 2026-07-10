import { Command } from 'commander';
import { ApiClient } from '../../../sdk/http/client';
import { logger } from '../../../core/logging/logger';

interface LimitsOptions {
  marketId: string;
  json?: boolean;
}

function formatLimits(data: Awaited<ReturnType<ApiClient['getAccountLimits']>>): string {
  const limits = data.order_rate_limits;

  return [
    `Market: ${data.market_id}`,
    `Scope: ${limits.scope}`,
    `Max orders/sec: ${limits.max_orders_per_second}`,
    `Max orders/min: ${limits.max_orders_per_minute}`,
    `Burst capacity: ${limits.burst_capacity}`,
    `Window seconds: ${limits.window_seconds}`,
    `429 retry header: ${data.response_headers.retry_after}`,
  ].join('\n');
}

export const limitsCommand = new Command('limits')
  .description('Show effective order limits for a market')
  .requiredOption('-m, --market-id <marketId>', 'Market id from GET /v1/markets')
  .option('--json', 'Print raw JSON response')
  .action(async (options: LimitsOptions) => {
    const client = ApiClient.getInstance();

    try {
      const data = await client.getAccountLimits(options.marketId);
      console.log(options.json ? JSON.stringify(data, null, 2) : formatLimits(data));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to fetch account limits', { message, marketId: options.marketId });
      console.error(`Failed to fetch account limits: ${message}`);
      process.exitCode = 1;
    }
  });
