/**
 * Unit tests for error handler
 */

import { describe, it, expect, jest } from '@jest/globals';
import { AxiosError } from 'axios';
import { transformAxiosError, isRetryableError } from '../../../../src/sdk/http/error-handler';
import {
  ApiError,
  AuthenticationError,
  NetworkError,
  RateLimitError,
  InsufficientBalanceError,
  ValidationError,
  OrderNotFoundError,
  MarketNotFoundError
} from '../../../../src/core/errors';

describe('transformAxiosError', () => {
  describe('Network errors (no response)', () => {
    it('should transform ECONNABORTED to NetworkError', () => {
      const axiosError = {
        code: 'ECONNABORTED',
        message: 'Connection aborted',
        response: undefined
      } as unknown as AxiosError;

      const result = transformAxiosError(axiosError);

      expect(result).toBeInstanceOf(NetworkError);
      expect(result.message).toBe('Request timeout');
    });

    it('should transform ETIMEDOUT to NetworkError', () => {
      const axiosError = {
        code: 'ETIMEDOUT',
        message: 'Connection timed out',
        response: undefined
      } as unknown as AxiosError;

      const result = transformAxiosError(axiosError);

      expect(result).toBeInstanceOf(NetworkError);
      expect(result.message).toBe('Request timeout');
    });

    it('should transform ECONNREFUSED to NetworkError', () => {
      const axiosError = {
        code: 'ECONNREFUSED',
        message: 'Connection refused',
        response: undefined
      } as unknown as AxiosError;

      const result = transformAxiosError(axiosError);

      expect(result).toBeInstanceOf(NetworkError);
      expect(result.message).toBe('Connection refused - API may be down');
    });

    it('should transform ENOTFOUND to NetworkError', () => {
      const axiosError = {
        code: 'ENOTFOUND',
        message: 'DNS lookup failed',
        response: undefined
      } as unknown as AxiosError;

      const result = transformAxiosError(axiosError);

      expect(result).toBeInstanceOf(NetworkError);
      expect(result.message).toBe('DNS lookup failed - check API URL');
    });

    it('should transform generic network error', () => {
      const axiosError = {
        message: 'Network error',
        response: undefined
      } as unknown as AxiosError;

      const result = transformAxiosError(axiosError);

      expect(result).toBeInstanceOf(NetworkError);
      expect(result.message).toBe('Network error');
    });
  });

  describe('Authentication errors (401, 403)', () => {
    it('should transform 401 to AuthenticationError', () => {
      const axiosError = {
        response: {
          status: 401,
          data: {
            error: {
              message: 'Invalid credentials',
              code: 'AUTH_FAILED'
            }
          }
        }
      } as unknown as AxiosError;

      const result = transformAxiosError(axiosError);

      expect(result).toBeInstanceOf(AuthenticationError);
      expect(result.message).toBe('Invalid credentials');
    });

    it('should transform 403 to AuthenticationError', () => {
      const axiosError = {
        response: {
          status: 403,
          data: {
            error: {
              message: 'Forbidden'
            }
          }
        }
      } as unknown as AxiosError;

      const result = transformAxiosError(axiosError);

      expect(result).toBeInstanceOf(AuthenticationError);
      expect(result.message).toBe('Forbidden');
    });

    it('should use default message if none provided', () => {
      const axiosError = {
        response: {
          status: 401,
          data: {}
        }
      } as unknown as AxiosError;

      const result = transformAxiosError(axiosError);

      expect(result).toBeInstanceOf(AuthenticationError);
      expect(result.message).toBe('Authentication failed');
    });

    it('should map auto_mode_trading_restricted to ApiError with clear message', () => {
      const axiosError = {
        response: {
          status: 403,
          data: {
            errors: {
              detail: 'auto_mode_trading_restricted',
              message: 'Trading is not available in Auto mode. Switch to Advanced mode to place, update, or cancel orders.',
            },
          },
        },
      } as unknown as AxiosError;

      const result = transformAxiosError(axiosError);

      expect(result).toBeInstanceOf(ApiError);
      expect(result).not.toBeInstanceOf(AuthenticationError);
      expect(result.message).toBe(
        'Trading is not available in Auto mode. Switch to Advanced mode to place, update, or cancel orders.',
      );
      expect((result as ApiError).code).toBe('auto_mode_trading_restricted');
      expect((result as ApiError).statusCode).toBe(403);
    });
  });

  describe('Rate limiting (429)', () => {
    it('should transform 429 to RateLimitError', () => {
      const axiosError = {
        response: {
          status: 429,
          data: {
            error: {
              message: 'Too many requests'
            }
          },
          headers: {
            'retry-after': '60'
          }
        }
      } as unknown as AxiosError;

      const result = transformAxiosError(axiosError);

      expect(result).toBeInstanceOf(RateLimitError);
      expect(result.message).toBe('Too many requests');
      expect((result as RateLimitError).retryAfter).toBe(60);
    });

    it('should use x-ratelimit-reset header if retry-after missing', () => {
      const axiosError = {
        response: {
          status: 429,
          data: {},
          headers: {
            'x-ratelimit-reset': '120'
          }
        }
      } as unknown as AxiosError;

      const result = transformAxiosError(axiosError);

      expect(result).toBeInstanceOf(RateLimitError);
      expect((result as RateLimitError).retryAfter).toBe(120);
    });

    it('should use default retry-after if no header', () => {
      const axiosError = {
        response: {
          status: 429,
          data: {},
          headers: {}
        }
      } as unknown as AxiosError;

      const result = transformAxiosError(axiosError);

      expect(result).toBeInstanceOf(RateLimitError);
      expect((result as RateLimitError).retryAfter).toBe(60);
    });
  });

  describe('Not found errors (404)', () => {
    it('should transform 404 for order to OrderNotFoundError', () => {
      const axiosError = {
        config: {
          url: '/orders/order_123'
        },
        response: {
          status: 404,
          data: {
            error: {
              message: 'Order not found'
            }
          }
        }
      } as unknown as AxiosError;

      const result = transformAxiosError(axiosError);

      expect(result).toBeInstanceOf(OrderNotFoundError);
      expect(result.message).toBe('Order not found');
      expect((result as OrderNotFoundError).orderId).toBe('order_123');
    });

    it('should transform 404 for market to MarketNotFoundError', () => {
      const axiosError = {
        config: {
          url: '/markets/market_456'
        },
        response: {
          status: 404,
          data: {
            error: {
              message: 'Market not found'
            }
          }
        }
      } as unknown as AxiosError;

      const result = transformAxiosError(axiosError);

      expect(result).toBeInstanceOf(MarketNotFoundError);
      expect(result.message).toBe('Market not found');
      expect((result as MarketNotFoundError).marketId).toBe('market_456');
    });

    it('should transform generic 404 to ApiError', () => {
      const axiosError = {
        config: {
          url: '/some/other/endpoint'
        },
        response: {
          status: 404,
          data: {
            error: {
              message: 'Not found'
            }
          }
        }
      } as unknown as AxiosError;

      const result = transformAxiosError(axiosError);

      expect(result).toBeInstanceOf(ApiError);
      expect(result.message).toBe('Not found');
      expect((result as ApiError).statusCode).toBe(404);
    });
  });

  describe('Validation errors (400)', () => {
    it('should transform insufficient balance to InsufficientBalanceError', () => {
      const axiosError = {
        response: {
          status: 400,
          data: {
            error: {
              code: 'INSUFFICIENT_BALANCE',
              message: 'Not enough funds'
            }
          }
        }
      } as unknown as AxiosError;

      const result = transformAxiosError(axiosError);

      expect(result).toBeInstanceOf(InsufficientBalanceError);
      expect(result.message).toBe('Not enough funds');
    });

    it('should transform insufficient funds to InsufficientBalanceError', () => {
      const axiosError = {
        response: {
          status: 400,
          data: {
            error: {
              code: 'INSUFFICIENT_FUNDS',
              message: 'Insufficient funds'
            }
          }
        }
      } as unknown as AxiosError;

      const result = transformAxiosError(axiosError);

      expect(result).toBeInstanceOf(InsufficientBalanceError);
    });

    it('should transform validation error with code', () => {
      const axiosError = {
        response: {
          status: 400,
          data: {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: { field: 'quantity', issue: 'must be positive' }
            }
          }
        }
      } as unknown as AxiosError;

      const result = transformAxiosError(axiosError);

      expect(result).toBeInstanceOf(ValidationError);
      expect(result.message).toBe('Invalid input');
      expect((result as ValidationError).validationErrors).toEqual(
        expect.objectContaining({
          field: 'quantity',
          issue: 'must be positive',
          responseBody: {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: { field: 'quantity', issue: 'must be positive' }
            }
          }
        })
      );
    });

    it('should transform generic 400 to ValidationError', () => {
      const axiosError = {
        response: {
          status: 400,
          data: {
            error: {
              message: 'Bad request'
            }
          }
        }
      } as unknown as AxiosError;

      const result = transformAxiosError(axiosError);

      expect(result).toBeInstanceOf(ValidationError);
      expect(result.message).toBe('Bad request');
    });
  });

  describe('Server errors (5xx)', () => {
    it('should transform 500 to ApiError', () => {
      const axiosError = {
        response: {
          status: 500,
          data: {
            error: {
              message: 'Internal server error',
              code: 'INTERNAL_ERROR'
            }
          }
        }
      } as unknown as AxiosError;

      const result = transformAxiosError(axiosError);

      expect(result).toBeInstanceOf(ApiError);
      expect(result.message).toBe('Internal server error');
      expect((result as ApiError).statusCode).toBe(500);
      expect((result as ApiError).code).toBe('INTERNAL_ERROR');
    });

    it('should preserve error details', () => {
      const axiosError = {
        response: {
          status: 503,
          data: {
            error: {
              message: 'Service unavailable',
              details: { reason: 'maintenance' }
            }
          }
        }
      } as unknown as AxiosError;

      const result = transformAxiosError(axiosError);

      expect(result).toBeInstanceOf(ApiError);
      expect((result as ApiError).details).toEqual(
        expect.objectContaining({
          reason: 'maintenance',
          responseBody: {
            error: {
              message: 'Service unavailable',
              details: { reason: 'maintenance' }
            }
          }
        })
      );
    });

    it('should use default message if none provided', () => {
      const axiosError = {
        response: {
          status: 502,
          data: {}
        }
      } as unknown as AxiosError;

      const result = transformAxiosError(axiosError);

      expect(result).toBeInstanceOf(ApiError);
      expect(result.message).toBe('API request failed');
    });
  });
});

describe('isRetryableError', () => {
  it('should return false for AuthenticationError', () => {
    const error = new AuthenticationError();
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return false for ValidationError', () => {
    const error = new ValidationError('Invalid input');
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return false for InsufficientBalanceError', () => {
    const error = new InsufficientBalanceError();
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return false for OrderNotFoundError', () => {
    const error = new OrderNotFoundError();
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return false for MarketNotFoundError', () => {
    const error = new MarketNotFoundError();
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return true for RateLimitError', () => {
    const error = new RateLimitError();
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return true for NetworkError', () => {
    const error = new NetworkError('Connection failed');
    expect(isRetryableError(error)).toBe(true);
  });

  it('should not retry 500 (application bug, not transient)', () => {
    const error = new ApiError('Server error', 500);
    expect(isRetryableError(error)).toBe(false);
  });

  it('should retry 502 (gateway error, transient)', () => {
    const error = new ApiError('Bad gateway', 502);
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return true for 429 ApiError', () => {
    const error = new ApiError('Rate limited', 429);
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return true for 408 ApiError', () => {
    const error = new ApiError('Timeout', 408);
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return false for 4xx ApiError (except 408, 429)', () => {
    const error = new ApiError('Bad request', 400);
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return true for Axios error with retryable status', () => {
    const error = {
      response: { status: 503 }
    };
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return false for Axios error with non-retryable status', () => {
    const error = {
      response: { status: 400 }
    };
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return true for network error codes', () => {
    expect(isRetryableError({ code: 'ECONNRESET' })).toBe(true);
    expect(isRetryableError({ code: 'ETIMEDOUT' })).toBe(true);
    expect(isRetryableError({ code: 'ENOTFOUND' })).toBe(true);
    expect(isRetryableError({ code: 'ECONNREFUSED' })).toBe(true);
    expect(isRetryableError({ code: 'ECONNABORTED' })).toBe(true);
  });

  it('should return false for unknown error types', () => {
    const error = new Error('Generic error');
    expect(isRetryableError(error)).toBe(false);
  });
});

