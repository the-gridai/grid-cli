/**
 * Multi-Strategy Configuration Schema
 * 
 * Defines the configuration format for running multiple trading strategies
 * in a single daemon instance. Each strategy can have its own configuration
 * while sharing credentials (for now).
 * 
 * @module multi-strategy-config
 */

import { z } from 'zod';
import fs from 'fs';
import { logger } from '../core/logging/logger';
import { StrategyConfigStore } from '../core/persistence/StrategyConfigStore';

/**
 * Per-strategy credentials configuration
 */
export const StrategyCredentialsSchema = z.object({
  /** Environment variable prefix for this strategy's credentials
   *  e.g., "MM_" means use MM_SIGNING_KEY, MM_SIGNING_KEY_FINGERPRINT, etc.
   */
  envPrefix: z.string().optional(),
}).optional();

export type StrategyCredentials = z.infer<typeof StrategyCredentialsSchema>;

/**
 * Strategy instance configuration
 */
export const StrategyInstanceSchema = z.object({
  /** Unique instance identifier */
  id: z.string().min(1),

  /** Human-readable name for logging */
  name: z.string().optional(),

  /**
   * Strategy type. Resolved to a module at `strategies/<type>/index.{js,ts}`
   * which must export `createStrategy(config)` (or a default class) and may
   * export `validateConfig(config)`. See StrategyInstance.createStrategy.
   */
  type: z.string().regex(/^[a-z0-9][a-z0-9-]*$/i, 'strategy type must be a directory-safe name'),

  /** Whether this instance is enabled */
  enabled: z.boolean().default(true),

  /** Startup ordering: lower numbers start first (default 100) */
  startupPriority: z.number().int().optional(),

  /** Per-strategy credentials (optional - defaults to shared credentials) */
  credentials: StrategyCredentialsSchema,

  /**
   * Strategy-specific configuration (validated by strategy itself).
   * When global `configSource` is `db`, may be omitted — loaded from SQLite `strategy_configs`.
   */
  config: z.record(z.string(), z.unknown()).optional(),
});

export type StrategyInstanceConfig = z.infer<typeof StrategyInstanceSchema>;

/**
 * Global settings for the multi-strategy daemon
 */
export const GlobalSettingsSchema = z.object({
  /** Health check port */
  healthPort: z.number().default(8080),

  /** Control API port (for dynamic config updates) */
  controlPort: z.number().optional(),

  /** Enable control API (default: true if controlPort specified) */
  enableControlApi: z.boolean().optional(),

  /**
   * Profile name from ~/.grid-cli/credentials.json used to verify Control API write requests (PATCH/PUT).
   * Must match the credentials you use in the dashboard (e.g. marketmaker-ui "Write access").
   * If omitted, uses GRID_PROFILE env or the default profile.
   */
  controlApiProfile: z.string().optional(),

  /** Log level */
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  /** Enable Sentry error tracking */
  sentryEnabled: z.boolean().default(false),

  /**
   * Where per-strategy JSON configs are loaded from.
   * - `file`: use `config` on each strategy in the multi-strategy JSON file.
   * - `db` (default): load strategy body from SQLite table `strategy_configs` (see `strategyConfigDbPath`).
   *   On first boot the JSON file is auto-seeded into SQLite; subsequent boots read from SQLite.
   */
  configSource: z.enum(['file', 'db']).optional(),

  /**
   * SQLite file path for `strategy_configs` when `configSource` is `db`.
   * Defaults to `STRATEGY_CONFIG_DB_PATH` or `GRID_SQLITE_PATH` or `./grid-strategies.sqlite`.
   */
  strategyConfigDbPath: z.string().min(1).optional(),
}).optional().transform(v => ({
  healthPort: v?.healthPort ?? 8080,
  controlPort: v?.controlPort,
  enableControlApi: v?.enableControlApi ?? (v?.controlPort !== undefined),
  controlApiProfile: v?.controlApiProfile,
  logLevel: v?.logLevel ?? 'info' as const,
  sentryEnabled: v?.sentryEnabled ?? false,
  configSource: v?.configSource ?? 'db' as const,
  strategyConfigDbPath: v?.strategyConfigDbPath,
}));

export type GlobalSettings = z.infer<typeof GlobalSettingsSchema>;

/**
 * Top-level multi-strategy configuration
 */
export const MultiStrategyConfigSchema = z
  .object({
    /** Config version for future migrations */
    version: z.literal('1.0'),

    /** Strategy instances to run */
    strategies: z.array(StrategyInstanceSchema).min(1),

    /** Global daemon settings */
    global: GlobalSettingsSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const source = data.global?.configSource ?? 'file';
    if (source === 'db') {
      return;
    }
    for (let i = 0; i < data.strategies.length; i++) {
      const s = data.strategies[i];
      if (s.enabled !== false && (s.config === undefined || Object.keys(s.config).length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `strategies[${i}].config is required when global.configSource is "file"`,
          path: ['strategies', i, 'config'],
        });
      }
    }
  });

export type MultiStrategyConfig = z.infer<typeof MultiStrategyConfigSchema>;

/**
 * Load and validate multi-strategy configuration from a file
 * 
 * @param configPath - Path to the JSON configuration file
 * @returns Validated configuration object
 * @throws Error if file not found or validation fails
 */
export function loadMultiStrategyConfig(configPath: string): MultiStrategyConfig {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Multi-strategy config file not found: ${configPath}`);
  }

  const content = fs.readFileSync(configPath, 'utf8');
  let rawConfig: unknown;

  try {
    rawConfig = JSON.parse(content);
  } catch {
    throw new Error(`Invalid JSON in multi-strategy config: ${configPath}`);
  }

  const result = MultiStrategyConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    const errors = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Invalid multi-strategy config: ${errors}`);
  }

  logger.info('Loaded multi-strategy configuration', {
    configPath,
    strategyCount: result.data.strategies.length,
    enabledCount: result.data.strategies.filter(s => s.enabled).length,
  });

  return result.data;
}

/**
 * Validate a multi-strategy configuration object
 * 
 * @param config - Configuration object to validate
 * @returns Validated configuration
 * @throws Error if validation fails
 */
export function validateMultiStrategyConfig(config: unknown): MultiStrategyConfig {
  return MultiStrategyConfigSchema.parse(config);
}

/**
 * Resolve effective config source: env `STRATEGY_CONFIG_SOURCE` overrides file `global.configSource`.
 */
export function resolveConfigSource(global?: MultiStrategyConfig['global']): 'file' | 'db' {
  const env = process.env.STRATEGY_CONFIG_SOURCE?.toLowerCase();
  if (env === 'db' || env === 'file') {
    return env;
  }
  return global?.configSource ?? 'db';
}

/**
 * Resolve an effective DB path from (in order): explicit arg,
 * `global.strategyConfigDbPath`, `STRATEGY_CONFIG_DB_PATH`, `GRID_SQLITE_PATH`.
 */
function resolveDbPathForConfig(
  config: MultiStrategyConfig,
  explicit?: string
): string | undefined {
  return (
    explicit ||
    config.global?.strategyConfigDbPath ||
    process.env.STRATEGY_CONFIG_DB_PATH ||
    process.env.GRID_SQLITE_PATH
  );
}

/**
 * Shared-store options for seed/merge functions. When `store` is provided it
 * is used verbatim (no init/close). When omitted an internal store is opened
 * from `dbPath` (or environment) and closed when the call returns.
 */
export interface DbAccessOptions {
  store?: StrategyConfigStore;
  dbPath?: string;
}

function withStore<R>(
  config: MultiStrategyConfig,
  opts: DbAccessOptions | undefined,
  fn: (store: StrategyConfigStore) => R
): R {
  if (opts?.store) {
    opts.store.init();
    return fn(opts.store);
  }
  const store = new StrategyConfigStore(resolveDbPathForConfig(config, opts?.dbPath));
  store.init();
  try {
    return fn(store);
  } finally {
    store.close();
  }
}

/**
 * Seed SQLite `strategy_configs` from a loaded multi-strategy JSON file.
 *
 * For each enabled strategy that has a non-empty `config` in the JSON file,
 * inserts a row into SQLite **only if no row exists yet** for that strategy id.
 * Existing rows are never overwritten — the DB is the authority once seeded.
 *
 * This makes the JSON file an import/bootstrap mechanism rather than the
 * ongoing source of truth. If any rows are newly inserted, a prominent
 * migration banner is logged so operators know runtime edits to the JSON
 * file will be ignored from now on.
 */
export function seedDbFromFileConfig(
  config: MultiStrategyConfig,
  dbPathOrOpts?: string | DbAccessOptions
): { seeded: number; skipped: number } {
  const opts: DbAccessOptions =
    typeof dbPathOrOpts === 'string'
      ? { dbPath: dbPathOrOpts }
      : (dbPathOrOpts ?? {});

  return withStore(config, opts, (store) => {
    let seeded = 0;
    let skipped = 0;

    const forceReseed = process.env.STRATEGY_CONFIG_DB_FORCE_RESEED === 'true';
    const isSeedReason = forceReseed
      ? 'force reseed from JSON config file'
      : 'bootstrap from JSON config file';
    if (forceReseed) {
      const removed = store.deleteAll();
      logForceReseedBanner(store.getDbPath(), removed);
    }

    for (const s of config.strategies) {
      if (s.enabled === false) {
        skipped++;
        continue;
      }
      if (!s.config || Object.keys(s.config).length === 0) {
        skipped++;
        continue;
      }

      const existing = store.get(s.id);
      if (existing) {
        logger.debug('Strategy already in SQLite, skipping seed', { id: s.id });
        skipped++;
        continue;
      }

      store.create({
        id: s.id,
        name: s.name || s.id,
        type: s.type,
        config: s.config,
        credentialsEnvPrefix: s.credentials?.envPrefix ?? null,
        actor: 'seed',
        reason: isSeedReason,
      });
      seeded++;
      logger.info('Seeded strategy config into SQLite from JSON file', {
        id: s.id,
        type: s.type,
        forceReseed,
      });
    }

    if (seeded > 0 && !forceReseed) {
      logMigrationBanner(store.getDbPath(), seeded);
    }

    return { seeded, skipped };
  });
}

/**
 * When `configSource` is `db`, replace each enabled strategy's `config` with the JSON
 * stored in SQLite (`strategy_configs` table). Disabled strategies keep file config if any.
 */
export function mergeStrategyConfigsFromDb(
  config: MultiStrategyConfig,
  opts?: DbAccessOptions
): MultiStrategyConfig {
  const source = resolveConfigSource(config.global);
  if (source !== 'db') {
    return config;
  }

  return withStore(config, opts, (store) => {
    const drifted: string[] = [];

    const strategies = config.strategies.map((s) => {
      if (s.enabled === false) {
        return {
          ...s,
          config: s.config ?? {},
        };
      }

      const row = store.get(s.id);
      if (!row) {
        throw new Error(
          `configSource is "db" but no row in strategy_configs for strategy id "${s.id}" ` +
            `(db: ${store.getDbPath()})`
        );
      }

      if (row.type !== s.type) {
        logger.warn('Strategy type mismatch: multi-strategy file vs strategy_configs row', {
          id: s.id,
          fileType: s.type,
          dbType: row.type,
        });
      }

      if (s.config && Object.keys(s.config).length > 0 && !deepEqualConfig(s.config, row.config)) {
        drifted.push(s.id);
      }

      return {
        ...s,
        name: s.name ?? row.name,
        config: row.config,
      };
    });

    if (drifted.length > 0) {
      logger.warn(
        `[config] SQLite config diverges from JSON for ${drifted.length} strategy/ies: ` +
          `[${drifted.join(', ')}]. SQLite is authoritative. ` +
          `Set STRATEGY_CONFIG_DB_FORCE_RESEED=true to reseed from JSON on next boot.`,
        { strategies: drifted, dbPath: store.getDbPath() }
      );
    }

    return { ...config, strategies };
  });
}

function deepEqualConfig(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k]))
      .join(',') +
    '}'
  );
}

/**
 * Emit a prominent, one-time banner when the JSON file is first migrated
 * into SQLite. Used by operators to understand the switch of source-of-truth.
 */
function logMigrationBanner(dbPath: string, seeded: number): void {
  const banner = [
    '',
    '═'.repeat(72),
    '⚠️  STRATEGY CONFIG MIGRATION',
    '═'.repeat(72),
    `Seeded ${seeded} strategy config${seeded === 1 ? '' : 's'} into SQLite at:`,
    `  ${dbPath}`,
    '',
    'From this point on SQLite is the source of truth for strategy bodies.',
    'Edits to the JSON config file will NOT be picked up on restart.',
    'To restore file-based config, set `global.configSource: "file"` or env',
    '`STRATEGY_CONFIG_SOURCE=file` and delete/ignore the SQLite rows.',
    '═'.repeat(72),
    '',
  ].join('\n');
  // Print to both stderr (so it shows in container logs even without a logger sink)
  // and through the structured logger.
   
  console.warn(banner);
  logger.warn('Strategy config migrated to SQLite (first-boot)', { dbPath, seeded });
}

function logForceReseedBanner(dbPath: string, removed: number): void {
  const banner = [
    '',
    '═'.repeat(72),
    '⚠️  STRATEGY CONFIG FORCE RESEED',
    '═'.repeat(72),
    `STRATEGY_CONFIG_DB_FORCE_RESEED=true — wiped ${removed} strategy row${removed === 1 ? '' : 's'}`,
    `(and all history) at: ${dbPath}`,
    '',
    'Any runtime (dashboard / control-API) edits made since the last seed have',
    'been DISCARDED. Rows will be rewritten from the JSON config file below as',
    'fresh v1 entries with actor="seed".',
    '',
    'Unset STRATEGY_CONFIG_DB_FORCE_RESEED (or set it to anything other than',
    '"true") before the next deploy so runtime edits are preserved again.',
    '═'.repeat(72),
    '',
  ].join('\n');
   
  console.warn(banner);
  logger.warn('Strategy config force-reseed from JSON', { dbPath, removed });
}
