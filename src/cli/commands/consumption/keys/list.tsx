import React, { useEffect, useState } from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { Box, Text } from 'ink';
import { ExchangeClient } from '../../../../sdk/exchange/client';
import { assertOAuthForExchangeKeys } from '../../keys/oauth-guard';
import { colors } from '../../../ui/theme';
import { Header } from '../../../ui/components';

function KeysListView(): React.ReactElement {
  const [rows, setRows] = useState<{ id: string; name: string; prefix: string; active: boolean }[]>([]);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    (async () => {
      try {
        assertOAuthForExchangeKeys();
        const keys = await ExchangeClient.getInstance().listApiKeys();
        setRows(
          keys.map((k) => ({
            id: k.id,
            name: k.name,
            prefix: k.key_prefix,
            active: k.is_active,
          })),
        );
      } catch (e: any) {
        setError(e.message || String(e));
      }
    })();
  }, []);

  return (
    <Box flexDirection="column" paddingY={1}>
      <Header title="CONSUMPTION API KEYS" showSeparator width={60} />
      {error ? (
        <Text color={colors.error}>{error}</Text>
      ) : rows.length === 0 ? (
        <Text color={colors.textMuted}>No API keys. Create one: grid consumption keys create --name &lt;label&gt;</Text>
      ) : (
        rows.map((row) => (
          <Box key={row.id} flexDirection="column" marginBottom={1}>
            <Text>
              <Text color={colors.primary} bold>{row.name}</Text>
              <Text color={colors.textMuted}> ({row.prefix}…)</Text>
            </Text>
            <Text color={colors.textDim}>
              id={row.id} active={String(row.active)}
            </Text>
          </Box>
        ))
      )}
    </Box>
  );
}

export const listCommand = new Command('list')
  .description('List consumption API keys')
  .action(async () => {
    const { waitUntilExit } = render(<KeysListView />);
    await waitUntilExit();
  });
