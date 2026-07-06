import axios, { AxiosError } from 'axios';
import chalk from 'chalk';
import { Command } from 'commander';
import { getConfig, type Config } from '../../core/config/config';
import { getActiveProfileName } from '../../core/config/profiles';
import { ApiError } from '../../core/errors';
import { ApiClient } from '../../sdk/http/client';
import { ResponsesClient } from '../../sdk/responses/client';
import { OAuthSession, oauthSessionFromConfig, resolveExchangeBaseUrl } from '../../sdk/auth/oauth-session';
import { resolveConsumptionBearerToken } from '../../sdk/auth/bearer';
import type { DiagnosticCheck, DiagnosticsData, DiagnosticStatus } from '../../sdk/types/diagnostics';

type Surface = 'local' | 'platform' | 'trading' | 'consumption';
type SurfaceFilter = 'all' | Surface;

interface SurfaceResult {
  surface: Surface;
  status: DiagnosticStatus;
  summary: string;
  checks: DiagnosticCheck[];
  raw?: DiagnosticsData;
}

interface DiagnosticsOptions {
  surface?: SurfaceFilter;
  json?: boolean;
  timeout?: string;
  localOnly?: boolean;
}

const surfaceOrder: Surface[] = ['local', 'platform', 'trading', 'consumption'];

export const diagnosticsCommand = new Command('diagnostics')
  .alias('doctor')
  .description('Run safe read-only diagnostics for local config and Grid API auth paths')
  .option('--surface <surface>', 'Surface to check: all, local, platform, trading, consumption', 'all')
  .option('--json', 'Print machine-readable JSON')
  .option('--timeout <ms>', 'Per-request timeout in milliseconds', '8000')
  .option('--local-only', 'Only check local CLI configuration')
  .action(async (options: DiagnosticsOptions) => {
    const config = getConfig();
    const surface = normalizeSurface(options.surface);
    const timeoutMs = parseTimeout(options.timeout);
    const results: SurfaceResult[] = [];

    results.push(runLocalDiagnostics(config));

    if (!options.localOnly) {
      if (surfaceMatches(surface, 'platform')) {
        results.push(await runPlatformDiagnostics(config, timeoutMs));
      }
      if (surfaceMatches(surface, 'trading')) {
        results.push(await runTradingDiagnostics(timeoutMs));
      }
      if (surfaceMatches(surface, 'consumption')) {
        results.push(await runConsumptionDiagnostics(config, timeoutMs));
      }
    }

    const filtered = filterResults(results, surface, options.localOnly);
    if (options.json) {
      console.log(JSON.stringify(formatDiagnosticsJson(filtered), null, 2));
      return;
    }

    printHumanResults(filtered);
  });

function normalizeSurface(surface: SurfaceFilter | undefined): SurfaceFilter {
  const value = (surface || 'all').toLowerCase() as SurfaceFilter;
  if (value === 'all' || surfaceOrder.includes(value as Surface)) {
    return value;
  }
  throw new Error(`Unknown diagnostics surface: ${surface}. Expected all, local, platform, trading, or consumption.`);
}

function parseTimeout(raw: string | undefined): number {
  const timeout = Number(raw || 8000);
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new Error('--timeout must be a positive number of milliseconds');
  }
  return timeout;
}

function surfaceMatches(filter: SurfaceFilter, surface: Surface): boolean {
  return filter === 'all' || filter === surface;
}

function filterResults(results: SurfaceResult[], filter: SurfaceFilter, localOnly: boolean | undefined): SurfaceResult[] {
  if (localOnly) {
    return results.filter((result) => result.surface === 'local');
  }
  if (filter === 'all') {
    return results;
  }
  return results.filter((result) => result.surface === 'local' || result.surface === filter);
}

function runLocalDiagnostics(config: Config): SurfaceResult {
  const profile = getActiveProfileName() || 'default/env';
  const hasTradingSignature = Boolean((config.SIGNING_KEY || config.PRIVATE_KEY) && (config.SIGNING_KEY_FINGERPRINT || config.API_KEY_FINGERPRINT));
  const hasOAuth = config.AUTH_TYPE === 'oauth' && Boolean(config.ACCESS_TOKEN && config.REFRESH_TOKEN);
  const hasConsumptionKey = Boolean(resolveConsumptionBearerToken(config));

  const checks: DiagnosticCheck[] = [
    check(
      Boolean(config.API_URL),
      'trading_api_url',
      'trading_api_url_configured',
      `Trading API URL: ${config.API_URL}`,
      'Trading API URL is not configured.',
      'Set API_URL or profile.api_url.'
    ),
    check(
      Boolean(config.CONSUMPTION_API_URL),
      'consumption_api_url',
      'consumption_api_url_configured',
      `Consumption API URL: ${config.CONSUMPTION_API_URL}`,
      'Consumption API URL is not configured.',
      'Set CONSUMPTION_API_URL or profile.consumption_api_url.'
    ),
    check(
      hasTradingSignature || hasOAuth,
      'trading_auth',
      hasTradingSignature ? 'trading_signature_configured' : 'trading_oauth_configured',
      hasTradingSignature ? 'Trading signing key and fingerprint are configured.' : hasOAuth ? 'OAuth credentials are configured for Trading reads.' : 'Trading auth credentials are missing.',
      'Trading auth credentials are missing.',
      'Run `grid trading keys create`, set SIGNING_KEY/SIGNING_KEY_FINGERPRINT, or run `grid auth login`.'
    ),
    check(
      hasConsumptionKey,
      'consumption_auth',
      'consumption_key_configured',
      hasConsumptionKey ? 'Consumption bearer credential is configured.' : 'Consumption API key is missing.',
      'Consumption API key is missing.',
      'Create or configure API_KEY or GRID_CLI_CONSUMPTION_KEY before calling inference endpoints.'
    ),
    check(
      hasOAuth,
      'platform_auth',
      'platform_oauth_configured',
      hasOAuth ? 'OAuth credentials are configured for Platform diagnostics.' : 'OAuth credentials are not configured for Platform diagnostics.',
      'OAuth credentials are not configured for Platform diagnostics.',
      'Run `grid auth login` to enable Platform diagnostics.'
    ),
  ];

  return {
    surface: 'local',
    status: checksStatus(checks),
    summary: `Profile: ${profile}`,
    checks,
  };
}

async function runPlatformDiagnostics(config: Config, timeoutMs: number): Promise<SurfaceResult> {
  const oauth = oauthSessionFromConfig(config);
  if (!oauth) {
    return skippedResult(
      'platform',
      'platform_oauth_missing',
      'Platform diagnostics require OAuth credentials.',
      'Run `grid auth login` and retry `grid diagnostics --surface platform`.'
    );
  }

  try {
    const session = new OAuthSession(oauth, getActiveProfileName() || undefined);
    const token = await session.ensureFreshAccessToken();
    const baseUrl = resolveExchangeBaseUrl(config);
    const response = await axios.get(`${baseUrl}/api/v1/diagnostics`, {
      timeout: timeoutMs,
      headers: { Authorization: `Bearer ${token}` },
      validateStatus: () => true,
    });

    if (response.status >= 200 && response.status < 300 && response.data?.data) {
      return fromRemoteData('platform', response.data.data);
    }

    return failedResult('platform', `HTTP ${response.status}`, response.data);
  } catch (error) {
    return failedResult('platform', errorMessage(error), error);
  }
}

async function runTradingDiagnostics(timeoutMs: number): Promise<SurfaceResult> {
  try {
    const data = await ApiClient.getInstance().getDiagnostics({ timeoutMs });
    return fromRemoteData('trading', data);
  } catch (error) {
    return failedResult('trading', errorMessage(error), error);
  }
}

async function runConsumptionDiagnostics(config: Config, timeoutMs: number): Promise<SurfaceResult> {
  if (!resolveConsumptionBearerToken(config)) {
    return skippedResult(
      'consumption',
      'consumption_key_missing',
      'Consumption diagnostics require a bearer credential.',
      'Create or configure API_KEY or GRID_CLI_CONSUMPTION_KEY and retry `grid diagnostics --surface consumption`.'
    );
  }

  try {
    const data = await ResponsesClient.getInstance().getDiagnostics({ timeoutMs });
    return fromRemoteData('consumption', data);
  } catch (error) {
    return failedResult('consumption', errorMessage(error), error);
  }
}

function fromRemoteData(surface: Surface, data: DiagnosticsData): SurfaceResult {
  return {
    surface,
    status: data.status,
    summary: `${data.service} diagnostics returned ${data.status}`,
    checks: data.checks,
    raw: data,
  };
}

function skippedResult(surface: Surface, code: string, detail: string, nextAction: string): SurfaceResult {
  return {
    surface,
    status: 'warn',
    summary: detail,
    checks: [{ name: 'configuration', status: 'warn', code, detail, next_action: nextAction }],
  };
}

function failedResult(surface: Surface, message: string, raw: unknown): SurfaceResult {
  const structured = structuredError(raw);
  return {
    surface,
    status: 'fail',
    summary: structured.detail || message,
    checks: [
      {
        name: 'remote_request',
        status: 'fail',
        code: structured.code || 'diagnostics_request_failed',
        detail: structured.detail || message,
        next_action: structured.nextAction || 'Check credentials, URL configuration, and service reachability.',
      },
    ],
  };
}

function check(
  ok: boolean,
  name: string,
  code: string,
  okDetail: string,
  warnDetail: string,
  nextAction: string
): DiagnosticCheck {
  return {
    name,
    status: ok ? 'ok' : 'warn',
    code: ok ? code : `${name}_missing`,
    detail: ok ? okDetail : warnDetail,
    next_action: ok ? 'No action needed.' : nextAction,
  };
}

function checksStatus(checks: DiagnosticCheck[]): DiagnosticStatus {
  if (checks.some((item) => item.status === 'fail')) return 'fail';
  if (checks.some((item) => item.status === 'warn')) return 'warn';
  return 'ok';
}

function overallStatus(results: SurfaceResult[]): DiagnosticStatus {
  return checksStatus(results.flatMap((result) => result.checks));
}

function formatDiagnosticsJson(results: SurfaceResult[]): Record<string, unknown> {
  const bySurface = new Map(results.map((result) => [result.surface, result]));
  const remoteSurfaces: Array<Exclude<Surface, 'local'>> = ['platform', 'trading', 'consumption'];

  return {
    status: overallStatus(results),
    local: bySurface.get('local') ?? null,
    remote: Object.fromEntries(
      remoteSurfaces.map((surface) => [surface, bySurface.get(surface) ?? null]),
    ),
    results,
  };
}

function structuredError(raw: unknown): { code?: string; detail?: string; nextAction?: string } {
  if (raw instanceof ApiError) {
    return { code: raw.code, detail: raw.message };
  }

  if (axios.isAxiosError(raw)) {
    return structuredError(raw.response?.data);
  }

  const body = raw as { errors?: { code?: string; detail?: string }; error?: string; message?: string };
  if (body?.errors) {
    return { code: body.errors.code, detail: body.errors.detail };
  }
  if (body?.error || body?.message) {
    return { code: body.error, detail: body.message || body.error };
  }
  return {};
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return `${error.statusCode}: ${error.message}`;
  }
  if (axios.isAxiosError(error)) {
    return axiosErrorMessage(error);
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function axiosErrorMessage(error: AxiosError): string {
  if (error.code === 'ECONNREFUSED') return 'connection refused';
  if (error.code === 'ENOTFOUND') return 'host not found';
  if (error.code === 'ECONNABORTED') return 'request timed out';
  return error.message;
}

function printHumanResults(results: SurfaceResult[]): void {
  console.log(chalk.bold(`Grid diagnostics: ${colorStatus(overallStatus(results))}`));
  console.log('');

  for (const result of results) {
    console.log(`${chalk.bold(result.surface)} ${colorStatus(result.status)} - ${result.summary}`);
    for (const checkItem of result.checks) {
      console.log(`  ${colorStatus(checkItem.status)} ${checkItem.name}: ${checkItem.detail}`);
      if (checkItem.status !== 'ok' && checkItem.next_action) {
        console.log(chalk.gray(`     next: ${checkItem.next_action}`));
      }
    }
    console.log('');
  }
}

function colorStatus(status: DiagnosticStatus): string {
  switch (status) {
    case 'ok':
      return chalk.green('ok');
    case 'warn':
      return chalk.yellow('warn');
    case 'fail':
      return chalk.red('fail');
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}
