import React from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { Box, Text } from 'ink';
import { ApiClient } from '../../../sdk';
import { Header, Spinner, StatusBadge } from '../../ui/components';
import { colors, formatLabel } from '../../ui/theme';
import { resolveInstrumentId } from '../supply/utils';

interface TransferViewProps {
  loading?: boolean;
  error?: string;
  result?: {
    transferId: string;
    direction: 'to-consumption' | 'to-trading';
    instrumentId: string;
    quantity: number;
  };
}

const TransferView: React.FC<TransferViewProps> = ({ loading, error, result }) => {
  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Header title={formatLabel('TRANSFER')} />
        <Box marginTop={1}>
          <Spinner label="Initiating transfer..." />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Header title={formatLabel('TRANSFER')} />
        <Box marginTop={1}>
          <Text color={colors.error}>✗ {error}</Text>
        </Box>
      </Box>
    );
  }

  if (result) {
    const directionLabel = result.direction === 'to-consumption' 
      ? 'Trading → Consumption' 
      : 'Consumption → Trading';
    
    return (
      <Box flexDirection="column" padding={1}>
        <Header title={formatLabel('TRANSFER')} />
        <Box marginTop={1} flexDirection="column">
          <Box marginBottom={1}>
            <StatusBadge status="success" label="Transfer Initiated" />
          </Box>
          <Box>
            <Text color={colors.textMuted}>Direction:    </Text>
            <Text color={colors.text}>{directionLabel}</Text>
          </Box>
          <Box>
            <Text color={colors.textMuted}>Instrument:   </Text>
            <Text color={colors.text}>{result.instrumentId}</Text>
          </Box>
          <Box>
            <Text color={colors.textMuted}>Quantity:     </Text>
            <Text color={colors.text}>{result.quantity.toString()}</Text>
          </Box>
          <Box>
            <Text color={colors.textMuted}>Transfer ID:  </Text>
            <Text color={colors.text}>{result.transferId}</Text>
          </Box>
          <Box marginTop={1}>
            <Text color={colors.textMuted}>
              Transfer is processing. Use `grid consumption balance` to check status.
            </Text>
          </Box>
        </Box>
      </Box>
    );
  }

  return null;
};

interface TransferOptions {
  toConsumption?: boolean;
  toTrading?: boolean;
  instrument: string;
  quantity: string;
}

async function transferAction(options: TransferOptions): Promise<void> {
  // Validate direction
  if (!options.toConsumption && !options.toTrading) {
    const { waitUntilExit } = render(
      <TransferView error="Must specify direction: --to-consumption or --to-trading" />
    );
    await waitUntilExit();
    return;
  }

  if (options.toConsumption && options.toTrading) {
    const { waitUntilExit } = render(
      <TransferView error="Cannot specify both --to-consumption and --to-trading" />
    );
    await waitUntilExit();
    return;
  }

  // Validate quantity
  const quantity = parseInt(options.quantity, 10);
  if (isNaN(quantity) || quantity <= 0) {
    const { waitUntilExit } = render(
      <TransferView error="Quantity must be a positive integer" />
    );
    await waitUntilExit();
    return;
  }

  // Show loading
  const { rerender, waitUntilExit } = render(<TransferView loading />);

  try {
    const client = ApiClient.getInstance();
    const direction = options.toConsumption ? 'to-consumption' : 'to-trading';

    // Resolve instrument symbol to ID
    const resolved = await resolveInstrumentId(client, options.instrument);

    let result: any;
    if (options.toConsumption) {
      result = await client.transferToConsumption(resolved.id, quantity);
    } else {
      result = await client.transferToTrading(resolved.id, quantity);
    }

    rerender(
      <TransferView
        result={{
          transferId: result.transfer_id,
          direction,
          instrumentId: resolved.symbol || resolved.id,
          quantity,
        }}
      />
    );
  } catch (error: any) {
    let errorMessage = error.message || 'Transfer failed';
    
    // Provide helpful hints for common errors
    if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      errorMessage = 'Transfer endpoint not available. This feature requires Grid API v2.0+';
    } else if (errorMessage.includes('insufficient')) {
      errorMessage = 'Insufficient balance for transfer';
    } else if (errorMessage.includes('account_already_exists')) {
      errorMessage = 'Account creation conflict - please try again';
    }
    
    rerender(<TransferView error={errorMessage} />);
  }

  await waitUntilExit();
}

export const transferCommand = new Command('transfer')
  .description('Transfer units between trading and consumption accounts')
  .requiredOption('--instrument <id>', 'Instrument ID to transfer')
  .requiredOption('--quantity <n>', 'Number of units to transfer')
  .option('--to-consumption', 'Transfer from trading to consumption account')
  .option('--to-trading', 'Transfer from consumption to trading account')
  .action(transferAction);
