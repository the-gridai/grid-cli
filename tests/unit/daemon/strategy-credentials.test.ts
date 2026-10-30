jest.mock('../../../src/core/logging/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../src/core/observability', () => ({
  captureException: jest.fn(), setTag: jest.fn(), setContext: jest.fn(),
}));
jest.mock('../../../src/core/config/config', () => ({ getConfig: jest.fn(() => ({})) }));
jest.mock('../../../src/core/config/profiles', () => ({ registerDynamicProfile: jest.fn() }));

import { StrategyInstance } from '../../../src/daemon/strategy-instance';
import { registerDynamicProfile } from '../../../src/core/config/profiles';

// Dummy principals only. The default credential must never be used by a bot
// configured for a different principal, even if its secret mount is incomplete.
describe.each(['example-strategy', 'external-strategy'] as const)('%s credential isolation', type => {
  const envNames = ['SIGNING_KEY', 'SIGNING_KEY_FINGERPRINT', 'BOT_SIGNING_KEY', 'BOT_SIGNING_KEY_FINGERPRINT', 'BOT_PRIVATE_KEY', 'BOT_API_KEY_FINGERPRINT'];
  let saved: Record<string, string | undefined>;
  beforeEach(() => {
    saved = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
    envNames.forEach(name => { delete process.env[name]; });
    process.env.SIGNING_KEY = 'dummy-shared-key';
    process.env.SIGNING_KEY_FINGERPRINT = 'shared-principal';
    jest.clearAllMocks();
  });
  afterEach(() => {
    envNames.forEach(name => {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    });
  });

  function bot(prefix?: string) {
    const instance = new StrategyInstance({ id: 'isolation-test', type, enabled: true, config: {}, credentials: prefix ? { envPrefix: prefix } : undefined });
    const strategy = { start: jest.fn().mockResolvedValue(undefined) };
    const factory = jest.spyOn(instance as any, 'createStrategy').mockResolvedValue(strategy);
    return { instance, factory };
  }

  it.each(['both', 'key', 'fingerprint'])('fails before constructing a bot when %s credentials are missing', async missing => {
    if (missing !== 'key' && missing !== 'both') process.env.BOT_SIGNING_KEY = 'dummy-bot-key';
    if (missing !== 'fingerprint' && missing !== 'both') process.env.BOT_SIGNING_KEY_FINGERPRINT = 'bot-principal';
    const { instance, factory } = bot('BOT_');
    await expect(instance.start()).rejects.toThrow(/credentials.*BOT_/i);
    expect(factory).not.toHaveBeenCalled();
    expect(instance.getStatus().status).toBe('error');
    expect(registerDynamicProfile).not.toHaveBeenCalled();
  });

  it('registers only the explicitly prefixed principal when both values exist', async () => {
    process.env.BOT_SIGNING_KEY = 'dummy-bot-key';
    process.env.BOT_SIGNING_KEY_FINGERPRINT = 'bot-principal';
    const { instance, factory } = bot('BOT_');
    await instance.start();
    expect(registerDynamicProfile).toHaveBeenCalledWith('__strategy_isolation-test', expect.objectContaining({ signing_key: 'dummy-bot-key', signing_key_fingerprint: 'bot-principal' }));
    expect(factory).toHaveBeenCalledWith('__strategy_isolation-test');
  });

  it('retains default-credential mode when no prefix is configured', async () => {
    const { instance, factory } = bot();
    await instance.start();
    expect(factory).toHaveBeenCalledWith(undefined);
  });
});
