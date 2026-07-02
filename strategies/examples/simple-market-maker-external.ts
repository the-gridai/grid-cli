/**
 * Simple Market Maker Strategy (External SDK Version)
 * 
 * This is the migrated version using the new @the-gridai/grid-sdk.
 * 
 * To use this strategy:
 * 1. Install the SDK: npm install @the-gridai/grid-sdk
 *    (or link locally: npm link ../grid/packages/sdk-typescript)
 * 2. Set environment variables:
 *    - GRID_API_URL: API endpoint (default: https://api.thegrid.ai)
 *    - GRID_SIGNING_KEY: Your Ed25519 signing key (base64)
 *    - GRID_FINGERPRINT: Your signing key fingerprint
 *    - MARKET_ID: Target market (required)
 * 3. Run: npx ts-node strategies/examples/simple-market-maker-external.ts
 * 
 * API Mapping (Internal → External SDK):
 * - ApiClient.getInstance() → new GridClient(config)
 * - client.getTicker(id) → client.markets.getTicker(id)
 * - client.listOrders(filters) → client.orders.list(filters)
 * - client.placeOrder(order) → client.orders.create(order)
 * - client.cancelAllOrders() → client.orders.cancelAll()
 */

// When published to npm, use:
// import { GridClient, GridWebSocket } from '@the-gridai/grid-sdk';
// For local development, use relative path:
import { GridClient } from '../../grid/packages/sdk-typescript/src/index.js';

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

/**
 * Simple Market Maker using External SDK
 */
export class SimpleMarketMakerExternal {
  private client: GridClient;
  private config: StrategyConfig;
  private activeOrders: ActiveOrder[] = [];
  private intervalHandle: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastReferencePrice: number = 0;
  private lastOrderPlacementTime: number = 0;
  private fillCount = { buy: 0, sell: 0 };

  constructor(config: StrategyConfig) {
    // External SDK uses constructor-based initialization
    this.client = new GridClient({
      apiUrl: process.env.GRID_API_URL || 'https://api.thegrid.ai/v1',
      signingKey: process.env.GRID_SIGNING_KEY!,
      fingerprint: process.env.GRID_FINGERPRINT!,
      // Optional: inject a logger
      // logger: console,
    });
    this.config = config;
  }

  async start() {
    console.log('[Market Maker] Starting strategy (External SDK)');
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
      // External SDK: client.markets.getTicker() instead of client.getTicker()
      const ticker = await this.client.markets.getTicker(this.config.marketId);
      
      const lastPrice = parseFloat(ticker.last_price || '0');
      const bestBid = parseFloat(ticker.highest_bid || ticker.best_bid || '0');
      const bestAsk = parseFloat(ticker.lowest_ask || ticker.best_ask || '0');

      console.log('[Market Maker] Last Price:', lastPrice > 0 ? lastPrice.toFixed(2) : 'N/A');
      if (bestBid > 0) console.log('[Market Maker] Best Bid:', bestBid.toFixed(2));
      if (bestAsk > 0) console.log('[Market Maker] Best Ask:', bestAsk.toFixed(2));

      // Determine reference price
      let referencePrice: number;
      
      if (lastPrice > 0) {
        referencePrice = lastPrice;
        console.log('[Market Maker] Using last trade price:', referencePrice.toFixed(2));
      } else if (bestBid > 0 && bestAsk > 0) {
        referencePrice = (bestBid + bestAsk) / 2;
        console.log('[Market Maker] Using mid-market:', referencePrice.toFixed(2));
      } else {
        console.warn('[Market Maker] No reliable reference price available');
        return;
      }

      // Check if we need to update orders
      let shouldUpdate = false;
      
      const priceChange = Math.abs(referencePrice - this.lastReferencePrice);
      const priceChangePercent = this.lastReferencePrice > 0 
        ? (priceChange / this.lastReferencePrice) * 100 
        : 100;

      if (this.lastReferencePrice === 0 || priceChangePercent >= 0.5) {
        shouldUpdate = true;
      }

      // Check for filled orders
      const timeSinceLastPlacement = Date.now() - this.lastOrderPlacementTime;
      if (!shouldUpdate && this.activeOrders.length === 2 && timeSinceLastPlacement > 2000) {
        try {
          // External SDK: client.orders.list() instead of client.listOrders()
          const openOrders = await this.client.orders.list({ 
            status: 'active',
            market_id: this.config.marketId 
          });
          
          if (openOrders.length < 2) {
            const openOrderIds = new Set(openOrders.map(o => o.order_id));
            const filledOrders = this.activeOrders.filter(o => !openOrderIds.has(o.orderId));
            
            if (filledOrders.length > 0) {
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
        } catch {
          console.warn('[Market Maker] Could not check open orders status');
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
      }

      if (sellOrder) {
        this.activeOrders.push(sellOrder);
        console.log('[Market Maker] Sell order placed:', sellOrder.orderId, 'at', sellPrice);
      }

      this.lastOrderPlacementTime = Date.now();

      console.log('[Market Maker] Active orders:', this.activeOrders.length);
      console.log('');

    } catch (error: any) {
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

      // External SDK: client.orders.create() instead of client.placeOrder()
      const response = await this.client.orders.create(orderPayload);
      const orderId = response.order_id;

      if (!orderId) {
        console.error('[Error] No order ID in response');
        return null;
      }

      return { orderId, side, price };
    } catch (error: any) {
      console.error(`[Error] Failed to place ${side} order:`, error.message);
      return null;
    }
  }

  private async cancelAllOrders() {
    try {
      // External SDK: client.orders.cancelAll() instead of client.cancelAllOrders()
      const result = await this.client.orders.cancelAll();
      console.log('[Market Maker] Cancelled orders:', result.cancelled);
      this.activeOrders = [];
    } catch (error: any) {
      console.warn('[Market Maker] Failed to cancel all orders:', error.message);
    }
  }
}

export async function run() {
  // Validate required environment variables
  if (!process.env.GRID_SIGNING_KEY || !process.env.GRID_FINGERPRINT) {
    console.error('Error: GRID_SIGNING_KEY and GRID_FINGERPRINT environment variables are required');
    console.error('Set these from your Grid account or use the credential extraction script.');
    process.exit(1);
  }

  if (!process.env.MARKET_ID) {
    console.error('Error: MARKET_ID environment variable is required');
    process.exit(1);
  }

  const marketId = process.env.MARKET_ID;
  const spreadPercentage = parseFloat(process.env.SPREAD_PERCENTAGE || '2');
  const orderSize = parseInt(process.env.ORDER_SIZE || '1');
  const refreshIntervalMs = parseInt(process.env.REFRESH_INTERVAL_MS || '3000');

  const strategy = new SimpleMarketMakerExternal({
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
    console.error('[Error] Strategy failed:', error.message);
    process.exit(1);
  });
}
