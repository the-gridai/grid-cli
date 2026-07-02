import React, { useEffect, useState } from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { ExchangeClient } from '../../../../sdk/exchange/client';
import { assertOAuthForExchangeKeys } from '../../keys/oauth-guard';
import { ActionFeedbackView, ActionStatus } from '../../../ui/views';

interface RevokeSigningKeyAppProps {
  id: string;
}

function RevokeSigningKeyApp({ id }: RevokeSigningKeyAppProps): React.ReactElement {
  const [status, setStatus] = useState<ActionStatus>('pending');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    (async () => {
      try {
        assertOAuthForExchangeKeys();
        await ExchangeClient.getInstance().revokeSigningKey(id);
        setStatus('success');
      } catch (e: any) {
        setError(e.message || String(e));
        setStatus('error');
      }
    })();
  }, [id]);

  if (status === 'pending') {
    return <ActionFeedbackView status="pending" title="Revoking signing key" message="Please wait…" />;
  }

  if (status === 'error') {
    return <ActionFeedbackView status="error" title="Revoke failed" error={error} />;
  }

  return (
    <ActionFeedbackView
      status="success"
      title="Signing key revoked"
      details={[{ label: 'ID', value: id }]}
    />
  );
}

export const revokeCommand = new Command('revoke')
  .description('Revoke a trading signing key by id')
  .argument('<id>', 'Signing key id')
  .action(async (id: string) => {
    const { waitUntilExit } = render(<RevokeSigningKeyApp id={id} />);
    await waitUntilExit();
  });
