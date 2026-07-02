/**
 * Retry logic with exponential backoff
 * 
 * Provides automatic retry functionality for transient failures
 */

import { logger } from '../../core/logging/logger';
import { isRetryableError } from './error-handler';

/**
 * Global retry toggle - can be disabled for benchmarks
 */
let retriesEnabled = true;

/**
 * Disable retries globally (for benchmarks)
 */
export function setRetriesEnabled(enabled: boolean): void {
  retriesEnabled = enabled;
}

/**
 * Check if retries are enabled
 */
export function areRetriesEnabled(): boolean {
  return retriesEnabled;
}

/**
 * Retry configuration options
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryableStatuses: number[];
  retryableErrors: string[];
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  baseDelay: 200,
  maxDelay: 2000,
  retryableStatuses: [408, 429, 502, 503, 504],
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED', 'ECONNABORTED']
};

/**
 * Execute a function with retry logic
 * 
 * @param fn - The async function to execute
 * @param config - Retry configuration options
 * @returns Promise resolving to the function result
 * @throws The last error if all retries are exhausted
 * 
 * @example
 * ```typescript
 * const result = await withRetry(
 *   async () => apiClient.getMarkets(),
 *   { maxRetries: 5 }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  // If retries are globally disabled, just execute once
  if (!retriesEnabled) {
    return fn();
  }
  
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable before considering retry attempts
      if (!isRetryableError(error)) {
        logger.debug('Error is not retryable, throwing immediately', {
          errorName: (error as any)?.name,
          message: (error as any)?.message,
          statusCode: (error as any)?.statusCode,
          code: (error as any)?.code,
          details: (error as any)?.details,
        });
        throw error;
      }
      
      // If this was the last attempt, throw the error
      if (attempt === retryConfig.maxRetries) {
        logger.error('All retry attempts exhausted', {
          attempts: attempt + 1,
          errorName: (lastError as any)?.name,
          message: (lastError as any)?.message,
          statusCode: (lastError as any)?.statusCode,
          code: (lastError as any)?.code,
          details: (lastError as any)?.details,
        });
        break;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = calculateBackoff(attempt, retryConfig);
      
      logger.warn(
        `Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${retryConfig.maxRetries})`,
        { 
          error: lastError.message,
          errorType: lastError.name,
          statusCode: (lastError as any)?.statusCode,
          code: (lastError as any)?.code,
          details: (lastError as any)?.details,
          attempt: attempt + 1,
          maxRetries: retryConfig.maxRetries,
          delay
        }
      );
      
      await sleep(delay);
    }
  }

  // Throw the last error
  throw lastError!;
}

/**
 * Calculate exponential backoff delay with jitter
 * 
 * @param attempt - Current retry attempt (0-indexed)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
function calculateBackoff(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelay * Math.pow(2, attempt);
  // Jitter proportional to delay (25%), not a fixed 1s addition
  const jitter = Math.random() * exponentialDelay * 0.25;
  return Math.min(exponentialDelay + jitter, config.maxDelay);
}

/**
 * Sleep for specified milliseconds
 * 
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry with specific delay (for rate limiting)
 * 
 * @param fn - Function to retry
 * @param delayMs - Specific delay in milliseconds
 * @param maxAttempts - Maximum number of attempts
 * @returns Promise resolving to function result
 */
export async function retryWithDelay<T>(
  fn: () => Promise<T>,
  delayMs: number,
  maxAttempts: number = 3
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (!isRetryableError(error)) {
        throw error;
      }
      
      if (attempt === maxAttempts - 1) {
        break;
      }

      logger.info(`Retrying after ${delayMs}ms (attempt ${attempt + 1}/${maxAttempts})`);
      await sleep(delayMs);
    }
  }

  throw lastError!;
}
