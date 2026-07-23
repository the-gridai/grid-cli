/**
 * Mock data for Grid API
 */

import { v4 as uuidv4 } from 'uuid';

// Generate deterministic IDs for testing
export function generateId(prefix: string): string {
  return `${prefix}-${uuidv4().slice(0, 8)}`;
}

// Mock markets
export const markets = [
  {
    market_id: 'mkt-btc-usd',
    id: 'mkt-btc-usd',
    name: 'BTC-USD',
    description: 'Bitcoin to US Dollar',
    market_type: 'spot',
    status: 'active',
    allowed_instruments: ['btc', 'usd'],
    instruments: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    market_id: 'mkt-eth-usd',
    id: 'mkt-eth-usd',
    name: 'ETH-USD',
    description: 'Ethereum to US Dollar',
    market_type: 'spot',
    status: 'active',
    allowed_instruments: ['eth', 'usd'],
    instruments: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    market_id: 'mkt-compute-usd',
    id: 'mkt-compute-usd',
    name: 'COMPUTE-USD',
    description: 'AI Compute to US Dollar',
    market_type: 'ai_commodity',
    status: 'active',
    allowed_instruments: ['compute', 'usd'],
    instruments: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

// Mock tickers
export const tickers: Record<string, unknown> = {
  'mkt-btc-usd': {
    market_id: 'mkt-btc-usd',
    symbol: 'BTC-USD',
    last_price: '52000.00',
    last_trade_quantity: '0.5',
    last_trade_timestamp: new Date().toISOString(),
    highest_bid: '51999.00',
    lowest_ask: '52001.00',
    bid: '51999.00',
    ask: '52001.00',
    volume_24h: '1234.56',
    high_24h: '53000.00',
    low_24h: '51000.00',
    price_change_24h: '1000.00',
    price_change_percent_24h: '1.96',
    timestamp: new Date().toISOString(),
  },
  'mkt-eth-usd': {
    market_id: 'mkt-eth-usd',
    symbol: 'ETH-USD',
    last_price: '3200.00',
    last_trade_quantity: '2.0',
    last_trade_timestamp: new Date().toISOString(),
    highest_bid: '3199.00',
    lowest_ask: '3201.00',
    bid: '3199.00',
    ask: '3201.00',
    volume_24h: '5678.90',
    high_24h: '3300.00',
    low_24h: '3100.00',
    price_change_24h: '50.00',
    price_change_percent_24h: '1.59',
    timestamp: new Date().toISOString(),
  },
  'mkt-compute-usd': {
    market_id: 'mkt-compute-usd',
    symbol: 'COMPUTE-USD',
    last_price: '0.0015',
    last_trade_quantity: '1000',
    last_trade_timestamp: new Date().toISOString(),
    highest_bid: '0.00149',
    lowest_ask: '0.00151',
    bid: '0.00149',
    ask: '0.00151',
    volume_24h: '10000000',
    high_24h: '0.0016',
    low_24h: '0.0014',
    price_change_24h: '0.0001',
    price_change_percent_24h: '7.14',
    timestamp: new Date().toISOString(),
  },
};

// Mock order book generator
// Uses the exchange format: buy/sell with quantity field (not bids/asks with quantity)
export function generateOrderBook(marketId: string, depth: number = 20) {
  const ticker = tickers[marketId];
  if (!ticker) return null;

  const lastPrice = parseFloat((ticker as { last_price: string }).last_price);
  const buy: Array<{ price: string; quantity: number; total: number; order_count: number }> = [];
  const sell: Array<{ price: string; quantity: number; total: number; order_count: number }> = [];

  let buyTotal = 0;
  let sellTotal = 0;

  for (let i = 0; i < depth; i++) {
    const bidPrice = lastPrice * (1 - 0.001 * (i + 1));
    const askPrice = lastPrice * (1 + 0.001 * (i + 1));
    const quantity = Math.floor(Math.random() * 50) + 5;

    buyTotal += quantity;
    sellTotal += quantity;

    buy.push({
      price: bidPrice.toFixed(2),
      quantity,
      total: buyTotal,
      order_count: Math.floor(Math.random() * 5) + 1,
    });

    sell.push({
      price: askPrice.toFixed(2),
      quantity,
      total: sellTotal,
      order_count: Math.floor(Math.random() * 5) + 1,
    });
  }

  return {
    buy,
    sell,
  };
}

// In-memory order storage
export const orders: Map<string, Order> = new Map();

export interface Order {
  id: string;
  order_id: string;
  market_id: string;
  market_name: string | null;
  instrument_id: string;
  side: 'buy' | 'sell';
  type: string;
  status: string;
  quantity: string;
  filled_quantity: number;
  price: string | null;
  average_price: string | null;
  stop_price: string | null;
  fee: string;
  time_in_force: string;
  client_order_id: string | null;
  created_at: string;
  updated_at: string;
}

// In-memory trade storage
export const trades: Map<string, Trade> = new Map();

export interface Trade {
  id: string;
  trade_id: string;
  market_id: string;
  market_name: string | null;
  instrument_id: string;
  price: string;
  quantity: string;
  total_value: string;
  fee: string;
  side: 'buy' | 'sell';
  execution_timestamp: string;
  settlement_timestamp: string | null;
  order_id: string | null;
}

// Mock trading accounts
export const tradingAccounts = [
  {
    account_id: 'ta-btc-001',
    id: 'ta-btc-001',
    instrument_id: 'btc',
    instrument_symbol: 'BTC',
    instrument_name: 'Bitcoin',
    total_balance: '10.5',
    available_balance: '8.5',
    reserved_balance: '2.0',
    locked_balance: '0',
    status: 'active',
    updated_at: new Date().toISOString(),
  },
  {
    account_id: 'ta-usd-001',
    id: 'ta-usd-001',
    instrument_id: 'usd',
    instrument_symbol: 'USD',
    instrument_name: 'US Dollar',
    total_balance: '100000.00',
    available_balance: '75000.00',
    reserved_balance: '25000.00',
    locked_balance: '0',
    status: 'active',
    updated_at: new Date().toISOString(),
  },
  {
    account_id: 'ta-eth-001',
    id: 'ta-eth-001',
    instrument_id: 'eth',
    instrument_symbol: 'ETH',
    instrument_name: 'Ethereum',
    total_balance: '50.0',
    available_balance: '50.0',
    reserved_balance: '0',
    locked_balance: '0',
    status: 'active',
    updated_at: new Date().toISOString(),
  },
];

// Mock consumption accounts
export const consumptionAccounts = [
  {
    account_id: 'ca-compute-001',
    user_id: 'user-001',
    instrument_id: 'compute',
    status: 'active',
    uncommitted_balance: 5000000,
    committed_balance: 0,
    total_balance: 5000000,
    total_deposits: 5000000,
    total_withdrawals: 0,
    total_commitments: 0,
    total_transfers_in: 0,
    total_transfers_out: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: new Date().toISOString(),
  },
];

// Mock issuance accounts (for suppliers)
export const issuanceAccounts = [
  {
    account_id: 'ia-compute-001',
    id: 'ia-compute-001',
    instrument_id: 'compute',
    instrument_symbol: 'COMPUTE',
    total_issued: '10000000',
    total_transferred: '5000000',
    available_balance: '5000000',
    updated_at: new Date().toISOString(),
  },
];

// Mock user
export const mockUser = {
  user_id: 'user-001',
  id: 'user-001',
  email: 'test@example.com',
  name: 'Test User',
  email_verified: true,
  accepted_terms: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: new Date().toISOString(),
};

// Generate mock public trades
export function generatePublicTrades(marketId: string, limit: number = 50) {
  const ticker = tickers[marketId];
  if (!ticker) return [];

  const lastPrice = parseFloat((ticker as { last_price: string }).last_price);
  const tradesList = [];

  for (let i = 0; i < limit; i++) {
    const priceVariation = lastPrice * (1 + (Math.random() - 0.5) * 0.01);
    const quantity = (Math.random() * 5 + 0.1).toFixed(4);
    const timestamp = new Date(Date.now() - i * 60000).toISOString();

    tradesList.push({
      trade_id: `trade-${Date.now()}-${i}`,
      id: `trade-${Date.now()}-${i}`,
      market_id: marketId,
      price: priceVariation.toFixed(2),
      quantity,
      side: Math.random() > 0.5 ? 'buy' : 'sell',
      execution_timestamp: timestamp,
      timestamp,
    });
  }

  return tradesList;
}
