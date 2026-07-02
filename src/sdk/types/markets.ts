/**
 * Market-related types for GRID Exchange
 */

/**
 * Market status
 */
export type MarketStatus = 'active' | 'inactive' | 'suspended' | 'closed';

/**
 * Market information (from Trading API)
 */
export interface Market {
  market_id: string;
  id?: string;
  name: string;
  description?: string | null;
  market_type?: string;
  status: string;
  associated_instruments?: string[];
  instruments?: any[];
  created_at: string;
  updated_at: string;
  // Allow any additional fields
  [key: string]: any;
}

/**
 * Instrument (asset) information
 */
export interface Instrument {
  instrument_id: string;
  id?: string;
  symbol: string;
  name: string;
  instrument_type: 'currency' | 'ai_commodity' | 'token';
  description?: string | null;
  precision: number;
  min_withdrawal?: string;
  max_withdrawal?: string;
  withdrawal_fee?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Market ticker data
 */
export interface Ticker {
  market_id?: string;
  symbol?: string;
  last_price?: string | null; // Can be null when no trades
  last_trade_quantity?: string | number | null; // API returns number
  last_trade_timestamp?: string | null;
  highest_bid?: string | null; // Can be null when no bids
  lowest_ask?: string | null; // Can be null when no asks
  bid?: string | null; // Alias
  ask?: string | null; // Alias
  volume_24h: string | number; // API returns number
  high_24h?: string;
  low_24h?: string;
  quote_volume_24h?: string;
  price_change_24h?: string;
  price_change_percent_24h?: string;
  timestamp?: string;
}

/**
 * Order book level
 */
export interface OrderBookLevel {
  price: string;
  quantity: string;
  order_count?: number;
}

/**
 * Order book
 */
export interface OrderBook {
  market_id: string;
  symbol?: string;
  bids: OrderBookLevel[];
  buy?: OrderBookLevel[]; // Alias for bids
  asks: OrderBookLevel[];
  sell?: OrderBookLevel[]; // Alias for asks
  timestamp: string;
  sequence?: number;
}

/**
 * Public trade (recent market trade)
 */
export interface PublicTrade {
  trade_id: string;
  id?: string; // Alias
  market_id: string;
  price: string;
  quantity: string;
  side: 'buy' | 'sell';
  execution_timestamp: string;
  timestamp?: string; // Alias
}

/**
 * Market statistics
 */
export interface MarketStats {
  market_id: string;
  symbol: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  quote_volume: string;
  num_trades: number;
  period_start: string;
  period_end: string;
}

/**
 * OHLCV data (price history)
 */
export interface OHLCV {
  market_id: string;
  resolution: string;
  period_start: string;
  period_end: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  quote_volume?: string;
  num_trades?: number;
}

/**
 * Price history filters
 */
export interface PriceHistoryFilters {
  market_id: string;
  resolution: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';
  from: number; // Unix timestamp
  to: number; // Unix timestamp
}
