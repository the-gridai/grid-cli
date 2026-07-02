import { resolveConsumptionBearerToken } from '../../../../src/sdk/auth/bearer';
import type { Config } from '../../../../src/core/config/config';

describe('resolveConsumptionBearerToken', () => {
  const base = {} as Config;

  it('prefers API key over OAuth for consumption', () => {
    const token = resolveConsumptionBearerToken({
      ...base,
      AUTH_TYPE: 'oauth',
      ACCESS_TOKEN: 'oauth-token',
      API_KEY: 'api-key',
      GRID_CLI_CONSUMPTION_KEY: 'consumption-key',
    } as Config);
    expect(token).toBe('api-key');
  });

  it('uses API key when not OAuth', () => {
    const token = resolveConsumptionBearerToken({
      ...base,
      API_KEY: 'api-key',
      GRID_CLI_CONSUMPTION_KEY: 'consumption-key',
    } as Config);
    expect(token).toBe('api-key');
  });

  it('falls back to GRID_CLI_CONSUMPTION_KEY', () => {
    const token = resolveConsumptionBearerToken({
      ...base,
      GRID_CLI_CONSUMPTION_KEY: 'consumption-key',
    } as Config);
    expect(token).toBe('consumption-key');
  });
});
