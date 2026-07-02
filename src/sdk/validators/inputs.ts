/**
 * Input validation schemas using Zod
 * 
 * Validates user inputs before sending to API
 */

import { z, ZodError } from 'zod';
import { PlaceOrderRequest, UpdateOrderRequest } from '../types/orders';
import { TransferFromIssuanceRequest } from '../types/accounts';
import { ChatCompletionRequest } from '../types/consumption';
import { ValidationError } from '../../core/errors';

/**
 * Place order request schema
 */
export const PlaceOrderRequestSchema = z.object({
  market_id: z.string().min(1, 'Market ID is required'),
  side: z.enum(['buy', 'sell'], { message: 'Side must be "buy" or "sell"' }),
  type: z.enum(['limit', 'market', 'stop', 'stop_limit'], {
    message: 'Type must be "limit", "market", "stop", or "stop_limit"'
  }),
  quantity: z.string()
    .min(1, 'Quantity is required')
    .refine(val => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }, 'Quantity must be a positive number'),
  price: z.string()
    .optional()
    .refine(val => {
      if (!val) return true;
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }, 'Price must be a positive number'),
  stop_price: z.string()
    .optional()
    .refine(val => {
      if (!val) return true;
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }, 'Stop price must be a positive number'),
  time_in_force: z.enum(['gtc', 'ioc', 'fok', 'day']).optional(),
  client_order_id: z.string().optional(),
  post_only: z.boolean().optional(),
  reduce_only: z.boolean().optional()
}).refine(data => {
  // Limit orders require price
  if ((data.type === 'limit' || data.type === 'stop_limit') && !data.price) {
    return false;
  }
  // Stop orders require stop_price
  if ((data.type === 'stop' || data.type === 'stop_limit') && !data.stop_price) {
    return false;
  }
  return true;
}, {
  message: 'Limit orders require price; stop orders require stop_price'
});

/**
 * Update order request schema
 */
export const UpdateOrderRequestSchema = z.object({
  price: z.string()
    .optional()
    .refine(val => {
      if (!val) return true;
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }, 'Price must be a positive number'),
  quantity: z.string()
    .optional()
    .refine(val => {
      if (!val) return true;
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }, 'Quantity must be a positive number'),
  stop_price: z.string().optional(),
  time_in_force: z.enum(['gtc', 'ioc', 'fok', 'day']).optional()
}).refine(data => {
  // At least one field must be provided
  return data.price || data.quantity || data.stop_price || data.time_in_force;
}, {
  message: 'At least one field must be provided to update'
});

/**
 * Transfer from issuance request schema
 */
export const TransferFromIssuanceRequestSchema = z.object({
  instrument_id: z.string().min(1, 'Instrument ID is required'),
  quantity: z.number()
    .positive('Quantity must be positive')
    .int('Quantity must be an integer'),
  trading_account_id: z.string().min(1, 'Trading account ID is required')
});

/**
 * Transfer to consumption request schema
 */
export const TransferToConsumptionRequestSchema = z.object({
  instrument_id: z.string().min(1, 'Instrument ID is required'),
  quantity: z.number()
    .positive('Quantity must be positive')
    .int('Quantity must be an integer')
});

/**
 * Chat completion request schema
 */
export const ChatCompletionRequestSchema = z.object({
  model: z.string().min(1, 'Model/instrument ID is required'),
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant', 'function']),
    content: z.string(),
    name: z.string().optional(),
    function_call: z.object({
      name: z.string(),
      arguments: z.string()
    }).optional()
  })).min(1, 'At least one message is required'),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().positive().int().optional(),
  top_p: z.number().min(0).max(1).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  stream: z.boolean().optional(),
  n: z.number().positive().int().optional(),
  logit_bias: z.record(z.string(), z.number()).optional(),
  user: z.string().optional()
});

/**
 * Register user request schema
 */
export const RegisterUserRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  password_confirmation: z.string(),
  accepted_terms: z.boolean().optional()
}).refine(data => data.password === data.password_confirmation, {
  message: 'Passwords do not match',
  path: ['password_confirmation']
});

/**
 * Create API key request schema
 */
export const CreateApiKeyRequestSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  expires_at: z.string().optional()
});

/**
 * Register signing key request schema
 */
export const RegisterSigningKeyRequestSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  public_key: z.string().min(1, 'Public key is required')
});

/**
 * Validate place order request
 */
export function validatePlaceOrderRequest(order: unknown): PlaceOrderRequest {
  try {
    return PlaceOrderRequestSchema.parse(order);
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
    return UpdateOrderRequestSchema.parse(updates);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError('Invalid order update request', error.issues);
    }
    throw error;
  }
}

/**
 * Validate transfer from issuance request
 */
export function validateTransferFromIssuanceRequest(
  transfer: unknown
): TransferFromIssuanceRequest {
  try {
    return TransferFromIssuanceRequestSchema.parse(transfer);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError('Invalid transfer request', error.issues);
    }
    throw error;
  }
}

/**
 * Validate chat completion request
 */
export function validateChatCompletionRequest(request: unknown): ChatCompletionRequest {
  try {
    return ChatCompletionRequestSchema.parse(request);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError('Invalid chat completion request', error.issues);
    }
    throw error;
  }
}

/**
 * Generic validator helper
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
