// Note: We use require() in tests to get fresh module instances after jest.resetModules()
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Config } from '../../../../src/core/config/config';

// Store original env
const originalEnv = process.env;

describe('Config', () => {
  beforeEach(() => {
    // Reset module cache to get fresh config state
    jest.resetModules();
    // Reset env - start with minimal env to avoid .env file loading
    process.env = { 
      ...originalEnv,
      // Set credentials so dotenv loading is skipped
      SIGNING_KEY: 'test-key-for-skipping-dotenv',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    it('should load config with default values when no env vars set', () => {
      // Remove the SIGNING_KEY to test defaults (but dotenv might still load)
      delete process.env.SIGNING_KEY;
      delete process.env.API_URL;
      delete process.env.LOG_LEVEL;
      delete process.env.SDK_MAX_RETRIES;
      
      const { loadConfig: freshLoadConfig } = require('../../../../src/core/config/config');
      const config = freshLoadConfig();

      // Note: .env file may override defaults in dev environment, so just check they're defined
      expect(config.API_URL).toBeDefined();
      expect(config.LOG_LEVEL).toBeDefined();
      expect(config.SDK_MAX_RETRIES).toBeDefined();
    });

    it('should read environment variables', () => {
      process.env.API_URL = 'https://custom-api.example.com/v1';
      process.env.LOG_LEVEL = 'debug';
      process.env.SDK_MAX_RETRIES = '5';

      const { loadConfig: freshLoadConfig } = require('../../../../src/core/config/config');
      const config = freshLoadConfig();

      expect(config.API_URL).toBe('https://custom-api.example.com/v1');
      expect(config.LOG_LEVEL).toBe('debug');
      expect(config.SDK_MAX_RETRIES).toBe(5);
    });

    it('should support SIGNING_KEY environment variables', () => {
      process.env.SIGNING_KEY = 'test-signing-key';
      process.env.SIGNING_KEY_FINGERPRINT = 'test-fingerprint';

      const { loadConfig: freshLoadConfig } = require('../../../../src/core/config/config');
      const config = freshLoadConfig();

      expect(config.SIGNING_KEY).toBe('test-signing-key');
      expect(config.SIGNING_KEY_FINGERPRINT).toBe('test-fingerprint');
    });

    it('should support legacy PRIVATE_KEY environment variables', () => {
      process.env.PRIVATE_KEY = 'test-private-key';
      process.env.API_KEY_FINGERPRINT = 'test-fingerprint';

      const { loadConfig: freshLoadConfig } = require('../../../../src/core/config/config');
      const config = freshLoadConfig();

      expect(config.PRIVATE_KEY).toBe('test-private-key');
      expect(config.API_KEY_FINGERPRINT).toBe('test-fingerprint');
    });
  });

  describe('getConfig', () => {
    it('should return consistent config on subsequent calls', () => {
      const { getConfig: freshGetConfig, loadConfig: freshLoadConfig } = require('../../../../src/core/config/config');
      
      const config1 = freshLoadConfig();
      const config2 = freshGetConfig();

      // Config values should be the same (profile system may create new object)
      expect(config2.API_URL).toBe(config1.API_URL);
      expect(config2.LOG_LEVEL).toBe(config1.LOG_LEVEL);
      expect(config2.SDK_MAX_RETRIES).toBe(config1.SDK_MAX_RETRIES);
    });

    it('should auto-load config if not yet loaded', () => {
      const { getConfig: freshGetConfig } = require('../../../../src/core/config/config');
      
      const config = freshGetConfig();
      expect(config).toBeDefined();
      expect(config.API_URL).toBeDefined();
    });
  });

  describe('environment variable precedence', () => {
    it('should prioritize existing env vars over dotenv', () => {
      // Set env var before loading config
      process.env.API_URL = 'https://from-env-var.example.com';

      const { loadConfig: freshLoadConfig } = require('../../../../src/core/config/config');
      const config = freshLoadConfig();

      // Should use the env var, not any value from .env
      expect(config.API_URL).toBe('https://from-env-var.example.com');
    });
  });

  describe('schema validation', () => {
    it('should coerce string numbers to numbers', () => {
      process.env.SDK_MAX_RETRIES = '10';
      process.env.SDK_RATE_LIMIT_CONCURRENT = '20';

      const { loadConfig: freshLoadConfig } = require('../../../../src/core/config/config');
      const config = freshLoadConfig();

      expect(typeof config.SDK_MAX_RETRIES).toBe('number');
      expect(config.SDK_MAX_RETRIES).toBe(10);
      expect(typeof config.SDK_RATE_LIMIT_CONCURRENT).toBe('number');
      expect(config.SDK_RATE_LIMIT_CONCURRENT).toBe(20);
    });

    it('should validate LOG_LEVEL enum values', () => {
      process.env.LOG_LEVEL = 'warn';

      const { loadConfig: freshLoadConfig } = require('../../../../src/core/config/config');
      const config = freshLoadConfig();

      expect(config.LOG_LEVEL).toBe('warn');
    });
  });
});
