import type { Config } from '../../core/config/config';

/**
 * Bearer token for Consumption API (`Authorization: Bearer`).
 *
 * Priority: profile/env API key → dedicated consumption key env → OAuth access token.
 *
 * The consumption host rejects Exchange OAuth tokens with `invalid_api_key`, so a
 * consumption key must win over an access token wherever both are configured —
 * which is the normal state for hybrid `oauth-dev` profiles. The access token
 * remains last so that endpoints which do accept it still work.
 */
export function resolveConsumptionBearerToken(config: Config): string | undefined {
  if (config.API_KEY) {
    return config.API_KEY;
  }
  if (config.GRID_CLI_CONSUMPTION_KEY) {
    return config.GRID_CLI_CONSUMPTION_KEY;
  }
  if (config.AUTH_TYPE === 'oauth' && config.ACCESS_TOKEN) {
    return config.ACCESS_TOKEN;
  }
  return undefined;
}
