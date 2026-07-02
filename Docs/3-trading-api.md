# Trading API

The Trading API provides endpoints for placing orders, viewing markets, managing positions, and accessing trade history.

## Authentication

All Trading API endpoints require **Ed25519 signature authentication**. See [API Overview](./1-overview.md#authentication) for implementation details.

## Markets

### List All Instruments

**`GET /trading/markets`**

Retrieve all available trading instruments.

**Response**:

```json
{
  "data": [
    {
      "id": "market_b310e860-97cd-45eb-bdc3-5be0b79295d0",
      "symbol": "BTC-USD",
      "base_currency": "BTC",
      "quote_currency": "USD",
      "min_order_size": "0.001",
      "max_order_size": "1000",
      "price_increment": "0.01",
      "size_increment": "0.0001",
      "status": "active",
      "created_at": "2025-01-01T00:00:00Z"
    },
    {
      "id": "market_c420f971-a8de-56fc-cde4-6cf1c8a306e1",
      "symbol": "ETH-USD",
      "base_currency": "ETH",
      "quote_currency": "USD",
      "min_order_size": "0.01",
      "max_order_size": "10000",
      "price_increment": "0.01",
      "size_increment": "0.001",
      "status": "active",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

**Example (JavaScript/TypeScript)**:

```javascript
import axios from 'axios';
import { SignatureAuth } from './auth';

async function getMarkets(privateKey, publicKey) {
  const auth = new SignatureAuth(privateKey, publicKey);
  const method = 'GET';
  const path = '/api/v1/trading/markets';
  
  const headers = auth.getHeaders(method, path, '');
  
  const response = await axios.get(
    'https://trading.api.thegrid.ai/v1/trading/markets',
    {
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }
  );
  
  return response.data.data;
}

// Usage
const markets = await getMarkets(privateKey, publicKey);
markets.forEach(market => {
  console.log(`${market.symbol}: ${market.id}`);
});
```

**Example (Python)**:

```python
import requests
from auth import SignatureAuth

def get_markets(private_key, public_key):
    auth = SignatureAuth(private_key, public_key)
    method = 'GET'
    path = '/api/v1/trading/markets'
    
    headers = auth.get_headers(method, path, '')
    headers['Content-Type'] = 'application/json'
    
    response = requests.get(
        'https://trading.api.thegrid.ai/v1/trading/markets',
        headers=headers
    )
    
    response.raise_for_status()
    return response.json()['data']

# Usage
markets = get_markets(private_key, public_key)
for market in markets:
    print(f"{market['symbol']}: {market['id']}")
```

### Get Market Details

**`GET /trading/markets/{market_id}`**

Get detailed information about a specific market.

**Response**:

```json
{
  "data": {
    "id": "market_b310e860-97cd-45eb-bdc3-5be0b79295d0",
    "symbol": "BTC-USD",
    "base_currency": "BTC",
    "quote_currency": "USD",
    "min_order_size": "0.001",
    "max_order_size": "1000",
    "price_increment": "0.01",
    "size_increment": "0.0001",
    "status": "active",
    "trading_hours": "24/7",
    "settlement": "T+0",
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

### Get Market Ticker

**`GET /trading/markets/{market_id}/ticker`**

Get current ticker data for a market.

**Response**:

```json
{
  "data": {
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
    "timestamp": "2025-01-01T12:34:56Z"
  }
}
```

**Example**:

```javascript
async function getTicker(marketId) {
  const path = `/api/v1/trading/markets/${marketId}/ticker`;
  const headers = auth.getHeaders('GET', path, '');
  
  const response = await axios.get(
    `https://trading.api.thegrid.ai${path}`,
    { headers }
  );
  
  return response.data.data;
}

const ticker = await getTicker('market_b310e860-97cd-45eb-bdc3-5be0b79295d0');
console.log(`BTC-USD: $${ticker.last_price} (24h: ${ticker.price_change_percent_24h}%)`);
```

### Get Order Book

**`GET /trading/markets/{market_id}/orderbook?depth={depth}`**

Retrieve the current order book for a market.

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `depth` | integer | No | 20 | Number of price levels to return (max: 100) |

**Response**:

```json
{
  "data": {
    "market_id": "market_b310e860-97cd-45eb-bdc3-5be0b79295d0",
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
    "timestamp": "2025-01-01T12:34:56Z"
  }
}
```

**Example**:

```javascript
async function getOrderBook(marketId, depth = 20) {
  const path = `/api/v1/trading/markets/${marketId}/orderbook`;
  const headers = auth.getHeaders('GET', path, '');
  
  const response = await axios.get(
    `https://trading.api.thegrid.ai${path}`,
    {
      params: { depth },
      headers
    }
  );
  
  return response.data.data;
}

const book = await getOrderBook('market_b310e860-97cd-45eb-bdc3-5be0b79295d0', 10);
console.log('Best Bid:', book.bids[0]);
console.log('Best Ask:', book.asks[0]);
```

### Get Market Trades

**`GET /trading/markets/{market_id}/trades?limit={limit}`**

Get recent public trades for a market.

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | integer | No | 50 | Number of trades to return (max: 100) |

**Response**:

```json
{
  "data": [
    {
      "trade_id": "trade_abc123",
      "market_id": "market_b310e860-97cd-45eb-bdc3-5be0b79295d0",
      "price": "45123.50",
      "quantity": "0.125",
      "side": "buy",
      "timestamp": "2025-01-01T12:34:56.789Z"
    }
  ]
}
```

## Orders

### Place Order

**`POST /trading/orders`**

Create a new order.

**Request Body**:

```json
{
  "market_id": "market_b310e860-97cd-45eb-bdc3-5be0b79295d0",
  "side": "buy",
  "type": "limit",
  "quantity": "0.01",
  "price": "45000.00",
  "time_in_force": "gtc"
}
```

**Request Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `market_id` | string | Yes | Market identifier |
| `side` | string | Yes | Order side: `buy` or `sell` |
| `type` | string | Yes | Order type: `limit`, `market`, `stop_limit` |
| `quantity` | string | Yes | Order quantity (decimal string) |
| `price` | string | Conditional | Limit price (required for `limit` and `stop_limit`) |
| `stop_price` | string | Conditional | Stop trigger price (required for `stop_limit`) |
| `time_in_force` | string | No | `gtc` (default), `ioc`, `fok`, `day` |
| `client_order_id` | string | No | Client-specified order ID for idempotency |

**Response**:

```json
{
  "data": {
    "order_id": "order_def456",
    "client_order_id": "my-order-123",
    "market_id": "market_b310e860-97cd-45eb-bdc3-5be0b79295d0",
    "side": "buy",
    "type": "limit",
    "quantity": "0.01",
    "price": "45000.00",
    "filled_quantity": "0",
    "remaining_quantity": "0.01",
    "status": "open",
    "time_in_force": "gtc",
    "created_at": "2025-01-01T12:34:56Z",
    "updated_at": "2025-01-01T12:34:56Z"
  }
}
```

**Example (JavaScript/TypeScript)**:

```javascript
async function placeOrder(orderParams) {
  const path = '/api/v1/trading/orders';
  const body = JSON.stringify(orderParams);
  const headers = auth.getHeaders('POST', path, body);
  
  const response = await axios.post(
    `https://trading.api.thegrid.ai${path}`,
    orderParams,
    {
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }
  );
  
  return response.data.data;
}

// Place a limit buy order
const order = await placeOrder({
  market_id: 'market_b310e860-97cd-45eb-bdc3-5be0b79295d0',
  side: 'buy',
  type: 'limit',
  quantity: '0.01',
  price: '45000.00',
  time_in_force: 'gtc',
  client_order_id: `order-${Date.now()}`
});

console.log(`Order placed: ${order.order_id}`);
```

**Example (Python)**:

```python
def place_order(auth, order_params):
    path = '/api/v1/trading/orders'
    body = json.dumps(order_params)
    headers = auth.get_headers('POST', path, body)
    headers['Content-Type'] = 'application/json'
    
    response = requests.post(
        f'https://trading.api.thegrid.ai{path}',
        json=order_params,
        headers=headers
    )
    
    response.raise_for_status()
    return response.json()['data']

# Place a limit sell order
order = place_order(auth, {
    'market_id': 'market_b310e860-97cd-45eb-bdc3-5be0b79295d0',
    'side': 'sell',
    'type': 'limit',
    'quantity': '0.01',
    'price': '46000.00',
    'time_in_force': 'gtc'
})

print(f"Order placed: {order['order_id']}")
```

### List Orders

**`GET /trading/orders?status={status}&market_id={market_id}&limit={limit}`**

List your orders with optional filters.

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `status` | string | No | all | Filter by status: `open`, `filled`, `cancelled`, `all` |
| `market_id` | string | No | - | Filter by market |
| `limit` | integer | No | 50 | Results per page (max: 100) |
| `offset` | integer | No | 0 | Pagination offset |

**Response**:

```json
{
  "data": [
    {
      "order_id": "order_def456",
      "market_id": "market_b310e860-97cd-45eb-bdc3-5be0b79295d0",
      "symbol": "BTC-USD",
      "side": "buy",
      "type": "limit",
      "quantity": "0.01",
      "price": "45000.00",
      "filled_quantity": "0.005",
      "remaining_quantity": "0.005",
      "status": "partially_filled",
      "created_at": "2025-01-01T12:34:56Z",
      "updated_at": "2025-01-01T12:35:10Z"
    }
  ],
  "meta": {
    "pagination": {
      "limit": 50,
      "offset": 0,
      "total": 1
    }
  }
}
```

**Example**:

```javascript
async function listOrders(filters = {}) {
  const path = '/api/v1/trading/orders';
  const headers = auth.getHeaders('GET', path, '');
  
  const response = await axios.get(
    `https://trading.api.thegrid.ai${path}`,
    {
      params: filters,
      headers
    }
  );
  
  return response.data.data;
}

// List all open orders
const openOrders = await listOrders({ status: 'open' });
console.log(`You have ${openOrders.length} open orders`);
```

### Get Order Details

**`GET /trading/orders/{order_id}`**

Get detailed information about a specific order.

**Response**:

```json
{
  "data": {
    "order_id": "order_def456",
    "client_order_id": "my-order-123",
    "market_id": "market_b310e860-97cd-45eb-bdc3-5be0b79295d0",
    "symbol": "BTC-USD",
    "side": "buy",
    "type": "limit",
    "quantity": "0.01",
    "price": "45000.00",
    "filled_quantity": "0.01",
    "remaining_quantity": "0",
    "average_fill_price": "45000.50",
    "status": "filled",
    "time_in_force": "gtc",
    "created_at": "2025-01-01T12:34:56Z",
    "updated_at": "2025-01-01T12:35:10Z",
    "fills": [
      {
        "trade_id": "trade_xyz789",
        "quantity": "0.01",
        "price": "45000.50",
        "fee": "0.45",
        "timestamp": "2025-01-01T12:35:10Z"
      }
    ]
  }
}
```

### Cancel Order

**`DELETE /trading/orders/{order_id}`**

Cancel an existing order.

**Response**:

```json
{
  "data": {
    "order_id": "order_def456",
    "status": "cancelled",
    "cancelled_at": "2025-01-01T12:36:00Z"
  }
}
```

**Example**:

```javascript
async function cancelOrder(orderId) {
  const path = `/api/v1/trading/orders/${orderId}`;
  const headers = auth.getHeaders('DELETE', path, '');
  
  const response = await axios.delete(
    `https://trading.api.thegrid.ai${path}`,
    { headers }
  );
  
  return response.data.data;
}

const result = await cancelOrder('order_def456');
console.log(`Order ${result.order_id} cancelled`);
```

### Update Order

**`PUT /api/v1/orders/{order_id}`**

Update an existing order's parameters.

**Request Body**:

```json
{
  "price": "45500.00",
  "quantity": 200,
  "time_in_force": "ioc"
}
```

**Request Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `price` | string | No | New limit price |
| `quantity` | integer | No | New quantity |
| `time_in_force` | string | No | New time in force (gtc, ioc, fok, gtd) |

**Response**:

```json
{
  "message": "Order update accepted",
  "order_id": "order_def456"
}
```

**Status Code**: `202 Accepted` (updates are processed asynchronously)

**Example**:

```javascript
async function updateOrder(orderId, updates) {
  const path = `/api/v1/orders/${orderId}`;
  const body = JSON.stringify(updates);
  const headers = auth.getHeaders('PUT', path, body);
  
  const response = await axios.put(
    `https://trading.api.thegrid.ai${path}`,
    updates,
    {
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }
  );
  
  return response.data;
}

// Update order price
const result = await updateOrder('order_def456', {
  price: '46000.00'
});

console.log(result.message);
```

## Fills (Trade History)

### List User Fills

**`GET /trading/trades?market_id={market_id}&limit={limit}`**

Get your trade history (fills).

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `market_id` | string | No | - | Filter by market |
| `start_date` | string | No | - | ISO 8601 start date |
| `end_date` | string | No | - | ISO 8601 end date |
| `limit` | integer | No | 50 | Results per page |
| `offset` | integer | No | 0 | Pagination offset |

**Response**:

```json
{
  "data": [
    {
      "trade_id": "trade_xyz789",
      "order_id": "order_def456",
      "market_id": "market_b310e860-97cd-45eb-bdc3-5be0b79295d0",
      "symbol": "BTC-USD",
      "side": "buy",
      "quantity": "0.01",
      "price": "45000.50",
      "fee": "0.45",
      "fee_currency": "USD",
      "role": "taker",
      "timestamp": "2025-01-01T12:35:10Z"
    }
  ]
}
```

**Example**:

```javascript
async function getTrades(filters = {}) {
  const path = '/api/v1/trading/trades';
  const headers = auth.getHeaders('GET', path, '');
  
  const response = await axios.get(
    `https://trading.api.thegrid.ai${path}`,
    {
      params: filters,
      headers
    }
  );
  
  return response.data.data;
}

const trades = await getTrades({ 
  market_id: 'market_b310e860-97cd-45eb-bdc3-5be0b79295d0',
  limit: 100 
});

const totalVolume = trades.reduce((sum, t) => sum + parseFloat(t.quantity), 0);
console.log(`Total volume: ${totalVolume} BTC`);
```

### Get Trade Details

**`GET /trading/trades/{trade_id}`**

Get details of a specific trade.

**Response**: Same structure as individual trade object above.

## Market Statistics

### Get 24-Hour Market Stats

**`GET /api/v1/markets/{market_id}/stats`**

Get 24-hour trading statistics for a market.

**Response**:

```json
{
  "data": {
    "current_price": "145.00000000",
    "price_change_24h": "34.00000000",
    "price_change_24h_percent": "30.63",
    "high_24h": "235.00000000",
    "low_24h": "100.00000000",
    "volume_24h": 500,
    "volume_24h_tokens": "1000000",
    "volume_24h_value": "84300.00000000"
  }
}
```

**Field Descriptions**:

| Field | Type | Description |
|-------|------|-------------|
| `current_price` | string | Most recent trade price |
| `price_change_24h` | string | Absolute price change in 24h |
| `price_change_24h_percent` | string | Percentage price change in 24h |
| `high_24h` | string | Highest price in last 24 hours |
| `low_24h` | string | Lowest price in last 24 hours |
| `volume_24h` | integer | Number of units traded in 24h |
| `volume_24h_tokens` | string | Token volume in 24h (for AI commodities) |
| `volume_24h_value` | string | Total value traded in 24h |

**Example**:

```javascript
async function getMarketStats(marketId) {
  const path = `/api/v1/markets/${marketId}/stats`;
  const headers = auth.getHeaders('GET', path, '');
  
  const response = await axios.get(
    `https://trading.api.thegrid.ai${path}`,
    { headers }
  );
  
  return response.data.data;
}

const stats = await getMarketStats('market_b310e860-97cd-45eb-bdc3-5be0b79295d0');

console.log(`Current Price: $${stats.current_price}`);
console.log(`24h Change: ${stats.price_change_24h_percent}%`);
console.log(`24h High: $${stats.high_24h}`);
console.log(`24h Low: $${stats.low_24h}`);
console.log(`24h Volume: ${stats.volume_24h} units ($${stats.volume_24h_value})`);
```

## Public Trades

### Get Public Trades

**`GET /api/v1/public_trades`**

Get recent public trades across all markets (no authentication required).

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filters[n][field]` | string | No | Field to filter on |
| `filters[n][value]` | string | No | Filter value |
| `order_by[]` | string | No | Sort field |
| `order_directions[]` | string | No | Sort direction (asc, desc) |
| `page_size` | integer | No | Results per page (default: 50) |

**Available Filters**: `market_id`, `instrument_id`, `status`, `execution_timestamp`, `settlement_timestamp`

**Response**:

```json
{
  "data": [
    {
      "id": "81d1370b-82ea-4509-a4c9-752986de37e4",
      "market_id": "market_public_trades1",
      "market_name": "Public Trades Market 1",
      "instrument_id": "instrument_test-ai-60209",
      "instrument_name": "GPT-4 Public Model",
      "instrument_symbol": "GPT-PUBLIC",
      "price": "45.50000000",
      "quantity": 1000,
      "side": "buy",
      "total_value": "45500.00000000",
      "status": "executed",
      "execution_timestamp": "2025-12-23T02:25:55.659961Z",
      "settlement_timestamp": "2025-12-23T02:25:55.659961Z"
    }
  ],
  "meta": {
    "total_count": 1,
    "current_page": 1,
    "page_size": 50
  }
}
```

**Note**: Public trades **do not** include buyer/seller user IDs or order IDs for privacy.

**Example**:

```javascript
async function getPublicTrades(marketId, limit = 50) {
  const params = {
    'filters[0][field]': 'market_id',
    'filters[0][value]': marketId,
    'order_by[]': 'execution_timestamp',
    'order_directions[]': 'desc',
    'page_size': limit
  };
  
  const response = await axios.get(
    'https://trading.api.thegrid.ai/v1/public_trades',
    { params }
  );
  
  return response.data.data;
}

// Get recent public trades
const trades = await getPublicTrades('market_abc', 20);

console.log('Recent public trades:');
trades.forEach(trade => {
  const arrow = trade.side === 'buy' ? '🟢' : '🔴';
  console.log(`${arrow} ${trade.quantity} @ $${trade.price} - ${trade.execution_timestamp}`);
});
```

## Get Single Trade

### Get Trade Details

**`GET /api/v1/trading/trades/{trade_id}`**

Get detailed information about a specific trade.

**Response**:

```json
{
  "data": {
    "trade_id": "trade-show-123",
    "id": "d9dcb544-02a2-4637-880c-13d50d61fb42",
    "market_id": "market_show",
    "market_name": "Show Market",
    "instrument_id": "instrument_show",
    "instrument_name": "Test Instrument",
    "instrument_symbol": "GPT-SHOW",
    "price": "99.99000000",
    "quantity": 500,
    "side": "buy",
    "total_value": "45500.00000000",
    "fee": "0.025",
    "status": "executed",
    "order_id": "test-buyer-order-8",
    "trading_account_id": "acct-show-123",
    "execution_timestamp": "2025-12-05T17:29:29.887434Z",
    "settlement_timestamp": "2025-12-05T17:29:29.887436Z"
  }
}
```

**Example**:

```javascript
async function getTrade(tradeId) {
  const path = `/api/v1/trading/trades/${tradeId}`;
  const headers = auth.getHeaders('GET', path, '');
  
  const response = await axios.get(
    `https://trading.api.thegrid.ai${path}`,
    { headers }
  );
  
  return response.data.data;
}

const trade = await getTrade('trade_xyz789');
console.log(`Trade: ${trade.quantity} ${trade.instrument_symbol} @ $${trade.price}`);
console.log(`Total: $${trade.total_value}, Fee: $${trade.fee}`);
```

## Transfers and Sweeps

For transferring funds between trading and consumption accounts, see [Transfers and Issuance API](./11-transfers-and-issuance-api.md).

## Errors and Rate Limits

### Common Errors

| Error Code | Description |
|------------|-------------|
| `INVALID_MARKET` | Market ID not found or inactive |
| `INVALID_QUANTITY` | Quantity outside allowed range |
| `INVALID_PRICE` | Price outside allowed range or invalid increment |
| `INSUFFICIENT_BALANCE` | Not enough funds to place order |
| `ORDER_NOT_FOUND` | Order ID not found |
| `ORDER_NOT_CANCELLABLE` | Order already filled or cancelled |
| `MARKET_CLOSED` | Market is not currently trading |
| `DUPLICATE_CLIENT_ORDER_ID` | Client order ID already used |

### Rate Limits

- **General Trading API**: 100 requests/minute
- **Order Placement**: 50 orders/minute
- **Order Cancellation**: 100 cancels/minute

## Best Practices

1. **Use client_order_id** - For idempotent order placement
2. **Check order status** - Before attempting to cancel
3. **Monitor fills** - Use WebSocket for real-time updates
4. **Validate parameters** - Check min/max sizes and price increments
5. **Handle errors gracefully** - Implement retry logic for network errors
6. **Use limit orders** - For better price control
7. **Track balances** - Before placing orders
8. **Cancel stale orders** - Clean up old open orders regularly

