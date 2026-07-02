# Getting Started with The Grid

Complete guide to buying and consuming AI inference on The Grid exchange.

---

# 1. Getting Started

## 1.1 Getting Started Overview

The Grid is a market for AI inference. It treats inference as a standardized commodity called an Instrument, and lets suppliers and buyers meet in a single real-time market.

- If you are interested in consuming inference, continue to **Getting Started as a Consumer** (Section 1.2)
- If you are interested in becoming a Supplier, continue to **Supplying to The Grid** (Section 1.3)

---

## 1.2 Getting Started as a Consumer

This section walks you through buying your first Instrument Unit (1M tokens) and making your first consumption call.

### Step 1: Sign up and get your keys

1. Create an account at [thegrid.ai](https://thegrid.ai/)
2. Navigate to Settings > API Keys
3. Create two types of keys:
   - **Trading API Key** - For buying instruments on the exchange
   - **Consumption API Key** - For making AI inference calls

**Store your keys securely:**

```bash
# Environment variables (recommended)
export GRID_TRADING_PRIVATE_KEY="<your_base64_private_key>"
export GRID_TRADING_PUBLIC_KEY="<your_base64_public_key>"
export GRID_CONSUMPTION_API_KEY="<your_consumption_key>"
```

Or generate Ed25519 signing keys programmatically:

**JavaScript:**
```javascript
const nacl = require('tweetnacl');
const util = require('tweetnacl-util');

// Generate key pair
const keyPair = nacl.sign.keyPair();
const privateKey = util.encodeBase64(keyPair.secretKey);
const publicKey = util.encodeBase64(keyPair.publicKey);

console.log('Private Key:', privateKey);
console.log('Public Key:', publicKey);

// Register public key via the app or API
```

**Python:**
```python
from nacl.signing import SigningKey
import base64

# Generate key pair
private_key = SigningKey.generate()
public_key = private_key.verify_key

private_key_b64 = base64.b64encode(bytes(private_key)).decode()
public_key_b64 = base64.b64encode(bytes(public_key)).decode()

print(f'Private Key: {private_key_b64}')
print(f'Public Key: {public_key_b64}')

# Register public key via the app or API
```

**Go:**
```go
package main

import (
    "crypto/ed25519"
    "encoding/base64"
    "fmt"
)

func main() {
    // Generate key pair
    publicKey, privateKey, _ := ed25519.GenerateKey(nil)
    
    privateKeyB64 := base64.StdEncoding.EncodeToString(privateKey)
    publicKeyB64 := base64.StdEncoding.EncodeToString(publicKey)
    
    fmt.Println("Private Key:", privateKeyB64)
    fmt.Println("Public Key:", publicKeyB64)
    
    // Register public key via the app or API
}
```

---

### Step 2: Pick an Instrument

Start with the current instruments page and pick one:

- **Chat Fast**: suited for latency-sensitive UX, high throughput, shorter outputs
- **Chat Prime**: suited for higher reasoning quality, longer outputs, deeper workflows

Read more about [Current Instruments](https://thegrid.ai/docs/instruments-and-specifications/current-instruments-chat-prime-and-chat-fast) to guide your decision.

**List available instruments programmatically:**

**JavaScript:**
```javascript
const axios = require('axios');

const BASE_URL = 'https://trading.api.thegrid.ai/v1';

async function listInstruments() {
  const response = await axios.get(`${BASE_URL}/instruments`);
  const instruments = response.data.data;
  
  instruments.forEach(inst => {
    if (inst.instrument_type === 'ai_commodity') {
      console.log(`${inst.symbol} (${inst.instrument_id})`);
      console.log(`  ${inst.description}`);
    }
  });
  
  return instruments;
}

const instruments = await listInstruments();
```

**Python:**
```python
import requests

BASE_URL = 'https://trading.api.thegrid.ai/v1'

def list_instruments():
    response = requests.get(f'{BASE_URL}/instruments')
    instruments = response.json()['data']
    
    for inst in instruments:
        if inst['instrument_type'] == 'ai_commodity':
            print(f"{inst['symbol']} ({inst['instrument_id']})")
            print(f"  {inst['description']}")
    
    return instruments

instruments = list_instruments()
```

**Go:**
```go
package main

import (
    "encoding/json"
    "fmt"
    "net/http"
)

const BaseURL = "https://trading.api.thegrid.ai/v1"

type Instrument struct {
    InstrumentID   string `json:"instrument_id"`
    Symbol         string `json:"symbol"`
    InstrumentType string `json:"instrument_type"`
    Description    string `json:"description"`
}

type InstrumentsResponse struct {
    Data []Instrument `json:"data"`
}

func listInstruments() ([]Instrument, error) {
    resp, err := http.Get(BaseURL + "/instruments")
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    var result InstrumentsResponse
    json.NewDecoder(resp.Body).Decode(&result)
    
    for _, inst := range result.Data {
        if inst.InstrumentType == "ai_commodity" {
            fmt.Printf("%s (%s)\n", inst.Symbol, inst.InstrumentID)
            fmt.Printf("  %s\n", inst.Description)
        }
    }
    
    return result.Data, nil
}
```

---

### Step 3: Buy 1 Unit

You can buy units through the app or programmatically through the Trading API.

**Buy using the Trading API:**

**JavaScript:**
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

const BASE_URL = 'https://trading.api.thegrid.ai/v1';

async function buyInstrumentUnit(auth, marketId, quantity, maxPrice) {
  // Place limit buy order
  const orderData = {
    market_id: marketId,
    side: 'buy',
    type: 'limit',
    quantity: quantity,
    price: maxPrice.toString(),
    time_in_force: 'gtc',
    client_order_id: `buy-${Date.now()}`
  };
  
  const path = '/api/v1/trading/orders';
  const body = JSON.stringify(orderData);
  const headers = auth.getHeaders('POST', path, body);
  
  const response = await axios.post(`${BASE_URL}${path}`, orderData, {
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
  
  const orderId = response.data.data.order_id;
  console.log(`Order placed: ${orderId}`);
  
  // Wait for order to fill
  let filled = false;
  while (!filled) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const orderPath = `/api/v1/trading/orders/${orderId}`;
    const orderHeaders = auth.getHeaders('GET', orderPath, '');
    
    const orderResp = await axios.get(`${BASE_URL}${orderPath}`, {
      headers: orderHeaders
    });
    
    const order = orderResp.data.data;
    
    if (order.status === 'filled') {
      console.log('Order filled!');
      filled = true;
    } else if (['closed', 'cancelled'].includes(order.status)) {
      throw new Error(`Order ${order.status}: ${order.closure_reason || 'unknown'}`);
    }
  }
  
  return orderId;
}

// Usage
const auth = new SignatureAuth(
  process.env.GRID_TRADING_PRIVATE_KEY,
  process.env.GRID_TRADING_PUBLIC_KEY
);

const orderId = await buyInstrumentUnit(auth, 'market_abc', 1, 12.50);
```

**Python:**
```python
import time
import hashlib
import base64
import requests
import json
from nacl.signing import SigningKey

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

BASE_URL = 'https://trading.api.thegrid.ai/v1'

def buy_instrument_unit(auth, market_id, quantity, max_price):
    """Buy instrument units on the exchange"""
    # Place limit buy order
    order_data = {
        'market_id': market_id,
        'side': 'buy',
        'type': 'limit',
        'quantity': quantity,
        'price': str(max_price),
        'time_in_force': 'gtc',
        'client_order_id': f'buy-{int(time.time())}'
    }
    
    path = '/api/v1/trading/orders'
    body = json.dumps(order_data)
    headers = auth.get_headers('POST', path, body)
    headers['Content-Type'] = 'application/json'
    
    response = requests.post(f'{BASE_URL}{path}', json=order_data, headers=headers)
    response.raise_for_status()
    
    order_id = response.json()['data']['order_id']
    print(f'Order placed: {order_id}')
    
    # Wait for order to fill
    while True:
        time.sleep(1)
        
        order_path = f'/api/v1/trading/orders/{order_id}'
        order_headers = auth.get_headers('GET', order_path, '')
        
        order_resp = requests.get(f'{BASE_URL}{order_path}', headers=order_headers)
        order = order_resp.json()['data']
        
        if order['status'] == 'filled':
            print('Order filled!')
            break
        elif order['status'] in ['closed', 'cancelled']:
            raise Exception(f"Order {order['status']}: {order.get('closure_reason', 'unknown')}")
    
    return order_id

# Usage
import os
auth = SignatureAuth(
    os.environ['GRID_TRADING_PRIVATE_KEY'],
    os.environ['GRID_TRADING_PUBLIC_KEY']
)

order_id = buy_instrument_unit(auth, 'market_abc', 1, 12.50)
```

**Go:**
```go
package main

import (
    "bytes"
    "crypto/ed25519"
    "crypto/sha256"
    "encoding/base64"
    "encoding/json"
    "fmt"
    "net/http"
    "os"
    "strconv"
    "time"
)

const BaseURL = "https://trading.api.thegrid.ai/v1"

type SignatureAuth struct {
    privateKey  ed25519.PrivateKey
    fingerprint string
}

func NewSignatureAuth(privateKeyB64, publicKeyB64 string) (*SignatureAuth, error) {
    privateKeyBytes, _ := base64.StdEncoding.DecodeString(privateKeyB64)
    privateKey := ed25519.PrivateKey(privateKeyBytes)
    
    publicKeyBytes, _ := base64.StdEncoding.DecodeString(publicKeyB64)
    hash := sha256.Sum256(publicKeyBytes)
    fingerprint := base64.StdEncoding.EncodeToString(hash[:])
    
    return &SignatureAuth{
        privateKey:  privateKey,
        fingerprint: fingerprint,
    }, nil
}

func (sa *SignatureAuth) GetHeaders(method, path, body string) map[string]string {
    timestamp := strconv.FormatInt(time.Now().Unix(), 10)
    message := timestamp + method + path + body
    
    signature := ed25519.Sign(sa.privateKey, []byte(message))
    signatureB64 := base64.StdEncoding.EncodeToString(signature)
    
    return map[string]string{
        "x-thegrid-signature":   signatureB64,
        "x-thegrid-timestamp":   timestamp,
        "x-thegrid-fingerprint": sa.fingerprint,
    }
}

func buyInstrumentUnit(auth *SignatureAuth, marketID string, quantity int, maxPrice float64) (string, error) {
    // Place limit buy order
    orderData := map[string]interface{}{
        "market_id":       marketID,
        "side":            "buy",
        "type":            "limit",
        "quantity":        quantity,
        "price":           fmt.Sprintf("%.2f", maxPrice),
        "time_in_force":   "gtc",
        "client_order_id": fmt.Sprintf("buy-%d", time.Now().Unix()),
    }
    
    orderJSON, _ := json.Marshal(orderData)
    path := "/api/v1/trading/orders"
    headers := auth.GetHeaders("POST", path, string(orderJSON))
    
    req, _ := http.NewRequest("POST", BaseURL+path, bytes.NewBuffer(orderJSON))
    req.Header.Set("Content-Type", "application/json")
    for k, v := range headers {
        req.Header.Set(k, v)
    }
    
    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        return "", err
    }
    defer resp.Body.Close()
    
    var orderResp struct {
        Data struct {
            OrderID string `json:"order_id"`
        } `json:"data"`
    }
    json.NewDecoder(resp.Body).Decode(&orderResp)
    
    orderID := orderResp.Data.OrderID
    fmt.Printf("Order placed: %s\n", orderID)
    
    // Wait for order to fill
    for {
        time.Sleep(1 * time.Second)
        
        orderPath := fmt.Sprintf("/api/v1/trading/orders/%s", orderID)
        orderHeaders := auth.GetHeaders("GET", orderPath, "")
        
        orderReq, _ := http.NewRequest("GET", BaseURL+orderPath, nil)
        for k, v := range orderHeaders {
            orderReq.Header.Set(k, v)
        }
        
        orderResp, _ := client.Do(orderReq)
        
        var order struct {
            Data struct {
                Status        string `json:"status"`
                ClosureReason string `json:"closure_reason"`
            } `json:"data"`
        }
        json.NewDecoder(orderResp.Body).Decode(&order)
        orderResp.Body.Close()
        
        if order.Data.Status == "filled" {
            fmt.Println("Order filled!")
            break
        } else if order.Data.Status == "closed" || order.Data.Status == "cancelled" {
            return "", fmt.Errorf("order %s: %s", order.Data.Status, order.Data.ClosureReason)
        }
    }
    
    return orderID, nil
}

// Usage
func main() {
    auth, _ := NewSignatureAuth(
        os.Getenv("GRID_TRADING_PRIVATE_KEY"),
        os.Getenv("GRID_TRADING_PUBLIC_KEY"),
    )
    
    orderID, _ := buyInstrumentUnit(auth, "market_abc", 1, 12.50)
    fmt.Printf("Purchase complete: %s\n", orderID)
}
```

**Note**: Today, Units bought in your Trading Account transfer to your Consumption Account automatically. Read more [here](https://thegrid.ai/docs/core-concepts/trading-and-consumption-accounts).

---

### Step 4: Setup a Consumption API Key

You created this in Step 1. If not, create a consumption API key in the app under Settings > API Keys.

Store it securely:

```bash
export GRID_CONSUMPTION_API_KEY="<your_consumption_key>"
```

---

### Step 5: Make 1 chat call

Call the Consumption API to consume tokens from your active Lot.

**JavaScript:**
```javascript
const axios = require('axios');

const CONSUMPTION_URL = 'https://trading.api.thegrid.ai/v1';
const consumptionKey = process.env.GRID_CONSUMPTION_API_KEY;

async function chatCompletion(messages, instrumentId = 'gpt-4') {
  const response = await axios.post(
    `${CONSUMPTION_URL}/consumption/chat`,
    {
      model: instrumentId,
      messages: messages,
      temperature: 0.7,
      max_tokens: 150,
      stream: false
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${consumptionKey}`
      }
    }
  );
  
  return response.data.data;
}

// Usage
const result = await chatCompletion([
  { role: 'system', content: 'Be concise and correct.' },
  { role: 'user', content: 'Write one paragraph on why inference needs a market.' }
]);

console.log('Response:', result.choices[0].message.content);
console.log('Tokens used:', result.usage.total_tokens);
console.log('Request ID:', result.id);
```

**Python:**
```python
import requests
import os

CONSUMPTION_URL = 'https://trading.api.thegrid.ai/v1'
consumption_key = os.environ['GRID_CONSUMPTION_API_KEY']

def chat_completion(messages, instrument_id='gpt-4'):
    """Make a chat completion request"""
    response = requests.post(
        f'{CONSUMPTION_URL}/consumption/chat',
        json={
            'model': instrument_id,
            'messages': messages,
            'temperature': 0.7,
            'max_tokens': 150,
            'stream': False
        },
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {consumption_key}'
        }
    )
    
    response.raise_for_status()
    return response.json()['data']

# Usage
result = chat_completion([
    {'role': 'system', 'content': 'Be concise and correct.'},
    {'role': 'user', 'content': 'Write one paragraph on why inference needs a market.'}
])

print('Response:', result['choices'][0]['message']['content'])
print('Tokens used:', result['usage']['total_tokens'])
print('Request ID:', result['id'])
```

**Go:**
```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
    "os"
)

const ConsumptionURL = "https://trading.api.thegrid.ai/v1"

type ChatRequest struct {
    Model       string                   `json:"model"`
    Messages    []map[string]string      `json:"messages"`
    Temperature float64                  `json:"temperature"`
    MaxTokens   int                      `json:"max_tokens"`
    Stream      bool                     `json:"stream"`
}

type ChatResponse struct {
    Data struct {
        ID      string `json:"id"`
        Choices []struct {
            Message struct {
                Content string `json:"content"`
            } `json:"message"`
        } `json:"choices"`
        Usage struct {
            TotalTokens int `json:"total_tokens"`
        } `json:"usage"`
    } `json:"data"`
}

func chatCompletion(messages []map[string]string, instrumentID string) (*ChatResponse, error) {
    reqData := ChatRequest{
        Model:       instrumentID,
        Messages:    messages,
        Temperature: 0.7,
        MaxTokens:   150,
        Stream:      false,
    }
    
    reqJSON, _ := json.Marshal(reqData)
    
    req, _ := http.NewRequest("POST", ConsumptionURL+"/consumption/chat", bytes.NewBuffer(reqJSON))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Authorization", "Bearer "+os.Getenv("GRID_CONSUMPTION_API_KEY"))
    
    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    var chatResp ChatResponse
    json.NewDecoder(resp.Body).Decode(&chatResp)
    
    return &chatResp, nil
}

// Usage
func main() {
    messages := []map[string]string{
        {"role": "system", "content": "Be concise and correct."},
        {"role": "user", "content": "Write one paragraph on why inference needs a market."},
    }
    
    result, _ := chatCompletion(messages, "gpt-4")
    
    fmt.Println("Response:", result.Data.Choices[0].Message.Content)
    fmt.Println("Tokens used:", result.Data.Usage.TotalTokens)
    fmt.Println("Request ID:", result.Data.ID)
}
```

---

### Step 6: View your consumption stats

View your consumption instruments and token usage:

**JavaScript:**
```javascript
async function getConsumptionStats(auth) {
  const path = '/api/v1/consumption/instruments';
  const headers = auth.getHeaders('GET', path, '');
  
  const response = await axios.get(`${BASE_URL}${path}`, { headers });
  const instruments = response.data.data;
  
  instruments.forEach(inst => {
    const usagePct = (inst.tokens_used / inst.tokens_purchased) * 100;
    console.log(`${inst.instrument_name}:`);
    console.log(`  Total units: ${inst.total_amount}`);
    console.log(`  Tradeable units: ${inst.tradeable_amount}`);
    console.log(`  Tokens: ${inst.tokens_used.toLocaleString()} / ${inst.tokens_purchased.toLocaleString()}`);
    console.log(`  Usage: ${usagePct.toFixed(1)}%`);
  });
  
  return instruments;
}

const stats = await getConsumptionStats(auth);
```

**Python:**
```python
def get_consumption_stats(auth):
    """Get consumption statistics"""
    path = '/api/v1/consumption/instruments'
    headers = auth.get_headers('GET', path, '')
    
    response = requests.get(f'{BASE_URL}{path}', headers=headers)
    instruments = response.json()['data']
    
    for inst in instruments:
        usage_pct = (inst['tokens_used'] / inst['tokens_purchased']) * 100
        print(f"{inst['instrument_name']}:")
        print(f"  Total units: {inst['total_amount']}")
        print(f"  Tradeable units: {inst['tradeable_amount']}")
        print(f"  Tokens: {inst['tokens_used']:,} / {inst['tokens_purchased']:,}")
        print(f"  Usage: {usage_pct:.1f}%")
    
    return instruments

stats = get_consumption_stats(auth)
```

**Important Notes**:
- Tokens in a Lot must be consumed within 4 hours
- Unused tokens at expiry are lost and cannot be refunded

Read more about these rules [here](https://thegrid.ai/docs/core-concepts/lots-and-consumption-window).

---

### Congratulations on your first purchase and first call!

**Where to go next:**

- **Production use**: Continue to Section 2.1 - Operating on The Grid as an Ongoing Customer
- **Migration**: Continue to Section 2.2 - Migrating from Existing Providers

---

## 1.3 Supplying to The Grid

Fill out this form to express your interest in joining us as a Supplier: [Supplier Interest Form]

We run a lightweight but deliberate process to ensure high-quality inference is delivered on The Grid. During onboarding we evaluate:

**Spec fit**
- Whether you can supply inference for any current [Instrument specifications](https://thegrid.ai/docs/instruments-and-specifications/instrument-specifications-as-of-jan-2026)

**Operational maturity**
- Uptime expectations, observability, incident response, and on-call support
- Ability to sustain performance during demand spikes or partial outages

**Collaboration readiness**
- Willingness to partner on rollout, remediation, and continuous improvement

**Compliance constraints**
- Compliance with local jurisdiction requirements for data storage, retrieval, and usage

---

# 2. Guides

## 2.1 Operating on The Grid as an Ongoing Customer

### 2.1.1 Using these templates

This guide gives you ready-to-use templates for managing buying and consumption through the Grid APIs.

These templates cover common production needs:
- Trading and Consumption balances
- Auto top-up to avoid running out of tokens mid-traffic
- Retries and error handling
- Price-aware buying
- Prime vs Fast routing
- Batch sequencing for bulk workloads

---

### 2.1.2 Working with credit limits

Credit limits and spending controls should be managed at your application layer. The Grid APIs provide the building blocks:

**Monitor spending:**

**JavaScript:**
```javascript
async function getSpendingStats(auth, startDate, endDate) {
  // Get trade history
  const tradesPath = '/api/v1/trading/trades';
  const params = {
    'filters[0][field]': 'execution_timestamp',
    'filters[0][op]': '>=',
    'filters[0][value]': startDate,
    'filters[1][field]': 'execution_timestamp',
    'filters[1][op]': '<=',
    'filters[1][value]': endDate
  };
  
  const headers = auth.getHeaders('GET', tradesPath, '');
  const response = await axios.get(`${BASE_URL}${tradesPath}`, { params, headers });
  const trades = response.data.data;
  
  // Calculate total spent
  const totalSpent = trades.reduce((sum, trade) => 
    sum + parseFloat(trade.total_value), 0
  );
  
  console.log(`Total spent: $${totalSpent.toFixed(2)}`);
  console.log(`Number of purchases: ${trades.length}`);
  
  return { totalSpent, tradeCount: trades.length };
}

const stats = await getSpendingStats(auth, '2025-01-01T00:00:00Z', '2025-01-31T23:59:59Z');
```

**Implement spending limits:**

```javascript
class SpendingLimitGuard {
  constructor(dailyLimit, monthlyLimit) {
    this.dailyLimit = dailyLimit;
    this.monthlyLimit = monthlyLimit;
  }

  async canPlaceOrder(auth, orderValue) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const dailyStats = await getSpendingStats(auth, today.toISOString(), new Date().toISOString());
    const monthlyStats = await getSpendingStats(auth, monthStart.toISOString(), new Date().toISOString());
    
    if (dailyStats.totalSpent + orderValue > this.dailyLimit) {
      console.error(`Daily limit would be exceeded: $${dailyStats.totalSpent} + $${orderValue} > $${this.dailyLimit}`);
      return false;
    }
    
    if (monthlyStats.totalSpent + orderValue > this.monthlyLimit) {
      console.error(`Monthly limit would be exceeded: $${monthlyStats.totalSpent} + $${orderValue} > $${this.monthlyLimit}`);
      return false;
    }
    
    return true;
  }
}

// Usage
const guard = new SpendingLimitGuard(100, 1000); // $100/day, $1000/month

if (await guard.canPlaceOrder(auth, 15.00)) {
  await buyInstrumentUnit(auth, 'market_abc', 1, 15.00);
}
```

---

### 2.1.3 Working with Trading and Consumption balances

**Check your balances:**

**JavaScript:**
```javascript
async function getBalances(auth) {
  // Get trading balances
  const tradingPath = '/api/v1/trading/trading-accounts';
  const tradingHeaders = auth.getHeaders('GET', tradingPath, '');
  
  const tradingResp = await axios.get(`${BASE_URL}${tradingPath}`, {
    headers: tradingHeaders
  });
  
  const tradingBalances = tradingResp.data.data;
  
  // Get consumption instruments
  const consumptionPath = '/api/v1/consumption/instruments';
  const consumptionHeaders = auth.getHeaders('GET', consumptionPath, '');
  
  const consumptionResp = await axios.get(`${BASE_URL}${consumptionPath}`, {
    headers: consumptionHeaders
  });
  
  const consumptionBalances = consumptionResp.data.data;
  
  console.log('Trading Balances:');
  tradingBalances.forEach(acct => {
    console.log(`  ${acct.instrument_symbol}: ${acct.available_balance} units available`);
  });
  
  console.log('\nConsumption Balances:');
  consumptionBalances.forEach(inst => {
    const remaining = inst.tokens_purchased - inst.tokens_used;
    console.log(`  ${inst.instrument_name}:`);
    console.log(`    Units: ${inst.total_amount} (${inst.tradeable_amount} tradeable)`);
    console.log(`    Tokens remaining: ${remaining.toLocaleString()}`);
  });
  
  return { trading: tradingBalances, consumption: consumptionBalances };
}

const balances = await getBalances(auth);
```

**Python:**
```python
def get_balances(auth):
    """Get trading and consumption balances"""
    # Get trading balances
    trading_path = '/api/v1/trading/trading-accounts'
    trading_headers = auth.get_headers('GET', trading_path, '')
    
    trading_resp = requests.get(f'{BASE_URL}{trading_path}', headers=trading_headers)
    trading_balances = trading_resp.json()['data']
    
    # Get consumption instruments
    consumption_path = '/api/v1/consumption/instruments'
    consumption_headers = auth.get_headers('GET', consumption_path, '')
    
    consumption_resp = requests.get(f'{BASE_URL}{consumption_path}', headers=consumption_headers)
    consumption_balances = consumption_resp.json()['data']
    
    print('Trading Balances:')
    for acct in trading_balances:
        print(f"  {acct['instrument_symbol']}: {acct['available_balance']} units available")
    
    print('\nConsumption Balances:')
    for inst in consumption_balances:
        remaining = inst['tokens_purchased'] - inst['tokens_used']
        print(f"  {inst['instrument_name']}:")
        print(f"    Units: {inst['total_amount']} ({inst['tradeable_amount']} tradeable)")
        print(f"    Tokens remaining: {remaining:,}")
    
    return {'trading': trading_balances, 'consumption': consumption_balances}

balances = get_balances(auth)
```

---

### 2.1.4 Replenish your balance in the Consumption Account

Keep a minimum buffer of tokens available so your app does not fail due to insufficient balance.

**JavaScript:**
```javascript
async function autoReplenish(auth, instrumentId, minTokens, unitsPerPurchase, maxPrice) {
  const pollIntervalMs = 60000; // 60 seconds
  
  async function tokensRemaining() {
    const path = '/api/v1/consumption/instruments';
    const params = {
      'filters[0][field]': 'instrument_id',
      'filters[0][value]': instrumentId
    };
    
    const headers = auth.getHeaders('GET', path, '');
    const response = await axios.get(`${BASE_URL}${path}`, { params, headers });
    
    const instruments = response.data.data;
    if (instruments.length === 0) return 0;
    
    const inst = instruments[0];
    return inst.tokens_purchased - inst.tokens_used;
  }
  
  setInterval(async () => {
    try {
      const remaining = await tokensRemaining();
      console.log(`Tokens remaining: ${remaining.toLocaleString()}`);
      
      if (remaining >= minTokens) {
        console.log('Balance sufficient');
        return;
      }
      
      console.log(`Low balance! Buying ${unitsPerPurchase} unit(s)...`);
      
      const orderData = {
        market_id: 'market_abc', // Get from market list
        side: 'buy',
        type: 'limit',
        quantity: unitsPerPurchase,
        price: maxPrice.toString(),
        time_in_force: 'gtc'
      };
      
      const path = '/api/v1/trading/orders';
      const body = JSON.stringify(orderData);
      const headers = auth.getHeaders('POST', path, body);
      
      const response = await axios.post(`${BASE_URL}${path}`, orderData, {
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      });
      
      console.log(`Replenish order placed: ${response.data.data.order_id}`);
      
    } catch (error) {
      console.error('Auto-replenish error:', error.message);
    }
  }, pollIntervalMs);
}

// Usage
autoReplenish(auth, 'instrument_gpt4', 200000, 1, 15.00);
```

**Python:**
```python
import time
import threading

def auto_replenish(auth, instrument_id, min_tokens, units_per_purchase, max_price, market_id):
    """Auto-replenish tokens when balance is low"""
    poll_interval_s = 60
    
    def tokens_remaining():
        path = '/api/v1/consumption/instruments'
        params = {
            'filters[0][field]': 'instrument_id',
            'filters[0][value]': instrument_id
        }
        
        headers = auth.get_headers('GET', path, '')
        response = requests.get(f'{BASE_URL}{path}', params=params, headers=headers)
        
        instruments = response.json()['data']
        if not instruments:
            return 0
        
        inst = instruments[0]
        return inst['tokens_purchased'] - inst['tokens_used']
    
    def check_and_buy():
        while True:
            try:
                remaining = tokens_remaining()
                print(f'Tokens remaining: {remaining:,}')
                
                if remaining >= min_tokens:
                    print('Balance sufficient')
                    time.sleep(poll_interval_s)
                    continue
                
                print(f'Low balance! Buying {units_per_purchase} unit(s)...')
                
                order_data = {
                    'market_id': market_id,
                    'side': 'buy',
                    'type': 'limit',
                    'quantity': units_per_purchase,
                    'price': str(max_price),
                    'time_in_force': 'gtc'
                }
                
                path = '/api/v1/trading/orders'
                body = json.dumps(order_data)
                headers = auth.get_headers('POST', path, body)
                headers['Content-Type'] = 'application/json'
                
                response = requests.post(f'{BASE_URL}{path}', json=order_data, headers=headers)
                
                print(f"Replenish order placed: {response.json()['data']['order_id']}")
                
            except Exception as e:
                print(f'Auto-replenish error: {e}')
            
            time.sleep(poll_interval_s)
    
    # Run in background thread
    thread = threading.Thread(target=check_and_buy, daemon=True)
    thread.start()

# Usage
auto_replenish(auth, 'instrument_gpt4', 200000, 1, 15.00, 'market_abc')

# Keep main thread alive
while True:
    time.sleep(1)
```

---

### 2.1.5 Retries and error handling

The Grid routes across suppliers to deliver an Instrument, but your app should still implement standard retries.

**JavaScript:**
```javascript
async function callGridWithRetries(consumptionKey, request, maxAttempts = 3, timeoutMs = 20000) {
  const jitteredBackoff = (attempt) => {
    const baseDelay = Math.min(1000 * Math.pow(2, attempt), 10000);
    const jitter = Math.random() * 1000;
    return baseDelay + jitter;
  };
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axios.post(
        `${CONSUMPTION_URL}/consumption/chat`,
        request,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${consumptionKey}`
          },
          timeout: timeoutMs
        }
      );
      
      return response.data.data;
      
    } catch (error) {
      if (error.response) {
        const { status, data } = error.response;
        
        // Don't retry these errors
        if (status === 401) {
          throw new Error('Authentication failed: ' + data.error);
        }
        
        if (status === 400 && data.error.code === 'INSUFFICIENT_CREDITS') {
          throw new Error('Insufficient tokens: ' + data.error.message);
        }
        
        // Retry rate limits
        if (status === 429) {
          if (attempt < maxAttempts) {
            const delay = jitteredBackoff(attempt);
            console.log(`Rate limited. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
      }
      
      // Retry transient errors
      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        if (attempt < maxAttempts) {
          const delay = jitteredBackoff(attempt);
          console.log(`Network error. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      if (attempt === maxAttempts) {
        throw new Error('Retries exhausted: ' + error.message);
      }
    }
  }
}

// Usage
const result = await callGridWithRetries(
  process.env.GRID_CONSUMPTION_API_KEY,
  {
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello' }]
  }
);
```

**Python:**
```python
import requests
import time
import random

def call_grid_with_retries(consumption_key, request, max_attempts=3, timeout_ms=20000):
    """Call Grid API with retry logic"""
    
    def jittered_backoff(attempt):
        base_delay = min(1.0 * (2 ** attempt), 10.0)
        jitter = random.uniform(0, 1.0)
        return base_delay + jitter
    
    for attempt in range(1, max_attempts + 1):
        try:
            response = requests.post(
                f'{CONSUMPTION_URL}/consumption/chat',
                json=request,
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {consumption_key}'
                },
                timeout=timeout_ms / 1000
            )
            
            response.raise_for_status()
            return response.json()['data']
            
        except requests.exceptions.HTTPError as e:
            status = e.response.status_code
            data = e.response.json()
            
            # Don't retry authentication errors
            if status == 401:
                raise Exception(f'Authentication failed: {data.get("error")}')
            
            # Don't retry insufficient credits
            if status == 400 and data.get('error', {}).get('code') == 'INSUFFICIENT_CREDITS':
                raise Exception(f'Insufficient tokens: {data.get("error", {}).get("message")}')
            
            # Retry rate limits
            if status == 429:
                if attempt < max_attempts:
                    delay = jittered_backoff(attempt)
                    print(f'Rate limited. Retrying in {delay:.1f}s...')
                    time.sleep(delay)
                    continue
        
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
            # Retry transient network errors
            if attempt < max_attempts:
                delay = jittered_backoff(attempt)
                print(f'Network error. Retrying in {delay:.1f}s...')
                time.sleep(delay)
                continue
        
        if attempt == max_attempts:
            raise Exception('Retries exhausted')

# Usage
result = call_grid_with_retries(
    os.environ['GRID_CONSUMPTION_API_KEY'],
    {
        'model': 'gpt-4',
        'messages': [{'role': 'user', 'content': 'Hello'}]
    }
)
```

---

### 2.1.6 Opportunistic, price-aware buying

Buy only if the market price is below your maximum willingness to pay.

**JavaScript:**
```javascript
async function priceAwareBuying(auth, marketId, instrumentId, minTokens, unitsPerPurchase, maxPrice) {
  const pollIntervalMs = 60000;
  
  async function tokensRemaining() {
    const path = '/api/v1/consumption/instruments';
    const headers = auth.getHeaders('GET', path, '');
    const response = await axios.get(`${BASE_URL}${path}`, { headers });
    
    const inst = response.data.data.find(i => i.instrument_id === instrumentId);
    return inst ? (inst.tokens_purchased - inst.tokens_used) : 0;
  }
  
  async function getBestAsk() {
    const path = `/api/v1/trading/markets/${marketId}/orderbook`;
    const headers = auth.getHeaders('GET', path, '');
    const response = await axios.get(`${BASE_URL}${path}`, { 
      params: { depth: 1 },
      headers 
    });
    
    const orderbook = response.data.data;
    if (orderbook.sell && orderbook.sell.length > 0) {
      return parseFloat(orderbook.sell[0].price);
    }
    
    return null;
  }
  
  setInterval(async () => {
    try {
      const remaining = await tokensRemaining();
      
      if (remaining >= minTokens) {
        console.log(`Balance sufficient: ${remaining.toLocaleString()} tokens`);
        return;
      }
      
      const bestAsk = await getBestAsk();
      
      if (!bestAsk) {
        console.log('No asks available on market');
        return;
      }
      
      if (bestAsk <= maxPrice) {
        console.log(`Good price: $${bestAsk} <= $${maxPrice}. Buying...`);
        
        const orderData = {
          market_id: marketId,
          side: 'buy',
          type: 'limit',
          quantity: unitsPerPurchase,
          price: bestAsk.toString(),
          time_in_force: 'gtc'
        };
        
        const path = '/api/v1/trading/orders';
        const body = JSON.stringify(orderData);
        const headers = auth.getHeaders('POST', path, body);
        
        const response = await axios.post(`${BASE_URL}${path}`, orderData, {
          headers: {
            'Content-Type': 'application/json',
            ...headers
          }
        });
        
        console.log(`Order placed: ${response.data.data.order_id}`);
      } else {
        console.log(`Price too high: $${bestAsk} > $${maxPrice}. Skipping.`);
      }
      
    } catch (error) {
      console.error('Price-aware buying error:', error.message);
    }
  }, pollIntervalMs);
}

// Usage
priceAwareBuying(auth, 'market_abc', 'instrument_gpt4', 200000, 1, 15.00);
```

**Python:**
```python
def price_aware_buying(auth, market_id, instrument_id, min_tokens, units_per_purchase, max_price):
    """Buy only when price is acceptable"""
    poll_interval_s = 60
    
    def tokens_remaining():
        path = '/api/v1/consumption/instruments'
        headers = auth.get_headers('GET', path, '')
        response = requests.get(f'{BASE_URL}{path}', headers=headers)
        
        instruments = response.json()['data']
        inst = next((i for i in instruments if i['instrument_id'] == instrument_id), None)
        
        return (inst['tokens_purchased'] - inst['tokens_used']) if inst else 0
    
    def get_best_ask():
        path = f'/api/v1/trading/markets/{market_id}/orderbook'
        headers = auth.get_headers('GET', path, '')
        response = requests.get(f'{BASE_URL}{path}', params={'depth': 1}, headers=headers)
        
        orderbook = response.json()['data']
        if orderbook.get('sell') and len(orderbook['sell']) > 0:
            return float(orderbook['sell'][0]['price'])
        
        return None
    
    while True:
        try:
            remaining = tokens_remaining()
            
            if remaining >= min_tokens:
                print(f'Balance sufficient: {remaining:,} tokens')
                time.sleep(poll_interval_s)
                continue
            
            best_ask = get_best_ask()
            
            if not best_ask:
                print('No asks available on market')
                time.sleep(poll_interval_s)
                continue
            
            if best_ask <= max_price:
                print(f'Good price: ${best_ask} <= ${max_price}. Buying...')
                
                order_data = {
                    'market_id': market_id,
                    'side': 'buy',
                    'type': 'limit',
                    'quantity': units_per_purchase,
                    'price': str(best_ask),
                    'time_in_force': 'gtc'
                }
                
                path = '/api/v1/trading/orders'
                body = json.dumps(order_data)
                headers = auth.get_headers('POST', path, body)
                headers['Content-Type'] = 'application/json'
                
                response = requests.post(f'{BASE_URL}{path}', json=order_data, headers=headers)
                
                print(f"Order placed: {response.json()['data']['order_id']}")
            else:
                print(f'Price too high: ${best_ask} > ${max_price}. Skipping.')
        
        except Exception as e:
            print(f'Price-aware buying error: {e}')
        
        time.sleep(poll_interval_s)

# Usage (run in background)
price_aware_buying(auth, 'market_abc', 'instrument_gpt4', 200000, 1, 15.00)
```

---

### 2.1.7 Batching sequencer

Run batch jobs with a sequencer that controls time range, max price, concurrency, and spending.

**JavaScript:**
```javascript
class BatchJobSequencer {
  constructor(auth, consumptionKey, instrumentId, maxPrice, concurrency = 20) {
    this.auth = auth;
    this.consumptionKey = consumptionKey;
    this.instrumentId = instrumentId;
    this.maxPrice = maxPrice;
    this.concurrency = concurrency;
  }

  async ensureCapacity(requiredTokens) {
    const path = '/api/v1/consumption/instruments';
    const headers = this.auth.getHeaders('GET', path, '');
    const response = await axios.get(`${BASE_URL}${path}`, { headers });
    
    const inst = response.data.data.find(i => i.instrument_id === this.instrumentId);
    const available = inst ? (inst.tokens_purchased - inst.tokens_used) : 0;
    
    if (available < requiredTokens) {
      const unitsNeeded = Math.ceil(requiredTokens / 1000000); // 1M tokens per unit
      
      console.log(`Need ${requiredTokens.toLocaleString()} tokens, have ${available.toLocaleString()}`);
      console.log(`Buying ${unitsNeeded} unit(s)...`);
      
      // Place order
      const orderData = {
        market_id: 'market_abc', // Get from instruments
        side: 'buy',
        type: 'limit',
        quantity: unitsNeeded,
        price: this.maxPrice.toString(),
        time_in_force: 'gtc'
      };
      
      const orderPath = '/api/v1/trading/orders';
      const body = JSON.stringify(orderData);
      const orderHeaders = this.auth.getHeaders('POST', orderPath, body);
      
      const orderResp = await axios.post(`${BASE_URL}${orderPath}`, orderData, {
        headers: {
          'Content-Type': 'application/json',
          ...orderHeaders
        }
      });
      
      console.log(`Capacity order placed: ${orderResp.data.data.order_id}`);
      
      // Wait for sufficient tokens
      while (true) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const checkResp = await axios.get(`${BASE_URL}${path}`, { headers });
        const checkInst = checkResp.data.data.find(i => i.instrument_id === this.instrumentId);
        const checkAvailable = checkInst ? (checkInst.tokens_purchased - checkInst.tokens_used) : 0;
        
        if (checkAvailable >= requiredTokens) {
          console.log('Capacity ready!');
          break;
        }
      }
    } else {
      console.log(`Capacity sufficient: ${available.toLocaleString()} tokens available`);
    }
  }

  async processJob(job) {
    const request = {
      model: this.instrumentId,
      messages: job.messages,
      stream: false
    };
    
    const result = await callGridWithRetries(this.consumptionKey, request);
    return { jobId: job.id, result };
  }

  async runBatch(jobs) {
    // Estimate capacity needed (rough estimate: 500 tokens per job)
    const estimatedTokens = jobs.length * 500;
    await this.ensureCapacity(estimatedTokens);
    
    console.log(`Starting batch: ${jobs.length} jobs with concurrency ${this.concurrency}`);
    
    const results = [];
    const queue = [...jobs];
    
    const workers = Array(this.concurrency).fill(null).map(async (_, workerId) => {
      while (queue.length > 0) {
        const job = queue.shift();
        if (!job) break;
        
        try {
          console.log(`Worker ${workerId}: Processing job ${job.id}`);
          const result = await this.processJob(job);
          results.push(result);
        } catch (error) {
          console.error(`Worker ${workerId}: Job ${job.id} failed:`, error.message);
          results.push({ jobId: job.id, error: error.message });
        }
      }
    });
    
    await Promise.all(workers);
    
    console.log(`Batch complete: ${results.length} jobs processed`);
    return results;
  }
}

// Usage
const sequencer = new BatchJobSequencer(
  auth,
  process.env.GRID_CONSUMPTION_API_KEY,
  'gpt-4',
  15.00,
  20 // concurrency
);

const jobs = [
  { id: 1, messages: [{ role: 'user', content: 'Summarize AI markets' }] },
  { id: 2, messages: [{ role: 'user', content: 'Explain inference trading' }] },
  // ... more jobs
];

const results = await sequencer.runBatch(jobs);
```

**Python:**
```python
import concurrent.futures
import math

class BatchJobSequencer:
    def __init__(self, auth, consumption_key, instrument_id, max_price, concurrency=20):
        self.auth = auth
        self.consumption_key = consumption_key
        self.instrument_id = instrument_id
        self.max_price = max_price
        self.concurrency = concurrency
    
    def ensure_capacity(self, required_tokens):
        """Ensure sufficient tokens are available"""
        path = '/api/v1/consumption/instruments'
        headers = self.auth.get_headers('GET', path, '')
        response = requests.get(f'{BASE_URL}{path}', headers=headers)
        
        instruments = response.json()['data']
        inst = next((i for i in instruments if i['instrument_id'] == self.instrument_id), None)
        available = (inst['tokens_purchased'] - inst['tokens_used']) if inst else 0
        
        if available < required_tokens:
            units_needed = math.ceil(required_tokens / 1000000)  # 1M tokens per unit
            
            print(f'Need {required_tokens:,} tokens, have {available:,}')
            print(f'Buying {units_needed} unit(s)...')
            
            # Place order
            order_data = {
                'market_id': 'market_abc',
                'side': 'buy',
                'type': 'limit',
                'quantity': units_needed,
                'price': str(self.max_price),
                'time_in_force': 'gtc'
            }
            
            order_path = '/api/v1/trading/orders'
            body = json.dumps(order_data)
            order_headers = self.auth.get_headers('POST', order_path, body)
            order_headers['Content-Type'] = 'application/json'
            
            order_resp = requests.post(f'{BASE_URL}{order_path}', json=order_data, headers=order_headers)
            print(f"Capacity order placed: {order_resp.json()['data']['order_id']}")
            
            # Wait for sufficient tokens
            while True:
                time.sleep(2)
                
                check_resp = requests.get(f'{BASE_URL}{path}', headers=headers)
                check_instruments = check_resp.json()['data']
                check_inst = next((i for i in check_instruments if i['instrument_id'] == self.instrument_id), None)
                check_available = (check_inst['tokens_purchased'] - check_inst['tokens_used']) if check_inst else 0
                
                if check_available >= required_tokens:
                    print('Capacity ready!')
                    break
        else:
            print(f'Capacity sufficient: {available:,} tokens available')
    
    def process_job(self, job):
        """Process a single job"""
        request = {
            'model': self.instrument_id,
            'messages': job['messages'],
            'stream': False
        }
        
        result = call_grid_with_retries(self.consumption_key, request)
        return {'job_id': job['id'], 'result': result}
    
    def run_batch(self, jobs):
        """Run batch of jobs with concurrency control"""
        # Estimate capacity (rough: 500 tokens per job)
        estimated_tokens = len(jobs) * 500
        self.ensure_capacity(estimated_tokens)
        
        print(f'Starting batch: {len(jobs)} jobs with concurrency {self.concurrency}')
        
        results = []
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.concurrency) as executor:
            future_to_job = {executor.submit(self.process_job, job): job for job in jobs}
            
            for future in concurrent.futures.as_completed(future_to_job):
                job = future_to_job[future]
                try:
                    result = future.result()
                    results.append(result)
                    print(f"Job {job['id']} completed")
                except Exception as e:
                    print(f"Job {job['id']} failed: {e}")
                    results.append({'job_id': job['id'], 'error': str(e)})
        
        print(f'Batch complete: {len(results)} jobs processed')
        return results

# Usage
sequencer = BatchJobSequencer(
    auth,
    os.environ['GRID_CONSUMPTION_API_KEY'],
    'gpt-4',
    15.00,
    20  # concurrency
)

jobs = [
    {'id': 1, 'messages': [{'role': 'user', 'content': 'Summarize AI markets'}]},
    {'id': 2, 'messages': [{'role': 'user', 'content': 'Explain inference trading'}]},
    # ... more jobs
]

results = sequencer.run_batch(jobs)
```

---

## 2.2 Migrating from Existing Providers

### 2.2.1 Differences between Instruments and models

Most inference providers sell access to specific models. On The Grid, you buy an Instrument with a Specification, where any Supplier meeting that specification with any model can serve your inference requests.

**Advantages of Instruments over Individual Models:**

- **Transparent, real-time pricing**
  - Prices update continuously in the market and suppliers compete to win flow
  - Set caps and automate buying for cost predictability

- **More capacity and better reliability**
  - Not tied to one provider's rate limits or capacity
  - If one supplier is saturated, requests route to another

- **Reduced vendor and model churn risk**
  - If a specific model, lab, or provider disappears, no refactoring needed
  - Your integration targets the Instrument contract, not a single provider

- **Less time evaluating providers**
  - Evaluate the Instrument for your task once
  - Rely on the market to keep the supplier set competitive

**Considerations before migrating:**

- **Model-specific behavior**: If your task depends on one specific model's behavior, run an eval first
- **Frontier models**: Instruments standardize around a floor, not the latest premium model
- **Provider-side caching**: Plan to own caching in your app layer
- **Provider-specific parameters**: Use only documented parameters for the Instrument

**We recommend starting with workloads that don't require model or supplier-specific behavior:**
- Latency-sensitive user-facing agents
- High-volume internal automations
- Agentic product features where you can measure quality via eval

---

### 2.2.2 Mapping other chat APIs to The Grid

The Consumption API uses a chat completions style schema. The main difference is that you pass an `instrument_id` instead of a `model`.

**Conceptual mapping:**
- `model` → `instrument_id` (e.g., "gpt-4" → "chat_fast" or "chat_prime")
- `base_url` → Grid consumption base URL
- `api_key` → Grid consumption key

**Example request change:**

**Before (OpenAI SDK):**
```javascript
const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const resp = await client.chat.completions.create({
  model: 'gpt-4-turbo',
  messages: [
    { role: 'user', content: 'Hello!' }
  ]
});
```

**After (Grid API):**
```javascript
const axios = require('axios');

const consumptionKey = process.env.GRID_CONSUMPTION_API_KEY;

const resp = await axios.post(
  'https://trading.api.thegrid.ai/v1/consumption/chat',
  {
    model: 'gpt-4', // or specific instrument_id
    messages: [
      { role: 'user', content: 'Hello!' }
    ]
  },
  {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${consumptionKey}`
    }
  }
);

const result = resp.data.data;
console.log(result.choices[0].message.content);
```

**Before (Anthropic SDK):**
```python
import anthropic

client = anthropic.Anthropic(api_key=os.environ['ANTHROPIC_API_KEY'])

message = client.messages.create(
    model="claude-3-opus-20240229",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)
```

**After (Grid API):**
```python
import requests
import os

consumption_key = os.environ['GRID_CONSUMPTION_API_KEY']

response = requests.post(
    'https://trading.api.thegrid.ai/v1/consumption/chat',
    json={
        'model': 'gpt-4',  # or specific instrument_id
        'messages': [
            {'role': 'user', 'content': 'Hello!'}
        ],
        'max_tokens': 1024
    },
    headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {consumption_key}'
    }
)

result = response.json()['data']
print(result['choices'][0]['message']['content'])
```

---

### 2.2.3 Best practices for modifying prompts when using Instruments

When using an Instrument, your prompts should be portable so any model serving the instrument provides acceptable inference.

#### 1) Use a strict allowlist for request parameters

Send only officially supported parameters. Treat everything else as best-effort.

**Actionable approach:**

```javascript
// Safe request builder
function buildSafeRequest(instrumentId, messages, options = {}) {
  // Allowlist of supported parameters
  const request = {
    model: instrumentId,
    messages: messages
  };
  
  // Add optional parameters with safe defaults
  if (options.temperature !== undefined) {
    request.temperature = Math.max(0, Math.min(2, options.temperature));
  }
  
  if (options.maxTokens !== undefined) {
    request.max_tokens = Math.max(1, Math.min(4000, options.maxTokens));
  }
  
  if (options.topP !== undefined) {
    request.top_p = Math.max(0, Math.min(1, options.topP));
  }
  
  // Don't include experimental or provider-specific parameters
  return request;
}

// Usage
const request = buildSafeRequest('gpt-4', messages, {
  temperature: 0.7,
  maxTokens: 500
});

const result = await axios.post(`${CONSUMPTION_URL}/consumption/chat`, request, {
  headers: { Authorization: `Bearer ${consumptionKey}` }
});
```

#### 2) Prompt for outcomes, not model quirks

**Good prompt (portable):**
```javascript
const messages = [
  {
    role: 'system',
    content: 'You are a helpful assistant. Respond in JSON format with keys: "summary" (string), "sentiment" (one of: positive, negative, neutral), "confidence" (number 0-1).'
  },
  {
    role: 'user',
    content: 'Analyze this text: "The market is performing well today."'
  }
];
```

**Avoid (model-specific):**
```javascript
// Don't rely on specific model personalities or formatting habits
const messages = [
  {
    role: 'system',
    content: 'You are Claude, an AI assistant made by Anthropic...' // Too specific!
  }
];
```

#### 3) Validate outputs in your app layer

**JavaScript:**
```javascript
async function chatWithValidation(consumptionKey, request) {
  const result = await callGridWithRetries(consumptionKey, request);
  
  try {
    const content = result.choices[0].message.content;
    
    // If expecting JSON, parse and validate
    if (request.response_format?.type === 'json') {
      const parsed = JSON.parse(content);
      
      // Validate required fields
      if (!parsed.summary || !parsed.sentiment) {
        throw new Error('Missing required fields in response');
      }
      
      return parsed;
    }
    
    return content;
    
  } catch (error) {
    console.warn('Output validation failed, retrying once...');
    
    // Retry once
    const retryResult = await callGridWithRetries(consumptionKey, request, 1);
    return retryResult.choices[0].message.content;
  }
}
```

#### 4) Run an eval before bringing in real traffic

**Eval framework example:**

**Python:**
```python
def run_eval(consumption_key, test_cases):
    """Run evaluation on test cases"""
    results = {'pass': 0, 'fail': 0, 'total': len(test_cases)}
    
    for i, test_case in enumerate(test_cases):
        try:
            result = call_grid_with_retries(
                consumption_key,
                {
                    'model': 'gpt-4',
                    'messages': test_case['messages']
                }
            )
            
            output = result['choices'][0]['message']['content']
            
            # Evaluate based on your criteria
            passed = test_case['eval_fn'](output)
            
            if passed:
                results['pass'] += 1
                print(f"Test {i+1}: PASS")
            else:
                results['fail'] += 1
                print(f"Test {i+1}: FAIL")
        
        except Exception as e:
            results['fail'] += 1
            print(f"Test {i+1}: ERROR - {e}")
    
    success_rate = (results['pass'] / results['total']) * 100
    print(f"\nResults: {results['pass']}/{results['total']} passed ({success_rate:.1f}%)")
    
    return results

# Usage with test cases
test_cases = [
    {
        'messages': [{'role': 'user', 'content': 'What is 2+2?'}],
        'eval_fn': lambda output: '4' in output
    },
    {
        'messages': [{'role': 'user', 'content': 'Name a color.'}],
        'eval_fn': lambda output: any(color in output.lower() for color in ['red', 'blue', 'green', 'yellow'])
    },
    # Add 50-200 real test cases from production
]

eval_results = run_eval(consumption_key, test_cases)

# Rollout plan:
# - Run eval and ensure >95% pass rate
# - Start with 1% of production traffic
# - Increase to 10% after 1-2 days
# - Scale to 50%+ once confident
```

#### 5) Plan for batch workloads with custom queueing

**Key considerations:**

- **Estimate capacity before starting**
- **Pre-buy capacity, then start when available**
- **Treat rate limits and concurrency as first-class controls**
- **Monitor capacity continuously during run**
- **Decide what happens if you run low mid-run**

See the BatchJobSequencer example in Section 2.1.7 for complete implementation.