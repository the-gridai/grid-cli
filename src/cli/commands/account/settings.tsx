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
          <Text>auto_transfer_enabled: {String(settings.auto_transfer_enabled)} <Text color={colors.textMuted}>(derived from account_mode)</Text></Text>
          <Text>auto_buy_enabled: {String(settings.auto_buy_enabled ?? settings.auto_top_up_enabled)}</Text>
          <Text>auto_buy_quantity: {settings.auto_buy_quantity ?? '— (default 1)'}</Text>
          <Text>auto_buy_trigger_threshold: {settings.auto_buy_trigger_threshold ?? '— (default 1)'}</Text>
          <Text>auto_reload_enabled: {String(settings.auto_reload_enabled)}</Text>
          <Text>auto_reload_threshold_usd: {settings.auto_reload_threshold_usd ?? '—'}</Text>
          <Text>auto_reload_amount_usd: {settings.auto_reload_amount_usd ?? '—'}</Text>
          <Text>auto_reload_monthly_limit_usd: {settings.auto_reload_monthly_limit_usd ?? '—'}</Text>
          {settings.mode_managed_fields && settings.mode_managed_fields.length > 0 && (
            <Text color={colors.textMuted}>
              mode_managed_fields: {settings.mode_managed_fields.join(', ')}
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
}

function AutoBuyPatchApp({ enabled }: { enabled: boolean }): React.ReactElement {
  const [status, setStatus] = useState<ActionStatus>('pending');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    (async () => {
      try {
        assertOAuthForExchangeKeys();
        await ExchangeClient.getInstance().patchAutoBuy(enabled);
        setStatus('success');
      } catch (e: any) {
        setError(e.message || String(e));
        setStatus('error');
      }
    })();
  }, [enabled]);

  if (status === 'pending') {
    return <ActionFeedbackView status="pending" title="Update auto-buy" message="Please wait…" />;
  }
  if (status === 'error') {
    return <ActionFeedbackView status="error" title="Update auto-buy" error={error} />;
  }
  return (
    <ActionFeedbackView
      status="success"
      title="Auto-buy updated"
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
  action: 'mode-easy' | 'mode-advanced';
}): React.ReactElement {
  const [status, setStatus] = useState<ActionStatus>('pending');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    (async () => {
      try {
        assertOAuthForExchangeKeys();
        const client = ExchangeClient.getInstance();
        if (action === 'mode-easy') {
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
  .command('auto-buy')
  .alias('auto-top-up')
  .description('Enable or disable auto-buy (formerly auto top-up)')
  .requiredOption('--enabled <bool>', 'auto_buy_enabled (true/false)', (v) => v === 'true')
  .action(async (options: { enabled: boolean }) => {
    const { waitUntilExit } = render(<AutoBuyPatchApp enabled={options.enabled} />);
    await waitUntilExit();
  });

settingsCommand
  .command('auto-transfer')
  .description('Removed — auto-transfer is derived from account mode')
  // The old flags stay declared so existing scripts get the explanation below
  // rather than a commander parse error.
  .option('--enabled <bool>', '(removed)')
  .option('--default', '(removed)')
  .allowUnknownOption()
  .allowExcessArguments()
  .action(() => {
    console.error(
      'Auto-transfer is no longer an account setting.\n\n' +
        '  Account-wide: it follows account mode — easy mode transfers buys to\n' +
        '  consumption, advanced mode does not. Use:\n' +
        '      grid account settings mode --easy\n' +
        '      grid account settings mode --advanced\n\n' +
        '  Per order (advanced mode): opt in on individual buys with\n' +
        '      grid order create --auto-transfer ...\n',
    );
    process.exitCode = 1;
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
