/**
 * Tests for Ed25519 signature authentication
 */

import { describe, it, expect } from 'vitest';
import { SignatureAuth, generateKeyPair, calculateFingerprint } from '../auth.js';

describe('SignatureAuth', () => {
  // Test key pair (DO NOT use in production)
  const testKeyPair = generateKeyPair();

  describe('constructor', () => {
    it('should initialize with valid 32-byte seed', () => {
      const auth = new SignatureAuth({
        signingKey: testKeyPair.signingKey,
        fingerprint: 'test-fingerprint',
      });

      expect(auth.getFingerprint()).toBe('test-fingerprint');
    });

    it('should throw on invalid base64 key', () => {
      expect(() => {
        new SignatureAuth({
          signingKey: 'not-valid-base64!!!',
          fingerprint: 'test-fingerprint',
        });
      }).toThrow('Invalid signing key format');
    });

    it('should throw on invalid key length', () => {
      // 16 bytes is too short
      const shortKey = Buffer.alloc(16).toString('base64');

      expect(() => {
        new SignatureAuth({
          signingKey: shortKey,
          fingerprint: 'test-fingerprint',
        });
      }).toThrow('Invalid key length');
    });
  });

  describe('getHeaders', () => {
    it('should return all required headers', () => {
      const auth = new SignatureAuth({
        signingKey: testKeyPair.signingKey,
        fingerprint: 'test-fingerprint',
      });

      const headers = auth.getHeaders('GET', '/orders', '');

      expect(headers).toHaveProperty('x-thegrid-signature');
      expect(headers).toHaveProperty('x-thegrid-timestamp');
      expect(headers).toHaveProperty('x-thegrid-fingerprint');
    });

    it('should include fingerprint in headers', () => {
      const auth = new SignatureAuth({
        signingKey: testKeyPair.signingKey,
        fingerprint: 'my-fingerprint',
      });

      const headers = auth.getHeaders('POST', '/orders', '{"test": "data"}');

      expect(headers['x-thegrid-fingerprint']).toBe('my-fingerprint');
    });

    it('should include valid timestamp', () => {
      const auth = new SignatureAuth({
        signingKey: testKeyPair.signingKey,
        fingerprint: 'test-fingerprint',
      });

      const before = Math.floor(Date.now() / 1000);
      const headers = auth.getHeaders('GET', '/orders', '');
      const after = Math.floor(Date.now() / 1000);

      const timestamp = parseInt(headers['x-thegrid-timestamp'], 10);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it('should produce different signatures for different requests', () => {
      const auth = new SignatureAuth({
        signingKey: testKeyPair.signingKey,
        fingerprint: 'test-fingerprint',
      });

      const headers1 = auth.getHeaders('GET', '/orders', '');
      const headers2 = auth.getHeaders('POST', '/orders', '{"data": "test"}');

      expect(headers1['x-thegrid-signature']).not.toBe(headers2['x-thegrid-signature']);
    });

    it('should produce different signatures for different methods', () => {
      const auth = new SignatureAuth({
        signingKey: testKeyPair.signingKey,
        fingerprint: 'test-fingerprint',
      });

      const headers1 = auth.getHeaders('GET', '/orders', '');
      const headers2 = auth.getHeaders('DELETE', '/orders', '');

      expect(headers1['x-thegrid-signature']).not.toBe(headers2['x-thegrid-signature']);
    });
  });

  describe('verify', () => {
    it('should verify valid signatures', () => {
      const auth = new SignatureAuth({
        signingKey: testKeyPair.signingKey,
        fingerprint: 'test-fingerprint',
      });

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const method = 'GET';
      const path = '/orders';
      const body = '';
      const message = `${timestamp}${method}${path}${body}`;

      const headers = auth.getHeaders(method, path, body);

      // The signature should be verifiable
      const isValid = auth.verify(message, headers['x-thegrid-signature']);
      expect(isValid).toBe(true);
    });

    it('should reject invalid signatures', () => {
      const auth = new SignatureAuth({
        signingKey: testKeyPair.signingKey,
        fingerprint: 'test-fingerprint',
      });

      const isValid = auth.verify('some message', 'invalid-signature');
      expect(isValid).toBe(false);
    });
  });
});

describe('generateKeyPair', () => {
  it('should generate valid key pair', () => {
    const keyPair = generateKeyPair();

    expect(keyPair).toHaveProperty('signingKey');
    expect(keyPair).toHaveProperty('publicKey');
    expect(typeof keyPair.signingKey).toBe('string');
    expect(typeof keyPair.publicKey).toBe('string');
  });

  it('should generate different key pairs each time', () => {
    const keyPair1 = generateKeyPair();
    const keyPair2 = generateKeyPair();

    expect(keyPair1.signingKey).not.toBe(keyPair2.signingKey);
    expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
  });

  it('should generate usable signing key', () => {
    const keyPair = generateKeyPair();

    // Should be able to create SignatureAuth with generated key
    const auth = new SignatureAuth({
      signingKey: keyPair.signingKey,
      fingerprint: 'test',
    });

    expect(auth).toBeDefined();
  });
});

describe('calculateFingerprint', () => {
  it('should calculate fingerprint from public key', async () => {
    const keyPair = generateKeyPair();
    const fingerprint = await calculateFingerprint(keyPair.publicKey);

    expect(typeof fingerprint).toBe('string');
    expect(fingerprint.length).toBeGreaterThan(0);
    // Should not have base64 padding
    expect(fingerprint).not.toContain('=');
  });

  it('should produce same fingerprint for same public key', async () => {
    const keyPair = generateKeyPair();
    const fingerprint1 = await calculateFingerprint(keyPair.publicKey);
    const fingerprint2 = await calculateFingerprint(keyPair.publicKey);

    expect(fingerprint1).toBe(fingerprint2);
  });

  it('should produce different fingerprints for different keys', async () => {
    const keyPair1 = generateKeyPair();
    const keyPair2 = generateKeyPair();

    const fingerprint1 = await calculateFingerprint(keyPair1.publicKey);
    const fingerprint2 = await calculateFingerprint(keyPair2.publicKey);

    expect(fingerprint1).not.toBe(fingerprint2);
  });
});
