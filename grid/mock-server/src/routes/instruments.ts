/**
 * Instrument routes for mock server
 */

import { Router, Request, Response } from 'express';

const router = Router();

// Mock instruments data
const instruments = [
  {
    id: 'instr-prime',
    symbol: 'PRIME-INFERENCE',
    name: 'Prime Inference Credits',
    type: 'inference',
    decimals: 8,
    min_quantity: '0.00000001',
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'instr-fast',
    symbol: 'FAST-INFERENCE',
    name: 'Fast Inference Credits',
    type: 'inference',
    decimals: 8,
    min_quantity: '0.00000001',
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'instr-usd',
    symbol: 'USD',
    name: 'US Dollar',
    type: 'currency',
    decimals: 2,
    min_quantity: '0.01',
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
  },
];

// List all instruments
router.get('/', (_req: Request, res: Response) => {
  res.json({ data: instruments });
});

// Get instrument by ID
router.get('/:instrumentId', (req: Request, res: Response) => {
  const instrument = instruments.find((i) => i.id === req.params.instrumentId);

  if (!instrument) {
    return res.status(404).json({
      error: {
        code: 'INSTRUMENT_NOT_FOUND',
        message: 'Instrument not found',
      },
    });
  }

  res.json({ data: instrument });
});

// Get instrument by symbol
router.get('/by-symbol/:symbol', (req: Request<{ symbol: string }>, res: Response) => {
  const instrument = instruments.find(
    (i) => i.symbol.toLowerCase() === req.params.symbol.toLowerCase()
  );

  if (!instrument) {
    return res.status(404).json({
      error: {
        code: 'INSTRUMENT_NOT_FOUND',
        message: 'Instrument not found',
      },
    });
  }

  res.json({ data: instrument });
});

export default router;
