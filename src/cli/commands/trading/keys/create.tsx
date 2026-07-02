import React, { useEffect, useState } from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { Box, Text } from 'ink';
import { ExchangeClient } from '../../../../sdk/exchange/client';
import { generateSigningKeyPair, calculateSigningKeyFingerprint } from '../../../../sdk/auth/keygen';
import { assertOAuthForExchangeKeys } from '../../keys/oauth-guard';
import { ActionFeedbackView, ActionStatus } from '../../../ui/views';
import { colors } from '../../../ui/theme';

interface CreateSigningKeyAppProps {
  label: string;
}

function CreateSigningKeyApp({ label }: CreateSigningKeyAppProps): React.ReactElement {
  const [status, setStatus] = useState<ActionStatus>('pending');
  const [details, setDetails] = useState<{ label: string; value: string }[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [signingKey, setSigningKey] = useState<string | undefined>();
  const [fingerprint, setFingerprint] = useState<string | undefined>();

  useEffect(() => {
    (async () => {
      try {
        assertOAuthForExchangeKeys();
        const { signingKey: secret, publicKey } = generateSigningKeyPair();
        const fp = calculateSigningKeyFingerprint(publicKey);
        const created = await ExchangeClient.getInstance().createSigningKey({
          label,
          public_key: publicKey,
        });
        setSigningKey(secret);
        setFingerprint(fp);
        setDetails([
          { label: 'Label', value: created.label || label },
          { label: 'ID', value: created.id || created.key_id || '' },
          { label: 'Fingerprint', value: created.fingerprint || fp },
        ]);
        setStatus('success');
      } catch (e: any) {
        setError(e.message || String(e));
        setStatus('error');
      }
    })();
  }, [label]);

  if (status === 'pending') {
    return <ActionFeedbackView status="pending" title="Creating signing key" message="Generating keypair…" />;
  }

  if (status === 'error') {
    return <ActionFeedbackView status="error" title="Create failed" error={error} />;
  }

  return (
    <Box flexDirection="column" paddingY={1}>
      <ActionFeedbackView
        status="success"
        title="Signing key created"
        details={details}
        message={'Save the signing key and fingerprint — shown once.\nThen: grid profile set <name> --signing-key … --fingerprint …'}
      />
      {signingKey && fingerprint && (
        <Box marginTop={1} paddingX={2} flexDirection="column">
          <Text color={colors.warning} bold>Signing key (base64 seed):</Text>
          <Text color={colors.accent}>{signingKey}</Text>
          <Text color={colors.warning} bold>Fingerprint:</Text>
          <Text color={colors.accent}>{fingerprint}</Text>
        </Box>
      )}
    </Box>
  );
}

export const createCommand = new Command('create')
  .description('Create a trading signing key (generates a new Ed25519 keypair)')
  .requiredOption('-l, --label <label>', 'Key label')
  .action(async (options: { label: string }) => {
    const { waitUntilExit } = render(<CreateSigningKeyApp label={options.label} />);
    await waitUntilExit();
  });
