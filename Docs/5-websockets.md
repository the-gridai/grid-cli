# Market Data WebSockets

Real-time market data streaming via WebSocket connections.

## Connection

**WebSocket URL**: `wss://trading.api.thegrid.ai/v1/`

WebSocket connections provide real-time updates for market data including tickers, trades, and order book changes.

### Establishing Connection

**Example (JavaScript/TypeScript)**:

```javascript
import WebSocket from 'ws';

const ws = new WebSocket('wss://trading.api.thegrid.ai/v1/');

ws.on('open', () => {
  console.log('Connected to GRID WebSocket');
  
  // Connection is ready, subscribe to channels
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  handleMessage(message);
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.on('close', (code, reason) => {
  console.log(`Connection closed: ${code} - ${reason}`);
  // Implement reconnection logic
});
```

**Example (Python)**:

```python
import websocket
import json
import threading

def on_open(ws):
    print("Connected to GRID WebSocket")
    # Subscribe to channels

def on_message(ws, message):
    data = json.loads(message)
    handle_message(data)

def on_error(ws, error):
    print(f"WebSocket error: {error}")

def on_close(ws, close_status_code, close_msg):
    print(f"Connection closed: {close_status_code} - {close_msg}")

ws = websocket.WebSocketApp(
    'wss://trading.api.thegrid.ai/v1/',
    on_open=on_open,
    on_message=on_message,
    on_error=on_error,
    on_close=on_close
)

# Run in background thread
wst = threading.Thread(target=ws.run_forever)
wst.daemon = True
wst.start()
```

**Example (Browser JavaScript)**:

```javascript
const ws = new WebSocket('wss://trading.api.thegrid.ai/v1/');

ws.onopen = () => {
  console.log('Connected');
  // Subscribe to channels
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};

ws.onerror = (error) => {
  console.error('Error:', error);
};

ws.onclose = () => {
  console.log('Disconnected');
};
```

## Authentication

WebSocket connections do **not** require authentication for public market data channels.

For **private channels** (user orders, fills, balances, positions), you must be authenticated. The GRID WebSocket uses **session-based authentication** via cookies. You must first authenticate via the REST API (login), then connect to WebSocket with your session cookie.

**Browser JavaScript** (cookies handled automatically):

```javascript
// First login via REST API to establish session
const loginResponse = await axios.post(
  'https://trading.api.thegrid.ai/v1/users/log-in',
  {
    user: {
      email: 'user@example.com',
      password: 'SecurePassword123!'
    }
  },
  { withCredentials: true }
);

// Then connect WebSocket - session cookie sent automatically
const ws = new WebSocket('wss://trading.api.thegrid.ai/v1/');

ws.onopen = () => {
  // Join private channel - authentication verified via session
  ws.send(JSON.stringify({
    type: 'join',
    channel: 'orders',
    user_id: loginResponse.data.data.id,
    _csrf_token: getCsrfToken() // Get from login response or cookie
  }));
};
```

**Node.js** (manual cookie handling):

```javascript
import WebSocket from 'ws';
import axios from 'axios';

// First login to get session cookie
const loginResponse = await axios.post(
  'https://trading.api.thegrid.ai/v1/users/log-in',
  {
    user: {
      email: 'user@example.com',
      password: 'SecurePassword123!'
    }
  }
);

// Extract session cookie
const cookies = loginResponse.headers['set-cookie'];
const sessionCookie = cookies.find(c => c.startsWith('_exchange_key='));

// Connect with cookie
const ws = new WebSocket('wss://trading.api.thegrid.ai/v1/', {
  headers: {
    Cookie: sessionCookie
  }
});

ws.on('open', () => {
  console.log('Authenticated WebSocket connected');
});
```

## Channels

Subscribe to specific data channels to receive real-time updates.

### Channel Types

| Channel | Description | Public/Private |
|---------|-------------|----------------|
| `ticker` | Real-time ticker updates | Public |
| `book` / `orderbooks` | Order book updates | Public |
| `public_trades` | Public trade executions | Public |
| `public_market_stats` | Market statistics | Public |
| `public_orders` | Public order updates | Public |
| `price_histories` | Price history updates | Public |
| `orders` | User's order updates | Private |
| `trades` | User's trade executions | Private |
| `positions` | User's position updates | Private |
| `trading_account_summaries` | Account balance updates | Private |
| `consumption_account_update` | Consumption account updates | Private |
| `transfer_histories` | Transfer history updates | Private |

## Subscribe to Channels

### Ticker Channel

Get real-time ticker updates for a market.

**Subscribe Message**:

```json
{
  "type": "subscribe",
  "channel": "ticker",
  "market_id": "market_b310e860-97cd-45eb-bdc3-5be0b79295d0"
}
```

**Subscription Confirmation**:

```json
{
  "type": "subscribed",
  "channel": "ticker",
  "market_id": "market_b310e860-97cd-45eb-bdc3-5be0b79295d0",
  "timestamp": "2025-01-01T12:34:56.789Z"
}
```

**Ticker Update Message**:

```json
{
  "type": "ticker",
  "channel": "ticker",
  "market_id": "market_b310e860-97cd-45eb-bdc3-5be0b79295d0",
  "symbol": "BTC-USD",
  "last_price": "45123.50",
  "bid": "45120.00",
  "ask": "45125.00",
  "volume_24h": "1234.567",
  "high_24h": "46000.00",
  "low_24h": "44000.00",
  "price_change_24h": "1123.50",
  "price_change_percent_24h": "2.56",
  "timestamp": "2025-01-01T12:34:56.789Z"
}
```

**Example**:

```javascript
// Subscribe to BTC-USD ticker
ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'ticker',
    market_id: 'market_b310e860-97cd-45eb-bdc3-5be0b79295d0'
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.type === 'ticker') {
    console.log(`${msg.symbol}: $${msg.last_price} (${msg.price_change_percent_24h}%)`);
  }
});
```

### Trades Channel

Get real-time trade executions for a market.

**Subscribe Message**:

```json
{
  "type": "subscribe",
  "channel": "trades",
  "market_id": "market_b310e860-97cd-45eb-bdc3-5be0b79295d0"
}
```

**Trade Message**:

```json
{
  "type": "trade",
  "channel": "trades",
  "market_id": "market_b310e860-97cd-45eb-bdc3-5be0b79295d0",
  "symbol": "BTC-USD",
  "trade_id": "trade_abc123",
  "price": "45123.50",
  "quantity": "0.125",
  "side": "buy",
  "timestamp": "2025-01-01T12:34:56.789Z"
}
```

**Example**:

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'trades',
  market_id: 'market_b310e860-97cd-45eb-bdc3-5be0b79295d0'
}));

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.type === 'trade') {
    const arrow = msg.side === 'buy' ? '🟢' : '🔴';
    console.log(`${arrow} ${msg.quantity} @ $${msg.price}`);
  }
});
```

### Book (Order Book) Channel

Get real-time order book updates.

**Subscribe Message**:

```json
{
  "type": "subscribe",
  "channel": "book",
  "market_id": "market_b310e860-97cd-45eb-bdc3-5be0b79295d0",
  "depth": 20
}
```

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `depth` | integer | No | 20 | Number of price levels per side (max: 100) |

#### Initial Snapshot Message

After subscribing, you'll receive a full snapshot:

```json
{
  "type": "book_snapshot",
  "channel": "book",
  "market_id": "market_b310e860-97cd-45eb-bdc3-5be0b79295d0",
  "symbol": "BTC-USD",
  "bids": [
    ["45120.00", "0.5"],
    ["45119.00", "1.2"],
    ["45118.00", "0.8"]
  ],
  "asks": [
    ["45125.00", "0.3"],
    ["45126.00", "0.9"],
    ["45127.00", "1.5"]
  ],
  "timestamp": "2025-01-01T12:34:56.789Z",
  "sequence": 1234567
}
```

#### Incremental Update Messages

After the snapshot, you'll receive incremental updates:

```json
{
  "type": "book_update",
  "channel": "book",
  "market_id": "market_b310e860-97cd-45eb-bdc3-5be0b79295d0",
  "side": "bid",
  "price": "45120.00",
  "quantity": "0.7",
  "timestamp": "2025-01-01T12:34:57.123Z",
  "sequence": 1234568
}
```

**Update Rules**:

- `quantity > 0`: Update or insert price level
- `quantity = 0`: Remove price level
- `sequence`: Monotonically increasing number for ordering

**Example: Building and Maintaining Order Book**:

```javascript
class OrderBook {
  constructor() {
    this.bids = new Map(); // price -> quantity
    this.asks = new Map();
    this.sequence = 0;
  }

  handleSnapshot(snapshot) {
    this.bids.clear();
    this.asks.clear();
    
    snapshot.bids.forEach(([price, qty]) => {
      this.bids.set(price, qty);
    });
    
    snapshot.asks.forEach(([price, qty]) => {
      this.asks.set(price, qty);
    });
    
    this.sequence = snapshot.sequence;
  }

  handleUpdate(update) {
    // Ensure updates are in order
    if (update.sequence <= this.sequence) {
      console.warn('Out of order update, ignoring');
      return;
    }
    
    const book = update.side === 'bid' ? this.bids : this.asks;
    
    if (parseFloat(update.quantity) === 0) {
      book.delete(update.price);
    } else {
      book.set(update.price, update.quantity);
    }
    
    this.sequence = update.sequence;
  }

  getBestBid() {
    const prices = Array.from(this.bids.keys()).map(parseFloat);
    const bestPrice = Math.max(...prices);
    return [bestPrice.toFixed(2), this.bids.get(bestPrice.toFixed(2))];
  }

  getBestAsk() {
    const prices = Array.from(this.asks.keys()).map(parseFloat);
    const bestPrice = Math.min(...prices);
    return [bestPrice.toFixed(2), this.asks.get(bestPrice.toFixed(2))];
  }

  getSpread() {
    const [bidPrice] = this.getBestBid();
    const [askPrice] = this.getBestAsk();
    return (parseFloat(askPrice) - parseFloat(bidPrice)).toFixed(2);
  }
}

// Usage
const orderBook = new OrderBook();

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.type === 'book_snapshot') {
    orderBook.handleSnapshot(msg);
    console.log('Order book initialized');
  } else if (msg.type === 'book_update') {
    orderBook.handleUpdate(msg);
    const [bidPrice, bidQty] = orderBook.getBestBid();
    const [askPrice, askQty] = orderBook.getBestAsk();
    console.log(`Bid: ${bidPrice} (${bidQty}) | Ask: ${askPrice} (${askQty}) | Spread: ${orderBook.getSpread()}`);
  }
});
```

## Unsubscribe from Channels

**Unsubscribe Message**:

```json
{
  "type": "unsubscribe",
  "channel": "ticker",
  "market_id": "market_b310e860-97cd-45eb-bdc3-5be0b79295d0"
}
```

**Unsubscribe Confirmation**:

```json
{
  "type": "unsubscribed",
  "channel": "ticker",
  "market_id": "market_b310e860-97cd-45eb-bdc3-5be0b79295d0"
}
```

**Example**:

```javascript
// Unsubscribe from ticker
ws.send(JSON.stringify({
  type: 'unsubscribe',
  channel: 'ticker',
  market_id: 'market_b310e860-97cd-45eb-bdc3-5be0b79295d0'
}));
```

## Message Schemas

### Common Fields

All messages include these fields:

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Message type |
| `channel` | string | Channel name |
| `market_id` | string | Market identifier |
| `timestamp` | string | ISO 8601 timestamp |

### Heartbeat Messages

The server sends periodic heartbeat messages:

```json
{
  "type": "heartbeat",
  "timestamp": "2025-01-01T12:34:56.789Z"
}
```

Respond with a pong:

```json
{
  "type": "pong",
  "timestamp": "2025-01-01T12:34:56.789Z"
}
```

**Example**:

```javascript
ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.type === 'heartbeat') {
    ws.send(JSON.stringify({
      type: 'pong',
      timestamp: new Date().toISOString()
    }));
  }
});
```

## Connection Limits

- **Maximum connections**: 10 concurrent connections per account
- **Maximum subscriptions**: 50 channels per connection
- **Message rate**: 100 messages/second per connection

## Reconnection Guidance

Implement exponential backoff for reconnections:

**Example**:

```javascript
class ReconnectingWebSocket {
  constructor(url) {
    this.url = url;
    this.reconnectDelay = 1000; // Start at 1 second
    this.maxReconnectDelay = 30000; // Max 30 seconds
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.subscriptions = [];
    
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url);
    
    this.ws.on('open', () => {
      console.log('WebSocket connected');
      this.reconnectDelay = 1000; // Reset on successful connection
      this.reconnectAttempts = 0;
      
      // Resubscribe to channels
      this.subscriptions.forEach(sub => {
        this.ws.send(JSON.stringify(sub));
      });
    });

    this.ws.on('message', (data) => {
      this.handleMessage(JSON.parse(data.toString()));
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    this.ws.on('close', () => {
      console.log('WebSocket closed');
      this.reconnect();
    });
  }

  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);

    // Exponential backoff
    this.reconnectDelay = Math.min(
      this.reconnectDelay * 2,
      this.maxReconnectDelay
    );
  }

  subscribe(channel, marketId) {
    const subscription = {
      type: 'subscribe',
      channel: channel,
      market_id: marketId
    };
    
    this.subscriptions.push(subscription);
    
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(subscription));
    }
  }

  handleMessage(message) {
    // Your message handling logic
    console.log('Received:', message);
  }
}

// Usage
const ws = new ReconnectingWebSocket('wss://trading.api.thegrid.ai/v1/');
ws.subscribe('ticker', 'market_b310e860-97cd-45eb-bdc3-5be0b79295d0');
ws.subscribe('trades', 'market_b310e860-97cd-45eb-bdc3-5be0b79295d0');
```

**Python Example**:

```python
import time
import websocket

class ReconnectingWebSocket:
    def __init__(self, url):
        self.url = url
        self.reconnect_delay = 1
        self.max_reconnect_delay = 30
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 10
        self.subscriptions = []
        self.ws = None
        
        self.connect()
    
    def connect(self):
        self.ws = websocket.WebSocketApp(
            self.url,
            on_open=self.on_open,
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close
        )
        
        self.ws.run_forever()
    
    def on_open(self, ws):
        print("WebSocket connected")
        self.reconnect_delay = 1
        self.reconnect_attempts = 0
        
        # Resubscribe
        for sub in self.subscriptions:
            ws.send(json.dumps(sub))
    
    def on_message(self, ws, message):
        data = json.loads(message)
        self.handle_message(data)
    
    def on_error(self, ws, error):
        print(f"WebSocket error: {error}")
    
    def on_close(self, ws, close_status_code, close_msg):
        print("WebSocket closed")
        self.reconnect()
    
    def reconnect(self):
        if self.reconnect_attempts >= self.max_reconnect_attempts:
            print("Max reconnect attempts reached")
            return
        
        self.reconnect_attempts += 1
        print(f"Reconnecting in {self.reconnect_delay}s (attempt {self.reconnect_attempts})")
        
        time.sleep(self.reconnect_delay)
        self.reconnect_delay = min(self.reconnect_delay * 2, self.max_reconnect_delay)
        
        self.connect()
    
    def subscribe(self, channel, market_id):
        subscription = {
            'type': 'subscribe',
            'channel': channel,
            'market_id': market_id
        }
        self.subscriptions.append(subscription)
        
        if self.ws and self.ws.sock and self.ws.sock.connected:
            self.ws.send(json.dumps(subscription))
    
    def handle_message(self, message):
        print(f"Received: {message}")
```

## Error Messages

```json
{
  "type": "error",
  "code": "INVALID_CHANNEL",
  "message": "Channel 'invalid_channel' does not exist",
  "timestamp": "2025-01-01T12:34:56.789Z"
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `INVALID_CHANNEL` | Channel name is invalid |
| `INVALID_MARKET` | Market ID not found |
| `SUBSCRIPTION_LIMIT` | Too many subscriptions |
| `RATE_LIMIT` | Message rate exceeded |
| `AUTH_REQUIRED` | Authentication required for private channel |
| `AUTH_FAILED` | Authentication failed |

## Best Practices

1. **Implement reconnection logic** - With exponential backoff
2. **Track subscriptions** - Resubscribe after reconnection
3. **Handle sequence numbers** - Ensure order book updates are in order
4. **Use heartbeats** - Monitor connection health
5. **Limit subscriptions** - Only subscribe to needed channels
6. **Buffer messages** - Queue messages during processing
7. **Validate messages** - Check message format before processing
8. **Monitor connection** - Track latency and message delays
9. **Handle errors gracefully** - Log errors and continue operation
10. **Clean up on disconnect** - Clear state and resources

## Multi-Market Subscriptions

Subscribe to multiple markets efficiently:

```javascript
const markets = [
  'market_b310e860-97cd-45eb-bdc3-5be0b79295d0', // BTC-USD
  'market_c420f971-a8de-56fc-cde4-6cf1c8a306e1'  // ETH-USD
];

ws.on('open', () => {
  markets.forEach(marketId => {
    ws.send(JSON.stringify({
      type: 'subscribe',
      channel: 'ticker',
      market_id: marketId
    }));
  });
});
```

## Performance Considerations

- **Use binary format** - If available (JSON is current default)
- **Throttle UI updates** - Don't update on every message
- **Use workers** - Process messages in background thread
- **Batch updates** - Accumulate and process in chunks
- **Monitor memory** - Clear old data periodically

## Complete Example

```javascript
import WebSocket from 'ws';

class GridMarketData {
  constructor() {
    this.ws = null;
    this.orderBooks = new Map();
    this.subscriptions = [];
  }

  connect() {
    this.ws = new WebSocket('wss://trading.api.thegrid.ai/v1/');

    this.ws.on('open', () => {
      console.log('✓ Connected to GRID WebSocket');
      this.resubscribe();
    });

    this.ws.on('message', (data) => {
      this.handleMessage(JSON.parse(data.toString()));
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    this.ws.on('close', () => {
      console.log('Connection closed, reconnecting...');
      setTimeout(() => this.connect(), 5000);
    });
  }

  subscribe(channel, marketId) {
    const sub = { type: 'subscribe', channel, market_id: marketId };
    this.subscriptions.push(sub);
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(sub));
    }
  }

  resubscribe() {
    this.subscriptions.forEach(sub => {
      this.ws.send(JSON.stringify(sub));
    });
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'ticker':
        console.log(`${msg.symbol}: $${msg.last_price}`);
        break;
      case 'trade':
        console.log(`Trade: ${msg.quantity} @ $${msg.price}`);
        break;
      case 'book_snapshot':
      case 'book_update':
        this.updateOrderBook(msg);
        break;
      case 'heartbeat':
        this.ws.send(JSON.stringify({ type: 'pong' }));
        break;
      case 'error':
        console.error(`Error: ${msg.code} - ${msg.message}`);
        break;
    }
  }

  updateOrderBook(msg) {
    // Order book update logic
  }
}

// Usage
const client = new GridMarketData();
client.connect();
client.subscribe('ticker', 'market_b310e860-97cd-45eb-bdc3-5be0b79295d0');
client.subscribe('trades', 'market_b310e860-97cd-45eb-bdc3-5be0b79295d0');
```

## Private Channels (Authenticated)

Private channels require authentication and provide real-time updates for user-specific data.

### Orders Channel

Subscribe to your order updates.

**Channel**: `orders:<user_id>`

**Subscribe Message**:

```json
{
  "type": "join",
  "channel": "orders",
  "user_id": "user_abc123",
  "_csrf_token": "csrf_token_from_login"
}
```

**Event Types**:
- `new_order` - New order created
- `update_order` - Order status changed

**New Order Message**:

```json
{
  "type": "new_order",
  "data": {
    "id": "order_123",
    "market_id": "market_abc",
    "instrument_id": "instrument_xyz",
    "trader_id": "user_abc123",
    "side": "buy",
    "type": "limit",
    "size": 100,
    "price": "25.50",
    "status": "active",
    "filled_quantity": 0,
    "average_price": null,
    "time_in_force": "gtc",
    "stop_price": null,
    "fee": "0",
    "submitted_at": "2025-12-19T08:45:47.986095Z",
    "closed_at": null,
    "closure_reason": null
  }
}
```

**Update Order Message**:

```json
{
  "type": "update_order",
  "data": {
    "id": "order_456",
    "status": "filled",
    "filled_quantity": 50,
    "average_price": "26.00",
    "closed_at": "2025-12-19T08:46:00Z",
    "closure_reason": null
  }
}
```

**Closure Reasons**:
- `null` - Order still open or filled normally
- `cancelled` - User cancelled
- `partially_filled_no_liquidity` - Partially filled, no more liquidity
- `partially_filled_max_slippage` - Partially filled, hit slippage limit
- `no_fill_no_liquidity` - Not filled, no liquidity
- `no_fill_max_slippage` - Not filled, hit slippage limit

**Example**:

```javascript
// Subscribe to order updates
ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'join',
    channel: 'orders',
    user_id: userId,
    _csrf_token: csrfToken
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.type === 'new_order') {
    console.log(`New ${msg.data.side} order: ${msg.data.size} @ $${msg.data.price}`);
  } else if (msg.type === 'update_order') {
    console.log(`Order ${msg.data.id} updated: ${msg.data.status}`);
    
    if (msg.data.status === 'filled') {
      console.log(`✓ Order filled at avg price: $${msg.data.average_price}`);
    } else if (msg.data.status === 'closed' && msg.data.closure_reason) {
      console.log(`⚠ Order closed: ${msg.data.closure_reason}`);
    }
  }
});
```

### Trades Channel

Subscribe to your trade executions (fills).

**Channel**: `trades:<user_id>`

**Event Types**:
- `new_trade` - Trade executed
- `update_trade` - Trade status updated

**New Trade Message**:

```json
{
  "type": "new_trade",
  "data": {
    "id": "30efc437-43a4-4e41-aeaa-5af24ae3ff64",
    "market_id": "market_abc",
    "instrument_id": "instrument_xyz",
    "price": "25.50",
    "quantity": 100,
    "side": "sell",
    "total_value": "2550.00",
    "fee": null,
    "buyer_order_id": "order_456",
    "seller_order_id": "order_789",
    "buyer_user_id": "user_123",
    "seller_user_id": "user_456",
    "status": "executed",
    "execution_timestamp": "2025-11-05T16:56:39.486421Z",
    "settlement_timestamp": null
  }
}
```

**Update Trade Message**:

```json
{
  "type": "update_trade",
  "data": {
    "id": "31caccc9-3b67-45f5-a6a2-54b807cf4d25",
    "status": "settled",
    "settlement_timestamp": "2025-11-05T16:56:39.475423Z"
  }
}
```

**Example**:

```javascript
ws.send(JSON.stringify({
  type: 'join',
  channel: 'trades',
  user_id: userId,
  _csrf_token: csrfToken
}));

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.type === 'new_trade') {
    const trade = msg.data;
    console.log(`Trade executed: ${trade.quantity} @ $${trade.price}`);
    console.log(`  Total: $${trade.total_value}`);
    console.log(`  Side: ${trade.side}`);
  } else if (msg.type === 'update_trade') {
    console.log(`Trade ${msg.data.id} updated: ${msg.data.status}`);
  }
});
```

### Positions Channel

Subscribe to your position updates.

**Channel**: `positions:<user_id>`

**Event Types**:
- `open_position` - New position opened
- `update_position` - Position updated
- `close_position` - Position closed

**Open Position Message**:

```json
{
  "type": "open_position",
  "data": {
    "id": null,
    "user_account_id": "user_abc123",
    "instrument_id": "instrument_123",
    "instrument_name": null,
    "status": "open",
    "quantity": 100,
    "average_cost": 50.0,
    "total_cost": "5000.0",
    "current_market_value": null,
    "last_trade_price": null,
    "opened_at": null,
    "closed_at": null,
    "inserted_at": null
  }
}
```

**Update Position Message**:

```json
{
  "type": "update_position",
  "data": {
    "id": null,
    "user_account_id": "user_abc123",
    "instrument_id": "instrument_123",
    "status": "open",
    "quantity": 150,
    "average_cost": 55.0,
    "total_cost": "8250.0"
  }
}
```

**Close Position Message**:

```json
{
  "type": "close_position",
  "data": {
    "id": null,
    "user_account_id": "user_abc123",
    "instrument_id": "instrument_123",
    "status": "closed",
    "quantity": 0,
    "closed_at": null
  }
}
```

**Example**:

```javascript
ws.send(JSON.stringify({
  type: 'join',
  channel: 'positions',
  user_id: userId,
  _csrf_token: csrfToken
}));

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  switch (msg.type) {
    case 'open_position':
      console.log(`✓ Opened position: ${msg.data.quantity} units @ avg $${msg.data.average_cost}`);
      break;
    
    case 'update_position':
      console.log(`↻ Position updated: ${msg.data.quantity} units @ avg $${msg.data.average_cost}`);
      break;
    
    case 'close_position':
      console.log(`✗ Position closed: ${msg.data.instrument_id}`);
      break;
  }
});
```

### Trading Account Summaries Channel

Subscribe to balance updates for your trading accounts.

**Channel**: `trading_account_summaries:<user_id>`

**Event Types**:
- `new_trading_account_summary` - New account created
- `update_trading_account_summary` - Account balance changed

**Update Message**:

```json
{
  "type": "update_trading_account_summary",
  "data": {
    "id": "280168f8-1210-479b-9b70-1ed81808a757",
    "user_id": "user_abc123",
    "account_id": "7089aa91-9d38-4179-b224-6ea32e05c08a",
    "market_id": null,
    "instrument_id": null,
    "instrument_name": null,
    "total_balance": "2000.0",
    "available_balance": "1800.0",
    "locked_balance": "0",
    "last_trade_price": null,
    "last_deposit_at": null,
    "last_withdrawal_at": null,
    "last_trading_activity_at": null,
    "status": null,
    "created_at": null,
    "updated_at": null
  }
}
```

**Example**:

```javascript
ws.send(JSON.stringify({
  type: 'join',
  channel: 'trading_account_summaries',
  user_id: userId,
  _csrf_token: csrfToken
}));

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.type === 'update_trading_account_summary') {
    const acct = msg.data;
    console.log(`Account updated: ${acct.account_id}`);
    console.log(`  Total: $${acct.total_balance}`);
    console.log(`  Available: $${acct.available_balance}`);
    console.log(`  Locked: $${acct.locked_balance}`);
  }
});
```

### Consumption Account Updates Channel

Subscribe to consumption account balance changes.

**Channel**: `consumption_account_update:<user_id>`

Real-time updates when you use AI inference credits or transfer instruments.

### Transfer Histories Channel

Subscribe to transfer completion notifications.

**Channel**: `transfer_histories:<user_id>`

Get notified when transfers between accounts complete.

### Public Trades Channel

Subscribe to public trades for a market (no authentication needed).

**Channel**: `public_trades:<market_id>`

**Event Types**:
- `new_trade` - New public trade
- `update_trade` - Trade update

**New Trade Message**:

```json
{
  "type": "new_trade",
  "data": {
    "id": "ab871083-7e6a-4047-afe2-f4920e7a0984",
    "market_id": "market_abc",
    "instrument_id": "instrument_xyz",
    "price": "25.50",
    "quantity": 100,
    "side": null,
    "total_value": "2550.00",
    "buyer_order_id": "order_456",
    "seller_order_id": "order_789",
    "buyer_user_id": "user_123",
    "seller_user_id": "user_456",
    "status": "executed",
    "execution_timestamp": "2025-12-02T13:02:52.364168Z",
    "settlement_timestamp": null,
    "fee": null
  }
}
```

**Example**:

```javascript
// Public channel - no authentication needed
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'public_trades',
  market_id: 'market_b310e860-97cd-45eb-bdc3-5be0b79295d0'
}));

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.type === 'new_trade') {
    console.log(`Public trade: ${msg.data.quantity} @ $${msg.data.price}`);
  }
});
```

## Complete Private Channel Example

```javascript
import WebSocket from 'ws';
import axios from 'axios';

class GridPrivateWebSocket {
  constructor(email, password) {
    this.email = email;
    this.password = password;
    this.ws = null;
    this.userId = null;
    this.csrfToken = null;
  }
  
  async authenticate() {
    // Login to get session cookie
    const response = await axios.post(
      'https://trading.api.thegrid.ai/v1/users/log-in',
      {
        user: {
          email: this.email,
          password: this.password
        }
      }
    );
    
    this.userId = response.data.data.id;
    
    // Extract session cookie
    const cookies = response.headers['set-cookie'];
    this.sessionCookie = cookies.find(c => c.startsWith('_exchange_key='));
    
    // Extract CSRF token (if needed)
    this.csrfToken = this.extractCsrfToken(this.sessionCookie);
    
    console.log(`✓ Authenticated as ${this.email}`);
    console.log(`  User ID: ${this.userId}`);
  }
  
  extractCsrfToken(cookie) {
    // CSRF token may be in cookie or separate - adjust as needed
    return 'csrf_token_here';
  }
  
  connect() {
    this.ws = new WebSocket('wss://trading.api.thegrid.ai/v1/', {
      headers: {
        Cookie: this.sessionCookie
      }
    });
    
    this.ws.on('open', () => {
      console.log('✓ WebSocket connected');
      this.subscribeToChannels();
    });
    
    this.ws.on('message', (data) => {
      this.handleMessage(JSON.parse(data.toString()));
    });
    
    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
    
    this.ws.on('close', () => {
      console.log('WebSocket closed');
    });
  }
  
  subscribeToChannels() {
    // Subscribe to orders
    this.ws.send(JSON.stringify({
      type: 'join',
      channel: 'orders',
      user_id: this.userId,
      _csrf_token: this.csrfToken
    }));
    
    // Subscribe to trades
    this.ws.send(JSON.stringify({
      type: 'join',
      channel: 'trades',
      user_id: this.userId,
      _csrf_token: this.csrfToken
    }));
    
    // Subscribe to positions
    this.ws.send(JSON.stringify({
      type: 'join',
      channel: 'positions',
      user_id: this.userId,
      _csrf_token: this.csrfToken
    }));
    
    // Subscribe to account balances
    this.ws.send(JSON.stringify({
      type: 'join',
      channel: 'trading_account_summaries',
      user_id: this.userId,
      _csrf_token: this.csrfToken
    }));
    
    console.log('✓ Subscribed to private channels');
  }
  
  handleMessage(msg) {
    switch (msg.type) {
      case 'new_order':
        console.log(`📝 New order: ${msg.data.side} ${msg.data.size} @ $${msg.data.price}`);
        break;
      
      case 'update_order':
        console.log(`🔄 Order ${msg.data.id}: ${msg.data.status}`);
        if (msg.data.status === 'filled') {
          console.log(`  ✓ Filled at avg: $${msg.data.average_price}`);
        }
        break;
      
      case 'new_trade':
        console.log(`💰 Trade executed: ${msg.data.quantity} @ $${msg.data.price}`);
        console.log(`  Total: $${msg.data.total_value}`);
        break;
      
      case 'update_trade':
        if (msg.data.status === 'settled') {
          console.log(`✓ Trade ${msg.data.id} settled`);
        }
        break;
      
      case 'open_position':
        console.log(`📈 Position opened: ${msg.data.quantity} units @ $${msg.data.average_cost}`);
        break;
      
      case 'update_position':
        console.log(`📊 Position updated: ${msg.data.quantity} units @ $${msg.data.average_cost}`);
        break;
      
      case 'close_position':
        console.log(`📉 Position closed`);
        break;
      
      case 'update_trading_account_summary':
        console.log(`💵 Balance updated: $${msg.data.available_balance} available`);
        break;
      
      case 'heartbeat':
        // Respond to heartbeat
        this.ws.send(JSON.stringify({
          type: 'pong',
          timestamp: new Date().toISOString()
        }));
        break;
    }
  }
  
  async start() {
    await this.authenticate();
    this.connect();
  }
}

// Usage
const client = new GridPrivateWebSocket('user@example.com', 'SecurePassword123!');
await client.start();

// Keep process running
process.stdin.resume();
```

## Python Private Channels Example

```python
import websocket
import json
import requests
import threading

class GridPrivateWebSocket:
    def __init__(self, email, password):
        self.email = email
        self.password = password
        self.ws = None
        self.user_id = None
        self.session_cookie = None
        self.csrf_token = None
    
    def authenticate(self):
        """Login and get session cookie"""
        response = requests.post(
            'https://trading.api.thegrid.ai/v1/users/log-in',
            json={
                'user': {
                    'email': self.email,
                    'password': self.password
                }
            }
        )
        response.raise_for_status()
        
        self.user_id = response.json()['data']['id']
        self.session_cookie = response.cookies.get('_exchange_key')
        
        print(f"✓ Authenticated as {self.email}")
        print(f"  User ID: {self.user_id}")
    
    def on_open(self, ws):
        print("✓ WebSocket connected")
        self.subscribe_to_channels()
    
    def on_message(self, ws, message):
        msg = json.loads(message)
        
        if msg['type'] == 'new_order':
            print(f"📝 New order: {msg['data']['side']} {msg['data']['size']} @ ${msg['data']['price']}")
        
        elif msg['type'] == 'update_order':
            print(f"🔄 Order {msg['data']['id']}: {msg['data']['status']}")
        
        elif msg['type'] == 'new_trade':
            trade = msg['data']
            print(f"💰 Trade: {trade['quantity']} @ ${trade['price']} = ${trade['total_value']}")
        
        elif msg['type'] == 'open_position':
            print(f"📈 Position opened: {msg['data']['quantity']} units")
        
        elif msg['type'] == 'update_trading_account_summary':
            acct = msg['data']
            print(f"💵 Balance: ${acct['available_balance']} available")
        
        elif msg['type'] == 'heartbeat':
            ws.send(json.dumps({'type': 'pong'}))
    
    def on_error(self, ws, error):
        print(f"WebSocket error: {error}")
    
    def on_close(self, ws, close_status_code, close_msg):
        print("WebSocket closed")
    
    def subscribe_to_channels(self):
        """Subscribe to private channels"""
        channels = [
            {'type': 'join', 'channel': 'orders', 'user_id': self.user_id, '_csrf_token': self.csrf_token},
            {'type': 'join', 'channel': 'trades', 'user_id': self.user_id, '_csrf_token': self.csrf_token},
            {'type': 'join', 'channel': 'positions', 'user_id': self.user_id, '_csrf_token': self.csrf_token},
            {'type': 'join', 'channel': 'trading_account_summaries', 'user_id': self.user_id, '_csrf_token': self.csrf_token}
        ]
        
        for channel_msg in channels:
            self.ws.send(json.dumps(channel_msg))
        
        print("✓ Subscribed to private channels")
    
    def connect(self):
        """Connect WebSocket with session cookie"""
        cookie_header = f"_exchange_key={self.session_cookie}"
        
        self.ws = websocket.WebSocketApp(
            'wss://trading.api.thegrid.ai/v1/',
            header=[f'Cookie: {cookie_header}'],
            on_open=self.on_open,
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close
        )
        
        # Run in thread
        wst = threading.Thread(target=self.ws.run_forever)
        wst.daemon = True
        wst.start()
    
    def start(self):
        """Authenticate and connect"""
        self.authenticate()
        self.connect()

# Usage
client = GridPrivateWebSocket('user@example.com', 'SecurePassword123!')
client.start()

# Keep running
import time
while True:
    time.sleep(1)
```

