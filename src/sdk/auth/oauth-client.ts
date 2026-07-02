import axios, { AxiosError } from 'axios';
import { logger } from '../../core/logging/logger';

/**
 * Well-known client_id for the Grid CLI OAuth application.
 * Must match the OAuth client registered on the exchange.
 */
export const GRID_CLI_CLIENT_ID = 'grid-cli-public';

/**
 * Default scopes requested during device auth login.
 * Covers all trading, supply, and account operations.
 */
export const DEFAULT_SCOPES = [
  'account:read',
  'account:write',
  'trade:read',
  'trade:write',
  'supply:read',
  'supply:write',
  'keys:manage',
];

const DEVICE_CODE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';

// ── Response types ──────────────────────────────────────────────

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface OAuthError {
  error: string;
  error_description?: string;
}

// ── Device code request ─────────────────────────────────────────

export async function requestDeviceCode(
  baseUrl: string,
  clientId: string,
  scopes: string[] = DEFAULT_SCOPES,
): Promise<DeviceCodeResponse> {
  const url = `${baseUrl}/api/v1/oauth/device/code`;
  const response = await axios.post<DeviceCodeResponse>(url, {
    client_id: clientId,
    scope: scopes.join(' '),
  });
  return response.data;
}

// ── Token polling ───────────────────────────────────────────────

export type PollResult =
  | { status: 'success'; tokens: TokenResponse }
  | { status: 'denied' }
  | { status: 'expired' }
  | { status: 'error'; message: string };

/**
 * Polls the token endpoint until the user approves/denies or the code expires.
 *
 * Respects the server-provided interval and backs off on `slow_down` responses.
 * The optional `onPoll` callback fires before each poll attempt for progress UX.
 */
export async function pollForToken(
  baseUrl: string,
  clientId: string,
  deviceCode: string,
  interval: number,
  expiresIn: number,
  onPoll?: () => void,
): Promise<PollResult> {
  const url = `${baseUrl}/api/v1/oauth/token`;
  const deadline = Date.now() + expiresIn * 1000;
  let currentInterval = interval;

  while (Date.now() < deadline) {
    onPoll?.();

    await sleep(currentInterval * 1000);

    try {
      const response = await axios.post<TokenResponse>(url, {
        grant_type: DEVICE_CODE_GRANT_TYPE,
        client_id: clientId,
        device_code: deviceCode,
      });

      return { status: 'success', tokens: response.data };
    } catch (err) {
      const oauthError = extractOAuthError(err);

      if (!oauthError) {
        logger.error('Unexpected error during token poll', { error: err });
        return { status: 'error', message: String(err) };
      }

      switch (oauthError.error) {
        case 'authorization_pending':
          break;
        case 'slow_down':
          currentInterval += 5;
          break;
        case 'access_denied':
          return { status: 'denied' };
        case 'expired_token':
          return { status: 'expired' };
        default:
          return {
            status: 'error',
            message: oauthError.error_description || oauthError.error,
          };
      }
    }
  }

  return { status: 'expired' };
}

// ── Token refresh ───────────────────────────────────────────────

export async function refreshAccessToken(
  baseUrl: string,
  clientId: string,
  refreshToken: string,
): Promise<TokenResponse> {
  const url = `${baseUrl}/api/v1/oauth/token`;
  const response = await axios.post<TokenResponse>(url, {
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: refreshToken,
  });
  return response.data;
}

// ── Token revocation ────────────────────────────────────────────

export async function revokeToken(
  baseUrl: string,
  token: string,
): Promise<void> {
  const url = `${baseUrl}/api/v1/oauth/revoke`;
  await axios.post(url, { token });
}

// ── Helpers ─────────────────────────────────────────────────────

function extractOAuthError(err: unknown): OAuthError | null {
  if (err instanceof AxiosError && err.response?.data?.error) {
    return err.response.data as OAuthError;
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
