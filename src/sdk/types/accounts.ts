/**
 * Account-related types for GRID Exchange
 */

/**
 * Trading account (balance)
 */
export interface TradingAccount {
  account_id: string;
  id?: string; // Alias
  user_id?: string;
  market_id?: string;
  instrument_id: string;
  instrument_symbol?: string; // Optional in API response
  instrument_name?: string;
  market_name?: string;
  instrument?: any;
  total_balance: string;
  available_balance: string;
  reserved_balance?: string; // Not in real API
  locked_balance?: string;
  status?: string;
  last_trade_price?: string | null;
  last_trading_activity_at?: string | null;
  last_deposit_at?: string | null;
  last_withdrawal_at?: string | null;
  created_at?: string;
  updated_at: string;
}

/**
 * Currency trading account
 */
export interface CurrencyTradingAccount extends TradingAccount {
  currency: string;
}

/**
 * Issuance account (for suppliers)
 */
export interface IssuanceAccount {
  account_id: string;
  id?: string; // Alias
  instrument_id: string;
  instrument_symbol: string;
  total_issued: string;
  total_transferred: string;
  available_balance: string;
  updated_at: string;
}

/**
 * Transfer request (issuance to trading)
 */
export interface TransferFromIssuanceRequest {
  instrument_id: string;
  quantity: number;
  trading_account_id: string;
}

/**
 * Transfer request (trading to consumption)
 */
export interface TransferToConsumptionRequest {
  instrument_id: string;
  quantity: number;
}

/**
 * Transfer request (consumption to trading)
 */
export interface TransferToTradingRequest {
  instrument_id: string;
  quantity: number;
}

/**
 * Transfer history record
 */
export interface TransferHistory {
  transfer_id: string;
  id?: string; // Alias
  from_account_type: 'trading' | 'consumption' | 'issuance';
  to_account_type: 'trading' | 'consumption' | 'issuance';
  instrument_id: string;
  instrument_symbol: string;
  quantity: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
}

/**
 * Consumption account (from Trading API /consumption-accounts)
 * 
 * Note: This matches the Trading API response format. The Exchange API
 * has a different format but requires session auth which isn't suitable for CLI.
 */
export interface ConsumptionInstrument {
  account_id: string;
  user_id: string;
  instrument_id: string;
  status: string;
  available_balance: string;
  committed_balance: string;
  total_balance: string;
  total_deposits: string;
  total_withdrawals: string;
  total_commitments: string;
  total_transfers_in: string;
  total_transfers_out: string;
  last_deposit_at?: string | null;
  last_withdrawal_at?: string | null;
  last_commitment_at?: string | null;
  last_transfer_at?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Account balance summary
 */
export interface BalanceSummary {
  trading: TradingAccount[];
  consumption: ConsumptionInstrument[];
  issuance?: IssuanceAccount[];
}
