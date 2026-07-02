import React from 'react';
import { Box, Text } from 'ink';
import { Header, Table, Spinner } from '../components';
import { colors, tagline } from '../theme';

export interface SupplyIssuance {
  id?: string;
  instrumentId?: string;
  quantity: number | string;
  issuedAt?: string;
}

export interface SupplyListViewProps {
  issuances: SupplyIssuance[];
  loading?: boolean;
  error?: string;
}

/**
 * Supply list view - displays supply issuances in Grid style
 */
export function SupplyListView({
  issuances,
  loading = false,
  error,
}: SupplyListViewProps): React.ReactElement {
  if (loading) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Spinner label="Fetching supply issuances..." type="grid" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Header title="SUPPLY ISSUANCES" showSeparator width={70} />
        <Box paddingX={2} marginTop={1}>
          <Text color={colors.error}>Error: {error}</Text>
        </Box>
      </Box>
    );
  }

  if (issuances.length === 0) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Header title="SUPPLY ISSUANCES" showSeparator width={70} />
        <Box paddingX={2} marginTop={1}>
          <Text color={colors.warning}>No supply issuances found.</Text>
        </Box>
        <Box paddingX={2} marginTop={1}>
          <Text color={colors.textDim}>To issue supply: grid supply issue --instrument {'<id>'} --qty {'<n>'}</Text>
        </Box>
      </Box>
    );
  }

  const tableData = issuances.map(row => ({
    id: truncateId(row.id, 20),
    instrumentId: truncateId(row.instrumentId, 20),
    quantity: row.quantity != null ? String(row.quantity) : '—',
    issuedAt: row.issuedAt ? formatDate(row.issuedAt) : 'N/A',
  }));

  return (
    <Box flexDirection="column" paddingY={1}>
      <Table
        title="SUPPLY ISSUANCES"
        data={tableData}
        columns={[
          { header: 'ID', accessor: 'id', width: 22 },
          { header: 'INSTRUMENT', accessor: 'instrumentId', width: 22 },
          { header: 'QUANTITY', accessor: 'quantity', width: 12, align: 'right', color: colors.accent },
          { header: 'ISSUED AT', accessor: 'issuedAt', width: 18, color: colors.textMuted },
        ]}
        footer={`Total: ${issuances.length} issuances`}
      />
    </Box>
  );
}

function truncateId(id: string | undefined, maxLen: number): string {
  if (id == null || id === '') {
    return '—';
  }
  if (id.length <= maxLen) return id;
  return id.substring(0, maxLen - 3) + '...';
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export default SupplyListView;
