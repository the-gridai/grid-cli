# SDK Migration Guide

This guide helps migrate from the internal Grid CLI SDK to the new external `@the-gridai/grid-sdk`.

## Overview

The internal SDK (`src/sdk/`) uses a singleton pattern and relies on the CLI's configuration system. The external SDK (`@the-gridai/grid-sdk`) uses constructor-based initialization and is designed for standalone use.

## Key Differences

| Aspect | Internal SDK | External SDK |
|--------|-------------|--------------|
| Initialization | `ApiClient.getInstance()` | `new GridClient(config)` |
| Configuration | Reads from CLI config | Constructor parameters |
| Methods | Direct on client | Namespaced (`client.orders.*`) |
| Dependencies | Internal logger, config | Optional logger injection |

## API Mapping

### Initialization

```typescript
// BEFORE: Internal SDK
import { ApiClient } from '../../src/sdk/http/client';
const client = ApiClient.getInstance();

// AFTER: External SDK
import { GridClient } from '@the-gridai/grid-sdk';
const client = new GridClient({
  apiUrl: 'https://api.thegrid.ai/v1',
  signingKey: process.env.GRID_SIGNING_KEY,
  fingerprint: process.env.GRID_FINGERPRINT,
});
```

### Orders

```typescript
// BEFORE
await client.listOrders({ status: 'active' });
await client.placeOrder(orderPayload);
await client.cancelOrder(orderId);
await client.cancelAllOrders();
await client.getOrder(orderId);

// AFTER
await client.orders.list({ status: 'active' });
await client.orders.create(orderPayload);
await client.orders.cancel(orderId);
await client.orders.cancelAll();
await client.orders.get(orderId);
```

### Markets

```typescript
// BEFORE
await client.getTicker(marketId);
await client.getOrderBook(marketId, depth);
await client.getMarket(marketId);
await client.getMarkets();

// AFTER
await client.markets.getTicker(marketId);
await client.markets.getOrderBook(marketId, depth);
await client.markets.get(marketId);
await client.markets.list();
```

### Accounts

```typescript
// BEFORE
await client.getTradingAccounts();
await client.getConsumptionInstruments();
await client.getMe();

// AFTER
await client.accounts.getTradingAccounts();
await client.accounts.getConsumptionAccounts();
await client.accounts.getMe(); // or client.accounts.me()
```

### Trades

```typescript
// BEFORE
await client.getTrades({ market_id: 'BTC-USD' });

// AFTER
await client.trades.list({ market_id: 'BTC-USD' });
```

### Supply & Transfers

```typescript
// BEFORE
await client.issueSupply(instrumentId, quantity);
await client.getSupplyIssuances();
await client.transferToConsumption(instrumentId, quantity);

// AFTER
await client.supply.issue(instrumentId, quantity);
await client.supply.getIssuances(); // or client.supply.list()
await client.transfers.toConsumption(instrumentId, quantity);
```

### Instruments

```typescript
// BEFORE
await client.listInstruments();
await client.getInstrument(id);
await client.getInstrumentBySymbol(symbol);

// AFTER
await client.instruments.list();
await client.instruments.get(id);
await client.instruments.getBySymbol(symbol);
```

## WebSocket Migration

```typescript
// BEFORE: Internal SDK
import { TradingGatewayClient } from '../../src/sdk/ws/trading-gateway';
const ws = new TradingGatewayClient({ wsUrl, auth });
ws.subscribe(['user.orders', 'market.ticker.BTC-USD']);
ws.on('order', handler);

// AFTER: External SDK
import { GridWebSocket } from '@the-gridai/grid-sdk';
const ws = new GridWebSocket({
  wsUrl: 'wss://api.thegrid.ai/ws',
  signingKey: process.env.GRID_SIGNING_KEY,
  fingerprint: process.env.GRID_FINGERPRINT,
});
ws.subscribeToOrders(handler);
ws.subscribeToTicker('BTC-USD', handler);
```

## Error Handling

```typescript
// BEFORE
import { ApiError, InsufficientBalanceError } from '../../src/core/errors';

// AFTER
import { ApiError, ValidationError, NetworkError, RateLimitError } from '@the-gridai/grid-sdk';
```

## Configuration

### Environment Variables (External SDK)

```bash
# Required
GRID_SIGNING_KEY=<base64-encoded-ed25519-seed>
GRID_FINGERPRINT=<sha256-of-public-key>

# Optional
GRID_API_URL=https://api.thegrid.ai/v1
GRID_WS_URL=wss://api.thegrid.ai/ws
```

## Strategy Migration Checklist

1. [ ] Update imports to use `@the-gridai/grid-sdk`
2. [ ] Replace `ApiClient.getInstance()` with `new GridClient(config)`
3. [ ] Update method calls to use namespaced API
4. [ ] Replace `TradingGatewayClient` with `GridWebSocket`
5. [ ] Update error imports
6. [ ] Test with mock server first: `npm run mock-server`
7. [ ] Test with real API

## Example: Full Migration

See `strategies/examples/simple-market-maker-external.ts` for a complete example of a migrated strategy.

## Notes

- The external SDK is designed to be framework-agnostic
- Logger injection is optional but recommended for debugging
- Rate limiting and retry logic are built-in
- WebSocket reconnection is automatic
