import React from 'react';
import { Box, Text } from 'ink';
import { Header, Table, KeyValue, Divider, Spinner } from '../components';
import { colors, tagline } from '../theme';

export interface SupplySummaryItem {
  instrumentName?: string;
  instrumentId: string;
  symbol?: string;
  totalIssued: number | string;
  unitsAvailable: number | string | null;
  unitsTransferred: number | string | null;
}

export interface SupplySummaryTotals {
  totalIssued: number;
  totalAvailable: number;
  totalTransferred: number;
}

export interface SupplySummaryViewProps {
  summaries: SupplySummaryItem[];
  totals?: SupplySummaryTotals;
  loading?: boolean;
  error?: string;
}

/**
 * Supply summary view - displays supply summary per instrument
 */
export function SupplySummaryView({
  summaries,
  totals,
  loading = false,
  error,
}: SupplySummaryViewProps): React.ReactElement {
  if (loading) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Spinner label="Fetching supply summary..." type="grid" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Header title="SUPPLY SUMMARY" showSeparator width={75} />
        <Box paddingX={2} marginTop={1}>
          <Text color={colors.error}>Error: {error}</Text>
        </Box>
      </Box>
    );
  }

  if (summaries.length === 0) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Header title="SUPPLY SUMMARY" showSeparator width={75} />
        <Box paddingX={2} marginTop={1}>
          <Text color={colors.warning}>No supply found.</Text>
        </Box>
        <Box paddingX={2} marginTop={1}>
          <Text color={colors.textDim}>To issue supply: grid supply issue --instrument {'<id>'} --qty {'<n>'}</Text>
        </Box>
      </Box>
    );
  }

  const tableData = summaries.map(row => ({
    instrument: row.instrumentName || truncateId(row.instrumentId, 25),
    symbol: row.symbol || 'N/A',
    totalIssued: String(row.totalIssued),
    available: row.unitsAvailable !== null ? String(row.unitsAvailable) : 'N/A',
    transferred: row.unitsTransferred !== null ? String(row.unitsTransferred) : 'N/A',
  }));

  return (
    <Box flexDirection="column" paddingY={1}>
      <Table
        title="SUPPLY SUMMARY"
        data={tableData}
        columns={[
          { header: 'INSTRUMENT', accessor: 'instrument', width: 26 },
          { header: 'SYMBOL', accessor: 'symbol', width: 10, color: colors.textMuted },
          { header: 'TOTAL ISSUED', accessor: 'totalIssued', width: 14, align: 'right', color: colors.text },
          { header: 'AVAILABLE', accessor: 'available', width: 12, align: 'right', color: colors.success },
          { header: 'TRANSFERRED', accessor: 'transferred', width: 12, align: 'right', color: colors.primary },
        ]}
      />

      {totals && (
        <>
          <Box marginTop={1}>
            <Divider width={75} />
          </Box>
          <Box paddingX={2} marginTop={1}>
            <KeyValue
              labelWidth={22}
              items={[
                { label: 'Total units issued', value: String(totals.totalIssued), valueColor: colors.success },
                { label: 'Available in issuance', value: String(totals.totalAvailable), valueColor: colors.primary },
                { label: 'Transferred to trading', value: String(totals.totalTransferred), valueColor: colors.accent },
              ]}
            />
          </Box>
        </>
      )}
    </Box>
  );
}

function truncateId(id: string, maxLen: number): string {
  if (id.length <= maxLen) return id;
  return id.substring(0, maxLen - 3) + '...';
}

export default SupplySummaryView;
