/**
 * Supply routes for mock server
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// In-memory supply issuances
const supplyIssuances: Array<{
  id: string;
  instrument_id: string;
  quantity: number;
  status: string;
  created_at: string;
}> = [];

// List supply issuances
router.get('/', (_req: Request, res: Response) => {
  res.json({ data: supplyIssuances });
});

// Get supply issuance summary
router.get('/summary', (_req: Request, res: Response) => {
  const totalIssued = supplyIssuances.reduce((sum, s) => sum + s.quantity, 0);

  res.json({
    data: {
      total_issued: totalIssued,
      total_issuances: supplyIssuances.length,
    },
  });
});

// Create supply issuance
router.post('/', (req: Request, res: Response) => {
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

  const issuance = {
    id: `issuance-${uuidv4().slice(0, 8)}`,
    instrument_id,
    quantity,
    status: 'completed',
    created_at: new Date().toISOString(),
  };

  supplyIssuances.push(issuance);

  res.status(201).json({ data: issuance });
});

export default router;
