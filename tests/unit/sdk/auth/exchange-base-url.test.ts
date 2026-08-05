import {
  resolveExchangeBaseUrl,
  tradingUrlToPlatformBaseUrl,
} from '../../../../src/sdk/auth/oauth-session';
import type { Config } from '../../../../src/core/config/config';

function configWith(overrides: Partial<Config>): Config {
  return overrides as Config;
}

describe('tradingUrlToPlatformBaseUrl', () => {
  it.each([
    ['https://trading.api.thegrid.ai/v1', 'https://platform.api.thegrid.ai'],
    ['https://trading.api.dev.thegrid.ai/v1', 'https://platform.api.dev.thegrid.ai'],
    ['https://trading.api.staging.thegrid.ai/v1', 'https://platform.api.staging.thegrid.ai'],
  ])('maps the trading host to the platform host: %s', (input, expected) => {
    expect(tradingUrlToPlatformBaseUrl(input)).toBe(expected);
  });

  it('tolerates a trailing slash after /v1', () => {
    expect(tradingUrlToPlatformBaseUrl('https://trading.api.thegrid.ai/v1/')).toBe(
      'https://platform.api.thegrid.ai',
    );
  });

  it('maps the local trading port to the local exchange port', () => {
    expect(tradingUrlToPlatformBaseUrl('http://127.0.0.1:4040/v1')).toBe('http://127.0.0.1:4020');
  });

  it('leaves unrecognised hosts alone apart from stripping /v1', () => {
    expect(tradingUrlToPlatformBaseUrl('https://example.internal/v1')).toBe(
      'https://example.internal',
    );
  });

  it('does not rewrite a host that is already the platform host', () => {
    expect(tradingUrlToPlatformBaseUrl('https://platform.api.thegrid.ai/v1')).toBe(
      'https://platform.api.thegrid.ai',
    );
  });

  it('returns non-URL input unchanged', () => {
    expect(tradingUrlToPlatformBaseUrl('not a url')).toBe('not a url');
  });
});

describe('resolveExchangeBaseUrl', () => {
  it('prefers an explicit OAUTH_BASE_URL', () => {
    const config = configWith({
      OAUTH_BASE_URL: 'https://custom.example.com/',
      API_URL: 'https://trading.api.thegrid.ai/v1',
    });
    expect(resolveExchangeBaseUrl(config)).toBe('https://custom.example.com');
  });

  it('derives the platform host from API_URL when no override is set', () => {
    const config = configWith({ API_URL: 'https://trading.api.dev.thegrid.ai/v1' });
    expect(resolveExchangeBaseUrl(config)).toBe('https://platform.api.dev.thegrid.ai');
  });
});
