import React, { useState, useEffect } from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { ApiClient } from '../../../sdk/http/client';
import { logger } from '../../../core/logging/logger';
import { SupplyListView, SupplyIssuance } from '../../ui/views';

interface SupplyListAppProps {
  instrumentFilter?: string;
  limit: number;
}

function SupplyListApp({ instrumentFilter, limit }: SupplyListAppProps): React.ReactElement {
  const [issuances, setIssuances] = useState<SupplyIssuance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    async function fetchSupply() {
      const client = ApiClient.getInstance();
      
      try {
        const params: any = {};
        if (instrumentFilter) {
          params.instrument_id = instrumentFilter;
        }
        params.limit = limit;
        
        const rawIssuances = await client.getSupplyIssuances(params);
        
        const formattedIssuances: SupplyIssuance[] = rawIssuances.map((row: any) => ({
          id: row.id ?? row.issuance_id,
          instrumentId: row.instrument_id ?? row.instrumentId,
          quantity: row.quantity,
          issuedAt: row.issued_at ?? row.issuedAt,
        }));
        
        setIssuances(formattedIssuances);
        setLoading(false);
        
      } catch (err: any) {
        logger.error('Failed to list supply issuances:', { error: err });
        
        let errorMessage = err.message;
        if (err.response) {
          errorMessage = `Status ${err.response.status}: ${JSON.stringify(err.response.data)}`;
        }
        
        setError(errorMessage);
        setLoading(false);
      }
    }

    fetchSupply();
  }, [instrumentFilter, limit]);

  return (
    <SupplyListView
      issuances={issuances}
      loading={loading}
      error={error}
    />
  );
}

export const listSupplyCommand = new Command('list')
  .description('List your supply issuances')
  .option('--instrument <instrumentId>', 'Filter by instrument ID')
  .option('--limit <limit>', 'Number of results to return', '20')
  .action(async (options) => {
    const { waitUntilExit } = render(
      <SupplyListApp
        instrumentFilter={options.instrument}
        limit={parseInt(options.limit, 10)}
      />
    );
    
    await waitUntilExit();
  });
