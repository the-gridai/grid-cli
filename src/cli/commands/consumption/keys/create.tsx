import React, { useEffect, useState } from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { Box, Text } from 'ink';
import { ExchangeClient } from '../../../../sdk/exchange/client';
import { assertOAuthForExchangeKeys } from '../../keys/oauth-guard';
import { ActionFeedbackView, ActionStatus } from '../../../ui/views';
import { colors } from '../../../ui/theme';

interface CreateKeysAppProps {
  name: string;
  expiresAt?: string;
}

function CreateKeysApp({ name, expiresAt }: CreateKeysAppProps): React.ReactElement {
  const [status, setStatus] = useState<ActionStatus>('pending');
  const [details, setDetails] = useState<{ label: string; value: string }[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [secret, setSecret] = useState<string | undefined>();

  useEffect(() => {
    (async () => {
      try {
        assertOAuthForExchangeKeys();
        const created = await ExchangeClient.getInstance().createApiKey(name, expiresAt);
        setDetails([
          { label: 'Name', value: created.name },
          { label: 'ID', value: created.id },
          { label: 'Prefix', value: created.key_prefix },
        ]);
        if (created.key) {
          setSecret(created.key);
        }
        setStatus('success');
      } catch (e: any) {
        setError(e.message || String(e));
        setStatus('error');
      }
    })();
  }, [name, expiresAt]);

  if (status === 'pending') {
    return <ActionFeedbackView status="pending" title="Creating API key" message="Please wait…" />;
  }

  if (status === 'error') {
    return (
      <ActionFeedbackView
        status="error"
        title="Create failed"
        error={error}
        message="Run `grid auth login` if OAuth is missing or expired."
      />
    );
  }

  return (
    <Box flexDirection="column" paddingY={1}>
      <ActionFeedbackView
        status="success"
        title="API key created"
        details={details}
        message={
          secret
            ? 'Store the secret now — it will not be shown again.\nSet CONSUMPTION_API_URL + Bearer in your env or profile.'
            : undefined
        }
      />
      {secret && (
        <Box marginTop={1} paddingX={2} flexDirection="column">
          <Text color={colors.warning} bold>Secret (copy now):</Text>
          <Text color={colors.accent}>{secret}</Text>
        </Box>
      )}
    </Box>
  );
}

export const createCommand = new Command('create')
  .description('Create a consumption API key')
  .requiredOption('-n, --name <name>', 'Key label')
  .option('--expires-at <iso>', 'Optional expiration (ISO8601)')
  .action(async (options: { name: string; expiresAt?: string }) => {
    const { waitUntilExit } = render(
      <CreateKeysApp name={options.name} expiresAt={options.expiresAt} />,
    );
    await waitUntilExit();
  });
