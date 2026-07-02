import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../theme';
import { Spinner, StatusBadge, KeyValue } from '../../components';
import { Sparkline } from '../../charts';
import { ApiClient } from '../../../../sdk/http/client';
import { getConfig } from '../../../../core/config/config';
import { getActiveProfileName } from '../../../../core/config/profiles';
import { useConnection } from '../App';

// Timeout for data fetching (10 seconds)
const FETCH_TIMEOUT = 10000;

interface DashboardData {
  totalBalance: number;
  activeOrders: number;
  instruments: number;
  recentActivity: number[];
  profile: string;
  apiUrl: string;
}

export function DashboardView(): React.ReactElement {
  const { status: connectionStatus } = useConnection();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchData = async () => {
    // Don't fetch if disconnected
    if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
      setLoading(false);
      setError('Server not connected');
      return;
    }

    try {
      const client = ApiClient.getInstance();
      const config = getConfig();
      const profile = getActiveProfileName() ?? 'default';
      
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), FETCH_TIMEOUT);
      });
      
      // Fetch accounts with timeout
      const accountsPromise = client.getTradingAccounts();
      const accounts = await Promise.race([accountsPromise, timeoutPromise]) as any[];
      
      const totalBalance = accounts.reduce(
        (sum: number, acc: any) => sum + parseFloat(acc.total_balance || '0'),
        0
      );
      
      // Fetch orders
      let activeOrders = 0;
      try {
        const ordersPromise = client.listOrders({ status: 'open' } as any);
        const orders = await Promise.race([ordersPromise, timeoutPromise]) as any[];
        activeOrders = orders.length;
      } catch {
        // Orders might not be available
      }

      setData({
        totalBalance,
        activeOrders,
        instruments: accounts.length,
        recentActivity: generateSparklineData(),
        profile,
        apiUrl: config.API_URL,
      });
      setLastUpdate(new Date());
      setError(null);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load dashboard';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [connectionStatus]);

  if (loading && !data) {
    return (
      <Box flexDirection="column">
        <Text color={colors.text} bold>DASHBOARD_</Text>
        <Box marginTop={1}>
          <Spinner label="Loading dashboard..." type="grid" />
        </Box>
        <Box marginTop={1}>
          <Text color={colors.textDim} dimColor>Timeout: {FETCH_TIMEOUT / 1000}s</Text>
        </Box>
      </Box>
    );
  }

  if (error && !data) {
    return (
      <Box flexDirection="column">
        <Text color={colors.text} bold>DASHBOARD_</Text>
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

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={colors.text} bold>DASHBOARD_</Text>
        <Text color={colors.textMuted}> │ </Text>
        <Text color={colors.textDim} dimColor>
          Updated: {lastUpdate.toLocaleTimeString()}
        </Text>
        {loading && <Text color={colors.accent}> ⟳</Text>}
      </Box>

      {/* Stats Grid */}
      <Box marginBottom={1}>
        <Box flexDirection="column" marginRight={4}>
          <Text color={colors.textMuted}>TOTAL BALANCE_</Text>
          <Text color={colors.accent} bold>
            {data?.totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Text>
        </Box>

        <Box flexDirection="column" marginRight={4}>
          <Text color={colors.textMuted}>ACTIVE ORDERS_</Text>
          <Text color={colors.primary} bold>{data?.activeOrders}</Text>
        </Box>

        <Box flexDirection="column" marginRight={4}>
          <Text color={colors.textMuted}>INSTRUMENTS_</Text>
          <Text color={colors.text} bold>{data?.instruments}</Text>
        </Box>

        <Box flexDirection="column">
          <Text color={colors.textMuted}>STATUS_</Text>
          <StatusBadge status="success" label="Online" showDot />
        </Box>
      </Box>

      {/* Activity Sparkline */}
      <Box flexDirection="column" marginBottom={1}>
        <Text color={colors.textMuted}>ACTIVITY_</Text>
        <Sparkline 
          data={data?.recentActivity || []} 
          width={40} 
          color={colors.primary}
        />
      </Box>

      {/* Connection Info */}
      <Box flexDirection="column" marginTop={1}>
        <Text color={colors.textMuted} dimColor>CONNECTION_</Text>
        <KeyValue
          items={[
            { label: 'Profile', value: data?.profile || 'default' },
            { label: 'API', value: data?.apiUrl || 'N/A' },
          ]}
          labelWidth={10}
        />
      </Box>
    </Box>
  );
}

function generateSparklineData(): number[] {
  // Generate some sample activity data
  return Array.from({ length: 20 }, () => Math.floor(Math.random() * 100));
}
