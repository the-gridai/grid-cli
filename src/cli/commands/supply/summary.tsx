import React, { useState, useEffect } from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { ApiClient } from '../../../sdk/http/client';
import { logger } from '../../../core/logging/logger';
import { SupplySummaryView, SupplySummaryItem, SupplySummaryTotals } from '../../ui/views';

function SupplySummaryApp(): React.ReactElement {
  const [summaries, setSummaries] = useState<SupplySummaryItem[]>([]);
  const [totals, setTotals] = useState<SupplySummaryTotals | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    async function fetchSummary() {
      const client = ApiClient.getInstance();
      
      try {
        // Fetch summaries and instruments in parallel
        const [summaryResult, instrumentsResult] = await Promise.all([
          client.getSupplyIssuanceSummary(),
          client.getInstruments().catch(() => ({ data: [] }))
        ]);
        
        const rawSummaries = Array.isArray(summaryResult) ? summaryResult : (summaryResult.data || []);
        const instruments = Array.isArray(instrumentsResult) ? instrumentsResult : (instrumentsResult.data || []);
        
        // Build instrument lookup map
        const instrumentMap = new Map<string, { name: string; symbol: string }>();
        for (const inst of instruments) {
          const instId = inst.instrument_id || inst.id;
          if (instId) {
            instrumentMap.set(instId, {
              name: inst.name || inst.display_name || 'Unknown',
              symbol: inst.symbol || inst.ticker || inst.name || 'N/A'
            });
          }
        }
        
        // Format summaries
        const formattedSummaries: SupplySummaryItem[] = rawSummaries.map((row: any) => {
          const instrumentInfo = instrumentMap.get(row.instrument_id);
          return {
            instrumentName: instrumentInfo?.name,
            instrumentId: row.instrument_id,
            symbol: row.instrument_symbol || instrumentInfo?.symbol,
            totalIssued: row.total_issued || row.quantity || 0,
            unitsAvailable: row.units_available ?? null,
            unitsTransferred: row.units_transferred_to_trading ?? null,
          };
        });
        
        // Calculate totals
        const totalIssued = rawSummaries.reduce((sum: number, s: any) => sum + (parseInt(s.total_issued || s.quantity || 0)), 0);
        const totalAvailable = rawSummaries.reduce((sum: number, s: any) => sum + (parseInt(s.units_available || 0)), 0);
        const totalTransferred = rawSummaries.reduce((sum: number, s: any) => sum + (parseInt(s.units_transferred_to_trading || 0)), 0);
        
        setSummaries(formattedSummaries);
        setTotals({ totalIssued, totalAvailable, totalTransferred });
        setLoading(false);
        
      } catch (err: any) {
        logger.error('Failed to get supply summary:', { error: err });
        
        let errorMessage = err.message;
        if (err.response) {
          errorMessage = `Status ${err.response.status}: ${JSON.stringify(err.response.data)}`;
        }
        
        setError(errorMessage);
        setLoading(false);
      }
    }

    fetchSummary();
  }, []);

  return (
    <SupplySummaryView
      summaries={summaries}
      totals={totals}
      loading={loading}
      error={error}
    />
  );
}

export const supplySummaryCommand = new Command('summary')
  .description('Show summary of your issued supply per instrument')
  .action(async () => {
    const { waitUntilExit } = render(<SupplySummaryApp />);
    await waitUntilExit();
  });
