import React from 'react';
import { Box, Text } from 'ink';
import { Table, Header, Spinner } from '../components';
import { colors, getSideColor } from '../theme';

export interface BalanceData {
  instrument: string;
  available: string;
  locked: string;
  total: string;
  market?: string;
}

export interface BalanceViewProps {
  balances: BalanceData[];
  loading?: boolean;
  error?: string;
}

/**
 * Balance view - displays account balances in a Grid-styled table
 */
export function BalanceView({
  balances,
  loading = false,
  error,
}: BalanceViewProps): React.ReactElement {
  if (loading) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Spinner label="Fetching balances..." type="grid" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Text color={colors.error}>Error: {error}</Text>
      </Box>
    );
  }

  if (balances.length === 0) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Header title="BALANCES" showSeparator width={60} />
        <Box paddingX={2} marginTop={1}>
          <Text color={colors.warning}>No trading accounts found.</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingY={1}>
      <Table
        title="BALANCES"
        data={balances}
        columns={[
          { header: 'INSTRUMENT', accessor: 'instrument', width: 18 },
          { header: 'AVAILABLE', accessor: 'available', width: 14, align: 'right', color: colors.accent },
          { header: 'LOCKED', accessor: 'locked', width: 12, align: 'right', color: colors.textMuted },
          { header: 'TOTAL', accessor: 'total', width: 14, align: 'right', color: colors.text },
        ]}
        footer={`Total accounts: ${balances.length}`}
      />
    </Box>
  );
}

export default BalanceView;
