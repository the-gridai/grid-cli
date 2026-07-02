/**
 * Mock Trading Gateway Client for Testing
 * 
 * Provides a configurable mock of the TradingGatewayClient for unit tests.
 */

export interface MockTickerData {
  last_price: string;
  bid: string;
  ask: string;
  volume_24h?: string;
  timestamp?: number;
}

export interface MockOrderEvent {
  order_id: string;
  client_order_id?: string;
  market_id: string;
  side: 'buy' | 'sell';
  price: string;
  quantity: string;
  filled_quantity: string;
  average_fill_price?: string;
  status: 'open' | 'partially_filled' | 'filled' | 'cancelled' | 'rejected';
}

export interface MockTradingGatewayConfig {
  ticker?: MockTickerData;
  tickerFreshMs?: number;
  connected?: boolean;
  subscribed?: boolean;
}

type EventHandler = (...args: any[]) => void;

/**
 * Creates a mock TradingGatewayClient instance for testing
 */
export function createMockTradingGateway(config: MockTradingGatewayConfig = {}) {
  const {
    ticker = { last_price: '1.00', bid: '0.99', ask: '1.01' },
    tickerFreshMs = 30000,
    connected = true,
    subscribed = false,
  } = config;

  let isConnected = connected;
  let isSubscribed = subscribed;
  let cachedTicker: MockTickerData | null = ticker;
  let tickerTimestamp = Date.now();
  
  // Event handlers storage
  const eventHandlers: Map<string, Set<EventHandler>> = new Map();

  const mockGateway = {
    // Connection methods
    connect: jest.fn(async () => {
      isConnected = true;
      mockGateway._emit('connected');
    }),

    disconnect: jest.fn(async () => {
      isConnected = false;
      mockGateway._emit('disconnected');
    }),

    isConnected: jest.fn(() => isConnected),

    // Subscription methods
    subscribe: jest.fn(async (_marketId: string, _streams: string[]) => {
      isSubscribed = true;
    }),

    unsubscribe: jest.fn(async (_marketId: string) => {
      isSubscribed = false;
    }),

    // Event handling
    on: jest.fn((event: string, handler: EventHandler) => {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, new Set());
      }
      eventHandlers.get(event)!.add(handler);
    }),

    off: jest.fn((event: string, handler: EventHandler) => {
      eventHandlers.get(event)?.delete(handler);
    }),

    // Ticker methods
    getCachedTicker: jest.fn((_marketId: string) => {
      return cachedTicker;
    }),

    isTickerFresh: jest.fn((_marketId: string, maxAgeMs?: number) => {
      const age = Date.now() - tickerTimestamp;
      return age < (maxAgeMs ?? tickerFreshMs);
    }),

    // Internal helpers for testing

    /**
     * Emit an event to all registered handlers
     */
    _emit: (event: string, ...args: any[]) => {
      const handlers = eventHandlers.get(event);
      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(...args);
          } catch (e) {
            // Ignore handler errors in tests
          }
        });
      }
    },

    /**
     * Simulate an order event
     */
    _emitOrderEvent: (orderEvent: MockOrderEvent) => {
      mockGateway._emit('order', orderEvent);
    },

    /**
     * Simulate a ticker update
     */
    _emitTickerUpdate: (newTicker: MockTickerData) => {
      cachedTicker = newTicker;
      tickerTimestamp = Date.now();
      mockGateway._emit('ticker', newTicker);
    },

    /**
     * Simulate a disconnection
     */
    _simulateDisconnect: () => {
      isConnected = false;
      mockGateway._emit('disconnected');
    },

    /**
     * Simulate a reconnection
     */
    _simulateReconnect: () => {
      isConnected = true;
      mockGateway._emit('connected');
    },

    /**
     * Update the cached ticker directly (for testing stale ticker scenarios)
     */
    _setCachedTicker: (newTicker: MockTickerData | null, timestamp?: number) => {
      cachedTicker = newTicker;
      tickerTimestamp = timestamp ?? Date.now();
    },

    /**
     * Set the ticker timestamp to simulate stale data
     */
    _setTickerTimestamp: (timestamp: number) => {
      tickerTimestamp = timestamp;
    },

    /**
     * Get all registered event handlers (for inspection)
     */
    _getEventHandlers: () => eventHandlers,

    /**
     * Reset all mocks and state
     */
    _reset: () => {
      mockGateway.connect.mockClear();
      mockGateway.disconnect.mockClear();
      mockGateway.isConnected.mockClear();
      mockGateway.subscribe.mockClear();
      mockGateway.unsubscribe.mockClear();
      mockGateway.on.mockClear();
      mockGateway.off.mockClear();
      mockGateway.getCachedTicker.mockClear();
      mockGateway.isTickerFresh.mockClear();
      eventHandlers.clear();
      isConnected = connected;
      isSubscribed = subscribed;
      cachedTicker = ticker;
      tickerTimestamp = Date.now();
    },
  };

  return mockGateway;
}

export type MockTradingGateway = ReturnType<typeof createMockTradingGateway>;

/**
 * Helper to create a fill order event
 */
export function createFillEvent(overrides: Partial<MockOrderEvent> = {}): MockOrderEvent {
  return {
    order_id: `order_${Date.now()}`,
    market_id: 'market_test123',
    side: 'sell',
    price: '1.00',
    quantity: '10',
    filled_quantity: '10',
    average_fill_price: '1.00',
    status: 'filled',
    ...overrides,
  };
}

/**
 * Helper to create a partial fill order event
 */
export function createPartialFillEvent(overrides: Partial<MockOrderEvent> = {}): MockOrderEvent {
  return {
    order_id: `order_${Date.now()}`,
    market_id: 'market_test123',
    side: 'sell',
    price: '1.00',
    quantity: '10',
    filled_quantity: '5',
    average_fill_price: '1.00',
    status: 'partially_filled',
    ...overrides,
  };
}

/**
 * Helper to create a cancelled order event
 */
export function createCancelledEvent(overrides: Partial<MockOrderEvent> = {}): MockOrderEvent {
  return {
    order_id: `order_${Date.now()}`,
    market_id: 'market_test123',
    side: 'sell',
    price: '1.00',
    quantity: '10',
    filled_quantity: '0',
    status: 'cancelled',
    ...overrides,
  };
}
