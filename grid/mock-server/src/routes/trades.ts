/**
 * Trade routes for mock server
 */

import { Router, Request, Response } from 'express';
import { trades } from '../data.js';

const router = Router();

// List trades
router.get('/', (req: Request, res: Response) => {
  const tradeList = Array.from(trades.values());

  // Apply filters if present (supports both mock server and exchange filter formats)
  const filteredTrades = tradeList.filter((trade) => {
    // Check filter array format (mock server style)
    for (let i = 0; i < 10; i++) {
      const field = req.query[`filters[${i}][field]`] as string;
      const value = req.query[`filters[${i}][value]`] as string;

      if (!field || !value) continue;

      if (field === 'market_id' && trade.market_id !== value) return false;
      if (field === 'order_id' && trade.order_id !== value) return false;
      
      // Support date filters (exchange style)
      if (field === 'from_date') {
        const fromDate = new Date(value);
        const tradeDate = new Date(trade.execution_timestamp);
        if (tradeDate < fromDate) return false;
      }
      if (field === 'to_date') {
        const toDate = new Date(value);
        const tradeDate = new Date(trade.execution_timestamp);
        if (tradeDate > toDate) return false;
      }
    }
    
    // Also support direct query params (alternative format)
    const fromDate = req.query.from_date as string;
    const toDate = req.query.to_date as string;
    const marketId = req.query.market_id as string;
    
    if (fromDate) {
      const from = new Date(fromDate);
      const tradeDate = new Date(trade.execution_timestamp);
      if (tradeDate < from) return false;
    }
    if (toDate) {
      const to = new Date(toDate);
      const tradeDate = new Date(trade.execution_timestamp);
      if (tradeDate > to) return false;
    }
    if (marketId && trade.market_id !== marketId) return false;
    
    return true;
  });

  res.json({ data: filteredTrades });
});

// Get trade by ID
router.get('/:tradeId', (req: Request<{ tradeId: string }>, res: Response) => {
  const trade = trades.get(req.params.tradeId);

  if (!trade) {
    return res.status(404).json({
      error: {
        code: 'TRADE_NOT_FOUND',
        message: 'Trade not found',
      },
    });
  }

  res.json({ data: trade });
});

export default router;
