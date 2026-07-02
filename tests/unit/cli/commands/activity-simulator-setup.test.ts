import {
  buildUpdatedProfile,
  maxAvailableBalance,
  parsePositiveNumber,
  profileHasSigningCredentials,
} from '../../../../src/cli/commands/dev/setup/activity-simulator-helpers';

describe('activity simulator setup helpers', () => {
  it('parses positive numbers and rejects invalid input', () => {
    expect(parsePositiveNumber('2.5', 'fund-qty')).toBe(2.5);
    expect(() => parsePositiveNumber('0', 'fund-qty')).toThrow('fund-qty must be a positive number');
    expect(() => parsePositiveNumber('abc', 'fund-qty')).toThrow('fund-qty must be a positive number');
  });

  it('detects signing credentials on a profile', () => {
    expect(
      profileHasSigningCredentials({
        signing_key: 'base64-key',
        signing_key_fingerprint: 'fingerprint',
      })
    ).toBe(true);

    expect(profileHasSigningCredentials({ signing_key: 'base64-key' })).toBe(false);
    expect(profileHasSigningCredentials(null)).toBe(false);
  });

  it('builds merged profile and preserves existing values', () => {
    const merged = buildUpdatedProfile(
      {
        description: 'existing',
        api_url: 'http://old',
        ws_url: 'ws://old',
        signing_key: 'old-key',
        signing_key_fingerprint: 'old-fp',
      },
      {
        apiUrl: 'http://new',
        signingKey: 'new-key',
        roleLabel: 'maker',
      }
    );

    expect(merged.api_url).toBe('http://new');
    expect(merged.ws_url).toBe('ws://old');
    expect(merged.signing_key).toBe('new-key');
    expect(merged.signing_key_fingerprint).toBe('old-fp');
  });

  it('throws when merged profile does not have signing credentials', () => {
    expect(() =>
      buildUpdatedProfile(
        { api_url: 'http://localhost:4040/api/v1' },
        { roleLabel: 'taker' }
      )
    ).toThrow('taker profile is missing signing credentials');
  });

  it('computes max available balance across trading accounts', () => {
    expect(
      maxAvailableBalance([
        { available_balance: '0' },
        { available_balance: '12.34' },
        { available_balance: '4.2' },
      ])
    ).toBe(12.34);
  });
});
