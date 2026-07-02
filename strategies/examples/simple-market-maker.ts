import { ApiClient } from '../../src/sdk/http/client';
import { logger } from '../../src/core/logging/logger';
import type { Order } from '../../src/sdk/types';

/**
 * Simple Market Maker Strategy
 * 
 * This strategy demonstrates the GRID CLI API capabilities by:
 * - Fetching market data
 * - Placing buy and sell orders around the mid-price
 * - Maintaining a configurable spread
 * - Canceling and replacing orders as needed
 * 
 * Configuration:
 * - MARKET_ID: Target market to make
 * - SPREAD_PERCENTAGE: Percentage spread from mid-price (default: 2%)
 * - ORDER_SIZE: Size of each order (default: 1)
 * - REFRESH_INTERVAL_MS: How often to update orders (default: 3000ms / 3 seconds)
 */

interface StrategyConfig {
  marketId: string;
  spreadPercentage: number;
  orderSize: number;
  refreshIntervalMs: number;
}

interface ActiveOrder {
  orderId: string;
  side: 'buy' | 'sell';
  price: string;
}

export class SimpleMarketMaker {
  private client: ApiClient;
  private config: StrategyConfig;
  private activeOrders: ActiveOrder[] = [];
  private intervalHandle: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastReferencePrice: number = 0;
  private lastOrderPlacementTime: number = 0;
  private fillCount = { buy: 0, sell: 0 };

  constructor(config: StrategyConfig) {
    this.client = ApiClient.getInstance();
    this.config = config;
  }

  async start() {
    console.log('[Market Maker] Starting strategy');
    console.log('[Market Maker] Market:', this.config.marketId);
    console.log('[Market Maker] Spread:', this.config.spreadPercentage + '%');
    console.log('[Market Maker] Order Size:', this.config.orderSize);
    console.log('[Market Maker] Refresh Interval:', this.config.refreshIntervalMs + 'ms\n');

    this.isRunning = true;

    // Initial placement
    await this.updateOrders();

    // Periodic refresh
    this.intervalHandle = setInterval(async () => {
      if (this.isRunning) {
        await this.updateOrders();
      }
    }, this.config.refreshIntervalMs);

    console.log('[Market Maker] Strategy running. Press Ctrl+C to stop.\n');
  }

  async stop() {
    console.log('\n[Market Maker] Stopping strategy...');
    this.isRunning = false;

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
    }

    await this.cancelAllOrders();
    console.log('[Market Maker] Strategy stopped');
  }

  private async updateOrders() {
    try {
      const ticker = await this.client.getTicker(this.config.marketId);
      
      // v0.2.0: ticker is unwrapped, use actual field names from API
      const lastPrice = parseFloat(ticker.last_price || '0');
      const bestBid = parseFloat(ticker.highest_bid || '0');
      const bestAsk = parseFloat(ticker.lowest_ask || '0');

      console.log('[Market Maker] Last Price:', lastPrice > 0 ? lastPrice.toFixed(2) : 'N/A');
      if (bestBid > 0) console.log('[Market Maker] Best Bid:', bestBid.toFixed(2));
      if (bestAsk > 0) console.log('[Market Maker] Best Ask:', bestAsk.toFixed(2));

      // Determine reference price - use last trade price if available
      // This prevents using our own orders as reference (which causes death spiral)
      let referencePrice: number;
      
      if (lastPrice > 0) {
        // Use last trade price as fair value
        referencePrice = lastPrice;
        console.log('[Market Maker] Using last trade price:', referencePrice.toFixed(2));
      } else if (bestBid > 0 && bestAsk > 0) {
        // No recent trades - use midpoint if both sides exist
        referencePrice = (bestBid + bestAsk) / 2;
        console.log('[Market Maker] Using mid-market:', referencePrice.toFixed(2));
      } else {
        // No reliable reference price
        logger.warn('No reliable reference price available');
        return;
      }

      // Check if we need to update orders
      let shouldUpdate = false;
      
      // Update if price moved significantly
      const priceChange = Math.abs(referencePrice - this.lastReferencePrice);
      const priceChangePercent = this.lastReferencePrice > 0 
        ? (priceChange / this.lastReferencePrice) * 100 
        : 100;

      if (this.lastReferencePrice === 0 || priceChangePercent >= 0.5) {
        shouldUpdate = true;
      }

      // Check if any orders got filled by querying actual open orders for this market
      // Only check if enough time has passed since we placed orders (avoid timing issues)
      const timeSinceLastPlacement = Date.now() - this.lastOrderPlacementTime;
      if (!shouldUpdate && this.activeOrders.length === 2 && timeSinceLastPlacement > 2000) {
        try {
          // v0.2.0: listOrders returns unwrapped array
          const openOrders = await this.client.listOrders({ 
            status: 'active',
            market_id: this.config.marketId 
          } as any);
          
          // We expect 2 orders - if we have fewer, something got filled
          if (openOrders.length < 2) {
            // Figure out which order was filled
            const openOrderIds = new Set(openOrders.map((o: Order) => o.order_id));
            const filledOrders = this.activeOrders.filter(o => !openOrderIds.has(o.orderId));
            
            if (filledOrders.length > 0) {
              // Track fills
              filledOrders.forEach(order => {
                if (order.side === 'buy') this.fillCount.buy++;
                if (order.side === 'sell') this.fillCount.sell++;
              });
              
              const filledSides = filledOrders.map(o => `${o.side} @ ${o.price}`).join(', ');
              console.log('[Market Maker] ✓ FILL:', filledSides, 
                `(Total: ${this.fillCount.buy} buys, ${this.fillCount.sell} sells)`);
              shouldUpdate = true;
            }
          }
        } catch (error) {
          // If we can't check orders, be conservative and don't update
          logger.warn('Could not check open orders status', { error });
        }
      }

      if (!shouldUpdate) {
        console.log('[Market Maker] Price unchanged, skipping update');
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
      console.log('[Market Maker] Placing orders...');
      
      const buyOrder = await this.placeOrder('buy', buyPrice);
      const sellOrder = await this.placeOrder('sell', sellPrice);

      if (buyOrder) {
        this.activeOrders.push(buyOrder);
        console.log('[Market Maker] Buy order placed:', buyOrder.orderId, 'at', buyPrice);
      } else {
        console.log('[WARNING] Failed to place buy order!');
      }

      if (sellOrder) {
        this.activeOrders.push(sellOrder);
        console.log('[Market Maker] Sell order placed:', sellOrder.orderId, 'at', sellPrice);
      } else {
        console.log('[WARNING] Failed to place sell order!');
      }

      // Record when we placed these orders
      this.lastOrderPlacementTime = Date.now();

      console.log('[Market Maker] Active orders:', this.activeOrders.length);
      console.log('');

    } catch (error: any) {
      logger.error('Error updating orders', { error });
      console.error('[Error] Failed to update orders:', error.message);
    }
  }

  private async placeOrder(side: 'buy' | 'sell', price: string): Promise<ActiveOrder | null> {
    try {
      const orderPayload = {
        market_id: this.config.marketId,
        side,
        type: 'limit' as const,
        quantity: this.config.orderSize.toString(),
        price,
        time_in_force: 'gtc' as const,
      };

      // v0.2.0: response is unwrapped Order object
      const response = await this.client.placeOrder(orderPayload);
      const orderId = response.order_id;

      if (!orderId) {
        logger.error('No order ID in response', { response });
        return null;
      }

      return { orderId, side, price };
    } catch (error: any) {
      logger.error(`Failed to place ${side} order`, { error });
      console.error(`[Error] Failed to place ${side} order:`, error.message);
      return null;
    }
  }

  private async cancelAllOrders() {
    try {
      const result = await this.client.cancelAllOrders();
      console.log('[Market Maker] Cancelled orders:', result.cancelled);
      this.activeOrders = [];
    } catch (error: any) {
      logger.warn('Failed to cancel all orders', { error });
    }
  }
}

export async function run() {
  const marketId = process.env.MARKET_ID || 'market_b310e860-97cd-45eb-bdc3-5be0b79295d0';
  const spreadPercentage = parseFloat(process.env.SPREAD_PERCENTAGE || '2');
  const orderSize = parseInt(process.env.ORDER_SIZE || '1');
  const refreshIntervalMs = parseInt(process.env.REFRESH_INTERVAL_MS || '3000');

  const strategy = new SimpleMarketMaker({
    marketId,
    spreadPercentage,
    orderSize,
    refreshIntervalMs,
  });

  process.on('SIGINT', async () => {
    await strategy.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await strategy.stop();
    process.exit(0);
  });

  await strategy.start();
}

// ESM-compatible main check
import { fileURLToPath } from 'url';
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  run().catch((error) => {
    logger.error('Strategy failed', { error });
    console.error('[Error] Strategy failed:', error.message);
    process.exit(1);
  });
}

