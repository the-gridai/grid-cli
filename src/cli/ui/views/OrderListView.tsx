import React from 'react';
import { Box, Text } from 'ink';
import { Table, Header, Spinner } from '../components';
import { colors, getSideColor, tagline } from '../theme';

export interface OrderData {
  id: string;
  side: 'buy' | 'sell';
  size: string | number;
  price: string | number;
  status: string;
  submitted?: string;
  trend?: number[];
}

export interface OrderListViewProps {
  orders: OrderData[];
  loading?: boolean;
  error?: string;
  source?: 'api' | 'database';
  total?: number;
}

/**
 * Order list view - displays orders in a Grid-styled table
 */
export function OrderListView({
  orders,
  loading = false,
  error,
  source = 'api',
  total,
}: OrderListViewProps): React.ReactElement {
  if (loading) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Spinner label={`Fetching orders from ${source}...`} type="grid" />
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

  if (orders.length === 0) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Header title="ORDERS" showSeparator width={70} />
        <Box paddingX={2} marginTop={1}>
          <Text color={colors.textMuted}>No orders found.</Text>
        </Box>
        <Box paddingX={2} marginTop={1}>
          <Text color={colors.textDim} dimColor>{tagline}</Text>
        </Box>
      </Box>
    );
  }

  const footerText = total && total > orders.length 
    ? `Showing ${orders.length} of ${total} orders • ${tagline}`
    : tagline;

  return (
    <Box flexDirection="column" paddingY={1}>
      <Table
        title="ORDERS"
        data={orders}
        columns={[
          { 
            header: 'ID', 
            accessor: (row) => truncateId(row.id), 
            width: 14 
          },
          { 
            header: 'SIDE', 
            accessor: 'side',
            width: 8,
            color: (value) => getSideColor(value as 'buy' | 'sell'),
          },
          { 
            header: 'SIZE', 
            accessor: 'size', 
            width: 10, 
            align: 'right' 
          },
          { 
            header: 'PRICE', 
            accessor: 'price', 
            width: 10, 
            align: 'right',
            color: colors.accent,
          },
          { 
            header: 'STATUS', 
            accessor: (row) => row.status.toUpperCase(), 
            width: 10,
            color: (value) => getStatusColor(value as string),
          },
          { 
            header: 'SUBMITTED', 
            accessor: (row) => row.submitted ? formatDate(row.submitted) : '-', 
            width: 18 
          },
        ]}
        footer={footerText}
      />
    </Box>
  );
}

function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 10)}...`;
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

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'open':
    case 'pending':
      return colors.primary;
    case 'filled':
    case 'completed':
      return colors.success;
    case 'cancelled':
    case 'rejected':
      return colors.error;
    case 'partial':
      return colors.warning;
    default:
      return colors.textMuted;
  }
}

export default OrderListView;
