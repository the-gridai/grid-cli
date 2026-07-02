# GRID CLI Testing Guide

Comprehensive testing framework for GRID CLI unit tests.

## Quick Start

```bash
# Run all tests
npm test

# Run unit tests only (fast)
npm run test:unit

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch

# Verbose output
npm run test:verbose
```

---

## Test Structure

```
tests/
├── unit/                           # Unit tests (fast, no external dependencies)
│   ├── core/
│   │   └── errors/
│   │       └── index.test.ts       # Custom error classes
│   └── sdk/
│       ├── auth/
│       │   └── signature.test.ts   # Signature authentication
│       ├── http/
│       │   ├── client.test.ts      # API client
│       │   ├── error-handler.test.ts # Error transformation
│       │   ├── rate-limiter.test.ts  # Rate limiting
│       │   └── retry.test.ts       # Retry logic
│       ├── validators/
│       │   ├── inputs.test.ts      # Input validation
│       │   └── responses.test.ts   # Response validation
│       └── ws/
│           └── client.test.ts      # WebSocket client
├── helpers/
│   └── mock-server.ts              # Mock HTTP and WebSocket servers
└── fixtures/                       # Test data
    ├── mock-data/
    ├── mock-responses/
    └── mock-streams/
```

---

## Test Categories

### Unit Tests (~90 tests, <5s)

Test individual components in isolation:
- **Error classes** - All 9 custom error types
- **Retry logic** - Exponential backoff, max retries, retryable errors
- **Rate limiter** - Concurrent limits, intervals, queuing
- **Error handler** - Axios error transformation
- **Input validators** - Request parameter validation
- **Response validators** - API response validation
- **WebSocket** - Connection, reconnection, heartbeat, queue

**Run:** `npm run test:unit`

### Coverage Requirements

- **core/errors**: >90%
- **sdk/http**: >90% (client, retry, rate-limiter, error-handler)
- **sdk/validators**: >80%
- **sdk/ws**: >70%
- **Overall**: >80%

**Generate report:** `npm run test:coverage`

---

## Running Tests

### All Tests

```bash
npm test
```

Expected output:
```
Test Suites: 11 passed, 11 total
Tests:       150+ passed, 150+ total
Snapshots:   0 total
Time:        < 60s
```

### Specific Test File

```bash
npm test -- tests/unit/sdk/http/retry.test.ts
```

### With Coverage

```bash
npm run test:coverage
```

Generates coverage report in `coverage/` directory.

### Watch Mode

```bash
npm run test:watch
```

Re-runs tests on file changes.

---

## Writing New Tests

### Unit Test Example

```typescript
import { describe, it, expect } from '@jest/globals';
import { myFunction } from '../src/myModule';

describe('myFunction', () => {
  it('should handle valid input', () => {
    const result = myFunction('valid');
    expect(result).toBe('expected');
  });

  it('should throw on invalid input', () => {
    expect(() => myFunction('invalid')).toThrow();
  });
});
```

### Integration Test Example

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { MockHttpServer, mockApiResponse } from '../helpers/mock-server';
import { ApiClient } from '../../src/sdk/http/client';

describe('My Integration Test', () => {
  let server: MockHttpServer;

  beforeAll(async () => {
    server = new MockHttpServer(3456);
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  it('should make API call', async () => {
    server.mockEndpoint('GET', '/test', {
      status: 200,
      data: mockApiResponse({ value: 'test' })
    });

    const client = ApiClient.getInstance();
    const result = await client.someMethod();
    
    expect(result).toBeDefined();
  });
});
```

---

## Mock Server Usage

### HTTP Mock Server

```typescript
import { MockHttpServer, mockApiResponse, mockErrorResponse } from '../helpers/mock-server';

const server = new MockHttpServer(3456);
await server.start();

// Mock successful response
server.mockEndpoint('GET', '/markets', {
  status: 200,
  data: mockApiResponse([{ market_id: 'market_123' }])
});

// Mock error response
server.mockEndpoint('POST', '/orders', mockErrorResponse(
  'VALIDATION_ERROR',
  'Invalid order',
  400
));

// Mock delayed response
server.mockEndpoint('GET', '/ticker', {
  status: 200,
  data: mockApiResponse({ price: '50000' }),
  delay: 1000 // 1 second delay
});

// Get request history
const history = server.getRequestHistory();

// Clean up
await server.stop();
```

### WebSocket Mock Server

```typescript
import { MockWebSocketServer } from '../helpers/mock-server';

const wsServer = new MockWebSocketServer(3457);

// Broadcast to all clients
wsServer.broadcast({
  type: 'ticker',
  data: { price: '50000' }
});

// Get message history
const messages = wsServer.getMessageHistory();

// Clean up
await wsServer.stop();
```

---

## Debugging Tests

### Failed Test

```bash
# Run specific failing test
npm test -- tests/unit/sdk/http/retry.test.ts

# Run with verbose output
npm test -- --verbose

# Run with debug logs
LOG_LEVEL=debug npm test
```

### Test Timeout

```bash
# Increase timeout (in jest.config.js or test file)
jest.setTimeout(30000); // 30 seconds
```

### Mock Issues

```bash
# Clear jest cache
npm test -- --clearCache

# Run tests serially
npm test -- --runInBand
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run type-check
      - run: npm test
      - run: npm run test:coverage
```

### Pre-commit Hook

```bash
# Install husky
npm install --save-dev husky

# Create pre-commit hook
npx husky install
npx husky add .husky/pre-commit "npm run type-check && npm run test:unit"
```

---

## Coverage Reports

### Generate Coverage

```bash
npm run test:coverage
```

### View Coverage Report

Open `coverage/lcov-report/index.html` in browser.

### Coverage Thresholds

Edit `jest.config.js`:

```javascript
module.exports = {
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

---

## Test Data

### Mock Data Location

- `tests/fixtures/mock-data/` - Static test data
- `tests/fixtures/mock-responses/` - API response templates
- `tests/fixtures/mock-streams/` - WebSocket message templates

### Creating Mock Data

```typescript
// Order mock data
export const mockOrder = {
  order_id: 'order_test_123',
  market_id: 'market_test',
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
```

---

## Common Issues

### Issue: Tests timeout

**Solution:** Increase Jest timeout or check for hanging promises

```typescript
jest.setTimeout(30000); // 30 seconds
```

### Issue: Tests fail intermittently

**Solution:** Run tests serially to avoid race conditions

```bash
npm test -- --runInBand
```

### Issue: Mock server port in use

**Solution:** Change port or kill existing process

```bash
# Find process
lsof -i :3456

# Kill process
kill -9 <PID>

# Or use different port in test
const server = new MockHttpServer(3999);
```

### Issue: Type errors in tests

**Solution:** Ensure types are imported correctly

```typescript
import type { Order } from '../../src/sdk/types';
```

---

## Best Practices

1. **Isolate tests** - Each test should be independent
2. **Clean up** - Use afterEach/afterAll to clean up resources
3. **Use descriptive names** - Test names should describe what they test
4. **Test edge cases** - Not just happy paths
5. **Mock external dependencies** - Don't hit real API in unit tests
6. **Fast unit tests** - Keep unit tests under 100ms each
7. **Async/await** - Always await async operations
8. **Type safety** - Use TypeScript in tests too

---

## Support

For questions or issues with tests:

1. Check this README
2. Review `tests/EXAMPLES.md`
3. Look at existing tests for patterns
4. Check `docs/TROUBLESHOOTING.md` for general issues
5. Run tests with `--verbose` for more details

---

## Test Maintenance

### Adding New Tests

1. Create test file in appropriate directory
2. Follow naming convention: `*.test.ts`
3. Import necessary dependencies
4. Write describe blocks for organization
5. Write it blocks for specific cases
6. Run tests to verify

### Updating Tests

When adding new features:
1. Add unit tests for new functions/classes
2. Add integration tests for new flows
3. Update mocks if API changes
4. Maintain coverage thresholds

### Removing Tests

When deprecating features:
1. Mark tests as `.skip()`
2. Add comment explaining why
3. Keep for historical reference
4. Remove after feature fully removed

---

## Performance

- **Unit tests**: Target <5 seconds total
- **Integration tests**: Target <60 seconds total
- **Coverage generation**: +5-10 seconds

Optimize slow tests by:
- Reducing delays/timeouts
- Mocking expensive operations
- Running tests in parallel (default)
- Using test fixtures instead of generating data

