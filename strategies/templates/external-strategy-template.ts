/**
 * External Strategy Template
 * 
 * Copy this file to create your own strategy outside the GRID-cli repository.
 * 
 * Usage:
 * 1. Copy this file to your preferred location (e.g., ~/my-strategies/my-bot.ts)
 * 2. Install/link grid-cli: npm link grid-cli (from GRID-cli directory)
 * 3. Customize the strategy logic below
 * 4. Run: grid strategy start /path/to/my-bot.ts
 * 
 * Note: For strategies inside the GRID-cli repo, use relative imports instead.
 */

import { ApiClient, WebSocketClient, ConnectionState, logger, type Order, type Market } from 'grid-cli/sdk';
import {
  InsufficientBalanceError,
  ValidationError,
  RateLimitError,
  ApiError
} from 'grid-cli/sdk';

interface StrategyConfig {
  marketId: string;
  checkInterval: number;
  minBalance: number;
}

export class MyCustomStrategy {
  private client: ApiClient;
  private ws: WebSocketClient;
  private config: StrategyConfig;
  private isRunning: boolean = false;

  constructor(config: StrategyConfig) {
    this.client = ApiClient.getInstance();
    this.ws = WebSocketClient.getInstance();
    this.config = config;
  }

  async start() {
    logger.info('Starting custom strategy', { config: this.config });
    console.log('Strategy started!');
    console.log('Market:', this.config.marketId);
    console.log('');

    this.isRunning = true;

    // Check balance
    await this.checkBalance();

    // Setup WebSocket
    this.setupWebSocket();

    // Your strategy logic here
    await this.runStrategy();

    console.log('Strategy running. Press Ctrl+C to stop.\n');
  }

  async stop() {
    console.log('\nStopping strategy...');
    this.isRunning = false;

    // Cleanup
    try {
      await this.client.cancelAllOrders();
    } catch (error) {
      logger.warn('Failed to cancel orders on shutdown', { error });
    }

    this.ws.disconnect();
    console.log('Strategy stopped');
  }

  private async checkBalance() {
    try {
      const accounts = await this.client.getTradingAccounts();
      
      console.log('Balances:');
      for (const account of accounts) {
        const available = parseFloat(account.available_balance);
        console.log(`  ${account.instrument_symbol}: ${available}`);
        
        if (available < this.config.minBalance) {
          logger.warn('Low balance', { instrument: account.instrument_symbol, available });
        }
      }
      console.log('');
    } catch (error) {
      logger.error('Failed to check balance', { error });
      throw error;
    }
  }

  private setupWebSocket() {
    this.ws.on('connected', () => {
      logger.info('WebSocket connected');
      this.ws.subscribe('orders');
      this.ws.subscribe('ticker', { market_id: this.config.marketId });
    });

    this.ws.on('message', (message) => {
      if (message.type === 'order_update') {
        logger.info('Order update', { order: message.data });
      } else if (message.type === 'ticker') {
        logger.debug('Ticker update', { ticker: message.data });
      }
    });

    this.ws.connect();
  }

  private async runStrategy() {
    try {
      // Example: Get market data
      const ticker = await this.client.getTicker(this.config.marketId);
      console.log('Current price:', ticker.last_price);

      // Example: Place an order (commented out for safety)
      /*
      const order = await this.client.placeOrder({
        market_id: this.config.marketId,
        side: 'buy',
        type: 'limit',
        quantity: '1',
        price: '100.00',
        time_in_force: 'gtc'
      });
      console.log('Order placed:', order.order_id);
      */

      // Add your custom strategy logic here

    } catch (error) {
      if (error instanceof InsufficientBalanceError) {
        console.error('Insufficient balance');
      } else if (error instanceof ValidationError) {
        console.error('Validation error:', error.validationErrors);
      } else if (error instanceof RateLimitError) {
        console.log(`Rate limited, retry after ${error.retryAfter}s`);
      } else if (error instanceof ApiError) {
        console.error('API error:', error.message);
      } else {
        logger.error('Strategy error', { error });
      }
    }
  }
}

export async function run() {
  const config: StrategyConfig = {
    marketId: process.env.MARKET_ID || 'market_b310e860-97cd-45eb-bdc3-5be0b79295d0',
    checkInterval: parseInt(process.env.CHECK_INTERVAL || '60000'),
    minBalance: parseFloat(process.env.MIN_BALANCE || '100')
  };

  const strategy = new MyCustomStrategy(config);

  // Graceful shutdown
  const shutdown = async () => {
    await strategy.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await strategy.start();
}

// Auto-run if executed directly (ESM-compatible)
import { fileURLToPath } from 'url';
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  run().catch((error) => {
    logger.error('Strategy failed', { error });
    console.error('Strategy failed:', error.message);
    process.exit(1);
  });
}

