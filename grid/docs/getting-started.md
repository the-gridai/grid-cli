# Getting Started with Grid

This guide will help you get started with the Grid SDK and CLI.

## Prerequisites

- Node.js 18 or later
- A Grid account with API credentials

## Installation

### CLI Installation

**macOS / Linux / WSL:**

```bash
curl -fsSL https://raw.githubusercontent.com/the-gridai/grid-cli/main/install/install.sh | bash
```

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/the-gridai/grid-cli/main/install/install.ps1 | iex
```

### SDK Installation

```bash
npm install @the-gridai/grid-sdk
```

## Authentication

Grid uses Ed25519 signatures for authentication. You'll need:

1. **Signing Key**: Your Ed25519 private key (base64 encoded)
2. **Fingerprint**: SHA256 hash of your public key

### Generating Keys

You can generate a new key pair using the SDK:

```typescript
import { generateKeyPair, calculateFingerprint } from '@the-gridai/grid-sdk';

const { signingKey, publicKey } = generateKeyPair();
const fingerprint = await calculateFingerprint(publicKey);

console.log('Signing Key:', signingKey);    // Store securely!
console.log('Public Key:', publicKey);       // Register with Grid
console.log('Fingerprint:', fingerprint);
```

### Registering Your Key

Register your public key through the Grid web interface or API.

## Your First Request

```typescript
import { GridClient } from '@the-gridai/grid-sdk';

// Initialize the client
const client = new GridClient({
  apiUrl: 'https://api.thegrid.ai',
  signingKey: process.env.GRID_SIGNING_KEY!,
  fingerprint: process.env.GRID_FINGERPRINT!,
});

// Get account balances
const accounts = await client.accounts.getTradingAccounts();
console.log('Your balances:');
accounts.forEach(account => {
  console.log(`  ${account.instrument_symbol}: ${account.available_balance}`);
});

// List available markets
const markets = await client.markets.list();
console.log('\nAvailable markets:');
markets.forEach(market => {
  console.log(`  ${market.name} (${market.status})`);
});
```

## Placing Your First Order

```typescript
// Get market ticker for price reference
const ticker = await client.markets.getTicker('BTC-USD');
console.log(`Current BTC-USD price: ${ticker.last_price}`);

// Place a limit buy order
const order = await client.orders.create({
  market_id: 'BTC-USD',
  side: 'buy',
  type: 'limit',
  quantity: '0.01',
  price: '50000',
});

console.log(`Order placed: ${order.id}`);

// Check order status
const orderStatus = await client.orders.get(order.id);
console.log(`Order status: ${orderStatus.status}`);
```

## Real-time Updates

Use WebSocket for real-time order and trade updates:

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
ws.subscribeToOrders((event) => {
  console.log('Order update:', event.type, event.order.id);
});

// Subscribe to ticker updates
ws.subscribeToTicker('BTC-USD', (event) => {
  console.log('BTC-USD:', event.ticker.last_price);
});
```

## Environment Variables

We recommend storing credentials in environment variables:

```bash
# .env (do not commit!)
GRID_SIGNING_KEY=your-base64-signing-key
GRID_FINGERPRINT=your-fingerprint
GRID_API_URL=https://api.thegrid.ai
```

## Next Steps

- [Authentication Guide](./authentication.md) - Learn more about Ed25519 signatures
- [SDK Reference](./sdk-reference.md) - Complete API documentation
- [API Specification](../spec/openapi.yaml) - OpenAPI specification

## Getting Help

- [GitHub Issues](https://github.com/the-gridai/grid-cli/issues)
- [Documentation](https://docs.thegrid.ai)
- [Support](mailto:support@thegrid.ai)
