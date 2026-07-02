import React from 'react';
import { Box, Text } from 'ink';
import type { TradingApiPingResult } from '../../../sdk/http/client';
import { Header, KeyValue, StatusBadge, Divider } from '../components';
import { colors, tagline } from '../theme';
import type { StatusType } from '../components/StatusBadge';

export interface StatusViewProps {
  apiUrl: string;
  wsUrl: string;
  dbHost: string;
  profile?: string;
  /** @deprecated Prefer `apiStatus` from `ApiClient.pingTradingApi()` */
  isOnline?: boolean;
  /** Live Trading API check (`GET /v1/me`); when set, overrides `isOnline` display */
  apiStatus?: TradingApiPingResult;
}

/**
 * System status view - displays CLI configuration and connection status
 * 
 * @example
 * <StatusView
 *   apiUrl="https://api.thegrid.ai"
 *   wsUrl="wss://ws.thegrid.ai"
 *   dbHost="localhost"
 *   profile="production"
 *   isOnline={true}
 * />
 */
function resolveReachability(
  apiStatus: TradingApiPingResult | undefined,
  isOnline: boolean | undefined
): { badge: StatusType; label: string; detail?: string } {
  if (apiStatus) {
    switch (apiStatus.state) {
      case 'ok':
        return { badge: 'success', label: 'Connected' };
      case 'unauthorized':
        return {
          badge: 'warning',
          label: 'Reachable',
          detail: 'Auth failed (401/403). Check signing keys or OAuth tokens for this profile.',
        };
      case 'offline':
        return { badge: 'error', label: 'Offline', detail: apiStatus.message };
      default:
        return { badge: 'error', label: 'Offline', detail: 'unknown state' };
    }
  }

  const online = isOnline !== false;
  return online
    ? { badge: 'success', label: 'Connected' }
    : { badge: 'error', label: 'Offline' };
}

export function StatusView({
  apiUrl,
  wsUrl,
  dbHost,
  profile = 'default',
  isOnline = true,
  apiStatus,
}: StatusViewProps): React.ReactElement {
  const { badge, label, detail } = resolveReachability(apiStatus, isOnline);

  return (
    <Box flexDirection="column" paddingY={1}>
      {/* Header with logo */}
      <Header showLogo showSeparator width={50} />
      
      <Box flexDirection="column" paddingX={2} marginTop={1}>
        {/* Connection info */}
        <KeyValue
          labelWidth={16}
          items={[
            { label: 'API URL', value: apiUrl, valueColor: colors.text },
            { label: 'WS URL', value: wsUrl, valueColor: colors.text },
            { label: 'DB Host', value: dbHost, valueColor: colors.primary },
            { label: 'Profile', value: profile, valueColor: colors.textMuted },
          ]}
        />
        
        {/* Status row */}
        <Box marginTop={1}>
          <Box width={16}>
            <Text color={colors.textMuted}>Status</Text>
          </Box>
          <StatusBadge status={badge} label={label} showDot withUnderscore />
        </Box>
        {detail ? (
          <Box marginTop={1} paddingLeft={16} flexDirection="column">
            <Text color={colors.textMuted}>{detail}</Text>
          </Box>
        ) : null}
      </Box>
      
      {/* Footer separator and tagline */}
      <Box marginTop={1}>
        <Divider width={50} />
      </Box>
      <Box paddingX={2}>
        <Text color={colors.textMuted} dimColor>
          {tagline}
        </Text>
      </Box>
    </Box>
  );
}

export default StatusView;
