/**
 * Tests for validation schemas
 */

import { describe, it, expect } from 'vitest';
import {
  validatePlaceOrderRequest,
  validateUpdateOrderRequest,
  validateResponse,
  validateArrayResponse,
  OrderSchema,
  TradingAccountSchema,
} from '../validators.js';
import { ValidationError } from '../errors.js';

describe('validatePlaceOrderRequest', () => {
  it('should validate a valid limit order', () => {
    const order = {
      market_id: 'BTC-USD',
      side: 'buy',
      type: 'limit',
      quantity: '1.5',
      price: '50000',
    };

    const result = validatePlaceOrderRequest(order);

    expect(result).toEqual(order);
  });

  it('should validate a valid market order', () => {
    const order = {
      market_id: 'BTC-USD',
      side: 'sell',
      type: 'market',
      quantity: '1.0',
    };

    const result = validatePlaceOrderRequest(order);

    expect(result).toEqual(order);
  });

  it('should validate order with all optional fields', () => {
    const order = {
      market_id: 'BTC-USD',
      side: 'buy',
      type: 'limit',
      quantity: '1.0',
      price: '50000',
      time_in_force: 'gtc',
      client_order_id: 'my-order-123',
      post_only: true,
      reduce_only: false,
    };

    const result = validatePlaceOrderRequest(order);

    expect(result).toEqual(order);
  });

  it('should reject missing market_id', () => {
    const order = {
      side: 'buy',
      type: 'limit',
      quantity: '1.0',
      price: '50000',
    };

    expect(() => validatePlaceOrderRequest(order)).toThrow(ValidationError);
  });

  it('should reject invalid side', () => {
    const order = {
      market_id: 'BTC-USD',
      side: 'invalid',
      type: 'limit',
      quantity: '1.0',
      price: '50000',
    };

    expect(() => validatePlaceOrderRequest(order)).toThrow(ValidationError);
  });

  it('should reject invalid type', () => {
    const order = {
      market_id: 'BTC-USD',
      side: 'buy',
      type: 'invalid',
      quantity: '1.0',
    };

    expect(() => validatePlaceOrderRequest(order)).toThrow(ValidationError);
  });

  it('should reject negative quantity', () => {
    const order = {
      market_id: 'BTC-USD',
      side: 'buy',
      type: 'market',
      quantity: '-1.0',
    };

    expect(() => validatePlaceOrderRequest(order)).toThrow(ValidationError);
  });

  it('should reject limit order without price', () => {
    const order = {
      market_id: 'BTC-USD',
      side: 'buy',
      type: 'limit',
      quantity: '1.0',
    };

    expect(() => validatePlaceOrderRequest(order)).toThrow(ValidationError);
  });

  it('should reject stop order without stop_price', () => {
    const order = {
      market_id: 'BTC-USD',
      side: 'buy',
      type: 'stop',
      quantity: '1.0',
    };

    expect(() => validatePlaceOrderRequest(order)).toThrow(ValidationError);
  });

  it('should validate stop order with stop_price', () => {
    const order = {
      market_id: 'BTC-USD',
      side: 'buy',
      type: 'stop',
      quantity: '1.0',
      stop_price: '45000',
    };

    const result = validatePlaceOrderRequest(order);

    expect(result).toEqual(order);
  });

  it('should validate stop_limit order with both prices', () => {
    const order = {
      market_id: 'BTC-USD',
      side: 'buy',
      type: 'stop_limit',
      quantity: '1.0',
      price: '50000',
      stop_price: '45000',
    };

    const result = validatePlaceOrderRequest(order);

    expect(result).toEqual(order);
  });
});

describe('validateUpdateOrderRequest', () => {
  it('should validate update with price', () => {
    const update = { price: '51000' };

    const result = validateUpdateOrderRequest(update);

    expect(result).toEqual(update);
  });

  it('should validate update with quantity', () => {
    const update = { quantity: '2.0' };

    const result = validateUpdateOrderRequest(update);

    expect(result).toEqual(update);
  });

  it('should validate update with multiple fields', () => {
    const update = {
      price: '51000',
      quantity: '2.0',
      time_in_force: 'ioc',
    };

    const result = validateUpdateOrderRequest(update);

    expect(result).toEqual(update);
  });

  it('should reject empty update', () => {
    const update = {};

    expect(() => validateUpdateOrderRequest(update)).toThrow(ValidationError);
  });

  it('should reject invalid price', () => {
    const update = { price: '-100' };

    expect(() => validateUpdateOrderRequest(update)).toThrow(ValidationError);
  });
});

describe('validateResponse', () => {
  it('should validate valid order response', () => {
    const order = {
      order_id: 'order-123',
      id: 'order-123',
      market_id: 'BTC-USD',
      side: 'buy',
      type: 'limit',
      status: 'active',
      quantity: '1',
      filled_quantity: 0,
      price: '50000',
      time_in_force: 'gtc',
    };

    const result = validateResponse(order, OrderSchema);

    expect(result.id).toBe('order-123');
  });

  it('should throw on invalid order response', () => {
    const order = {
      id: 'order-123',
      // Missing required fields
    };

    expect(() => validateResponse(order, OrderSchema)).toThrow(ValidationError);
  });

  it('should pass through additional fields', () => {
    const order = {
      order_id: 'order-123',
      id: 'order-123',
      market_id: 'BTC-USD',
      side: 'buy',
      type: 'limit',
      status: 'active',
      quantity: '1',
      filled_quantity: 0,
      price: '50000',
      time_in_force: 'gtc',
      extra_field: 'should pass through',
    };

    const result = validateResponse(order, OrderSchema);

    expect((result as Record<string, unknown>).extra_field).toBe('should pass through');
  });
});

describe('validateArrayResponse', () => {
  it('should validate array of valid items', () => {
    const accounts = [
      {
        account_id: 'acc-1',
        instrument_id: 'BTC',
        total_balance: '100',
        available_balance: '100',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        account_id: 'acc-2',
        instrument_id: 'ETH',
        total_balance: '50',
        available_balance: '50',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ];

    const result = validateArrayResponse(accounts, TradingAccountSchema);

    expect(result).toHaveLength(2);
    expect(result[0].account_id).toBe('acc-1');
    expect(result[1].account_id).toBe('acc-2');
  });

  it('should validate empty array', () => {
    const result = validateArrayResponse([], TradingAccountSchema);

    expect(result).toEqual([]);
  });

  it('should throw on invalid item in array', () => {
    const accounts = [
      {
        account_id: 'acc-1',
        instrument_id: 'BTC',
        total_balance: '100',
        available_balance: '100',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        // Missing required fields
        account_id: 'acc-2',
      },
    ];

    expect(() => validateArrayResponse(accounts, TradingAccountSchema)).toThrow(ValidationError);
  });
});
