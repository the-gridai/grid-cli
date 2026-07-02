/**
 * Tests for error classes
 */

import { describe, it, expect } from 'vitest';
import {
  GridError,
  ApiError,
  AuthenticationError,
  NetworkError,
  RateLimitError,
  ValidationError,
  InsufficientBalanceError,
  OrderNotFoundError,
  MarketNotFoundError,
  WebSocketError,
} from '../errors.js';

describe('GridError', () => {
  it('should create error with message', () => {
    const error = new GridError('Test error');

    expect(error.message).toBe('Test error');
    expect(error.name).toBe('GridError');
    expect(error instanceof Error).toBe(true);
  });

  it('should include code and details', () => {
    const error = new GridError('Test error', 'TEST_CODE', { foo: 'bar' });

    expect(error.code).toBe('TEST_CODE');
    expect(error.details).toEqual({ foo: 'bar' });
  });
});

describe('ApiError', () => {
  it('should create error with status code', () => {
    const error = new ApiError('Not found', 404);

    expect(error.message).toBe('Not found');
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe('ApiError');
    expect(error instanceof GridError).toBe(true);
  });

  it('should include code and details', () => {
    const error = new ApiError('Bad request', 400, 'VALIDATION_ERROR', { field: 'price' });

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toEqual({ field: 'price' });
  });
});

describe('AuthenticationError', () => {
  it('should create error with default message', () => {
    const error = new AuthenticationError();

    expect(error.message).toBe('Authentication failed');
    expect(error.code).toBe('AUTH_FAILED');
    expect(error.name).toBe('AuthenticationError');
  });

  it('should create error with custom message', () => {
    const error = new AuthenticationError('Invalid signature');

    expect(error.message).toBe('Invalid signature');
  });
});

describe('NetworkError', () => {
  it('should create error with message', () => {
    const error = new NetworkError('Connection refused');

    expect(error.message).toBe('Connection refused');
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.name).toBe('NetworkError');
  });

  it('should include original error', () => {
    const originalError = new Error('ECONNREFUSED');
    const error = new NetworkError('Connection refused', originalError);

    expect(error.originalError).toBe(originalError);
  });
});

describe('RateLimitError', () => {
  it('should create error with default message', () => {
    const error = new RateLimitError();

    expect(error.message).toBe('Rate limit exceeded');
    expect(error.code).toBe('RATE_LIMIT');
    expect(error.name).toBe('RateLimitError');
  });

  it('should include retry after', () => {
    const error = new RateLimitError('Too many requests', 60);

    expect(error.retryAfter).toBe(60);
  });
});

describe('ValidationError', () => {
  it('should create error with message', () => {
    const error = new ValidationError('Invalid input');

    expect(error.message).toBe('Invalid input');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.name).toBe('ValidationError');
  });

  it('should include validation errors', () => {
    const validationErrors = [{ path: ['price'], message: 'Required' }];
    const error = new ValidationError('Invalid input', validationErrors);

    expect(error.validationErrors).toEqual(validationErrors);
  });
});

describe('InsufficientBalanceError', () => {
  it('should create error with default message', () => {
    const error = new InsufficientBalanceError();

    expect(error.message).toBe('Insufficient balance');
    expect(error.code).toBe('INSUFFICIENT_BALANCE');
    expect(error.name).toBe('InsufficientBalanceError');
  });
});

describe('OrderNotFoundError', () => {
  it('should create error with default message', () => {
    const error = new OrderNotFoundError();

    expect(error.message).toBe('Order not found');
    expect(error.code).toBe('ORDER_NOT_FOUND');
    expect(error.name).toBe('OrderNotFoundError');
  });

  it('should include order ID', () => {
    const error = new OrderNotFoundError('Order 123 not found', 'order-123');

    expect(error.orderId).toBe('order-123');
    expect(error.details).toEqual({ orderId: 'order-123' });
  });
});

describe('MarketNotFoundError', () => {
  it('should create error with default message', () => {
    const error = new MarketNotFoundError();

    expect(error.message).toBe('Market not found');
    expect(error.code).toBe('MARKET_NOT_FOUND');
    expect(error.name).toBe('MarketNotFoundError');
  });

  it('should include market ID', () => {
    const error = new MarketNotFoundError('Market BTC-USD not found', 'BTC-USD');

    expect(error.marketId).toBe('BTC-USD');
  });
});

describe('WebSocketError', () => {
  it('should create error with message', () => {
    const error = new WebSocketError('Connection closed');

    expect(error.message).toBe('Connection closed');
    expect(error.code).toBe('WEBSOCKET_ERROR');
    expect(error.name).toBe('WebSocketError');
  });

  it('should include WebSocket code', () => {
    const error = new WebSocketError('Connection closed', 1006);

    expect(error.wsCode).toBe(1006);
  });
});

describe('Error instanceof checks', () => {
  it('ApiError should be instanceof GridError', () => {
    const error = new ApiError('Test', 500);
    expect(error instanceof GridError).toBe(true);
    expect(error instanceof ApiError).toBe(true);
  });

  it('AuthenticationError should be instanceof GridError', () => {
    const error = new AuthenticationError();
    expect(error instanceof GridError).toBe(true);
    expect(error instanceof AuthenticationError).toBe(true);
  });

  it('ValidationError should be instanceof GridError', () => {
    const error = new ValidationError('Test');
    expect(error instanceof GridError).toBe(true);
    expect(error instanceof ValidationError).toBe(true);
  });
});
