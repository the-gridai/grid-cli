# Transfers and Issuance API

The Transfers API allows you to move funds between different account types, and the Issuance API manages supplier issuance accounts.

## Authentication

Uses **Ed25519 signature authentication** (same as Trading API). See [API Overview](./1-overview.md#authentication) for details.

## Account Types

The GRID platform has different account types:

| Account Type | Purpose | Description |
|-------------|---------|-------------|
| **Trading Account** | Active trading | Holds instruments available for trading |
| **Consumption Account** | AI inference | Holds instruments for AI consumption |
| **Issuance Account** | Supply side | Suppliers deposit and issue instruments |

## Transfer Between Accounts

### Trading to Consumption

**`POST /api/v1/transfers/trading-to-consumption`**

Transfer instruments from your trading account to consumption account for AI inference.

**Request Body**:

```json
{
  "instrument_id": "instrument_123",
  "quantity": 100
}
```

**Request Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `instrument_id` | string | Yes | Instrument to transfer |
| `quantity` | integer | Yes | Amount to transfer |

**Response**:

```json
{
  "status": "success",
  "transfer_id": "transfer_abc123"
}
```

**Status Code**: `202 Accepted` (processed asynchronously)

**Example (JavaScript/TypeScript)**:

```javascript
import axios from 'axios';
import { SignatureAuth } from './auth';

async function transferToConsumption(auth, instrumentId, quantity) {
  const path = '/api/v1/transfers/trading-to-consumption';
  const body = JSON.stringify({
    instrument_id: instrumentId,
    quantity: quantity
  });
  const headers = auth.getHeaders('POST', path, body);
  
  const response = await axios.post(
    `https://trading.api.thegrid.ai${path}`,
    { instrument_id: instrumentId, quantity },
    {
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }
  );
  
  return response.data;
}

// Transfer 100 units to consumption account
const result = await transferToConsumption(
  auth,
  'instrument_test-ai-123',
  100
);

console.log(`Transfer initiated: ${result.transfer_id}`);
console.log('Check transfer history for completion status');
```

**Example (Python)**:

```python
import requests
import json
from auth import SignatureAuth

def transfer_to_consumption(auth, instrument_id, quantity):
    """Transfer from trading to consumption account"""
    path = '/api/v1/transfers/trading-to-consumption'
    body = json.dumps({
        'instrument_id': instrument_id,
        'quantity': quantity
    })
    headers = auth.get_headers('POST', path, body)
    headers['Content-Type'] = 'application/json'
    
    response = requests.post(
        f'https://trading.api.thegrid.ai{path}',
        json={'instrument_id': instrument_id, 'quantity': quantity},
        headers=headers
    )
    
    response.raise_for_status()
    return response.json()

# Transfer 50 units
result = transfer_to_consumption(auth, 'instrument_abc', 50)
print(f"Transfer ID: {result['transfer_id']}")
```

### Consumption to Trading

**`POST /api/v1/transfers/consumption-to-trading`**

Transfer instruments from consumption account back to trading account.

**Request Body**:

```json
{
  "instrument_id": "instrument_123",
  "quantity": 50
}
```

**Response**: Same as Trading to Consumption

**Example**:

```javascript
async function transferToTrading(auth, instrumentId, quantity) {
  const path = '/api/v1/transfers/consumption-to-trading';
  const body = JSON.stringify({
    instrument_id: instrumentId,
    quantity: quantity
  });
  const headers = auth.getHeaders('POST', path, body);
  
  const response = await axios.post(
    `https://trading.api.thegrid.ai${path}`,
    { instrument_id: instrumentId, quantity },
    {
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }
  );
  
  return response.data;
}

// Move unused units back to trading
const result = await transferToTrading(auth, 'instrument_test-ai-123', 25);
console.log(`Transfer initiated: ${result.transfer_id}`);
```

## Transfer History

### Get Transfer History

**`GET /api/v1/transfers/histories`**

View history of transfers between accounts.

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `market_id` | string | No | - | Filter by market |
| `filters[n][field]` | string | No | - | Field to filter on |
| `filters[n][value]` | string | No | - | Filter value |
| `page` | integer | No | 1 | Page number |
| `page_size` | integer | No | 50 | Results per page |

**Available Filters**:
- `account_id` - Destination account
- `instrument_id` - Transferred instrument
- `market_id` - Associated market
- `sender_account_id` - Source account
- `transferred_at` - Transfer timestamp

**Available Sorters**:
- `transferred_at`
- `inserted_at`

**Response**:

```json
{
  "data": [
    {
      "id": "60f7142d-b752-4512-a499-9e6971ebd767",
      "transfer_id": "transfer_003",
      "market_id": "market_07b62060-69e2-4259-a6d2-0e4df5f8fd49",
      "instrument_id": "instrument_123",
      "instrument_name": "Test Instrument",
      "sender_account_id": "trading_account_98f4bafbe51457b5",
      "account_id": "consumption_account_123",
      "quantity": 50,
      "transferred_at": "2025-12-02T13:02:51Z",
      "inserted_at": "2025-12-02T13:02:51Z",
      "updated_at": "2025-12-02T13:02:51Z"
    }
  ],
  "meta": {
    "current_offset": 0,
    "current_page": 1,
    "page_size": 50,
    "total_count": 1,
    "total_pages": 1
  }
}
```

**Example**:

```javascript
async function getTransferHistory(auth, marketId, limit = 50) {
  const path = '/api/v1/transfers/histories';
  const headers = auth.getHeaders('GET', path, '');
  
  const response = await axios.get(
    `https://trading.api.thegrid.ai${path}`,
    {
      params: {
        market_id: marketId,
        page_size: limit
      },
      headers
    }
  );
  
  return response.data.data;
}

const history = await getTransferHistory(auth, 'market_abc', 20);

console.log('Recent transfers:');
history.forEach(transfer => {
  console.log(`  ${transfer.transferred_at}: ${transfer.quantity} ${transfer.instrument_name}`);
  console.log(`    From: ${transfer.sender_account_id}`);
  console.log(`    To: ${transfer.account_id}`);
});
```

## Issuance Accounts (Suppliers)

Issuance accounts are used by suppliers to deposit and manage instrument inventory.

### List Issuance Accounts

**`GET /api/v1/trading/issuance-accounts`**

List your issuance accounts.

**Authentication**: Ed25519 signature required

**Response**:

```json
{
  "data": [
    {
      "issuance_account_id": "isa_test-123",
      "user_id": "user_2dbcef4c-068e-4936-9de9-c6131ecf6a61",
      "instrument_id": "instrument_test-456",
      "status": "active",
      "total_balance": 500,
      "total_issued": 1000,
      "total_deposits": 10,
      "total_transferred_to_trading": 500,
      "total_transfers": 8,
      "last_deposit_at": "2025-12-16T14:10:16Z",
      "last_transfer_at": "2025-12-16T14:10:16Z",
      "created_at": "2025-12-16T14:10:16Z",
      "updated_at": "2025-12-16T14:10:16Z"
    }
  ],
  "paging": {
    "has_more": false,
    "next_cursor": null,
    "prev_cursor": null
  }
}
```

**Field Descriptions**:

| Field | Type | Description |
|-------|------|-------------|
| `issuance_account_id` | string | Account identifier |
| `user_id` | string | Owner user ID |
| `instrument_id` | string | Instrument in this account |
| `status` | string | Account status |
| `total_balance` | integer | Current balance |
| `total_issued` | integer | Total ever issued |
| `total_deposits` | integer | Number of deposits |
| `total_transferred_to_trading` | integer | Amount transferred out |
| `total_transfers` | integer | Number of transfers |

**Example**:

```javascript
async function getIssuanceAccounts(auth) {
  const path = '/api/v1/trading/issuance-accounts';
  const headers = auth.getHeaders('GET', path, '');
  
  const response = await axios.get(
    `https://trading.api.thegrid.ai${path}`,
    { headers }
  );
  
  return response.data.data;
}

const accounts = await getIssuanceAccounts(auth);

console.log('Issuance Accounts:');
accounts.forEach(acct => {
  console.log(`  ${acct.issuance_account_id}`);
  console.log(`    Balance: ${acct.total_balance} units`);
  console.log(`    Total Issued: ${acct.total_issued}`);
  console.log(`    Transferred to Trading: ${acct.total_transferred_to_trading}`);
});
```

### Transfer from Issuance to Trading

**`POST /api/v1/trading/issuance-accounts/transfer`**

Transfer units from issuance account to trading account (supplier operation).

**Request Body**:

```json
{
  "instrument_id": "instrument_123",
  "quantity": 100,
  "trading_account_id": "ta_456"
}
```

**Response**:

```json
{
  "status": "accepted",
  "message": "Transfer initiated successfully",
  "transfer_id": "transfer_5db41023-7600-4b6a-ac08-6849d3f9372d"
}
```

**Status Code**: `202 Accepted`

**Example**:

```javascript
async function transferFromIssuance(auth, instrumentId, quantity, tradingAccountId) {
  const path = '/api/v1/trading/issuance-accounts/transfer';
  const body = JSON.stringify({
    instrument_id: instrumentId,
    quantity: quantity,
    trading_account_id: tradingAccountId
  });
  const headers = auth.getHeaders('POST', path, body);
  
  const response = await axios.post(
    `https://trading.api.thegrid.ai${path}`,
    {
      instrument_id: instrumentId,
      quantity: quantity,
      trading_account_id: tradingAccountId
    },
    {
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }
  );
  
  return response.data;
}

// Supplier transferring inventory to trading
const result = await transferFromIssuance(
  auth,
  'instrument_abc',
  1000,
  'ta_trading_account_123'
);

console.log(`Transfer ${result.status}: ${result.transfer_id}`);
```

## Use Cases

### 1. Prepare for Trading

```javascript
async function prepareForTrading(auth, instrumentId, quantityNeeded) {
  // Check consumption balance
  const consumptionInstruments = await getConsumptionInstruments(auth);
  const instrument = consumptionInstruments.find(i => i.instrument_id === instrumentId);
  
  if (!instrument) {
    console.log('No consumption balance for this instrument');
    return;
  }
  
  const tradeableAmount = instrument.tradeable_amount || 0;
  
  if (tradeableAmount >= quantityNeeded) {
    // Transfer to trading
    const result = await transferToTrading(auth, instrumentId, quantityNeeded);
    console.log(`Transferred ${quantityNeeded} units to trading: ${result.transfer_id}`);
  } else {
    console.log(`Insufficient tradeable balance. Need: ${quantityNeeded}, Have: ${tradeableAmount}`);
  }
}

await prepareForTrading(auth, 'instrument_gpt4', 100);
```

### 2. After Purchase - Move to Consumption

```javascript
async function afterPurchase(auth, instrumentId, quantity) {
  // After buying on the exchange, move to consumption for AI use
  const result = await transferToConsumption(auth, instrumentId, quantity);
  
  console.log(`Transfer initiated: ${result.transfer_id}`);
  console.log('Instruments will be available for AI inference shortly');
  
  // Poll transfer history to confirm
  let completed = false;
  let attempts = 0;
  
  while (!completed && attempts < 10) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
    const history = await getTransferHistory(auth, 'market_id');
    const transfer = history.find(t => t.transfer_id === result.transfer_id);
    
    if (transfer) {
      console.log('✓ Transfer completed');
      completed = true;
    }
    
    attempts++;
  }
}
```

### 3. Supplier Inventory Management

```javascript
class SupplierInventoryManager {
  constructor(auth) {
    this.auth = auth;
  }
  
  async getInventory() {
    const accounts = await getIssuanceAccounts(this.auth);
    
    return accounts.map(acct => ({
      instrument_id: acct.instrument_id,
      available: acct.total_balance,
      issued: acct.total_issued,
      transferred: acct.total_transferred_to_trading,
      utilizationRate: (acct.total_transferred_to_trading / acct.total_issued) * 100
    }));
  }
  
  async replenishTrading(instrumentId, quantity) {
    // Find issuance account
    const accounts = await getIssuanceAccounts(this.auth);
    const issuanceAcct = accounts.find(a => a.instrument_id === instrumentId);
    
    if (!issuanceAcct) {
      throw new Error('No issuance account for this instrument');
    }
    
    if (issuanceAcct.total_balance < quantity) {
      throw new Error(`Insufficient balance. Available: ${issuanceAcct.total_balance}`);
    }
    
    // Get trading account
    const tradingAccounts = await getTradingAccounts(this.auth);
    const tradingAcct = tradingAccounts.find(a => a.instrument_id === instrumentId);
    
    if (!tradingAcct) {
      throw new Error('No trading account for this instrument');
    }
    
    // Transfer
    const result = await transferFromIssuance(
      this.auth,
      instrumentId,
      quantity,
      tradingAcct.account_id
    );
    
    console.log(`Replenished ${quantity} units to trading`);
    return result;
  }
  
  async getUtilizationReport() {
    const inventory = await this.getInventory();
    
    console.log('Inventory Utilization Report');
    console.log('============================');
    
    inventory.forEach(item => {
      console.log(`\n${item.instrument_id}:`);
      console.log(`  Available: ${item.available} units`);
      console.log(`  Total Issued: ${item.issued} units`);
      console.log(`  Transferred: ${item.transferred} units`);
      console.log(`  Utilization: ${item.utilizationRate.toFixed(2)}%`);
    });
  }
}

// Usage
const manager = new SupplierInventoryManager(auth);
await manager.getUtilizationReport();
await manager.replenishTrading('instrument_gpt4', 500);
```

## Transfer History Analysis

```python
import requests
from datetime import datetime, timedelta
from collections import defaultdict

def analyze_transfer_history(auth, market_id, days=30):
    """Analyze transfer patterns over time"""
    # Fetch transfer history
    path = '/api/v1/transfers/histories'
    headers = auth.get_headers('GET', path, '')
    
    response = requests.get(
        f'https://trading.api.thegrid.ai{path}',
        params={'market_id': market_id},
        headers=headers
    )
    response.raise_for_status()
    
    transfers = response.json()['data']
    
    # Filter to last N days
    cutoff = datetime.now() - timedelta(days=days)
    recent = [
        t for t in transfers 
        if datetime.fromisoformat(t['transferred_at'].replace('Z', '+00:00')) > cutoff
    ]
    
    # Analyze by direction
    to_consumption = [t for t in recent if 'consumption' in t['account_id']]
    to_trading = [t for t in recent if 'trading' in t['account_id']]
    
    # Calculate totals by instrument
    instrument_totals = defaultdict(lambda: {'to_consumption': 0, 'to_trading': 0})
    
    for t in to_consumption:
        instrument_totals[t['instrument_id']]['to_consumption'] += t['quantity']
    
    for t in to_trading:
        instrument_totals[t['instrument_id']]['to_trading'] += t['quantity']
    
    # Report
    print(f"Transfer Analysis (Last {days} days)")
    print("=" * 60)
    print(f"Total Transfers: {len(recent)}")
    print(f"  To Consumption: {len(to_consumption)}")
    print(f"  To Trading: {len(to_trading)}")
    
    print("\nBy Instrument:")
    for inst_id, totals in instrument_totals.items():
        print(f"  {inst_id}:")
        print(f"    → Consumption: {totals['to_consumption']} units")
        print(f"    → Trading: {totals['to_trading']} units")
        net = totals['to_consumption'] - totals['to_trading']
        print(f"    Net Flow: {net:+d} units")
    
    return instrument_totals

# Analyze transfers
analysis = analyze_transfer_history(auth, 'market_abc', days=7)
```

## Workflow Examples

### Complete Trading-to-Consumption Workflow

```javascript
async function buyAndUseForAI(auth, marketId, instrumentId, quantity) {
  console.log('Step 1: Check trading balance');
  const tradingAccounts = await getTradingAccounts(auth);
  const tradingAcct = tradingAccounts.find(a => a.instrument_id === instrumentId);
  
  if (!tradingAcct || tradingAcct.available_balance < quantity) {
    console.log('Insufficient trading balance. Placing buy order...');
    
    // Place market order to buy
    const order = await placeOrder(auth, {
      market_id: marketId,
      side: 'buy',
      type: 'market',
      quantity: quantity
    });
    
    console.log(`Order placed: ${order.order_id}`);
    
    // Wait for order to fill
    await waitForOrderFill(auth, order.order_id);
  }
  
  console.log('Step 2: Transfer to consumption');
  const transfer = await transferToConsumption(auth, instrumentId, quantity);
  console.log(`Transfer initiated: ${transfer.transfer_id}`);
  
  console.log('Step 3: Wait for transfer completion');
  await waitForTransferCompletion(auth, transfer.transfer_id);
  
  console.log('✓ Units ready for AI consumption');
}

async function waitForTransferCompletion(auth, transferId, maxWait = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    const history = await getTransferHistory(auth, null, 100);
    const transfer = history.find(t => t.transfer_id === transferId);
    
    if (transfer) {
      return transfer;
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('Transfer timeout');
}

// Usage
await buyAndUseForAI(auth, 'market_abc', 'instrument_gpt4', 100);
```

## Best Practices

1. **Check balances first** - Verify sufficient balance before initiating transfers
2. **Track transfer IDs** - Store transfer IDs for audit trail
3. **Use transfer history** - Monitor transfers for accounting and reconciliation
4. **Handle async processing** - Transfers are processed asynchronously (202 Accepted)
5. **Filter by market** - Use market_id to organize transfer history
6. **Monitor issuance accounts** - Suppliers should track utilization rates
7. **Implement retry logic** - Handle temporary failures gracefully
8. **Validate quantities** - Ensure quantities match instrument increments

## Error Codes

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `INSUFFICIENT_BALANCE` | 400 | Not enough balance for transfer |
| `INVALID_QUANTITY` | 400 | Quantity invalid or out of range |
| `INSTRUMENT_NOT_FOUND` | 404 | Instrument ID not found |
| `ACCOUNT_NOT_FOUND` | 404 | Account ID not found |
| `TRANSFER_FAILED` | 500 | Transfer processing failed |

## WebSocket Updates

Subscribe to transfer history updates:

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'transfer_histories',
  user_id: 'your_user_id'
}));

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.type === 'new_transfer') {
    console.log('New transfer:', msg.data);
  }
});
```

See [WebSocket Documentation](./5-websockets.md) for more details.


