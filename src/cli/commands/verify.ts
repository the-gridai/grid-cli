import { Command } from 'commander';
import chalk from 'chalk';
import { getConfig } from '../../core/config/config';
import { getActiveProfileName } from '../../core/config/profiles';
import { ApiClient } from '../../sdk/http/client';

type CheckState = 'ok' | 'warn' | 'fail';

interface CheckResult {
  state: CheckState;
  label: string;
  detail: string;
}

interface VerifyOptions {
  timeout?: string;
}

export const verifyCommand = new Command('verify')
  .description('Verify Trading API connectivity, credentials, mode, balances, and market metadata')
  .option('--timeout <ms>', 'Per-check timeout in milliseconds', '5000')
  .action(async (options: VerifyOptions) => {
    const timeoutMs = parseTimeout(options.timeout);
    const config = getConfig();
    const profile = getActiveProfileName() ?? 'default';
    const client = ApiClient.getInstance();
    const checks: CheckResult[] = [];

    console.log(chalk.bold('Trading API verifier'));
    console.log(`Profile: ${profile}`);
    console.log(`Trading API: ${config.API_URL}`);
    console.log('');

    const health = await client.checkTradingHealth({ timeoutMs });
    if (health.state === 'ok') {
      checks.push({
        state: 'ok',
        label: 'Trading listener',
        detail: `GET /v1/health returned ok${health.service ? ` (${health.service})` : ''}`,
      });
    } else {
      checks.push({
        state: 'fail',
        label: 'Trading listener',
        detail: `GET /v1/health failed: ${health.message}. Start the Trading API or fix GRID_TRADING_API_URL/API_URL.`,
      });
      printChecks(checks);
      process.exitCode = 1;
      return;
    }

    try {
      const me = await client.getMe();
      const mode = String(me.account_mode ?? 'unknown');
      const capabilities = Array.isArray(me.capabilities) ? me.capabilities.join(', ') : 'unknown';

      checks.push({
        state: 'ok',
        label: 'Credentials',
        detail: `signed GET /v1/me succeeded for ${me.email ?? me.user_id ?? 'current user'}; capabilities: ${capabilities}`,
      });

      if (mode === 'easy') {
        checks.push({
          state: 'warn',
          label: 'Account mode',
          detail:
            'Account is in Auto/Easy mode. Reads work, but order create/update/cancel returns auto_mode_trading_restricted after onboarding. Switch to Advanced mode in the app before trading manually.',
        });
      } else if (mode === 'advanced') {
        checks.push({
          state: 'ok',
          label: 'Account mode',
          detail: 'Account is in Advanced mode; manual order mutations are allowed if balances and permissions permit.',
        });
      } else {
        checks.push({
          state: 'warn',
          label: 'Account mode',
          detail: `Could not determine account mode from /v1/me (value: ${mode}).`,
        });
      }
    } catch (error) {
      checks.push({
        state: 'fail',
        label: 'Credentials',
        detail: `${errorSummary(error)}. Run grid auth login and grid trading keys create, then retry.`,
      });
      printChecks(checks);
      process.exitCode = 1;
      return;
    }

    try {
      const accounts = await client.getTradingAccounts();
      const usd = accounts.find((account: any) => String(account.currency ?? '').toUpperCase() === 'USD');
      const instrumentAccounts = accounts.filter((account: any) => account.instrument_id);
      const usdDetail = usd ? `; USD available: ${usd.available_balance ?? 'unknown'}` : '; no USD account found';

      checks.push({
        state: usd ? 'ok' : 'warn',
        label: 'Trading accounts',
        detail: `${accounts.length} account row(s), ${instrumentAccounts.length} instrument account(s)${usdDetail}`,
      });
    } catch (error) {
      checks.push({
        state: 'fail',
        label: 'Trading accounts',
        detail: `${errorSummary(error)}. Signed GET /v1/trading-accounts must pass before placing orders.`,
      });
    }

    try {
      const markets = await client.getMarkets();
      const activeMarkets = markets.filter((market: any) => String(market.status ?? '').toLowerCase() === 'active');
      const controls = markets.filter((market: any) => market.order_controls || market.controls);

      checks.push({
        state: activeMarkets.length > 0 ? 'ok' : 'warn',
        label: 'Markets',
        detail: `${markets.length} market(s), ${activeMarkets.length} active; ${controls.length} expose order controls for tick/lot/min/max sizing.`,
      });
    } catch (error) {
      checks.push({
        state: 'fail',
        label: 'Markets',
        detail: `${errorSummary(error)}. Fetch /v1/markets before creating orders so tick_size, lot_size, and min_order_size are known.`,
      });
    }

    printChecks(checks);
    console.log('');
    console.log(
      chalk.gray(
        'No orders were placed. Use a tiny cancellable probe order only after these checks pass and you intentionally confirm live trading.'
      )
    );

    if (checks.some((check) => check.state === 'fail')) {
      process.exitCode = 1;
    }
  });

function parseTimeout(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return 5000;
}

function printChecks(checks: CheckResult[]): void {
  for (const check of checks) {
    console.log(`${prefix(check.state)} ${check.label}: ${check.detail}`);
  }
}

function prefix(state: CheckState): string {
  switch (state) {
    case 'ok':
      return chalk.green('[ok]');
    case 'warn':
      return chalk.yellow('[warn]');
    case 'fail':
      return chalk.red('[fail]');
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

function errorSummary(error: unknown): string {
  const err = error as { response?: { status?: number; data?: any }; message?: string; code?: string };
  const status = err.response?.status;
  const detail = err.response?.data?.errors?.detail ?? err.response?.data?.error?.message;

  if (status && detail) {
    return `HTTP ${status}: ${detail}`;
  }

  if (status) {
    return `HTTP ${status}`;
  }

  if (err.code) {
    return `${err.code}: ${err.message ?? 'request failed'}`;
  }

  return err.message ?? 'request failed';
}
