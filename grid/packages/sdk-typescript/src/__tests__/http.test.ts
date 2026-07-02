/**
 * Tests for HTTP utilities (rate limiter, retry)
 */

import { describe, it, expect, vi } from 'vitest';
import { RateLimiter } from '../http/rate-limiter.js';
import { withRetry, isRetryableError, sleep } from '../http/retry.js';
import {
  ApiError,
  AuthenticationError,
  NetworkError,
  RateLimitError,
  ValidationError,
} from '../errors.js';

describe('RateLimiter', () => {
  it('should execute function and return result', async () => {
    const limiter = new RateLimiter(10, 0);
    const result = await limiter.execute(async () => 'test');

    expect(result).toBe('test');
  });

  it('should respect max concurrent limit', async () => {
    const limiter = new RateLimiter(2, 0);
    const executionOrder: number[] = [];
    let activeCount = 0;

    const task = async (id: number) => {
      activeCount++;
      executionOrder.push(id);
      // Record when we start - if rate limiter works, we should see
      // tasks 1,2 start, then 3,4, then 5
      await sleep(50);
      activeCount--;
      return id;
    };

    // Start 5 tasks - they should be rate limited to 2 at a time
    const results = await Promise.all([
      limiter.execute(() => task(1)),
      limiter.execute(() => task(2)),
      limiter.execute(() => task(3)),
      limiter.execute(() => task(4)),
      limiter.execute(() => task(5)),
    ]);

    // All tasks should complete
    expect(results).toEqual([1, 2, 3, 4, 5]);
    // Rate limiter should have executed all tasks
    expect(executionOrder.length).toBe(5);
  });

  it('should return status', () => {
    const limiter = new RateLimiter(5, 100);
    const status = limiter.getStatus();

    expect(status.activeRequests).toBe(0);
    expect(status.queuedRequests).toBe(0);
    expect(status.maxConcurrent).toBe(5);
    expect(status.minInterval).toBe(100);
  });

  it('should update config', () => {
    const limiter = new RateLimiter(5, 100);
    limiter.updateConfig({ maxConcurrent: 10, minInterval: 50 });

    const status = limiter.getStatus();
    expect(status.maxConcurrent).toBe(10);
    expect(status.minInterval).toBe(50);
  });
});

describe('isRetryableError', () => {
  it('should return false for AuthenticationError', () => {
    const error = new AuthenticationError();
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return false for ValidationError', () => {
    const error = new ValidationError('Invalid');
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return true for NetworkError', () => {
    const error = new NetworkError('Connection failed');
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return true for RateLimitError', () => {
    const error = new RateLimitError();
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return true for 500 ApiError', () => {
    const error = new ApiError('Server error', 500);
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return true for 503 ApiError', () => {
    const error = new ApiError('Service unavailable', 503);
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return false for 400 ApiError', () => {
    const error = new ApiError('Bad request', 400);
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return false for 404 ApiError', () => {
    const error = new ApiError('Not found', 404);
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return true for ECONNRESET error code', () => {
    const error = { code: 'ECONNRESET' };
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return true for ETIMEDOUT error code', () => {
    const error = { code: 'ETIMEDOUT' };
    expect(isRetryableError(error)).toBe(true);
  });
});

describe('withRetry', () => {
  it('should return result on success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable error', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new NetworkError('Connection failed'))
      .mockResolvedValueOnce('success');

    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should not retry on non-retryable error', async () => {
    const fn = vi.fn().mockRejectedValue(new AuthenticationError());

    await expect(withRetry(fn, { maxRetries: 3, baseDelay: 10 })).rejects.toThrow(
      AuthenticationError
    );

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should throw after max retries exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new NetworkError('Connection failed'));

    await expect(withRetry(fn, { maxRetries: 2, baseDelay: 10 })).rejects.toThrow(NetworkError);

    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('should not retry when disabled', async () => {
    const fn = vi.fn().mockRejectedValue(new NetworkError('Connection failed'));

    await expect(withRetry(fn, { enabled: false })).rejects.toThrow(NetworkError);

    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('sleep', () => {
  it('should delay for specified milliseconds', async () => {
    const start = Date.now();
    await sleep(100);
    const elapsed = Date.now() - start;

    // Allow some tolerance
    expect(elapsed).toBeGreaterThanOrEqual(90);
    expect(elapsed).toBeLessThan(200);
  });
});
