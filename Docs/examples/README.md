# GRID API Code Examples

Ready-to-use code examples for interacting with the GRID API in JavaScript/TypeScript, Python, and Go.

---

## Quick Start

### JavaScript/TypeScript

```bash
cd examples/javascript
npm install axios tweetnacl tweetnacl-util ws
node trading-client.js
```

### Python

```bash
cd examples/python
pip install requests PyNaCl websocket-client
python trading_client.py
```

### Go

```bash
cd examples/golang
go run example_usage.go
# No external dependencies required!
```

---

## Directory Structure

```
examples/
├── README.md (this file)
├── javascript/
│   ├── auth.js                  # Ed25519 signature authentication
│   ├── trading-client.js        # Complete API client (25+ methods)
│   └── advanced-usage.js        # Advanced workflows and patterns
├── python/
│   ├── auth.py                  # Ed25519 signature authentication
│   ├── trading_client.py        # Complete API client (25+ methods)
│   └── advanced_usage.py        # Advanced workflows and patterns
└── golang/
    ├── auth.go                  # Ed25519 signature authentication
    ├── trading_client.go        # Complete API client (15+ methods)
    ├── example_usage.go         # Usage examples
    └── go.mod                   # Go module definition
```

---

## Authentication Setup

All examples require Ed25519 key pairs. You have three options:

### Option 1: Generate with OpenSSL

```bash
# Generate private key
openssl genpkey -algorithm Ed25519 -out ed25519.key

# Extract public key
openssl pkey -in ed25519.key -pubout -out ed25519_pub.der

# Extract base64 values
cat ed25519.key | grep -v "PRIVATE KEY" | tr -d '\n' > ed25519.key
cat ed25519_pub.der | grep -v "PUBLIC KEY" | tr -d '\n' > ed25519_pub.der
```

### Option 2: Generate with JavaScript

```javascript
const nacl = require('tweetnacl');
const util = require('tweetnacl-util');
const fs = require('fs');

const keyPair = nacl.sign.keyPair();
const privateKeyBase64 = util.encodeBase64(keyPair.secretKey);
const publicKeyBase64 = util.encodeBase64(keyPair.publicKey);

fs.writeFileSync('ed25519.key', privateKeyBase64);
fs.writeFileSync('ed25519_pub.der', publicKeyBase64);

console.log('Keys generated!');
```

### Option 3: Generate with Python

```python
from nacl.signing import SigningKey
import base64

private_key = SigningKey.generate()
public_key = private_key.verify_key

private_key_b64 = base64.b64encode(bytes(private_key)).decode()
public_key_b64 = base64.b64encode(bytes(public_key)).decode()

with open('ed25519.key', 'w') as f:
    f.write(private_key_b64)

with open('ed25519_pub.der', 'w') as f:
    f.write(public_key_b64)

print('Keys generated!')
```

**Security Warning**: Never commit private keys to version control!

---

## Available Examples

### Basic Examples (All Languages)

#### `auth.*` - Authentication Helper

Implements Ed25519 signature generation for API authentication.

**Features**:
- Ed25519 signature generation
- SHA256 fingerprint calculation
- Request header construction
- Timestamp handling

**JavaScript**:
```javascript
const { SignatureAuth } = require('./javascript/auth');

const auth = new SignatureAuth(privateKey, publicKey);
const headers = auth.getHeaders('GET', '/api/v1/trading/markets', '');
```

**Python**:
```python
from auth import SignatureAuth

auth = SignatureAuth(private_key, public_key)
headers = auth.get_headers('GET', '/api/v1/trading/markets', '')
```

**Go**:
```go
auth, _ := NewSignatureAuth(privateKey, publicKey)
headers := auth.GetHeaders("GET", "/api/v1/trading/markets", "")
```

---

#### `trading-client.*` - Complete Trading Client

Full-featured client covering all major API endpoints.

**Included Methods** (25+ methods):

##### Markets & Instruments
- `getMarkets()` / `get_markets()` / `GetMarkets()`
- `getMarket(id)` / `get_market(id)` / `GetMarket(id)`
- `getTicker(id)` / `get_ticker(id)` / `GetTicker(id)`
- `getOrderBook(id, depth)` / `get_order_book(id, depth)` / `GetOrderBook(id, depth)`
- `getMarketTrades(id)` / `get_market_trades(id)` / `GetMarketTrades(id)`
- `getMarketStats(id)` - Get 24h statistics
- `listInstruments()` - List all instruments
- `getInstrument(id)` - Get instrument details
- `getInstrumentBySymbol(symbol)` - Search by symbol

##### Orders
- `placeOrder(params)` / `place_order(...)` / `PlaceOrder(req)`
- `listOrders(filters)` / `list_orders(...)` / `ListOrders(params)`
- `getOrder(id)` / `get_order(id)` / `GetOrder(id)`
- `cancelOrder(id)` / `cancel_order(id)` / `CancelOrder(id)`
- `cancelAllOrders(marketId)` / `cancel_all_orders(marketId)` / `CancelAllOrders(marketId)`

##### Trades
- `getTrades(filters)` / `get_trades(...)` / `GetTrades(params)`
- `getTrade(id)` / `get_trade(id)` / `GetTrade(id)`

##### Accounts
- `getTradingAccounts()` / `get_trading_accounts()` / `GetTradingAccounts()`
- `getTradingAccount(id)` / `get_trading_account(id)` / `GetTradingAccount(id)`
- `getCurrencyTradingAccounts()` / `get_currency_trading_accounts()` / `GetCurrencyTradingAccounts()`

##### Positions
- `getPositions(filters)` / `get_positions(status)` - Track positions and P&L

##### Price History
- `getPriceHistory(marketId, resolution, from, to)` - Get OHLCV candles

##### Transfers
- `transferToConsumption(instrumentId, qty)` - Transfer to consumption
- `transferToTrading(instrumentId, qty)` - Transfer to trading
- `getTransferHistory(marketId)` - View transfer history

##### Consumption
- `getConsumptionInstruments(apiKeyId)` - Get consumption balances

##### Public Data
- `getPublicTrades(marketId)` - Get public trades (no auth)

**Usage Example (JavaScript)**:

```javascript
const { GridTradingClient } = require('./javascript/trading-client');
const fs = require('fs');

// Load keys
const privateKey = fs.readFileSync('./ed25519.key', 'utf8').trim();
const publicKey = fs.readFileSync('./ed25519_pub.der', 'utf8').trim();

// Initialize client
const client = new GridTradingClient(privateKey, publicKey);

// Get markets
const markets = await client.getMarkets();
console.log(`Available markets: ${markets.length}`);

// Get balances
const balances = await client.getTradingAccounts();
console.log('Balances:', balances);

// Get positions
const positions = await client.getPositions({ status: 'open' });
console.log(`Open positions: ${positions.length}`);

// Get price history
const now = Math.floor(Date.now() / 1000);
const yesterday = now - (24 * 60 * 60);
const candles = await client.getPriceHistory('market_abc', '1h', yesterday, now);
console.log(`Price candles: ${candles.length}`);

// Place order
const order = await client.placeOrder({
  market_id: 'market_abc',
  side: 'buy',
  type: 'limit',
  quantity: 100,
  price: '45.00',
  time_in_force: 'gtc'
});
console.log(`Order placed: ${order.order_id}`);
```

**Usage Example (Python)**:

```python
from trading_client import GridTradingClient

# Load keys
with open('./ed25519.key', 'r') as f:
    private_key = f.read().strip()

with open('./ed25519_pub.der', 'r') as f:
    public_key = f.read().strip()

# Initialize client
client = GridTradingClient(private_key, public_key)

# Get markets
markets = client.get_markets()
print(f"Available markets: {len(markets)}")

# Get balances
balances = client.get_trading_accounts()
print(f"Balances: {len(balances)} accounts")

# Get positions
positions = client.get_positions(status='open')
print(f"Open positions: {len(positions)}")

# Get price history
import time
now = int(time.time())
yesterday = now - (24 * 60 * 60)
candles = client.get_price_history('market_abc', '1h', yesterday, now)
print(f"Price candles: {len(candles)}")

# Place order
order = client.place_order(
    market_id='market_abc',
    side='buy',
    order_type='limit',
    quantity='100',
    price='45.00'
)
print(f"Order placed: {order['order_id']}")
```

---

### Advanced Examples

#### `advanced-usage.js` / `advanced_usage.py`

Real-world workflows and patterns for production use.

**Included Workflows**:

1. **Portfolio Overview**
   - Get all positions with P&L calculation
   - View trading account balances
   - Check consumption balances
   - Calculate total portfolio value

2. **Market Analysis**
   - Get 24h market statistics
   - Fetch historical price data
   - Calculate volatility
   - Analyze volume trends

3. **AI Model Discovery**
   - Search for instruments by specs
   - Compare context windows and throughput
   - Filter by price and SLA requirements
   - Find best models for your needs

4. **Trading Strategy Backtesting**
   - Load historical data
   - Implement SMA crossover strategy
   - Calculate returns and win rate
   - Test strategies before live trading

5. **Market Monitoring**
   - Real-time trade monitoring
   - Order book tracking
   - Spread calculation
   - Volume analysis

6. **Buy-to-Consumption Workflow**
   - Check consumption balance
   - Buy tokens on exchange
   - Transfer to consumption account
   - Track transfer completion

7. **Transfer Pattern Analysis**
   - Analyze transfer history
   - Track flows by instrument
   - Calculate net flows
   - Monitor inventory movement

**Usage Example (JavaScript)**:

```javascript
const { AdvancedGridClient } = require('./javascript/advanced-usage');
const fs = require('fs');

const privateKey = fs.readFileSync('./ed25519.key', 'utf8').trim();
const publicKey = fs.readFileSync('./ed25519_pub.der', 'utf8').trim();

const client = new AdvancedGridClient(privateKey, publicKey);

// Complete portfolio overview
await client.getPortfolioOverview();

// Analyze market with price history
await client.analyzeMarket('market_abc', 30);

// Find best AI models
const models = await client.findBestAIModels(100000, 100);

// Backtest trading strategy
await client.backtestStrategy('market_abc', 30);

// Monitor market in real-time
await client.monitorMarket('market_abc', 5);

// Complete workflow: buy and prepare for AI use
await client.buyForAIConsumption('market_abc', 'instrument_gpt4', 100);
```

**Usage Example (Python)**:

```python
from advanced_usage import AdvancedGridClient

# Load keys
with open('./ed25519.key', 'r') as f:
    private_key = f.read().strip()
with open('./ed25519_pub.der', 'r') as f:
    public_key = f.read().strip()

client = AdvancedGridClient(private_key, public_key)

# Portfolio overview
client.get_portfolio_overview()

# Market analysis
client.analyze_market('market_abc', days=30)

# Find best AI models
models = client.find_best_ai_models(min_context_window=100000, max_price=100)

# Buy and prepare for AI consumption
client.buy_for_ai_consumption('market_abc', 'instrument_gpt4', 100)

# Analyze transfer patterns
client.analyze_transfer_patterns('market_abc', days=7)
```

---

## Complete API Coverage

All example files cover these API categories:

### Trading API (100% Coverage)
- Markets (list, details, ticker, orderbook, trades, stats)
- Orders (place, list, get, update, cancel)
- Trades (list, get single)
- Accounts (trading, currency, instrument)

### Positions API (100% Coverage)
- List positions
- Filter by status
- Calculate P&L

### Price History API (100% Coverage)
- Get OHLCV candles
- Multiple resolutions (1m to 1M)
- Time range filtering

### Instruments API (100% Coverage)
- List instruments
- Get by ID
- Get by symbol
- AI specifications

### Market Data API (100% Coverage)
- Market statistics
- Public trades
- Ticker data

### Transfers API (100% Coverage)
- Trading ↔ Consumption transfers
- Transfer history
- Issuance account transfers

### Consumption API (100% Coverage)
- Consumption instruments
- Token usage tracking

---

## Example File Details

### JavaScript Examples

#### `auth.js`
**Lines**: 82
**Dependencies**: `tweetnacl`, `tweetnacl-util`

**Features**:
- SignatureAuth class
- Ed25519 signature generation
- SHA256 fingerprint calculation
- File loading helpers

#### `trading-client.js`
**Lines**: 420+
**Dependencies**: `axios`, `tweetnacl`, `tweetnacl-util`

**Methods**: 25+
- All Trading API endpoints
- All Accounts API endpoints
- Positions, price history, instruments
- Transfers and consumption
- Public data endpoints

**Error Handling**:
- Try/catch wrappers
- HTTP status code handling
- Detailed error messages

#### `advanced-usage.js`
**Lines**: 550+
**Dependencies**: `axios`, `tweetnacl`, `tweetnacl-util`

**Classes**: AdvancedGridClient

**Features**:
- Portfolio overview with P&L
- Market analysis with volatility
- AI model search and comparison
- Strategy backtesting
- Real-time market monitoring
- Complete buy-to-consumption workflow

---

### Python Examples

#### `auth.py`
**Lines**: 104
**Dependencies**: `PyNaCl`

**Features**:
- SignatureAuth class
- Ed25519 signature generation
- SHA256 fingerprint calculation
- Type hints

#### `trading_client.py`
**Lines**: 510+
**Dependencies**: `requests`, `PyNaCl`

**Methods**: 25+
- All Trading API endpoints
- All Accounts API endpoints
- Positions, price history, instruments
- Transfers and consumption
- Public data endpoints

**Features**:
- Type hints throughout
- Pythonic API design
- Comprehensive docstrings
- Error handling with requests.HTTPError

#### `advanced_usage.py`
**Lines**: 240+
**Dependencies**: `requests`, `PyNaCl`

**Classes**: AdvancedGridClient

**Features**:
- Portfolio analytics
- Market analysis with indicators
- Transfer pattern analysis
- AI model discovery
- Buy-to-consumption workflow

---

### Go Examples

#### `auth.go`
**Lines**: 106
**Dependencies**: None (standard library only!)

**Features**:
- SignatureAuth struct
- Ed25519 signature (crypto/ed25519)
- SHA256 fingerprint (crypto/sha256)
- File loading from disk
- Zero external dependencies

#### `trading_client.go`
**Lines**: 533
**Dependencies**: None (standard library only!)

**Functions**: 15+
- All major Trading API endpoints
- Type-safe structs
- Error handling
- Timeout configuration

**Types Defined**:
- Market, Order, Trade, OrderBook, Ticker
- TradingAccount, PlaceOrderRequest
- ListOrdersParams, GetTradesParams

#### `example_usage.go`
**Lines**: 127
**Demonstrates**:
- Client initialization
- Market data retrieval
- Order placement
- Balance checking
- Error handling

---

## Learning Path

### Beginner (Start Here)

1. **Read**: [QUICKSTART.md](../QUICKSTART.md)
2. **Run**: `auth.js` or `auth.py` - Test authentication
3. **Run**: `trading-client.js` or `trading_client.py` - Make API calls
4. **Read**: Code comments in the files

### Intermediate

1. **Read**: [Trading API docs](../3-trading-api.md)
2. **Modify**: `trading-client.*` for your use case
3. **Read**: [Positions](../6-positions-api.md) and [Price History](../7-price-history-api.md) docs
4. **Experiment**: Get positions and price data

### Advanced

1. **Read**: `advanced-usage.js` or `advanced_usage.py`
2. **Run**: Advanced examples
3. **Build**: Custom trading strategies
4. **Integrate**: WebSocket for real-time updates

---

## Common Use Cases

### Use Case 1: Check Portfolio Value

```javascript
const { GridTradingClient } = require('./javascript/trading-client');

const client = new GridTradingClient(privateKey, publicKey);

// Get positions
const positions = await client.getPositions({ status: 'open' });

// Calculate total value
let totalValue = 0;
for (const pos of positions) {
  const value = parseFloat(pos.current_market_value) || 0;
  totalValue += value;
}

console.log(`Total Portfolio Value: $${totalValue.toFixed(2)}`);
```

### Use Case 2: Get Price Chart Data

```python
from trading_client import GridTradingClient
import time

client = GridTradingClient(private_key, public_key)

# Get daily candles for last 30 days
now = int(time.time())
start = now - (30 * 24 * 60 * 60)

candles = client.get_price_history('market_abc', '1d', start, now)

# Print OHLC data
for candle in candles:
    print(f"{candle['time']}: O ${candle['open']} H ${candle['high']} "
          f"L ${candle['low']} C ${candle['close']} V {candle['volume']}")
```

### Use Case 3: Find AI Models

```javascript
const instruments = await client.listInstruments();
const aiModels = instruments.filter(i => i.instrument_type === 'ai_commodity');

for (const model of aiModels) {
  const details = await client.getInstrument(model.instrument_id);
  
  console.log(`${details.symbol}:`);
  console.log(`  Context: ${details.ai_specs.context_window.toLocaleString()} tokens`);
  console.log(`  Throughput: ${details.ai_specs.token_throughput} tokens/sec`);
  console.log(`  Models: ${details.ai_specs.qualifying_models.join(', ')}`);
}
```

### Use Case 4: Buy and Transfer to Consumption

```python
# Buy tokens on exchange
order = client.place_order(
    market_id='market_abc',
    side='buy',
    order_type='market',
    quantity='100'
)

print(f"Order placed: {order['order_id']}")

# Wait for fill (use WebSocket in production)
time.sleep(5)

# Transfer to consumption for AI use
transfer = client.transfer_to_consumption('instrument_gpt4', 100)
print(f"Transfer initiated: {transfer['transfer_id']}")

# Check transfer history
history = client.get_transfer_history()
```

### Use Case 5: Monitor Market

```javascript
const { AdvancedGridClient } = require('./javascript/advanced-usage');

const client = new AdvancedGridClient(privateKey, publicKey);

// Monitor market for 5 minutes
await client.monitorMarket('market_abc', 5);

// Output:
// Trade: 100 @ $45.50 (buy)
//   Bid: $45.00 (200) | Ask: $45.50 (150) | Spread: 1.111%
// Trade: 50 @ $45.55 (sell)
//   Bid: $45.05 (100) | Ask: $45.55 (200) | Spread: 1.110%
```

---

## Common Patterns

### Error Handling

```javascript
async function safeApiCall(fn) {
  try {
    return await fn();
  } catch (error) {
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          console.error('Authentication failed:', data.error);
          // Regenerate signature or check keys
          break;
        case 429:
          const retryAfter = data.error.details?.retry_after || 60;
          console.log(`Rate limited. Waiting ${retryAfter}s...`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          return await fn(); // Retry
        case 400:
          console.error('Invalid request:', data.errors);
          break;
        default:
          console.error('API error:', data.error);
      }
    } else {
      console.error('Network error:', error.message);
    }
    throw error;
  }
}

// Usage
const markets = await safeApiCall(() => client.getMarkets());
```

### Rate Limiting with Backoff

```python
import time

def with_exponential_backoff(fn, max_retries=3):
    """Execute function with exponential backoff on rate limit"""
    delay = 1
    
    for attempt in range(max_retries):
        try:
            return fn()
        except requests.HTTPError as e:
            if e.response.status_code == 429:
                retry_after = e.response.json()['error']['details'].get('retry_after', delay)
                print(f"Rate limited. Waiting {retry_after}s...")
                time.sleep(retry_after)
                delay *= 2  # Exponential backoff
                continue
            raise
    
    raise Exception("Max retries exceeded")

# Usage
markets = with_exponential_backoff(lambda: client.get_markets())
```

### Pagination

```javascript
async function getAllOrders(client) {
  let allOrders = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    const response = await client.listOrders({ 
      page, 
      page_size: 100 
    });
    
    allOrders = allOrders.concat(response.data);
    hasMore = response.meta.has_next_page;
    page++;
  }
  
  return allOrders;
}

const allOrders = await getAllOrders(client);
console.log(`Total orders: ${allOrders.length}`);
```

### Batch Operations

```python
def cancel_all_market_orders(client, market_id):
    """Cancel all open orders in a specific market"""
    orders = client.list_orders(status='open', market_id=market_id)
    
    results = {'success': 0, 'failed': 0}
    
    for order in orders:
        try:
            client.cancel_order(order['id'])
            results['success'] += 1
        except Exception as e:
            print(f"Failed to cancel {order['id']}: {e}")
            results['failed'] += 1
    
    return results

results = cancel_all_market_orders(client, 'market_abc')
print(f"Cancelled {results['success']} orders, {results['failed']} failures")
```

---

## Testing Your Integration

### Test Authentication

```bash
# JavaScript
node -e "
const { SignatureAuth } = require('./javascript/auth');
const fs = require('fs');
const pk = fs.readFileSync('./ed25519.key', 'utf8').trim();
const pub = fs.readFileSync('./ed25519_pub.der', 'utf8').trim();
const auth = new SignatureAuth(pk, pub);
const headers = auth.getHeaders('GET', '/api/v1/users/self', '');
console.log('Headers:', headers);
"
```

```bash
# Python
python -c "
from auth import SignatureAuth
with open('./ed25519.key') as f: pk = f.read().strip()
with open('./ed25519_pub.der') as f: pub = f.read().strip()
auth = SignatureAuth(pk, pub)
headers = auth.get_headers('GET', '/api/v1/users/self', '')
print('Headers:', headers)
"
```

### Test API Connection

```javascript
// JavaScript - Test getting markets
const { GridTradingClient } = require('./javascript/trading-client');
const fs = require('fs');

const privateKey = fs.readFileSync('./ed25519.key', 'utf8').trim();
const publicKey = fs.readFileSync('./ed25519_pub.der', 'utf8').trim();

const client = new GridTradingClient(privateKey, publicKey);

client.getMarkets()
  .then(markets => console.log(`Connected! Found ${markets.length} markets`))
  .catch(error => console.error(`Connection failed:`, error.message));
```

```python
# Python - Test getting markets
from trading_client import GridTradingClient

with open('./ed25519.key') as f:
    private_key = f.read().strip()
with open('./ed25519_pub.der') as f:
    public_key = f.read().strip()

client = GridTradingClient(private_key, public_key)

try:
    markets = client.get_markets()
    print(f"Connected! Found {len(markets)} markets")
except Exception as e:
    print(f"Connection failed: {e}")
```

---

## Dependencies

### JavaScript/TypeScript

```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "tweetnacl": "^1.0.3",
    "tweetnacl-util": "^0.15.1",
    "ws": "^8.16.0"
  }
}
```

Install:
```bash
npm install axios tweetnacl tweetnacl-util ws
```

### Python

```
requests>=2.31.0
PyNaCl>=1.5.0
websocket-client>=1.7.0
```

Install:
```bash
pip install requests PyNaCl websocket-client
```

### Go

```go
module github.com/yourusername/grid-examples

go 1.18

// No external dependencies!
// Uses only Go standard library:
// - crypto/ed25519
// - crypto/sha256
// - encoding/base64
// - net/http
```

---

## Security Best Practices

### Key Storage

```javascript
// BAD - Keys in code
const privateKey = 'abc123...';

// GOOD - Keys from files
const privateKey = fs.readFileSync('./ed25519.key', 'utf8').trim();

// BETTER - Keys from environment
const privateKey = process.env.GRID_PRIVATE_KEY;

// BEST - Keys from secure key management system
const privateKey = await secretManager.getSecret('grid-private-key');
```

### .gitignore

Add to your `.gitignore`:

```
# GRID API Keys
ed25519.key
ed25519_pub.der
*.key
*.pem

# Environment files
.env
.env.local
```

### File Permissions

```bash
# Restrict private key access
chmod 600 ed25519.key
chmod 644 ed25519_pub.der
```

---

## Troubleshooting

### "Invalid Signature"

**Cause**: Timestamp skew or incorrect message construction

**Solution**:
```javascript
// Ensure message format is exactly:
const message = `${timestamp}${METHOD}${path}${body}`;

// For GET with no body:
const message = `${timestamp}GET/api/v1/trading/markets`; // Correct

// For POST with body:
const body = JSON.stringify({ market_id: 'abc' });
const message = `${timestamp}POST/api/v1/trading/orders${body}`; // Correct

// Common mistakes:
const message = `${timestamp}GETapi/v1/trading/markets`; // WRONG: Missing slash
const message = `${timestamp}POST/api/v1/trading/orders`; // WRONG: Missing body
```

### "Module Not Found"

**JavaScript**:
```bash
# Install dependencies in the examples/javascript directory
cd examples/javascript
npm install
```

**Python**:
```bash
# Install dependencies
pip install -r requirements.txt
# Or manually:
pip install requests PyNaCl
```

### "Permission Denied" Reading Keys

```bash
# Fix file permissions
chmod 600 ed25519.key
chmod 644 ed25519_pub.der

# Or run with sudo (not recommended)
```

### "Rate Limited"

```javascript
// Implement delays between requests
async function rateLimitedRequests(client, marketIds) {
  const results = [];
  
  for (const marketId of marketIds) {
    const ticker = await client.getTicker(marketId);
    results.push(ticker);
    
    // Wait 1 second between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}
```