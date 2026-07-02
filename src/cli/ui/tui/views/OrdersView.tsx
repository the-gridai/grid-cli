import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors, getSideColor } from '../../theme';
import { Spinner, Table, StatusBadge } from '../../components';
import { ApiClient } from '../../../../sdk/http/client';
import { useConnection } from '../App';
import { useContentFocused } from '../FocusContext';

// Timeout for data fetching (10 seconds)
const FETCH_TIMEOUT = 10000;

interface Order {
  id: string;
  side: 'buy' | 'sell';
  size: string;
  price: string;
  status: string;
  market: string;
}

type FilterType = 'all' | 'open' | 'filled' | 'cancelled';

export function OrdersView(): React.ReactElement {
  const { status: connectionStatus } = useConnection();
  const isContentFocused = useContentFocused();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filter, setFilter] = useState<FilterType>('all');

  const fetchOrders = async () => {
    // Don't fetch if disconnected
    if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
      setLoading(false);
      setError('Server not connected');
      return;
    }

    try {
      setLoading(true);
      const client = ApiClient.getInstance();
      const params = filter !== 'all' ? { status: filter } : {};
      
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), FETCH_TIMEOUT);
      });
      
      const orderData = await Promise.race([
        client.listOrders(params as any),
        timeoutPromise
      ]) as any[];
      
      const formatted: Order[] = orderData.map((order: any) => ({
        id: order.order_id?.substring(0, 8) || 'N/A',
        side: order.side?.toLowerCase() || 'buy',
        size: parseFloat(order.quantity || '0').toFixed(2),
        price: parseFloat(order.price || '0').toFixed(2),
        status: order.status || 'unknown',
        market: order.market_id?.substring(0, 12) || order.instrument || 'N/A',
      }));
      
      setOrders(formatted);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // Refresh every 5 seconds
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [filter, connectionStatus]);

  // Keyboard navigation - ONLY when content is focused
  useInput((input, key) => {
    // Skip if content area is not focused
    if (!isContentFocused) return;
    
    // Navigation within the list
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
    if (key.downArrow && selectedIndex < orders.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
    
    // Filter toggle
    if (input === 'f') {
      const filters: FilterType[] = ['all', 'open', 'filled', 'cancelled'];
      const currentIdx = filters.indexOf(filter);
      setFilter(filters[(currentIdx + 1) % filters.length]);
      setSelectedIndex(0);
    }
    
    // Refresh
    if (input === 'r') {
      fetchOrders();
    }
    
    // Cancel order placeholder
    if (input === 'c' && orders.length > 0) {
      // Would trigger cancel order - placeholder
    }
    
    // Enter key for detail/action
    if (key.return && orders.length > 0) {
      // Future: Show order detail or action menu
    }
  });

  if (loading && orders.length === 0) {
    return (
      <Box flexDirection="column">
        <ViewHeader title="ORDERS" isContentFocused={isContentFocused} />
        <Box marginTop={1}>
          <Spinner label="Loading orders..." type="grid" />
        </Box>
        <Box marginTop={1}>
          <Text color={colors.textDim} dimColor>Timeout: {FETCH_TIMEOUT / 1000}s</Text>
        </Box>
      </Box>
    );
  }

  if (error && orders.length === 0) {
    return (
      <Box flexDirection="column">
        <ViewHeader title="ORDERS" isContentFocused={isContentFocused} />
        <Box marginTop={1}>
          <Text color={colors.error}>⚠ {error}</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={colors.textDim} dimColor>
            Check your connection and server status.
          </Text>
        </Box>
      </Box>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open': return colors.primary;
      case 'filled': return colors.success;
      case 'cancelled': return colors.error;
      case 'pending': return colors.warning;
      default: return colors.textMuted;
    }
  };

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <ViewHeader title="ORDERS" isContentFocused={isContentFocused} />
        <Text color={colors.textMuted}> │ </Text>
        <Text color={colors.textDim} dimColor>
          Filter: <Text color={colors.accent}>{filter.toUpperCase()}</Text>
        </Text>
        {loading && <Text color={colors.accent}> ⟳</Text>}
        <Box flexGrow={1} />
        <Text color={colors.textDim} dimColor>
          [f] filter [r] refresh [c] cancel [↑↓] navigate
        </Text>
      </Box>

      {orders.length === 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text color={colors.textMuted}>No orders found.</Text>
          <Box marginTop={1}>
            <Text color={colors.textDim} dimColor>
              Use <Text color={colors.accent}>grid order create</Text> to place an order.
            </Text>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Table<Order>
            data={orders}
            columns={[
              { header: 'ID', accessor: 'id', width: 10 },
              { 
                header: 'SIDE', 
                accessor: (row: Order) => row.side.toUpperCase(),
                width: 6,
                color: (_value: unknown, row: Order) => getSideColor(row.side),
              },
              { header: 'SIZE', accessor: 'size', width: 12, align: 'right' },
              { header: 'PRICE', accessor: 'price', width: 12, align: 'right' },
              { 
                header: 'STATUS', 
                accessor: (row: Order) => row.status.toUpperCase(),
                width: 12,
                color: (_value: unknown, row: Order) => getStatusColor(row.status),
              },
              { header: 'MARKET', accessor: 'market', width: 14 },
            ]}
            selectedIndex={isContentFocused ? selectedIndex : -1}
          />

          {/* Order Detail - only show when focused */}
          {orders.length > 0 && isContentFocused && (
            <Box marginTop={1} borderStyle="single" borderColor={colors.surface} padding={1}>
              <Box flexDirection="column">
                <Text color={colors.textMuted}>Selected Order:</Text>
                <Box marginTop={1}>
                  <Text color={colors.text}>ID: </Text>
                  <Text color={colors.accent}>{orders[selectedIndex]?.id}</Text>
                  <Text color={colors.textMuted}> │ </Text>
                  <Text color={getSideColor(orders[selectedIndex]?.side || 'buy')}>
                    {orders[selectedIndex]?.side?.toUpperCase()}
                  </Text>
                  <Text color={colors.text}> {orders[selectedIndex]?.size} @ {orders[selectedIndex]?.price}</Text>
                </Box>
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* Stats */}
      <Box marginTop={1}>
        <Text color={colors.textMuted}>
          Total: <Text color={colors.text}>{orders.length}</Text>
        </Text>
        <Text color={colors.textMuted}> │ </Text>
        <Text color={colors.textMuted}>
          Buy: <Text color={colors.primary}>{orders.filter(o => o.side === 'buy').length}</Text>
        </Text>
        <Text color={colors.textMuted}> │ </Text>
        <Text color={colors.textMuted}>
          Sell: <Text color={colors.accent}>{orders.filter(o => o.side === 'sell').length}</Text>
        </Text>
      </Box>
    </Box>
  );
}

/**
 * View header component with focus indicator
 */
function ViewHeader({ title, isContentFocused }: { title: string; isContentFocused: boolean }): React.ReactElement {
  return (
    <Text color={colors.text} bold>
      {isContentFocused && <Text color={colors.primary}>◆ </Text>}
      {title}_
    </Text>
  );
}
