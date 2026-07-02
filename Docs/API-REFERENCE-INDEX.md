# GRID API Reference Index

Quick reference index of all available API endpoints.

## Base URLs

| Environment | URL |
|------------|-----|
| Production | `https://trading.api.thegrid.ai/api/v1` |
| Development | `https://trading.api.thegrid.ai/v1` |
| WebSocket | `wss://trading.api.thegrid.ai/v1/` |

## Authentication

| Method | Used By |
|--------|---------|
| Ed25519 Signature | Trading API, Accounts API |
| API Key (`Authorization: Bearer`) | Consumption API |
| Session Cookie | WebSocket private channels, User management |

## Trading API

| Endpoint | Method | Auth | Description | Docs |
|----------|--------|------|-------------|------|
| `/trading/markets` | GET | ✅ | List markets | [Trading](./3-trading-api.md#list-all-instruments) |
| `/trading/markets/:id` | GET | ✅ | Get market details | [Trading](./3-trading-api.md#get-market-details) |
| `/trading/markets/:id/ticker` | GET | ✅ | Get ticker data | [Trading](./3-trading-api.md#get-market-ticker) |
| `/trading/markets/:id/orderbook` | GET | ✅ | Get order book | [Trading](./3-trading-api.md#get-order-book) |
| `/trading/markets/:id/trades` | GET | ✅ | Get market trades | [Trading](./3-trading-api.md#get-market-trades) |
| `/trading/orders` | GET | ✅ | List orders | [Trading](./3-trading-api.md#list-orders) |
| `/trading/orders` | POST | ✅ | Place order | [Trading](./3-trading-api.md#place-order) |
| `/trading/orders/:id` | GET | ✅ | Get order details | [Trading](./3-trading-api.md#get-order-details) |
| `/trading/orders/:id` | PUT | ✅ | Update order | [Trading](./3-trading-api.md#update-order) |
| `/trading/orders/:id` | DELETE | ✅ | Cancel order | [Trading](./3-trading-api.md#cancel-order) |
| `/trading/trades` | GET | ✅ | List user trades | [Trading](./3-trading-api.md#list-user-fills) |
| `/trading/trades/:id` | GET | ✅ | Get trade details | [Trading](./3-trading-api.md#get-single-trade) |
| `/trading/trading-accounts` | GET | ✅ | Get trading accounts | [Accounts](./4-accounts-usage-api.md#get-trading-balances) |
| `/trading/trading-accounts/:id` | GET | ✅ | Get account details | [Accounts](./4-accounts-usage-api.md#get-specific-trading-account) |
| `/trading/currency-trading-accounts` | GET | ✅ | Get currency accounts | [Accounts](./4-accounts-usage-api.md#get-currency-trading-accounts) |
| `/trading/currency-trading-accounts/:id` | GET | ✅ | Get currency account | [Accounts](./4-accounts-usage-api.md) |
| `/trading/issuance-accounts` | GET | ✅ | List issuance accounts | [Transfers](./11-transfers-and-issuance-api.md#list-issuance-accounts) |
| `/trading/issuance-accounts/transfer` | POST | ✅ | Transfer from issuance | [Transfers](./11-transfers-and-issuance-api.md#transfer-from-issuance-to-trading) |

## Market Data API

| Endpoint | Method | Auth | Description | Docs |
|----------|--------|------|-------------|------|
| `/markets` | GET | ❌ | List all markets | [Trading](./3-trading-api.md) |
| `/markets/:id` | GET | ❌ | Get market details | [Trading](./3-trading-api.md) |
| `/markets/:id/stats` | GET | ❌ | Get 24h statistics | [Trading](./3-trading-api.md#market-statistics) |
| `/public_trades` | GET | ❌ | Get public trades | [Trading](./3-trading-api.md#public-trades) |

## Positions API

| Endpoint | Method | Auth | Description | Docs |
|----------|--------|------|-------------|------|
| `/positions` | GET | ✅ | List positions | [Positions](./6-positions-api.md) |

## Price History API

| Endpoint | Method | Auth | Description | Docs |
|----------|--------|------|-------------|------|
| `/price_histories` | GET | ❌ | Get OHLCV candles | [Price History](./7-price-history-api.md) |

## Instruments API

| Endpoint | Method | Auth | Description | Docs |
|----------|--------|------|-------------|------|
| `/instruments` | GET | ❌ | List instruments | [Instruments](./8-instruments-api.md#list-all-instruments) |
| `/instruments/:id` | GET | ❌ | Get instrument by ID | [Instruments](./8-instruments-api.md#get-instrument-by-id) |
| `/instruments/by-symbol/:symbol` | GET | ❌ | Get instrument by symbol | [Instruments](./8-instruments-api.md#get-instrument-by-symbol) |

## Accounts API

| Endpoint | Method | Auth | Description | Docs |
|----------|--------|------|-------------|------|
| `/self/accounts/instruments` | GET | ✅ | Get instrument accounts | [Accounts](./4-accounts-usage-api.md#get-instrument-trading-accounts) |
| `/self/accounts/currencies/:currency` | GET | ✅ | Get currency account | [Accounts](./4-accounts-usage-api.md#get-specific-currency-account) |

## Consumption API

| Endpoint | Method | Auth | Description | Docs |
|----------|--------|------|-------------|------|
| `/consumption/chat` | POST | API Key | AI chat completion | [Consumption](./2-consumption-api.md#chat-endpoint) |
| `/consumption/instruments` | GET | ✅ | Get consumption balances | [Accounts](./4-accounts-usage-api.md#get-consumption-instruments) |

## Transfers API

| Endpoint | Method | Auth | Description | Docs |
|----------|--------|------|-------------|------|
| `/transfers/trading-to-consumption` | POST | ✅ | Transfer to consumption | [Transfers](./11-transfers-and-issuance-api.md#trading-to-consumption) |
| `/transfers/consumption-to-trading` | POST | ✅ | Transfer to trading | [Transfers](./11-transfers-and-issuance-api.md#consumption-to-trading) |
| `/transfers/histories` | GET | ✅ | Transfer history | [Transfers](./11-transfers-and-issuance-api.md#get-transfer-history) |

## User Management API

| Endpoint | Method | Auth | Description | Docs |
|----------|--------|------|-------------|------|
| `/users/register` | POST | ❌ | Register new user | [User](./9-user-management-api.md#register-new-user) |
| `/users/log-in` | POST | ❌ | Login with password | [User](./9-user-management-api.md#login) |
| `/users/log-out` | DELETE | Session | Logout | [User](./9-user-management-api.md#logout) |
| `/users/self` | GET | ✅ | Get current user | [User](./9-user-management-api.md#get-current-user) |
| `/users/verify-email/:token` | GET | ❌ | Verify email | [User](./9-user-management-api.md#verify-email) |
| `/users/resend-verification` | POST | Session | Resend verification | [User](./9-user-management-api.md#resend-verification-email) |
| `/users/accept-terms-and-privacy` | POST | ✅ | Accept legal docs | [User](./9-user-management-api.md#accept-terms-and-privacy-policy) |
| `/users/settings/name` | PUT | ✅ | Update name | [User](./9-user-management-api.md#update-user-name) |
| `/users/settings/password` | PUT | ✅ | Set password | [User](./9-user-management-api.md#set-password-oauth-users) |
| `/users/settings` | PUT | ✅ | Change password | [User](./9-user-management-api.md#change-password-existing-users) |
| `/users/reset-password` | POST | ❌ | Request reset | [User](./9-user-management-api.md#reset-password-forgot-password) |
| `/users/reset-password/verify` | POST | ❌ | Verify reset token | [User](./9-user-management-api.md#reset-password-forgot-password) |
| `/users/reset-password` | PUT | ❌ | Complete reset | [User](./9-user-management-api.md#reset-password-forgot-password) |

## OAuth API

| Endpoint | Method | Auth | Description | Docs |
|----------|--------|------|-------------|------|
| `/auth/:provider` | GET | ❌ | Initiate OAuth | [User](./9-user-management-api.md#initiate-oauth-flow) |
| `/auth/:provider/callback` | GET | ❌ | OAuth callback | [User](./9-user-management-api.md#oauth-callback) |

**Supported Providers**: `github`, `google`

## Key Management API

| Endpoint | Method | Auth | Description | Docs |
|----------|--------|------|-------------|------|
| `/api-keys` | GET | ✅ | List API keys | [Keys](./10-key-management-api.md#list-api-keys) |
| `/api-keys/:id` | GET | ✅ | Get API key | [Keys](./10-key-management-api.md#get-api-key) |
| `/api-keys` | POST | ✅ | Create API key | [Keys](./10-key-management-api.md#create-api-key) |
| `/api-keys/:id` | PUT | ✅ | Update API key | [Keys](./10-key-management-api.md#update-api-key) |
| `/api-keys/:id` | DELETE | ✅ | Delete API key | [Keys](./10-key-management-api.md#delete-api-key) |
| `/signing-keys` | POST | ✅ | Register signing key | [Keys](./10-key-management-api.md#register-signing-key) |
| `/signing-keys/:id` | DELETE | ✅ | Revoke signing key | [Keys](./10-key-management-api.md#revoke-signing-key) |

## Orders API (Legacy)

| Endpoint | Method | Auth | Description | Docs |
|----------|--------|------|-------------|------|
| `/orders` | GET | ✅ | List orders | [Trading](./3-trading-api.md#list-orders) |
| `/orders` | POST | ✅ | Place order | [Trading](./3-trading-api.md#place-order) |
| `/orders/:id` | PUT | ✅ | Update order | [Trading](./3-trading-api.md#update-order) |
| `/orders/:id` | DELETE | ✅ | Cancel order | [Trading](./3-trading-api.md#cancel-order) |
| `/orderbooks` | GET | ❌ | Get order book | [Trading](./3-trading-api.md#get-order-book) |

## Trades API (Legacy)

| Endpoint | Method | Auth | Description | Docs |
|----------|--------|------|-------------|------|
| `/trades` | GET | ✅ | List user trades | [Trading](./3-trading-api.md#list-user-fills) |

## WebSocket Channels

### Public Channels

| Channel | Format | Description | Docs |
|---------|--------|-------------|------|
| `ticker` | `ticker:<market_id>` | Real-time ticker | [WebSocket](./5-websockets.md#ticker-channel) |
| `trades` | `trades:<market_id>` | Trade feed | [WebSocket](./5-websockets.md#trades-channel) |
| `book` | `book:<market_id>` | Order book updates | [WebSocket](./5-websockets.md#book-order-book-channel) |
| `orderbooks` | `orderbooks:<market_id>` | Order book updates | [WebSocket](./5-websockets.md) |
| `public_trades` | `public_trades:<market_id>` | Public trades | [WebSocket](./5-websockets.md#public-trades-channel) |
| `public_market_stats` | `public_market_stats:<market_id>` | Market stats | [WebSocket](./5-websockets.md) |
| `public_orders` | `public_orders:<market_id>` | Public orders | [WebSocket](./5-websockets.md) |
| `price_histories` | `price_histories:<market_id>` | Price updates | [WebSocket](./5-websockets.md) |

### Private Channels (Require Authentication)

| Channel | Format | Description | Docs |
|---------|--------|-------------|------|
| `orders` | `orders:<user_id>` | User order updates | [WebSocket](./5-websockets.md#orders-channel) |
| `trades` | `trades:<user_id>` | User trade updates | [WebSocket](./5-websockets.md#trades-channel) |
| `positions` | `positions:<user_id>` | Position updates | [WebSocket](./5-websockets.md#positions-channel) |
| `trading_account_summaries` | `trading_account_summaries:<user_id>` | Balance updates | [WebSocket](./5-websockets.md#trading-account-summaries-channel) |
| `consumption_account_update` | `consumption_account_update:<user_id>` | Consumption updates | [WebSocket](./5-websockets.md#consumption-account-updates-channel) |
| `transfer_histories` | `transfer_histories:<user_id>` | Transfer updates | [WebSocket](./5-websockets.md#transfer-histories-channel) |

## Query Parameter Patterns

### Filter Syntax (Flop)

```
?filters[0][field]=market_id&filters[0][op]==&filters[0][value]=market_abc
?filters[1][field]=status&filters[1][value]=active
```

**Operators**: `==`, `!=`, `>`, `<`, `>=`, `<=`

### Sorting

```
?order_by[]=execution_timestamp&order_directions[]=desc
```

**Directions**: `asc`, `desc`

### Pagination

```
?page=2&page_size=50
```

Or:

```
?limit=50&offset=50
```

## Common Response Formats

### Success Response

```json
{
  "data": { ... },
  "meta": {
    "timestamp": "2025-01-01T00:00:00Z",
    "current_page": 1,
    "total_count": 100
  }
}
```

Or (Trading API):

```json
{
  "data": [ ... ],
  "paging": {
    "has_more": false,
    "next_cursor": null,
    "prev_cursor": null
  }
}
```

### Error Response

```json
{
  "error": "Error message",
  "errors": {
    "detail": "Detailed error"
  }
}
```

## Rate Limits

| API | Rate Limit |
|-----|------------|
| Trading API | 100 requests/minute |
| Market Data API | 300 requests/minute |
| Consumption API | 60 requests/minute |
| Order Placement | 50 orders/minute |
| WebSocket Connections | 10 concurrent |
| WebSocket Subscriptions | 50 channels/connection |

## Quick Navigation

### By Use Case

**I want to...**

- **Trade AI inference tokens** → [Trading API](./3-trading-api.md)
- **Use AI chat completion** → [Consumption API](./2-consumption-api.md)
- **View my positions** → [Positions API](./6-positions-api.md)
- **Get price charts** → [Price History API](./7-price-history-api.md)
- **Find AI models** → [Instruments API](./8-instruments-api.md)
- **Transfer between accounts** → [Transfers API](./11-transfers-and-issuance-api.md)
- **Manage my profile** → [User Management API](./9-user-management-api.md)
- **Rotate my keys** → [Key Management API](./10-key-management-api.md)
- **Get real-time updates** → [WebSockets](./5-websockets.md)
- **See code examples** → [Examples](./examples/)

### By Language

- **JavaScript/TypeScript** → [JS Examples](./examples/javascript/)
- **Python** → [Python Examples](./examples/python/)
- **Go** → [Go Examples](./examples/golang/)

## HTTP Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 200 | OK | Successful GET request |
| 201 | Created | Successful POST (resource created) |
| 202 | Accepted | Async operation accepted |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid parameters |
| 401 | Unauthorized | Authentication failed |
| 403 | Forbidden | Access denied |
| 404 | Not Found | Resource doesn't exist |
| 422 | Unprocessable Entity | Validation errors |
| 429 | Too Many Requests | Rate limited |
| 500 | Internal Server Error | Server error |

## Common Error Codes

| Code | Description |
|------|-------------|
| `INVALID_SIGNATURE` | Ed25519 signature invalid |
| `EXPIRED_TIMESTAMP` | Request timestamp too old |
| `INVALID_API_KEY` | Consumption API key invalid |
| `INSUFFICIENT_BALANCE` | Not enough funds |
| `INSUFFICIENT_CREDITS` | Not enough AI credits |
| `INVALID_MARKET` | Market not found |
| `INVALID_ORDER` | Order parameters invalid |
| `ORDER_NOT_FOUND` | Order doesn't exist |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `ACCOUNT_NOT_FOUND` | Account doesn't exist |
| `INSTRUMENT_NOT_FOUND` | Instrument doesn't exist |

## Data Types

### Order Types

- `limit` - Limit order (requires price)
- `market` - Market order (executes at best available price)
- `stop_limit` - Stop-limit order (requires price and stop_price)

### Order Sides

- `buy` - Buy order
- `sell` - Sell order

### Order Status

- `active` - Order is open
- `filled` - Order completely filled
- `partially_filled` - Order partially filled
- `closed` - Order closed
- `cancelled` - Order cancelled

### Time in Force

- `gtc` - Good-til-cancelled (default)
- `ioc` - Immediate-or-cancel
- `fok` - Fill-or-kill
- `day` - Good for day
- `gtd` - Good-til-date

### Instrument Types

- `ai_commodity` - AI inference tokens
- `currency` - Fiat currency (USD, etc.)

### Resolution Types (Price History)

- `1m`, `5m`, `15m`, `30m` - Minutes
- `1h`, `4h` - Hours
- `1d` - Daily
- `1w` - Weekly
- `1M` - Monthly

## Authentication Headers

### Ed25519 Signature

```
x-thegrid-signature: <base64_signature>
x-thegrid-timestamp: <unix_timestamp>
x-thegrid-fingerprint: <sha256_public_key_hash>
```

### API Key (Consumption)

```
Authorization: Bearer <consumption_api_key>
```

## Important Notes

1. **All timestamps** are in ISO 8601 format with UTC timezone
2. **Decimal values** are returned as strings to preserve precision
3. **Transfers** are processed asynchronously (202 Accepted)
4. **Order updates** are processed asynchronously (202 Accepted)
5. **Private WebSocket channels** require session authentication
6. **Public API endpoints** don't require authentication
7. **Rate limits** are per account/API key

## Support

- **Email**: support@thegrid.ai
- **Documentation**: All docs in this folder
- **Status**: https://status.grid.xyz (check API health)


