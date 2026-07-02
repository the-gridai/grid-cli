/**
 * Persistent storage for multi-strategy daemon strategy JSON configs (SQLite).
 *
 * Separate from StrategyPersistence (orders/fills audit tables) — same DB file
 * may host both: this uses fixed table names `strategy_configs` and
 * `strategy_config_history`.
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { logger } from '../logging/logger';
import { DEFAULT_DB_PATH, DB_PATH_ENV_VAR } from './StrategyPersistence';

export const STRATEGY_CONFIG_TABLE = 'strategy_configs';
export const STRATEGY_CONFIG_HISTORY_TABLE = 'strategy_config_history';

/**
 * Current schema version used when writing *new* rows.
 * Strategy types can validate the version on read and trigger migrations
 * if a row's `schemaVersion` is lower than expected.
 */
export const CURRENT_STRATEGY_CONFIG_SCHEMA_VERSION = 1;

export interface SavedStrategyConfigRow {
  id: string;
  name: string;
  type: string;
  enabled: number;
  config: Record<string, unknown>;
  credentialsEnvPrefix: string | null;
  version: number;
  schemaVersion: number;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface StrategyConfigHistoryRow {
  historyId: number;
  strategyId: string;
  version: number;
  schemaVersion: number;
  config: Record<string, unknown>;
  actor: string;
  reason: string | null;
  createdAt: number;
}

export interface CreateStrategyConfigInput {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  enabled?: boolean;
  credentialsEnvPrefix?: string | null;
  notes?: string | null;
  schemaVersion?: number;
  actor?: string;
  reason?: string;
}

export interface UpdateStrategyConfigInput {
  name?: string;
  type?: string;
  config?: Record<string, unknown>;
  enabled?: boolean;
  credentialsEnvPrefix?: string | null;
  notes?: string | null;
  schemaVersion?: number;
  actor?: string;
  reason?: string;
}

function resolveDbPath(explicit?: string): string {
  return explicit || process.env[DB_PATH_ENV_VAR] || process.env.STRATEGY_CONFIG_DB_PATH || DEFAULT_DB_PATH;
}

export class StrategyConfigStore {
  private db: Database.Database | null = null;
  private readonly dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = resolveDbPath(dbPath);
  }

  getDbPath(): string {
    return this.dbPath;
  }

  /**
   * Open DB and ensure tables / columns exist. Idempotent, supports upgrading
   * older DBs that were created before `schema_version` / history existed.
   */
  init(): void {
    if (this.db) {
      return;
    }

    const dir = path.dirname(this.dbPath);
    if (dir && dir !== '.' && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${STRATEGY_CONFIG_TABLE} (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        config TEXT NOT NULL,
        credentials_env_prefix TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        schema_version INTEGER NOT NULL DEFAULT ${CURRENT_STRATEGY_CONFIG_SCHEMA_VERSION},
        notes TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_${STRATEGY_CONFIG_TABLE}_type ON ${STRATEGY_CONFIG_TABLE}(type);
      CREATE INDEX IF NOT EXISTS idx_${STRATEGY_CONFIG_TABLE}_enabled ON ${STRATEGY_CONFIG_TABLE}(enabled);

      CREATE TABLE IF NOT EXISTS ${STRATEGY_CONFIG_HISTORY_TABLE} (
        history_id INTEGER PRIMARY KEY AUTOINCREMENT,
        strategy_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        schema_version INTEGER NOT NULL,
        config TEXT NOT NULL,
        actor TEXT NOT NULL,
        reason TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_${STRATEGY_CONFIG_HISTORY_TABLE}_strategy_id
        ON ${STRATEGY_CONFIG_HISTORY_TABLE}(strategy_id, created_at DESC);
    `);

    this.addColumnIfMissing(STRATEGY_CONFIG_TABLE, 'schema_version', `INTEGER NOT NULL DEFAULT ${CURRENT_STRATEGY_CONFIG_SCHEMA_VERSION}`);

    logger.info('StrategyConfigStore initialized', { dbPath: this.dbPath });
  }

  private addColumnIfMissing(table: string, column: string, definition: string): void {
    if (!this.db) return;
    const cols = this.db
      .prepare(`PRAGMA table_info(${table})`)
      .all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === column)) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      logger.info('StrategyConfigStore: migrated table', { table, addedColumn: column });
    }
  }

  /**
   * Close the underlying DB connection (idempotent).
   */
  close(): void {
    if (this.db) {
      try {
        this.db.close();
      } catch {
        // ignore
      }
      this.db = null;
    }
  }

  list(): SavedStrategyConfigRow[] {
    this.init();
    const rows = this.db!
      .prepare(
        `SELECT id, name, type, enabled, config, credentials_env_prefix, version, schema_version, notes, created_at, updated_at
         FROM ${STRATEGY_CONFIG_TABLE} ORDER BY id`
      )
      .all() as Array<RawRow>;

    return rows.map(mapRow);
  }

  get(id: string): SavedStrategyConfigRow | null {
    this.init();
    const r = this.db!
      .prepare(
        `SELECT id, name, type, enabled, config, credentials_env_prefix, version, schema_version, notes, created_at, updated_at
         FROM ${STRATEGY_CONFIG_TABLE} WHERE id = ?`
      )
      .get(id) as RawRow | undefined;

    if (!r) return null;
    return mapRow(r);
  }

  getByType(strategyType: string): SavedStrategyConfigRow[] {
    this.init();
    const rows = this.db!
      .prepare(
        `SELECT id, name, type, enabled, config, credentials_env_prefix, version, schema_version, notes, created_at, updated_at
         FROM ${STRATEGY_CONFIG_TABLE} WHERE type = ? ORDER BY id`
      )
      .all(strategyType) as Array<RawRow>;

    return rows.map(mapRow);
  }

  create(input: CreateStrategyConfigInput): SavedStrategyConfigRow {
    this.init();
    const now = Date.now();
    const enabled = input.enabled !== false ? 1 : 0;
    const configJson = JSON.stringify(input.config);
    const schemaVersion = input.schemaVersion ?? CURRENT_STRATEGY_CONFIG_SCHEMA_VERSION;
    const actor = input.actor ?? 'system';

    const insertConfig = this.db!.prepare(
      `INSERT INTO ${STRATEGY_CONFIG_TABLE}
       (id, name, type, enabled, config, credentials_env_prefix, version, schema_version, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`
    );
    const insertHistory = this.db!.prepare(
      `INSERT INTO ${STRATEGY_CONFIG_HISTORY_TABLE}
       (strategy_id, version, schema_version, config, actor, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    const txn = this.db!.transaction(() => {
      insertConfig.run(
        input.id,
        input.name,
        input.type,
        enabled,
        configJson,
        input.credentialsEnvPrefix ?? null,
        schemaVersion,
        input.notes ?? null,
        now,
        now
      );
      insertHistory.run(
        input.id,
        1,
        schemaVersion,
        configJson,
        actor,
        input.reason ?? 'create',
        now
      );
    });
    txn();

    return this.get(input.id)!;
  }

  update(id: string, input: UpdateStrategyConfigInput): SavedStrategyConfigRow | null {
    this.init();
    const existing = this.get(id);
    if (!existing) return null;

    const name = input.name ?? existing.name;
    const type = input.type ?? existing.type;
    const enabled = input.enabled !== undefined ? (input.enabled ? 1 : 0) : existing.enabled;
    const config = input.config ?? existing.config;
    const credentialsEnvPrefix =
      input.credentialsEnvPrefix !== undefined
        ? input.credentialsEnvPrefix
        : existing.credentialsEnvPrefix;
    const notes = input.notes !== undefined ? input.notes : existing.notes;
    const version = existing.version + 1;
    const schemaVersion = input.schemaVersion ?? existing.schemaVersion;
    const configJson = JSON.stringify(config);
    const actor = input.actor ?? 'system';
    const now = Date.now();

    const updateConfig = this.db!.prepare(
      `UPDATE ${STRATEGY_CONFIG_TABLE}
       SET name = ?, type = ?, enabled = ?, config = ?, credentials_env_prefix = ?, version = ?, schema_version = ?, notes = ?, updated_at = ?
       WHERE id = ?`
    );
    const insertHistory = this.db!.prepare(
      `INSERT INTO ${STRATEGY_CONFIG_HISTORY_TABLE}
       (strategy_id, version, schema_version, config, actor, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    const txn = this.db!.transaction(() => {
      updateConfig.run(
        name,
        type,
        enabled,
        configJson,
        credentialsEnvPrefix,
        version,
        schemaVersion,
        notes,
        now,
        id
      );
      insertHistory.run(
        id,
        version,
        schemaVersion,
        configJson,
        actor,
        input.reason ?? 'update',
        now
      );
    });
    txn();

    return this.get(id);
  }

  delete(id: string): boolean {
    this.init();
    const result = this.db!.prepare(`DELETE FROM ${STRATEGY_CONFIG_TABLE} WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  /**
   * Truncate `strategy_configs` and `strategy_config_history` in a single
   * transaction. Returns the number of strategy rows that were removed.
   */
  deleteAll(): number {
    this.init();
    const countStmt = this.db!.prepare(`SELECT COUNT(*) AS c FROM ${STRATEGY_CONFIG_TABLE}`);
    const deleteConfigs = this.db!.prepare(`DELETE FROM ${STRATEGY_CONFIG_TABLE}`);
    const deleteHistory = this.db!.prepare(`DELETE FROM ${STRATEGY_CONFIG_HISTORY_TABLE}`);

    let removed = 0;
    const txn = this.db!.transaction(() => {
      const before = countStmt.get() as { c: number };
      removed = before.c;
      deleteHistory.run();
      deleteConfigs.run();
    });
    txn();
    return removed;
  }

  /**
   * Return audit history for a strategy, newest first.
   */
  history(strategyId: string, limit: number = 50): StrategyConfigHistoryRow[] {
    this.init();
    const rows = this.db!
      .prepare(
        `SELECT history_id, strategy_id, version, schema_version, config, actor, reason, created_at
         FROM ${STRATEGY_CONFIG_HISTORY_TABLE}
         WHERE strategy_id = ?
         ORDER BY created_at DESC, history_id DESC
         LIMIT ?`
      )
      .all(strategyId, limit) as Array<RawHistoryRow>;

    return rows.map(mapHistoryRow);
  }

  /**
   * Upsert from a JSON file body (single strategy config object, not multi-strategy wrapper).
   */
  importFromJsonFile(
    filePath: string,
    meta: { id: string; name: string; type: string; credentialsEnvPrefix?: string | null; notes?: string | null; actor?: string; reason?: string }
  ): SavedStrategyConfigRow {
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error(`Expected JSON object in ${filePath}`);
    }
    const config = parsed as Record<string, unknown>;
    const existing = this.get(meta.id);
    if (existing) {
      return this.update(meta.id, {
        name: meta.name,
        type: meta.type,
        config,
        credentialsEnvPrefix: meta.credentialsEnvPrefix ?? existing.credentialsEnvPrefix,
        notes: meta.notes ?? existing.notes,
        actor: meta.actor ?? 'import',
        reason: meta.reason ?? `import from ${filePath}`,
      })!;
    }
    return this.create({
      id: meta.id,
      name: meta.name,
      type: meta.type,
      config,
      enabled: true,
      credentialsEnvPrefix: meta.credentialsEnvPrefix ?? null,
      notes: meta.notes ?? null,
      actor: meta.actor ?? 'import',
      reason: meta.reason ?? `import from ${filePath}`,
    });
  }
}

interface RawRow {
  id: string;
  name: string;
  type: string;
  enabled: number;
  config: string;
  credentials_env_prefix: string | null;
  version: number;
  schema_version: number;
  notes: string | null;
  created_at: number;
  updated_at: number;
}

interface RawHistoryRow {
  history_id: number;
  strategy_id: string;
  version: number;
  schema_version: number;
  config: string;
  actor: string;
  reason: string | null;
  created_at: number;
}

function mapRow(r: RawRow): SavedStrategyConfigRow {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    enabled: r.enabled,
    config: JSON.parse(r.config) as Record<string, unknown>,
    credentialsEnvPrefix: r.credentials_env_prefix,
    version: r.version,
    schemaVersion: r.schema_version,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapHistoryRow(r: RawHistoryRow): StrategyConfigHistoryRow {
  return {
    historyId: r.history_id,
    strategyId: r.strategy_id,
    version: r.version,
    schemaVersion: r.schema_version,
    config: JSON.parse(r.config) as Record<string, unknown>,
    actor: r.actor,
    reason: r.reason,
    createdAt: r.created_at,
  };
}

export function createStrategyConfigStore(dbPath?: string): StrategyConfigStore {
  return new StrategyConfigStore(dbPath);
}
