---
name: sdk-usage
description: Programmatic access to The Grid — integrated SDK (grid-cli/sdk) and standalone @the-gridai/grid-sdk, Ed25519 signing, HTTP client, WebSocket subscriptions, error handling. Use when writing code against the API.
---

# SDK Usage

Two SDKs ship in this repo — pick based on context:

| | Integrated (`grid-cli/sdk`) | Standalone (`@the-gridai/grid-sdk`) |
|---|---|---|
| Location | `src/sdk/` | `grid/packages/sdk-typescript/` |
| Init | Singletons + CLI config/profiles | `new GridClient(config)` constructor |
| Best for | Strategies run by this CLI/daemon | External apps, other services |

Migration guide between the two: `grid/docs/sdk-migration.md`.

## Integrated SDK

```typescript
import { ApiClient, WebSocketClient, ConnectionState, logger } from 'grid-cli/sdk';
import { InsufficientBalanceError, RateLimitError, ApiError } from 'grid-cli/sdk';

const client = ApiClient.getInstance();          // uses profile/env config
const balances = await client.getTradingAccounts();
const order = await client.placeOrder({
  market_id: 'market-…', side: 'sell', type: 'limit',
  quantity: '10', price: '0.50', time_in_force: 'gtc',
});

const ws = WebSocketClient.getInstance();
ws.subscribeToOrders((event) => console.log('order update', event));
```

Built-in behavior worth knowing (see `src/sdk/http/`):

- **Retry** with backoff on transient failures (`SDK_MAX_RETRIES`, default 2); already-cancelled order errors are not retried
- **Rate limiting** (`SDK_RATE_LIMIT_CONCURRENT` / `SDK_RATE_LIMIT_INTERVAL`)
- **Zod validation** of responses (`src/sdk/validators/`); orderbooks are normalized from the exchange's `buy`/`sell` arrays to `bids`/`asks`
- **Error taxonomy** in `src/sdk/http/error-handler.ts` — catch specific classes, not generic `Error`

## Standalone SDK

```typescript
import { GridClient, generateKeyPair, calculateFingerprint } from '@the-gridai/grid-sdk';

const { publicKey, privateKey } = generateKeyPair();
const fingerprint = calculateFingerprint(publicKey);

const client = new GridClient({
  apiUrl: process.env.GRID_API_URL!,
  signingKey: process.env.GRID_SIGNING_KEY!,
  fingerprint: process.env.GRID_FINGERPRINT!,
});
const orders = await client.orders.list();
const ws = client.createWebSocket();
ws.subscribeToOrders((e) => console.log(e));
```

Docs: `grid/docs/getting-started.md`, `grid/docs/sdk-reference.md`, `grid/docs/authentication.md`.

## Authentication Model

- **Trading API**: Ed25519 request signing (tweetnacl). Each request is signed with your private seed; the server verifies against the registered public key identified by its SHA-256 fingerprint. Implementation: `src/sdk/auth/signature.ts`, `src/sdk/auth/keygen.ts`.
- **Consumption API** (inference): Bearer API key (`Authorization: Bearer …`). Client: `src/sdk/responses/client.ts` — handles the 307 redirect to the inference gateway, streaming (SSE), and local-dev hostname rewriting.
- **OAuth device flow**: `src/sdk/auth/oauth-client.ts` for interactive login and key management scopes.

## API Surface Reference

- OpenAPI spec: `grid/spec/openapi.yaml`
- REST docs: `Docs/3-trading-api.md`, `Docs/2-consumption-api.md`, `Docs/5-websockets.md`, and the index in `Docs/API-REFERENCE-INDEX.md`
- Mock server for offline development: `grid/mock-server` (`npm run dev`, defaults to `localhost:3000`)

## Testing Against the SDK

Use the jest helpers in `tests/helpers/` (`mock-api-client.ts`, `mock-trading-gateway.ts`, `mock-phoenix-server.ts`) rather than hitting live endpoints; see `tests/EXAMPLES.md` for patterns.
