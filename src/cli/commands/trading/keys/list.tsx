import React, { useEffect, useState } from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { Box, Text } from 'ink';
import { ExchangeClient } from '../../../../sdk/exchange/client';
import { assertOAuthForExchangeKeys } from '../../keys/oauth-guard';
import { colors } from '../../../ui/theme';
import { Header, Spinner } from '../../../ui/components';

function SigningKeysListView(): React.ReactElement {
  const [rows, setRows] = useState<{ id: string; label: string; fp?: string }[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        assertOAuthForExchangeKeys();
        const keys = await ExchangeClient.getInstance().listSigningKeys();
        setRows(
          keys.map((k) => ({
            id: k.id || k.key_id,
            label: k.label,
            fp: k.fingerprint,
          })),
        );
      } catch (e: any) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Box flexDirection="column" paddingY={1}>
      <Header title="TRADING SIGNING KEYS" showSeparator width={60} />
      {loading ? (
        <Spinner label="Loading signing keys..." type="grid" />
      ) : error ? (
        <Text color={colors.error}>{error}</Text>
      ) : rows.length === 0 ? (
        <Text color={colors.textMuted}>No signing keys. Create: grid trading keys create --label &lt;name&gt;</Text>
      ) : (
        rows.map((row) => (
          <Box key={row.id} flexDirection="column" marginBottom={1}>
            <Text color={colors.primary} bold>{row.label}</Text>
            <Text color={colors.textDim}>id={row.id}{row.fp ? ` fp=${row.fp.slice(0, 12)}…` : ''}</Text>
          </Box>
        ))
      )}
    </Box>
  );
}

export const listCommand = new Command('list')
  .description('List trading signing keys')
  .action(async () => {
    const { waitUntilExit } = render(<SigningKeysListView />);
    await waitUntilExit();
  });
