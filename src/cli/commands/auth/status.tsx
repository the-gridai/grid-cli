import React, { useState, useEffect } from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { getConfig } from '../../../core/config/config';
import { 
  getActiveProfileName, 
  getActiveProfile, 
  getCredentialsPath,
  loadCredentialsFile 
} from '../../../core/config/profiles';
import { ApiClient } from '../../../sdk/http/client';
import { AuthStatusView, AuthStatusData, ConnectionStatus } from '../../ui/views';

interface AuthStatusAppProps {
  verbose: boolean;
}

function AuthStatusApp({ verbose }: AuthStatusAppProps): React.ReactElement {
  const [connection, setConnection] = useState<ConnectionStatus>({ status: 'pending' });
  
  // Gather auth data
  const credentialsPath = getCredentialsPath();
  const credentials = loadCredentialsFile();
  const profileName = getActiveProfileName();
  const profile = getActiveProfile();
  const config = getConfig();
  
  const hasEnvCredentials = !!(process.env.SIGNING_KEY || process.env.PRIVATE_KEY);
  const hasProfileCredentials = !!(profile?.signing_key || profile?.private_key);
  const isOAuth = profile?.auth_type === 'oauth';
  
  const signingKey = config.SIGNING_KEY || config.PRIVATE_KEY;
  const fingerprint = config.SIGNING_KEY_FINGERPRINT || config.API_KEY_FINGERPRINT;

  let tokenExpired = false;
  if (isOAuth && profile?.token_expires_at) {
    tokenExpired = new Date(profile.token_expires_at).getTime() < Date.now();
  }
  
  const authData: AuthStatusData = {
    credentialsFileFound: !!credentials,
    credentialsPath,
    activeProfile: profileName ?? undefined,
    credentialsFrom: isOAuth ? 'profile' : hasEnvCredentials ? 'environment' : hasProfileCredentials ? 'profile' : 'none',
    apiUrl: config.API_URL,
    signingKeyConfigured: !!signingKey,
    fingerprintConfigured: !!fingerprint,
    signingKeyMasked: signingKey ? `${signingKey.substring(0, 4)}...${signingKey.substring(signingKey.length - 4)}` : undefined,
    fingerprintMasked: fingerprint ? `${fingerprint.substring(0, 8)}...${fingerprint.substring(fingerprint.length - 4)}` : undefined,
    authType: (profile?.auth_type as 'signing_key' | 'oauth') || undefined,
    oauthScopes: profile?.oauth_scopes,
    tokenExpiresAt: profile?.token_expires_at,
    tokenExpired,
  };
  
  useEffect(() => {
    async function testConnection() {
      if (!isOAuth && (!signingKey || !fingerprint)) {
        setConnection({ status: 'skipped' });
        return;
      }
      
      try {
        const client = ApiClient.getInstance();
        const accounts = await client.getTradingAccounts();
        
        if (accounts && accounts.length > 0) {
          setConnection({
            status: 'success',
            accountCount: accounts.length,
            accounts: accounts.map((acc: any) => ({
              id: acc.account_id || acc.id,
              symbol: acc.instrument_symbol || 'unknown',
            })),
          });
        } else {
          setConnection({
            status: 'success',
            message: 'Authenticated (no accounts)',
            accountCount: 0,
          });
        }
      } catch (error: any) {
        if (error.response?.status === 401) {
          setConnection({
            status: 'error',
            message: 'Authentication failed - invalid credentials',
          });
        } else if (error.code === 'ECONNREFUSED') {
          setConnection({
            status: 'error',
            message: `Server unreachable at ${config.API_URL}`,
          });
        } else {
          setConnection({
            status: 'error',
            message: error.message,
          });
        }
      }
    }
    
    testConnection();
  }, [signingKey, fingerprint, config.API_URL, isOAuth]);
  
  return (
    <AuthStatusView
      auth={authData}
      connection={connection}
      showVerbose={verbose}
    />
  );
}

export const authStatusCommand = new Command('status')
  .description('Show current authentication status')
  .option('-v, --verbose', 'Show detailed information')
  .action(async (options: { verbose?: boolean }) => {
    const { waitUntilExit } = render(
      <AuthStatusApp verbose={!!options.verbose} />
    );
    
    await waitUntilExit();
  });
