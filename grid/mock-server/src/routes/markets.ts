/**
 * Market routes for mock server
 */

import { Router, Request, Response } from 'express';
import { markets, tickers, generateOrderBook, generatePublicTrades } from '../data.js';

const router = Router();

// List markets
router.get('/', (_req: Request, res: Response) => {
  res.json({ data: markets });
});

// Get market by ID
router.get('/:marketId', (req: Request, res: Response) => {
  const market = markets.find(
    (m) => m.market_id === req.params.marketId || m.name === req.params.marketId
  );

  if (!market) {
    return res.status(404).json({
      error: {
        code: 'MARKET_NOT_FOUND',
        message: 'Market not found',
      },
    });
  }

  res.json({ data: market });
});

// Get ticker
router.get('/:marketId/ticker', (req: Request, res: Response) => {
  const market = markets.find(
    (m) => m.market_id === req.params.marketId || m.name === req.params.marketId
  );

  if (!market) {
    return res.status(404).json({
      error: {
        code: 'MARKET_NOT_FOUND',
        message: 'Market not found',
      },
    });
  }

  const ticker = tickers[market.market_id];
  if (!ticker) {
    return res.status(404).json({
      error: {
        code: 'TICKER_NOT_FOUND',
        message: 'Ticker data not available',
      },
    });
  }

  // Update timestamp
  (ticker as { timestamp: string }).timestamp = new Date().toISOString();

  res.json({ data: ticker });
});

// Get order book
router.get('/:marketId/orderbook', (req: Request, res: Response) => {
  const market = markets.find(
    (m) => m.market_id === req.params.marketId || m.name === req.params.marketId
  );

  if (!market) {
    return res.status(404).json({
      error: {
        code: 'MARKET_NOT_FOUND',
        message: 'Market not found',
      },
    });
  }

  const depth = parseInt(req.query.depth as string) || 20;
  const orderBook = generateOrderBook(market.market_id, Math.min(depth, 100));

  if (!orderBook) {
    return res.status(404).json({
      error: {
        code: 'ORDERBOOK_NOT_AVAILABLE',
        message: 'Order book not available',
      },
    });
  }

  res.json({ data: orderBook });
});

// Get market trades
router.get('/:marketId/trades', (req: Request, res: Response) => {
  const market = markets.find(
    (m) => m.market_id === req.params.marketId || m.name === req.params.marketId
  );

  if (!market) {
    return res.status(404).json({
      error: {
        code: 'MARKET_NOT_FOUND',
        message: 'Market not found',
      },
    });
  }

  const limit = parseInt(req.query.limit as string) || 50;
  const publicTrades = generatePublicTrades(market.market_id, Math.min(limit, 100));

  res.json({ data: publicTrades });
});

export default router;
