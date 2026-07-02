import React, { useState, useEffect } from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { ApiClient } from '../../../sdk/http/client';
import { logger } from '../../../core/logging/logger';
import { ActionFeedbackView, ActionStatus } from '../../ui/views';
import { resolveInstrumentId } from './utils';

interface SupplyTransferAppProps {
  instrument: string;
  tradingAccount?: string;
  quantity: number;
}

function SupplyTransferApp({ instrument, tradingAccount, quantity }: SupplyTransferAppProps): React.ReactElement {
  const [status, setStatus] = useState<ActionStatus>('pending');
  const [details, setDetails] = useState<{ label: string; value: string }[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [message, setMessage] = useState<string | undefined>();
  const [pendingText, setPendingText] = useState(`Transferring ${quantity} units to ${tradingAccount || 'new trading account'}...`);

  useEffect(() => {
    async function transferSupply() {
      const client = ApiClient.getInstance();
      
      try {
        // Resolve the instrument identifier to an actual instrument_id
        setPendingText(`Resolving instrument ${instrument}...`);
        const resolved = await resolveInstrumentId(client, instrument);
        
        setPendingText(`Transferring ${quantity} units of ${resolved.symbol} to ${tradingAccount || 'new trading account'}...`);
        
        const result = await client.transferToTradingAccount(resolved.id, tradingAccount, quantity);
        
        setDetails([
          { label: 'Transfer ID', value: result.transfer_id || result.id },
          { label: 'Instrument', value: `${resolved.name} (${resolved.symbol})` },
          { label: 'Quantity', value: String(quantity) },
          ...(result.trading_account_id ? [{ label: 'Trading Account', value: result.trading_account_id }] : []),
        ]);
        setMessage('Transfer is asynchronous. Check your trading account balance shortly.\nNext step: grid order create --market <id> --side sell --qty <n> --price <p>');
        setStatus('success');
        
      } catch (err: any) {
        logger.error('Failed to transfer supply:', { error: err });
        
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

    transferSupply();
  }, [instrument, tradingAccount, quantity]);

  const pendingMessage = pendingText;

  return (
    <ActionFeedbackView
      title={status === 'pending' ? pendingMessage : (status === 'success' ? 'Transfer Initiated' : 'Transfer Failed')}
      status={status}
      details={details}
      error={error}
      message={message}
    />
  );
}

export const transferSupplyCommand = new Command('transfer')
  .description('Transfer units from issuance account to trading account')
  .requiredOption('--instrument <instrumentId>', 'Source instrument ID')
  .option('--trading-account [tradingAccountId]', 'Destination trading account ID (auto-created if not specified)')
  .requiredOption('--qty <quantity>', 'Quantity of units to transfer')
  .action(async (options) => {
    const { instrument, tradingAccount, qty } = options;
    
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
      <SupplyTransferApp
        instrument={instrument}
        tradingAccount={tradingAccount}
        quantity={quantity}
      />
    );
    
    await waitUntilExit();
  });
