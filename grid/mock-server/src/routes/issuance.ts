/**
 * Issuance account routes for mock server
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// In-memory issuance transfers
const issuanceTransfers: Array<{
  id: string;
  instrument_id: string;
  quantity: number;
  trading_account_id?: string;
  status: string;
  created_at: string;
}> = [];

// Transfer from issuance account to trading account
router.post('/transfer', (req: Request, res: Response) => {
  const { instrument_id, quantity, trading_account_id } = req.body;

  if (!instrument_id || !quantity) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Missing required fields: instrument_id, quantity',
      },
    });
  }

  if (typeof quantity !== 'number' || quantity <= 0) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Quantity must be a positive number',
      },
    });
  }

  const transfer = {
    id: `issuance-transfer-${uuidv4().slice(0, 8)}`,
    instrument_id,
    quantity,
    trading_account_id,
    status: 'completed',
    created_at: new Date().toISOString(),
  };

  issuanceTransfers.push(transfer);

  res.status(201).json({ data: transfer });
});

// Get issuance transfer history
router.get('/transfers', (_req: Request, res: Response) => {
  res.json({ data: issuanceTransfers });
});

export default router;
