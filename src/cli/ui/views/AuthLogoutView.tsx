import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import { Header, Spinner, StatusBadge } from '../components';
import { colors } from '../theme';
import { revokeToken } from '../../../sdk/auth/oauth-client';
import {
  getProfile,
  clearProfileOAuthTokens,
  deleteProfile,
} from '../../../core/config/profiles';

type LogoutState =
  | { phase: 'revoking' }
  | { phase: 'success'; message: string }
  | { phase: 'error'; message: string };

export interface AuthLogoutViewProps {
  profileName: string;
  deleteAfter: boolean;
}

export function AuthLogoutView({
  profileName,
  deleteAfter,
}: AuthLogoutViewProps): React.ReactElement {
  const { exit } = useApp();
  const [state, setState] = useState<LogoutState>({ phase: 'revoking' });

  useEffect(() => {
    (async () => {
      const profile = getProfile(profileName);

      if (!profile) {
        setState({ phase: 'error', message: `Profile '${profileName}' not found.` });
        setTimeout(() => exit(), 200);
        return;
      }

      if (profile.auth_type === 'oauth') {
        const baseUrl = profile.oauth_base_url || '';

        // Best-effort remote revocation
        if (baseUrl) {
          try {
            if (profile.access_token) {
              await revokeToken(baseUrl, profile.access_token);
            }
            if (profile.refresh_token) {
              await revokeToken(baseUrl, profile.refresh_token);
            }
          } catch {
            // Revocation failures are non-fatal
          }
        }

        if (deleteAfter) {
          deleteProfile(profileName);
          setState({ phase: 'success', message: `Profile '${profileName}' revoked and deleted.` });
        } else {
          clearProfileOAuthTokens(profileName);
          setState({ phase: 'success', message: `Logged out of profile '${profileName}'.` });
        }
      } else {
        // Signing-key profile: just clear credentials
        if (deleteAfter) {
          deleteProfile(profileName);
          setState({ phase: 'success', message: `Profile '${profileName}' deleted.` });
        } else {
          setState({ phase: 'error', message: `Profile '${profileName}' uses signing-key auth. Use 'grid profile delete ${profileName}' to remove it.` });
        }
      }

      setTimeout(() => exit(), 200);
    })();
  }, [profileName, deleteAfter, exit]);

  return (
    <Box flexDirection="column" paddingY={1}>
      <Header title="LOGOUT" showSeparator width={60} />

      {state.phase === 'revoking' && (
        <Box paddingX={2} marginTop={1}>
          <Spinner label="Revoking tokens..." type="grid" />
        </Box>
      )}

      {state.phase === 'success' && (
        <Box flexDirection="column" paddingX={2} marginTop={1}>
          <StatusBadge status="success" label={state.message} showDot />
        </Box>
      )}

      {state.phase === 'error' && (
        <Box flexDirection="column" paddingX={2} marginTop={1}>
          <StatusBadge status="error" label={state.message} showDot />
        </Box>
      )}
    </Box>
  );
}

export default AuthLogoutView;
