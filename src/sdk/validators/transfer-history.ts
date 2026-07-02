/**
 * Transfer History validation schema
 * Based on the exchange TransferHistoryJSON serializer
 */

import { z } from 'zod';

export const TransferHistorySchema = z.object({
  id: z.string(),
  transfer_id: z.string(),
  account_id: z.string(),
  instrument_id: z.string(),
  instrument_name: z.string().nullable().optional(),
  market_id: z.string().nullable().optional(),
  quantity: z.number(),
  sender_account_id: z.string().nullable().optional(),
  transferred_at: z.string(),
  inserted_at: z.string(),
  updated_at: z.string()
}).passthrough();

