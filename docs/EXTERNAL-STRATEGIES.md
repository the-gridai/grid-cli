# Writing External Trading Strategies

This guide explains how to write trading strategies outside the GRID-cli repository.

---

## Why External Strategies?

**Benefits**:
- Keep your strategies in private repositories
- Version control strategies separately from GRID-cli
- Share strategies without sharing GRID-cli code
- Organize strategies however you want
- Run strategies from anywhere on your system

---

## Quick Start

### 1. Install GRID-cli

**Option A: Global Install** (Recommended)
```bash
cd ~/grid-cli
npm run build
npm link

# Now 'grid' command available globally
```

**Option B: Local Install**
```bash
cd ~/my-trading-project
npm install /path/to/GRID-cli
```

### 2. Create Your Strategy

**File**: `~/my-strategies/my-bot.ts`

```typescript
import { ApiClient, WebSocketClient, type Order } from 'grid-cli/sdk';

async function run() {
  const client = ApiClient.getInstance();
  
  // Your strategy logic
  const markets = await client.getMarkets();
  const ticker = await client.getTicker(markets[0].market_id);
  
  console.log('Price:', ticker.last_price);
  
  // Place orders, manage positions, etc.
}

export { run };
```

### 3. Run Your Strategy

```bash
# From anywhere after npm link
grid strategy start ~/my-strategies/my-bot.ts

# Or with full path
grid strategy start /home/barney/my-strategies/my-bot.ts

# Or relative path
cd ~/my-strategies
grid strategy start ./my-bot.ts
```

---

## Strategy Template

Use the provided template as a starting point:

```bash
cp ~/grid-cli/strategies/templates/external-strategy-template.ts ~/my-strategies/my-bot.ts
```

Then customize the logic in `runStrategy()` method.

---

## Available SDK Exports

```typescript
// HTTP Client
import { ApiClient } from 'grid-cli/sdk';

// WebSocket Client
import { WebSocketClient, ConnectionState } from 'grid-cli/sdk';

// Types
import type { Order, Market, Ticker, Trade } from 'grid-cli/sdk';

// Errors
import {
  ApiError,
  NetworkError,
  RateLimitError,
  ValidationError,
  InsufficientBalanceError
} from 'grid-cli/sdk';

// Logger
import { logger } from 'grid-cli/sdk';

// Config
import { getConfig } from 'grid-cli/sdk';
```

---

## Complete Example Strategy

```typescript
import {
  ApiClient,
  WebSocketClient,
  logger,
  type Order,
  InsufficientBalanceError,
  RateLimitError
} from 'grid-cli/sdk';

interface Config {
  marketId: string;
  spread: number;
  size: string;
}

class SimpleBot {
  private client: ApiClient;
  
  constructor(private config: Config) {
    this.client = ApiClient.getInstance();
  }

  async start() {
    console.log('Starting bot...');
    
    // Check balance
    const accounts = await this.client.getTradingAccounts();
    console.log('Balances:', accounts);

    // Get market data
    const ticker = await this.client.getTicker(this.config.marketId);
    const price = parseFloat(ticker.last_price);

    // Place order
    try {
      const order = await this.client.placeOrder({
        market_id: this.config.marketId,
        side: 'buy',
        type: 'limit',
        quantity: this.config.size,
        price: (price * 0.99).toFixed(2) // 1% below market
      });
      
      console.log('Order placed:', order.id);
    } catch (error) {
      if (error instanceof InsufficientBalanceError) {
        console.error('Not enough funds');
      } else if (error instanceof RateLimitError) {
        console.log('Rate limited, waiting...');
        await new Promise(r => setTimeout(r, error.retryAfter! * 1000));
      } else {
        throw error;
      }
    }
  }
}

export async function run() {
  const config = {
    marketId: process.env.MARKET_ID || 'market_default',
    spread: parseFloat(process.env.SPREAD || '2'),
    size: process.env.SIZE || '1'
  };

  const bot = new SimpleBot(config);
  await bot.start();
}
```

**Run it**:
```bash
MARKET_ID=market_xxx grid strategy start ~/my-strategies/bot.ts
```

---

## Configuration

### Environment Variables

Strategies can read from `.env` in the GRID-cli directory:

```bash
# GRID-cli/.env
API_URL=https://trading.api.thegrid.ai/v1
TRADING_PRIVATE_KEY_PATH=./ed25519.key
TRADING_PUBLIC_KEY_PATH=./ed25519_pub.der
```

### Strategy-Specific Config

Pass via environment or config file:

```bash
# Via environment
MARKET_ID=market_xxx SPREAD=2 SIZE=10 grid strategy start my-bot.ts

# Or use a config file
grid strategy start my-bot.ts --config my-config.json
```

---

## TypeScript Configuration

For TypeScript support in external strategies:

**File**: `tsconfig.json` (in your strategy directory)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  }
}
```

---

## Best Practices

### Error Handling

Always handle errors gracefully:

```typescript
try {
  await client.placeOrder(order);
} catch (error) {
  if (error instanceof InsufficientBalanceError) {
    // Handle insufficient funds
  } else if (error instanceof ValidationError) {
    // Handle validation errors
    console.error('Invalid order:', error.validationErrors);
  } else if (error instanceof RateLimitError) {
    // Wait and retry
    await sleep(error.retryAfter * 1000);
  }
}
```

### Graceful Shutdown

Always cancel orders on exit:

```typescript
process.on('SIGINT', async () => {
  await client.cancelAllOrders();
  ws.disconnect();
  process.exit(0);
});
```

### Logging

Use the provided logger:

```typescript
import { logger } from 'grid-cli/sdk';

logger.info('Strategy started', { marketId });
logger.error('Failed to place order', { error });
```

---

## Examples

### Market Maker

```bash
cp ~/grid-cli/strategies/examples/simple-market-maker-v2.ts ~/my-strategies/mm.ts
# Update imports to use 'grid-cli/sdk'
grid strategy start ~/my-strategies/mm.ts
```

### Arbitrage Bot

```typescript
import { ApiClient } from 'grid-cli/sdk';

async function run() {
  const client = ApiClient.getInstance();
  
  const market1Ticker = await client.getTicker('market_1');
  const market2Ticker = await client.getTicker('market_2');
  
  const price1 = parseFloat(market1Ticker.last_price);
  const price2 = parseFloat(market2Ticker.last_price);
  
  if (price1 < price2 * 0.98) {
    // Buy on market 1, sell on market 2
    console.log('Arbitrage opportunity!');
  }
}

export { run };
```

---

## Troubleshooting

### "Cannot find module 'grid-cli/sdk'"

**Solution**: Run `npm link` from GRID-cli directory

```bash
cd ~/grid-cli
npm run build
npm link
```

### "Strategy file not found"

**Solution**: Use absolute paths or check current directory

```bash
# Use full path
grid strategy start /home/barney/my-strategies/bot.ts

# Or navigate first
cd /home/barney/my-strategies
grid strategy start ./bot.ts
```

### TypeScript errors

**Solution**: Ensure GRID-cli is built

```bash
cd ~/grid-cli
npm run build
```

---

## See Also

- `README.md` - Main documentation
- `strategies/templates/external-strategy-template.ts` - Full template
- `examples/simple-bot.ts` - Simple example
- `strategies/examples/simple-market-maker-v2.ts` - Advanced example

