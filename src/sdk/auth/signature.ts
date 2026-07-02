import nacl from 'tweetnacl';
import util from 'tweetnacl-util';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getConfig, getConfigForProfile } from '../../core/config/config';
import { logger } from '../../core/logging/logger';
import { decodeBase64Lenient } from '../../core/utils/base64';

/**
 * Options for creating SignatureAuth
 */
export interface SignatureAuthOptions {
  /** Use credentials from a specific profile */
  profile?: string;
  /** Directly provide signing key (base64 encoded) */
  signingKey?: string;
  /** Directly provide fingerprint */
  fingerprint?: string;
}

export class SignatureAuth {
  private privateKey!: Uint8Array;
  private fingerprint!: string;

  /**
   * Create SignatureAuth instance
   * 
   * @param options - Optional configuration
   * @example
   * // Use default config/env
   * const auth = new SignatureAuth();
   * 
   * @example
   * // Use specific profile
   * const auth = new SignatureAuth({ profile: 'marketmaker' });
   * 
   * @example
   * // Provide credentials directly (for SDK users)
   * const auth = new SignatureAuth({ 
   *   signingKey: 'base64-key', 
   *   fingerprint: 'fp-hash' 
   * });
   */
  constructor(options?: SignatureAuthOptions) {
    // If credentials provided directly, use them
    if (options?.signingKey && options?.fingerprint) {
      this.initializeFromCredentials(options.signingKey, options.fingerprint);
      return;
    }
    
    // Get config (profile-aware)
    const config = options?.profile 
      ? getConfigForProfile(options.profile)
      : getConfig();
    
    // Debug logging for credential resolution
    if (options?.profile) {
      const fpPreview = config.SIGNING_KEY_FINGERPRINT 
        ? `${config.SIGNING_KEY_FINGERPRINT.substring(0, 8)}...`
        : '(none)';
      logger.info(`SignatureAuth using profile: ${options.profile}`, { 
        hasSigningKey: !!config.SIGNING_KEY,
        fingerprintPreview: fpPreview,
      });
    }
    
    let privateKeyString: string | undefined;
    let fingerprintString: string | undefined;
    
    // First try direct config values (supports both naming conventions)
    // SIGNING_KEY/SIGNING_KEY_FINGERPRINT (preferred) or PRIVATE_KEY/API_KEY_FINGERPRINT (legacy)
    if (config.SIGNING_KEY) {
      privateKeyString = config.SIGNING_KEY;
    } else if (config.PRIVATE_KEY) {
      privateKeyString = config.PRIVATE_KEY;
    }
    
    if (config.SIGNING_KEY_FINGERPRINT) {
      fingerprintString = config.SIGNING_KEY_FINGERPRINT;
    } else if (config.API_KEY_FINGERPRINT) {
      fingerprintString = config.API_KEY_FINGERPRINT;
    }
    
    // Fall back to file-based approach if not in config
    if (!privateKeyString && config.TRADING_PRIVATE_KEY_PATH) {
      try {
        const keyPath = path.isAbsolute(config.TRADING_PRIVATE_KEY_PATH) 
            ? config.TRADING_PRIVATE_KEY_PATH
            : path.resolve(process.cwd(), config.TRADING_PRIVATE_KEY_PATH);
            
        if (fs.existsSync(keyPath)) {
          privateKeyString = fs.readFileSync(keyPath, 'utf8').trim();
        }
      } catch (err) {
        logger.warn(`Failed to read private key from ${config.TRADING_PRIVATE_KEY_PATH}`, { error: err });
      }
    }
    
    // Try default file path only if we have defaults in config (not a mocked empty config)
    if (!privateKeyString && !config.PRIVATE_KEY && !config.TRADING_PRIVATE_KEY_PATH && config.API_URL) {
      try {
        const keyPath = path.resolve(process.cwd(), 'ed25519.key');
        if (fs.existsSync(keyPath)) {
          privateKeyString = fs.readFileSync(keyPath, 'utf8').trim();
        }
      } catch (err) {
        logger.warn('Failed to read private key from ed25519.key', { error: err });
      }
    }

    if (!privateKeyString) {
      throw new Error('PRIVATE_KEY and API_KEY_FINGERPRINT are required');
    }

    if (!fingerprintString && config.TRADING_PUBLIC_KEY_PATH) {
      try {
          const pubKeyPath = path.isAbsolute(config.TRADING_PUBLIC_KEY_PATH)
              ? config.TRADING_PUBLIC_KEY_PATH
              : path.resolve(process.cwd(), config.TRADING_PUBLIC_KEY_PATH);
              
          if (fs.existsSync(pubKeyPath)) {
              const content = fs.readFileSync(pubKeyPath, 'utf8').trim();
              
              // Calculate SHA256 fingerprint from public key (backend expects SHA256 hash)
              try {
                  const publicKeyBuffer = Buffer.from(content, 'base64');
                  const hash = crypto.createHash('sha256').update(publicKeyBuffer).digest('base64');
                  fingerprintString = hash.replace(/=+$/, '');
              } catch (e) {
                  logger.warn('Failed to calculate fingerprint, using raw content', { error: e });
                  fingerprintString = content;
              }
          }
      } catch (err) {
          logger.warn(`Failed to read public key from ${config.TRADING_PUBLIC_KEY_PATH}`, { error: err });
      }
    }
    
    // Try default file path only if we have defaults in config (not a mocked empty config)
    if (!fingerprintString && !config.API_KEY_FINGERPRINT && !config.TRADING_PUBLIC_KEY_PATH && config.API_URL) {
      try {
          const pubKeyPath = path.resolve(process.cwd(), 'ed25519_pub.der');
          if (fs.existsSync(pubKeyPath)) {
              const content = fs.readFileSync(pubKeyPath, 'utf8').trim();
              
              // Calculate SHA256 fingerprint from public key (backend expects SHA256 hash)
              try {
                  const publicKeyBuffer = Buffer.from(content, 'base64');
                  const hash = crypto.createHash('sha256').update(publicKeyBuffer).digest('base64');
                  fingerprintString = hash.replace(/=+$/, '');
              } catch (e) {
                  logger.warn('Failed to calculate fingerprint, using raw content', { error: e });
                  fingerprintString = content;
              }
          }
      } catch (err) {
          logger.warn('Failed to read public key from ed25519_pub.der', { error: err });
      }
    }

    if (!fingerprintString) {
        throw new Error('PRIVATE_KEY and API_KEY_FINGERPRINT are required');
    }
    
    // Initialize from the found credentials
    this.initializeFromCredentials(privateKeyString, fingerprintString);
  }

  /**
   * Initialize the auth instance from credential strings
   */
  private initializeFromCredentials(privateKeyString: string, fingerprintString: string): void {
    try {
        const keyBytes = decodeBase64Lenient(privateKeyString);
        
        // Handle both 32-byte seeds and 64-byte secret keys
        if (keyBytes.length === 32) {
            // It's a seed - derive the full keypair
            const keypair = nacl.sign.keyPair.fromSeed(keyBytes);
            this.privateKey = keypair.secretKey;
        } else if (keyBytes.length === 64) {
            // It's already a full secret key
            this.privateKey = keyBytes;
        } else {
            throw new Error(`Invalid key length: ${keyBytes.length}. Expected 32 (seed) or 64 (secret key).`);
        }
    } catch (e) {
        if (e instanceof Error && e.message.includes('Invalid key length')) {
            throw e;
        }
        throw new Error('Invalid Private Key format. Must be Base64 encoded.');
    }
    this.fingerprint = fingerprintString;
  }

  /**
   * Get the fingerprint (useful for debugging/display)
   */
  public getFingerprint(): string {
    return this.fingerprint;
  }

  public getHeaders(method: string, path: string, body: string = ''): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const message = `${timestamp}${method.toUpperCase()}${path}${body}`;
    const messageBytes = util.decodeUTF8(message);
    const signatureBytes = nacl.sign.detached(messageBytes, this.privateKey);
    const signature = util.encodeBase64(signatureBytes);

    return {
      'x-thegrid-signature': signature,
      'x-thegrid-timestamp': timestamp,
      'x-thegrid-fingerprint': this.fingerprint
    };
  }
}

