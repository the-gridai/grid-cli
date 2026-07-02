/**
 * Rate limiter for API requests
 * 
 * Prevents API throttling by limiting concurrent requests
 * and enforcing minimum intervals between requests
 */

import { logger } from '../../core/logging/logger';

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  maxConcurrent: number;
  minInterval: number;
}

/**
 * Rate limiter class
 * 
 * Manages request concurrency and timing to prevent API rate limits
 */
export class RateLimiter {
  private queue: Array<() => void> = [];
  private activeRequests = 0;
  private lastRequestTime = 0;
  private maxConcurrent: number;
  private minInterval: number;

  /**
   * Create a new rate limiter
   * 
   * @param maxConcurrent - Maximum number of concurrent requests (default: 10)
   * @param minInterval - Minimum interval between requests in ms (default: 100)
   */
  constructor(
    maxConcurrent: number = 10,
    minInterval: number = 100
  ) {
    this.maxConcurrent = maxConcurrent;
    this.minInterval = minInterval;
    
    logger.debug('Rate limiter initialized', {
      maxConcurrent,
      minInterval
    });
  }

  /**
   * Execute a function with rate limiting
   * 
   * @param fn - Async function to execute
   * @returns Promise resolving to function result
   * 
   * @example
   * ```typescript
   * const limiter = new RateLimiter(5, 200);
   * const result = await limiter.execute(() => apiCall());
   * ```
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.waitForSlot();
    this.activeRequests++;

    try {
      const result = await fn();
      return result;
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }

  /**
   * Wait for an available slot to execute request
   */
  private async waitForSlot(): Promise<void> {
    // Wait for concurrent limit
    if (this.activeRequests >= this.maxConcurrent) {
      logger.debug('Rate limit: waiting for available slot', {
        active: this.activeRequests,
        max: this.maxConcurrent,
        queued: this.queue.length
      });
      
      await new Promise<void>(resolve => this.queue.push(resolve));
    }

    // Wait for minimum interval between requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      
      logger.debug('Rate limit: waiting for minimum interval', {
        waitTime,
        minInterval: this.minInterval
      });
      
      await this.sleep(waitTime);
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Process queued requests
   */
  private processQueue(): void {
    if (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
      const resolve = this.queue.shift();
      if (resolve) {
        resolve();
      }
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current status of rate limiter
   */
  public getStatus() {
    return {
      activeRequests: this.activeRequests,
      queuedRequests: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      minInterval: this.minInterval,
      lastRequestTime: this.lastRequestTime
    };
  }

  /**
   * Update rate limiter configuration
   */
  public updateConfig(config: Partial<RateLimiterConfig>): void {
    if (config.maxConcurrent !== undefined) {
      this.maxConcurrent = config.maxConcurrent;
    }
    if (config.minInterval !== undefined) {
      this.minInterval = config.minInterval;
    }
    
    logger.debug('Rate limiter config updated', {
      maxConcurrent: this.maxConcurrent,
      minInterval: this.minInterval
    });
  }

  /**
   * Clear the queue (useful for shutdown)
   */
  public clear(): void {
    const pending = this.queue;
    this.queue = [];
    for (const resolve of pending) {
      resolve();
    }
    logger.debug('Rate limiter queue cleared');
  }
}
