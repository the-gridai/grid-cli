# GRID API Documentation

Comprehensive documentation for the GRID Exchange API.

## 🚀 Quick Start

**New to the API?** Start with the [Quick Start Guide](./QUICKSTART.md) to make your first API call in 5 minutes.

**Need a specific endpoint?** Check the [API Reference Index](./API-REFERENCE-INDEX.md) for quick lookup.

## Table of Contents

### Core API Documentation

1. [API Overview and Conventions](./1-overview.md)
   - Base URLs and environments
   - Authentication (Ed25519 signatures)
   - Request/response conventions
   - Pagination, errors, rate limits

2. [Consumption API](./2-consumption-api.md)
   - Authentication
   - Chat endpoint
   - Streaming
   - Tool calling and structured outputs

3. [Trading API](./3-trading-api.md)
   - Markets and instruments
   - Orders (place, cancel, update)
   - Fills and trade history
   - Market statistics
   - Public trades

4. [Accounts and Usage API](./4-accounts-usage-api.md)
   - Trading balances (by currency and instrument)
   - Consumption balances and token usage
   - Lots and expiry
   - Usage records
   - Action history

5. [Market Data WebSockets](./5-websockets.md)
   - Connection and authentication
   - Public channels (ticker, trades, book, market stats)
   - Private channels (orders, trades, positions, balances)
   - Message schemas
   - Snapshot and incremental updates
   - Reconnection guidance

### Extended API Documentation

6. [Positions API](./6-positions-api.md)
   - List positions
   - Position filtering and sorting
   - P&L tracking
   - Position status management

7. [Price History API](./7-price-history-api.md)
   - OHLCV candlestick data
   - Multiple resolutions (1m to 1M)
   - Charting integration
   - Technical analysis

8. [Instruments API](./8-instruments-api.md)
   - List instruments
   - AI commodity specifications
   - Trading parameters
   - SLA requirements
   - Qualifying models

9. [User Management API](./9-user-management-api.md)
   - User registration
   - Email verification
   - Login/logout
   - OAuth authentication (GitHub, Google)
   - Password management
   - Profile settings

10. [Key Management API](./10-key-management-api.md)
    - API key creation and management
    - Signing key registration
    - Key rotation
    - Security best practices

11. [Transfers and Issuance API](./11-transfers-and-issuance-api.md)
    - Transfer between trading and consumption
    - Transfer history
    - Issuance accounts (suppliers)
    - Inventory management

### Code Examples

12. [Code Examples](./examples/)
    - JavaScript/TypeScript examples
    - Python examples
    - Go/Golang examples
    - Authentication helpers
    - Advanced usage patterns
    - Complete workflows

## Quick Start

### Trading API (JavaScript/TypeScript)

```javascript
import { ApiClient } from './auth-client';

const client = new ApiClient(privateKey, publicKey);

// List markets
const markets = await client.getMarkets();

// Place an order
const order = await client.placeOrder({
  market_id: 'market_b310e860-97cd-45eb-bdc3-5be0b79295d0',
  side: 'buy',
  type: 'limit',
  quantity: '0.01',
  price: '45000.00',
  time_in_force: 'gtc'
});
```

### Trading API (Python)

```python
from grid_client import GridClient

client = GridClient(private_key, public_key)

# List markets
markets = client.get_markets()

# Place an order
order = client.place_order(
    market_id='market_b310e860-97cd-45eb-bdc3-5be0b79295d0',
    side='buy',
    order_type='limit',
    quantity='0.01',
    price='45000.00',
    time_in_force='gtc'
)
```

## Base URLs

- **Production**: `https://trading.api.thegrid.ai/v1`
- **Development**: `https://trading.api.thegrid.ai/v1`
- **WebSocket**: `wss://trading.api.thegrid.ai/ws`

## Support

For API support, contact: support@thegrid.ai

## Changelog

See individual API sections for version-specific changes.

