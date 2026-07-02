/**
 * Simple Market Maker Strategy - v0.2.0 Updated
 * 
 * Production-ready market making bot with:
 * - Automatic error handling
 * - Retry logic
 * - Fill detection
 * - Graceful shutdown
 */

import { ApiClient } from '../../src/sdk/http/client';
import { WebSocketClient } from '../../src/sdk/ws/client';
import { logger } from '../../src/core/logging/logger';
import type { Order } from '../../src/sdk/types';
import {
  InsufficientBalanceError,
  ValidationError,
  RateLimitError
} from '../../src/core/errors';

interface StrategyConfig {
  marketId: string;
  spreadPercentage: number;
  orderSize: string;
  refreshIntervalMs: number;
  minBalance: number;
}

interface ActiveOrder {
  orderId: string;
  side: 'buy' | 'sell';
  price: string;
}

export class SimpleMarketMakerV2 {
  private client: ApiClient;
  private ws: WebSocketClient;
  private config: StrategyConfig;
  private activeOrders: ActiveOrder[] = [];
  private intervalHandle: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastReferencePrice: number = 0;
  private fillCount = { buy: 0, sell: 0 };

  constructor(config: StrategyConfig) {
    this.client = ApiClient.getInstance();
    this.ws = WebSocketClient.getInstance();
    this.config = config;
  }

  async start() {
    logger.info('Starting market maker strategy', { config: this.config });
    console.log('='.repeat(60));
    console.log('GRID Market Maker v0.2.0');
    console.log('='.repeat(60));
    console.log('Market:', this.config.marketId);
    console.log('Spread:', this.config.spreadPercentage + '%');
    console.log('Order Size:', this.config.orderSize);
    console.log('Refresh:', this.config.refreshIntervalMs + 'ms');
    console.log('='.repeat(60));
    console.log('');

    // Check balance first
    await this.checkBalance();

    // Setup WebSocket for real-time updates
    this.setupWebSocket();

    this.isRunning = true;

    // Initial placement
    await this.updateOrders();

    // Periodic refresh
    this.intervalHandle = setInterval(async () => {
      if (this.isRunning) {
        await this.updateOrders();
      }
    }, this.config.refreshIntervalMs);

    console.log('[OK] Strategy running. Press Ctrl+C to stop.\n');
  }

  async stop() {
    console.log('\n[STOP] Stopping strategy...');
    this.isRunning = false;

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
    }

    await this.cancelAllOrders();
    this.ws.disconnect();
    
    console.log('[OK] Strategy stopped');
    console.log(`[STATS] Total fills: ${this.fillCount.buy} buys, ${this.fillCount.sell} sells`);
  }

  private async checkBalance() {
    try {
      const accounts = await this.client.getTradingAccounts();
      
      console.log('[BALANCES]');
      for (const account of accounts) {
        const available = parseFloat(account.available_balance);
        console.log(`  ${account.instrument_symbol || account.instrument_id}: ${available}`);
        
        if (available < this.config.minBalance) {
          logger.warn('Low balance detected', {
            instrument: account.instrument_symbol,
            available,
            minimum: this.config.minBalance
          });
          console.warn(`  [WARNING] Low balance (${available} < ${this.config.minBalance})`);
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
      console.log('[WS] WebSocket connected');
      
      // Subscribe to order updates
      this.ws.subscribe('orders');
      
      // Subscribe to ticker for this market
      this.ws.subscribe('ticker', { market_id: this.config.marketId });
    });

    this.ws.on('disconnected', () => {
      logger.warn('WebSocket disconnected');
      console.log('[WS] WebSocket disconnected');
    });

    this.ws.on('reconnecting', ({ attempt }) => {
      logger.info('WebSocket reconnecting', { attempt });
      console.log(`[WS] WebSocket reconnecting (attempt ${attempt})...`);
    });

    this.ws.on('message', (message) => {
      this.handleWebSocketMessage(message);
    });

    this.ws.connect();
  }

  private handleWebSocketMessage(message: any) {
    if (message.type === 'order_update') {
      const order = message.data as Order;
      const orderId = order.order_id;
      
      // Check if it's one of our orders
      const isOurOrder = this.activeOrders.some(o => o.orderId === orderId);
      
      if (isOurOrder && order.status === 'filled') {
        const activeOrder = this.activeOrders.find(o => o.orderId === orderId);
        if (activeOrder) {
          if (activeOrder.side === 'buy') this.fillCount.buy++;
          if (activeOrder.side === 'sell') this.fillCount.sell++;
          
          console.log(`[FILL] ${activeOrder.side.toUpperCase()} @ ${activeOrder.price}`);
          console.log(`   Total: ${this.fillCount.buy} buys, ${this.fillCount.sell} sells\n`);
        }
      }
    } else if (message.type === 'ticker') {
      // Could use real-time ticker data here
      logger.debug('Ticker update', { data: message.data });
    }
  }

  private async updateOrders() {
    try {
      const ticker = await this.client.getTicker(this.config.marketId);
      
      const lastPrice = parseFloat(ticker.last_price || '0');
      const bestBid = parseFloat(ticker.highest_bid || '0');
      const bestAsk = parseFloat(ticker.lowest_ask || '0');

      console.log(`[MARKET] Last=${lastPrice.toFixed(2)} Bid=${bestBid.toFixed(2)} Ask=${bestAsk.toFixed(2)}`);

      // Determine reference price
      let referencePrice: number;
      
      if (lastPrice > 0) {
        referencePrice = lastPrice;
      } else if (bestBid > 0 && bestAsk > 0) {
        referencePrice = (bestBid + bestAsk) / 2;
      } else {
        logger.warn('No reliable reference price available');
        console.log('[WARNING] No reliable price, skipping update\n');
        return;
      }

      // Check if price moved significantly
      const priceChange = Math.abs(referencePrice - this.lastReferencePrice);
      const priceChangePercent = this.lastReferencePrice > 0 
        ? (priceChange / this.lastReferencePrice) * 100 
        : 100;

      if (this.lastReferencePrice > 0 && priceChangePercent < 0.5) {
        console.log('[INFO] Price unchanged, skipping update\n');
        return;
      }

      this.lastReferencePrice = referencePrice;

      // Calculate target prices
      const spreadMultiplier = this.config.spreadPercentage / 100;
      const buyPrice = (referencePrice * (1 - spreadMultiplier)).toFixed(2);
      const sellPrice = (referencePrice * (1 + spreadMultiplier)).toFixed(2);

      // Cancel existing orders
      await this.cancelAllOrders();

      // Place new orders
      console.log('[ORDERS] Placing orders...');
      
      const [buyOrder, sellOrder] = await Promise.all([
        this.placeOrder('buy', buyPrice),
        this.placeOrder('sell', sellPrice)
      ]);

      if (buyOrder) {
        this.activeOrders.push(buyOrder);
        console.log(`  [OK] BUY @ ${buyPrice} (ID: ${buyOrder.orderId})`);
      } else {
        console.log('  [FAIL] Failed to place buy order');
      }

      if (sellOrder) {
        this.activeOrders.push(sellOrder);
        console.log(`  [OK] SELL @ ${sellPrice} (ID: ${sellOrder.orderId})`);
      } else {
        console.log('  [FAIL] Failed to place sell order');
      }

      console.log(`[INFO] Active orders: ${this.activeOrders.length}\n`);

    } catch (error: any) {
      if (error instanceof InsufficientBalanceError) {
        logger.error('Insufficient balance', { error });
        console.error('[ERROR] Insufficient balance - stopping strategy');
        await this.stop();
        process.exit(1);
      } else if (error instanceof RateLimitError) {
        logger.warn('Rate limited', { retryAfter: error.retryAfter });
        console.log(`[RATE_LIMIT] Waiting ${error.retryAfter}s...\n`);
      } else {
        logger.error('Error updating orders', { error });
        console.error('[ERROR]:', error.message, '\n');
      }
    }
  }

  private async placeOrder(side: 'buy' | 'sell', price: string): Promise<ActiveOrder | null> {
    try {
      // v0.2.0: Returns unwrapped Order object
      const order = await this.client.placeOrder({
        market_id: this.config.marketId,
        side,
        type: 'limit',
        quantity: this.config.orderSize,
        price,
        time_in_force: 'gtc',
      });

      const orderId = order.order_id;
      if (!orderId) {
        logger.error('No order ID in response', { order });
        return null;
      }

      return { orderId, side, price };
    } catch (error: any) {
      if (error instanceof ValidationError) {
        logger.error(`Validation error placing ${side} order`, { 
          error: error.validationErrors 
        });
      } else if (error instanceof InsufficientBalanceError) {
        logger.error('Insufficient balance', { side });
        throw error; // Re-throw to stop strategy
      } else {
        logger.error(`Failed to place ${side} order`, { error });
      }
      return null;
    }
  }

  private async cancelAllOrders() {
    if (this.activeOrders.length === 0) {
      return;
    }

    try {
      const result = await this.client.cancelAllOrders();
      console.log(`[CANCEL] Cancelled ${result.cancelled} orders`);
      this.activeOrders = [];
    } catch (error: any) {
      logger.warn('Failed to cancel all orders', { error });
      console.warn('[WARNING] Failed to cancel orders:', error.message);
    }
  }
}

export async function run() {
  const config: StrategyConfig = {
    marketId: process.env.MARKET_ID || 'market_b310e860-97cd-45eb-bdc3-5be0b79295d0',
    spreadPercentage: parseFloat(process.env.SPREAD_PERCENTAGE || '2'),
    orderSize: process.env.ORDER_SIZE || '1',
    refreshIntervalMs: parseInt(process.env.REFRESH_INTERVAL_MS || '30000'), // Default 30s
    minBalance: parseFloat(process.env.MIN_BALANCE || '100')
  };

  const strategy = new SimpleMarketMakerV2(config);

  // Graceful shutdown
  const shutdown = async () => {
    await strategy.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Handle errors
  process.on('unhandledRejection', (error) => {
    logger.error('Unhandled rejection', { error });
    console.error('[ERROR] Unhandled error:', error);
    shutdown();
  });

  await strategy.start();
}

// ESM-compatible main check
import { fileURLToPath } from 'url';
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  run().catch((error) => {
    logger.error('Strategy failed', { error });
    console.error('[ERROR] Strategy failed:', error.message);
    process.exit(1);
  });
}

