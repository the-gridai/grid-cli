import React from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { ApiClient } from '../../../sdk/http/client';
import { logger } from '../../../core/logging/logger';
import { ConsumptionBalanceView } from '../../ui/views/ConsumptionBalanceView';

export const balanceCommand = new Command('balance')
  .description('Show consumption token balance')
  .option('-s, --spec <spec>', 'Show balance for specific spec')
  .action(async (options: { spec?: string }) => {
    const client = ApiClient.getInstance();
    const spec = options.spec;
    
    try {
      // Get consumption instruments (balances)
      const instruments = await client.getConsumptionInstruments();
      
      // Filter by spec if specified
      const filtered = spec 
        ? instruments.filter(i => 
            i.instrument_id?.toLowerCase().includes(spec.toLowerCase())
          )
        : instruments;
      
      const { waitUntilExit } = render(
        <ConsumptionBalanceView 
          instruments={filtered}
          filterModel={spec}
        />
      );
      await waitUntilExit();
      
    } catch (error: any) {
      logger.error('Failed to get balance', { error: error.message });
      const { waitUntilExit } = render(
        <ConsumptionBalanceView 
          instruments={[]}
          error={error.message}
        />
      );
      await waitUntilExit();
    }
  });
