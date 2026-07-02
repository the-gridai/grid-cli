# Instruments API

The Instruments API provides information about tradeable instruments including AI commodities and currencies.

## Authentication

Instrument data is **public** and does not require authentication for read-only access.

## What are Instruments?

Instruments represent tradeable assets on the GRID exchange:
- **AI Commodities** - AI inference tokens (e.g., GPT-4, Claude-3)
- **Currencies** - Fiat currencies (e.g., USD)

Each AI commodity instrument includes specifications like context window, token throughput, qualifying models, and SLA requirements.

## Endpoints

### List All Instruments

**`GET /api/v1/instruments`**

Retrieve all available instruments.

**Response**:

```json
{
  "data": [
    {
      "instrument_id": "instrument_test-ai-77096",
      "symbol": "CLAUDE3_INFERENCE_USD_77096",
      "instrument_type": "ai_commodity",
      "description": "Claude-3 Inference Token Trading",
      "status": "active",
      "created_at": "2025-12-02T13:02:51Z",
      "updated_at": "2025-12-02T13:02:51Z"
    },
    {
      "instrument_id": "instrument_test-ai-63798",
      "symbol": "USD-2216",
      "instrument_type": "currency",
      "description": "US Dollar Currency",
      "status": "active",
      "created_at": "2025-12-02T13:02:51Z",
      "updated_at": "2025-12-02T13:02:51Z"
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

### Get Instrument by ID

**`GET /api/v1/instruments/:instrument_id`**

Get detailed information about a specific instrument.

**Response (AI Commodity)**:

```json
{
  "data": {
    "instrument_id": "instrument_test-ai-21159",
    "symbol": "CLAUDE3_INFERENCE_USD_21159",
    "name": "CLAUDE3_INFERENCE_USD_21159",
    "instrument_type": "ai_commodity",
    "description": "Claude-3 Inference Token Trading",
    "status": "active",
    "basic_info": {
      "service_type": "text_generation"
    },
    "ai_specs": {
      "context_window": 200000,
      "token_throughput": 50,
      "tokens_per_unit": 1000,
      "unit_definition": "per_1000_input_tokens",
      "qualifying_models": [
        "gpt-5",
        "gpt-5-mini"
      ]
    },
    "sla_requirements": {
      "availability_target": 99.95,
      "max_latency_ms": 300,
      "quality_score_min": 90
    },
    "trading_params": {
      "min_quantity": 1,
      "max_quantity": 10000,
      "quantity_increment": 1
    },
    "last_trade_price": null,
    "last_trade_at": null,
    "last_quote_at": null,
    "price_range_24h_high": null,
    "price_range_24h_low": null,
    "volume_24h": "0",
    "total_volume": "0",
    "total_trades": 0,
    "total_quotes": 0,
    "created_at": "2025-12-02T13:02:51Z",
    "updated_at": "2025-12-02T13:02:51Z"
  }
}
```

**Response (Currency)**:

```json
{
  "data": {
    "instrument_id": "instrument_test-ai-2739",
    "symbol": "USD-5595",
    "name": "USD-5595",
    "instrument_type": "currency",
    "description": "US Dollar Currency",
    "status": "active",
    "basic_info": {
      "currency_code": "USD",
      "precision": 2
    },
    "ai_specs": {},
    "sla_requirements": {
      "availability_target": 99.95,
      "max_latency_ms": 300,
      "quality_score_min": 90
    },
    "trading_params": {
      "min_quantity": 1,
      "max_quantity": 10000,
      "quantity_increment": 1
    },
    "last_trade_price": null,
    "volume_24h": "0",
    "total_volume": "0",
    "total_trades": 0,
    "created_at": "2025-12-02T13:02:51Z",
    "updated_at": "2025-12-02T13:02:51Z"
  }
}
```

### Get Instrument by Symbol

**`GET /api/v1/instruments/by-symbol/:symbol`**

Look up an instrument by its trading symbol.

**Example**: `/api/v1/instruments/by-symbol/CLAUDE3_INFERENCE_USD_68621`

**Response**: Same structure as Get Instrument by ID

## Field Descriptions

### AI Commodity Fields

| Field | Type | Description |
|-------|------|-------------|
| `instrument_id` | string | Unique identifier |
| `symbol` | string | Trading symbol |
| `name` | string | Instrument name |
| `instrument_type` | string | `ai_commodity` or `currency` |
| `description` | string | Human-readable description |
| `status` | string | `active`, `inactive`, `deprecated` |
| `basic_info.service_type` | string | Type of AI service (e.g., `text_generation`) |
| `ai_specs.context_window` | integer | Maximum context window size |
| `ai_specs.token_throughput` | integer | Tokens per second throughput |
| `ai_specs.tokens_per_unit` | integer | Number of tokens per trading unit |
| `ai_specs.unit_definition` | string | What each unit represents |
| `ai_specs.qualifying_models` | array | List of models that qualify |
| `sla_requirements.availability_target` | float | Uptime percentage target |
| `sla_requirements.max_latency_ms` | integer | Maximum latency in milliseconds |
| `sla_requirements.quality_score_min` | integer | Minimum quality score |
| `trading_params.min_quantity` | integer | Minimum order quantity |
| `trading_params.max_quantity` | integer | Maximum order quantity |
| `trading_params.quantity_increment` | integer | Quantity step size |

### Market Data Fields

| Field | Type | Description |
|-------|------|-------------|
| `last_trade_price` | string | Most recent trade price |
| `last_trade_at` | string | Timestamp of last trade |
| `last_quote_at` | string | Timestamp of last quote |
| `price_range_24h_high` | string | 24-hour high price |
| `price_range_24h_low` | string | 24-hour low price |
| `volume_24h` | string | 24-hour trading volume |
| `total_volume` | string | All-time trading volume |
| `total_trades` | integer | Total number of trades |
| `total_quotes` | integer | Total number of quotes |

## Examples

### Example: JavaScript/TypeScript

```javascript
import axios from 'axios';

const BASE_URL = 'https://trading.api.thegrid.ai/v1';

async function listInstruments() {
  const response = await axios.get(`${BASE_URL}/instruments`);
  return response.data.data;
}

async function getInstrumentById(instrumentId) {
  const response = await axios.get(`${BASE_URL}/instruments/${instrumentId}`);
  return response.data.data;
}

async function getInstrumentBySymbol(symbol) {
  const response = await axios.get(`${BASE_URL}/instruments/by-symbol/${symbol}`);
  return response.data.data;
}

// List all instruments
const instruments = await listInstruments();

console.log('Available instruments:');
instruments.forEach(inst => {
  console.log(`  ${inst.symbol} (${inst.instrument_type}) - ${inst.description}`);
});

// Get AI commodity details
const aiInstruments = instruments.filter(i => i.instrument_type === 'ai_commodity');
console.log(`\nFound ${aiInstruments.length} AI commodity instruments`);

// Get detailed specs for first AI commodity
if (aiInstruments.length > 0) {
  const details = await getInstrumentById(aiInstruments[0].instrument_id);
  
  console.log(`\n${details.symbol} Specifications:`);
  console.log(`  Context Window: ${details.ai_specs.context_window} tokens`);
  console.log(`  Throughput: ${details.ai_specs.token_throughput} tokens/sec`);
  console.log(`  Tokens per Unit: ${details.ai_specs.tokens_per_unit}`);
  console.log(`  Qualifying Models: ${details.ai_specs.qualifying_models?.join(', ') || 'None'}`);
  console.log(`\nSLA Requirements:`);
  console.log(`  Availability: ${details.sla_requirements.availability_target}%`);
  console.log(`  Max Latency: ${details.sla_requirements.max_latency_ms}ms`);
  console.log(`  Min Quality: ${details.sla_requirements.quality_score_min}`);
}

// Search by symbol
try {
  const claude = await getInstrumentBySymbol('CLAUDE3_INFERENCE_USD');
  console.log(`\nFound by symbol: ${claude.name}`);
} catch (e) {
  console.log('Symbol not found');
}
```

### Example: Python

```python
import requests
from typing import List, Dict

BASE_URL = 'https://trading.api.thegrid.ai/v1'

def list_instruments() -> List[Dict]:
    """List all available instruments"""
    response = requests.get(f'{BASE_URL}/instruments')
    response.raise_for_status()
    return response.json()['data']

def get_instrument(instrument_id: str) -> Dict:
    """Get detailed instrument information"""
    response = requests.get(f'{BASE_URL}/instruments/{instrument_id}')
    response.raise_for_status()
    return response.json()['data']

def get_instrument_by_symbol(symbol: str) -> Dict:
    """Get instrument by trading symbol"""
    response = requests.get(f'{BASE_URL}/instruments/by-symbol/{symbol}')
    response.raise_for_status()
    return response.json()['data']

def filter_ai_commodities(instruments: List[Dict]) -> List[Dict]:
    """Filter for AI commodity instruments only"""
    return [i for i in instruments if i['instrument_type'] == 'ai_commodity']

def print_instrument_specs(instrument: Dict):
    """Pretty print instrument specifications"""
    print(f"\n{instrument['symbol']} ({instrument['instrument_type']})")
    print(f"Description: {instrument['description']}")
    print(f"Status: {instrument['status']}")
    
    if instrument['instrument_type'] == 'ai_commodity':
        specs = instrument['ai_specs']
        print(f"\nAI Specifications:")
        print(f"  Service Type: {instrument['basic_info']['service_type']}")
        print(f"  Context Window: {specs['context_window']:,} tokens")
        print(f"  Token Throughput: {specs['token_throughput']} tokens/sec")
        print(f"  Tokens per Unit: {specs['tokens_per_unit']}")
        print(f"  Unit Definition: {specs['unit_definition']}")
        
        if 'qualifying_models' in specs and specs['qualifying_models']:
            print(f"  Qualifying Models: {', '.join(specs['qualifying_models'])}")
        
        print(f"\nSLA Requirements:")
        sla = instrument['sla_requirements']
        print(f"  Availability: {sla['availability_target']}%")
        print(f"  Max Latency: {sla['max_latency_ms']}ms")
        print(f"  Min Quality Score: {sla['quality_score_min']}")
    
    print(f"\nTrading Parameters:")
    params = instrument['trading_params']
    print(f"  Min Quantity: {params['min_quantity']}")
    print(f"  Max Quantity: {params['max_quantity']}")
    print(f"  Quantity Increment: {params['quantity_increment']}")

# Usage
instruments = list_instruments()
ai_commodities = filter_ai_commodities(instruments)

print(f"Total instruments: {len(instruments)}")
print(f"AI Commodities: {len(ai_commodities)}")

# Get detailed specs for each AI commodity
for ai_inst in ai_commodities[:3]:  # First 3
    details = get_instrument(ai_inst['instrument_id'])
    print_instrument_specs(details)
```

### Example: Go

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
    Name           string `json:"name"`
    InstrumentType string `json:"instrument_type"`
    Description    string `json:"description"`
    Status         string `json:"status"`
    BasicInfo      map[string]interface{} `json:"basic_info"`
    AISpecs        AISpecs `json:"ai_specs"`
    SLARequirements SLARequirements `json:"sla_requirements"`
    TradingParams  TradingParams `json:"trading_params"`
    CreatedAt      string `json:"created_at"`
    UpdatedAt      string `json:"updated_at"`
}

type AISpecs struct {
    ContextWindow     int      `json:"context_window"`
    TokenThroughput   int      `json:"token_throughput"`
    TokensPerUnit     int      `json:"tokens_per_unit"`
    UnitDefinition    string   `json:"unit_definition"`
    QualifyingModels  []string `json:"qualifying_models"`
}

type SLARequirements struct {
    AvailabilityTarget float64 `json:"availability_target"`
    MaxLatencyMs       int     `json:"max_latency_ms"`
    QualityScoreMin    int     `json:"quality_score_min"`
}

type TradingParams struct {
    MinQuantity       int `json:"min_quantity"`
    MaxQuantity       int `json:"max_quantity"`
    QuantityIncrement int `json:"quantity_increment"`
}

type InstrumentsResponse struct {
    Data []Instrument `json:"data"`
    Meta struct {
        TotalCount int `json:"total_count"`
    } `json:"meta"`
}

type InstrumentResponse struct {
    Data Instrument `json:"data"`
}

func listInstruments() ([]Instrument, error) {
    resp, err := http.Get(BaseURL + "/instruments")
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    var result InstrumentsResponse
    json.NewDecoder(resp.Body).Decode(&result)
    
    return result.Data, nil
}

func getInstrument(instrumentID string) (*Instrument, error) {
    url := fmt.Sprintf("%s/instruments/%s", BaseURL, instrumentID)
    resp, err := http.Get(url)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    var result InstrumentResponse
    json.NewDecoder(resp.Body).Decode(&result)
    
    return &result.Data, nil
}

func getInstrumentBySymbol(symbol string) (*Instrument, error) {
    url := fmt.Sprintf("%s/instruments/by-symbol/%s", BaseURL, symbol)
    resp, err := http.Get(url)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    var result InstrumentResponse
    json.NewDecoder(resp.Body).Decode(&result)
    
    return &result.Data, nil
}

func main() {
    // List all instruments
    instruments, _ := listInstruments()
    fmt.Printf("Total instruments: %d\n", len(instruments))
    
    // Filter AI commodities
    aiCount := 0
    for _, inst := range instruments {
        if inst.InstrumentType == "ai_commodity" {
            aiCount++
            fmt.Printf("  %s - %s\n", inst.Symbol, inst.Description)
        }
    }
    fmt.Printf("\nAI Commodities: %d\n", aiCount)
    
    // Get detailed specs
    if len(instruments) > 0 {
        details, _ := getInstrument(instruments[0].InstrumentID)
        fmt.Printf("\n%s Specifications:\n", details.Symbol)
        if details.InstrumentType == "ai_commodity" {
            fmt.Printf("  Context Window: %d tokens\n", details.AISpecs.ContextWindow)
            fmt.Printf("  Token Throughput: %d tokens/sec\n", details.AISpecs.TokenThroughput)
            fmt.Printf("  Qualifying Models: %v\n", details.AISpecs.QualifyingModels)
        }
    }
}
```

## Understanding AI Specifications

### Context Window

The maximum number of tokens that can be processed in a single request. Larger context windows allow for more complex prompts and longer conversations.

### Token Throughput

The expected processing speed in tokens per second. Higher throughput means faster response times.

### Qualifying Models

Array of AI model names that meet the instrument's specifications. For example:
- `gpt-5`, `gpt-5-mini` - GPT-5 family models
- `claude-3-opus`, `claude-3-sonnet` - Claude-3 family models

### Unit Definition

Describes what each trading unit represents:
- `per_1000_input_tokens` - 1 unit = 1,000 input tokens
- `per_1000_output_tokens` - 1 unit = 1,000 output tokens

## Trading Parameters

Each instrument has trading constraints:

| Parameter | Description |
|-----------|-------------|
| `min_quantity` | Minimum order size (usually 1) |
| `max_quantity` | Maximum order size (usually 10,000) |
| `quantity_increment` | Order size must be multiple of this (usually 1) |

**Example Validation**:

```javascript
function validateOrderQuantity(quantity, tradingParams) {
  if (quantity < tradingParams.min_quantity) {
    throw new Error(`Quantity must be at least ${tradingParams.min_quantity}`);
  }
  
  if (quantity > tradingParams.max_quantity) {
    throw new Error(`Quantity cannot exceed ${tradingParams.max_quantity}`);
  }
  
  if (quantity % tradingParams.quantity_increment !== 0) {
    throw new Error(`Quantity must be multiple of ${tradingParams.quantity_increment}`);
  }
  
  return true;
}

// Get instrument details before placing order
const instrument = await getInstrument('instrument_abc');
const orderQty = 150;

try {
  validateOrderQuantity(orderQty, instrument.trading_params);
  // Proceed with order
} catch (e) {
  console.error(`Invalid quantity: ${e.message}`);
}
```

## SLA Requirements

Service Level Agreement parameters that suppliers must meet:

```javascript
function checkSLACompliance(instrument) {
  const sla = instrument.sla_requirements;
  
  console.log(`SLA Requirements for ${instrument.symbol}:`);
  console.log(`  Uptime: ${sla.availability_target}%`);
  console.log(`  Max Response Time: ${sla.max_latency_ms}ms`);
  console.log(`  Quality Score: ${sla.quality_score_min}/100`);
  
  // Suppliers not meeting these requirements may face penalties
  // or lose their ability to fulfill orders
}
```

## Use Cases

### 1. Instrument Discovery

```javascript
async function findBestAIModel(minContextWindow, maxPrice) {
  const instruments = await listInstruments();
  const aiInstruments = instruments.filter(i => 
    i.instrument_type === 'ai_commodity'
  );
  
  const qualified = [];
  
  for (const inst of aiInstruments) {
    const details = await getInstrument(inst.instrument_id);
    
    if (details.ai_specs.context_window >= minContextWindow) {
      const price = details.last_trade_price ? parseFloat(details.last_trade_price) : null;
      
      if (!price || price <= maxPrice) {
        qualified.push({
          symbol: details.symbol,
          contextWindow: details.ai_specs.context_window,
          price: price || 'N/A',
          models: details.ai_specs.qualifying_models
        });
      }
    }
  }
  
  return qualified.sort((a, b) => b.contextWindow - a.contextWindow);
}

// Find AI models with 100k+ context window under $50
const options = await findBestAIModel(100000, 50);
console.log('Available options:', options);
```

### 2. Pre-Order Validation

```python
def validate_order_params(instrument_id, quantity, price=None):
    """Validate order parameters against instrument specs"""
    instrument = get_instrument(instrument_id)
    
    # Check quantity constraints
    params = instrument['trading_params']
    
    if quantity < params['min_quantity']:
        raise ValueError(f"Quantity below minimum: {params['min_quantity']}")
    
    if quantity > params['max_quantity']:
        raise ValueError(f"Quantity above maximum: {params['max_quantity']}")
    
    if quantity % params['quantity_increment'] != 0:
        raise ValueError(f"Quantity must be multiple of {params['quantity_increment']}")
    
    # Check instrument status
    if instrument['status'] != 'active':
        raise ValueError(f"Instrument is not active: {instrument['status']}")
    
    print(f"✓ Order parameters valid for {instrument['symbol']}")
    return True

# Validate before placing order
try:
    validate_order_params('instrument_abc', 100)
    # Place order
except ValueError as e:
    print(f"Order validation failed: {e}")
```

### 3. Model Comparison

```python
def compare_ai_models():
    """Compare available AI model instruments"""
    instruments = list_instruments()
    ai_instruments = [i for i in instruments if i['instrument_type'] == 'ai_commodity']
    
    comparison = []
    
    for inst in ai_instruments:
        details = get_instrument(inst['instrument_id'])
        
        if not details['ai_specs']:
            continue
        
        specs = details['ai_specs']
        
        comparison.append({
            'symbol': details['symbol'],
            'context_window': specs['context_window'],
            'throughput': specs['token_throughput'],
            'models': len(specs.get('qualifying_models', [])),
            'price': details['last_trade_price'] or 'N/A',
            'sla_availability': details['sla_requirements']['availability_target']
        })
    
    # Sort by context window (descending)
    comparison.sort(key=lambda x: x['context_window'], reverse=True)
    
    # Display comparison table
    print(f"{'Symbol':<30} {'Context':<15} {'Throughput':<15} {'Models':<10} {'Price':<15}")
    print("-" * 85)
    
    for item in comparison:
        print(f"{item['symbol']:<30} {item['context_window']:>10,} tk  {item['throughput']:>10} t/s  {item['models']:>7}  ${str(item['price']):<10}")

# Compare all AI models
compare_ai_models()
```

## Best Practices

1. **Cache instrument data** - Instrument specifications don't change frequently
2. **Validate before trading** - Check trading_params before placing orders
3. **Monitor qualifying models** - Model availability may change over time
4. **Check instrument status** - Only trade active instruments
5. **Compare SLAs** - Choose instruments based on reliability requirements
6. **Use symbols for lookup** - Symbols are more readable than IDs
7. **Track volume data** - Use volume metrics to assess liquidity

## Common Error Codes

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `INSTRUMENT_NOT_FOUND` | 404 | Instrument ID or symbol not found |
| `INVALID_FILTER` | 400 | Filter parameters are invalid |


