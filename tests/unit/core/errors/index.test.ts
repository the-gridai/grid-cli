/**
 * Unit tests for custom error classes
 */

import { describe, it, expect } from '@jest/globals';
import {
  GridError,
  ApiError,
  AuthenticationError,
  NetworkError,
  RateLimitError,
  ValidationError,
  InsufficientBalanceError,
  OrderNotFoundError,
  MarketNotFoundError
} from '../../../../src/core/errors';

describe('GridError', () => {
  it('should create error with message and code', () => {
    const error = new GridError('Test error', 'TEST_CODE');
    
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('GridError');
    expect(error instanceof Error).toBe(true);
  });

  it('should include details', () => {
    const details = { field: 'value' };
    const error = new GridError('Test error', 'TEST_CODE', details);
    
    expect(error.details).toEqual(details);
  });
});

describe('ApiError', () => {
  it('should include status code', () => {
    const error = new ApiError('API failed', 500, 'SERVER_ERROR');
    
    expect(error.message).toBe('API failed');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('SERVER_ERROR');
    expect(error.name).toBe('ApiError');
  });

  it('should inherit from GridError', () => {
    const error = new ApiError('API failed', 500);
    
    expect(error instanceof GridError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

describe('AuthenticationError', () => {
  it('should have default message', () => {
    const error = new AuthenticationError();
    
    expect(error.message).toBe('Authentication failed');
    expect(error.code).toBe('AUTH_FAILED');
    expect(error.name).toBe('AuthenticationError');
  });

  it('should accept custom message', () => {
    const error = new AuthenticationError('Invalid API key');
    
    expect(error.message).toBe('Invalid API key');
  });
});

describe('NetworkError', () => {
  it('should store original error', () => {
    const originalError = new Error('ECONNREFUSED');
    const error = new NetworkError('Connection failed', originalError);
    
    expect(error.message).toBe('Connection failed');
    expect(error.originalError).toBe(originalError);
    expect(error.code).toBe('NETWORK_ERROR');
  });
});

describe('RateLimitError', () => {
  it('should have default message', () => {
    const error = new RateLimitError();
    
    expect(error.message).toBe('Rate limit exceeded');
    expect(error.code).toBe('RATE_LIMIT');
  });

  it('should include retry after time', () => {
    const error = new RateLimitError('Too many requests', 60);
    
    expect(error.retryAfter).toBe(60);
  });
});

describe('ValidationError', () => {
  it('should include validation errors', () => {
    const validationErrors = [
      { field: 'email', message: 'Invalid email' }
    ];
    const error = new ValidationError('Validation failed', validationErrors);
    
    expect(error.validationErrors).toEqual(validationErrors);
    expect(error.code).toBe('VALIDATION_ERROR');
  });
});

describe('InsufficientBalanceError', () => {
  it('should have default message', () => {
    const error = new InsufficientBalanceError();
    
    expect(error.message).toBe('Insufficient balance');
    expect(error.code).toBe('INSUFFICIENT_BALANCE');
  });
});

describe('OrderNotFoundError', () => {
  it('should include order ID', () => {
    const error = new OrderNotFoundError('Order not found', 'order_123');
    
    expect(error.orderId).toBe('order_123');
    expect(error.code).toBe('ORDER_NOT_FOUND');
  });
});

describe('MarketNotFoundError', () => {
  it('should include market ID', () => {
    const error = new MarketNotFoundError('Market not found', 'market_456');
    
    expect(error.marketId).toBe('market_456');
    expect(error.code).toBe('MARKET_NOT_FOUND');
  });
});

