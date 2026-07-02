/**
 * Account routes for mock server
 */

import { Router, Request, Response } from 'express';
import {
  tradingAccounts,
  consumptionAccounts,
  issuanceAccounts,
  mockUser,
} from '../data.js';

const router = Router();

// Get trading accounts
router.get('/trading-accounts', (_req: Request, res: Response) => {
  res.json({ data: tradingAccounts });
});

// Get specific trading account
router.get('/trading-accounts/:accountId', (req: Request, res: Response) => {
  const account = tradingAccounts.find((a) => a.account_id === req.params.accountId);

  if (!account) {
    return res.status(404).json({
      error: {
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Trading account not found',
      },
    });
  }

  res.json({ data: account });
});

// Get currency trading accounts (alias)
router.get('/currency-trading-accounts', (_req: Request, res: Response) => {
  // Filter to only currency accounts (USD, etc.)
  const currencyAccounts = tradingAccounts.filter(
    (a) => a.instrument_symbol === 'USD' || a.instrument_id === 'usd'
  );
  res.json({ data: currencyAccounts });
});

// Get consumption accounts
router.get('/consumption-accounts', (_req: Request, res: Response) => {
  res.json({ data: consumptionAccounts });
});

// Get issuance accounts
router.get('/issuance-accounts', (_req: Request, res: Response) => {
  res.json({ data: issuanceAccounts });
});

// Get current user
router.get('/me', (_req: Request, res: Response) => {
  res.json({ data: mockUser });
});

export default router;
