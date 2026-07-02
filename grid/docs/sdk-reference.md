# SDK Reference

Complete API reference for the Grid TypeScript SDK.

## Installation

```bash
npm install @the-gridai/grid-sdk
```

## GridClient

The main client class for interacting with the Grid API.

### Constructor

```typescript
import { GridClient } from '@the-gridai/grid-sdk';

const client = new GridClient({
  apiUrl: string;           // Required: API base URL
  signingKey: string;       // Required: Ed25519 signing key (base64)
  fingerprint: string;      // Required: Key fingerprint
  wsUrl?: string;           // Optional: WebSocket URL
  timeout?: number;         // Optional: Request timeout (ms), default 30000
  maxConcurrent?: number;   // Optional: Max concurrent requests, default 10
  minInterval?: number;     // Optional: Min interval between requests (ms), default 100
  maxRetries?: number;      // Optional: Max retry attempts, default 3
  enableRetries?: boolean;  // Optional: Enable retries, default true
  logger?: Logger;          // Optional: Custom logger
});
```

### Orders API

#### client.orders.list(filters?)

List orders with optional filtering.

```typescript
const orders = await client.orders.list({
  status?: 'open' | 'filled' | 'cancelled' | 'active';
  market_id?: string;
  side?: 'buy' | 'sell';
});
```

#### client.orders.get(orderId)

Get order by ID.

```typescript
const order = await client.orders.get('order-123');
```

#### client.orders.create(request)

Place a new order.

```typescript
const order = await client.orders.create({
  market_id: string;          // Required: Market ID
  side: 'buy' | 'sell';       // Required: Order side
  type: 'limit' | 'market' | 'stop' | 'stop_limit';  // Required
  quantity: string;           // Required: Order quantity
  price?: string;             // Required for limit orders
  stop_price?: string;        // Required for stop orders
  time_in_force?: 'gtc' | 'ioc' | 'fok' | 'day';  // Default: gtc
  client_order_id?: string;   // Optional: Client-defined ID
  post_only?: boolean;        // Optional: Post only flag
  reduce_only?: boolean;      // Optional: Reduce only flag
});
```

#### client.orders.cancel(orderId)

Cancel an order.

```typescript
await client.orders.cancel('order-123');
```

#### client.orders.update(orderId, updates)

Update an existing order.

```typescript
const order = await client.orders.update('order-123', {
  price?: string;
  quantity?: string;
  stop_price?: string;
  time_in_force?: 'gtc' | 'ioc' | 'fok' | 'day';
});
```

#### client.orders.cancelAll()

Cancel all active orders.

```typescript
const { cancelled } = await client.orders.cancelAll();
console.log(`Cancelled ${cancelled} orders`);
```

### Markets API

#### client.markets.list()

List all markets.

```typescript
const markets = await client.markets.list();
```

#### client.markets.get(marketId)

Get market details.

```typescript
const market = await client.markets.get('BTC-USD');
```

#### client.markets.getTicker(marketId)

Get market ticker.

```typescript
const ticker = await client.markets.getTicker('BTC-USD');
// { last_price, highest_bid, lowest_ask, volume_24h, ... }
```

#### client.markets.getOrderBook(marketId, depth?)

Get order book.

```typescript
const orderBook = await client.markets.getOrderBook('BTC-USD', 20);
// { bids: [...], asks: [...], timestamp, sequence }
```

#### client.markets.getTrades(marketId, limit?)

Get recent market trades.

```typescript
const trades = await client.markets.getTrades('BTC-USD', 50);
```

### Trades API

#### client.trades.list(filters?)

Get user's trade history.

```typescript
const trades = await client.trades.list({
  market_id?: string;
  order_id?: string;
  from_date?: string;
  to_date?: string;
});
```

#### client.trades.get(tradeId)

Get trade by ID.

```typescript
const trade = await client.trades.get('trade-123');
```

### Accounts API

#### client.accounts.getTradingAccounts()

Get trading account balances.

```typescript
const accounts = await client.accounts.getTradingAccounts();
// [{ account_id, instrument_id, total_balance, available_balance, ... }]
```

#### client.accounts.getTradingAccount(accountId)

Get specific trading account.

```typescript
const account = await client.accounts.getTradingAccount('ta-123');
```

#### client.accounts.getConsumptionAccounts()

Get consumption account balances (inference credits).

```typescript
const accounts = await client.accounts.getConsumptionAccounts();
```

#### client.accounts.getIssuanceAccounts()

Get issuance accounts (for suppliers).

```typescript
const accounts = await client.accounts.getIssuanceAccounts();
```

#### client.accounts.getMe()

Get current user info.

```typescript
const user = await client.accounts.getMe();
```

### Transfers API

#### client.transfers.toConsumption(instrumentId, quantity)

Transfer from trading to consumption account.

```typescript
await client.transfers.toConsumption('compute', 1000);
```

#### client.transfers.toTrading(instrumentId, quantity)

Transfer from consumption to trading account.

```typescript
await client.transfers.toTrading('compute', 500);
```

#### client.transfers.getHistory(marketId?, instrumentId?)

Get transfer history.

```typescript
const history = await client.transfers.getHistory();
```

### Supply API

#### client.supply.issue(instrumentId, quantity)

Issue new supply (suppliers only).

```typescript
await client.supply.issue('compute', 10000);
```

#### client.supply.getIssuances(filters?)

Get supply issuances.

```typescript
const issuances = await client.supply.getIssuances();
```

#### client.supply.getSummary()

Get supply issuance summary.

```typescript
const summary = await client.supply.getSummary();
```

## GridWebSocket

WebSocket client for real-time updates.

### Constructor

```typescript
import { GridWebSocket } from '@the-gridai/grid-sdk';

const ws = new GridWebSocket({
  wsUrl: string;               // Required: WebSocket URL
  signingKey: string;          // Required: Ed25519 signing key
  fingerprint: string;         // Required: Key fingerprint
  logger?: Logger;             // Optional: Custom logger
  reconnectDelay?: number;     // Optional: Initial reconnect delay (ms)
  maxReconnectDelay?: number;  // Optional: Max reconnect delay (ms)
  maxReconnectAttempts?: number;  // Optional: Max reconnect attempts
  heartbeatInterval?: number;  // Optional: Heartbeat interval (ms)
  heartbeatTimeout?: number;   // Optional: Heartbeat timeout (ms)
});
```

### Methods

#### ws.connect(url?)

Connect to WebSocket server.

```typescript
ws.connect();
```

#### ws.disconnect()

Disconnect from server.

```typescript
ws.disconnect();
```

#### ws.subscribeToOrders(callback)

Subscribe to order updates. Returns unsubscribe function.

```typescript
const unsubscribe = ws.subscribeToOrders((event) => {
  console.log(event.type);  // 'order_created' | 'order_updated' | 'order_filled' | 'order_cancelled'
  console.log(event.order);
});

// Later: unsubscribe()
```

#### ws.subscribeToTrades(callback)

Subscribe to trade updates.

```typescript
const unsubscribe = ws.subscribeToTrades((event) => {
  console.log(event.trade);
});
```

#### ws.subscribeToTicker(marketId, callback)

Subscribe to ticker updates for a market.

```typescript
const unsubscribe = ws.subscribeToTicker('BTC-USD', (event) => {
  console.log(event.ticker.last_price);
});
```

#### ws.getState()

Get connection state.

```typescript
const state = ws.getState();  // 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed'
```

#### ws.isConnected()

Check if connected.

```typescript
if (ws.isConnected()) {
  // ...
}
```

### Events

The WebSocket client is an EventEmitter:

```typescript
ws.on('connected', () => { });
ws.on('disconnected', () => { });
ws.on('reconnecting', ({ attempt, delay }) => { });
ws.on('failed', () => { });
ws.on('error', (error) => { });
ws.on('message', (message) => { });
ws.on('order', (event) => { });
ws.on('trade', (event) => { });
ws.on('ticker', (event) => { });
```

## Error Classes

```typescript
import {
  GridError,           // Base error class
  ApiError,            // API returned an error
  AuthenticationError, // Authentication failed
  NetworkError,        // Network error
  RateLimitError,      // Rate limit exceeded
  ValidationError,     // Request validation failed
  InsufficientBalanceError,  // Insufficient balance
  OrderNotFoundError,  // Order not found
  MarketNotFoundError, // Market not found
  WebSocketError,      // WebSocket error
} from '@the-gridai/grid-sdk';

try {
  await client.orders.create({ ... });
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Retry after ${error.retryAfter} seconds`);
  } else if (error instanceof ValidationError) {
    console.log('Validation errors:', error.validationErrors);
  } else if (error instanceof ApiError) {
    console.log(`API error ${error.statusCode}: ${error.message}`);
  }
}
```

## Types

All types are exported:

```typescript
import type {
  // Config
  GridClientConfig,
  Logger,
  
  // Orders
  Order,
  PlaceOrderRequest,
  UpdateOrderRequest,
  OrderFilters,
  OrderSide,
  OrderType,
  OrderStatus,
  TimeInForce,
  
  // Markets
  Market,
  Ticker,
  OrderBook,
  OrderBookLevel,
  PublicTrade,
  
  // Accounts
  TradingAccount,
  ConsumptionInstrument,
  IssuanceAccount,
  
  // Trades
  Trade,
  TradeFilters,
  
  // WebSocket
  ConnectionState,
  OrderEvent,
  TradeEvent,
  TickerEvent,
} from '@the-gridai/grid-sdk';
```

## Utilities

### generateKeyPair()

Generate a new Ed25519 key pair.

```typescript
import { generateKeyPair } from '@the-gridai/grid-sdk';

const { signingKey, publicKey } = generateKeyPair();
```

### calculateFingerprint(publicKey)

Calculate fingerprint from public key.

```typescript
import { calculateFingerprint } from '@the-gridai/grid-sdk';

const fingerprint = await calculateFingerprint(publicKey);
```

### sleep(ms)

Sleep utility.

```typescript
import { sleep } from '@the-gridai/grid-sdk';

await sleep(1000);  // Wait 1 second
```
