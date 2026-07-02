import React from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { ApiClient } from '../../../sdk/http/client';
import { logger } from '../../../core/logging/logger';
import { BalanceView, BalanceData } from '../../ui/views/BalanceView';

function formatBalanceCommandError(error: unknown): string {
  if (error instanceof Error && typeof error.message === 'string') {
    return error.message.length > 800 ? `${error.message.slice(0, 800)}…` : error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Request failed';
}

export const balanceCommand = new Command('balance')
  .description('Show account balances')
  .action(async () => {
    const client = ApiClient.getInstance();
    
    try {
      const accounts = await client.getTradingAccounts();
      
      // Format for display
      const balances: BalanceData[] = accounts.map((account: any) => ({
        instrument: account.instrument_symbol || account.instrument_id,
        available: parseFloat(account.available_balance).toFixed(2),
        locked: parseFloat(account.locked_balance || '0').toFixed(2),
        total: parseFloat(account.total_balance).toFixed(2),
        market: account.market_name || account.market_id || undefined,
      }));
      
      const { waitUntilExit } = render(<BalanceView balances={balances} />);
      await waitUntilExit();
      
    } catch (error: unknown) {
      const message = formatBalanceCommandError(error);
      logger.error('Failed to fetch balances', { message });
      const { waitUntilExit } = render(
        <BalanceView balances={[]} error={message} />
      );
      await waitUntilExit();
    }
  });
