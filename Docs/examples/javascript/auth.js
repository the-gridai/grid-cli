/**
 * GRID API Authentication Helper (JavaScript/TypeScript)
 * 
 * Ed25519 signature-based authentication for Trading and Accounts APIs
 */

const nacl = require('tweetnacl');
const util = require('tweetnacl-util');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class SignatureAuth {
  /**
   * Initialize authentication with Ed25519 keys
   * 
   * @param {string} privateKeyBase64 - Base64-encoded private key (64 bytes)
   * @param {string} publicKeyBase64 - Base64-encoded public key (32 bytes)
   */
  constructor(privateKeyBase64, publicKeyBase64) {
    try {
      this.privateKey = util.decodeBase64(privateKeyBase64);
    } catch (error) {
      throw new Error('Invalid private key format. Must be Base64 encoded.');
    }
    
    // Calculate fingerprint (SHA256 of public key)
    const publicKeyBuffer = Buffer.from(publicKeyBase64, 'base64');
    const hash = crypto.createHash('sha256').update(publicKeyBuffer).digest('base64');
    this.fingerprint = hash.replace(/=+$/, ''); // Remove padding
  }

  /**
   * Load keys from files
   * 
   * @param {string} privateKeyPath - Path to private key file
   * @param {string} publicKeyPath - Path to public key file
   * @returns {SignatureAuth}
   */
  static fromFiles(privateKeyPath, publicKeyPath) {
    const privateKeyContent = fs.readFileSync(privateKeyPath, 'utf8').trim();
    const publicKeyContent = fs.readFileSync(publicKeyPath, 'utf8').trim();
    
    return new SignatureAuth(privateKeyContent, publicKeyContent);
  }

  /**
   * Generate authentication headers for an API request
   * 
   * @param {string} method - HTTP method (GET, POST, DELETE, etc.)
   * @param {string} path - Request path (e.g., '/api/v1/trading/markets')
   * @param {string} body - Request body as JSON string (empty string for GET)
   * @returns {Object} Headers object with signature, timestamp, and fingerprint
   */
  getHeaders(method, path, body = '') {
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

  /**
   * Get fingerprint (useful for verification)
   * 
   * @returns {string} Base64-encoded SHA256 hash of public key
   */
  getFingerprint() {
    return this.fingerprint;
  }
}

module.exports = { SignatureAuth };

