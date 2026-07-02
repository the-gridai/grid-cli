# Accounts and Usage API

The Accounts and Usage API provides endpoints for viewing balances, managing lots, tracking usage records, and viewing action history.

## Authentication

Uses **Ed25519 signature authentication** (same as Trading API). See [API Overview](./1-overview.md#authentication) for details.

## Balances

### Get Trading Balances

**`GET /trading/trading-accounts`**

List all trading account balances across currencies.

**Response**:

```json
{
  "data": [
    {
      "account_id": "acc_btc_123",
      "currency": "BTC",
      "available": "0.5",
      "reserved": "0.01",
      "total": "0.51",
      "updated_at": "2025-01-01T12:34:56Z"
    },
    {
      "account_id": "acc_usd_456",
      "currency": "USD",
      "available": "10000.00",
      "reserved": "500.00",
      "total": "10500.00",
      "updated_at": "2025-01-01T12:34:56Z"
    }
  ]
}
```

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `account_id` | string | Unique account identifier |
| `currency` | string | Currency code (BTC, USD, ETH, etc.) |
| `available` | string | Available balance for trading |
| `reserved` | string | Balance reserved in open orders |
| `total` | string | Total balance (available + reserved) |
| `updated_at` | string | Last update timestamp |

**Example (JavaScript/TypeScript)**:

```javascript
import axios from 'axios';
import { SignatureAuth } from './auth';

async function getTradingBalances(auth) {
  const path = '/api/v1/trading/trading-accounts';
  const headers = auth.getHeaders('GET', path, '');
  
  const response = await axios.get(
    `https://trading.api.thegrid.ai${path}`,
    { headers }
  );
  
  return response.data.data;
}

// Usage
const balances = await getTradingBalances(auth);
balances.forEach(account => {
  console.log(`${account.currency}: ${account.available} available, ${account.reserved} reserved`);
});
```

**Example (Python)**:

```python
import requests
from auth import SignatureAuth

def get_trading_balances(auth):
    path = '/api/v1/trading/trading-accounts'
    headers = auth.get_headers('GET', path, '')
    
    response = requests.get(
        f'https://trading.api.thegrid.ai{path}',
        headers=headers
    )
    
    response.raise_for_status()
    return response.json()['data']

# Usage
balances = get_trading_balances(auth)
for account in balances:
    print(f"{account['currency']}: {account['available']} available")
```

### Get Specific Trading Account

**`GET /trading/trading-accounts/{account_id}`**

Get details for a specific trading account.

**Response**:

```json
{
  "data": {
    "account_id": "acc_usd_456",
    "currency": "USD",
    "available": "10000.00",
    "reserved": "500.00",
    "total": "10500.00",
    "pending_deposits": "0.00",
    "pending_withdrawals": "0.00",
    "updated_at": "2025-01-01T12:34:56Z"
  }
}
```

### Get Currency Trading Accounts

**`GET /api/v1/trading/currency-trading-accounts`**

List trading accounts grouped by currency with additional metadata.

**Response**:

```json
{
  "data": [
    {
      "account_id": "currency_trading_account_e927ad93f9c4aaa8",
      "user_id": "user_2e605810-1e39-4d5a-a8e2-e46c89ac4b26",
      "currency": "usd",
      "total_balance": "1200",
      "available_balance": "700",
      "locked_balance": "500",
      "status": "active",
      "last_deposit_at": null,
      "last_trading_activity_at": null,
      "last_withdrawal_at": null,
      "created_at": "2025-12-10T18:19:01Z",
      "updated_at": "2025-12-10T18:19:01Z"
    }
  ],
  "paging": {
    "has_more": false,
    "next_cursor": null,
    "prev_cursor": null
  }
}
```

### Get Specific Currency Account

**`GET /api/v1/self/accounts/currencies/{currency}`**

Get trading account for a specific currency (e.g., `usd`, `btc`).

**Response**:

```json
{
  "data": {
    "account_id": "currency_trading_account_9a4b2206dd6f1d21",
    "user_id": "user_3facc7b4-9886-440e-ae94-10bbc044b78d",
    "currency": "usd",
    "total_balance": "1200",
    "available_balance": "700",
    "locked_balance": "500",
    "status": "active",
    "last_deposit_at": null,
    "last_trading_activity_at": null,
    "last_withdrawal_at": null,
    "created_at": "2025-10-21T11:11:18Z",
    "updated_at": "2025-10-21T11:11:18Z"
  }
}
```

**Example**:

```javascript
async function getCurrencyAccount(auth, currency) {
  const path = `/api/v1/self/accounts/currencies/${currency.toLowerCase()}`;
  const headers = auth.getHeaders('GET', path, '');
  
  const response = await axios.get(
    `https://trading.api.thegrid.ai${path}`,
    { headers }
  );
  
  return response.data.data;
}

// Get USD account
const usdAccount = await getCurrencyAccount(auth, 'usd');
console.log(`USD Balance: $${usdAccount.available_balance} available, $${usdAccount.locked_balance} locked`);
```

### Get Instrument Trading Accounts

**`GET /api/v1/self/accounts/instruments`**

List trading accounts by instrument (AI commodities, etc.).

**Response**:

```json
{
  "data": [
    {
      "id": "018aff57-4692-450a-aab9-cf76b2efc723",
      "account_id": "trading_account_8cdd20b90dbb7604",
      "user_id": "user_14a11d96-fb00-4373-9a18-92c9030416a9",
      "market_id": "market_702e07bb-8786-4ed5-9781-02b5bdade174",
      "instrument_id": "instrument_1",
      "instrument_name": "First Instrument",
      "total_balance": "1200",
      "available_balance": "700",
      "locked_balance": "500",
      "last_trade_price": "3.25",
      "status": "active",
      "last_deposit_at": null,
      "last_trading_activity_at": null,
      "last_withdrawal_at": null,
      "created_at": "2025-10-21T11:11:19Z",
      "updated_at": "2025-10-21T11:11:19Z"
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
async function getInstrumentAccounts(auth) {
  const path = '/api/v1/self/accounts/instruments';
  const headers = auth.getHeaders('GET', path, '');
  
  const response = await axios.get(
    `https://trading.api.thegrid.ai${path}`,
    { headers }
  );
  
  return response.data.data;
}

const accounts = await getInstrumentAccounts(auth);

console.log('Instrument Holdings:');
accounts.forEach(acct => {
  console.log(`  ${acct.instrument_name}:`);
  console.log(`    Balance: ${acct.total_balance} units`);
  console.log(`    Available: ${acct.available_balance}`);
  console.log(`    In Orders: ${acct.locked_balance}`);
  console.log(`    Last Price: $${acct.last_trade_price}`);
});
```

### Get Consumption Instruments

**`GET /api/v1/consumption/instruments`**

View your consumption balances by instrument, including tokens purchased and used.

**Authentication**: Required (Ed25519 signature or session cookie)

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filters[n][field]` | string | No | Field to filter on |
| `filters[n][value]` | string | No | Filter value |

**Available Filters**:
- `api_key_id` - Filter by specific API key usage

**Response**:

```json
{
  "data": [
    {
      "instrument_id": "test-instrument-123",
      "instrument_name": "GPT-4 Token Credits",
      "instrument_symbol": "GPT4_TOKENS",
      "total_amount": 5,
      "tradeable_amount": 3,
      "tokens_purchased": 5000000,
      "tokens_used": 1500000,
      "expires_at": null
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

**Field Descriptions**:

| Field | Type | Description |
|-------|------|-------------|
| `instrument_id` | string | Instrument identifier |
| `instrument_name` | string | Instrument name |
| `instrument_symbol` | string | Trading symbol |
| `total_amount` | integer | Total units owned |
| `tradeable_amount` | integer | Units available to transfer back to trading |
| `tokens_purchased` | integer | Total tokens purchased (for AI commodities) |
| `tokens_used` | integer | Tokens consumed via AI inference |
| `expires_at` | string | Expiration date (null if no expiry) |

**Example (JavaScript/TypeScript)**:

```javascript
async function getConsumptionInstruments(auth, apiKeyFilter = null) {
  const path = '/api/v1/consumption/instruments';
  const headers = auth.getHeaders('GET', path, '');
  
  const params = {};
  if (apiKeyFilter) {
    params['filters[0][field]'] = 'api_key_id';
    params['filters[0][value]'] = apiKeyFilter;
  }
  
  const response = await axios.get(
    `https://trading.api.thegrid.ai${path}`,
    {
      params,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }
  );
  
  return response.data.data;
}

// Get all consumption instruments
const instruments = await getConsumptionInstruments(auth);

console.log('Consumption Balances:');
instruments.forEach(inst => {
  const usagePercent = (inst.tokens_used / inst.tokens_purchased) * 100;
  console.log(`  ${inst.instrument_name}:`);
  console.log(`    Total Units: ${inst.total_amount}`);
  console.log(`    Tradeable: ${inst.tradeable_amount}`);
  console.log(`    Tokens: ${inst.tokens_used.toLocaleString()} / ${inst.tokens_purchased.toLocaleString()} (${usagePercent.toFixed(1)}% used)`);
});

// Get consumption for specific API key
const keyUsage = await getConsumptionInstruments(auth, 'api-key-id-here');
console.log(`\nUsage for API key: ${keyUsage[0]?.tokens_used || 0} tokens`);
```

**Example (Python)**:

```python
def get_consumption_instruments(auth, api_key_id=None):
    """Get consumption balances by instrument"""
    path = '/api/v1/consumption/instruments'
    headers = auth.get_headers('GET', path, '')
    headers['Content-Type'] = 'application/json'
    
    params = {}
    if api_key_id:
        params['filters[0][field]'] = 'api_key_id'
        params['filters[0][value]'] = api_key_id
    
    response = requests.get(
        f'https://trading.api.thegrid.ai{path}',
        params=params,
        headers=headers
    )
    
    response.raise_for_status()
    return response.json()['data']

# Get consumption balances
instruments = get_consumption_instruments(auth)

for inst in instruments:
    usage_pct = (inst['tokens_used'] / inst['tokens_purchased']) * 100
    remaining_tokens = inst['tokens_purchased'] - inst['tokens_used']
    
    print(f"{inst['instrument_name']}:")
    print(f"  Units: {inst['total_amount']} total, {inst['tradeable_amount']} tradeable")
    print(f"  Tokens: {inst['tokens_used']:,} used / {inst['tokens_purchased']:,} purchased")
    print(f"  Remaining: {remaining_tokens:,} tokens ({100-usage_pct:.1f}%)")
```

## Lots

Lots represent batches of purchased compute credits with expiry dates.

### List Active Lots

**`GET /accounts/lots?status=active`**

View your compute credit lots and their expiry information.

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `status` | string | No | all | Filter: `active`, `expired`, `consumed`, `all` |
| `limit` | integer | No | 50 | Results per page |
| `offset` | integer | No | 0 | Pagination offset |

**Response**:

```json
{
  "data": [
    {
      "lot_id": "lot_abc123",
      "quantity": "100.00",
      "used": "24.50",
      "remaining": "75.50",
      "purchase_price": "50.00",
      "currency": "USD",
      "purchased_at": "2025-01-01T00:00:00Z",
      "expires_at": "2025-02-01T00:00:00Z",
      "status": "active",
      "days_until_expiry": 31
    },
    {
      "lot_id": "lot_def456",
      "quantity": "50.00",
      "used": "10.00",
      "remaining": "40.00",
      "purchase_price": "25.00",
      "currency": "USD",
      "purchased_at": "2025-01-05T00:00:00Z",
      "expires_at": "2025-02-05T00:00:00Z",
      "status": "active",
      "days_until_expiry": 35
    }
  ],
  "meta": {
    "total_lots": 2,
    "total_remaining": "115.50"
  }
}
```

**Lot Expiry Fields**:

| Field | Description |
|-------|-------------|
| `expires_at` | ISO 8601 timestamp when lot expires |
| `days_until_expiry` | Days remaining until expiration |
| `status` | `active`, `expired`, `consumed` |

**Example (JavaScript/TypeScript)**:

```javascript
async function getActiveLots(auth) {
  const path = '/api/v1/accounts/lots';
  const headers = auth.getHeaders('GET', path, '');
  
  const response = await axios.get(
    `https://trading.api.thegrid.ai${path}`,
    {
      params: { status: 'active' },
      headers
    }
  );
  
  return response.data.data;
}

// Usage
const lots = await getActiveLots(auth);

// Sort by expiry date
lots.sort((a, b) => new Date(a.expires_at) - new Date(b.expires_at));

console.log('Credits by expiry:');
lots.forEach(lot => {
  console.log(`${lot.remaining} credits expire in ${lot.days_until_expiry} days`);
});
```

**Example (Python)**:

```python
def get_active_lots(auth):
    path = '/api/v1/accounts/lots'
    headers = auth.get_headers('GET', path, '')
    
    response = requests.get(
        f'https://trading.api.thegrid.ai{path}',
        params={'status': 'active'},
        headers=headers
    )
    
    response.raise_for_status()
    return response.json()['data']

# Usage
lots = get_active_lots(auth)

# Find lots expiring soon
expiring_soon = [lot for lot in lots if lot['days_until_expiry'] <= 7]
if expiring_soon:
    print(f"Warning: {len(expiring_soon)} lot(s) expiring within 7 days!")
    for lot in expiring_soon:
        print(f"  - {lot['remaining']} credits expire on {lot['expires_at']}")
```

### Get Lot Details

**`GET /accounts/lots/{lot_id}`**

Get detailed information about a specific lot.

**Response**:

```json
{
  "data": {
    "lot_id": "lot_abc123",
    "quantity": "100.00",
    "used": "24.50",
    "remaining": "75.50",
    "purchase_price": "50.00",
    "currency": "USD",
    "purchased_at": "2025-01-01T00:00:00Z",
    "expires_at": "2025-02-01T00:00:00Z",
    "status": "active",
    "usage_history": [
      {
        "timestamp": "2025-01-15T10:30:00Z",
        "amount": "5.25",
        "activity": "AI inference - GPT-4"
      }
    ]
  }
}
```

## Usage Records

**`GET /accounts/usage?start_date={start}&end_date={end}`**

Track your consumption activity over time.

*(Note: This endpoint may not be implemented yet. Check with engineering.)*

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `start_date` | string | No | 30 days ago | ISO 8601 date |
| `end_date` | string | No | now | ISO 8601 date |
| `activity_type` | string | No | all | Filter: `inference`, `trading`, `data` |
| `limit` | integer | No | 50 | Results per page |

**Response**:

```json
{
  "data": [
    {
      "record_id": "usage_xyz789",
      "timestamp": "2025-01-15T10:30:00Z",
      "activity_type": "inference",
      "description": "AI chat completion - GPT-4",
      "credits_used": "5.25",
      "lot_id": "lot_abc123",
      "metadata": {
        "model": "gpt-4",
        "tokens": 1500,
        "request_id": "req_123"
      }
    }
  ],
  "meta": {
    "total_credits_used": "24.50",
    "date_range": {
      "start": "2025-01-01T00:00:00Z",
      "end": "2025-01-31T23:59:59Z"
    }
  }
}
```

**Example**:

```javascript
async function getUsageRecords(auth, startDate, endDate) {
  const path = '/api/v1/accounts/usage';
  const headers = auth.getHeaders('GET', path, '');
  
  const response = await axios.get(
    `https://trading.api.thegrid.ai${path}`,
    {
      params: {
        start_date: startDate,
        end_date: endDate
      },
      headers
    }
  );
  
  return response.data;
}

// Get this month's usage
const now = new Date();
const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
const usage = await getUsageRecords(
  auth,
  startOfMonth.toISOString(),
  now.toISOString()
);

console.log(`Total credits used this month: ${usage.meta.total_credits_used}`);
```

## Action History

**`GET /accounts/history?limit={limit}`**

View your account activity history (deposits, withdrawals, trades, etc.).

*(Note: This endpoint may not be implemented yet. Check with engineering.)*

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `action_type` | string | No | all | Filter: `deposit`, `withdrawal`, `trade`, `transfer` |
| `currency` | string | No | all | Filter by currency |
| `limit` | integer | No | 50 | Results per page |
| `offset` | integer | No | 0 | Pagination offset |

**Response**:

```json
{
  "data": [
    {
      "action_id": "action_abc123",
      "timestamp": "2025-01-15T10:30:00Z",
      "action_type": "trade",
      "description": "Bought 0.01 BTC at 45000.50",
      "currency": "BTC",
      "amount": "0.01",
      "balance_after": "0.51",
      "related_id": "trade_xyz789",
      "status": "completed"
    },
    {
      "action_id": "action_def456",
      "timestamp": "2025-01-14T15:20:00Z",
      "action_type": "deposit",
      "description": "USD deposit via wire transfer",
      "currency": "USD",
      "amount": "10000.00",
      "balance_after": "10500.00",
      "status": "completed"
    }
  ]
}
```

**Example**:

```javascript
async function getActionHistory(auth, filters = {}) {
  const path = '/api/v1/accounts/history';
  const headers = auth.getHeaders('GET', path, '');
  
  const response = await axios.get(
    `https://trading.api.thegrid.ai${path}`,
    {
      params: filters,
      headers
    }
  );
  
  return response.data.data;
}

// Get recent trade history
const tradeHistory = await getActionHistory(auth, {
  action_type: 'trade',
  limit: 20
});

console.log(`Recent trades: ${tradeHistory.length}`);
```

## Errors and Rate Limits

### Common Errors

| Error Code | Description |
|------------|-------------|
| `ACCOUNT_NOT_FOUND` | Account ID not found |
| `LOT_NOT_FOUND` | Lot ID not found |
| `INSUFFICIENT_CREDITS` | Not enough credits available |
| `INVALID_DATE_RANGE` | Start date is after end date |

### Rate Limits

- **Accounts API**: 60 requests/minute per account
- **Balance checks**: 120 requests/minute
- **Usage records**: 30 requests/minute

## Best Practices

1. **Monitor lot expiry** - Set up alerts for lots expiring soon
2. **Track usage trends** - Use usage records to forecast credit needs
3. **Cache balance data** - Don't poll balances too frequently
4. **Use FIFO consumption** - Oldest lots (nearest expiry) are consumed first automatically
5. **Plan purchases** - Buy lots based on historical usage patterns
6. **Check before trading** - Verify balances before placing large orders
7. **Export history regularly** - For accounting and reconciliation

## Lot Consumption Rules

Credits are consumed in FIFO order (First In, First Out):

1. Lots with **nearest expiry date** are used first
2. Within same expiry date, **oldest lot** is used first
3. Expired lots cannot be used and are automatically marked as `expired`
4. Partially consumed lots remain `active`

**Example Consumption Flow**:

```
Initial State:
- Lot A: 100 credits, expires 2025-02-01
- Lot B: 50 credits, expires 2025-02-15
- Lot C: 75 credits, expires 2025-03-01

After using 120 credits:
- Lot A: 0 credits, status: consumed
- Lot B: 30 credits, status: active (20 used)
- Lot C: 75 credits, status: active (unused)
```

## Webhooks (Future)

*(Planned feature - not yet implemented)*

Set up webhooks to receive notifications for:
- Low balance alerts
- Lot expiry warnings
- Large transactions
- Account activity

## Summary Dashboard

Combine multiple endpoints for a complete overview:

```javascript
async function getAccountSummary(auth) {
  const [balances, lots, usage] = await Promise.all([
    getTradingBalances(auth),
    getActiveLots(auth),
    getConsumptionBalance(auth)
  ]);
  
  return {
    trading: {
      accounts: balances,
      totalUsdValue: calculateTotalValue(balances)
    },
    consumption: {
      remaining: usage.remaining_credits,
      activeLots: lots.length,
      nextExpiry: lots[0]?.expires_at
    }
  };
}

const summary = await getAccountSummary(auth);
console.log('Account Summary:', JSON.stringify(summary, null, 2));
```

