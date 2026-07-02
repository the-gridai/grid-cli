/**
 * Type definitions for Grid Exchange SDK
 */

// ============================================================================
// SDK Configuration Types
// ============================================================================

/**
 * Grid SDK configuration options
 */
export interface GridClientConfig {
  /** API base URL */
  apiUrl: string;
  /** WebSocket URL (optional, derived from apiUrl if not provided) */
  wsUrl?: string;
  /** Ed25519 signing key (base64 encoded) */
  signingKey: string;
  /** Signing key fingerprint (SHA256 hash of public key) */
  fingerprint: string;
  /** Optional logger for debugging */
  logger?: Logger;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Maximum concurrent requests (default: 10) */
  maxConcurrent?: number;
  /** Minimum interval between requests in ms (default: 100) */
  minInterval?: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Enable/disable retries (default: true) */
  enableRetries?: boolean;
}

/**
 * Logger interface for SDK debugging
 */
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

// ============================================================================
// Core API Types
// ============================================================================

/**
 * Standard API response wrapper from Grid API
 */
export interface ApiResponse<T> {
  data: T;
  error?: ApiErrorResponse;
  meta?: ApiResponseMeta;
}

/**
 * Error response structure
 */
export interface ApiErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Pagination and metadata
 */
export interface ApiResponseMeta {
  page?: number;
  page_size?: number;
  total_count?: number;
  total_pages?: number;
}

// ============================================================================
// Order Types
// ============================================================================

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'limit' | 'market' | 'stop' | 'stop_limit';
export type TimeInForce = 'gtc' | 'ioc' | 'fok' | 'day';
export type OrderStatus =
  | 'open'
  | 'filled'
  | 'cancelled'
  | 'partially_filled'
  | 'pending'
  | 'rejected'
  | 'expired'
  | 'active';

/**
 * Request to place a new order
 */
export interface PlaceOrderRequest {
  market_id: string;
  side: OrderSide;
  type: OrderType;
  quantity: string;
  price?: string;
  stop_price?: string;
  time_in_force?: TimeInForce;
  client_order_id?: string;
  post_only?: boolean;
  reduce_only?: boolean;
}

/**
 * Order response from API
 */
export interface Order {
  order_id: string;
  id?: string;
  market_id: string;
  market_name?: string | null;
  instrument_id?: string;
  instrument_symbol?: string | null;
  instrument_name?: string | null;
  trader_id?: string;
  side: OrderSide;
  type: string;
  status: string;
  quantity: string | number;
  size?: string | number; // Legacy alias
  filled_quantity: number;
  price: string | null;
  average_price?: string | null;
  stop_price?: string | null;
  fee?: string;
  time_in_force: string;
  client_order_id?: string | null;
  closure_reason?: string | null;
  closed_at?: string | null;
  submitted_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface OrderFilters {
  status?: OrderStatus | OrderStatus[];
  market_id?: string;
  side?: OrderSide;
  type?: OrderType;
  from_date?: string;
  to_date?: string;
  [key: string]: unknown;
}

export interface UpdateOrderRequest {
  price?: string;
  quantity?: string;
  stop_price?: string;
  time_in_force?: TimeInForce;
}

/**
 * Trade (execution) response
 */
export interface Trade {
  trade_id: string;
  id?: string;
  market_id: string;
  market_name?: string | null;
  instrument_id?: string;
  instrument_symbol?: string | null;
  instrument_name?: string | null;
  price: string;
  quantity: string;
  total_value: string;
  fee: string;
  status?: string;
  side: OrderSide;
  execution_timestamp: string;
  settlement_timestamp?: string | null;
  order_id?: string | null;
  trading_account_id?: string | null;
}

export interface TradeFilters {
  market_id?: string;
  order_id?: string;
  from_date?: string;
  to_date?: string;
  [key: string]: unknown;
}

// ============================================================================
// Market Types
// ============================================================================

export type MarketStatus = 'active' | 'inactive' | 'suspended' | 'closed';

/**
 * Market information
 */
export interface Market {
  market_id: string;
  id?: string;
  name: string;
  description?: string;
  market_type?: string;
  status: string;
  associated_instruments?: string[];
  instruments?: unknown[];
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
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
  description?: string;
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
  last_price: string;
  last_trade_quantity?: string | number;
  last_trade_timestamp?: string;
  highest_bid: string;
  lowest_ask: string;
  bid?: string;
  ask?: string;
  volume_24h: string | number;
  high_24h?: string;
  low_24h?: string;
  quote_volume_24h?: string;
  price_change_24h?: string;
  price_change_percent_24h?: string;
  timestamp?: string;
}

export interface OrderBookLevel {
  price: string;
  /** The exchange uses 'size', normalized to 'quantity' */
  size?: string | number;
  quantity?: string | number;
  total?: string | number;
  order_count?: number;
}

export interface OrderBook {
  market_id?: string;
  symbol?: string;
  /** The exchange uses 'buy', normalized to 'bids' */
  buy?: OrderBookLevel[];
  sell?: OrderBookLevel[];
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp?: string;
  sequence?: number;
}

export interface PublicTrade {
  trade_id: string;
  id?: string;
  market_id: string;
  price: string;
  quantity: string;
  side: 'buy' | 'sell';
  execution_timestamp: string;
  timestamp?: string;
}

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

// ============================================================================
// Account Types
// ============================================================================

/**
 * Trading account (balance)
 */
export interface TradingAccount {
  account_id: string;
  id?: string;
  user_id?: string;
  market_id?: string;
  instrument_id: string;
  instrument_symbol?: string;
  instrument_name?: string;
  market_name?: string;
  instrument?: unknown;
  total_balance: string;
  available_balance: string;
  reserved_balance?: string;
  locked_balance?: string;
  status?: string;
  last_trade_price?: string | null;
  last_trading_activity_at?: string | null;
  last_deposit_at?: string | null;
  last_withdrawal_at?: string | null;
  created_at?: string;
  updated_at: string;
}

export interface CurrencyTradingAccount extends TradingAccount {
  currency: string;
}

/**
 * Issuance account (for suppliers)
 */
export interface IssuanceAccount {
  account_id: string;
  id?: string;
  instrument_id: string;
  instrument_symbol: string;
  total_issued: string;
  total_transferred: string;
  available_balance: string;
  updated_at: string;
}

export interface TransferFromIssuanceRequest {
  instrument_id: string;
  quantity: number;
  trading_account_id: string;
}

export interface TransferToConsumptionRequest {
  instrument_id: string;
  quantity: number;
}

export interface TransferToTradingRequest {
  instrument_id: string;
  quantity: number;
}

/**
 * Consumption account (from Trading API)
 */
export interface ConsumptionInstrument {
  account_id: string;
  user_id: string;
  instrument_id: string;
  status: string;
  available_balance: string;
  committed_balance: string;
  total_balance: string;
  total_deposits: string;
  total_withdrawals: string;
  total_commitments: string;
  total_transfers_in: string;
  total_transfers_out: string;
  last_deposit_at?: string | null;
  last_withdrawal_at?: string | null;
  last_commitment_at?: string | null;
  last_transfer_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// User Types
// ============================================================================

export interface User {
  user_id: string;
  id?: string;
  email: string;
  name?: string;
  email_verified: boolean;
  accepted_terms: boolean;
  created_at: string;
  updated_at: string;
}

export interface SigningKey {
  key_id: string;
  id?: string;
  label: string;
  fingerprint: string;
  public_key: string;
  is_active: boolean;
  created_at: string;
  last_used_at?: string;
}

export interface RegisterSigningKeyRequest {
  label: string;
  public_key: string;
}

// ============================================================================
// WebSocket Types
// ============================================================================

/**
 * Connection state enum
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed',
}

/**
 * WebSocket message types
 */
export interface WSMessage {
  type: string;
  data: unknown;
  timestamp?: string;
}

/**
 * WebSocket configuration
 */
export interface WSConfig {
  reconnectDelay: number;
  maxReconnectDelay: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  heartbeatTimeout: number;
}

/**
 * Order event from WebSocket
 */
export interface OrderEvent {
  type: 'order_created' | 'order_updated' | 'order_filled' | 'order_cancelled';
  order: Order;
  timestamp: string;
}

/**
 * Trade event from WebSocket
 */
export interface TradeEvent {
  type: 'trade';
  trade: Trade;
  timestamp: string;
}

/**
 * Ticker event from WebSocket
 */
export interface TickerEvent {
  type: 'ticker';
  ticker: Ticker;
  market_id: string;
  timestamp: string;
}
