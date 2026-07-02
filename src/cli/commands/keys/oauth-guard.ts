import { getConfig } from '../../../core/config/config';
import { getActiveProfile } from '../../../core/config/profiles';
import { ApiError } from '../../../core/errors';

export function assertOAuthForExchangeKeys(): void {
  const config = getConfig();
  if (config.AUTH_TYPE !== 'oauth' || !config.ACCESS_TOKEN) {
    throw new ApiError(
      'This command requires OAuth. Run `grid auth login` and retry.',
      401,
    );
  }

  const profile = getActiveProfile();
  const scopes = profile?.oauth_scopes ?? [];
  if (scopes.length > 0 && !scopes.includes('keys:manage')) {
    throw new ApiError(
      'Token is missing the keys:manage scope. Log in again with `grid auth login` (default scopes include keys:manage).',
      403,
    );
  }
}
