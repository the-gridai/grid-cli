# Positions API

The Positions API allows you to view your open and closed positions across instruments and markets.

## Authentication

Uses **Ed25519 signature authentication** (same as Trading API). See [API Overview](./1-overview.md#authentication) for details.

## Endpoints

### List Positions

**`GET /api/v1/positions`**

Get your trading positions (either as buyer or seller).

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `filters[n][field]` | string | No | - | Field to filter on |
| `filters[n][op]` | string | No | `==` | Filter operator (==, >, <, >=, <=) |
| `filters[n][value]` | string | No | - | Filter value |
| `order_by[]` | string | No | - | Fields to sort by |
| `order_directions[]` | string | No | - | Sort directions (asc, desc) |
| `page` | integer | No | 1 | Page number |
| `page_size` | integer | No | 50 | Results per page (max: 100) |

**Available Filters**:
- `user_account_id` - Filter by account ID
- `inserted_at` - Filter by insertion timestamp
- `opened_at` - Filter by open timestamp  
- `status` - Filter by status (open, closed)

**Available Sorters**:
- `user_account_id`
- `inserted_at`
- `opened_at`

**Response**:

```json
{
  "data": [
    {
      "id": "13e2dcac-4b11-47d7-ad91-3ee0e09ddb14",
      "user_account_id": "user_26a7b1bc-f51b-459b-b1af-c3d6e410b184",
      "instrument_id": "instrument_test-20",
      "instrument_name": "Test Instrument",
      "status": "open",
      "quantity": 1000,
      "average_cost": "45.50000000",
      "total_cost": "45500.00000000",
      "current_market_value": "45500.00000000",
      "last_trade_price": "45.50000000",
      "opened_at": "2025-10-21T11:11:18.854802Z",
      "closed_at": null,
      "inserted_at": "2025-10-21T11:11:18.862905Z"
    }
  ],
  "meta": {
    "current_offset": 0,
    "current_page": 1,
    "page_size": 50,
    "total_count": 1,
    "total_pages": 1,
    "has_next_page": false,
    "has_previous_page": false
  }
}
```

**Field Descriptions**:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Position identifier |
| `user_account_id` | string | User account that owns this position |
| `instrument_id` | string | Instrument being held |
| `instrument_name` | string | Name of the instrument |
| `status` | string | Position status: `open`, `closed` |
| `quantity` | integer | Current quantity held |
| `average_cost` | string | Average cost per unit |
| `total_cost` | string | Total cost basis |
| `current_market_value` | string | Current market value |
| `last_trade_price` | string | Last known trade price |
| `opened_at` | string | When position was opened |
| `closed_at` | string | When position was closed (null if open) |
| `inserted_at` | string | Record insertion timestamp |

### Example: JavaScript/TypeScript

```javascript
import axios from 'axios';
import { SignatureAuth } from './auth';

async function getPositions(auth, filters = {}) {
  const path = '/api/v1/positions';
  const headers = auth.getHeaders('GET', path, '');
  
  const response = await axios.get(
    `https://trading.api.thegrid.ai${path}`,
    {
      params: filters,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }
  );
  
  return response.data;
}

// Get all open positions
const positions = await getPositions(auth, {
  'filters[0][field]': 'status',
  'filters[0][value]': 'open'
});

console.log(`You have ${positions.data.length} open positions`);

// Calculate total portfolio value
const totalValue = positions.data.reduce((sum, pos) => {
  return sum + parseFloat(pos.current_market_value);
}, 0);

console.log(`Total portfolio value: $${totalValue.toFixed(2)}`);
```

### Example: Python

```python
import requests
from auth import SignatureAuth

def get_positions(auth, filters=None):
    """Get user positions with optional filters"""
    path = '/api/v1/positions'
    headers = auth.get_headers('GET', path, '')
    headers['Content-Type'] = 'application/json'
    
    params = filters or {}
    
    response = requests.get(
        f'https://trading.api.thegrid.ai{path}',
        params=params,
        headers=headers
    )
    
    response.raise_for_status()
    return response.json()

# Get open positions
positions = get_positions(auth, {
    'filters[0][field]': 'status',
    'filters[0][value]': 'open'
})

# Display positions
for pos in positions['data']:
    pnl = float(pos['current_market_value']) - float(pos['total_cost'])
    pnl_pct = (pnl / float(pos['total_cost'])) * 100
    print(f"{pos['instrument_name']}: {pos['quantity']} units")
    print(f"  Cost: ${pos['total_cost']}, Value: ${pos['current_market_value']}")
    print(f"  P&L: ${pnl:.2f} ({pnl_pct:+.2f}%)")
```

### Example: Go

```go
package main

import (
    "encoding/json"
    "fmt"
    "net/http"
    "net/url"
)

type Position struct {
    ID                  string `json:"id"`
    UserAccountID       string `json:"user_account_id"`
    InstrumentID        string `json:"instrument_id"`
    InstrumentName      string `json:"instrument_name"`
    Status              string `json:"status"`
    Quantity            int    `json:"quantity"`
    AverageCost         string `json:"average_cost"`
    TotalCost           string `json:"total_cost"`
    CurrentMarketValue  string `json:"current_market_value"`
    LastTradePrice      string `json:"last_trade_price"`
    OpenedAt            string `json:"opened_at"`
    ClosedAt            *string `json:"closed_at"`
    InsertedAt          string `json:"inserted_at"`
}

type PositionsResponse struct {
    Data []Position `json:"data"`
    Meta struct {
        TotalCount  int  `json:"total_count"`
        CurrentPage int  `json:"current_page"`
        PageSize    int  `json:"page_size"`
        TotalPages  int  `json:"total_pages"`
        HasNextPage bool `json:"has_next_page"`
    } `json:"meta"`
}

func getPositions(auth *SignatureAuth, filters map[string]string) (*PositionsResponse, error) {
    path := "/api/v1/positions"
    headers := auth.GetHeaders("GET", path, "")
    
    // Build URL with query parameters
    baseURL := "https://trading.api.thegrid.ai" + path
    params := url.Values{}
    for k, v := range filters {
        params.Add(k, v)
    }
    
    if len(params) > 0 {
        baseURL += "?" + params.Encode()
    }
    
    req, _ := http.NewRequest("GET", baseURL, nil)
    for k, v := range headers {
        req.Header.Set(k, v)
    }
    req.Header.Set("Content-Type", "application/json")
    
    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    var result PositionsResponse
    json.NewDecoder(resp.Body).Decode(&result)
    
    return &result, nil
}

// Usage
auth, _ := NewSignatureAuth(privateKey, publicKey)
positions, _ := getPositions(auth, map[string]string{
    "filters[0][field]": "status",
    "filters[0][value]": "open",
})

fmt.Printf("Open positions: %d\n", len(positions.Data))
```

## Best Practices

1. **Monitor P&L** - Track positions regularly to manage risk
2. **Filter by status** - Use status filters to focus on open or closed positions
3. **Sort by opened_at** - View positions chronologically
4. **Calculate metrics** - Use position data to calculate portfolio metrics
5. **Subscribe to WebSocket** - Use `positions:<user_id>` channel for real-time updates

## WebSocket Integration

For real-time position updates, subscribe to the positions channel. See [WebSocket Documentation](./5-websockets.md#positions-channel).

```javascript
// Subscribe to position updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'positions',
  user_id: 'your_user_id'
}));

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.type === 'open_position') {
    console.log('New position opened:', msg.data);
  } else if (msg.type === 'update_position') {
    console.log('Position updated:', msg.data);
  } else if (msg.type === 'close_position') {
    console.log('Position closed:', msg.data);
  }
});
```

