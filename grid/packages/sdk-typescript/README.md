# @the-gridai/grid-sdk

Official TypeScript SDK for the Grid Trading Platform.

## Installation

```bash
npm install @the-gridai/grid-sdk
```

## Quick Start

```typescript
import { GridClient } from '@the-gridai/grid-sdk';

// Initialize the client
const client = new GridClient({
  apiUrl: 'https://api.thegrid.ai',
  signingKey: process.env.GRID_SIGNING_KEY!,
  fingerprint: process.env.GRID_FINGERPRINT!,
});

// List your orders
const orders = await client.orders.list();
console.log('Orders:', orders);

// Place a limit order
const order = await client.orders.create({
  market_id: 'BTC-USD',
  side: 'buy',
  type: 'limit',
  quantity: '1.0',
  price: '50000',
});
console.log('Created order:', order.id);

// Get account balances
const balances = await client.accounts.getTradingAccounts();
console.log('Balances:', balances);
```

## Authentication

The Grid API uses Ed25519 signatures for authentication. You'll need:

1. **Signing Key**: Your Ed25519 private key (base64 encoded)
2. **Fingerprint**: SHA256 hash of your public key (base64, no padding)

### Generating a Key Pair

```typescript
import { generateKeyPair, calculateFingerprint } from '@the-gridai/grid-sdk';

// Generate a new key pair
const { signingKey, publicKey } = generateKeyPair();

// Calculate fingerprint
const fingerprint = await calculateFingerprint(publicKey);

console.log('Signing Key:', signingKey);
console.log('Public Key:', publicKey);
console.log('Fingerprint:', fingerprint);
```

Store your signing key securely. Register the public key with the Grid platform.

## API Reference

### Orders

```typescript
// List orders (with optional filters)
const orders = await client.orders.list({ status: 'active' });

// Get order by ID
const order = await client.orders.get('order-123');

// Place an order
const newOrder = await client.orders.create({
  market_id: 'BTC-USD',
  side: 'buy',
  type: 'limit',
  quantity: '1.0',
  price: '50000',
});

// Cancel an order
await client.orders.cancel('order-123');

// Cancel all orders
const { cancelled } = await client.orders.cancelAll();
```

### Markets

```typescript
// List all markets
const markets = await client.markets.list();

// Get market details
const market = await client.markets.get('BTC-USD');

// Get market ticker
const ticker = await client.markets.getTicker('BTC-USD');

// Get order book
const orderBook = await client.markets.getOrderBook('BTC-USD', 10);
```

### Accounts

```typescript
// Get trading accounts (balances)
const accounts = await client.accounts.getTradingAccounts();

// Get consumption accounts (inference credits)
const consumption = await client.accounts.getConsumptionAccounts();

// Get issuance accounts (for suppliers)
const issuance = await client.accounts.getIssuanceAccounts();
```

### Trades

```typescript
// Get trade history
const trades = await client.trades.list({ market_id: 'BTC-USD' });

// Get trade by ID
const trade = await client.trades.get('trade-123');
```

### Transfers

```typescript
// Transfer to consumption account
await client.transfers.toConsumption('instrument-id', 100);

// Transfer to trading account
await client.transfers.toTrading('instrument-id', 50);

// Get transfer history
const history = await client.transfers.getHistory();
```

## WebSocket (Real-time Updates)

```typescript
import { GridWebSocket } from '@the-gridai/grid-sdk';

const ws = new GridWebSocket({
  wsUrl: 'wss://api.thegrid.ai/ws',
  signingKey: process.env.GRID_SIGNING_KEY!,
  fingerprint: process.env.GRID_FINGERPRINT!,
});

// Connect
ws.connect();

// Subscribe to order updates
const unsubOrders = ws.subscribeToOrders((event) => {
  console.log('Order update:', event);
});

// Subscribe to trade updates
const unsubTrades = ws.subscribeToTrades((event) => {
  console.log('Trade:', event);
});

// Subscribe to ticker updates
const unsubTicker = ws.subscribeToTicker('BTC-USD', (event) => {
  console.log('Ticker:', event);
});

// Later: unsubscribe
unsubOrders();
unsubTrades();
unsubTicker();

// Disconnect
ws.disconnect();
```

## Error Handling

The SDK provides typed errors for different failure scenarios:

```typescript
import {
  GridError,
  ApiError,
  AuthenticationError,
  ValidationError,
  NetworkError,
  RateLimitError,
} from '@the-gridai/grid-sdk';

try {
  await client.orders.create({ /* ... */ });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.log('Authentication failed - check your credentials');
  } else if (error instanceof ValidationError) {
    console.log('Invalid request:', error.validationErrors);
  } else if (error instanceof RateLimitError) {
    console.log(`Rate limited - retry after ${error.retryAfter} seconds`);
  } else if (error instanceof NetworkError) {
    console.log('Network error:', error.message);
  } else if (error instanceof ApiError) {
    console.log(`API error ${error.statusCode}:`, error.message);
  }
}
```

## Configuration Options

```typescript
const client = new GridClient({
  // Required
  apiUrl: 'https://api.thegrid.ai',
  signingKey: 'your-signing-key',
  fingerprint: 'your-fingerprint',

  // Optional
  wsUrl: 'wss://api.thegrid.ai/ws',  // WebSocket URL
  timeout: 30000,                     // Request timeout (ms)
  maxConcurrent: 10,                  // Max concurrent requests
  minInterval: 100,                   // Min interval between requests (ms)
  maxRetries: 3,                      // Max retry attempts
  enableRetries: true,                // Enable/disable retries
  logger: console,                    // Custom logger
});
```

## Custom Logger

```typescript
const client = new GridClient({
  // ...
  logger: {
    debug: (msg, meta) => console.debug(`[DEBUG] ${msg}`, meta),
    info: (msg, meta) => console.info(`[INFO] ${msg}`, meta),
    warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta),
    error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta),
  },
});
```

## TypeScript Support

The SDK is written in TypeScript and exports all types:

```typescript
import type {
  Order,
  PlaceOrderRequest,
  Market,
  Ticker,
  TradingAccount,
  OrderEvent,
  TradeEvent,
} from '@the-gridai/grid-sdk';
```

## License

MIT
