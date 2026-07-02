import React from 'react';
import { Box, Text } from 'ink';
import { colors, formatLabel } from '../theme';
import { Table, KeyValue } from '../components';
import type { ConsumptionInstrument } from '../../../sdk/types/accounts';

interface RunBalanceViewProps {
  instruments: ConsumptionInstrument[];
  filterModel?: string;
  error?: string;
}

export const RunBalanceView: React.FC<RunBalanceViewProps> = ({ 
  instruments, 
  filterModel,
  error 
}) => {
  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={colors.text} bold>{formatLabel('BALANCE')}</Text>
        <Box marginTop={1}>
          <Text color={colors.error}>Error: {error}</Text>
        </Box>
      </Box>
    );
  }

  if (instruments.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={colors.text} bold>{formatLabel('BALANCE')}</Text>
        <Box marginTop={1}>
          <Text color={colors.textMuted}>No consumption balances found.</Text>
        </Box>
      </Box>
    );
  }

  const totalAvailable = instruments.reduce(
    (sum, i) => sum + parseFloat(String(i.available_balance || '0')),
    0
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text color={colors.text} bold>{formatLabel('BALANCE')}</Text>
        <Text color={colors.textMuted}> | </Text>
        <Text color={colors.success}>{totalAvailable.toLocaleString()} units available</Text>
      </Box>

      <Table
        data={instruments.map(i => ({
          spec: i.instrument_id || 'Unknown',
          available: i.available_balance?.toLocaleString() || '0',
        }))}
        columns={[
          { header: 'SPEC', accessor: 'spec', width: 30 },
          { header: 'AVAILABLE', accessor: 'available', width: 15, align: 'right' },
        ]}
      />
    </Box>
  );
};

function formatTokens(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}
