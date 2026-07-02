import React from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { getCredentialsPath } from '../../../core/config/profiles';
import { AuthLoginView } from '../../ui/views';
import { DeviceAuthLoginView } from '../../ui/views/DeviceAuthLoginView';
import { GRID_CLI_CLIENT_ID, DEFAULT_SCOPES } from '../../../sdk/auth/oauth-client';

const DEFAULT_EXCHANGE_URL = process.env.GRID_EXCHANGE_URL || 'https://trading.api.thegrid.ai';
const DEFAULT_API_URL = process.env.API_URL || 'https://trading.api.thegrid.ai/v1';

export const authLoginCommand = new Command('login')
  .description('Authenticate with the Grid exchange via browser device flow')
  .option('--legacy', 'Show manual credential setup instructions instead')
  .option('-p, --profile <name>', 'Profile to save credentials to', 'default')
  .option('--scopes <scopes>', 'Space-separated OAuth scopes to request')
  .option('--hostname <url>', 'Exchange API base URL (for OAuth)', DEFAULT_EXCHANGE_URL)
  .option('--api-url <url>', 'Trading API base URL (for commands)', DEFAULT_API_URL)
  .option('--no-use', 'Do not set the profile as current after login')
  .option('--email <email>', 'Expected account email (warns if the authorized user differs)')
  .action(async (options: {
    legacy?: boolean;
    profile: string;
    scopes?: string;
    hostname: string;
    apiUrl: string;
    use: boolean;
    email?: string;
  }) => {
    if (options.legacy) {
      const credentialsPath = getCredentialsPath();
      const { waitUntilExit } = render(
        <AuthLoginView credentialsPath={credentialsPath} />
      );
      await waitUntilExit();
      return;
    }

    const scopes = options.scopes
      ? options.scopes.split(/[\s,]+/).filter(Boolean)
      : DEFAULT_SCOPES;

    const { waitUntilExit } = render(
      <DeviceAuthLoginView
        baseUrl={options.hostname}
        apiUrl={options.apiUrl}
        profileName={options.profile}
        scopes={scopes}
        clientId={GRID_CLI_CLIENT_ID}
        setAsCurrent={options.use}
        expectedEmail={options.email}
      />
    );

    await waitUntilExit();
  });
