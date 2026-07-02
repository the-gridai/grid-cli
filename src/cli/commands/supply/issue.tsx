import React, { useState, useEffect } from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { ApiClient } from '../../../sdk/http/client';
import { logger } from '../../../core/logging/logger';
import { ActionFeedbackView, ActionStatus } from '../../ui/views';
import { resolveInstrumentId } from './utils';

interface SupplyIssueAppProps {
  instrument: string;
  quantity: number;
}

function SupplyIssueApp({ instrument, quantity }: SupplyIssueAppProps): React.ReactElement {
  const [status, setStatus] = useState<ActionStatus>('pending');
  const [details, setDetails] = useState<{ label: string; value: string }[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [message, setMessage] = useState<string | undefined>();
  const [pendingText, setPendingText] = useState(`Issuing ${quantity} units of ${instrument}...`);

  useEffect(() => {
    async function issueSupply() {
      const client = ApiClient.getInstance();
      
      try {
        // Resolve the instrument identifier to an actual instrument_id
        setPendingText(`Resolving instrument ${instrument}...`);
        const resolved = await resolveInstrumentId(client, instrument);
        
        setPendingText(`Issuing ${quantity} units of ${resolved.symbol}...`);
        
        const result = await client.issueSupply(resolved.id, quantity);
        
        setDetails([
          { label: 'Instrument', value: `${resolved.name} (${resolved.symbol})` },
          { label: 'Quantity', value: String(quantity) },
          { label: 'Issuance Account', value: result.issuance_account_id || result.id },
        ]);
        setMessage(`Next steps:\n  1. Transfer to trading: grid supply transfer --instrument ${resolved.symbol} --qty <n>\n  2. Create sell order: grid order create --market <id> --side sell --qty <n> --price <p>`);
        setStatus('success');
        
      } catch (err: any) {
        logger.error('Failed to issue supply:', { error: err });
        
        // Extract detailed error message
        let errorMessage = err.message;
        if (err.response?.data) {
          const data = err.response.data;
          errorMessage = data.error?.message || data.message || `Status ${err.response.status}: ${JSON.stringify(data)}`;
        } else if (err.statusCode && err.code) {
          errorMessage = `${err.message} (${err.code})`;
        }
        
        setError(errorMessage);
        setStatus('error');
      }
    }

    issueSupply();
  }, [instrument, quantity]);

  return (
    <ActionFeedbackView
      title={status === 'pending' ? pendingText : (status === 'success' ? 'Supply Issued' : 'Issue Failed')}
      status={status}
      details={details}
      error={error}
      message={message}
    />
  );
}

export const issueSupplyCommand = new Command('issue')
  .description('Issue new supply units to your issuance account')
  .requiredOption('--instrument <instrumentId>', 'Instrument ID to issue')
  .requiredOption('--qty <quantity>', 'Quantity of units to issue')
  .action(async (options) => {
    const { instrument, qty } = options;
    
    const quantity = parseInt(qty, 10);
    
    if (isNaN(quantity) || quantity <= 0) {
      const { waitUntilExit } = render(
        <ActionFeedbackView
          title="Validation Error"
          status="error"
          error="Quantity must be a positive integer"
        />
      );
      await waitUntilExit();
      process.exit(1);
    }

    const { waitUntilExit } = render(
      <SupplyIssueApp instrument={instrument} quantity={quantity} />
    );
    
    await waitUntilExit();
  });
