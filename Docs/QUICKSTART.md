# GRID API Quick Start Guide

Get started with the GRID API in 5 minutes.

## Prerequisites

1. **GRID Account** - Register at https://grid.xyz
2. **Ed25519 Keys** - Generate authentication keys
3. **Development Tools** - Node.js, Python, or Go

## Step 1: Generate Authentication Keys

### Option A: Using OpenSSL

```bash
# Generate private key
openssl genpkey -algorithm Ed25519 -out ed25519.key

# Extract public key
openssl pkey -in ed25519.key -pubout -out ed25519_pub.der

# Extract base64 values
cat ed25519.key | grep -v "PRIVATE KEY" | tr -d '\n'
cat ed25519_pub.der | grep -v "PUBLIC KEY" | tr -d '\n'
```

### Option B: Using Code

**JavaScript**:

```javascript
const nacl = require('tweetnacl');
const util = require('tweetnacl-util');

const keyPair = nacl.sign.keyPair();
const privateKeyBase64 = util.encodeBase64(keyPair.secretKey);
const publicKeyBase64 = util.encodeBase64(keyPair.publicKey);

console.log('Private Key:', privateKeyBase64);
console.log('Public Key:', publicKeyBase64);

// Save these securely!
```

**Python**:

```python
from nacl.signing import SigningKey
import base64

private_key = SigningKey.generate()
public_key = private_key.verify_key

private_key_b64 = base64.b64encode(bytes(private_key)).decode()
public_key_b64 = base64.b64encode(bytes(public_key)).decode()

print(f'Private Key: {private_key_b64}')
print(f'Public Key: {public_key_b64}')

# Save these securely!
```

## Step 2: Register Your Public Key

Use your existing account session to register the public key:

```javascript
// After logging in to the web app, register your signing key
const response = await fetch(
  'https://trading.api.thegrid.ai/v1/signing-keys',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include', // Important: includes session cookie
    body: JSON.stringify({
      signing_key: {
        label: 'My Trading Key',
        public_key: '<your_public_key_base64>'
      }
    })
  }
);

const result = await response.json();
console.log('Key registered:', result);
```

## Step 3: Make Your First API Call

### JavaScript/TypeScript

```javascript
const axios = require('axios');
const nacl = require('tweetnacl');
const util = require('tweetnacl-util');
const crypto = require('crypto');

class SignatureAuth {
  constructor(privateKeyBase64, publicKeyBase64) {
    this.privateKey = util.decodeBase64(privateKeyBase64);
    
    const publicKeyBuffer = Buffer.from(publicKeyBase64, 'base64');
    const hash = crypto.createHash('sha256').update(publicKeyBuffer).digest('base64');
    this.fingerprint = hash.replace(/=+$/, '');
  }

  getHeaders(method, path, body = '') {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const message = `${timestamp}${method.toUpperCase()}${path}${body}`;
    
    const messageBytes = util.decodeUTF8(message);
    const signatureBytes = nacl.sign.detached(messageBytes, this.privateKey);
    const signature = util.encodeBase64(signatureBytes);

    return {
      'x-thegrid-signature': signature,
      'x-thegrid-timestamp': timestamp,
      'x-thegrid-fingerprint': this.fingerprint
    };
  }
}

// Initialize auth
const auth = new SignatureAuth(
  '<your_private_key_base64>',
  '<your_public_key_base64>'
);

// Make API call
async function getMarkets() {
  const path = '/api/v1/trading/markets';
  const headers = auth.getHeaders('GET', path, '');
  
  const response = await axios.get(
    'https://trading.api.thegrid.ai' + path,
    {
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }
  );
  
  return response.data;
}

// Test it
getMarkets().then(data => {
  console.log('Markets:', data.data);
}).catch(error => {
  console.error('Error:', error.message);
});
```

### Python

```python
import time
import hashlib
import base64
import requests
from nacl.signing import SigningKey
from nacl.encoding import Base64Encoder

class SignatureAuth:
    def __init__(self, private_key_b64, public_key_b64):
        self.private_key = SigningKey(base64.b64decode(private_key_b64))
        
        public_key_bytes = base64.b64decode(public_key_b64)
        hash_digest = hashlib.sha256(public_key_bytes).digest()
        self.fingerprint = base64.b64encode(hash_digest).decode().rstrip('=')
    
    def get_headers(self, method, path, body=''):
        timestamp = str(int(time.time()))
        message = f"{timestamp}{method.upper()}{path}{body}"
        
        signature = self.private_key.sign(message.encode()).signature
        signature_b64 = base64.b64encode(signature).decode()
        
        return {
            'x-thegrid-signature': signature_b64,
            'x-thegrid-timestamp': timestamp,
            'x-thegrid-fingerprint': self.fingerprint
        }

# Initialize auth
auth = SignatureAuth(
    '<your_private_key_base64>',
    '<your_public_key_base64>'
)

# Make API call
def get_markets():
    path = '/api/v1/trading/markets'
    headers = auth.get_headers('GET', path, '')
    headers['Content-Type'] = 'application/json'
    
    response = requests.get(
        'https://trading.api.thegrid.ai' + path,
        headers=headers
    )
    
    response.raise_for_status()
    return response.json()

# Test it
try:
    data = get_markets()
    print('Markets:', data['data'])
except Exception as e:
    print('Error:', e)
```

## Step 4: Common Operations

### Get Account Balances

```javascript
const path = '/api/v1/trading/trading-accounts';
const headers = auth.getHeaders('GET', path, '');

const response = await axios.get(
  'https://trading.api.thegrid.ai' + path,
  { headers }
);

console.log('Balances:', response.data.data);
```

### Place a Trade

```javascript
const orderData = {
  market_id: 'market_abc',
  side: 'buy',
  type: 'limit',
  quantity: 100,
  price: '45.50',
  time_in_force: 'gtc',
  client_order_id: `order-${Date.now()}`
};

const path = '/api/v1/trading/orders';
const body = JSON.stringify(orderData);
const headers = auth.getHeaders('POST', path, body);

const response = await axios.post(
  'https://trading.api.thegrid.ai' + path,
  orderData,
  {
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  }
);

console.log('Order placed:', response.data.data);
```

### Use AI Chat Completion

```javascript
// No Ed25519 signature needed - uses API key

const apiKey = '<your_consumption_api_key>';

const response = await axios.post(
  'https://trading.api.thegrid.ai/v1/consumption/chat',
  {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Hello!' }
    ],
    temperature: 0.7,
    max_tokens: 150
  },
  {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }
  }
);

console.log('Response:', response.data.data.choices[0].message.content);
```

## Step 5: Connect to WebSocket

### Public Market Data (No Auth)

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('wss://trading.api.thegrid.ai/v1/');

ws.on('open', () => {
  console.log('Connected');
  
  // Subscribe to ticker
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'ticker',
    market_id: 'market_abc'
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.type === 'ticker') {
    console.log(`Price: $${msg.last_price}`);
  }
});
```

### Private Channels (Requires Login)

```javascript
// First login to get session
const loginResponse = await axios.post(
  'https://trading.api.thegrid.ai/v1/users/log-in',
  {
    user: {
      email: 'your@email.com',
      password: 'YourPassword123!'
    }
  }
);

const userId = loginResponse.data.data.id;

// Then connect WebSocket with session cookie
const ws = new WebSocket('wss://trading.api.thegrid.ai/v1/');

ws.on('open', () => {
  // Subscribe to your orders
  ws.send(JSON.stringify({
    type: 'join',
    channel: 'orders',
    user_id: userId
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.type === 'new_order') {
    console.log('New order:', msg.data);
  } else if (msg.type === 'update_order') {
    console.log('Order updated:', msg.data);
  }
});
```

## Common Workflows

### Workflow 1: Buy AI Tokens for Consumption

```javascript
// 1. Check consumption balance
const consumption = await client.getConsumptionInstruments();
console.log('Current balance:', consumption);

// 2. If low, buy more on exchange
const order = await client.placeOrder({
  market_id: 'market_abc',
  side: 'buy',
  type: 'market',
  quantity: 100
});

// 3. Wait for order to fill (use WebSocket in production)
await new Promise(resolve => setTimeout(resolve, 5000));

// 4. Transfer to consumption account
const transfer = await client.transferToConsumption('instrument_gpt4', 100);
console.log('Transfer initiated:', transfer.transfer_id);

// 5. Wait for transfer to complete
await new Promise(resolve => setTimeout(resolve, 3000));

// 6. Use for AI inference
const chatResponse = await axios.post(
  'https://trading.api.thegrid.ai/v1/consumption/chat',
  {
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }]
  },
  {
    headers: { Authorization: `Bearer ${apiKey}` }
  }
);
```

### Workflow 2: Monitor Market and Trade

```javascript
// 1. Subscribe to market data
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'ticker',
  market_id: 'market_abc'
}));

// 2. Subscribe to your orders
ws.send(JSON.stringify({
  type: 'join',
  channel: 'orders',
  user_id: userId
}));

// 3. Place order when price is right
ws.on('message', async (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.type === 'ticker') {
    const price = parseFloat(msg.last_price);
    
    if (price < 45.00) {
      // Good price - place buy order
      const order = await client.placeOrder({
        market_id: 'market_abc',
        side: 'buy',
        type: 'limit',
        quantity: '100',
        price: '45.00',
        time_in_force: 'gtc'
      });
      
      console.log('Order placed:', order.order_id);
    }
  } else if (msg.type === 'update_order' && msg.data.status === 'filled') {
    console.log('Order filled!', msg.data);
  }
});
```

### Workflow 3: Build a Trading Bot

```javascript
const { GridTradingClient } = require('./examples/javascript/trading-client');

class SimpleTradingBot {
  constructor(privateKey, publicKey) {
    this.client = new GridTradingClient(privateKey, publicKey);
    this.position = null;
  }
  
  async start(marketId) {
    console.log('Starting trading bot...');
    
    // Get initial state
    const positions = await this.client.getPositions({ status: 'open' });
    this.position = positions.find(p => p.market_id === marketId);
    
    // Monitor market
    setInterval(async () => {
      await this.checkMarket(marketId);
    }, 60000); // Check every minute
  }
  
  async checkMarket(marketId) {
    try {
      // Get current price
      const ticker = await this.client.getTicker(marketId);
      const currentPrice = parseFloat(ticker.last_price);
      
      // Get recent candles for indicator
      const now = Math.floor(Date.now() / 1000);
      const start = now - (24 * 60 * 60); // 24 hours
      
      const candles = await this.client.getPriceHistory(marketId, '1h', start, now);
      
      if (candles.length < 20) return;
      
      // Calculate SMA-20
      const closes = candles.slice(-20).map(c => parseFloat(c.close));
      const sma20 = closes.reduce((a, b) => a + b, 0) / 20;
      
      // Simple strategy: Buy below SMA, sell above
      if (!this.position && currentPrice < sma20) {
        await this.buy(marketId, currentPrice);
      } else if (this.position && currentPrice > sma20) {
        await this.sell(marketId, currentPrice);
      }
      
    } catch (error) {
      console.error('Error checking market:', error.message);
    }
  }
  
  async buy(marketId, price) {
    console.log(`Buy signal at $${price}`);
    
    const order = await this.client.placeOrder({
      market_id: marketId,
      side: 'buy',
      type: 'limit',
      quantity: '100',
      price: price.toFixed(2),
      time_in_force: 'gtc'
    });
    
    console.log('Buy order placed:', order.order_id);
  }
  
  async sell(marketId, price) {
    console.log(`Sell signal at $${price}`);
    
    const order = await this.client.placeOrder({
      market_id: marketId,
      side: 'sell',
      type: 'limit',
      quantity: this.position.quantity.toString(),
      price: price.toFixed(2),
      time_in_force: 'gtc'
    });
    
    console.log('Sell order placed:', order.order_id);
  }
}

// Usage
const bot = new SimpleTradingBot(privateKey, publicKey);
bot.start('market_abc');
```

## Next Steps

### Learn More

1. **Trading** → Read [Trading API](./3-trading-api.md)
2. **Real-time Data** → Read [WebSockets](./5-websockets.md)
3. **AI Consumption** → Read [Consumption API](./2-consumption-api.md)
4. **Positions** → Read [Positions API](./6-positions-api.md)
5. **Charting** → Read [Price History API](./7-price-history-api.md)

### Use Code Examples

Pre-built clients are available in [examples/](./examples/):

```bash
# JavaScript
cd examples/javascript
npm install axios tweetnacl tweetnacl-util
node trading-client.js

# Python
cd examples/python
pip install requests pynacl
python trading_client.py
```

### Explore Advanced Features

- [Instruments API](./8-instruments-api.md) - Find AI models
- [User Management](./9-user-management-api.md) - Account management
- [Key Management](./10-key-management-api.md) - Rotate keys
- [Transfers](./11-transfers-and-issuance-api.md) - Move funds

## Common Issues

### "Invalid Signature"

**Cause**: Timestamp skew or incorrect message construction

**Solution**:
```javascript
// Ensure your system clock is accurate
// Message must be: timestamp + METHOD + path + body

// Correct
const message = `${timestamp}GET/api/v1/trading/markets`;

// Incorrect (missing path slash)
const message = `${timestamp}GETapi/v1/trading/markets`;

// Incorrect (POST with body - body must be included)
const message = `${timestamp}POST/api/v1/trading/orders`; // Missing body!
```

### "Expired Timestamp"

**Cause**: Request timestamp more than 30 seconds old

**Solution**: Ensure system time is synchronized (use NTP)

### "INSUFFICIENT_BALANCE"

**Cause**: Not enough funds in account

**Solution**:
```javascript
// Check balance first
const accounts = await client.getTradingAccounts();
const usdAccount = accounts.find(a => a.currency === 'USD');
console.log('Available:', usdAccount.available);

// Then place order within balance
```

### "Rate Limited"

**Cause**: Too many requests

**Solution**: Implement exponential backoff
```javascript
async function withRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.response?.status === 429) {
        const retryAfter = error.response.data.error.details?.retry_after || 60;
        console.log(`Rate limited. Waiting ${retryAfter}s...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      throw error;
    }
  }
}
```

## Security Checklist

- [ ] Private keys stored securely (not in code)
- [ ] Keys not committed to version control
- [ ] Using environment variables or key management
- [ ] API keys rotated regularly
- [ ] HTTPS used for all requests
- [ ] Request signing implemented correctly
- [ ] Error messages don't expose sensitive data
- [ ] Rate limiting implemented
- [ ] Logging doesn't include keys or tokens

## Testing Your Integration

```bash
# 1. Test authentication
curl -X GET \
  "https://trading.api.thegrid.ai/v1/users/self" \
  -H "x-thegrid-signature: ${SIGNATURE}" \
  -H "x-thegrid-timestamp: ${TIMESTAMP}" \
  -H "x-thegrid-fingerprint: ${FINGERPRINT}"

# 2. Test public endpoints (no auth)
curl https://trading.api.thegrid.ai/v1/instruments

# 3. Test WebSocket
wscat -c wss://trading.api.thegrid.ai/v1/

# Then send:
{"type":"subscribe","channel":"ticker","market_id":"market_abc"}
```

## Support

- **Documentation**: See [README](./README.md) for full documentation
- **Examples**: See [examples/](./examples/) for complete code
- **API Reference**: See [API Reference Index](./API-REFERENCE-INDEX.md)
- **Email**: support@thegrid.ai

## What's Next?

1. ✅ You've made your first API call
2. 📚 Read the full documentation for your use case
3. 💻 Copy and customize the example code
4. 🧪 Test in development environment
5. 🚀 Deploy to production

**Happy trading! 🚀**


