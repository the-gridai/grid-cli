import type { Config } from '../../core/config/config';
import { getActiveProfileName, updateProfileOAuthTokens } from '../../core/config/profiles';
import { ApiError } from '../../core/errors';
import { logger } from '../../core/logging/logger';
import { refreshAccessToken } from './oauth-client';

export interface OAuthSessionState {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string;
  clientId: string;
  baseUrl: string;
}

export function oauthSessionFromConfig(config: Config): OAuthSessionState | null {
  if (config.AUTH_TYPE === 'oauth' && config.ACCESS_TOKEN && config.REFRESH_TOKEN) {
    return {
      accessToken: config.ACCESS_TOKEN,
      refreshToken: config.REFRESH_TOKEN,
      tokenExpiresAt: config.TOKEN_EXPIRES_AT || '',
      clientId: config.OAUTH_CLIENT_ID || 'grid-cli-public',
      baseUrl: config.OAUTH_BASE_URL || '',
    };
  }
  return null;
}

/** Exchange OAuth host (device flow), without `/api/v1`. */
export function resolveExchangeBaseUrl(config: Config): string {
  if (config.OAUTH_BASE_URL) {
    return config.OAUTH_BASE_URL.replace(/\/$/, '');
  }
  return config.API_URL.replace(/\/v1\/?$/, '').replace(/\/$/, '');
}

/**
 * Refreshes OAuth access tokens when near expiry; persists to the active profile.
 */
export class OAuthSession {
  private refreshPromise: Promise<void> | null = null;

  constructor(
    private state: OAuthSessionState,
    private readonly profileName?: string,
  ) {}

  get accessToken(): string {
    return this.state.accessToken;
  }

  async ensureFreshAccessToken(): Promise<string> {
    const expiresAt = this.state.tokenExpiresAt
      ? new Date(this.state.tokenExpiresAt).getTime()
      : 0;

    if (expiresAt > Date.now() + 60_000) {
      return this.state.accessToken;
    }

    if (this.refreshPromise) {
      await this.refreshPromise;
      return this.state.accessToken;
    }

    this.refreshPromise = this.refresh();
    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
    return this.state.accessToken;
  }

  private async refresh(): Promise<void> {
    if (!this.state.baseUrl) {
      throw new ApiError(
        'OAuth base URL is not configured. Run `grid auth login` again.',
        401,
      );
    }

    try {
      const tokens = await refreshAccessToken(
        this.state.baseUrl,
        this.state.clientId,
        this.state.refreshToken,
      );

      const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
      this.state.accessToken = tokens.access_token;
      this.state.refreshToken = tokens.refresh_token;
      this.state.tokenExpiresAt = newExpiresAt;

      const profileName = this.profileName || getActiveProfileName() || 'default';
      try {
        updateProfileOAuthTokens(profileName, {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: newExpiresAt,
        });
      } catch (e) {
        logger.warn('Failed to persist refreshed OAuth tokens', { error: e });
      }

      logger.info('OAuth token refreshed successfully');
    } catch (e) {
      logger.error('Failed to refresh OAuth token', { error: e });
      throw new ApiError(
        'OAuth session expired. Run `grid auth login` to re-authenticate.',
        401,
      );
    }
  }
}
