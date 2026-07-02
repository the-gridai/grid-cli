/**
 * Mock API Client for Testing
 * 
 * Provides a configurable mock of the ApiClient for unit tests.
 */

export interface MockMarket {
  market_id: string;
  name: string;
  instruments?: Array<{ instrument_id: string }>;
}

export interface MockTicker {
  last_price: string;
  bid: string;
  ask: string;
  volume_24h?: string;
}

export interface MockOrder {
  id?: string;
  order_id: string;
  client_order_id?: string;
  market_id: string;
  side: 'buy' | 'sell';
  price: string;
  quantity: string;
  filled_quantity: string;
  status: 'open' | 'filled' | 'cancelled' | 'rejected';
  created_at?: string;
  updated_at?: string;
}

export interface MockTradingAccount {
  account_id: string;
  balances: Array<{
    instrument_id: string;
    available: string;
    reserved: string;
  }>;
}

export interface MockApiClientConfig {
  markets?: MockMarket[];
  ticker?: MockTicker;
  orders?: MockOrder[];
  tradingAccounts?: MockTradingAccount[];
  placeOrderResponse?: MockOrder | Error;
  cancelOrderResponse?: { success: boolean } | Error;
  failOnMethod?: string;
  delayMs?: number;
}

/**
 * Creates a mock ApiClient instance for testing
 */
export function createMockApiClient(config: MockApiClientConfig = {}) {
  const {
    markets = [],
    ticker = { last_price: '1.00', bid: '0.99', ask: '1.01' },
    orders = [],
    tradingAccounts = [],
    placeOrderResponse,
    cancelOrderResponse = { success: true },
    failOnMethod,
    delayMs = 0,
  } = config;

  const delay = () => delayMs > 0 ? new Promise(r => setTimeout(r, delayMs)) : Promise.resolve();

  const mockClient = {
    // Market methods
    getMarket: jest.fn(async (marketId: string) => {
      await delay();
      if (failOnMethod === 'getMarket') throw new Error('Mock getMarket error');
      const market = markets.find(m => m.market_id === marketId);
      if (!market) throw new Error(`Market ${marketId} not found`);
      return market;
    }),

    getMarkets: jest.fn(async () => {
      await delay();
      if (failOnMethod === 'getMarkets') throw new Error('Mock getMarkets error');
      return markets;
    }),

    // Ticker methods
    getTicker: jest.fn(async (_marketId: string) => {
      await delay();
      if (failOnMethod === 'getTicker') throw new Error('Mock getTicker error');
      return ticker;
    }),

    // Order methods
    placeOrder: jest.fn(async (orderParams: any) => {
      await delay();
      if (failOnMethod === 'placeOrder') throw new Error('Mock placeOrder error');
      if (placeOrderResponse instanceof Error) throw placeOrderResponse;
      if (placeOrderResponse) return placeOrderResponse;
      
      const newOrder: MockOrder = {
        order_id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        client_order_id: orderParams.client_order_id,
        market_id: orderParams.market_id,
        side: orderParams.side,
        price: orderParams.price,
        quantity: orderParams.quantity,
        filled_quantity: '0',
        status: 'open',
      };
      orders.push(newOrder);
      return newOrder;
    }),

    cancelOrder: jest.fn(async (_orderId: string) => {
      await delay();
      if (failOnMethod === 'cancelOrder') throw new Error('Mock cancelOrder error');
      if (cancelOrderResponse instanceof Error) throw cancelOrderResponse;
      return cancelOrderResponse;
    }),

    listOrders: jest.fn(async (filters?: { status?: string; market_id?: string }) => {
      await delay();
      if (failOnMethod === 'listOrders') throw new Error('Mock listOrders error');
      let result = [...orders];
      if (filters?.status) {
        result = result.filter(o => o.status === filters.status);
      }
      if (filters?.market_id) {
        result = result.filter(o => o.market_id === filters.market_id);
      }
      return result;
    }),

    // Account methods
    getTradingAccounts: jest.fn(async () => {
      await delay();
      if (failOnMethod === 'getTradingAccounts') throw new Error('Mock getTradingAccounts error');
      return tradingAccounts;
    }),

    // Reset all mocks
    _reset: () => {
      mockClient.getMarket.mockClear();
      mockClient.getMarkets.mockClear();
      mockClient.getTicker.mockClear();
      mockClient.placeOrder.mockClear();
      mockClient.cancelOrder.mockClear();
      mockClient.listOrders.mockClear();
      mockClient.getTradingAccounts.mockClear();
    },

    // Get call history
    _getCallHistory: () => ({
      getMarket: mockClient.getMarket.mock.calls,
      getMarkets: mockClient.getMarkets.mock.calls,
      getTicker: mockClient.getTicker.mock.calls,
      placeOrder: mockClient.placeOrder.mock.calls,
      cancelOrder: mockClient.cancelOrder.mock.calls,
      listOrders: mockClient.listOrders.mock.calls,
      getTradingAccounts: mockClient.getTradingAccounts.mock.calls,
    }),
  };

  return mockClient;
}

export type MockApiClient = ReturnType<typeof createMockApiClient>;

/**
 * Helper to create a standard test market
 */
export function createTestMarket(overrides: Partial<MockMarket> = {}): MockMarket {
  return {
    market_id: 'market_test123',
    name: 'Test Market',
    instruments: [{ instrument_id: 'instrument_test123' }],
    ...overrides,
  };
}

/**
 * Helper to create a standard test order
 */
export function createTestOrder(overrides: Partial<MockOrder> = {}): MockOrder {
  return {
    order_id: `order_${Date.now()}`,
    market_id: 'market_test123',
    side: 'sell',
    price: '1.00',
    quantity: '10',
    filled_quantity: '0',
    status: 'open',
    ...overrides,
  };
}

/**
 * Helper to create a standard test trading account
 */
export function createTestTradingAccount(overrides: Partial<MockTradingAccount> = {}): MockTradingAccount {
  return {
    account_id: 'account_test123',
    balances: [
      { instrument_id: 'USDC', available: '10000', reserved: '0' },
      { instrument_id: 'instrument_test123', available: '1000', reserved: '0' },
    ],
    ...overrides,
  };
}
