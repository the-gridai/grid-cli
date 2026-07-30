import React from 'react';
import { Box, Text } from 'ink';
import { colors, formatLabel } from '../theme';
import { Table } from '../components';
import type { ConsumptionInstrument } from '../../../sdk/types/accounts';

interface ConsumptionBalanceViewProps {
  instruments: ConsumptionInstrument[];
  filterModel?: string;
  error?: string;
}

export const ConsumptionBalanceView: React.FC<ConsumptionBalanceViewProps> = ({ 
  instruments, 
  filterModel,
  error 
}) => {
  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={colors.text} bold>{formatLabel('CONSUMPTION BALANCE')}</Text>
        <Box marginTop={1}>
          <Text color={colors.error}>Error: {error}</Text>
        </Box>
      </Box>
    );
  }

  if (instruments.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={colors.text} bold>{formatLabel('CONSUMPTION BALANCE')}</Text>
        <Box marginTop={1}>
          <Text color={colors.textMuted}>No consumption balances found.</Text>
        </Box>
      </Box>
    );
  }

  const totalAvailable = instruments.reduce(
    (sum, instrument) => sum + instrument.uncommitted_balance,
    0
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text color={colors.text} bold>{formatLabel('CONSUMPTION BALANCE')}</Text>
        <Text color={colors.textMuted}> | </Text>
        <Text color={colors.success}>{totalAvailable.toLocaleString()} units available</Text>
      </Box>

      <Table
        data={instruments.map(i => ({
          spec: i.instrument_id || 'Unknown',
          available: i.uncommitted_balance.toLocaleString(),
          total: i.total_balance.toLocaleString(),
        }))}
        columns={[
          { header: 'SPEC', accessor: 'spec', width: 25 },
          { header: 'AVAILABLE', accessor: 'available', width: 15, align: 'right' },
          { header: 'TOTAL', accessor: 'total', width: 15, align: 'right' },
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
