import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { colors, logoCompact } from '../theme';
import { Spinner } from '../components';
import { useLayout } from '../hooks';
import { DashboardView } from './views/DashboardView';
import { BalancesView } from './views/BalancesView';
import { OrdersView } from './views/OrdersView';
import { SettingsView } from './views/SettingsView';
import { IssuanceView } from './views/IssuanceView';
import { HotwireView } from './views/HotwireView';
import { ApiClient } from '../../../sdk/http/client';
import { getActiveProfileName } from '../../../core/config/profiles';
import { getVersion } from '../../../core/version';
import { FocusProvider, useFocusZone, FocusZone } from './FocusContext';

// Version from package.json (single source of truth)
const VERSION = getVersion();

// Connection status type
type ConnectionStatus = 'checking' | 'connected' | 'disconnected' | 'error';

// Connection context for sharing status across views
interface ConnectionContextValue {
  status: ConnectionStatus;
  lastError: string | null;
  retry: () => void;
}

const ConnectionContext = createContext<ConnectionContextValue>({
  status: 'checking',
  lastError: null,
  retry: () => {},
});

export const useConnection = () => useContext(ConnectionContext);

type View = 'dashboard' | 'balances' | 'orders' | 'issuance' | 'hotwire' | 'settings';

interface MenuItem {
  id: View;
  label: string;
  shortcut: string;
}

const menuItems: MenuItem[] = [
  { id: 'dashboard', label: 'DASHBOARD', shortcut: '1' },
  { id: 'balances', label: 'BALANCES', shortcut: '2' },
  { id: 'orders', label: 'ORDERS', shortcut: '3' },
  { id: 'issuance', label: 'ISSUANCE', shortcut: '4' },
  { id: 'hotwire', label: 'HOTWIRE', shortcut: '5' },
  { id: 'settings', label: 'SETTINGS', shortcut: '6' },
];

// Connection check timeout (5 seconds)
const CONNECTION_TIMEOUT = 5000;
const CONNECTION_CHECK_INTERVAL = 30000;

/**
 * Main TUI Application Component
 * 
 * Focus Management:
 * - Tab: Switch between sidebar and content zones
 * - When sidebar focused: Arrow keys navigate menu, Enter selects
 * - When content focused: Input goes to current view
 * - Number keys (1-6): Always switch views regardless of focus
 * - Escape: Return focus to sidebar from content
 */
function AppContent(): React.ReactElement {
  const { exit } = useApp();
  const layout = useLayout();
  const { zone, toggleZone, focusSidebar, focusContent, isFocused } = useFocusZone();
  
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [menuIndex, setMenuIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('checking');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [profile] = useState<string>(getActiveProfileName() || 'default');

  // Check API connection with timeout
  const checkConnection = useCallback(async () => {
    setConnectionStatus('checking');
    
    try {
      const client = ApiClient.getInstance();
      
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_TIMEOUT);
      });
      
      // Race between API call and timeout
      await Promise.race([
        client.getMe(),
        timeoutPromise
      ]);
      
      setConnectionStatus('connected');
      setConnectionError(null);
    } catch (err: any) {
      const errorMessage = err.message || 'Connection failed';
      if (errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED')) {
        setConnectionStatus('disconnected');
        setConnectionError('Server unreachable');
      } else if (errorMessage.includes('401') || errorMessage.includes('403')) {
        setConnectionStatus('error');
        setConnectionError('Authentication failed');
      } else {
        setConnectionStatus('disconnected');
        setConnectionError(errorMessage);
      }
    }
  }, []);

  // Initial load and connection check
  useEffect(() => {
    const init = async () => {
      await checkConnection();
      setIsLoading(false);
    };
    init();
    
    // Periodic connection check
    const interval = setInterval(checkConnection, CONNECTION_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [checkConnection]);

  // Keyboard navigation with focus-aware handling
  useInput((input, key) => {
    // Global quit - Ctrl+C always works
    if (key.ctrl && input === 'c') {
      exit();
      return;
    }
    
    // 'q' to quit - only when sidebar is focused (not typing in content)
    if (input === 'q' && isFocused('sidebar')) {
      exit();
      return;
    }

    // Number shortcuts - switch views (but not when typing in hotwire)
    const num = parseInt(input);
    if (num >= 1 && num <= menuItems.length) {
      // Don't intercept numbers when in Hotwire view with content focused (user is typing)
      if (currentView === 'hotwire' && isFocused('content')) {
        // Let the number go through to the input
        return;
      }
      const newIndex = num - 1;
      setMenuIndex(newIndex);
      setCurrentView(menuItems[newIndex].id);
      // Stay in current focus zone - don't force switch
      return;
    }

    // Tab - toggle between sidebar and content
    if (key.tab) {
      toggleZone();
      return;
    }

    // Escape - return to sidebar from content
    if (key.escape) {
      focusSidebar();
      return;
    }

    // Sidebar-specific navigation (only when sidebar is focused)
    if (isFocused('sidebar')) {
      // Arrow navigation for menu
      if (key.upArrow) {
        setMenuIndex((prev) => (prev > 0 ? prev - 1 : menuItems.length - 1));
        return;
      }
      if (key.downArrow) {
        setMenuIndex((prev) => (prev < menuItems.length - 1 ? prev + 1 : 0));
        return;
      }
      
      // Enter to select menu item AND move focus to content
      if (key.return) {
        setCurrentView(menuItems[menuIndex].id);
        focusContent();
        return;
      }
      
      // Right arrow - move to content
      if (key.rightArrow) {
        focusContent();
        return;
      }
    }

    // Content-specific: Left arrow returns to sidebar
    if (isFocused('content') && key.leftArrow) {
      // Only if view doesn't handle left arrow internally
      // Views can override this by handling leftArrow themselves
    }
  });

  // Connection context value
  const connectionContextValue: ConnectionContextValue = {
    status: connectionStatus,
    lastError: connectionError,
    retry: checkConnection,
  };

  // Get status indicator
  const getStatusIndicator = () => {
    switch (connectionStatus) {
      case 'checking':
        return { color: colors.warning, symbol: '◌', label: 'Connecting...' };
      case 'connected':
        return { color: colors.success, symbol: '●', label: 'Connected' };
      case 'disconnected':
        return { color: colors.error, symbol: '○', label: 'Disconnected' };
      case 'error':
        return { color: colors.error, symbol: '✗', label: 'Error' };
    }
  };

  const status = getStatusIndicator();
  
  // Focus indicator colors
  const sidebarBorderColor = isFocused('sidebar') ? colors.primary : colors.surface;
  const contentBorderColor = isFocused('content') ? colors.primary : colors.surface;

  if (isLoading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={colors.primary} bold>{logoCompact}</Text>
        <Box marginTop={1}>
          <Spinner label="Connecting to server..." type="grid" />
        </Box>
        {connectionStatus === 'checking' && (
          <Box marginTop={1}>
            <Text color={colors.textDim} dimColor>Timeout: {CONNECTION_TIMEOUT / 1000}s</Text>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <ConnectionContext.Provider value={connectionContextValue}>
      <Box flexDirection="column" minHeight={layout.rows}>
        {/* Header */}
        <Box borderStyle="single" borderColor={colors.surface} paddingX={1}>
          <Box flexGrow={1}>
            <Text color={colors.primary} bold>{logoCompact}</Text>
            <Text color={colors.textMuted}> │ </Text>
            <Text color={status.color}>{status.symbol}</Text>
            <Text color={colors.textMuted}> {status.label}</Text>
            {connectionError && connectionStatus !== 'connected' && (
              <Text color={colors.textDim} dimColor> ({connectionError})</Text>
            )}
          </Box>
          <FocusIndicator zone={zone} />
          <Text color={colors.textMuted}> │ </Text>
          <Text color={colors.textDim} dimColor>[q] quit</Text>
        </Box>

        {/* Main content area */}
        <Box minHeight={layout.contentHeight}>
          {/* Sidebar */}
          <Box 
            flexDirection="column" 
            width={layout.sidebarWidth} 
            borderStyle="single" 
            borderColor={sidebarBorderColor}
            paddingY={1}
          >
            {/* Focus indicator */}
            {isFocused('sidebar') && (
              <Box paddingX={1} marginBottom={1}>
                <Text color={colors.primary} bold>◆ MENU</Text>
              </Box>
            )}
            
            {menuItems.map((item, index) => (
              <Box key={item.id} paddingX={1}>
                <Text
                  color={index === menuIndex ? colors.primary : colors.textMuted}
                  bold={index === menuIndex}
                  inverse={currentView === item.id}
                >
                  {isFocused('sidebar') && index === menuIndex ? '▶ ' : '  '}
                  [{item.shortcut}] {item.label}
                </Text>
              </Box>
            ))}
            
            <Box marginTop={2} paddingX={1}>
              <Text color={colors.textDim} dimColor>
                {isFocused('sidebar') ? (
                  <>
                    ↑↓ navigate{'\n'}
                    ⏎  select{'\n'}
                    →  content{'\n'}
                    ⇥  switch
                  </>
                ) : (
                  <>
                    ⇥  focus menu{'\n'}
                    ⎋  back to menu
                  </>
                )}
              </Text>
            </Box>
          </Box>

          {/* Content area */}
          <Box 
            flexDirection="column" 
            flexGrow={1}
            borderStyle="single" 
            borderColor={contentBorderColor}
            padding={1}
            overflowY="hidden"
          >
            {currentView === 'dashboard' && <DashboardView key="dashboard" />}
            {currentView === 'balances' && <BalancesView key="balances" />}
            {currentView === 'orders' && <OrdersView key="orders" />}
            {currentView === 'issuance' && <IssuanceView key="issuance" />}
            {currentView === 'hotwire' && <HotwireView key="hotwire" />}
            {currentView === 'settings' && <SettingsView key="settings" />}
          </Box>
        </Box>

        {/* Footer */}
        <Box borderStyle="single" borderColor={colors.surface} paddingX={1}>
          <Box flexGrow={1}>
            <Text color={colors.textMuted}>
              <Text color={colors.textDim}>Profile: </Text>
              <Text color={colors.text}>{profile}</Text>
            </Text>
          </Box>
          <Text color={colors.textDim} dimColor>v{VERSION}</Text>
        </Box>
      </Box>
    </ConnectionContext.Provider>
  );
}

/**
 * Focus indicator component shown in header
 */
function FocusIndicator({ zone }: { zone: FocusZone }): React.ReactElement {
  return (
    <Text color={colors.textMuted}>
      <Text color={zone === 'sidebar' ? colors.accent : colors.textDim}>
        {zone === 'sidebar' ? '●' : '○'} MENU
      </Text>
      <Text color={colors.textDim}> │ </Text>
      <Text color={zone === 'content' ? colors.accent : colors.textDim}>
        {zone === 'content' ? '●' : '○'} VIEW
      </Text>
    </Text>
  );
}

/**
 * Main App export - wraps content in FocusProvider
 */
export function App(): React.ReactElement {
  return (
    <FocusProvider initialZone="content">
      <AppContent />
    </FocusProvider>
  );
}
