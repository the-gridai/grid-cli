# Test Examples

Practical examples for writing tests in GRID CLI.

## Table of Contents

- [Unit Testing Validators](#unit-testing-validators)
- [Testing Error Handling](#testing-error-handling)
- [Integration Testing with Mock Server](#integration-testing-with-mock-server)
- [Testing Async Behavior](#testing-async-behavior)
- [Testing WebSocket Features](#testing-websocket-features)
- [Testing Retry Logic](#testing-retry-logic)

---

## Unit Testing Validators

### Input Validator Test

```typescript
import { describe, it, expect } from '@jest/globals';
import { ZodError } from 'zod';
import { validatePlaceOrderRequest } from '../src/sdk/validators/inputs';

describe('Order validation', () => {
  it('should validate correct order', () => {
    const validOrder = {
      market_id: 'market_123',
      side: 'buy' as const,
      type: 'limit' as const,
      quantity: '10',
      price: '100.50'
    };

    const result = validatePlaceOrderRequest(validOrder);
    expect(result).toEqual(validOrder);
  });

  it('should reject negative quantity', () => {
    const invalidOrder = {
      market_id: 'market_123',
      side: 'buy' as const,
      type: 'limit' as const,
      quantity: '-10',
      price: '100.50'
    };

    expect(() => validatePlaceOrderRequest(invalidOrder)).toThrow(ZodError);
  });
});
```

### Response Validator Test

```typescript
import { validateResponse, OrderSchema } from '../src/sdk/validators/responses';
import { ValidationError } from '../src/core/errors';

describe('Response validation', () => {
  it('should validate correct response', () => {
    const validOrder = {
      order_id: 'order_123',
      market_id: 'market_456',
      side: 'buy',
      type: 'limit',
      quantity: '10',
      price: '100',
      filled_quantity: '0',
      status: 'open',
      time_in_force: 'gtc',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z'
    };

    const result = validateResponse(validOrder, OrderSchema);
    expect(result).toEqual(validOrder);
  });

  it('should throw ValidationError on invalid response', () => {
    const invalidOrder = { order_id: '123' }; // Missing required fields

    expect(() => validateResponse(invalidOrder, OrderSchema)).toThrow(ValidationError);
  });
});
```

---

## Testing Error Handling

### Testing Custom Errors

```typescript
import {
  ApiError,
  NetworkError,
  RateLimitError,
  InsufficientBalanceError
} from '../src/core/errors';

describe('Custom errors', () => {
  it('should create ApiError with status code', () => {
    const error = new ApiError('API failed', 500, 'SERVER_ERROR');
    
    expect(error.message).toBe('API failed');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('SERVER_ERROR');
    expect(error instanceof Error).toBe(true);
  });

  it('should create RateLimitError with retry-after', () => {
    const error = new RateLimitError('Too many requests', 60);
    
    expect(error.retryAfter).toBe(60);
    expect(error.code).toBe('RATE_LIMIT');
  });
});
```

### Testing Error Transformation

```typescript
import { AxiosError } from 'axios';
import { transformAxiosError } from '../src/sdk/http/error-handler';
import { AuthenticationError } from '../src/core/errors';

describe('Error transformation', () => {
  it('should transform 401 to AuthenticationError', () => {
    const axiosError = {
      response: {
        status: 401,
        data: { error: { message: 'Unauthorized' } }
      }
    } as unknown as AxiosError;

    const result = transformAxiosError(axiosError);

    expect(result).toBeInstanceOf(AuthenticationError);
    expect(result.message).toBe('Unauthorized');
  });
});
```

---

## Integration Testing with Mock Server

### Setting Up Mock Server

```typescript
import { beforeAll, afterAll, beforeEach } from '@jest/globals';
import { MockHttpServer, mockApiResponse } from '../helpers/mock-server';

describe('API Integration', () => {
  let server: MockHttpServer;

  beforeAll(async () => {
    server = new MockHttpServer(3456);
    await server.start();
    
    // Configure client to use mock server
    process.env.API_URL = server.getBaseUrl();
  });

  afterAll(async () => {
    await server.stop();
  });

  beforeEach(() => {
    server.reset(); // Clear all mock endpoints
  });

  it('should fetch data', async () => {
    server.mockEndpoint('GET', '/data', {
      status: 200,
      data: mockApiResponse({ value: 'test' })
    });

    // Your test here
  });
});
```

### Testing Error Scenarios

```typescript
it('should handle 500 error', async () => {
  server.mockEndpoint('GET', '/markets', {
    status: 500,
    data: { error: { message: 'Server error' } }
  });

  await expect(client.getMarkets()).rejects.toThrow(ApiError);
});

it('should handle rate limiting', async () => {
  server.mockEndpoint('POST', '/orders', {
    status: 429,
    data: { error: { message: 'Rate limited' } },
    headers: { 'retry-after': '60' }
  });

  try {
    await client.placeOrder(order);
    fail('Should have thrown');
  } catch (error) {
    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).retryAfter).toBe(60);
  }
});
```

### Testing Delayed Responses

```typescript
it('should handle slow responses', async () => {
  server.mockEndpoint('GET', '/markets', {
    status: 200,
    data: mockApiResponse([]),
    delay: 2000 // 2 second delay
  });

  const start = Date.now();
  await client.getMarkets();
  const duration = Date.now() - start;

  expect(duration).toBeGreaterThanOrEqual(2000);
}, 10000); // Increase test timeout
```

---

## Testing Async Behavior

### Testing Promises

```typescript
it('should resolve promise', async () => {
  const result = await asyncFunction();
  expect(result).toBe('expected');
});

it('should reject promise', async () => {
  await expect(asyncFunction()).rejects.toThrow('Error message');
});
```

### Testing Callbacks

```typescript
it('should call callback', (done) => {
  functionWithCallback((result) => {
    expect(result).toBe('expected');
    done();
  });
});
```

### Testing Event Emitters

```typescript
it('should emit event', (done) => {
  eventEmitter.on('test-event', (data) => {
    expect(data).toEqual({ value: 'test' });
    done();
  });

  eventEmitter.emit('test-event', { value: 'test' });
});
```

---

## Testing WebSocket Features

### Connection Lifecycle

```typescript
import { WebSocketClient, ConnectionState } from '../src/sdk/ws/client';
import { MockWebSocketServer } from '../helpers/mock-server';

describe('WebSocket', () => {
  let server: MockWebSocketServer;
  let client: WebSocketClient;

  beforeAll(async () => {
    server = new MockWebSocketServer(3457);
  });

  afterAll(async () => {
    await server.stop();
  });

  beforeEach(() => {
    (WebSocketClient as any).instance = undefined;
    client = WebSocketClient.getInstance();
  });

  afterEach(() => {
    client.disconnect();
  });

  it('should connect and emit event', (done) => {
    client.on('connected', () => {
      expect(client.isConnected()).toBe(true);
      expect(client.getState()).toBe(ConnectionState.CONNECTED);
      done();
    });

    client.connect(server.getUrl());
  }, 10000);

  it('should receive messages', (done) => {
    client.on('connected', () => {
      server.broadcast({
        type: 'test',
        data: { value: 'hello' }
      });
    });

    client.on('message', (message) => {
      expect(message.type).toBe('test');
      expect(message.data.value).toBe('hello');
      done();
    });

    client.connect(server.getUrl());
  }, 10000);
});
```

### Testing Reconnection

```typescript
it('should reconnect after disconnect', (done) => {
  let connectionCount = 0;

  client.on('connected', () => {
    connectionCount++;
    
    if (connectionCount === 1) {
      // Disconnect after first connection
      server.disconnectAll();
    } else if (connectionCount === 2) {
      // Successfully reconnected
      done();
    }
  });

  client.connect(server.getUrl());
}, 15000);
```

---

## Testing Retry Logic

### Basic Retry Test

```typescript
import { withRetry } from '../src/sdk/http/retry';
import { NetworkError } from '../src/core/errors';

it('should retry on failure', async () => {
  let attempts = 0;

  const fn = async () => {
    attempts++;
    if (attempts < 3) {
      throw new NetworkError('Failed');
    }
    return 'success';
  };

  const result = await withRetry(fn);
  
  expect(result).toBe('success');
  expect(attempts).toBe(3);
});
```

### Testing Max Retries

```typescript
it('should respect max retries', async () => {
  const fn = async () => {
    throw new NetworkError('Always fails');
  };

  await expect(withRetry(fn, { maxRetries: 2 })).rejects.toThrow();
});
```

### Testing Non-Retryable Errors

```typescript
it('should not retry validation errors', async () => {
  let attempts = 0;

  const fn = async () => {
    attempts++;
    throw new ValidationError('Invalid');
  };

  await expect(withRetry(fn)).rejects.toThrow(ValidationError);
  expect(attempts).toBe(1); // Only attempted once
});
```

---

## Advanced Patterns

### Testing with Multiple Mock Endpoints

```typescript
it('should handle multiple endpoints', async () => {
  server.mockEndpoint('GET', '/markets', {
    status: 200,
    data: mockApiResponse([{ market_id: 'market_123' }])
  });

  server.mockEndpoint('GET', '/markets/market_123', {
    status: 200,
    data: mockApiResponse({ market_id: 'market_123', symbol: 'BTC/USD' })
  });

  const markets = await client.getMarkets();
  const market = await client.getMarket(markets[0].market_id);
  
  expect(market.symbol).toBe('BTC/USD');
});
```

### Testing Request History

```typescript
it('should make expected requests', async () => {
  server.mockEndpoint('POST', '/orders', {
    status: 200,
    data: mockApiResponse({ order_id: 'order_123' })
  });

  await client.placeOrder(orderData);
  
  const history = server.getRequestHistory();
  expect(history).toHaveLength(1);
  expect(history[0].method).toBe('POST');
  expect(history[0].url).toBe('/orders');
  expect(history[0].body).toMatchObject(orderData);
});
```

### Testing Concurrent Operations

```typescript
it('should handle concurrent calls', async () => {
  server.mockEndpoint('GET', '/instruments', {
    status: 200,
    data: mockApiResponse([])
  });

  const results = await Promise.all([
    client.listInstruments(),
    client.listInstruments(),
    client.listInstruments()
  ]);

  expect(results).toHaveLength(3);
});
```

---

## Troubleshooting Test Issues

### Test Hangs

```typescript
// Add timeout
it('should complete', async () => {
  // Test code
}, 5000); // 5 second timeout

// Or in beforeEach
beforeEach(() => {
  jest.setTimeout(10000);
});
```

### Test Fails Intermittently

```typescript
// Use jest.retryTimes for flaky tests
jest.retryTimes(3);

it('flaky test', async () => {
  // Test code
});
```

### Mock Not Working

```typescript
// Ensure mock is reset between tests
beforeEach(() => {
  jest.clearAllMocks();
  server.reset();
});
```

---

## Tips and Tricks

1. **Use `.only()` for debugging**
   ```typescript
   it.only('debug this test', () => {
     // Only this test runs
   });
   ```

2. **Use `.skip()` to temporarily disable**
   ```typescript
   it.skip('broken test', () => {
     // Skipped
   });
   ```

3. **Use `describe.each()` for multiple cases**
   ```typescript
   describe.each([
     ['buy', 'limit', '10', '100'],
     ['sell', 'market', '5', undefined],
   ])('Order side=%s type=%s', (side, type, qty, price) => {
     it('should validate', () => {
       // Test with parameters
     });
   });
   ```

4. **Use test fixtures**
   ```typescript
   import { mockOrder } from '../fixtures/mock-data';
   
   it('should handle order', () => {
     const result = processOrder(mockOrder);
     expect(result).toBeDefined();
   });
   ```

---

## References

- Jest Documentation: https://jestjs.io/
- Testing TypeScript: https://jestjs.io/docs/getting-started#via-ts-node
- Zod Testing: https://zod.dev/
- Axios Mocking: https://github.com/ctimmerm/axios-mock-adapter

