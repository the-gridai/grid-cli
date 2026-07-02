/**
 * Unit tests for retry logic
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { withRetry, sleep } from '../../../../src/sdk/http/retry';
import { NetworkError, RateLimitError, ValidationError } from '../../../../src/core/errors';

describe('withRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return result on successful first attempt', async () => {
    const fn = jest.fn<() => Promise<string>>().mockResolvedValue('success');
    
    const result = await withRetry(fn);
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on network errors', async () => {
    const fn = jest.fn<() => Promise<string>>()
      .mockRejectedValueOnce(new NetworkError('Connection failed'))
      .mockResolvedValueOnce('success');
    
    const result = await withRetry(fn);
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should retry on rate limit errors', async () => {
    const fn = jest.fn<() => Promise<string>>()
      .mockRejectedValueOnce(new RateLimitError('Too many requests', 1))
      .mockResolvedValueOnce('success');
    
    const result = await withRetry(fn);
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should not retry on validation errors', async () => {
    const fn = jest.fn<() => Promise<string>>()
      .mockRejectedValue(new ValidationError('Invalid input'));
    
    await expect(withRetry(fn)).rejects.toThrow(ValidationError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should respect max retries', async () => {
    const fn = jest.fn<() => Promise<string>>()
      .mockRejectedValue(new NetworkError('Connection failed'));
    
    await expect(withRetry(fn, { maxRetries: 2 })).rejects.toThrow(NetworkError);
    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('should throw last error after exhausting retries', async () => {
    const error = new NetworkError('Final error');
    const fn = jest.fn<() => Promise<string>>().mockRejectedValue(error);
    
    await expect(withRetry(fn, { maxRetries: 1 })).rejects.toThrow('Final error');
  });

  it('should use exponential backoff', async () => {
    const fn = jest.fn<() => Promise<string>>()
      .mockRejectedValueOnce(new NetworkError('Error 1'))
      .mockRejectedValueOnce(new NetworkError('Error 2'))
      .mockResolvedValueOnce('success');
    
    const start = Date.now();
    await withRetry(fn, { baseDelay: 100, maxDelay: 1000 });
    const duration = Date.now() - start;
    
    // Should have some delay (at least base delay)
    expect(duration).toBeGreaterThanOrEqual(100);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('sleep', () => {
  it('should sleep for specified duration', async () => {
    const start = Date.now();
    await sleep(100);
    const duration = Date.now() - start;
    
    expect(duration).toBeGreaterThanOrEqual(95); // Allow 5ms variance
    expect(duration).toBeLessThan(200);
  });
});

