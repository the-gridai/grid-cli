# Price History API

The Price History API provides OHLCV (Open, High, Low, Close, Volume) candlestick data for charting and market analysis.

## Authentication

Price history data is **public** and does not require authentication for read-only access.

## Endpoints

### Get Price History

**`GET /api/v1/price_histories`**

Retrieve historical price candles for charting and analysis.

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `filters[n][field]` | string | No | - | Field to filter on |
| `filters[n][value]` | string | No | - | Filter value |
| `order_by[]` | string | No | - | Fields to sort by |
| `order_directions[]` | string | No | - | Sort directions (asc, desc) |
| `page` | integer | No | 1 | Page number |
| `page_size` | integer | No | 50 | Results per page (max: 100) |

**Available Filters**:

| Filter | Type | Description | Example |
|--------|------|-------------|---------|
| `market_id` | string | Filter by market | `test-market-123` |
| `resolution` | string | Timeframe interval | `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1d`, `1w`, `1M` |
| `from` | integer | Start time (Unix timestamp) | `1704067200` |
| `to` | integer | End time (Unix timestamp) | `1704153600` |

**Supported Resolutions**:
- `1m` - 1 minute
- `5m` - 5 minutes
- `15m` - 15 minutes
- `30m` - 30 minutes
- `1h` - 1 hour
- `4h` - 4 hours
- `1d` - 1 day
- `1w` - 1 week
- `1M` - 1 month

**Available Sorters**:
- `period_start` - Sort by candle start time

**Response**:

```json
{
  "data": [
    {
      "market_id": "test-market-123",
      "resolution": "1d",
      "time": "2024-01-01T00:00:00Z",
      "open": "90.00000000",
      "high": "100.00000000",
      "low": "85.00000000",
      "close": "100.00000000",
      "volume": 1000,
      "trade_count": 25
    },
    {
      "market_id": "test-market-123",
      "resolution": "1d",
      "time": "2024-01-02T00:00:00Z",
      "open": "100.00000000",
      "high": "110.00000000",
      "low": "95.00000000",
      "close": "105.00000000",
      "volume": 1000,
      "trade_count": 25
    }
  ],
  "meta": {
    "current_offset": 0,
    "current_page": 1,
    "page_size": 50,
    "total_count": 2,
    "total_pages": 1
  }
}
```

**Field Descriptions**:

| Field | Type | Description |
|-------|------|-------------|
| `market_id` | string | Market identifier |
| `resolution` | string | Candle timeframe |
| `time` | string | Candle start time (ISO 8601) |
| `open` | string | Opening price |
| `high` | string | Highest price in period |
| `low` | string | Lowest price in period |
| `close` | string | Closing price |
| `volume` | integer | Total volume traded |
| `trade_count` | integer | Number of trades in period |

## Examples

### Example: Basic Query (JavaScript/TypeScript)

```javascript
import axios from 'axios';

async function getPriceHistory(marketId, resolution, from, to) {
  const params = {
    'filters[0][field]': 'market_id',
    'filters[0][value]': marketId,
    'filters[1][field]': 'resolution',
    'filters[1][value]': resolution,
    'filters[2][field]': 'from',
    'filters[2][value]': from,
    'filters[3][field]': 'to',
    'filters[3][value]': to,
    'order_by[]': 'period_start',
    'order_directions[]': 'asc'
  };
  
  const response = await axios.get(
    'https://trading.api.thegrid.ai/v1/price_histories',
    { params }
  );
  
  return response.data.data;
}

// Get daily candles for the last 30 days
const now = Math.floor(Date.now() / 1000);
const thirtyDaysAgo = now - (30 * 24 * 60 * 60);

const candles = await getPriceHistory(
  'market_b310e860-97cd-45eb-bdc3-5be0b79295d0',
  '1d',
  thirtyDaysAgo,
  now
);

console.log(`Retrieved ${candles.length} daily candles`);

// Calculate price change
const firstCandle = candles[0];
const lastCandle = candles[candles.length - 1];
const priceChange = parseFloat(lastCandle.close) - parseFloat(firstCandle.open);
const priceChangePct = (priceChange / parseFloat(firstCandle.open)) * 100;

console.log(`30-day price change: ${priceChangePct.toFixed(2)}%`);
```

### Example: Building a Chart (JavaScript/TypeScript)

```javascript
import axios from 'axios';

class MarketChartData {
  async fetchCandles(marketId, resolution, startTime, endTime) {
    const params = {
      'filters[0][field]': 'market_id',
      'filters[0][value]': marketId,
      'filters[1][field]': 'resolution',
      'filters[1][value]': resolution,
      'filters[2][field]': 'from',
      'filters[2][value]': startTime.toString(),
      'filters[3][field]': 'to',
      'filters[3][value]': endTime.toString(),
      'order_by[]': 'period_start',
      'order_directions[]': 'asc'
    };
    
    const response = await axios.get(
      'https://trading.api.thegrid.ai/v1/price_histories',
      { params }
    );
    
    return response.data.data;
  }
  
  formatForTradingView(candles) {
    // Format for TradingView or similar charting libraries
    return candles.map(candle => ({
      time: new Date(candle.time).getTime() / 1000, // Unix timestamp
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
      volume: candle.volume
    }));
  }
  
  calculateIndicators(candles) {
    const closes = candles.map(c => parseFloat(c.close));
    
    // Simple Moving Average (20-period)
    const sma20 = [];
    for (let i = 19; i < closes.length; i++) {
      const sum = closes.slice(i - 19, i + 1).reduce((a, b) => a + b, 0);
      sma20.push(sum / 20);
    }
    
    return { sma20 };
  }
}

// Usage
const chart = new MarketChartData();
const candles = await chart.fetchCandles(
  'market_b310e860-97cd-45eb-bdc3-5be0b79295d0',
  '1h',
  Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60), // 7 days ago
  Math.floor(Date.now() / 1000)
);

const tvData = chart.formatForTradingView(candles);
const indicators = chart.calculateIndicators(candles);
```

### Example: Python

```python
import requests
from datetime import datetime, timedelta

def get_price_history(market_id, resolution, from_ts, to_ts):
    """
    Get price history candles for a market
    
    Args:
        market_id: Market identifier
        resolution: Candle resolution (1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w, 1M)
        from_ts: Start timestamp (Unix seconds)
        to_ts: End timestamp (Unix seconds)
    
    Returns:
        List of candle dictionaries
    """
    params = {
        'filters[0][field]': 'market_id',
        'filters[0][value]': market_id,
        'filters[1][field]': 'resolution',
        'filters[1][value]': resolution,
        'filters[2][field]': 'from',
        'filters[2][value]': str(from_ts),
        'filters[3][field]': 'to',
        'filters[3][value]': str(to_ts),
        'order_by[]': 'period_start',
        'order_directions[]': 'asc'
    }
    
    response = requests.get(
        'https://trading.api.thegrid.ai/v1/price_histories',
        params=params
    )
    
    response.raise_for_status()
    return response.json()['data']

# Get 1-hour candles for the last 24 hours
now = int(datetime.now().timestamp())
yesterday = int((datetime.now() - timedelta(days=1)).timestamp())

candles = get_price_history(
    'market_b310e860-97cd-45eb-bdc3-5be0b79295d0',
    '1h',
    yesterday,
    now
)

# Analyze candles
print(f"Retrieved {len(candles)} hourly candles")

# Find highest and lowest prices
highs = [float(c['high']) for c in candles]
lows = [float(c['low']) for c in candles]

print(f"24h High: ${max(highs):.2f}")
print(f"24h Low: ${min(lows):.2f}")
print(f"24h Range: ${max(highs) - min(lows):.2f}")

# Calculate total volume
total_volume = sum(c['volume'] for c in candles)
print(f"24h Volume: {total_volume} units")
```

### Example: cURL

```bash
# Get daily candles for a market
MARKET_ID="market_b310e860-97cd-45eb-bdc3-5be0b79295d0"
FROM=$(date -d "30 days ago" +%s)
TO=$(date +%s)

curl -X GET \
  "https://trading.api.thegrid.ai/v1/price_histories?filters[0][field]=market_id&filters[0][value]=${MARKET_ID}&filters[1][field]=resolution&filters[1][value]=1d&filters[2][field]=from&filters[2][value]=${FROM}&filters[3][field]=to&filters[3][value]=${TO}&order_by[]=period_start&order_directions[]=asc" \
  -H "Content-Type: application/json"
```

## Common Use Cases

### 1. Building Price Charts

```javascript
async function buildPriceChart(marketId, resolution, days) {
  const now = Math.floor(Date.now() / 1000);
  const startTime = now - (days * 24 * 60 * 60);
  
  const candles = await getPriceHistory(marketId, resolution, startTime, now);
  
  // Format for Chart.js, TradingView, or other libraries
  const chartData = {
    labels: candles.map(c => c.time),
    datasets: [{
      label: 'Price',
      data: candles.map(c => ({
        x: c.time,
        o: parseFloat(c.open),
        h: parseFloat(c.high),
        l: parseFloat(c.low),
        c: parseFloat(c.close)
      }))
    }]
  };
  
  return chartData;
}

// Get 1-hour candles for last 7 days
const chartData = await buildPriceChart('market_abc', '1h', 7);
```

### 2. Technical Analysis

```python
def calculate_volatility(candles):
    """Calculate price volatility from candles"""
    closes = [float(c['close']) for c in candles]
    
    # Calculate returns
    returns = []
    for i in range(1, len(closes)):
        ret = (closes[i] - closes[i-1]) / closes[i-1]
        returns.append(ret)
    
    # Standard deviation of returns
    mean_return = sum(returns) / len(returns)
    variance = sum((r - mean_return) ** 2 for r in returns) / len(returns)
    volatility = variance ** 0.5
    
    return volatility * 100  # As percentage

# Get candles and calculate volatility
candles = get_price_history('market_abc', '1d', from_ts, to_ts)
vol = calculate_volatility(candles)
print(f"Daily volatility: {vol:.2f}%")
```

### 3. Backtesting Strategies

```javascript
async function backtestStrategy(marketId, startDate, endDate) {
  const from = Math.floor(new Date(startDate).getTime() / 1000);
  const to = Math.floor(new Date(endDate).getTime() / 1000);
  
  const candles = await getPriceHistory(marketId, '1h', from, to);
  
  let position = null;
  let cash = 10000;
  const trades = [];
  
  for (let i = 20; i < candles.length; i++) {
    const currentPrice = parseFloat(candles[i].close);
    const sma20 = calculateSMA(candles.slice(i - 20, i), 20);
    
    // Simple SMA crossover strategy
    if (!position && currentPrice > sma20) {
      // Buy signal
      position = { entry: currentPrice, quantity: cash / currentPrice };
      cash = 0;
      trades.push({ type: 'buy', price: currentPrice, time: candles[i].time });
    } else if (position && currentPrice < sma20) {
      // Sell signal
      cash = position.quantity * currentPrice;
      trades.push({ type: 'sell', price: currentPrice, time: candles[i].time });
      position = null;
    }
  }
  
  // Close position if still open
  if (position) {
    const lastPrice = parseFloat(candles[candles.length - 1].close);
    cash = position.quantity * lastPrice;
  }
  
  const finalValue = cash;
  const returns = ((finalValue - 10000) / 10000) * 100;
  
  console.log(`Backtest Results:`);
  console.log(`  Initial Capital: $10,000`);
  console.log(`  Final Value: $${finalValue.toFixed(2)}`);
  console.log(`  Returns: ${returns.toFixed(2)}%`);
  console.log(`  Trades: ${trades.length}`);
  
  return { finalValue, returns, trades };
}

function calculateSMA(candles, period) {
  const closes = candles.map(c => parseFloat(c.close));
  return closes.reduce((a, b) => a + b, 0) / period;
}
```

## Errors

### Invalid Resolution

```json
{
  "errors": {
    "detail": "Resolution is invalid"
  }
}
```

**Status Code**: `422 Unprocessable Entity`

**Cause**: The `resolution` filter value is not one of the supported values.

**Valid Resolutions**: `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1d`, `1w`, `1M`

## Best Practices

1. **Use appropriate resolution** - Match resolution to your use case (1m for tick data, 1d for longer-term analysis)
2. **Limit time ranges** - Don't request years of 1-minute data in a single request
3. **Cache results** - Historical data doesn't change, cache it locally
4. **Handle gaps** - Markets may have periods with no trading activity
5. **Paginate large requests** - Use pagination for large time ranges
6. **Validate resolution** - Check resolution is valid before making request
7. **Sort by period_start** - Ensure candles are in chronological order

## Integration Examples

### TradingView Integration

```javascript
import axios from 'axios';

class GridDatafeed {
  async getBars(symbolInfo, resolution, from, to, first) {
    // Map TradingView resolution to GRID resolution
    const resolutionMap = {
      '1': '1m',
      '5': '5m',
      '15': '15m',
      '30': '30m',
      '60': '1h',
      '240': '4h',
      'D': '1d',
      'W': '1w',
      'M': '1M'
    };
    
    const gridResolution = resolutionMap[resolution] || '1h';
    
    const params = {
      'filters[0][field]': 'market_id',
      'filters[0][value]': symbolInfo.ticker,
      'filters[1][field]': 'resolution',
      'filters[1][value]': gridResolution,
      'filters[2][field]': 'from',
      'filters[2][value]': from.toString(),
      'filters[3][field]': 'to',
      'filters[3][value]': to.toString(),
      'order_by[]': 'period_start',
      'order_directions[]': 'asc'
    };
    
    const response = await axios.get(
      'https://trading.api.thegrid.ai/v1/price_histories',
      { params }
    );
    
    const candles = response.data.data;
    
    return candles.map(candle => ({
      time: new Date(candle.time).getTime(),
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
      volume: candle.volume
    }));
  }
}
```

### Matplotlib Charting (Python)

```python
import requests
import matplotlib.pyplot as plt
from datetime import datetime, timedelta
import pandas as pd

def fetch_and_plot_candles(market_id, resolution, days):
    """Fetch price history and create a candlestick chart"""
    now = int(datetime.now().timestamp())
    start = int((datetime.now() - timedelta(days=days)).timestamp())
    
    params = {
        'filters[0][field]': 'market_id',
        'filters[0][value]': market_id,
        'filters[1][field]': 'resolution',
        'filters[1][value]': resolution,
        'filters[2][field]': 'from',
        'filters[2][value]': str(start),
        'filters[3][field]': 'to',
        'filters[3][value]': str(now),
        'order_by[]': 'period_start',
        'order_directions[]': 'asc'
    }
    
    response = requests.get(
        'https://trading.api.thegrid.ai/v1/price_histories',
        params=params
    )
    response.raise_for_status()
    
    candles = response.json()['data']
    
    # Convert to DataFrame
    df = pd.DataFrame(candles)
    df['time'] = pd.to_datetime(df['time'])
    df['open'] = df['open'].astype(float)
    df['high'] = df['high'].astype(float)
    df['low'] = df['low'].astype(float)
    df['close'] = df['close'].astype(float)
    
    # Plot
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8), sharex=True)
    
    # Price chart
    ax1.plot(df['time'], df['close'], label='Close Price')
    ax1.fill_between(df['time'], df['low'], df['high'], alpha=0.3)
    ax1.set_ylabel('Price ($)')
    ax1.set_title(f'{market_id} - {resolution} Candles')
    ax1.legend()
    ax1.grid(True)
    
    # Volume chart
    ax2.bar(df['time'], df['volume'], alpha=0.7)
    ax2.set_ylabel('Volume')
    ax2.set_xlabel('Time')
    ax2.grid(True)
    
    plt.tight_layout()
    plt.show()
    
    return df

# Fetch and plot 1-day candles for last 30 days
df = fetch_and_plot_candles('market_abc', '1d', 30)
```

## Rate Limits

- **Public data**: 300 requests/minute
- **Authenticated requests**: Same as Trading API (100 requests/minute)

## WebSocket Updates

For real-time price updates, use the WebSocket channel:

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'price_histories',
  market_id: 'market_b310e860-97cd-45eb-bdc3-5be0b79295d0'
}));
```

See [WebSocket Documentation](./5-websockets.md) for details.


