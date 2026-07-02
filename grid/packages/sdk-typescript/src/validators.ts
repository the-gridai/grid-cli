/**
 * Validation schemas using Zod
 *
 * Provides input validation for API requests and response validation for API responses.
 */

import { z, ZodError } from 'zod';
import { ValidationError } from './errors.js';
import type { PlaceOrderRequest, UpdateOrderRequest } from './types/index.js';

// ============================================================================
// Request Validation Schemas
// ============================================================================

/**
 * Place order request schema
 */
export const PlaceOrderRequestSchema = z
  .object({
    market_id: z.string().min(1, 'Market ID is required'),
    side: z.enum(['buy', 'sell'], {
      message: 'Side must be "buy" or "sell"',
    }),
    type: z.enum(['limit', 'market', 'stop', 'stop_limit'], {
      message: 'Type must be "limit", "market", "stop", or "stop_limit"',
    }),
    quantity: z
      .string()
      .min(1, 'Quantity is required')
      .refine((val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      }, 'Quantity must be a positive number'),
    price: z
      .string()
      .optional()
      .refine((val) => {
        if (!val) return true;
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      }, 'Price must be a positive number'),
    stop_price: z
      .string()
      .optional()
      .refine((val) => {
        if (!val) return true;
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      }, 'Stop price must be a positive number'),
    time_in_force: z.enum(['gtc', 'ioc', 'fok', 'day']).optional(),
    client_order_id: z.string().optional(),
    post_only: z.boolean().optional(),
    reduce_only: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // Limit orders require price
      if ((data.type === 'limit' || data.type === 'stop_limit') && !data.price) {
        return false;
      }
      // Stop orders require stop_price
      if ((data.type === 'stop' || data.type === 'stop_limit') && !data.stop_price) {
        return false;
      }
      return true;
    },
    {
      message: 'Limit orders require price; stop orders require stop_price',
    }
  );

/**
 * Update order request schema
 */
export const UpdateOrderRequestSchema = z
  .object({
    price: z
      .string()
      .optional()
      .refine((val) => {
        if (!val) return true;
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      }, 'Price must be a positive number'),
    quantity: z
      .string()
      .optional()
      .refine((val) => {
        if (!val) return true;
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      }, 'Quantity must be a positive number'),
    stop_price: z.string().optional(),
    time_in_force: z.enum(['gtc', 'ioc', 'fok', 'day']).optional(),
  })
  .refine(
    (data) => {
      return data.price || data.quantity || data.stop_price || data.time_in_force;
    },
    {
      message: 'At least one field must be provided to update',
    }
  );

// ============================================================================
// Response Validation Schemas
// ============================================================================

/**
 * Order schema for response validation
 */
export const OrderSchema = z
  .object({
    order_id: z.string(),
    id: z.string().optional(),
    market_id: z.string(),
    market_name: z.string().nullable().optional(),
    instrument_id: z.string().optional(),
    instrument_symbol: z.string().nullable().optional(),
    instrument_name: z.string().nullable().optional(),
    trader_id: z.string().optional(),
    side: z.enum(['buy', 'sell']),
    type: z.string(),
    status: z.string(),
    quantity: z.union([z.string(), z.number()]),
    size: z.union([z.string(), z.number()]).optional(), // Legacy alias
    filled_quantity: z.number(),
    price: z.string().nullable(),
    average_price: z.string().nullable().optional(),
    stop_price: z.string().nullable().optional(),
    fee: z.string().optional(),
    time_in_force: z.string(),
    client_order_id: z.string().nullable().optional(),
    closure_reason: z.string().nullable().optional(),
    closed_at: z.string().nullable().optional(),
    submitted_at: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

/**
 * Trade schema for response validation
 */
export const TradeSchema = z
  .object({
    trade_id: z.string(),
    id: z.string().optional(),
    market_id: z.string(),
    market_name: z.string().nullable().optional(),
    instrument_id: z.string().optional(),
    instrument_symbol: z.string().nullable().optional(),
    instrument_name: z.string().nullable().optional(),
    price: z.string(),
    quantity: z.union([z.string(), z.number()]).transform((v) => String(v)),
    total_value: z.string(),
    fee: z.string(),
    status: z.string().optional(),
    side: z.enum(['buy', 'sell']),
    execution_timestamp: z.string(),
    settlement_timestamp: z.string().nullable().optional(),
    order_id: z.string().nullable().optional(),
    trading_account_id: z.string().nullable().optional(),
  })
  .passthrough();

/**
 * Market schema for response validation
 */
export const MarketSchema = z
  .object({
    market_id: z.string(),
    id: z.string().optional(),
    name: z.string(),
    description: z.string().optional(),
    market_type: z.string().optional(),
    status: z.string(),
    associated_instruments: z.array(z.string()).optional(),
    instruments: z.array(z.unknown()).optional(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough();

/**
 * Ticker schema for response validation
 */
export const TickerSchema = z
  .object({
    market_id: z.string().optional(),
    symbol: z.string().optional(),
    last_price: z.string(),
    last_trade_quantity: z.union([z.string(), z.number()]).optional(),
    last_trade_timestamp: z.string().optional(),
    highest_bid: z.string(),
    lowest_ask: z.string(),
    bid: z.string().optional(),
    ask: z.string().optional(),
    volume_24h: z.union([z.string(), z.number()]),
    high_24h: z.string().optional(),
    low_24h: z.string().optional(),
    quote_volume_24h: z.string().optional(),
    price_change_24h: z.string().optional(),
    price_change_percent_24h: z.string().optional(),
    timestamp: z.string().optional(),
  })
  .passthrough();

/**
 * Order book schema
 * Supports both the exchange format (buy/sell with size) and legacy format (bids/asks with quantity)
 */
export const OrderBookLevelSchema = z.object({
  price: z.string(),
  quantity: z.union([z.string(), z.number()]),
  size: z.union([z.string(), z.number()]).optional(), // Legacy alias
  total: z.union([z.string(), z.number()]).optional(),
  order_count: z.number().optional(),
}).passthrough();

// Raw schema without transform for internal use
const OrderBookRawSchema = z.object({
  market_id: z.string().optional(),
  symbol: z.string().optional(),
  // The exchange uses buy/sell, legacy uses bids/asks - support both
  buy: z.array(OrderBookLevelSchema).optional(),
  sell: z.array(OrderBookLevelSchema).optional(),
  bids: z.array(OrderBookLevelSchema).optional(),
  asks: z.array(OrderBookLevelSchema).optional(),
  timestamp: z.string().optional(),
  sequence: z.number().optional(),
}).passthrough();

// Helper to normalize orderbook (buy/sell -> bids/asks)
function normalizeOrderBook(data: z.infer<typeof OrderBookRawSchema>) {
  const bids = data.bids ?? data.buy ?? [];
  const asks = data.asks ?? data.sell ?? [];
  return {
    ...data,
    bids,
    asks,
    buy: data.buy ?? data.bids,
    sell: data.sell ?? data.asks,
  };
}

export const OrderBookSchema = OrderBookRawSchema.transform(normalizeOrderBook);

/**
 * Trading account schema
 */
export const TradingAccountSchema = z
  .object({
    account_id: z.string(),
    id: z.string().optional(),
    user_id: z.string().optional(),
    market_id: z.string().optional(),
    instrument_id: z.string(),
    instrument_symbol: z.string().optional(),
    instrument_name: z.string().optional(),
    market_name: z.string().optional(),
    instrument: z.unknown().optional(),
    total_balance: z.string(),
    available_balance: z.string(),
    reserved_balance: z.string().optional(),
    locked_balance: z.string().optional(),
    status: z.string().optional(),
    last_trade_price: z.string().nullable().optional(),
    last_trading_activity_at: z.string().nullable().optional(),
    last_deposit_at: z.string().nullable().optional(),
    last_withdrawal_at: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string(),
  })
  .passthrough();

/**
 * Consumption account schema
 */
export const ConsumptionInstrumentSchema = z
  .object({
    account_id: z.string(),
    user_id: z.string(),
    instrument_id: z.string(),
    status: z.string(),
    available_balance: z.union([z.string(), z.number()]).transform((v) => String(v)),
    committed_balance: z.union([z.string(), z.number()]).transform((v) => String(v)),
    total_balance: z.union([z.string(), z.number()]).transform((v) => String(v)),
    total_deposits: z.union([z.string(), z.number()]).transform((v) => String(v)),
    total_withdrawals: z.union([z.string(), z.number()]).transform((v) => String(v)),
    total_commitments: z.union([z.string(), z.number()]).transform((v) => String(v)),
    total_transfers_in: z.union([z.string(), z.number()]).transform((v) => String(v)),
    total_transfers_out: z.union([z.string(), z.number()]).transform((v) => String(v)),
    last_deposit_at: z.string().nullable().optional(),
    last_withdrawal_at: z.string().nullable().optional(),
    last_commitment_at: z.string().nullable().optional(),
    last_transfer_at: z.string().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough();

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate response data against a schema
 */
export function validateResponse<T>(data: unknown, schema: z.ZodType<T>): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new ValidationError('Invalid API response structure', result.error.issues);
  }

  return result.data;
}

/**
 * Validate array response
 */
export function validateArrayResponse<T>(data: unknown, itemSchema: z.ZodType<T>): T[] {
  const arraySchema = z.array(itemSchema);
  return validateResponse(data, arraySchema);
}

/**
 * Validate place order request
 */
export function validatePlaceOrderRequest(order: unknown): PlaceOrderRequest {
  try {
    return PlaceOrderRequestSchema.parse(order) as PlaceOrderRequest;
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError('Invalid order request', error.issues);
    }
    throw error;
  }
}

/**
 * Validate update order request
 */
export function validateUpdateOrderRequest(updates: unknown): UpdateOrderRequest {
  try {
    return UpdateOrderRequestSchema.parse(updates) as UpdateOrderRequest;
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError('Invalid order update request', error.issues);
    }
    throw error;
  }
}

/**
 * Generic input validator
 */
export function validateInput<T>(data: unknown, schema: z.ZodType<T>): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError('Validation failed', error.issues);
    }
    throw error;
  }
}
