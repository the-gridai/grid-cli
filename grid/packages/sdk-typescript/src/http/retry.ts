/**
 * Retry logic with exponential backoff
 *
 * Provides automatic retry functionality for transient failures
 */

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
 * Retry configuration options
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryableStatuses: number[];
  retryableErrors: string[];
  enabled: boolean;
  logger?: Logger;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED', 'ECONNABORTED'],
  enabled: true,
};

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
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

  // Retry rate limit errors
  if (error instanceof RateLimitError) {
    return true;
  }

  // Retry network errors
  if (error instanceof NetworkError) {
    return true;
  }

  // Retry API errors with retryable status codes
  if (error instanceof ApiError) {
    const retryableStatuses = [408, 429, 500, 502, 503, 504];
    return retryableStatuses.includes(error.statusCode);
  }

  // Retry errors with retryable codes
  if (error && typeof error === 'object' && 'code' in error) {
    const retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ECONNABORTED',
    ];
    return retryableErrors.includes((error as { code: string }).code);
  }

  return false;
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoff(attempt: number, config: RetryConfig): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = config.baseDelay * Math.pow(2, attempt);

  // Add random jitter (0-1000ms) to prevent thundering herd
  const jitter = Math.random() * 1000;

  // Cap at maxDelay
  return Math.min(exponentialDelay + jitter, config.maxDelay);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic
 *
 * @param fn - The async function to execute
 * @param config - Retry configuration options
 * @returns Promise resolving to the function result
 * @throws The last error if all retries are exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };

  // If retries are disabled, just execute once
  if (!retryConfig.enabled) {
    return fn();
  }

  let lastError: Error;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // If this was the last attempt, throw the error
      if (attempt === retryConfig.maxRetries) {
        retryConfig.logger?.error('All retry attempts exhausted', {
          attempts: attempt + 1,
          error: lastError.message,
        });
        break;
      }

      // Check if error is retryable
      if (!isRetryableError(error)) {
        retryConfig.logger?.debug('Error is not retryable, throwing immediately', {
          error: lastError.message,
        });
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = calculateBackoff(attempt, retryConfig);

      retryConfig.logger?.warn(
        `Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${retryConfig.maxRetries})`,
        {
          error: lastError.message,
          errorType: lastError.name,
          attempt: attempt + 1,
          maxRetries: retryConfig.maxRetries,
          delay,
        }
      );

      await sleep(delay);
    }
  }

  // Throw the last error
  throw lastError!;
}

/**
 * Retry with specific delay (for rate limiting)
 */
export async function retryWithDelay<T>(
  fn: () => Promise<T>,
  delayMs: number,
  maxAttempts: number = 3,
  logger?: Logger
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts - 1) {
        break;
      }

      logger?.info(`Retrying after ${delayMs}ms (attempt ${attempt + 1}/${maxAttempts})`);
      await sleep(delayMs);
    }
  }

  throw lastError!;
}
