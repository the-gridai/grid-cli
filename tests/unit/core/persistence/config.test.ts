/**
 * Persistence Config Tests
 */

import {
  BasePersistenceConfigSchema,
  PersistenceConfigSchema,
  resolveDbPath,
  isPersistenceEnabled,
  DEFAULT_DB_PATH,
  DB_PATH_ENV_VAR,
} from '../../../../src/core/persistence';

describe('Persistence Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env[DB_PATH_ENV_VAR];
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('BasePersistenceConfigSchema', () => {
    it('accepts valid config with all fields', () => {
      const result = BasePersistenceConfigSchema.parse({
        enabled: true,
        dbPath: '/custom/path.sqlite',
      });
      
      expect(result.enabled).toBe(true);
      expect(result.dbPath).toBe('/custom/path.sqlite');
    });

    it('applies default for enabled field', () => {
      const result = BasePersistenceConfigSchema.parse({});
      expect(result.enabled).toBe(true);
    });

    it('allows optional dbPath', () => {
      const result = BasePersistenceConfigSchema.parse({ enabled: false });
      expect(result.enabled).toBe(false);
      expect(result.dbPath).toBeUndefined();
    });

    it('rejects empty dbPath string', () => {
      expect(() => BasePersistenceConfigSchema.parse({ dbPath: '' })).toThrow();
    });
  });

  describe('PersistenceConfigSchema', () => {
    it('applies default empty object', () => {
      const result = PersistenceConfigSchema.parse(undefined);
      expect(result.enabled).toBe(true);
      expect(result.dbPath).toBeUndefined();
    });

    it('parses explicit config', () => {
      const result = PersistenceConfigSchema.parse({
        enabled: false,
        dbPath: '/custom/db.sqlite',
      });
      
      expect(result.enabled).toBe(false);
      expect(result.dbPath).toBe('/custom/db.sqlite');
    });
  });

  describe('resolveDbPath', () => {
    it('returns config path when provided', () => {
      const config = { enabled: true, dbPath: '/config/path.sqlite' };
      expect(resolveDbPath(config)).toBe('/config/path.sqlite');
    });

    it('falls back to environment variable', () => {
      process.env[DB_PATH_ENV_VAR] = '/env/path.sqlite';
      const config = { enabled: true };
      expect(resolveDbPath(config)).toBe('/env/path.sqlite');
    });

    it('falls back to default path', () => {
      const config = { enabled: true };
      expect(resolveDbPath(config)).toBe(DEFAULT_DB_PATH);
    });

    it('handles undefined config', () => {
      expect(resolveDbPath(undefined)).toBe(DEFAULT_DB_PATH);
    });

    it('config path takes precedence over env var', () => {
      process.env[DB_PATH_ENV_VAR] = '/env/path.sqlite';
      const config = { enabled: true, dbPath: '/config/path.sqlite' };
      expect(resolveDbPath(config)).toBe('/config/path.sqlite');
    });
  });

  describe('isPersistenceEnabled', () => {
    it('returns true by default', () => {
      expect(isPersistenceEnabled(undefined)).toBe(true);
    });

    it('returns true when explicitly enabled', () => {
      expect(isPersistenceEnabled({ enabled: true })).toBe(true);
    });

    it('returns false when disabled', () => {
      expect(isPersistenceEnabled({ enabled: false })).toBe(false);
    });

    it('handles config with only dbPath', () => {
      // When only dbPath is provided, enabled defaults to true
      const config = PersistenceConfigSchema.parse({ dbPath: '/some/path.sqlite' });
      expect(isPersistenceEnabled(config)).toBe(true);
    });
  });
});
