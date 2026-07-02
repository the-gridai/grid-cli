# @the-gridai/grid-mock-server

Mock server for Grid SDK development and testing.

## Installation

```bash
npm install @the-gridai/grid-mock-server
```

## Usage

### Start the server

```bash
# Default port 3000
npx @the-gridai/grid-mock-server

# Custom port
npx @the-gridai/grid-mock-server --port 8080
```

### Use with SDK

```typescript
import { GridClient } from '@the-gridai/grid-sdk';

const client = new GridClient({
  apiUrl: 'http://localhost:3000',
  signingKey: 'test-signing-key',
  fingerprint: 'test-fingerprint',
});

// All endpoints work with mock data
const markets = await client.markets.list();
const orders = await client.orders.list();
```

## Endpoints

### Markets

- `GET /markets` - List all markets
- `GET /markets/:id` - Get market by ID
- `GET /markets/:id/ticker` - Get market ticker
- `GET /markets/:id/orderbook` - Get order book
- `GET /markets/:id/trades` - Get recent trades

### Orders

- `GET /orders` - List orders
- `GET /orders/:id` - Get order by ID
- `POST /orders` - Place order
- `PUT /orders/:id` - Update order
- `DELETE /orders/:id` - Cancel order

### Trades

- `GET /trades` - List trades
- `GET /trades/:id` - Get trade by ID

### Accounts

- `GET /trading-accounts` - Get trading accounts
- `GET /consumption-accounts` - Get consumption accounts
- `GET /issuance-accounts` - Get issuance accounts
- `GET /me` - Get current user

### Supply

- `GET /supply-issuances` - List supply issuances
- `POST /supply-issuances` - Create supply issuance

### Transfers

- `POST /transfers/trading-to-consumption` - Transfer to consumption
- `POST /transfers/consumption-to-trading` - Transfer to trading

## WebSocket

Connect to `ws://localhost:3000/ws` for real-time updates:

```typescript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};

// Subscribe to channels
ws.send(JSON.stringify({ type: 'subscribe', data: { channel: 'orders' } }));
ws.send(JSON.stringify({ type: 'subscribe', data: { channel: 'ticker', market_id: 'BTC-USD' } }));
```

## Mock Data

The server comes with pre-populated mock data:

### Markets

- `mkt-btc-usd` - BTC-USD (Bitcoin)
- `mkt-eth-usd` - ETH-USD (Ethereum)
- `mkt-compute-usd` - COMPUTE-USD (AI Compute)

### Accounts

- Trading accounts with BTC, ETH, and USD balances
- Consumption accounts with compute credits
- Issuance accounts for suppliers

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Run tests
npm test
```

## License

MIT
