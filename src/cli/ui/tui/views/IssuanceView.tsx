import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { colors } from '../../theme';
import { Spinner, Table } from '../../components';
import { BarChart, Sparkline } from '../../charts';
import { ApiClient } from '../../../../sdk/http/client';
import { useConnection } from '../App';
import { useContentFocused } from '../FocusContext';

// Timeout for data fetching (10 seconds)
const FETCH_TIMEOUT = 10000;

type TabType = 'overview' | 'issuances' | 'liability';

interface IssuanceAccount {
  account_id: string;
  instrument_id: string;
  instrument_symbol: string;
  total_issued: string;
  total_transferred: string;
  available_balance: string;
  updated_at: string;
}

interface SupplyIssuance {
  id: string;
  instrument_id: string;
  instrument_symbol?: string;
  quantity: number;
  status: string;
  created_at: string;
}

interface IssuanceSummary {
  total_issued: number;
  total_transferred: number;
  total_available: number;
  issuance_count: number;
}

interface SupplierLiability {
  instrument_id: string;
  instrument_symbol?: string;
  total_liability: string;
  fulfilled: string;
  outstanding: string;
}

export function IssuanceView(): React.ReactElement {
  const { exit } = useApp();
  const { status: connectionStatus } = useConnection();
  const isContentFocused = useContentFocused();
  
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  // Data state
  const [accounts, setAccounts] = useState<IssuanceAccount[]>([]);
  const [issuances, setIssuances] = useState<SupplyIssuance[]>([]);
  const [summary, setSummary] = useState<IssuanceSummary | null>(null);
  const [liabilities, setLiabilities] = useState<SupplierLiability[]>([]);
  const [activityData, setActivityData] = useState<number[]>([]);

  const fetchData = async () => {
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
      
      // Fetch all data in parallel with timeout
      const [accountsData, issuancesData, summaryData, liabilityData] = await Promise.race([
        Promise.all([
          client.getIssuanceAccounts().catch(() => []),
          client.getSupplyIssuances().catch(() => []),
          client.getSupplyIssuanceSummary().catch(() => null),
          client.getSupplierLiability().catch(() => []),
        ]),
        timeoutPromise
      ]) as [any, any, any, any];
      
      // Ensure we always have arrays (API might return objects with nested data)
      const ensureArray = (data: any): any[] => {
        if (Array.isArray(data)) return data;
        if (data && typeof data === 'object' && Array.isArray(data.data)) return data.data;
        if (data && typeof data === 'object' && Array.isArray(data.items)) return data.items;
        return [];
      };
      
      setAccounts(ensureArray(accountsData));
      setIssuances(ensureArray(issuancesData));
      setSummary(summaryData);
      setLiabilities(ensureArray(liabilityData));
      
      // Generate activity sparkline from issuances (last 20 data points)
      if (issuancesData && issuancesData.length > 0) {
        const quantities = issuancesData
          .slice(0, 20)
          .reverse()
          .map((i: SupplyIssuance) => i.quantity || 0);
        setActivityData(quantities.length > 0 ? quantities : [0]);
      } else {
        setActivityData([0]);
      }
      
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load issuance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [connectionStatus]);

  // Keyboard navigation - ONLY when content is focused
  useInput((input, key) => {
    // Skip inputs if content area is not focused (App.tsx handles global quit)
    if (!isContentFocused) return;
    
    // Tab switching
    if (input === 'o') setActiveTab('overview');
    if (input === 'i') setActiveTab('issuances');
    if (input === 'l') setActiveTab('liability');
    if (input === 'r') fetchData();
    
    // Row navigation
    const currentData = activeTab === 'overview' ? accounts : 
                        activeTab === 'issuances' ? issuances : liabilities;
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
    if (key.downArrow && selectedIndex < currentData.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
    
    // Enter for detail (future)
    if (key.return && currentData.length > 0) {
      // Future: Show detail view
    }
  });

  // Reset selection when switching tabs
  useEffect(() => {
    setSelectedIndex(0);
  }, [activeTab]);

  if (loading && accounts.length === 0) {
    return (
      <Box flexDirection="column">
        <ViewHeader title="ISSUANCE" isContentFocused={isContentFocused} />
        <Box marginTop={1}>
          <Spinner label="Loading issuance data..." type="grid" />
        </Box>
        <Box marginTop={1}>
          <Text color={colors.textDim} dimColor>Timeout: {FETCH_TIMEOUT / 1000}s</Text>
        </Box>
      </Box>
    );
  }

  if (error && accounts.length === 0 && issuances.length === 0) {
    return (
      <Box flexDirection="column">
        <ViewHeader title="ISSUANCE" isContentFocused={isContentFocused} />
        <Box marginTop={1}>
          <Text color={colors.error}>⚠ {error}</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={colors.textDim} dimColor>
            {connectionStatus === 'disconnected' || connectionStatus === 'error'
              ? 'Check your connection and server status.'
              : 'Make sure you have supplier permissions to view issuance data.'}
          </Text>
        </Box>
      </Box>
    );
  }

  const formatTimeAgo = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return '-';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': case 'success': return colors.success;
      case 'pending': return colors.warning;
      case 'failed': case 'error': return colors.error;
      default: return colors.textMuted;
    }
  };

  return (
    <Box flexDirection="column">
      {/* Header with tabs */}
      <Box marginBottom={1}>
        <ViewHeader title="ISSUANCE" isContentFocused={isContentFocused} />
        <Text color={colors.textMuted}> │ </Text>
        <Text 
          color={activeTab === 'overview' ? colors.accent : colors.textDim} 
          bold={activeTab === 'overview'}
        >
          Overview
        </Text>
        <Text color={colors.textMuted}> │ </Text>
        <Text 
          color={activeTab === 'issuances' ? colors.accent : colors.textDim}
          bold={activeTab === 'issuances'}
        >
          Issuances
        </Text>
        <Text color={colors.textMuted}> │ </Text>
        <Text 
          color={activeTab === 'liability' ? colors.accent : colors.textDim}
          bold={activeTab === 'liability'}
        >
          Liability
        </Text>
        {loading && <Text color={colors.accent}> ⟳</Text>}
        <Box flexGrow={1} />
        <Text color={colors.textDim} dimColor>
          [o] overview [i] issuances [l] liability [r] refresh [↑↓]
        </Text>
      </Box>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <OverviewTab 
          accounts={accounts}
          summary={summary}
          activityData={activityData}
          selectedIndex={isContentFocused ? selectedIndex : -1}
          formatTimeAgo={formatTimeAgo}
        />
      )}
      
      {activeTab === 'issuances' && (
        <IssuancesTab 
          issuances={issuances}
          selectedIndex={isContentFocused ? selectedIndex : -1}
          formatTimeAgo={formatTimeAgo}
          getStatusColor={getStatusColor}
        />
      )}
      
      {activeTab === 'liability' && (
        <LiabilityTab 
          liabilities={liabilities}
          selectedIndex={isContentFocused ? selectedIndex : -1}
        />
      )}
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

// Overview Tab Component
function OverviewTab({ 
  accounts, 
  summary, 
  activityData, 
  selectedIndex,
  formatTimeAgo,
}: {
  accounts: IssuanceAccount[];
  summary: IssuanceSummary | null;
  activityData: number[];
  selectedIndex: number;
  formatTimeAgo: (date: string) => string;
}): React.ReactElement {
  // Calculate totals from accounts if summary not available
  const totalIssued = summary?.total_issued ?? 
    accounts.reduce((sum, a) => sum + parseFloat(a.total_issued || '0'), 0);
  const totalTransferred = summary?.total_transferred ?? 
    accounts.reduce((sum, a) => sum + parseFloat(a.total_transferred || '0'), 0);
  const totalAvailable = summary?.total_available ?? 
    accounts.reduce((sum, a) => sum + parseFloat(a.available_balance || '0'), 0);

  return (
    <Box flexDirection="column">
      {/* Summary stats */}
      <Box borderStyle="single" borderColor={colors.surface} padding={1} marginBottom={1}>
        <Box flexDirection="column">
          <Text color={colors.textMuted} bold>ISSUANCE SUMMARY_</Text>
          <Box marginTop={1}>
            <Box marginRight={4}>
              <Text color={colors.textMuted}>Total Issued: </Text>
              <Text color={colors.accent} bold>
                {totalIssued.toLocaleString()}
              </Text>
            </Box>
            <Box marginRight={4}>
              <Text color={colors.textMuted}>Transferred: </Text>
              <Text color={colors.primary} bold>
                {totalTransferred.toLocaleString()}
              </Text>
            </Box>
            <Box>
              <Text color={colors.textMuted}>Available: </Text>
              <Text color={colors.success} bold>
                {totalAvailable.toLocaleString()}
              </Text>
            </Box>
          </Box>
          {activityData.length > 1 && (
            <Box marginTop={1}>
              <Sparkline data={activityData} width={30} caption="Recent activity" />
            </Box>
          )}
        </Box>
      </Box>

      {/* Issuance accounts table */}
      {accounts.length === 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text color={colors.textMuted}>No issuance accounts found.</Text>
          <Box marginTop={1}>
            <Text color={colors.textDim} dimColor>
              Issuance accounts are created when you issue supply for an instrument.
            </Text>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Text color={colors.textMuted} bold>ISSUANCE ACCOUNTS_</Text>
          <Box marginTop={1}>
            <Table<IssuanceAccount>
              data={accounts}
              columns={[
                { 
                  header: 'INSTRUMENT', 
                  accessor: (row) => row.instrument_symbol || row.instrument_id?.substring(0, 8) || '-',
                  width: 16 
                },
                { 
                  header: 'TOTAL ISSUED', 
                  accessor: (row) => parseFloat(row.total_issued || '0').toLocaleString(),
                  width: 14, 
                  align: 'right' 
                },
                { 
                  header: 'TRANSFERRED', 
                  accessor: (row) => parseFloat(row.total_transferred || '0').toLocaleString(),
                  width: 14, 
                  align: 'right' 
                },
                { 
                  header: 'AVAILABLE', 
                  accessor: (row) => parseFloat(row.available_balance || '0').toLocaleString(),
                  width: 12, 
                  align: 'right',
                  color: colors.success
                },
                { 
                  header: 'UPDATED', 
                  accessor: (row) => formatTimeAgo(row.updated_at),
                  width: 10 
                },
              ]}
              selectedIndex={selectedIndex}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}

// Issuances Tab Component
function IssuancesTab({ 
  issuances, 
  selectedIndex,
  formatTimeAgo,
  getStatusColor,
}: {
  issuances: SupplyIssuance[];
  selectedIndex: number;
  formatTimeAgo: (date: string) => string;
  getStatusColor: (status: string) => string;
}): React.ReactElement {
  if (issuances.length === 0) {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color={colors.textMuted}>No supply issuances found.</Text>
        <Box marginTop={1}>
          <Text color={colors.textDim} dimColor>
            Use <Text color={colors.accent}>grid supply issue</Text> to create supply, or automate it with a strategy.
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text color={colors.textMuted} bold>SUPPLY ISSUANCES_</Text>
      <Box marginTop={1}>
        <Table<SupplyIssuance>
          data={issuances}
          columns={[
            { 
              header: 'ID', 
              accessor: (row) => row.id?.substring(0, 8) || '-',
              width: 10 
            },
            { 
              header: 'INSTRUMENT', 
              accessor: (row) => row.instrument_symbol || row.instrument_id?.substring(0, 12) || '-',
              width: 14 
            },
            { 
              header: 'QUANTITY', 
              accessor: (row) => (row.quantity || 0).toLocaleString(),
              width: 12, 
              align: 'right',
              color: colors.accent
            },
            { 
              header: 'STATUS', 
              accessor: (row) => (row.status || 'unknown').toUpperCase(),
              width: 12,
              color: (_value, row) => getStatusColor(row.status)
            },
            { 
              header: 'CREATED', 
              accessor: (row) => formatTimeAgo(row.created_at),
              width: 12 
            },
          ]}
          selectedIndex={selectedIndex}
          maxRows={15}
        />
      </Box>

      {/* Stats */}
      <Box marginTop={1}>
        <Text color={colors.textMuted}>
          Total: <Text color={colors.text}>{issuances.length}</Text>
        </Text>
        <Text color={colors.textMuted}> │ </Text>
        <Text color={colors.textMuted}>
          Total Issued: <Text color={colors.accent}>
            {issuances.reduce((sum, i) => sum + (i.quantity || 0), 0).toLocaleString()}
          </Text>
        </Text>
      </Box>
    </Box>
  );
}

// Liability Tab Component
function LiabilityTab({ 
  liabilities, 
  selectedIndex,
}: {
  liabilities: SupplierLiability[];
  selectedIndex: number;
}): React.ReactElement {
  // Defensive check - ensure liabilities is always an array
  const safeliabilities = Array.isArray(liabilities) ? liabilities : [];
  
  if (safeliabilities.length === 0) {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color={colors.textMuted}>No liability data found.</Text>
        <Box marginTop={1}>
          <Text color={colors.textDim} dimColor>
            Liability data appears once you have active supply positions.
          </Text>
        </Box>
      </Box>
    );
  }

  const chartData = safeliabilities.map((l, i) => ({
    label: l.instrument_symbol || l.instrument_id?.substring(0, 10) || `Instr ${i + 1}`,
    value: parseFloat(l.outstanding || l.total_liability || '0'),
    color: i % 2 === 0 ? colors.primary : colors.accent,
  }));

  return (
    <Box flexDirection="column">
      {/* Chart view */}
      <Box marginBottom={1}>
        <BarChart
          data={chartData}
          title="OUTSTANDING LIABILITY"
          width={50}
          showValue="right"
          sort="desc"
        />
      </Box>

      {/* Table view */}
      <Text color={colors.textMuted} bold>SUPPLIER LIABILITY_</Text>
      <Box marginTop={1}>
        <Table<SupplierLiability>
          data={safeliabilities}
          columns={[
            { 
              header: 'INSTRUMENT', 
              accessor: (row) => row.instrument_symbol || row.instrument_id?.substring(0, 12) || '-',
              width: 16 
            },
            { 
              header: 'TOTAL LIABILITY', 
              accessor: (row) => parseFloat(row.total_liability || '0').toLocaleString(),
              width: 16, 
              align: 'right' 
            },
            { 
              header: 'FULFILLED', 
              accessor: (row) => parseFloat(row.fulfilled || '0').toLocaleString(),
              width: 14, 
              align: 'right',
              color: colors.success
            },
            { 
              header: 'OUTSTANDING', 
              accessor: (row) => parseFloat(row.outstanding || '0').toLocaleString(),
              width: 14, 
              align: 'right',
              color: colors.warning
            },
          ]}
          selectedIndex={selectedIndex}
        />
      </Box>

      {/* Summary */}
      <Box marginTop={1} borderStyle="single" borderColor={colors.surface} padding={1}>
        <Box marginRight={4}>
          <Text color={colors.textMuted}>Total Liability: </Text>
          <Text color={colors.text} bold>
            {safeliabilities.reduce((sum, l) => sum + parseFloat(l.total_liability || '0'), 0).toLocaleString()}
          </Text>
        </Box>
        <Box>
          <Text color={colors.textMuted}>Outstanding: </Text>
          <Text color={colors.warning} bold>
            {safeliabilities.reduce((sum, l) => sum + parseFloat(l.outstanding || '0'), 0).toLocaleString()}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
