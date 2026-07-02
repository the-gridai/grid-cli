import { SignatureAuth } from '../../../../src/sdk/auth/signature';
import nacl from 'tweetnacl';
import util from 'tweetnacl-util';

// Mock config
jest.mock('../../../../src/core/config/config', () => ({
  getConfig: jest.fn(),
}));

import { getConfig } from '../../../../src/core/config/config';

describe('SignatureAuth', () => {
  // Generate a full 64-byte secret key
  const mockKeyPair = nacl.sign.keyPair();
  const privateKeyBase64 = util.encodeBase64(mockKeyPair.secretKey);
  const fingerprint = 'test-fingerprint';

  // Generate a 32-byte seed for testing seed-based initialization
  const mockSeed = nacl.randomBytes(32);
  const seedKeyPair = nacl.sign.keyPair.fromSeed(mockSeed);
  const seedBase64 = util.encodeBase64(mockSeed);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization with 64-byte secret key', () => {
    beforeEach(() => {
      (getConfig as jest.Mock).mockReturnValue({
        PRIVATE_KEY: privateKeyBase64,
        API_KEY_FINGERPRINT: fingerprint,
      });
    });

    it('should initialize correctly with valid config', () => {
      const auth = new SignatureAuth();
      expect(auth).toBeDefined();
    });

    it('should generate valid headers', () => {
      const auth = new SignatureAuth();
      const method = 'POST';
      const path = '/v1/orders';
      const body = '{"side":"buy"}';

      const headers = auth.getHeaders(method, path, body);

      expect(headers['x-thegrid-fingerprint']).toBe(fingerprint);
      expect(headers['x-thegrid-timestamp']).toBeDefined();
      expect(headers['x-thegrid-signature']).toBeDefined();

      // Verify signature
      const timestamp = headers['x-thegrid-timestamp'];
      const message = `${timestamp}${method}${path}${body}`;
      const messageBytes = util.decodeUTF8(message);
      const signatureBytes = util.decodeBase64(headers['x-thegrid-signature']);

      const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, mockKeyPair.publicKey);
      expect(isValid).toBe(true);
    });
  });

  describe('initialization with 32-byte seed', () => {
    beforeEach(() => {
      (getConfig as jest.Mock).mockReturnValue({
        SIGNING_KEY: seedBase64,
        SIGNING_KEY_FINGERPRINT: fingerprint,
      });
    });

    it('should initialize correctly with 32-byte seed', () => {
      const auth = new SignatureAuth();
      expect(auth).toBeDefined();
    });

    it('should derive keypair from seed and generate valid signatures', () => {
      const auth = new SignatureAuth();
      const method = 'GET';
      const path = '/v1/account';
      const body = '';

      const headers = auth.getHeaders(method, path, body);

      expect(headers['x-thegrid-fingerprint']).toBe(fingerprint);
      expect(headers['x-thegrid-timestamp']).toBeDefined();
      expect(headers['x-thegrid-signature']).toBeDefined();

      // Verify signature using the derived public key from seed
      const timestamp = headers['x-thegrid-timestamp'];
      const message = `${timestamp}${method}${path}${body}`;
      const messageBytes = util.decodeUTF8(message);
      const signatureBytes = util.decodeBase64(headers['x-thegrid-signature']);

      const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, seedKeyPair.publicKey);
      expect(isValid).toBe(true);
    });
  });

  describe('alternative env var names (SIGNING_KEY)', () => {
    it('should prefer SIGNING_KEY over PRIVATE_KEY', () => {
      (getConfig as jest.Mock).mockReturnValue({
        SIGNING_KEY: seedBase64,
        SIGNING_KEY_FINGERPRINT: 'signing-fingerprint',
        PRIVATE_KEY: privateKeyBase64,
        API_KEY_FINGERPRINT: 'api-fingerprint',
      });

      const auth = new SignatureAuth();
      const headers = auth.getHeaders('GET', '/test', '');

      // Should use SIGNING_KEY_FINGERPRINT
      expect(headers['x-thegrid-fingerprint']).toBe('signing-fingerprint');
    });

    it('should fall back to PRIVATE_KEY if SIGNING_KEY not set', () => {
      (getConfig as jest.Mock).mockReturnValue({
        PRIVATE_KEY: privateKeyBase64,
        API_KEY_FINGERPRINT: 'api-fingerprint',
      });

      const auth = new SignatureAuth();
      const headers = auth.getHeaders('GET', '/test', '');

      expect(headers['x-thegrid-fingerprint']).toBe('api-fingerprint');
    });
  });

  describe('error handling', () => {
    it('should throw error if no credentials provided', () => {
      (getConfig as jest.Mock).mockReturnValue({});
      expect(() => new SignatureAuth()).toThrow('PRIVATE_KEY and API_KEY_FINGERPRINT are required');
    });

    it('should throw error for invalid key length', () => {
      const invalidKey = util.encodeBase64(nacl.randomBytes(16)); // 16 bytes - invalid
      (getConfig as jest.Mock).mockReturnValue({
        SIGNING_KEY: invalidKey,
        SIGNING_KEY_FINGERPRINT: fingerprint,
      });

      expect(() => new SignatureAuth()).toThrow(/Invalid key length: 16/);
    });

    it('should throw error for invalid base64', () => {
      (getConfig as jest.Mock).mockReturnValue({
        SIGNING_KEY: 'not-valid-base64!!!',
        SIGNING_KEY_FINGERPRINT: fingerprint,
      });

      expect(() => new SignatureAuth()).toThrow('Invalid Private Key format');
    });
  });
});

