/**
 * Error transformation utilities
 *
 * Converts Axios errors into structured GridError types
 * for better error handling and debugging
 */

import type { AxiosError } from 'axios';
import {
  ApiError,
  AuthenticationError,
  InsufficientBalanceError,
  MarketNotFoundError,
  NetworkError,
  OrderNotFoundError,
  RateLimitError,
  ValidationError,
} from '../errors.js';
import type { Logger } from '../types/index.js';

/**
 * Transform Axios errors into structured Grid errors
 *
 * @param error - The Axios error to transform
 * @param logger - Optional logger for debugging
 * @returns A structured GridError with appropriate type and context
 */
export function transformAxiosError(error: AxiosError, logger?: Logger): Error {
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
  const errorData = data as Record<string, unknown> | undefined;
  const nestedError = errorData?.error as Record<string, unknown> | undefined;

  const errorMessage =
    (nestedError?.message as string) ||
    (errorData?.message as string) ||
    'API request failed';
  const errorCode = (nestedError?.code as string) || (errorData?.code as string);
  const errorDetails = nestedError?.details || errorData?.details;

  // Log the error for debugging
  logger?.warn('API Error Response', {
    status,
    code: errorCode,
    message: errorMessage,
    details: errorDetails,
    url: error.config?.url,
    method: error.config?.method,
  });

  // Authentication errors (401, 403)
  if (status === 401 || status === 403) {
    const message = errorMessage !== 'API request failed' ? errorMessage : 'Authentication failed';
    return new AuthenticationError(message);
  }

  // Rate limiting (429)
  if (status === 429) {
    const retryAfterHeader =
      error.response.headers['retry-after'] || error.response.headers['x-ratelimit-reset'];
    const retryAfter = retryAfterHeader ? parseInt(String(retryAfterHeader), 10) : 60;
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
    return new ApiError(errorMessage, status, 'NOT_FOUND', errorDetails);
  }

  // Validation errors (400)
  if (status === 400) {
    // Check for specific error codes
    if (errorCode === 'INSUFFICIENT_BALANCE' || errorCode === 'INSUFFICIENT_FUNDS') {
      return new InsufficientBalanceError(errorMessage);
    }
    if (errorCode === 'VALIDATION_ERROR' || errorCode === 'INVALID_REQUEST') {
      return new ValidationError(errorMessage, errorDetails);
    }
    return new ValidationError(errorMessage, errorDetails);
  }

  // Generic API errors (4xx, 5xx)
  return new ApiError(errorMessage, status, errorCode, errorDetails);
}
