import React, { useEffect, useState } from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { ExchangeClient } from '../../../../sdk/exchange/client';
import { assertOAuthForExchangeKeys } from '../../keys/oauth-guard';
import { ActionFeedbackView, ActionStatus } from '../../../ui/views';

interface RevokeKeysAppProps {
  id: string;
}

function RevokeKeysApp({ id }: RevokeKeysAppProps): React.ReactElement {
  const [status, setStatus] = useState<ActionStatus>('pending');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    (async () => {
      try {
        assertOAuthForExchangeKeys();
        await ExchangeClient.getInstance().revokeApiKey(id);
        setStatus('success');
      } catch (e: any) {
        setError(e.message || String(e));
        setStatus('error');
      }
    })();
  }, [id]);

  if (status === 'pending') {
    return <ActionFeedbackView status="pending" title="Revoking API key" message="Please wait…" />;
  }

  if (status === 'error') {
    return <ActionFeedbackView status="error" title="Revoke failed" error={error} />;
  }

  return (
    <ActionFeedbackView
      status="success"
      title="API key revoked"
      details={[{ label: 'ID', value: id }]}
    />
  );
}

export const revokeCommand = new Command('revoke')
  .description('Revoke a consumption API key by id')
  .argument('<id>', 'API key id')
  .action(async (id: string) => {
    const { waitUntilExit } = render(<RevokeKeysApp id={id} />);
    await waitUntilExit();
  });
