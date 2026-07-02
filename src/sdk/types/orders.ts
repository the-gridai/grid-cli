/**
 * Order-related types for GRID Exchange
 */

/**
 * Order side
 */
export type OrderSide = 'buy' | 'sell';

/**
 * Order type
 */
export type OrderType = 'limit' | 'market' | 'stop' | 'stop_limit';

/**
 * Time in force
 */
export type TimeInForce = 'gtc' | 'ioc' | 'fok' | 'day';

/**
 * Order status
 */
export type OrderStatus = 
  | 'open' 
  | 'filled' 
  | 'cancelled' 
  | 'partially_filled' 
  | 'pending' 
  | 'rejected'
  | 'expired';

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
  id?: string; // Legacy alias
  market_id: string;
  market_name?: string | null;
  instrument_id?: string;
  instrument_symbol?: string | null;
  instrument_name?: string | null;
  trader_id?: string;
  side: OrderSide;
  type: string; // API returns various order types, keep as string
  status: string; // API returns: active, filled, cancelled, etc.
  quantity: string | number;
  size?: string | number; // Legacy alias
  filled_quantity: number;
  price: string | number | null;
  average_price?: string | number | null; // Can be null from API
  stop_price?: string | number | null;
  fee?: string | number;
  time_in_force: string;
  client_order_id?: string | null;
  closure_reason?: string | null;
  closed_at?: string | null;
  submitted_at?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Order list filters
 */
export interface OrderFilters {
  status?: OrderStatus | OrderStatus[];
  market_id?: string;
  side?: OrderSide;
  type?: OrderType;
  from_date?: string;
  to_date?: string;
}

/**
 * Order update request
 */
export interface UpdateOrderRequest {
  price?: string;
  quantity?: string;
  stop_price?: string;
  time_in_force?: TimeInForce;
}

/**
 * Trade (execution) response - from the exchange TradeJSON
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

/**
 * Trade filters
 */
export interface TradeFilters {
  market_id?: string;
  order_id?: string;
  from_date?: string;
  to_date?: string;
}
