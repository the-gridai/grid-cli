/**
 * Profile Precedence Tests
 * 
 * These tests verify that when --profile is explicitly specified,
 * the profile's credentials take precedence over environment variables.
 * 
 * This is critical for multi-account workflows where users need to
 * switch between different accounts (e.g., supplier vs marketmaker).
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Profile Precedence', () => {
  // Store original env vars to restore after tests
  const originalEnv: Record<string, string | undefined> = {};
  const envVarsToTrack = [
    'SIGNING_KEY',
    'SIGNING_KEY_FINGERPRINT', 
    'PRIVATE_KEY',
    'API_KEY_FINGERPRINT',
    'API_URL',
    'GRID_PROFILE',
    'GRID_CREDENTIALS_FILE',
  ];

  // Temporary credentials file
  let tempCredentialsPath: string;
  
  // Test credentials - these should be different from env vars
  const supplierProfile = {
    description: 'Test supplier',
    api_url: 'http://supplier-api.test',
    signing_key: 'c3VwcGxpZXItdGVzdC1rZXktMzItYnl0ZXMtbG9uZyE=', // "supplier-test-key-32-bytes-long!"
    signing_key_fingerprint: 'supplier-fingerprint-12345',
  };
  
  const marketmakerProfile = {
    description: 'Test marketmaker',
    api_url: 'http://marketmaker-api.test',
    signing_key: 'bWFya2V0bWFrZXItdGVzdC1rZXktMzItYnl0ZXMh', // "marketmaker-test-key-32-bytes!"
    signing_key_fingerprint: 'marketmaker-fingerprint-67890',
  };
  
  // Environment variable values (different from profiles)
  const envCredentials = {
    SIGNING_KEY: 'ZW52LXRlc3Qta2V5LTMyLWJ5dGVzLWxvbmctc3RyaW5n', // "env-test-key-32-bytes-long-string"
    SIGNING_KEY_FINGERPRINT: 'env-fingerprint-abcde',
    API_URL: 'http://env-api.test',
  };

  beforeEach(() => {
    // Save original env vars
    envVarsToTrack.forEach(key => {
      originalEnv[key] = process.env[key];
    });

    // Create temp credentials file
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grid-cli-test-'));
    tempCredentialsPath = path.join(tempDir, 'credentials.json');
    
    const credentialsFile = {
      version: 1,
      default_profile: 'supplier',
      profiles: {
        supplier: supplierProfile,
        marketmaker: marketmakerProfile,
      },
    };
    
    fs.writeFileSync(tempCredentialsPath, JSON.stringify(credentialsFile, null, 2));
    
    // Point to temp credentials file
    process.env.GRID_CREDENTIALS_FILE = tempCredentialsPath;
    
    // Set env vars that would normally come from .env.local
    process.env.SIGNING_KEY = envCredentials.SIGNING_KEY;
    process.env.SIGNING_KEY_FINGERPRINT = envCredentials.SIGNING_KEY_FINGERPRINT;
    process.env.API_URL = envCredentials.API_URL;
    
    // Clear any cached modules to ensure fresh state
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original env vars
    envVarsToTrack.forEach(key => {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    });

    // Clean up temp file
    if (tempCredentialsPath && fs.existsSync(tempCredentialsPath)) {
      const tempDir = path.dirname(tempCredentialsPath);
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('getConfigForProfile', () => {
    it('should use profile credentials when profile is explicitly requested', async () => {
      // Import after env setup
      const { getConfigForProfile } = await import('../../../../src/core/config/config');
      
      const config = getConfigForProfile('marketmaker');
      
      // Profile values should be used, NOT env vars
      expect(config.SIGNING_KEY).toBe(marketmakerProfile.signing_key);
      expect(config.SIGNING_KEY_FINGERPRINT).toBe(marketmakerProfile.signing_key_fingerprint);
      expect(config.API_URL).toBe(marketmakerProfile.api_url);
    });

    it('should use different credentials for different profiles', async () => {
      const { getConfigForProfile } = await import('../../../../src/core/config/config');
      
      const supplierConfig = getConfigForProfile('supplier');
      const marketmakerConfig = getConfigForProfile('marketmaker');
      
      // Each profile should have its own credentials
      expect(supplierConfig.SIGNING_KEY).toBe(supplierProfile.signing_key);
      expect(marketmakerConfig.SIGNING_KEY).toBe(marketmakerProfile.signing_key);
      
      // They should be different
      expect(supplierConfig.SIGNING_KEY).not.toBe(marketmakerConfig.SIGNING_KEY);
      expect(supplierConfig.SIGNING_KEY_FINGERPRINT).not.toBe(marketmakerConfig.SIGNING_KEY_FINGERPRINT);
    });
  });

  describe('getEffectiveConfig', () => {
    it('should give profile precedence when explicitly requested', async () => {
      const { getEffectiveConfig } = await import('../../../../src/core/config/profiles');
      
      const effective = getEffectiveConfig('marketmaker');
      
      // Profile values should take precedence over env vars
      expect(effective.signing_key).toBe(marketmakerProfile.signing_key);
      expect(effective.signing_key_fingerprint).toBe(marketmakerProfile.signing_key_fingerprint);
    });

    it('should give env vars precedence when no profile explicitly requested', async () => {
      const { getEffectiveConfig, setGlobalProfileOverride } = await import('../../../../src/core/config/profiles');
      
      // No explicit profile, no global override
      setGlobalProfileOverride(undefined);
      const effective = getEffectiveConfig();
      
      // Env vars should take precedence (backward compatibility)
      expect(effective.signing_key).toBe(envCredentials.SIGNING_KEY);
      expect(effective.signing_key_fingerprint).toBe(envCredentials.SIGNING_KEY_FINGERPRINT);
    });
  });

  describe('mergeProfileWithEnv', () => {
    it('should give profile precedence when profileTakesPrecedence is true', async () => {
      const { mergeProfileWithEnv } = await import('../../../../src/core/config/profiles');
      
      const result = mergeProfileWithEnv(marketmakerProfile, true);
      
      expect(result.signing_key).toBe(marketmakerProfile.signing_key);
      expect(result.signing_key_fingerprint).toBe(marketmakerProfile.signing_key_fingerprint);
    });

    it('should give env vars precedence when profileTakesPrecedence is false', async () => {
      const { mergeProfileWithEnv } = await import('../../../../src/core/config/profiles');
      
      const result = mergeProfileWithEnv(marketmakerProfile, false);
      
      // Env vars should win
      expect(result.signing_key).toBe(envCredentials.SIGNING_KEY);
      expect(result.signing_key_fingerprint).toBe(envCredentials.SIGNING_KEY_FINGERPRINT);
    });

    it('should fall back to profile values when env vars are not set', async () => {
      // Clear env vars
      delete process.env.SIGNING_KEY;
      delete process.env.SIGNING_KEY_FINGERPRINT;
      
      const { mergeProfileWithEnv } = await import('../../../../src/core/config/profiles');
      
      const result = mergeProfileWithEnv(marketmakerProfile, false);
      
      // Should fall back to profile values
      expect(result.signing_key).toBe(marketmakerProfile.signing_key);
      expect(result.signing_key_fingerprint).toBe(marketmakerProfile.signing_key_fingerprint);
    });
  });

  describe('global profile override', () => {
    it('should affect getActiveProfileName', async () => {
      const { setGlobalProfileOverride, getActiveProfileName } = await import('../../../../src/core/config/profiles');
      
      // Without override, should return default profile
      setGlobalProfileOverride(undefined);
      expect(getActiveProfileName()).toBe('supplier'); // default_profile in credentials file
      
      // With override, should return override
      setGlobalProfileOverride('marketmaker');
      expect(getActiveProfileName()).toBe('marketmaker');
    });
  });

  describe('GRID_PROFILE environment variable', () => {
    it('should give profile precedence when GRID_PROFILE is set', async () => {
      // Set GRID_PROFILE env var
      process.env.GRID_PROFILE = 'marketmaker';
      
      // Clear any global override
      const { setGlobalProfileOverride } = await import('../../../../src/core/config/profiles');
      setGlobalProfileOverride(undefined);
      
      // Reset modules to pick up new env var
      jest.resetModules();
      
      const { getConfig } = await import('../../../../src/core/config/config');
      const config = getConfig();
      
      // Profile values should be used, NOT env vars
      expect(config.SIGNING_KEY).toBe(marketmakerProfile.signing_key);
      expect(config.SIGNING_KEY_FINGERPRINT).toBe(marketmakerProfile.signing_key_fingerprint);
    });

    it('should be considered explicit profile selection', async () => {
      process.env.GRID_PROFILE = 'marketmaker';
      jest.resetModules();
      
      const { getEffectiveConfig } = await import('../../../../src/core/config/profiles');
      const effective = getEffectiveConfig();
      
      // GRID_PROFILE should make profile take precedence
      expect(effective.signing_key).toBe(marketmakerProfile.signing_key);
    });
  });
});
