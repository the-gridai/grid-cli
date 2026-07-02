/**
 * Tests for profile management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  loadProfile,
  loadFromEnv,
  autoLoadConfig,
  getAvailableProfiles,
  getCurrentProfile,
  getProfile,
  credentialsFileExists,
} from '../profiles.js';

// Mock credentials file content
const mockCredentials = {
  version: 1,
  current_profile: 'dev',
  profiles: {
    dev: {
      description: 'Development environment',
      api_url: 'http://localhost:4040/v1',
      ws_url: 'ws://localhost:3000/ws',
      signing_key: 'ZGV2LXNpZ25pbmcta2V5LXNlZWQtMzItYnl0ZXMhIQ==',
      signing_key_fingerprint: 'dev-fingerprint-hash',
    },
    production: {
      description: 'Production environment',
      api_url: 'https://api.thegrid.ai/v1',
      signing_key: 'cHJvZC1zaWduaW5nLWtleS1zZWVkLTMyLWJ5dGVzISE=',
      signing_key_fingerprint: 'prod-fingerprint-hash',
    },
    legacy: {
      description: 'Legacy format',
      api_url: 'http://localhost:4040/v1',
      private_key: 'bGVnYWN5LXNpZ25pbmcta2V5LXNlZWQtMzItYnl0ZXM=',
      api_key_fingerprint: 'legacy-fingerprint-hash',
    },
  },
};

// Use a temp directory for test credentials
const testCredentialsDir = path.join(os.tmpdir(), 'grid-cli-test-' + Date.now());
const testCredentialsFile = path.join(testCredentialsDir, 'credentials.json');

describe('Profile Management', () => {
  beforeEach(() => {
    // Create test directory and credentials file
    fs.mkdirSync(testCredentialsDir, { recursive: true });
    fs.writeFileSync(testCredentialsFile, JSON.stringify(mockCredentials, null, 2));

    // Clear environment variables
    delete process.env.GRID_PROFILE;
    delete process.env.GRID_SIGNING_KEY;
    delete process.env.GRID_FINGERPRINT;
    delete process.env.GRID_API_URL;
    delete process.env.SIGNING_KEY;
    delete process.env.SIGNING_KEY_FINGERPRINT;
    delete process.env.API_URL;
  });

  afterEach(() => {
    // Cleanup test directory
    if (fs.existsSync(testCredentialsDir)) {
      fs.rmSync(testCredentialsDir, { recursive: true });
    }
  });

  describe('credentialsFileExists', () => {
    it('should return true when file exists', () => {
      expect(credentialsFileExists(testCredentialsFile)).toBe(true);
    });

    it('should return false when file does not exist', () => {
      expect(credentialsFileExists('/nonexistent/path/credentials.json')).toBe(false);
    });
  });

  describe('getAvailableProfiles', () => {
    it('should return list of profile names', () => {
      const profiles = getAvailableProfiles(testCredentialsFile);
      expect(profiles).toContain('dev');
      expect(profiles).toContain('production');
      expect(profiles).toContain('legacy');
      expect(profiles).toHaveLength(3);
    });

    it('should return empty array when file does not exist', () => {
      const profiles = getAvailableProfiles('/nonexistent/credentials.json');
      expect(profiles).toEqual([]);
    });
  });

  describe('getCurrentProfile', () => {
    it('should return current_profile from file', () => {
      expect(getCurrentProfile(testCredentialsFile)).toBe('dev');
    });

    it('should prefer GRID_PROFILE env var', () => {
      process.env.GRID_PROFILE = 'production';
      expect(getCurrentProfile(testCredentialsFile)).toBe('production');
    });
  });

  describe('getProfile', () => {
    it('should return profile data by name', () => {
      const profile = getProfile('dev', testCredentialsFile);
      expect(profile).toBeDefined();
      expect(profile?.api_url).toBe('http://localhost:4040/v1');
      expect(profile?.signing_key).toBe('ZGV2LXNpZ25pbmcta2V5LXNlZWQtMzItYnl0ZXMhIQ==');
    });

    it('should return undefined for nonexistent profile', () => {
      const profile = getProfile('nonexistent', testCredentialsFile);
      expect(profile).toBeUndefined();
    });
  });

  describe('loadProfile', () => {
    it('should load named profile', () => {
      const config = loadProfile('production', { credentialsPath: testCredentialsFile });
      expect(config.apiUrl).toBe('https://api.thegrid.ai/v1');
      expect(config.signingKey).toBe('cHJvZC1zaWduaW5nLWtleS1zZWVkLTMyLWJ5dGVzISE=');
      expect(config.fingerprint).toBe('prod-fingerprint-hash');
    });

    it('should load current profile by default', () => {
      const config = loadProfile(undefined, { credentialsPath: testCredentialsFile });
      expect(config.apiUrl).toBe('http://localhost:4040/v1');
      expect(config.fingerprint).toBe('dev-fingerprint-hash');
    });

    it('should load profile from GRID_PROFILE env var', () => {
      process.env.GRID_PROFILE = 'production';
      const config = loadProfile(undefined, { credentialsPath: testCredentialsFile });
      expect(config.apiUrl).toBe('https://api.thegrid.ai/v1');
    });

    it('should support legacy field names (private_key, api_key_fingerprint)', () => {
      const config = loadProfile('legacy', { credentialsPath: testCredentialsFile });
      expect(config.signingKey).toBe('bGVnYWN5LXNpZ25pbmcta2V5LXNlZWQtMzItYnl0ZXM=');
      expect(config.fingerprint).toBe('legacy-fingerprint-hash');
    });

    it('should allow URL override', () => {
      const config = loadProfile('dev', {
        credentialsPath: testCredentialsFile,
        apiUrl: 'https://custom.api.url/v1',
      });
      expect(config.apiUrl).toBe('https://custom.api.url/v1');
      expect(config.fingerprint).toBe('dev-fingerprint-hash');
    });

    it('should throw for nonexistent profile', () => {
      expect(() =>
        loadProfile('nonexistent', { credentialsPath: testCredentialsFile })
      ).toThrow('Profile "nonexistent" not found');
    });

    it('should throw when no profile specified and no default', () => {
      // Create credentials without current_profile
      const noDefault = { version: 1, profiles: {} };
      fs.writeFileSync(testCredentialsFile, JSON.stringify(noDefault));

      expect(() =>
        loadProfile(undefined, { credentialsPath: testCredentialsFile })
      ).toThrow('No profile specified');
    });
  });

  describe('loadFromEnv', () => {
    it('should load from GRID_* env vars', () => {
      process.env.GRID_SIGNING_KEY = 'env-signing-key-base64';
      process.env.GRID_FINGERPRINT = 'env-fingerprint';
      process.env.GRID_API_URL = 'https://env.api.url/v1';

      const config = loadFromEnv();
      expect(config.signingKey).toBe('env-signing-key-base64');
      expect(config.fingerprint).toBe('env-fingerprint');
      expect(config.apiUrl).toBe('https://env.api.url/v1');
    });

    it('should support legacy env var names', () => {
      process.env.SIGNING_KEY = 'legacy-env-key';
      process.env.SIGNING_KEY_FINGERPRINT = 'legacy-env-fingerprint';

      const config = loadFromEnv();
      expect(config.signingKey).toBe('legacy-env-key');
      expect(config.fingerprint).toBe('legacy-env-fingerprint');
    });

    it('should throw when signing key missing', () => {
      process.env.GRID_FINGERPRINT = 'some-fingerprint';
      expect(() => loadFromEnv()).toThrow('Missing signing key');
    });

    it('should throw when fingerprint missing', () => {
      process.env.GRID_SIGNING_KEY = 'some-key';
      expect(() => loadFromEnv()).toThrow('Missing fingerprint');
    });
  });

  describe('autoLoadConfig', () => {
    it('should prefer profile over env vars', () => {
      process.env.GRID_PROFILE = 'production';
      process.env.GRID_SIGNING_KEY = 'env-key';
      process.env.GRID_FINGERPRINT = 'env-fp';
      process.env.GRID_CREDENTIALS_PATH = testCredentialsFile;

      const config = autoLoadConfig();
      // Should use profile, not env vars
      expect(config.signingKey).toBe('cHJvZC1zaWduaW5nLWtleS1zZWVkLTMyLWJ5dGVzISE=');
    });

    it('should fall back to env vars when no profile', () => {
      // Clear credentials file
      fs.unlinkSync(testCredentialsFile);

      process.env.GRID_SIGNING_KEY = 'fallback-key';
      process.env.GRID_FINGERPRINT = 'fallback-fp';

      const config = autoLoadConfig();
      expect(config.signingKey).toBe('fallback-key');
    });
  });
});
