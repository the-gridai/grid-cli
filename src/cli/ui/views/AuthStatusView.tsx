import React from 'react';
import { Box, Text } from 'ink';
import { Header, KeyValue, Divider, StatusBadge, Spinner } from '../components';
import { colors, tagline } from '../theme';

export interface AuthStatusData {
  credentialsFileFound: boolean;
  credentialsPath: string;
  activeProfile?: string;
  credentialsFrom?: 'environment' | 'profile' | 'none';
  apiUrl?: string;
  signingKeyConfigured: boolean;
  fingerprintConfigured: boolean;
  signingKeyMasked?: string;
  fingerprintMasked?: string;
  authType?: 'signing_key' | 'oauth';
  oauthScopes?: string[];
  tokenExpiresAt?: string;
  tokenExpired?: boolean;
}

export interface ConnectionStatus {
  status: 'pending' | 'success' | 'error' | 'skipped';
  message?: string;
  accountCount?: number;
  accounts?: { id: string; symbol: string }[];
}

export interface AuthStatusViewProps {
  auth: AuthStatusData;
  connection: ConnectionStatus;
  showVerbose?: boolean;
}

/**
 * Authentication status view - displays auth configuration and connection status
 */
export function AuthStatusView({
  auth,
  connection,
  showVerbose = false,
}: AuthStatusViewProps): React.ReactElement {
  return (
    <Box flexDirection="column" paddingY={1}>
      <Header title="AUTHENTICATION STATUS" showSeparator width={60} />
      
      {/* Credentials file info */}
      <Box flexDirection="column" paddingX={2} marginTop={1}>
        <KeyValue
          labelWidth={20}
          items={[
            { 
              label: 'Credentials file', 
              value: auth.credentialsFileFound ? '✓ Found' : '✗ Not found',
              valueColor: auth.credentialsFileFound ? colors.success : colors.warning,
            },
            { label: 'Path', value: auth.credentialsPath, valueColor: colors.textDim },
          ]}
        />
      </Box>

      {/* Profile info */}
      <Box flexDirection="column" paddingX={2} marginTop={1}>
        <KeyValue
          labelWidth={20}
          items={[
            { 
              label: 'Active profile', 
              value: auth.activeProfile || '(none)',
              valueColor: auth.activeProfile ? colors.primary : colors.textDim,
            },
            { 
              label: 'Credentials from', 
              value: getCredentialsSourceLabel(auth.credentialsFrom),
              valueColor: auth.credentialsFrom === 'none' ? colors.warning : colors.primary,
            },
            { 
              label: 'API URL', 
              value: auth.apiUrl || '(not set)',
              valueColor: auth.apiUrl ? colors.text : colors.textDim,
            },
          ]}
        />
      </Box>

      {/* Auth type */}
      <Box flexDirection="column" paddingX={2} marginTop={1}>
        <KeyValue
          labelWidth={20}
          items={[
            {
              label: 'Auth type',
              value: getAuthTypeLabel(auth.authType),
              valueColor: auth.authType ? colors.primary : colors.textDim,
            },
          ]}
        />
      </Box>

      {/* Signing key info (shown when not OAuth) */}
      {auth.authType !== 'oauth' && (
        <Box flexDirection="column" paddingX={2} marginTop={1}>
          <KeyValue
            labelWidth={20}
            items={[
              { 
                label: 'Signing key', 
                value: auth.signingKeyConfigured 
                  ? `✓ Configured (${auth.signingKeyMasked})`
                  : '✗ Not configured',
                valueColor: auth.signingKeyConfigured ? colors.success : colors.error,
              },
              { 
                label: 'Fingerprint', 
                value: auth.fingerprintConfigured 
                  ? `✓ Configured (${auth.fingerprintMasked})`
                  : '✗ Not configured',
                valueColor: auth.fingerprintConfigured ? colors.success : colors.error,
              },
            ]}
          />
        </Box>
      )}

      {/* OAuth token info (shown when OAuth) */}
      {auth.authType === 'oauth' && (
        <Box flexDirection="column" paddingX={2} marginTop={1}>
          <KeyValue
            labelWidth={20}
            items={[
              {
                label: 'Token status',
                value: auth.tokenExpired ? '✗ Expired (will auto-refresh)' : '✓ Valid',
                valueColor: auth.tokenExpired ? colors.warning : colors.success,
              },
              {
                label: 'Token expires',
                value: auth.tokenExpiresAt
                  ? new Date(auth.tokenExpiresAt).toLocaleString()
                  : '(unknown)',
                valueColor: colors.textDim,
              },
              {
                label: 'Scopes',
                value: auth.oauthScopes?.join(', ') || '(none)',
                valueColor: colors.text,
              },
            ]}
          />
        </Box>
      )}

      <Box marginTop={1}>
        <Divider width={60} />
      </Box>

      {/* Connection status */}
      <Box flexDirection="column" paddingX={2} marginTop={1}>
        <Box marginBottom={1}>
          <Text color={colors.textMuted}>Connection Test_</Text>
        </Box>
        
        {connection.status === 'pending' && (
          <Spinner label="Testing connection..." type="grid" />
        )}

        {connection.status === 'success' && (
          <Box flexDirection="column">
            <StatusBadge status="success" label="Authenticated" showDot />
            {connection.accountCount !== undefined && (
              <Box marginTop={1}>
                <Text color={colors.textMuted}>Trading accounts: </Text>
                <Text color={colors.text}>{connection.accountCount}</Text>
              </Box>
            )}
            {showVerbose && connection.accounts && connection.accounts.length > 0 && (
              <Box flexDirection="column" marginTop={1} paddingLeft={2}>
                {connection.accounts.map((acc, i) => (
                  <Text key={i} color={colors.textDim}>- {acc.id} ({acc.symbol})</Text>
                ))}
              </Box>
            )}
          </Box>
        )}

        {connection.status === 'error' && (
          <Box flexDirection="column">
            <StatusBadge status="error" label={connection.message || 'Connection failed'} showDot />
          </Box>
        )}

        {connection.status === 'skipped' && (
          <Text color={colors.textDim}>Skipped (no credentials)</Text>
        )}
      </Box>

      {/* Help text (only for non-OAuth users missing credentials) */}
      {auth.authType !== 'oauth' && (!auth.signingKeyConfigured || !auth.fingerprintConfigured) && (
        <Box flexDirection="column" paddingX={2} marginTop={1}>
          <Text color={colors.warning}>To configure credentials:</Text>
          <Box paddingLeft={2}>
            <Text color={colors.textDim}>
              grid auth login
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color={colors.warning}>Or manually with signing keys:</Text>
          </Box>
          <Box paddingLeft={2}>
            <Text color={colors.textDim}>
              grid profile set {'<name>'} --api-url {'<url>'} --signing-key {'<key>'} --fingerprint {'<fp>'}
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}

function getCredentialsSourceLabel(source?: 'environment' | 'profile' | 'none'): string {
  switch (source) {
    case 'environment':
      return 'Environment variables';
    case 'profile':
      return 'Profile';
    case 'none':
    default:
      return 'Not configured';
  }
}

function getAuthTypeLabel(authType?: 'signing_key' | 'oauth'): string {
  switch (authType) {
    case 'oauth':
      return 'OAuth (device flow)';
    case 'signing_key':
      return 'Ed25519 signing key';
    default:
      return 'Signing key (default)';
  }
}

export default AuthStatusView;
