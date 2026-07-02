import React, { useEffect, useState } from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { Box, Text } from 'ink';
import { ExchangeClient } from '../../../sdk/exchange/client';
import type { ExchangeSystemSettings } from '../../../sdk/exchange/client';
import { assertOAuthForExchangeKeys } from '../keys/oauth-guard';
import { ActionFeedbackView, ActionStatus } from '../../ui/views';
import { colors } from '../../ui/theme';
import { Header } from '../../ui/components';

function SettingsShowView(): React.ReactElement {
  const [settings, setSettings] = useState<ExchangeSystemSettings | null>(null);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    (async () => {
      try {
        assertOAuthForExchangeKeys();
        const data = await ExchangeClient.getInstance().getSystemSettings();
        setSettings(data);
      } catch (e: any) {
        setError(e.message || String(e));
      }
    })();
  }, []);

  return (
    <Box flexDirection="column" paddingY={1}>
      <Header title="ACCOUNT SETTINGS" showSeparator width={60} />
      {error && <Text color={colors.error}>{error}</Text>}
      {settings && (
        <Box flexDirection="column" paddingX={2}>
          <Text>account_mode: <Text color={colors.primary}>{settings.account_mode}</Text></Text>
          <Text>auto_transfer_enabled: {String(settings.auto_transfer_enabled)}</Text>
          <Text>auto_top_up_enabled: {String(settings.auto_top_up_enabled)}</Text>
          <Text>auto_reload_enabled: {String(settings.auto_reload_enabled)}</Text>
          <Text>auto_reload_threshold_usd: {settings.auto_reload_threshold_usd ?? '—'}</Text>
          <Text>auto_reload_amount_usd: {settings.auto_reload_amount_usd ?? '—'}</Text>
          <Text>auto_reload_monthly_limit_usd: {settings.auto_reload_monthly_limit_usd ?? '—'}</Text>
        </Box>
      )}
    </Box>
  );
}

function AutoTransferPatchApp({
  attrs,
}: {
  attrs: { auto_transfer_enabled?: boolean; auto_transfer_override?: boolean | null };
}): React.ReactElement {
  const [status, setStatus] = useState<ActionStatus>('pending');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    (async () => {
      try {
        assertOAuthForExchangeKeys();
        await ExchangeClient.getInstance().patchAutoTransfer(attrs);
        setStatus('success');
      } catch (e: any) {
        setError(e.message || String(e));
        setStatus('error');
      }
    })();
  }, [attrs]);

  if (status === 'pending') {
    return <ActionFeedbackView status="pending" title="Update auto-transfer" message="Please wait…" />;
  }
  if (status === 'error') {
    return <ActionFeedbackView status="error" title="Update auto-transfer" error={error} />;
  }
  return (
    <ActionFeedbackView
      status="success"
      title="Auto-transfer updated"
      message="Run `grid account settings` to view."
    />
  );
}

function AutoReloadPatchApp({ attrs }: { attrs: Record<string, boolean | string> }): React.ReactElement {
  const [status, setStatus] = useState<ActionStatus>('pending');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    (async () => {
      try {
        assertOAuthForExchangeKeys();
        await ExchangeClient.getInstance().patchAutoReload(attrs);
        setStatus('success');
      } catch (e: any) {
        setError(e.message || String(e));
        setStatus('error');
      }
    })();
  }, [attrs]);

  if (status === 'pending') {
    return <ActionFeedbackView status="pending" title="Update auto-reload" message="Please wait…" />;
  }
  if (status === 'error') {
    return <ActionFeedbackView status="error" title="Update auto-reload" error={error} />;
  }
  return (
    <ActionFeedbackView
      status="success"
      title="Auto-reload updated"
      message="Run `grid account settings` to view."
    />
  );
}

function SettingsActionApp({
  title,
  action,
}: {
  title: string;
  action: 'toggle-auto-top-up' | 'mode-easy' | 'mode-advanced';
}): React.ReactElement {
  const [status, setStatus] = useState<ActionStatus>('pending');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    (async () => {
      try {
        assertOAuthForExchangeKeys();
        const client = ExchangeClient.getInstance();
        if (action === 'toggle-auto-top-up') {
          await client.toggleAutoTopUp();
        } else if (action === 'mode-easy') {
          await client.switchAccountMode('easy');
        } else if (action === 'mode-advanced') {
          await client.switchAccountMode('advanced');
        }
        setStatus('success');
      } catch (e: any) {
        setError(e.message || String(e));
        setStatus('error');
      }
    })();
  }, [action]);

  if (status === 'pending') {
    return <ActionFeedbackView status="pending" title={title} message="Please wait…" />;
  }
  if (status === 'error') {
    return <ActionFeedbackView status="error" title={title} error={error} />;
  }
  return <ActionFeedbackView status="success" title={title} message="Done. Run `grid account settings` to view." />;
}

export const settingsCommand = new Command('settings')
  .description('View or update Exchange account settings (OAuth)');

settingsCommand
  .command('show')
  .description('Show current system settings')
  .action(async () => {
    const { waitUntilExit } = render(<SettingsShowView />);
    await waitUntilExit();
  });

settingsCommand
  .command('mode')
  .description('Switch account mode (pass --easy or --advanced)')
  .option('--easy', 'Switch to easy mode')
  .option('--advanced', 'Switch to advanced mode')
  .action(async (options: { easy?: boolean; advanced?: boolean }) => {
    const mode = options.easy ? 'easy' : options.advanced ? 'advanced' : undefined;
    if (!mode) {
      throw new Error('Specify exactly one of --easy or --advanced');
    }
    const { waitUntilExit } = render(
      <SettingsActionApp
        title={`Switch to ${mode} mode`}
        action={mode === 'easy' ? 'mode-easy' : 'mode-advanced'}
      />,
    );
    await waitUntilExit();
  });

settingsCommand
  .command('auto-top-up')
  .description('Toggle auto top-up')
  .action(async () => {
    const { waitUntilExit } = render(
      <SettingsActionApp title="Toggle auto top-up" action="toggle-auto-top-up" />,
    );
    await waitUntilExit();
  });

settingsCommand
  .command('auto-transfer')
  .description('Patch auto-transfer override (advanced mode only to disable)')
  .option('--enabled <bool>', 'auto_transfer_enabled (true/false)', (v) => v === 'true')
  .option('--default', 'reset to system default (clears override)')
  .action(async (options: { enabled?: boolean; default?: boolean }) => {
    if (options.default && options.enabled !== undefined) {
      throw new Error('Use only one of --default or --enabled');
    }
    if (!options.default && options.enabled === undefined) {
      throw new Error('Specify --enabled <true|false> or --default');
    }
    const attrs: { auto_transfer_enabled?: boolean; auto_transfer_override?: boolean | null } =
      options.default
        ? { auto_transfer_override: null }
        : { auto_transfer_enabled: options.enabled! };

    const { waitUntilExit } = render(<AutoTransferPatchApp attrs={attrs} />);
    await waitUntilExit();
  });

settingsCommand
  .command('auto-reload')
  .description('Patch auto-reload USD settings')
  .option('--enabled <bool>', 'auto_reload_enabled', (v) => v === 'true')
  .option('--threshold <usd>', 'auto_reload_threshold_usd')
  .option('--amount <usd>', 'auto_reload_amount_usd')
  .option('--monthly-limit <usd>', 'auto_reload_monthly_limit_usd')
  .action(async (options: {
    enabled?: boolean;
    threshold?: string;
    amount?: string;
    monthlyLimit?: string;
  }) => {
    const attrs: Record<string, boolean | string> = {};
    if (options.enabled !== undefined) attrs.auto_reload_enabled = options.enabled;
    if (options.threshold) attrs.auto_reload_threshold_usd = options.threshold;
    if (options.amount) attrs.auto_reload_amount_usd = options.amount;
    if (options.monthlyLimit) attrs.auto_reload_monthly_limit_usd = options.monthlyLimit;

    const { waitUntilExit } = render(<AutoReloadPatchApp attrs={attrs} />);
    await waitUntilExit();
  });

// Default action: show settings
settingsCommand.action(async () => {
  const { waitUntilExit } = render(<SettingsShowView />);
  await waitUntilExit();
});
