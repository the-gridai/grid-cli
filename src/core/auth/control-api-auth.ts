/**
 * Control API Authentication
 * 
 * Provides Ed25519 signature verification for the control API.
 * Uses a domain-separated signature so trading signatures cannot authorize control actions.
 * 
 * @module control-api-auth
 */

import crypto from 'crypto';
import nacl from 'tweetnacl';
import util from 'tweetnacl-util';
import http from 'http';
import { getConfig, getConfigForProfile } from '../config/config';
import { logger } from '../logging/logger';
import { decodeBase64Lenient } from '../utils/base64';

/**
 * Request headers expected for authenticated requests
 */
export interface SignedRequestHeaders {
  'x-thegrid-signature': string;
  'x-thegrid-timestamp': string;
  'x-thegrid-fingerprint': string;
  'x-thegrid-nonce': string;
}

/**
 * Authentication options
 */
export interface ControlApiAuthOptions {
  /** Profile name for credentials (optional) */
  profile?: string;
  /** Maximum age of request timestamp in seconds (default: 60) */
  maxTimestampAge?: number;
  /** Allow unauthenticated read requests (GET) */
  allowUnauthenticatedReads?: boolean;
}

/**
 * Result of authentication check
 */
export interface AuthResult {
  authenticated: boolean;
  error?: string;
  fingerprint?: string;
}

/**
 * Control API Authentication class
 * 
 * Verifies Ed25519 signatures on incoming control API requests.
 * Binds each request to its full target and a single-use random nonce.
 */
export class ControlApiAuth {
  private publicKey: Uint8Array | null = null;
  private expectedFingerprint: string | null = null;
  private maxTimestampAge: number;
  private allowUnauthenticatedReads: boolean;
  private usedNonces = new Map<string, number>();
  private static readonly MAX_NONCES = 10000;

  constructor(options: ControlApiAuthOptions = {}) {
    this.maxTimestampAge = options.maxTimestampAge ?? 60;
    this.allowUnauthenticatedReads = options.allowUnauthenticatedReads ?? true;

    try {
      this.initializeFromConfig(options.profile);
    } catch (error) {
      logger.warn('ControlApiAuth: Could not initialize authentication', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Authentication is optional - allow initialization without keys
    }
  }

  /**
   * Initialize public key from configuration
   */
  private initializeFromConfig(profileName?: string): void {
    const config = profileName
      ? getConfigForProfile(profileName)
      : getConfig();

    // Get the signing key (private key contains public key in Ed25519)
    const signingKeyBase64 = config.SIGNING_KEY || config.PRIVATE_KEY;
    const fingerprint = config.SIGNING_KEY_FINGERPRINT || config.API_KEY_FINGERPRINT;

    if (!signingKeyBase64 || !fingerprint) {
      throw new Error('SIGNING_KEY and SIGNING_KEY_FINGERPRINT required for authentication');
    }

    // Decode the signing key
    const keyBytes = decodeBase64Lenient(signingKeyBase64);

    // Extract or derive public key from signing key
    // For Ed25519: if we have 32 bytes (seed), derive keypair
    // If we have 64 bytes (secret key), extract last 32 bytes (public key)
    if (keyBytes.length === 32) {
      const keypair = nacl.sign.keyPair.fromSeed(keyBytes);
      this.publicKey = keypair.publicKey;
    } else if (keyBytes.length === 64) {
      // Last 32 bytes of secret key are the public key
      this.publicKey = keyBytes.slice(32);
    } else {
      throw new Error(`Invalid key length: ${keyBytes.length}`);
    }

    this.expectedFingerprint = fingerprint;

    logger.info('ControlApiAuth initialized', {
      fingerprintPreview: `${fingerprint.substring(0, 8)}...`,
    });
  }

  /**
   * Check if authentication is available
   */
  isAvailable(): boolean {
    return this.publicKey !== null && this.expectedFingerprint !== null;
  }

  /**
   * Authenticate an incoming HTTP request
   * 
   * @param req - The HTTP request
   * @param body - The request body (as string)
   * @returns Authentication result
   */
  authenticateRequest(
    req: http.IncomingMessage,
    body: string = ''
  ): AuthResult {
    const method = req.method?.toUpperCase() || 'GET';

    // Allow unauthenticated GET requests if configured
    if (this.allowUnauthenticatedReads && method === 'GET') {
      return { authenticated: true };
    }

    // If auth is not configured, deny all mutating requests
    if (!this.isAvailable()) {
      return {
        authenticated: false,
        error: 'Authentication not configured on server'
      };
    }

    // Extract auth headers
    const signature = req.headers['x-thegrid-signature'];
    const timestamp = req.headers['x-thegrid-timestamp'];
    const fingerprint = req.headers['x-thegrid-fingerprint'];
    const nonce = req.headers['x-thegrid-nonce'];

    if (typeof signature !== 'string' || typeof timestamp !== 'string' ||
        typeof fingerprint !== 'string' || typeof nonce !== 'string' ||
        !signature || !fingerprint || !/^[a-f0-9]{32}$/.test(nonce)) {
      return {
        authenticated: false,
        error: 'Missing authentication headers'
      };
    }

    // Verify fingerprint matches (constant-time comparison)
    if (!this.expectedFingerprint) {
      return { authenticated: false, error: 'No expected fingerprint configured' };
    }
    const fpBuf = Buffer.from(fingerprint);
    const expectedBuf = Buffer.from(this.expectedFingerprint);
    if (fpBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(fpBuf, expectedBuf)) {
      return {
        authenticated: false,
        error: 'Invalid fingerprint'
      };
    }

    // Check timestamp is not too old
    const requestTime = /^\d{1,12}$/.test(timestamp) ? Number(timestamp) : NaN;
    const now = Math.floor(Date.now() / 1000);

    if (isNaN(requestTime) || Math.abs(now - requestTime) > this.maxTimestampAge) {
      return {
        authenticated: false,
        error: 'Request timestamp expired or invalid'
      };
    }

    // Include the query string: it can select the strategy affected by an action.
    const message = controlMessage(timestamp, nonce, method, req.url || '/', body);

    // Verify signature
    try {
      const messageBytes = util.decodeUTF8(message);
      const signatureBytes = decodeBase64Lenient(signature);

      const valid = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        this.publicKey!
      );

      if (!valid) {
        return {
          authenticated: false,
          error: 'Invalid signature'
        };
      }

      // Only valid signatures consume capacity. Retain future-dated requests
      // until the end of their acceptance window, and fail closed at capacity.
      for (const [seen, expiresAt] of this.usedNonces) {
        if (expiresAt < now) this.usedNonces.delete(seen);
      }
      if (this.usedNonces.has(nonce)) {
        return { authenticated: false, error: 'Request already used' };
      }
      if (this.usedNonces.size >= ControlApiAuth.MAX_NONCES) {
        return { authenticated: false, error: 'Authentication capacity exceeded' };
      }
      this.usedNonces.set(nonce, requestTime + this.maxTimestampAge);

      return {
        authenticated: true,
        fingerprint
      };
    } catch (error) {
      logger.warn('Signature verification error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        authenticated: false,
        error: 'Signature verification failed'
      };
    }
  }

  /**
   * Express/Connect-style middleware for authentication
   */
  middleware() {
    return async (
      req: http.IncomingMessage,
      res: http.ServerResponse,
      next: () => void
    ): Promise<void> => {
      // Read body for POST/PUT/PATCH
      const method = req.method?.toUpperCase() || 'GET';
      let body = '';

      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        body = await this.readBody(req);
        // Store body for later use (since we've consumed it)
        (req as any).__body = body;
      }

      const result = this.authenticateRequest(req, body);

      if (!result.authenticated) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Unauthorized',
          message: result.error
        }));
        return;
      }

      next();
    };
  }

  /**
   * Read request body as string
   */
  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });

      req.on('error', reject);
    });
  }
}

/** Canonical control protocol; deliberately incompatible with trading signatures. */
function controlMessage(timestamp: string, nonce: string, method: string, target: string, body: string): string {
  const url = new URL(target, 'http://localhost');
  return JSON.stringify(['grid-control-v1', timestamp, nonce, method, url.pathname + url.search, body]);
}

/**
 * Create authentication headers for making control API requests
 * 
 * This is used by CLI commands to sign their requests.
 * 
 * @param method - HTTP method
 * @param path - Request path
 * @param body - Request body
 * @param profile - Optional profile name
 * @returns Headers object
 */
export function createSignedHeaders(
  method: string,
  path: string,
  body: string = '',
  profile?: string
): Record<string, string> {
  const config = profile ? getConfigForProfile(profile) : getConfig();

  const signingKeyBase64 = config.SIGNING_KEY || config.PRIVATE_KEY;
  const fingerprint = config.SIGNING_KEY_FINGERPRINT || config.API_KEY_FINGERPRINT;

  if (!signingKeyBase64 || !fingerprint) {
    throw new Error('SIGNING_KEY and SIGNING_KEY_FINGERPRINT required');
  }

  // Decode and prepare private key
  const keyBytes = decodeBase64Lenient(signingKeyBase64);
  let privateKey: Uint8Array;

  if (keyBytes.length === 32) {
    const keypair = nacl.sign.keyPair.fromSeed(keyBytes);
    privateKey = keypair.secretKey;
  } else if (keyBytes.length === 64) {
    privateKey = keyBytes;
  } else {
    throw new Error(`Invalid key length: ${keyBytes.length}`);
  }

  // Create signature
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const message = controlMessage(timestamp, nonce, method.toUpperCase(), path, body);
  const messageBytes = util.decodeUTF8(message);
  const signatureBytes = nacl.sign.detached(messageBytes, privateKey);
  const signature = util.encodeBase64(signatureBytes);

  return {
    'x-thegrid-signature': signature,
    'x-thegrid-timestamp': timestamp,
    'x-thegrid-fingerprint': fingerprint,
    'x-thegrid-nonce': nonce,
  };
}

/**
 * Export for index
 */
export default ControlApiAuth;
