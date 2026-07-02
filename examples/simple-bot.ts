/**
 * Simple Trading Bot Example
 * 
 * Demonstrates how to build a trading bot using the GRID SDK
 * with proper error handling, retry logic, and graceful shutdown.
 */

import { ApiClient } from '../src/sdk/http/client';
import { WebSocketClient, ConnectionState } from '../src/sdk/ws/client';
import { logger } from '../src/core/logging/logger';
import {
  ApiError,
  NetworkError,
  RateLimitError,
  InsufficientBalanceError,
  ValidationError
} from '../src/core/errors';
import type { Order, Market } from '../src/sdk/types';

/**
 * Bot configuration
 */
interface BotConfig {
  marketId: string;
  checkInterval: number; // milliseconds
  minBalance: number;
  maxOrderSize: number;
}

/**
 * Simple trading bot class
 */
class SimpleTradingBot {
  private client: ApiClient;
  private ws: WebSocketClient;
  private config: BotConfig;
  private isRunning: boolean = false;
  private checkTimer?: NodeJS.Timeout;

  constructor(config: BotConfig) {
    this.config = config;
    this.client = ApiClient.getInstance();
    this.ws = WebSocketClient.getInstance();
  }

  /**
   * Start the bot
   */
  async start(): Promise<void> {
    logger.info('Starting trading bot', { config: this.config });
    this.isRunning = true;

    try {
      // 1. Check authentication and balance
      await this.checkBalance();

      // 2. Connect to WebSocket for real-time updates
      this.setupWebSocket();

      // 3. Start main trading loop
      this.startTradingLoop();

      logger.info('Bot started successfully');
    } catch (error) {
      logger.error('Failed to start bot', { error });
      throw error;
    }
  }

  /**
   * Stop the bot
   */
  async stop(): Promise<void> {
    logger.info('Stopping trading bot');
    this.isRunning = false;

    // Clear timer
    if (this.checkTimer) {
      clearTimeout(this.checkTimer);
    }

    // Cancel all open orders
    try {
      const result = await this.client.cancelAllOrders();
      logger.info('Cancelled all orders', { count: result.cancelled });
    } catch (error) {
      logger.warn('Failed to cancel orders on shutdown', { error });
    }

    // Disconnect WebSocket
    this.ws.disconnect();

    logger.info('Bot stopped');
  }

  /**
   * Check account balance
   */
  private async checkBalance(): Promise<void> {
    try {
      const accounts = await this.client.getTradingAccounts();
      
      logger.info('Account balances retrieved', {
        count: accounts.length
      });

      for (const account of accounts) {
        const available = parseFloat(account.available_balance);
        logger.info('Balance', {
          instrument: account.instrument_symbol,
          available: available,
          total: account.total_balance
        });

        if (available < this.config.minBalance) {
          logger.warn('Low balance detected', {
            instrument: account.instrument_symbol,
            available,
            minimum: this.config.minBalance
          });
        }
      }
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error('API error while checking balance', {
          message: error.message,
          statusCode: error.statusCode
        });
      }
      throw error;
    }
  }

  /**
   * Setup WebSocket connection
   */
  private setupWebSocket(): void {
    // Handle connection events
    this.ws.on('connected', () => {
      logger.info('WebSocket connected');
      
      // Subscribe to order updates
      this.ws.subscribe('orders');
      
      // Subscribe to market data
      this.ws.subscribe('ticker', { market_id: this.config.marketId });
    });

    this.ws.on('disconnected', () => {
      logger.warn('WebSocket disconnected');
    });

    this.ws.on('reconnecting', ({ attempt, delay }) => {
      logger.info('WebSocket reconnecting', { attempt, delay });
    });

    this.ws.on('message', (message) => {
      this.handleWebSocketMessage(message);
    });

    this.ws.on('error', (error) => {
      logger.error('WebSocket error', { error });
    });

    // Connect
    this.ws.connect();
  }

  /**
   * Handle WebSocket messages
   */
  private handleWebSocketMessage(message: any): void {
    logger.debug('WebSocket message received', { type: message.type });

    switch (message.type) {
      case 'ticker':
        this.handleTickerUpdate(message.data);
        break;
      
      case 'order_update':
        this.handleOrderUpdate(message.data);
        break;
      
      default:
        logger.debug('Unknown message type', { type: message.type });
    }
  }

  /**
   * Handle ticker updates
   */
  private handleTickerUpdate(ticker: any): void {
    logger.debug('Ticker update', {
      market: ticker.market_id,
      lastPrice: ticker.last_price,
      bid: ticker.bid,
      ask: ticker.ask
    });

    // Your trading logic here
    // Example: Check if price meets your criteria for placing orders
  }

  /**
   * Handle order updates
   */
  private handleOrderUpdate(order: Order): void {
    logger.info('Order update', {
      orderId: order.id || order.order_id,
      status: order.status,
      filledQuantity: order.filled_quantity
    });

    // Handle order fills, cancellations, etc.
    if (order.status === 'filled') {
      logger.info('Order filled', {
        orderId: order.id || order.order_id,
        size: order.size,
        price: order.price
      });
    }
  }

  /**
   * Start trading loop
   */
  private startTradingLoop(): void {
    const runCheck = async () => {
      if (!this.isRunning) return;

      try {
        await this.checkMarket();
      } catch (error) {
        this.handleError(error);
      }

      // Schedule next check
      this.checkTimer = setTimeout(runCheck, this.config.checkInterval);
    };

    // Start first check
    runCheck();
  }

  /**
   * Check market and execute trading logic
   */
  private async checkMarket(): Promise<void> {
    try {
      // Get market data
      const ticker = await this.client.getTicker(this.config.marketId);
      
      logger.debug('Market check', {
        lastPrice: ticker.last_price,
        bid: ticker.bid,
        ask: ticker.ask
      });

      // Example: Simple logic - just log the price
      // Replace with your actual trading strategy
      const lastPrice = parseFloat(ticker.last_price);
      
      if (lastPrice > 0) {
        logger.info('Current price', {
          market: this.config.marketId,
          price: lastPrice
        });
      }

      // Example: Place an order (commented out for safety)
      // await this.placeExampleOrder();

    } catch (error) {
      // Error handling is done in handleError()
      throw error;
    }
  }

  /**
   * Example of placing an order with error handling
   */
  private async placeExampleOrder(): Promise<void> {
    try {
      const order = await this.client.placeOrder({
        market_id: this.config.marketId,
        side: 'buy',
        type: 'limit',
        quantity: '1',
        price: '100.00',
        time_in_force: 'gtc'
      });

      logger.info('Order placed successfully', {
        orderId: order.order_id,
        status: order.status
      });

    } catch (error) {
      if (error instanceof ValidationError) {
        logger.error('Invalid order parameters', {
          message: error.message,
          details: error.validationErrors
        });
      } else if (error instanceof InsufficientBalanceError) {
        logger.error('Insufficient balance to place order', {
          message: error.message
        });
      } else if (error instanceof RateLimitError) {
        logger.warn('Rate limited, waiting before retry', {
          retryAfter: error.retryAfter
        });
        // Wait before retrying
        await new Promise(resolve => 
          setTimeout(resolve, (error.retryAfter || 60) * 1000)
        );
      } else {
        throw error;
      }
    }
  }

  /**
   * Handle errors
   */
  private handleError(error: any): void {
    if (error instanceof NetworkError) {
      logger.error('Network error', {
        message: error.message,
        originalError: error.originalError?.code
      });
    } else if (error instanceof ApiError) {
      logger.error('API error', {
        message: error.message,
        statusCode: error.statusCode,
        code: error.code
      });
    } else if (error instanceof RateLimitError) {
      logger.warn('Rate limit error', {
        message: error.message,
        retryAfter: error.retryAfter
      });
    } else {
      logger.error('Unexpected error', {
        error: error.message || error
      });
    }
  }
}

/**
 * Main execution
 */
async function main() {
  // Create bot instance
  const bot = new SimpleTradingBot({
    marketId: 'market_b310e860-97cd-45eb-bdc3-5be0b79295d0', // Replace with your market ID
    checkInterval: 60000, // Check every 60 seconds
    minBalance: 100,
    maxOrderSize: 10
  });

  // Graceful shutdown handling
  const shutdown = async () => {
    logger.info('Shutdown signal received');
    await bot.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Handle uncaught errors
  process.on('unhandledRejection', (error) => {
    logger.error('Unhandled rejection', { error });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error });
    shutdown();
  });

  // Start the bot
  try {
    await bot.start();
    logger.info('Bot is running. Press Ctrl+C to stop.');
  } catch (error) {
    logger.error('Failed to start bot', { error });
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { SimpleTradingBot };

