/**
 * Response validation schemas using Zod
 * 
 * Validates API responses to ensure data integrity
 */

import { z } from 'zod';
import { ValidationError } from '../../core/errors';

// Some Trading API numeric fields are inconsistent across environments (string vs number).
// Normalize them to strings so downstream code can safely parse/format.
const NumericStringSchema = z.union([z.string(), z.number()]).transform((v) => String(v));

/**
 * Generic API response wrapper schema
 */
export const ApiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.string(), z.any()).optional()
    }).optional(),
    meta: z.object({
      page: z.number().optional(),
      page_size: z.number().optional(),
      total_count: z.number().optional(),
      total_pages: z.number().optional()
    }).optional()
  });

/**
 * Order schema
 */
export const OrderSchema = z.object({
  order_id: z.string(),
  id: z.string().optional(), // Legacy alias
  market_id: z.string(),
  market_name: z.string().nullable().optional(),
  instrument_id: z.string().optional(),
  instrument_symbol: z.string().nullable().optional(),
  instrument_name: z.string().nullable().optional(),
  trader_id: z.string().optional(),
  side: z.enum(['buy', 'sell']),
  type: z.string(), // Allow any string
  status: z.string(), // API returns: active, filled, cancelled, etc.
  quantity: z.union([z.string(), z.number()]),
  size: z.union([z.string(), z.number()]).optional(), // Legacy alias
  filled_quantity: z.union([z.string(), z.number()]).transform((v) => Number(v)),
  price: z.union([z.string(), z.number()]).nullable(), // null for market orders
  average_price: z.union([z.string(), z.number()]).nullable().optional(), // Can be null
  stop_price: z.union([z.string(), z.number()]).nullable().optional(),
  fee: z.union([z.string(), z.number()]).optional(),
  time_in_force: z.string(), // API returns string
  client_order_id: z.string().nullable().optional(),
  closure_reason: z.string().nullable().optional(),
  closed_at: z.string().nullable().optional(),
  submitted_at: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
}).passthrough(); // Allow additional fields from API

/**
 * Trade schema (from the exchange TradeJSON serializer)
 */
export const TradeSchema = z.object({
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
  trading_account_id: z.string().nullable().optional()
}).passthrough();

/**
 * Market schema
 */
export const MarketSchema = z.object({
  market_id: z.string(),
  id: z.string().optional(),
  name: z.string(),
  description: z.string().nullable().optional(),
  market_type: z.string().optional(),
  status: z.string(),
  associated_instruments: z.array(z.string()).optional(),
  instruments: z.array(z.any()).optional(),
  created_at: z.string(),
  updated_at: z.string()
}).passthrough(); // Allow all additional fields from API

/**
 * Instrument schema
 */
export const InstrumentSchema = z.object({
  instrument_id: z.string(),
  id: z.string().optional(),
  symbol: z.string(),
  name: z.string(),
  instrument_type: z.enum(['currency', 'ai_commodity', 'token']),
  description: z.string().nullable().optional(),
  precision: z.number(),
  min_withdrawal: z.string().optional(),
  max_withdrawal: z.string().optional(),
  withdrawal_fee: z.string().optional(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string()
}).passthrough(); // Allow additional fields from API

/**
 * Ticker schema
 */
export const TickerSchema = z.object({
  market_id: z.string().optional(),
  symbol: z.string().optional(),
  last_price: NumericStringSchema.nullable().optional(), // Can be null when no trades
  last_trade_quantity: z.union([z.string(), z.number()]).nullable().optional(),
  last_trade_timestamp: z.string().nullable().optional(),
  highest_bid: NumericStringSchema.nullable().optional(), // Can be null when no bids
  lowest_ask: NumericStringSchema.nullable().optional(), // Can be null when no asks
  bid: NumericStringSchema.nullable().optional(), // Alias
  ask: NumericStringSchema.nullable().optional(), // Alias
  volume_24h: z.union([z.string(), z.number()]),
  high_24h: z.string().optional(),
  low_24h: z.string().optional(),
  quote_volume_24h: z.string().optional(),
  price_change_24h: z.string().optional(),
  price_change_percent_24h: z.string().optional(),
  timestamp: z.string().optional()
}).passthrough();

/**
 * Order book level schema
 * Supports both the exchange format (size) and legacy format (quantity)
 */
export const OrderBookLevelSchema = z.object({
  price: z.string(),
  quantity: z.union([z.string(), z.number()]),
  size: z.union([z.string(), z.number()]).optional(), // Legacy alias
  total: z.union([z.string(), z.number()]).optional(),
  order_count: z.number().optional()
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
  sequence: z.number().optional()
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

/**
 * Order book schema
 */
export const OrderBookSchema = OrderBookRawSchema.transform(normalizeOrderBook);

/**
 * Trading account schema
 */
export const TradingAccountSchema = z.object({
  account_id: z.string(),
  id: z.string().optional(),
  user_id: z.string().optional(),
  market_id: z.string().optional(),
  instrument_id: z.string(),
  instrument_symbol: z.string().optional(),
  instrument_name: z.string().optional(),
  market_name: z.string().optional(),
  instrument: z.any().optional(),
  total_balance: NumericStringSchema,
  available_balance: NumericStringSchema,
  reserved_balance: NumericStringSchema.optional(),
  locked_balance: NumericStringSchema.optional(),
  status: z.string().optional(),
  last_trade_price: z.string().nullable().optional(),
  last_trading_activity_at: z.string().nullable().optional(),
  last_deposit_at: z.string().nullable().optional(),
  last_withdrawal_at: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string()
}).passthrough(); // Allow additional fields from API

/**
 * Consumption account schema (from Trading API /consumption-accounts)
 */
export const ConsumptionInstrumentSchema = z.object({
  account_id: z.string(),
  user_id: z.string(),
  instrument_id: z.string(),
  status: z.string(),
  available_balance: NumericStringSchema,
  committed_balance: NumericStringSchema,
  total_balance: NumericStringSchema,
  total_deposits: NumericStringSchema,
  total_withdrawals: NumericStringSchema,
  total_commitments: NumericStringSchema,
  total_transfers_in: NumericStringSchema,
  total_transfers_out: NumericStringSchema,
  last_deposit_at: z.string().nullable().optional(),
  last_withdrawal_at: z.string().nullable().optional(),
  last_commitment_at: z.string().nullable().optional(),
  last_transfer_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string()
}).passthrough();

/**
 * Chat completion response schema
 */
export const ChatCompletionResponseSchema = z.object({
  id: z.string(),
  object: z.literal('chat.completion'),
  created: z.number(),
  model: z.string(),
  choices: z.array(z.object({
    index: z.number(),
    message: z.object({
      role: z.string(), // Required field
      content: z.string(),
      name: z.string().optional(),
      function_call: z.object({
        name: z.string(),
        arguments: z.string()
      }).optional()
    }),
    finish_reason: z.string().nullable(),
    logprobs: z.any().optional()
  })),
  usage: z.object({
    prompt_tokens: z.number(),
    completion_tokens: z.number(),
    total_tokens: z.number()
  }),
  system_fingerprint: z.string().optional()
});

/**
 * Validate response data against a schema
 * 
 * @param data - Data to validate
 * @param schema - Zod schema to validate against
 * @returns Validated and typed data
 * @throws ValidationError if validation fails
 */
export function validateResponse<T>(data: unknown, schema: z.ZodType<T>): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const errors = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    const responsePreview = typeof data === 'object' ? JSON.stringify(data).slice(0, 500) : String(data);
    throw new ValidationError(
      `Invalid API response structure: ${JSON.stringify(errors)}. Response preview: ${responsePreview}`,
      result.error.issues
    );
  }
  
  return result.data;
}

/**
 * Validate array response
 * 
 * @param data - Array data to validate
 * @param itemSchema - Schema for array items
 * @returns Validated array
 */
export function validateArrayResponse<T>(
  data: unknown,
  itemSchema: z.ZodType<T>
): T[] {
  const arraySchema = z.array(itemSchema);
  return validateResponse(data, arraySchema);
}

/**
 * Validate optional response (null/undefined allowed)
 * 
 * @param data - Data to validate
 * @param schema - Schema to validate against
 * @returns Validated data or null
 */
export function validateOptionalResponse<T>(
  data: unknown,
  schema: z.ZodType<T>
): T | null {
  if (data === null || data === undefined) {
    return null;
  }
  return validateResponse(data, schema);
}
