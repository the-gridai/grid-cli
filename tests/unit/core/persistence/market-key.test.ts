import { normalizeMarketKey, isMarketIdLike } from '../../../../src/core/persistence/market-key';

describe('market-key', () => {
  it('normalizes bare UUID to market_ prefix', () => {
    expect(normalizeMarketKey('1a85e636-f40d-4927-bd3f-25be08d5705f')).toBe(
      'market_1a85e636-f40d-4927-bd3f-25be08d5705f'
    );
  });

  it('preserves market_ prefix and lowercases uuid', () => {
    expect(normalizeMarketKey('market_1A85E636-F40D-4927-BD3F-25BE08D5705F')).toBe(
      'market_1a85e636-f40d-4927-bd3f-25be08d5705f'
    );
  });

  it('normalizes GX market- prefix to the same key', () => {
    expect(normalizeMarketKey('market-1A85E636-F40D-4927-BD3F-25BE08D5705F')).toBe(
      'market_1a85e636-f40d-4927-bd3f-25be08d5705f'
    );
  });

  it('isMarketIdLike accepts market_ uuid, market- uuid, and bare uuid', () => {
    expect(isMarketIdLike('market_1a85e636-f40d-4927-bd3f-25be08d5705f')).toBe(true);
    expect(isMarketIdLike('market-1a85e636-f40d-4927-bd3f-25be08d5705f')).toBe(true);
    expect(isMarketIdLike('1a85e636-f40d-4927-bd3f-25be08d5705f')).toBe(true);
    expect(isMarketIdLike('not-a-market')).toBe(false);
  });
});
