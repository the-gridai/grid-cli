/**
 * Tests for SQLite-backed strategy config persistence.
 *
 * Covers:
 * - seedDbFromFileConfig: first-boot seeding from JSON into SQLite
 * - Write-through: ConfigManager changes persisted via onConfigChange listener
 * - Default configSource resolution to 'db'
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { z } from 'zod';
import { StrategyConfigStore } from '../../../src/core/persistence/StrategyConfigStore';
import { ConfigManager } from '../../../src/core/config/config-manager';
import {
  seedDbFromFileConfig,
  resolveConfigSource,
  mergeStrategyConfigsFromDb,
  type MultiStrategyConfig,
} from '../../../src/daemon/multi-strategy-config';

describe('SQLite config persistence', () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grid-sqlite-test-'));
    dbPath = path.join(tempDir, 'test-strategies.sqlite');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function makeMultiStrategyConfig(
    overrides?: Partial<MultiStrategyConfig>
  ): MultiStrategyConfig {
    return {
      version: '1.0' as const,
      strategies: [
        {
          id: 'issuer-1',
          name: 'Test Issuer',
          type: 'scheduled-issuer',
          enabled: true,
          config: { instrumentSymbol: 'TEST', quantity: 100 },
        },
      ],
      global: {
        healthPort: 8080,
        controlPort: undefined,
        enableControlApi: false,
        controlApiProfile: undefined,
        logLevel: 'info' as const,
        sentryEnabled: false,
        configSource: 'db' as const,
        strategyConfigDbPath: dbPath,
      },
      ...overrides,
    };
  }

  describe('seedDbFromFileConfig', () => {
    it('seeds SQLite from JSON config on first boot', () => {
      const config = makeMultiStrategyConfig();

      seedDbFromFileConfig(config, dbPath);

      const store = new StrategyConfigStore(dbPath);
      store.init();
      try {
        const row = store.get('issuer-1');
        expect(row).not.toBeNull();
        expect(row!.name).toBe('Test Issuer');
        expect(row!.type).toBe('scheduled-issuer');
        expect(row!.config).toEqual({ instrumentSymbol: 'TEST', quantity: 100 });
      } finally {
        store.close();
      }
    });

    it('does not overwrite existing DB rows', () => {
      const store = new StrategyConfigStore(dbPath);
      store.init();
      store.create({
        id: 'issuer-1',
        name: 'DB Issuer',
        type: 'scheduled-issuer',
        config: { instrumentSymbol: 'DB-ONLY', quantity: 999 },
      });
      store.close();

      const config = makeMultiStrategyConfig();
      seedDbFromFileConfig(config, dbPath);

      const store2 = new StrategyConfigStore(dbPath);
      store2.init();
      try {
        const row = store2.get('issuer-1');
        expect(row!.config).toEqual({ instrumentSymbol: 'DB-ONLY', quantity: 999 });
        expect(row!.name).toBe('DB Issuer');
      } finally {
        store2.close();
      }
    });

    it('seeds only missing strategies when DB has some', () => {
      const store = new StrategyConfigStore(dbPath);
      store.init();
      store.create({
        id: 'issuer-1',
        name: 'Existing',
        type: 'scheduled-issuer',
        config: { existing: true },
      });
      store.close();

      const config = makeMultiStrategyConfig({
        strategies: [
          {
            id: 'issuer-1',
            name: 'From File',
            type: 'scheduled-issuer',
            enabled: true,
            config: { fromFile: true },
          },
          {
            id: 'issuer-2',
            name: 'New Strategy',
            type: 'scheduled-issuer',
            enabled: true,
            config: { brand: 'new' },
          },
        ],
      });

      seedDbFromFileConfig(config, dbPath);

      const store2 = new StrategyConfigStore(dbPath);
      store2.init();
      try {
        const row1 = store2.get('issuer-1');
        expect(row1!.config).toEqual({ existing: true });

        const row2 = store2.get('issuer-2');
        expect(row2).not.toBeNull();
        expect(row2!.config).toEqual({ brand: 'new' });
        expect(row2!.name).toBe('New Strategy');
      } finally {
        store2.close();
      }
    });

    it('skips disabled strategies', () => {
      const config = makeMultiStrategyConfig({
        strategies: [
          {
            id: 'disabled-1',
            name: 'Disabled',
            type: 'scheduled-issuer',
            enabled: false,
            config: { shouldNotSeed: true },
          },
        ],
      });

      seedDbFromFileConfig(config, dbPath);

      const store = new StrategyConfigStore(dbPath);
      store.init();
      try {
        expect(store.get('disabled-1')).toBeNull();
      } finally {
        store.close();
      }
    });

    it('skips strategies with empty config', () => {
      const config = makeMultiStrategyConfig({
        strategies: [
          {
            id: 'empty-config',
            type: 'scheduled-issuer',
            enabled: true,
            config: {},
          },
        ],
      });

      seedDbFromFileConfig(config, dbPath);

      const store = new StrategyConfigStore(dbPath);
      store.init();
      try {
        expect(store.get('empty-config')).toBeNull();
      } finally {
        store.close();
      }
    });

    it('preserves credentials envPrefix from JSON', () => {
      const config = makeMultiStrategyConfig({
        strategies: [
          {
            id: 'with-creds',
            name: 'Creds Strategy',
            type: 'scheduled-issuer',
            enabled: true,
            credentials: { envPrefix: 'ISSUER_' },
            config: { some: 'config' },
          },
        ],
      });

      seedDbFromFileConfig(config, dbPath);

      const store = new StrategyConfigStore(dbPath);
      store.init();
      try {
        const row = store.get('with-creds');
        expect(row!.credentialsEnvPrefix).toBe('ISSUER_');
      } finally {
        store.close();
      }
    });
  });

  describe('resolveConfigSource', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env.STRATEGY_CONFIG_SOURCE;
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('defaults to db when no configSource specified', () => {
      expect(resolveConfigSource(undefined)).toBe('db');
    });

    it('respects explicit configSource from global config', () => {
      const global = { configSource: 'file' as const } as any;
      expect(resolveConfigSource(global)).toBe('file');
    });

    it('env var overrides config file setting', () => {
      process.env.STRATEGY_CONFIG_SOURCE = 'file';
      const global = { configSource: 'db' as const } as any;
      expect(resolveConfigSource(global)).toBe('file');
    });
  });

  describe('mergeStrategyConfigsFromDb after seed', () => {
    it('round-trips: seed from JSON then merge reads the same config back', () => {
      const config = makeMultiStrategyConfig();

      seedDbFromFileConfig(config, dbPath);
      const merged = mergeStrategyConfigsFromDb(config);

      expect(merged.strategies[0].config).toEqual({
        instrumentSymbol: 'TEST',
        quantity: 100,
      });
    });

    it('reads updated config from DB after write-through', () => {
      const config = makeMultiStrategyConfig();
      seedDbFromFileConfig(config, dbPath);

      const store = new StrategyConfigStore(dbPath);
      store.init();
      store.update('issuer-1', { config: { instrumentSymbol: 'UPDATED', quantity: 500 } });
      store.close();

      const merged = mergeStrategyConfigsFromDb(config);
      expect(merged.strategies[0].config).toEqual({
        instrumentSymbol: 'UPDATED',
        quantity: 500,
      });
    });
  });

  describe('write-through via ConfigManager onConfigChange', () => {
    const TestSchema = z.object({
      instrumentSymbol: z.string(),
      quantity: z.number(),
    });

    it('persists config changes to SQLite on update', async () => {
      seedDbFromFileConfig(makeMultiStrategyConfig(), dbPath);

      const store = new StrategyConfigStore(dbPath);
      store.init();

      const manager = new ConfigManager({
        initialConfig: { instrumentSymbol: 'TEST', quantity: 100 },
        schema: TestSchema,
        strategyId: 'issuer-1',
      });

      // Simulate the write-through listener from MultiStrategyRunner
      const strategyId = 'issuer-1';
      manager.onConfigChange((newConfig: Record<string, unknown>) => {
        const existing = store.get(strategyId);
        if (existing) {
          store.update(strategyId, { config: newConfig });
        }
      });

      await manager.updateConfig({ quantity: 250 });

      const row = store.get('issuer-1');
      expect(row).not.toBeNull();
      expect(row!.config).toEqual({ instrumentSymbol: 'TEST', quantity: 250 });
      expect(row!.version).toBe(2);

      store.close();
    });

    it('persists config changes to SQLite on replaceConfig', async () => {
      seedDbFromFileConfig(makeMultiStrategyConfig(), dbPath);

      const store = new StrategyConfigStore(dbPath);
      store.init();

      const manager = new ConfigManager({
        initialConfig: { instrumentSymbol: 'TEST', quantity: 100 },
        schema: TestSchema,
        strategyId: 'issuer-1',
      });

      const strategyId = 'issuer-1';
      manager.onConfigChange((newConfig: Record<string, unknown>) => {
        const existing = store.get(strategyId);
        if (existing) {
          store.update(strategyId, { config: newConfig });
        }
      });

      await manager.replaceConfig({ instrumentSymbol: 'REPLACED', quantity: 999 });

      const row = store.get('issuer-1');
      expect(row!.config).toEqual({ instrumentSymbol: 'REPLACED', quantity: 999 });

      store.close();
    });

    it('creates DB row if missing during write-through', async () => {
      // Start with empty DB (no seed)
      const store = new StrategyConfigStore(dbPath);
      store.init();

      expect(store.get('new-strategy')).toBeNull();

      const manager = new ConfigManager({
        initialConfig: { instrumentSymbol: 'NEW', quantity: 50 },
        schema: TestSchema,
        strategyId: 'new-strategy',
      });

      const strategyId = 'new-strategy';
      manager.onConfigChange((newConfig: Record<string, unknown>) => {
        const existing = store.get(strategyId);
        if (existing) {
          store.update(strategyId, { config: newConfig });
        } else {
          store.create({
            id: strategyId,
            name: strategyId,
            type: 'scheduled-issuer',
            config: newConfig,
          });
        }
      });

      await manager.updateConfig({ quantity: 75 });

      const row = store.get('new-strategy');
      expect(row).not.toBeNull();
      expect(row!.config).toEqual({ instrumentSymbol: 'NEW', quantity: 75 });

      store.close();
    });

    it('survives a simulated restart cycle', async () => {
      const config = makeMultiStrategyConfig();
      seedDbFromFileConfig(config, dbPath);

      // "Runtime 1": update config via write-through
      const store1 = new StrategyConfigStore(dbPath);
      store1.init();

      const manager = new ConfigManager({
        initialConfig: { instrumentSymbol: 'TEST', quantity: 100 },
        schema: TestSchema,
        strategyId: 'issuer-1',
      });

      manager.onConfigChange((newConfig: Record<string, unknown>) => {
        store1.update('issuer-1', { config: newConfig });
      });

      await manager.updateConfig({ quantity: 777 });
      store1.close();

      // "Runtime 2": simulate restart — read from DB
      const merged = mergeStrategyConfigsFromDb(config);
      expect(merged.strategies[0].config).toEqual({
        instrumentSymbol: 'TEST',
        quantity: 777,
      });
    });
  });

  describe('critical listener rollback', () => {
    const TestSchema = z.object({
      instrumentSymbol: z.string(),
      quantity: z.number(),
    });

    it('fails the update and rolls back in-memory state when critical listener throws', async () => {
      const manager = new ConfigManager({
        initialConfig: { instrumentSymbol: 'TEST', quantity: 100 },
        schema: TestSchema,
        strategyId: 'critical-test',
      });

      manager.onConfigChange(
        () => {
          throw new Error('simulated DB failure');
        },
        { critical: true }
      );

      const result = await manager.updateConfig({ quantity: 999 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Persistence failed');
      expect(result.error).toContain('simulated DB failure');
      expect(manager.getConfig().quantity).toBe(100); // rolled back
    });

    it('fails the update when critical listener rejects async', async () => {
      const manager = new ConfigManager({
        initialConfig: { instrumentSymbol: 'TEST', quantity: 100 },
        schema: TestSchema,
      });

      manager.onConfigChange(
        async () => {
          await new Promise((r) => setTimeout(r, 1));
          throw new Error('async DB failure');
        },
        { critical: true }
      );

      const result = await manager.updateConfig({ quantity: 999 });

      expect(result.success).toBe(false);
      expect(manager.getConfig().quantity).toBe(100);
    });

    it('non-critical listener failure does NOT fail the update', async () => {
      const manager = new ConfigManager({
        initialConfig: { instrumentSymbol: 'TEST', quantity: 100 },
        schema: TestSchema,
      });

      manager.onConfigChange(() => {
        throw new Error('non-critical bang');
      });

      const result = await manager.updateConfig({ quantity: 42 });

      expect(result.success).toBe(true);
      expect(manager.getConfig().quantity).toBe(42);
    });

    it('runs critical listeners before non-critical and rolls back both on critical failure', async () => {
      const manager = new ConfigManager({
        initialConfig: { instrumentSymbol: 'TEST', quantity: 100 },
        schema: TestSchema,
      });

      const order: string[] = [];
      manager.onConfigChange(() => {
        order.push('non-critical');
      });
      manager.onConfigChange(
        () => {
          order.push('critical');
          throw new Error('fail');
        },
        { critical: true }
      );

      const result = await manager.updateConfig({ quantity: 1 });

      expect(result.success).toBe(false);
      // Critical ran, non-critical did NOT (because we aborted before post-commit phase)
      expect(order).toEqual(['critical']);
      expect(manager.getConfig().quantity).toBe(100);
    });

    it('PATCH end-to-end: write-through failure surfaces as a failure result', async () => {
      // Simulate a broken persistence layer with a mock store whose update throws.
      const brokenStore = {
        get: () => ({
          id: 'flaky',
          name: 'Flaky',
          type: 'scheduled-issuer',
          enabled: 1,
          config: { instrumentSymbol: 'OLD', quantity: 1 },
          credentialsEnvPrefix: null,
          version: 1,
          schemaVersion: 1,
          notes: null,
          createdAt: 0,
          updatedAt: 0,
        }),
        update: () => {
          throw new Error('disk full');
        },
      };

      const manager = new ConfigManager({
        initialConfig: { instrumentSymbol: 'OLD', quantity: 1 },
        schema: TestSchema,
        strategyId: 'flaky',
      });

      manager.onConfigChange(
        (newConfig: Record<string, unknown>) => {
          const existing = brokenStore.get();
          if (existing) {
            // This will throw because the mock rejects writes.
            (brokenStore as unknown as { update: (id: string, u: { config: unknown }) => void }).update('flaky', {
              config: newConfig,
            });
          }
        },
        { critical: true }
      );

      const result = await manager.updateConfig({ quantity: 2 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('disk full');
      expect(manager.getConfig().quantity).toBe(1); // rolled back
    });
  });

  describe('audit trail', () => {
    it('records a history row for every create', () => {
      const store = new StrategyConfigStore(dbPath);
      store.init();
      try {
        store.create({
          id: 'aud-1',
          name: 'Audited',
          type: 'scheduled-issuer',
          config: { v: 1 },
          actor: 'alice',
          reason: 'initial seed',
        });

        const history = store.history('aud-1');
        expect(history).toHaveLength(1);
        expect(history[0].actor).toBe('alice');
        expect(history[0].reason).toBe('initial seed');
        expect(history[0].version).toBe(1);
        expect(history[0].config).toEqual({ v: 1 });
      } finally {
        store.close();
      }
    });

    it('appends a history row on every update with correct version', () => {
      const store = new StrategyConfigStore(dbPath);
      store.init();
      try {
        store.create({
          id: 'aud-2',
          name: 'Audited',
          type: 'scheduled-issuer',
          config: { v: 1 },
        });
        store.update('aud-2', { config: { v: 2 }, actor: 'bob', reason: 'bump' });
        store.update('aud-2', { config: { v: 3 }, actor: 'carol', reason: 'bump again' });

        const history = store.history('aud-2');
        expect(history).toHaveLength(3);
        // Newest first
        expect(history[0].version).toBe(3);
        expect(history[0].actor).toBe('carol');
        expect(history[0].config).toEqual({ v: 3 });
        expect(history[1].version).toBe(2);
        expect(history[1].actor).toBe('bob');
        expect(history[2].version).toBe(1);
      } finally {
        store.close();
      }
    });

    it('defaults actor to "system" when none provided', () => {
      const store = new StrategyConfigStore(dbPath);
      store.init();
      try {
        store.create({
          id: 'aud-3',
          name: 'Audited',
          type: 'scheduled-issuer',
          config: { v: 1 },
        });
        const history = store.history('aud-3');
        expect(history[0].actor).toBe('system');
      } finally {
        store.close();
      }
    });

    it('limits history results to the requested count', () => {
      const store = new StrategyConfigStore(dbPath);
      store.init();
      try {
        store.create({
          id: 'aud-4',
          name: 'X',
          type: 'scheduled-issuer',
          config: { v: 0 },
        });
        for (let i = 1; i <= 5; i++) {
          store.update('aud-4', { config: { v: i } });
        }
        const history = store.history('aud-4', 2);
        expect(history).toHaveLength(2);
        expect(history[0].version).toBe(6);
        expect(history[1].version).toBe(5);
      } finally {
        store.close();
      }
    });
  });

  describe('schema version', () => {
    it('initializes new rows with CURRENT schema version', () => {
      const store = new StrategyConfigStore(dbPath);
      store.init();
      try {
        const row = store.create({
          id: 'sv-1',
          name: 'X',
          type: 'scheduled-issuer',
          config: { a: 1 },
        });
        expect(row.schemaVersion).toBe(1);
      } finally {
        store.close();
      }
    });

    it('accepts and persists an explicit schema version', () => {
      const store = new StrategyConfigStore(dbPath);
      store.init();
      try {
        store.create({
          id: 'sv-2',
          name: 'X',
          type: 'scheduled-issuer',
          config: { a: 1 },
          schemaVersion: 3,
        });
        const row = store.get('sv-2');
        expect(row!.schemaVersion).toBe(3);
      } finally {
        store.close();
      }
    });

    it('migrates older databases by adding schema_version column if missing', () => {
      // Create a "legacy" database without schema_version column
      const Database = require('better-sqlite3');
      const db = new Database(dbPath);
      db.exec(`
        CREATE TABLE strategy_configs (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1,
          config TEXT NOT NULL,
          credentials_env_prefix TEXT,
          version INTEGER NOT NULL DEFAULT 1,
          notes TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);
      const now = Date.now();
      db.prepare(
        `INSERT INTO strategy_configs
         (id, name, type, enabled, config, version, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, 1, ?, ?)`
      ).run('legacy-1', 'Legacy', 'scheduled-issuer', JSON.stringify({ old: true }), now, now);
      db.close();

      // Opening via StrategyConfigStore should migrate the schema
      const store = new StrategyConfigStore(dbPath);
      store.init();
      try {
        const row = store.get('legacy-1');
        expect(row).not.toBeNull();
        expect(row!.schemaVersion).toBe(1); // default after ALTER
        expect(row!.config).toEqual({ old: true });
      } finally {
        store.close();
      }
    });
  });

  describe('migration banner', () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('prints a prominent banner on first seed when rows are inserted', () => {
      const config = makeMultiStrategyConfig();
      const result = seedDbFromFileConfig(config, dbPath);

      expect(result.seeded).toBe(1);

      const bannerCall = warnSpy.mock.calls.find((call) =>
        String(call[0]).includes('STRATEGY CONFIG MIGRATION')
      );
      expect(bannerCall).toBeDefined();
      expect(String(bannerCall![0])).toContain('source of truth');
    });

    it('does NOT print the banner when no rows were seeded', () => {
      // Pre-populate the DB so seedDbFromFileConfig has nothing to insert
      const store = new StrategyConfigStore(dbPath);
      store.init();
      store.create({
        id: 'issuer-1',
        name: 'Already There',
        type: 'scheduled-issuer',
        config: { x: 1 },
      });
      store.close();

      warnSpy.mockClear();
      const result = seedDbFromFileConfig(makeMultiStrategyConfig(), dbPath);

      expect(result.seeded).toBe(0);
      const bannerCall = warnSpy.mock.calls.find((call) =>
        String(call[0]).includes('STRATEGY CONFIG MIGRATION')
      );
      expect(bannerCall).toBeUndefined();
    });
  });

  describe('shared store (single connection)', () => {
    it('seedDbFromFileConfig accepts an injected store and does not close it', () => {
      const store = new StrategyConfigStore(dbPath);
      store.init();

      seedDbFromFileConfig(makeMultiStrategyConfig(), { store });

      // Store is still usable (not closed)
      const row = store.get('issuer-1');
      expect(row).not.toBeNull();
      expect(row!.config).toEqual({ instrumentSymbol: 'TEST', quantity: 100 });

      // Still writable
      store.update('issuer-1', { config: { instrumentSymbol: 'CHANGED', quantity: 1 } });
      expect(store.get('issuer-1')!.config).toEqual({
        instrumentSymbol: 'CHANGED',
        quantity: 1,
      });

      store.close();
    });

    it('mergeStrategyConfigsFromDb accepts an injected store', () => {
      const store = new StrategyConfigStore(dbPath);
      store.init();

      const config = makeMultiStrategyConfig();
      seedDbFromFileConfig(config, { store });
      store.update('issuer-1', { config: { instrumentSymbol: 'MERGED', quantity: 42 } });

      const merged = mergeStrategyConfigsFromDb(config, { store });
      expect(merged.strategies[0].config).toEqual({
        instrumentSymbol: 'MERGED',
        quantity: 42,
      });

      // Still alive after merge
      expect(store.get('issuer-1')).not.toBeNull();
      store.close();
    });
  });

  describe('actor context propagation', () => {
    const TestSchema = z.object({
      instrumentSymbol: z.string(),
      quantity: z.number(),
    });

    it('write-through includes actor from ConfigManager context', async () => {
      const store = new StrategyConfigStore(dbPath);
      store.init();
      store.create({
        id: 'actor-test',
        name: 'X',
        type: 'scheduled-issuer',
        config: { instrumentSymbol: 'TEST', quantity: 1 },
      });

      const manager = new ConfigManager({
        initialConfig: { instrumentSymbol: 'TEST', quantity: 1 },
        schema: TestSchema,
        strategyId: 'actor-test',
      });

      manager.onConfigChange(
        (
          newConfig: Record<string, unknown>,
          _oldConfig,
          context
        ) => {
          store.update('actor-test', {
            config: newConfig,
            actor: (context?.actor as string) ?? 'unknown',
            reason: (context?.reason as string) ?? 'unknown',
          });
        },
        { critical: true }
      );

      await manager.updateConfig(
        { quantity: 99 },
        { actor: 'fp:deadbeef', reason: 'patch /config/x' }
      );

      const history = store.history('actor-test');
      expect(history[0].actor).toBe('fp:deadbeef');
      expect(history[0].reason).toBe('patch /config/x');
      expect(history[0].config).toEqual({ instrumentSymbol: 'TEST', quantity: 99 });

      store.close();
    });
  });

  describe('force reseed (STRATEGY_CONFIG_DB_FORCE_RESEED)', () => {
    let warnSpy: jest.SpyInstance;
    const originalEnv = process.env.STRATEGY_CONFIG_DB_FORCE_RESEED;

    beforeEach(() => {
      warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
      if (originalEnv === undefined) {
        delete process.env.STRATEGY_CONFIG_DB_FORCE_RESEED;
      } else {
        process.env.STRATEGY_CONFIG_DB_FORCE_RESEED = originalEnv;
      }
    });

    it('wipes existing rows and re-seeds from JSON when flag is "true"', () => {
      const store = new StrategyConfigStore(dbPath);
      store.init();
      store.create({
        id: 'issuer-1',
        name: 'Dashboard edit',
        type: 'scheduled-issuer',
        config: { instrumentSymbol: 'RUNTIME', quantity: 999 },
        actor: 'fp:dashboard',
        reason: 'patch /config/issuer-1',
      });
      store.update('issuer-1', {
        config: { instrumentSymbol: 'RUNTIME-V2', quantity: 1000 },
        actor: 'fp:dashboard',
        reason: 'patch /config/issuer-1',
      });
      expect(store.history('issuer-1').length).toBe(2);
      store.close();

      process.env.STRATEGY_CONFIG_DB_FORCE_RESEED = 'true';
      const result = seedDbFromFileConfig(makeMultiStrategyConfig(), dbPath);
      expect(result.seeded).toBe(1);

      const s2 = new StrategyConfigStore(dbPath);
      s2.init();
      try {
        const row = s2.get('issuer-1');
        expect(row).not.toBeNull();
        expect(row!.version).toBe(1);
        expect(row!.config).toEqual({ instrumentSymbol: 'TEST', quantity: 100 });

        const history = s2.history('issuer-1');
        expect(history).toHaveLength(1);
        expect(history[0].version).toBe(1);
        expect(history[0].actor).toBe('seed');
        expect(history[0].reason).toBe('force reseed from JSON config file');
      } finally {
        s2.close();
      }

      const forceBanner = warnSpy.mock.calls.find((call) =>
        String(call[0]).includes('STRATEGY CONFIG FORCE RESEED')
      );
      expect(forceBanner).toBeDefined();

      const migrationBanner = warnSpy.mock.calls.find((call) =>
        String(call[0]).includes('STRATEGY CONFIG MIGRATION')
      );
      expect(migrationBanner).toBeUndefined();
    });

    it('does nothing when flag is absent or not "true"', () => {
      const store = new StrategyConfigStore(dbPath);
      store.init();
      store.create({
        id: 'issuer-1',
        name: 'Runtime',
        type: 'scheduled-issuer',
        config: { instrumentSymbol: 'RUNTIME', quantity: 999 },
      });
      store.update('issuer-1', {
        config: { instrumentSymbol: 'RUNTIME-V2', quantity: 1000 },
      });
      store.close();

      process.env.STRATEGY_CONFIG_DB_FORCE_RESEED = 'yes'; // anything != "true"
      const result = seedDbFromFileConfig(makeMultiStrategyConfig(), dbPath);
      expect(result.seeded).toBe(0);
      expect(result.skipped).toBe(1);

      const s2 = new StrategyConfigStore(dbPath);
      s2.init();
      try {
        const row = s2.get('issuer-1');
        expect(row!.version).toBe(2);
        expect(row!.config).toEqual({ instrumentSymbol: 'RUNTIME-V2', quantity: 1000 });
      } finally {
        s2.close();
      }
    });
  });

  describe('drift warning', () => {
    let warnLoggerSpy: jest.SpyInstance;
    let warnConsoleSpy: jest.SpyInstance;

    beforeEach(() => {
      // mergeStrategyConfigsFromDb uses the structured logger; silence both
      warnConsoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      // logger.warn writes to console.log/info via winston transports; spy on logger itself
      // Lazy-require to grab the already-imported singleton
       
      const { logger } = require('../../../src/core/logging/logger');
      warnLoggerSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnConsoleSpy.mockRestore();
      warnLoggerSpy.mockRestore();
    });

    it('logs drift when SQLite body differs from JSON body', () => {
      const config = makeMultiStrategyConfig();
      seedDbFromFileConfig(config, dbPath);

      const store = new StrategyConfigStore(dbPath);
      store.init();
      store.update('issuer-1', {
        config: { instrumentSymbol: 'RUNTIME-EDIT', quantity: 42 },
        actor: 'fp:dashboard',
        reason: 'patch /config/issuer-1',
      });
      store.close();

      warnLoggerSpy.mockClear();
      mergeStrategyConfigsFromDb(config, { dbPath });

      const driftCall = warnLoggerSpy.mock.calls.find((call) =>
        String(call[0]).includes('SQLite config diverges from JSON')
      );
      expect(driftCall).toBeDefined();
      expect(String(driftCall![0])).toContain('issuer-1');
      expect(String(driftCall![0])).toContain('STRATEGY_CONFIG_DB_FORCE_RESEED');
    });

    it('does NOT log drift when SQLite and JSON bodies match', () => {
      const config = makeMultiStrategyConfig();
      seedDbFromFileConfig(config, dbPath);

      warnLoggerSpy.mockClear();
      mergeStrategyConfigsFromDb(config, { dbPath });

      const driftCall = warnLoggerSpy.mock.calls.find((call) =>
        String(call[0]).includes('SQLite config diverges from JSON')
      );
      expect(driftCall).toBeUndefined();
    });

    it('treats key-order differences as equal (stable stringify)', () => {
      const config = makeMultiStrategyConfig({
        strategies: [
          {
            id: 'issuer-1',
            name: 'Test Issuer',
            type: 'scheduled-issuer',
            enabled: true,
            config: { quantity: 100, instrumentSymbol: 'TEST' }, // reverse key order
          },
        ],
      });
      seedDbFromFileConfig(config, dbPath);

      warnLoggerSpy.mockClear();
      mergeStrategyConfigsFromDb(config, { dbPath });

      const driftCall = warnLoggerSpy.mock.calls.find((call) =>
        String(call[0]).includes('SQLite config diverges from JSON')
      );
      expect(driftCall).toBeUndefined();
    });
  });
});
