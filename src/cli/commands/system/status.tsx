import React from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { getConfig } from '../../../core/config/config';
import { getActiveProfileName } from '../../../core/config/profiles';
import { ApiClient } from '../../../sdk/http/client';
import { StatusView } from '../../ui/views/StatusView';

export const statusCommand = new Command('status')
  .description('Show system status and configuration')
  .action(async () => {
    const config = getConfig();
    const profileName = getActiveProfileName() ?? 'default';

    const client = ApiClient.getInstance();
    const pingTimeoutMs = Math.min(Math.max(config.SDK_REQUEST_TIMEOUT, 1000), 8000);

    const apiStatus = await client.pingTradingApi({ timeoutMs: pingTimeoutMs });

    const { waitUntilExit } = render(
      <StatusView
        apiUrl={config.API_URL}
        wsUrl={config.WS_URL}
        dbHost={config.DB_HOST}
        profile={profileName}
        apiStatus={apiStatus}
      />
    );

    await waitUntilExit();
  });

