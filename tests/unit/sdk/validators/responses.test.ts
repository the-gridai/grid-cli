/**
 * Unit tests for response validators
 */

import { describe, it, expect } from '@jest/globals';
import { ZodError } from 'zod';
import {
  validateResponse,
  validateArrayResponse,
  validateOptionalResponse,
  OrderSchema,
  TradeSchema,
  MarketSchema,
  InstrumentSchema,
  TickerSchema,
  OrderBookSchema,
  TradingAccountSchema,
  ConsumptionInstrumentSchema
} from '../../../../src/sdk/validators/responses';
import { ValidationError } from '../../../../src/core/errors';

describe('validateResponse', () => {
  it('should validate correct data', () => {
    const data = {
      order_id: 'order_123',
      market_id: 'market_456',
      side: 'buy',
      type: 'limit',
      quantity: 10,
      price: '100.50',
      filled_quantity: 0, // Real API uses number not string
      status: 'active', // Real API uses 'active' not 'open'
      time_in_force: 'gtc',
      submitted_at: '2025-01-01T00:00:00Z'
    };

    const result = validateResponse(data, OrderSchema);
    expect(result.order_id).toBe('order_123');
  });

  it('should throw ValidationError on invalid data', () => {
    const invalidData = {
      order_id: 'order_123'
      // Missing required fields
    };

    expect(() => validateResponse(invalidData, OrderSchema)).toThrow(ValidationError);
  });

  it('should include validation details in error', () => {
    const invalidData = {};

    try {
      validateResponse(invalidData, OrderSchema);
      fail('Should have thrown ValidationError');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).validationErrors).toBeDefined();
    }
  });
});

describe('validateArrayResponse', () => {
  it('should validate array of valid items', () => {
    const data = [
      {
        order_id: 'order_1',
        market_id: 'market_1',
        side: 'buy',
        type: 'limit',
        quantity: 10,
        price: '100',
        filled_quantity: 0,
        status: 'active',
        time_in_force: 'gtc',
        submitted_at: '2025-01-01T00:00:00Z'
      },
      {
        order_id: 'order_2',
        market_id: 'market_2',
        side: 'sell',
        type: 'limit',
        quantity: 5,
        price: '105',
        filled_quantity: 0,
        status: 'active',
        time_in_force: 'gtc',
        submitted_at: '2025-01-01T00:00:00Z'
      }
    ];

    const result = validateArrayResponse(data, OrderSchema);
    expect(result).toHaveLength(2);
  });

  it('should throw on invalid array item', () => {
    const data = [
      {
        order_id: 'order_1',
        market_id: 'market_1',
        side: 'buy',
        type: 'limit',
        quantity: '10',
        price: '100',
        filled_quantity: '0',
        status: 'open',
        time_in_force: 'gtc',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z'
      },
      {
        order_id: 'order_2'
        // Missing required fields
      }
    ];

    expect(() => validateArrayResponse(data, OrderSchema)).toThrow(ValidationError);
  });

  it('should validate empty array', () => {
    const data: any[] = [];
    const result = validateArrayResponse(data, OrderSchema);
    expect(result).toEqual([]);
  });
});

describe('validateOptionalResponse', () => {
  it('should validate valid data', () => {
    const data = {
      order_id: 'order_123',
      market_id: 'market_456',
      side: 'buy',
      type: 'limit',
      quantity: 10,
      price: '100.50',
      filled_quantity: 0,
      status: 'active',
      time_in_force: 'gtc',
      submitted_at: '2025-01-01T00:00:00Z'
    };

    const result = validateOptionalResponse(data, OrderSchema);
    expect(result?.order_id).toBe('order_123');
  });

  it('should return null for null', () => {
    const result = validateOptionalResponse(null, OrderSchema);
    expect(result).toBeNull();
  });

  it('should return null for undefined', () => {
    const result = validateOptionalResponse(undefined, OrderSchema);
    expect(result).toBeNull();
  });
});

describe('OrderSchema', () => {
  it('should validate complete order', () => {
    const order = {
      order_id: 'order_123',
      market_id: 'market_456',
      side: 'buy',
      type: 'limit',
      quantity: 10, // Real API uses number
      price: '100.50',
      filled_quantity: 5, // Real API uses number
      status: 'active',
      time_in_force: 'gtc',
      submitted_at: '2025-01-01T00:00:00Z'
    };

    const result = OrderSchema.parse(order);
    expect(result.order_id).toBe('order_123');
  });

  it('should fail with missing order_id', () => {
    const order = {
      market_id: 'market_456',
      side: 'buy',
      type: 'limit',
      quantity: 10,
      price: '100.50',
      filled_quantity: 0,
      status: 'active',
      time_in_force: 'gtc'
      // Missing required 'id' field
    };

    expect(() => OrderSchema.parse(order)).toThrow();
  });

  it('should fail with invalid side', () => {
    const order = {
      order_id: 'order_123',
      market_id: 'market_456',
      side: 'invalid',
      type: 'limit',
      quantity: 10,
      price: '100.50',
      filled_quantity: 0,
      status: 'active',
      time_in_force: 'gtc',
      submitted_at: '2025-01-01T00:00:00Z'
    };

    expect(() => OrderSchema.parse(order)).toThrow();
  });

  it('should accept any status string', () => {
    const order = {
      order_id: 'order_123',
      market_id: 'market_456',
      side: 'buy',
      type: 'limit',
      quantity: 10,
      price: '100.50',
      filled_quantity: 0,
      status: 'any_status', // Schema now allows any string
      time_in_force: 'gtc',
      submitted_at: '2025-01-01T00:00:00Z'
    };

    const result = OrderSchema.parse(order);
    expect(result.status).toBe('any_status');
  });
});

describe('MarketSchema', () => {
  it('should validate complete market', () => {
    const market = {
      market_id: 'market_123',
      name: 'BTC/USD Market',
      symbol: 'BTC/USD',
      base_instrument_id: 'instr_btc',
      quote_instrument_id: 'instr_usd',
      status: 'active',
      min_order_size: '0.001',
      max_order_size: '1000',
      price_precision: 2,
      quantity_precision: 8,
      tick_size: '0.01',
      lot_size: '0.001',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z'
    };

    const result = MarketSchema.parse(market);
    expect(result).toEqual(market);
  });

  it('should accept any status string', () => {
    const market = {
      market_id: 'market_123',
      name: 'BTC/USD Market',
      symbol: 'BTC/USD',
      base_instrument_id: 'instr_btc',
      quote_instrument_id: 'instr_usd',
      status: 'custom_status',
      min_order_size: '0.001',
      max_order_size: '1000',
      price_precision: 2,
      quantity_precision: 8,
      tick_size: '0.01',
      lot_size: '0.001',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z'
    };

    // Schema accepts any status string
    const result = MarketSchema.parse(market);
    expect(result.status).toBe('custom_status');
  });
});

describe('InstrumentSchema', () => {
  it('should validate complete instrument', () => {
    const instrument = {
      instrument_id: 'instr_123',
      symbol: 'BTC',
      name: 'Bitcoin',
      instrument_type: 'currency',
      precision: 8,
      is_active: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z'
    };

    const result = InstrumentSchema.parse(instrument);
    expect(result).toEqual(instrument);
  });

  it('should fail with invalid instrument_type', () => {
    const instrument = {
      instrument_id: 'instr_123',
      symbol: 'BTC',
      name: 'Bitcoin',
      instrument_type: 'invalid_type',
      precision: 8,
      is_active: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z'
    };

    expect(() => InstrumentSchema.parse(instrument)).toThrow(ZodError);
  });
});

describe('TickerSchema', () => {
  it('should validate complete ticker', () => {
    const ticker = {
      market_id: 'market_123',
      symbol: 'BTC/USD',
      last_price: '50000.00',
      highest_bid: '49999.00', // Real API uses this
      lowest_ask: '50001.00',  // Real API uses this
      volume_24h: 1000, // Real API returns number
      high_24h: '51000.00',
      low_24h: '49000.00',
      quote_volume_24h: '50000000.00',
      price_change_24h: '1000.00',
      price_change_percent_24h: '2.04',
      timestamp: '2025-01-01T00:00:00Z'
    };

    const result = TickerSchema.parse(ticker);
    expect(result.last_price).toBe('50000.00');
  });
});

describe('OrderBookSchema', () => {
  it('should validate complete order book with bids/asks format', () => {
    const orderbook = {
      market_id: 'market_123',
      bids: [
        { price: '49999.00', quantity: '1.5' },
        { price: '49998.00', quantity: '2.0' }
      ],
      asks: [
        { price: '50001.00', quantity: '1.0' },
        { price: '50002.00', quantity: '1.5' }
      ],
      timestamp: '2025-01-01T00:00:00Z'
    };

    const result = OrderBookSchema.parse(orderbook);
    // Schema normalizes to have both bids/asks and buy/sell
    expect(result.bids).toHaveLength(2);
    expect(result.asks).toHaveLength(2);
    expect(result.buy).toHaveLength(2);
    expect(result.sell).toHaveLength(2);
  });

  it('should validate complete order book with exchange buy/sell format', () => {
    const orderbook = {
      buy: [
        { price: '49999.00', quantity: 15 },
        { price: '49998.00', quantity: 20 }
      ],
      sell: [
        { price: '50001.00', quantity: 10 },
        { price: '50002.00', quantity: 15 }
      ]
    };

    const result = OrderBookSchema.parse(orderbook);
    // Schema normalizes to have both bids/asks and buy/sell
    expect(result.bids).toHaveLength(2);
    expect(result.asks).toHaveLength(2);
    expect(result.buy).toHaveLength(2);
    expect(result.sell).toHaveLength(2);
  });

  it('should validate with empty bids/asks', () => {
    const orderbook = {
      market_id: 'market_123',
      bids: [],
      asks: [],
      timestamp: '2025-01-01T00:00:00Z'
    };

    const result = OrderBookSchema.parse(orderbook);
    expect(result.bids).toHaveLength(0);
    expect(result.asks).toHaveLength(0);
  });
});

describe('TradingAccountSchema', () => {
  it('should validate complete trading account', () => {
    const account = {
      account_id: 'acct_123',
      instrument_id: 'instr_456',
      instrument_symbol: 'BTC',
      total_balance: '10.5',
      available_balance: '8.0',
      reserved_balance: '2.5',
      updated_at: '2025-01-01T00:00:00Z'
    };

    const result = TradingAccountSchema.parse(account);
    expect(result).toEqual(account);
  });
});

describe('ConsumptionInstrumentSchema', () => {
  it('should validate complete consumption instrument', () => {
    const instrument = {
      account_id: 'acc_123',
      user_id: 'user_456',
      instrument_id: 'instr_123',
      status: 'active',
      available_balance: '5000',
      committed_balance: '2500',
      total_balance: '7500',
      total_deposits: '10000',
      total_withdrawals: '2500',
      total_commitments: '0',
      total_transfers_in: '0',
      total_transfers_out: '0',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z'
    };

    const result = ConsumptionInstrumentSchema.parse(instrument);
    expect(result).toEqual(instrument);
  });
});

describe('TradeSchema', () => {
  it('should validate complete trade', () => {
    const trade = {
      id: 'trade_123',
      trade_id: 'trade_123',
      order_id: 'order_456',
      market_id: 'market_789',
      side: 'buy',
      quantity: '1.5',
      price: '50000.00',
      total_value: '75000.00',
      fee: '0.50',
      execution_timestamp: '2025-01-01T00:00:00Z',
      created_at: '2025-01-01T00:00:00Z',
      is_maker: true
    };

    const result = TradeSchema.parse(trade);
    expect(result).toEqual(trade);
  });

  it('should fail with invalid side', () => {
    const trade = {
      id: 'trade_123',
      trade_id: 'trade_123',
      order_id: 'order_456',
      market_id: 'market_789',
      side: 'invalid',
      quantity: '1.5',
      price: '50000.00',
      total_value: '75000.00',
      fee: '0.50',
      execution_timestamp: '2025-01-01T00:00:00Z',
      created_at: '2025-01-01T00:00:00Z',
      is_maker: true
    };

    expect(() => TradeSchema.parse(trade)).toThrow(ZodError);
  });
});

