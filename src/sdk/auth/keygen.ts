import nacl from 'tweetnacl';
import util from 'tweetnacl-util';
import crypto from 'crypto';

/**
 * Generate a new Ed25519 signing key pair (seed + public key, base64).
 */
export function generateSigningKeyPair(): { signingKey: string; publicKey: string } {
  const keypair = nacl.sign.keyPair();
  return {
    signingKey: util.encodeBase64(keypair.secretKey.slice(0, 32)),
    publicKey: util.encodeBase64(keypair.publicKey),
  };
}

/**
 * SHA-256 fingerprint of a base64 public key (no padding), matching exchange key registration.
 */
export function calculateSigningKeyFingerprint(publicKey: string): string {
  const publicKeyBuffer = util.decodeBase64(publicKey);
  const hash = crypto.createHash('sha256').update(publicKeyBuffer).digest();
  return util.encodeBase64(hash).replace(/=+$/, '');
}
