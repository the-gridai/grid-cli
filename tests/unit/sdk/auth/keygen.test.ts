import {
  generateSigningKeyPair,
  calculateSigningKeyFingerprint,
} from '../../../../src/sdk/auth/keygen';

describe('keygen', () => {
  it('generates distinct keypairs', () => {
    const a = generateSigningKeyPair();
    const b = generateSigningKeyPair();
    expect(a.publicKey).not.toBe(b.publicKey);
    expect(a.signingKey).not.toBe(b.signingKey);
  });

  it('calculates a stable fingerprint', () => {
    const { publicKey } = generateSigningKeyPair();
    const fp1 = calculateSigningKeyFingerprint(publicKey);
    const fp2 = calculateSigningKeyFingerprint(publicKey);
    expect(fp1).toBe(fp2);
    expect(fp1.length).toBeGreaterThan(10);
  });
});
