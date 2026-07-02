/**
 * Unit tests for TradingGatewayClient
 * 
 * Tests Phoenix Channel protocol, authentication, subscriptions, and event handling
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TradingGatewayClient, GatewayState, OrderEvent, TradeEvent, TickerEvent } from '../../../../src/sdk/ws/trading-gateway';
import { MockPhoenixServer } from '../../../helpers/mock-phoenix-server';

// Set up test environment variables (must be valid 32-byte base64 for Ed25519 seed)
process.env.SIGNING_KEY = 'uYq3KL5UdD//nU1YtRMRTEYVYv+09ITVa6xTowWwo4g=';
process.env.SIGNING_KEY_FINGERPRINT = 'test-fingerprint-12345';
process.env.WS_URL = 'ws://localhost:3458';

describe('TradingGatewayClient', () => {
  let server: MockPhoenixServer;
  let client: TradingGatewayClient;

  beforeEach(() => {
    server = new MockPhoenixServer(3458);
    server.reset();
    
    // Reset singleton
    (TradingGatewayClient as any).instance = undefined;
    client = TradingGatewayClient.getInstance();
  });

  afterEach(async () => {
    if (client) {
      client.disconnect();
    }
    if (server) {
      await server.stop();
    }
  });

  describe('Singleton', () => {
    it('should return same instance', () => {
      const instance1 = TradingGatewayClient.getInstance();
      const instance2 = TradingGatewayClient.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Connection & Authentication', () => {
    it('should connect and authenticate successfully', async () => {
      await client.connect();
      
      expect(client.getState()).toBe(GatewayState.AUTHENTICATED);
      expect(client.isAuthenticated()).toBe(true);
      expect(server.getAuthenticatedCount()).toBe(1);
    }, 10000);

    it('should emit connected and authenticated events', async () => {
      let connectedEmitted = false;
      let authenticatedEmitted = false;

      client.on('connected', () => { connectedEmitted = true; });
      client.on('authenticated', () => { authenticatedEmitted = true; });

      await client.connect();

      expect(connectedEmitted).toBe(true);
      expect(authenticatedEmitted).toBe(true);
    }, 10000);

    it('should handle authentication failure', async () => {
      server.authShouldFail = true;

      await expect(client.connect()).rejects.toThrow();
      expect(client.isAuthenticated()).toBe(false);
    }, 10000);

    it('should disconnect cleanly', async () => {
      await client.connect();
      expect(client.isAuthenticated()).toBe(true);

      client.disconnect();
      expect(client.getState()).toBe(GatewayState.DISCONNECTED);
    }, 10000);
  });

  describe('Subscriptions', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should subscribe to user.orders stream', async () => {
      await client.subscribe([{ name: 'user.orders' }]);

      const history = server.getMessageHistory();
      const subMsg = history.find(m => m.event === 'subscribe');
      
      expect(subMsg).toBeDefined();
      expect(subMsg?.payload.streams).toContainEqual({ name: 'user.orders' });
    }, 10000);

    it('should subscribe to market.trades stream with market ID', async () => {
      const marketId = 'market_123';
      await client.subscribe([{ name: 'market.trades', market: marketId }]);

      const history = server.getMessageHistory();
      const subMsg = history.find(m => m.event === 'subscribe');
      
      expect(subMsg).toBeDefined();
      expect(subMsg?.payload.streams).toContainEqual({ 
        name: 'market.trades', 
        market: marketId 
      });
    }, 10000);

    it('should subscribe to market.ticker stream', async () => {
      const marketId = 'market_456';
      await client.subscribe([{ name: 'market.ticker', market: marketId }]);

      const history = server.getMessageHistory();
      const subMsg = history.find(m => m.event === 'subscribe');
      
      expect(subMsg).toBeDefined();
      expect(subMsg?.payload.streams).toContainEqual({ 
        name: 'market.ticker', 
        market: marketId 
      });
    }, 10000);

    it('should unsubscribe from streams', async () => {
      await client.subscribe([{ name: 'user.orders' }]);
      await client.unsubscribe([{ name: 'user.orders' }]);

      const history = server.getMessageHistory();
      const unsubMsg = history.find(m => m.event === 'unsubscribe');
      
      expect(unsubMsg).toBeDefined();
      expect(unsubMsg?.payload.streams).toContainEqual({ name: 'user.orders' });
    }, 10000);

    it('should reject subscription when not authenticated', async () => {
      // Disconnect and reset
      client.disconnect();
      (TradingGatewayClient as any).instance = undefined;
      client = TradingGatewayClient.getInstance();

      await expect(
        client.subscribe([{ name: 'user.orders' }])
      ).rejects.toThrow('Must be authenticated');
    }, 10000);
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await client.connect();
      await client.subscribe([{ name: 'user.orders' }]);
    });

    it('should emit order event on new_order', (done) => {
      const orderData = {
        order_id: 'order_123',
        market_id: 'market_456',
        trading_account_id: 'ta_789',
        side: 'sell',
        order_type: 'limit',
        status: 'open',
        original_quantity: '10',
        remaining_quantity: '10',
        filled_quantity: '0',
        price: '2.50',
        created_at: new Date().toISOString()
      };

      client.on('order', (event: OrderEvent) => {
        expect(event.event).toBe('new_order');
        expect(event.data.order_id).toBe('order_123');
        expect(event.data.side).toBe('sell');
        done();
      });

      server.broadcastOrderEvent('new_order', orderData);
    }, 10000);

    it('should emit order event on order_update (fill)', (done) => {
      const orderData = {
        order_id: 'order_123',
        market_id: 'market_456',
        trading_account_id: 'ta_789',
        side: 'sell',
        order_type: 'limit',
        status: 'filled',
        original_quantity: '10',
        remaining_quantity: '0',
        filled_quantity: '10',
        price: '2.50',
        average_fill_price: '2.50',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      client.on('order', (event: OrderEvent) => {
        expect(event.event).toBe('order_update');
        expect(event.data.status).toBe('filled');
        expect(event.data.filled_quantity).toBe('10');
        done();
      });

      server.broadcastOrderEvent('order_update', orderData);
    }, 10000);
  });

  describe('Trade Events', () => {
    const marketId = 'market_trade_test';

    beforeEach(async () => {
      await client.connect();
      await client.subscribe([{ name: 'market.trades', market: marketId }]);
    });

    it('should emit trade event on new_trade', (done) => {
      const tradeData = {
        trade_id: 'trade_123',
        market_id: marketId,
        price: '2.50',
        quantity: '5',
        side: 'buy',
        executed_at: new Date().toISOString()
      };

      client.on('trade', (event: TradeEvent) => {
        expect(event.event).toBe('new_trade');
        expect(event.data.trade_id).toBe('trade_123');
        expect(event.data.price).toBe('2.50');
        done();
      });

      server.broadcastTradeEvent(marketId, 'new_trade', tradeData);
    }, 10000);
  });

  describe('Ticker Events & Caching', () => {
    const marketId = 'market_ticker_test';

    beforeEach(async () => {
      await client.connect();
      await client.subscribe([{ name: 'market.ticker', market: marketId }]);
    });

    it('should emit ticker event and cache data', (done) => {
      const tickerData = {
        last_price: '2.50',
        bid: '2.45',
        ask: '2.55',
        volume_24h: '10000'
      };

      client.on('ticker', (event: TickerEvent) => {
        expect(event.event).toBe('market_ticker');
        expect(event.data.last_price).toBe('2.50');

        // Check cache
        const cached = client.getCachedTicker(marketId);
        expect(cached).not.toBeNull();
        expect(cached?.lastPrice).toBe('2.50');
        expect(cached?.ask).toBe('2.55');
        expect(cached?.bid).toBe('2.45');
        done();
      });

      server.broadcastTickerEvent(marketId, tickerData);
    }, 10000);

    it('should report ticker freshness correctly', (done) => {
      client.on('ticker', () => {
        // Just received, should be fresh
        expect(client.isTickerFresh(marketId, 60000)).toBe(true);
        
        // Non-existent market should not be fresh
        expect(client.isTickerFresh('unknown_market', 60000)).toBe(false);
        done();
      });

      server.broadcastTickerEvent(marketId, { last_price: '1.00', bid: '0.99', ask: '1.01' });
    }, 10000);

    it('should return null for uncached ticker', () => {
      const cached = client.getCachedTicker('uncached_market');
      expect(cached).toBeNull();
    });
  });

  describe('Reconnection', () => {
    it('should attempt reconnection on disconnect', async () => {
      await client.connect();
      expect(client.isAuthenticated()).toBe(true);

      let disconnectedEmitted = false;
      client.on('disconnected', () => { disconnectedEmitted = true; });

      // Server-side disconnect
      server.disconnectAll();

      // Wait for disconnect event
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(disconnectedEmitted).toBe(true);
    }, 15000);
  });
});
