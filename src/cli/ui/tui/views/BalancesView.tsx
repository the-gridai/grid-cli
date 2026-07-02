import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from '../../theme';
import { Spinner, Table } from '../../components';
import { BarChart } from '../../charts';
import { ApiClient } from '../../../../sdk/http/client';
import { useConnection } from '../App';
import { useContentFocused } from '../FocusContext';

// Timeout for data fetching (10 seconds)
const FETCH_TIMEOUT = 10000;

interface Balance {
  instrument: string;
  available: string;
  locked: string;
  total: string;
}

export function BalancesView(): React.ReactElement {
  const { status: connectionStatus } = useConnection();
  const isContentFocused = useContentFocused();
  
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');

  const fetchBalances = async () => {
    // Don't fetch if disconnected
    if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
      setLoading(false);
      setError('Server not connected');
      return;
    }

    try {
      setLoading(true);
      const client = ApiClient.getInstance();
      
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), FETCH_TIMEOUT);
      });
      
      const accounts = await Promise.race([
        client.getTradingAccounts(),
        timeoutPromise
      ]) as any[];
      
      const formatted: Balance[] = accounts.map((account: any) => ({
        instrument: account.instrument_symbol || account.instrument_id,
        available: parseFloat(account.available_balance).toFixed(2),
        locked: parseFloat(account.locked_balance || '0').toFixed(2),
        total: parseFloat(account.total_balance).toFixed(2),
      }));
      
      setBalances(formatted);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load balances');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
    // Refresh every 10 seconds
    const interval = setInterval(fetchBalances, 10000);
    return () => clearInterval(interval);
  }, [connectionStatus]);

  // Keyboard navigation - ONLY when content is focused
  useInput((input, key) => {
    // Skip if content area is not focused
    if (!isContentFocused) return;
    
    // Navigation within the list
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
    if (key.downArrow && selectedIndex < balances.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
    
    // View toggle
    if (input === 'v') {
      setViewMode(viewMode === 'table' ? 'chart' : 'table');
    }
    
    // Refresh
    if (input === 'r') {
      fetchBalances();
    }
    
    // Enter key - could be used for detail view or actions
    if (key.return && balances.length > 0) {
      // Future: Open detail view for selected balance
      // For now, this prevents the parent from capturing enter
    }
  });

  if (loading && balances.length === 0) {
    return (
      <Box flexDirection="column">
        <ViewHeader title="BALANCES" isContentFocused={isContentFocused} />
        <Box marginTop={1}>
          <Spinner label="Loading balances..." type="grid" />
        </Box>
        <Box marginTop={1}>
          <Text color={colors.textDim} dimColor>Timeout: {FETCH_TIMEOUT / 1000}s</Text>
        </Box>
      </Box>
    );
  }

  if (error && balances.length === 0) {
    return (
      <Box flexDirection="column">
        <ViewHeader title="BALANCES" isContentFocused={isContentFocused} />
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

  const chartData = balances.map((b, i) => ({
    label: b.instrument.substring(0, 12),
    value: parseFloat(b.total),
    color: i === selectedIndex ? colors.accent : colors.primary,
  }));

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <ViewHeader title="BALANCES" isContentFocused={isContentFocused} />
        <Text color={colors.textMuted}> │ </Text>
        <Text color={colors.textDim} dimColor>
          {balances.length} accounts
        </Text>
        {loading && <Text color={colors.accent}> ⟳</Text>}
        <Box flexGrow={1} />
        <Text color={colors.textDim} dimColor>
          [v] view [r] refresh [↑↓] navigate
        </Text>
      </Box>

      {viewMode === 'table' ? (
        <Box flexDirection="column">
          <Table
            data={balances}
            columns={[
              { header: 'INSTRUMENT', accessor: 'instrument', width: 16 },
              { header: 'AVAILABLE', accessor: 'available', width: 14, align: 'right' },
              { header: 'LOCKED', accessor: 'locked', width: 12, align: 'right' },
              { header: 'TOTAL', accessor: 'total', width: 14, align: 'right' },
            ]}
            selectedIndex={isContentFocused ? selectedIndex : -1}
          />
          
          {balances.length > 0 && isContentFocused && (
            <Box marginTop={1}>
              <Text color={colors.textMuted}>
                Selected: <Text color={colors.accent}>{balances[selectedIndex]?.instrument}</Text>
              </Text>
            </Box>
          )}
        </Box>
      ) : (
        <Box flexDirection="column">
          <BarChart
            data={chartData}
            title="BALANCE DISTRIBUTION"
            width={50}
            showValue="right"
            sort="desc"
          />
        </Box>
      )}

      {/* Summary */}
      <Box marginTop={1} borderStyle="single" borderColor={colors.surface} padding={1}>
        <Box marginRight={4}>
          <Text color={colors.textMuted}>Total Value: </Text>
          <Text color={colors.accent} bold>
            {balances.reduce((sum, b) => sum + parseFloat(b.total), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Text>
        </Box>
        <Box>
          <Text color={colors.textMuted}>Locked: </Text>
          <Text color={colors.warning}>
            {balances.reduce((sum, b) => sum + parseFloat(b.locked), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Text>
        </Box>
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
