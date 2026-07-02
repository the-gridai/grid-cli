/**
 * Ed25519 Signature Authentication
 *
 * Provides request signing using Ed25519 signatures for API authentication.
 * All authenticated requests include:
 * - x-thegrid-signature: Ed25519 signature of the request
 * - x-thegrid-timestamp: Unix timestamp
 * - x-thegrid-fingerprint: SHA256 hash of the public key
 */

import nacl from 'tweetnacl';
import util from 'tweetnacl-util';
import { webcrypto } from 'node:crypto';
import type { Logger } from './types/index.js';

/**
 * Options for creating SignatureAuth
 */
export interface SignatureAuthOptions {
  /** Ed25519 signing key (base64 encoded - 32-byte seed or 64-byte secret key) */
  signingKey: string;
  /** Fingerprint of the signing key (SHA256 hash of public key, base64) */
  fingerprint: string;
  /** Optional logger for debugging */
  logger?: Logger;
}

/**
 * Authentication headers for Grid API requests
 */
export interface AuthHeaders {
  'x-thegrid-signature': string;
  'x-thegrid-timestamp': string;
  'x-thegrid-fingerprint': string;
}

/**
 * Signature-based authentication for Grid API
 *
 * @example
 * ```typescript
 * const auth = new SignatureAuth({
 *   signingKey: process.env.GRID_SIGNING_KEY,
 *   fingerprint: process.env.GRID_FINGERPRINT,
 * });
 *
 * const headers = auth.getHeaders('POST', '/trading/orders', JSON.stringify(body));
 * ```
 */
export class SignatureAuth {
  private privateKey: Uint8Array;
  private fingerprint: string;
  private logger?: Logger;

  /**
   * Create SignatureAuth instance
   *
   * @param options - Configuration options
   * @throws Error if signing key format is invalid
   */
  constructor(options: SignatureAuthOptions) {
    this.fingerprint = options.fingerprint;
    this.logger = options.logger;
    this.privateKey = this.initializeKey(options.signingKey);
  }

  /**
   * Initialize the private key from base64 string
   */
  private initializeKey(signingKey: string): Uint8Array {
    try {
      const keyBytes = util.decodeBase64(signingKey);

      // Handle both 32-byte seeds and 64-byte secret keys
      if (keyBytes.length === 32) {
        // It's a seed - derive the full keypair
        const keypair = nacl.sign.keyPair.fromSeed(keyBytes);
        this.logger?.debug('Initialized from 32-byte seed');
        return keypair.secretKey;
      } else if (keyBytes.length === 64) {
        // It's already a full secret key
        this.logger?.debug('Initialized from 64-byte secret key');
        return keyBytes;
      } else {
        throw new Error(
          `Invalid key length: ${keyBytes.length}. Expected 32 (seed) or 64 (secret key).`
        );
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('Invalid key length')) {
        throw e;
      }
      throw new Error('Invalid signing key format. Must be Base64 encoded.');
    }
  }

  /**
   * Get the fingerprint (useful for debugging/display)
   */
  public getFingerprint(): string {
    return this.fingerprint;
  }

  /**
   * Generate authentication headers for a request
   *
   * @param method - HTTP method (GET, POST, PUT, DELETE)
   * @param path - Request path (e.g., '/trading/orders')
   * @param body - Request body as string (empty string for GET requests)
   * @returns Authentication headers to include in the request
   *
   * @example
   * ```typescript
   * const headers = auth.getHeaders('POST', '/trading/orders', JSON.stringify({
   *   market_id: 'BTC-USD',
   *   side: 'buy',
   *   type: 'limit',
   *   quantity: '1.0',
   *   price: '50000',
   * }));
   * ```
   */
  public getHeaders(method: string, path: string, body: string = ''): AuthHeaders {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const message = `${timestamp}${method.toUpperCase()}${path}${body}`;
    const messageBytes = util.decodeUTF8(message);
    const signatureBytes = nacl.sign.detached(messageBytes, this.privateKey);
    const signature = util.encodeBase64(signatureBytes);

    this.logger?.debug('Generated auth headers', {
      method: method.toUpperCase(),
      path,
      timestamp,
      bodyLength: body.length,
    });

    return {
      'x-thegrid-signature': signature,
      'x-thegrid-timestamp': timestamp,
      'x-thegrid-fingerprint': this.fingerprint,
    };
  }

  /**
   * Verify a signature (useful for testing)
   *
   * @param message - Original message
   * @param signature - Base64 encoded signature
   * @returns true if signature is valid
   */
  public verify(message: string, signature: string): boolean {
    try {
      const messageBytes = util.decodeUTF8(message);
      const signatureBytes = util.decodeBase64(signature);

      // Extract public key from secret key (last 32 bytes)
      const publicKey = this.privateKey.slice(32);

      return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey);
    } catch {
      return false;
    }
  }
}

/**
 * Generate a new Ed25519 key pair
 *
 * @returns Object containing base64-encoded signing key and public key
 *
 * @example
 * ```typescript
 * const { signingKey, publicKey } = generateKeyPair();
 * console.log('Store these securely:');
 * console.log('Signing Key:', signingKey);
 * console.log('Public Key:', publicKey);
 * ```
 */
export function generateKeyPair(): { signingKey: string; publicKey: string } {
  const keypair = nacl.sign.keyPair();
  return {
    signingKey: util.encodeBase64(keypair.secretKey.slice(0, 32)), // Return seed only
    publicKey: util.encodeBase64(keypair.publicKey),
  };
}

/**
 * Calculate fingerprint from a public key
 *
 * @param publicKey - Base64 encoded public key
 * @returns SHA256 fingerprint (base64, no padding)
 */
export async function calculateFingerprint(publicKey: string): Promise<string> {
  const publicKeyBuffer = util.decodeBase64(publicKey);

  // Use Web Crypto API for SHA256 - get proper ArrayBuffer from Uint8Array
  const arrayBuffer = publicKeyBuffer.buffer.slice(
    publicKeyBuffer.byteOffset,
    publicKeyBuffer.byteOffset + publicKeyBuffer.byteLength
  ) as ArrayBuffer;
  const hashBuffer = await webcrypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = new Uint8Array(hashBuffer);

  // Convert to base64 and remove padding
  return util.encodeBase64(hashArray).replace(/=+$/, '');
}
