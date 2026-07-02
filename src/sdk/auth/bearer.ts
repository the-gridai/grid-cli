import type { Config } from '../../core/config/config';

/**
 * Bearer token for Consumption API (`Authorization: Bearer`).
 *
 * Priority: profile/env API key → OAuth access token → dedicated consumption key env.
 *
 * The consumption inference API often still expects a consumption API key even when
 * Exchange OAuth is configured; hybrid `oauth-dev` profiles include both.
 */
export function resolveConsumptionBearerToken(config: Config): string | undefined {
  if (config.API_KEY) {
    return config.API_KEY;
  }
  if (config.AUTH_TYPE === 'oauth' && config.ACCESS_TOKEN) {
    return config.ACCESS_TOKEN;
  }
  if (config.GRID_CLI_CONSUMPTION_KEY) {
    return config.GRID_CLI_CONSUMPTION_KEY;
  }
  return undefined;
}
