/**
 * Custom error classes for GRID CLI
 * 
 * Provides structured error handling with specific error types
 * for different failure scenarios (API errors, network issues, etc.)
 */

export class GridError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'GridError';
    Object.setPrototypeOf(this, GridError.prototype);
  }
}

export class ApiError extends GridError {
  constructor(
    message: string,
    public statusCode: number,
    code?: string,
    details?: any
  ) {
    super(message, code, details);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export class AuthenticationError extends GridError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTH_FAILED');
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class NetworkError extends GridError {
  constructor(
    message: string,
    public originalError?: any
  ) {
    super(message, 'NETWORK_ERROR', originalError);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

export class RateLimitError extends GridError {
  constructor(
    message: string = 'Rate limit exceeded',
    public retryAfter?: number
  ) {
    super(message, 'RATE_LIMIT');
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export class ValidationError extends GridError {
  constructor(
    message: string,
    public validationErrors?: any
  ) {
    super(message, 'VALIDATION_ERROR', validationErrors);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class InsufficientBalanceError extends GridError {
  constructor(message: string = 'Insufficient balance') {
    super(message, 'INSUFFICIENT_BALANCE');
    this.name = 'InsufficientBalanceError';
    Object.setPrototypeOf(this, InsufficientBalanceError.prototype);
  }
}

export class OrderNotFoundError extends GridError {
  constructor(
    message: string = 'Order not found',
    public orderId?: string
  ) {
    super(message, 'ORDER_NOT_FOUND', { orderId });
    this.name = 'OrderNotFoundError';
    Object.setPrototypeOf(this, OrderNotFoundError.prototype);
  }
}

export class MarketNotFoundError extends GridError {
  constructor(
    message: string = 'Market not found',
    public marketId?: string
  ) {
    super(message, 'MARKET_NOT_FOUND', { marketId });
    this.name = 'MarketNotFoundError';
    Object.setPrototypeOf(this, MarketNotFoundError.prototype);
  }
}

export class OrderAlreadyCancelledError extends GridError {
  constructor(
    message: string = 'Order already cancelled',
    public orderId?: string
  ) {
    super(message, 'ORDER_ALREADY_CANCELLED', { orderId });
    this.name = 'OrderAlreadyCancelledError';
    Object.setPrototypeOf(this, OrderAlreadyCancelledError.prototype);
  }
}
