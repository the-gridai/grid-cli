import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useApp } from 'ink';
import { Header, Divider, Spinner, StatusBadge } from '../components';
import { colors } from '../theme';
import {
  requestDeviceCode,
  pollForToken,
  GRID_CLI_CLIENT_ID,
  DEFAULT_SCOPES,
  type DeviceCodeResponse,
  type PollResult,
} from '../../../sdk/auth/oauth-client';
import { setProfile, setCurrentProfile, getProfile, type Profile } from '../../../core/config/profiles';
import { resetConfig } from '../../../core/config/config';
import { ApiClient } from '../../../sdk/http/client';
import { ExchangeClient } from '../../../sdk/exchange/client';

type FlowState =
  | { phase: 'initiating' }
  | { phase: 'waiting'; device: DeviceCodeResponse }
  | { phase: 'polling'; device: DeviceCodeResponse }
  | { phase: 'success'; profileName: string; scopes: string; email?: string; emailMismatch?: string; hints: string[] }
  | { phase: 'error'; message: string };

export interface DeviceAuthLoginViewProps {
  baseUrl: string;
  apiUrl: string;
  profileName: string;
  scopes: string[];
  clientId: string;
  setAsCurrent: boolean;
  expectedEmail?: string;
}

export function DeviceAuthLoginView({
  baseUrl,
  apiUrl,
  profileName,
  scopes,
  clientId,
  setAsCurrent,
  expectedEmail,
}: DeviceAuthLoginViewProps): React.ReactElement {
  const { exit } = useApp();
  const [state, setState] = useState<FlowState>({ phase: 'initiating' });

  const runFlow = useCallback(async () => {
    try {
      const device = await requestDeviceCode(baseUrl, clientId, scopes);
      setState({ phase: 'waiting', device });

      // Attempt to open the browser
      const verificationUrl = `${device.verification_uri}?user_code=${device.user_code}`;
      try {
        const { exec } = await import('child_process');
        const cmd = process.platform === 'darwin'
          ? `open "${verificationUrl}"`
          : `xdg-open "${verificationUrl}" 2>/dev/null || echo "open-failed"`;
        exec(cmd);
      } catch {
        // Browser open is best-effort
      }

      setState({ phase: 'polling', device });

      const result: PollResult = await pollForToken(
        baseUrl,
        clientId,
        device.device_code,
        device.interval,
        device.expires_in,
      );

      if (result.status === 'success') {
        const { tokens } = result;
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

        // Merge OAuth fields into existing profile to preserve other settings
        const existing = getProfile(profileName) || {};
        const profile: Profile = {
          ...existing,
          auth_type: 'oauth',
          api_url: existing.api_url || apiUrl,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt,
          oauth_scopes: tokens.scope.split(' ').filter(Boolean),
          oauth_client_id: clientId,
          oauth_base_url: baseUrl,
        };

        setProfile(profileName, profile);
        if (setAsCurrent) {
          setCurrentProfile(profileName);
        }

        resetConfig();
        ApiClient.resetInstances();
        ExchangeClient.resetInstances();

        let authorizedEmail: string | undefined;
        let emailMismatch: string | undefined;
        try {
          const me = await ApiClient.getInstance().getMe();
          authorizedEmail = me.email || me.user?.email;
          if (
            expectedEmail &&
            authorizedEmail &&
            authorizedEmail.toLowerCase() !== expectedEmail.toLowerCase()
          ) {
            emailMismatch = `Expected ${expectedEmail} but authorized ${authorizedEmail}`;
          }
        } catch {
          // Non-fatal: trading /me may be unavailable in some dev setups
        }

        const hints = [
          'grid auth status',
          'grid consumption keys list',
          'grid trading keys create --label my-bot',
          'grid account settings',
        ];

        setState({
          phase: 'success',
          profileName,
          scopes: tokens.scope,
          email: authorizedEmail,
          emailMismatch,
          hints,
        });
      } else if (result.status === 'denied') {
        setState({ phase: 'error', message: 'Authorization was denied by the user.' });
      } else if (result.status === 'expired') {
        setState({ phase: 'error', message: 'Device code expired. Please try again.' });
      } else {
        setState({ phase: 'error', message: result.message });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error_description || err?.message || String(err);
      setState({ phase: 'error', message: msg });
    }
  }, [baseUrl, apiUrl, clientId, scopes, profileName, setAsCurrent, expectedEmail]);

  useEffect(() => {
    runFlow().then(() => {
      setTimeout(() => exit(), 200);
    });
  }, [runFlow, exit]);

  return (
    <Box flexDirection="column" paddingY={1}>
      <Header title="DEVICE LOGIN" showSeparator width={60} />

      {state.phase === 'initiating' && (
        <Box paddingX={2} marginTop={1}>
          <Spinner label="Requesting device code..." type="grid" />
        </Box>
      )}

      {(state.phase === 'waiting' || state.phase === 'polling') && (
        <Box flexDirection="column" paddingX={2} marginTop={1}>
          <Box marginBottom={1}>
            <Text color={colors.textMuted}>A browser window should open. If not, visit:</Text>
          </Box>
          <Box paddingLeft={2} marginBottom={1}>
            <Text color={colors.accent} bold>
              {state.device.verification_uri}
            </Text>
          </Box>
          <Box marginBottom={1}>
            <Text color={colors.textMuted}>and enter the code:</Text>
          </Box>
          <Box paddingLeft={2} marginBottom={1}>
            <Text color={colors.primary} bold>
              {'  '}
              {state.device.user_code}
              {'  '}
            </Text>
          </Box>
          <Divider width={60} />
          <Box marginTop={1}>
            <Spinner label="Waiting for authorization in browser..." type="grid" />
          </Box>
        </Box>
      )}

      {state.phase === 'success' && (
        <Box flexDirection="column" paddingX={2} marginTop={1}>
          <StatusBadge status="success" label="Logged in successfully" showDot />
          <Box marginTop={1} flexDirection="column">
            <Text>
              <Text color={colors.textMuted}>Profile: </Text>
              <Text color={colors.primary} bold>{state.profileName}</Text>
            </Text>
            <Text>
              <Text color={colors.textMuted}>Scopes:  </Text>
              <Text color={colors.text}>{state.scopes}</Text>
            </Text>
            {state.email && (
              <Text>
                <Text color={colors.textMuted}>Email:   </Text>
                <Text color={colors.text}>{state.email}</Text>
              </Text>
            )}
            {state.emailMismatch && (
              <Box marginTop={1}>
                <Text color={colors.warning}>{state.emailMismatch}</Text>
              </Box>
            )}
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Text color={colors.textMuted}>Next steps:</Text>
            {state.hints.map((hint) => (
              <Text key={hint} color={colors.textDim}>
                {'  '}
                <Text color={colors.success}>{hint}</Text>
              </Text>
            ))}
          </Box>
        </Box>
      )}

      {state.phase === 'error' && (
        <Box flexDirection="column" paddingX={2} marginTop={1}>
          <StatusBadge status="error" label="Login failed" showDot />
          <Box marginTop={1}>
            <Text color={colors.error}>{state.message}</Text>
          </Box>
          <Box marginTop={1}>
            <Text color={colors.textDim}>
              Try again with: <Text color={colors.accent}>grid auth login</Text>
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}

export default DeviceAuthLoginView;
