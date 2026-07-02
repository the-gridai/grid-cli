/**
 * Transfer routes for mock server
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// In-memory transfer history
const transferHistory: Array<{
  id: string;
  instrument_id: string;
  quantity: number;
  type: 'trading_to_consumption' | 'consumption_to_trading';
  status: string;
  created_at: string;
}> = [];

// Transfer from trading to consumption
router.post('/trading-to-consumption', (req: Request, res: Response) => {
  const { instrument_id, quantity } = req.body;

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
    id: `transfer-${uuidv4().slice(0, 8)}`,
    instrument_id,
    quantity,
    type: 'trading_to_consumption' as const,
    status: 'completed',
    created_at: new Date().toISOString(),
  };

  transferHistory.push(transfer);

  res.json({
    data: {
      id: transfer.id,
      status: transfer.status,
      quantity: transfer.quantity,
    },
  });
});

// Transfer from consumption to trading
router.post('/consumption-to-trading', (req: Request, res: Response) => {
  const { instrument_id, quantity } = req.body;

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
    id: `transfer-${uuidv4().slice(0, 8)}`,
    instrument_id,
    quantity,
    type: 'consumption_to_trading' as const,
    status: 'completed',
    created_at: new Date().toISOString(),
  };

  transferHistory.push(transfer);

  res.json({
    data: {
      id: transfer.id,
      status: transfer.status,
      quantity: transfer.quantity,
    },
  });
});

// Get transfer history
router.get('/transfer-histories', (req: Request, res: Response) => {
  let filtered = transferHistory;

  // Apply filters
  for (let i = 0; i < 10; i++) {
    const field = req.query[`filters[${i}][field]`] as string;
    const value = req.query[`filters[${i}][value]`] as string;

    if (!field || !value) continue;

    if (field === 'instrument_id') {
      filtered = filtered.filter((t) => t.instrument_id === value);
    }
  }

  res.json({ data: filtered });
});

export default router;
