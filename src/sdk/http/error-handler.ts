/**
 * Error transformation utilities
 * 
 * Converts Axios errors into structured GridError types
 * for better error handling and debugging
 */

import { AxiosError } from 'axios';
import {
  ApiError,
  AuthenticationError,
  NetworkError,
  RateLimitError,
  InsufficientBalanceError,
  ValidationError,
  OrderNotFoundError,
  MarketNotFoundError,
  OrderAlreadyCancelledError
} from '../../core/errors';
import { logger } from '../../core/logging/logger';

function toObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (value === undefined) return {};
  return { value };
}

/**
 * Transform Axios errors into structured Grid errors
 * 
 * @param error - The Axios error to transform
 * @returns A structured GridError with appropriate type and context
 */
export function transformAxiosError(error: AxiosError): Error {
  // Network errors (no response received)
  if (!error.response) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new NetworkError('Request timeout', error);
    }
    if (error.code === 'ECONNREFUSED') {
      return new NetworkError('Connection refused - API may be down', error);
    }
    if (error.code === 'ENOTFOUND') {
      return new NetworkError('DNS lookup failed - check API URL', error);
    }
    return new NetworkError(error.message || 'Network error occurred', error);
  }

  const { status, data } = error.response;
  const errorData = data as any;
  const errorMessage = errorData?.error?.message || errorData?.message || 'API request failed';
  const errorCode = errorData?.error?.code || errorData?.code;
  const errorDetails = errorData?.error?.details || errorData?.details;
  const requestId = (error.config as any)?.__requestId;
  const requestContext = {
    requestId,
    url: error.config?.url,
    method: error.config?.method,
  };

  // Log the error for debugging
  logger.warn('API Error Response', {
    status,
    code: errorCode,
    message: errorMessage,
    details: errorDetails,
    ...requestContext,
  });

  // Authentication errors (401, 403)
  if (status === 401 || status === 403) {
    const message = errorMessage !== 'API request failed' ? errorMessage : 'Authentication failed';
    return new AuthenticationError(message);
  }

  // Rate limiting (429)
  if (status === 429) {
    const retryAfter = parseInt(error.response.headers['retry-after'] || error.response.headers['x-ratelimit-reset'] || '60');
    return new RateLimitError(errorMessage, retryAfter);
  }

  // Not found errors (404)
  if (status === 404) {
    // Check if it's an order not found
    if (error.config?.url?.includes('/orders/')) {
      const orderId = error.config.url.split('/orders/')[1]?.split('?')[0];
      return new OrderNotFoundError(errorMessage, orderId);
    }
    // Check if it's a market not found
    if (error.config?.url?.includes('/markets/')) {
      const marketId = error.config.url.split('/markets/')[1]?.split('?')[0];
      return new MarketNotFoundError(errorMessage, marketId);
    }
    return new ApiError(errorMessage, status, 'NOT_FOUND', {
      ...toObject(errorDetails),
      ...requestContext,
      responseBody: errorData,
    });
  }

  // Validation errors (400)
  if (status === 400) {
    // Check for specific error codes
    if (errorCode === 'INSUFFICIENT_BALANCE' || errorCode === 'INSUFFICIENT_FUNDS') {
      return new InsufficientBalanceError(errorMessage);
    }
    if (errorCode === 'VALIDATION_ERROR' || errorCode === 'INVALID_REQUEST') {
      return new ValidationError(errorMessage, {
        ...toObject(errorDetails),
        ...requestContext,
        responseBody: errorData,
      });
    }
    return new ValidationError(errorMessage, {
      ...toObject(errorDetails),
      ...requestContext,
      responseBody: errorData,
    });
  }

  // The exchange returns 500 for order_already_cancelled (should be 409, tracked for server-side fix)
  if (status === 500) {
    const detail = errorData?.errors?.detail;
    if (detail === 'order_already_cancelled') {
      const orderId = error.config?.url?.split('/orders/')[1]?.split('?')[0];
      return new OrderAlreadyCancelledError('Order already cancelled', orderId);
    }
  }

  // Generic API errors (4xx, 5xx)
  return new ApiError(
    errorMessage,
    status,
    errorCode,
    {
      ...toObject(errorDetails),
      ...requestContext,
      responseBody: errorData,
    }
  );
}

/**
 * Check if an error is retryable
 * 
 * @param error - The error to check
 * @returns true if the error should be retried
 */
export function isRetryableError(error: any): boolean {
  // Don't retry authentication errors
  if (error instanceof AuthenticationError) {
    return false;
  }

  // Don't retry validation errors
  if (error instanceof ValidationError) {
    return false;
  }

  // Don't retry insufficient balance errors
  if (error instanceof InsufficientBalanceError) {
    return false;
  }

  // Don't retry not found errors
  if (error instanceof OrderNotFoundError || error instanceof MarketNotFoundError) {
    return false;
  }

  // Don't retry already-cancelled errors (the exchange returns 500 but it's not transient)
  if (error instanceof OrderAlreadyCancelledError) {
    return false;
  }

  // Retry rate limit errors
  if (error instanceof RateLimitError) {
    return true;
  }

  // Retry network errors
  if (error instanceof NetworkError) {
    return true;
  }

  // Retry API errors with retryable status codes.
  // 500 is NOT retried by default — it usually indicates an application bug,
  // not a transient failure. Retrying it wastes seconds on every error.
  if (error instanceof ApiError) {
    const retryableStatuses = [408, 429, 502, 503, 504];
    return retryableStatuses.includes(error.statusCode);
  }

  if (error.response) {
    const retryableStatuses = [408, 429, 502, 503, 504];
    return retryableStatuses.includes(error.response.status);
  }

  // Retry network-level errors
  if (error.code) {
    const retryableErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED', 'ECONNABORTED'];
    return retryableErrors.includes(error.code);
  }

  return false;
}
