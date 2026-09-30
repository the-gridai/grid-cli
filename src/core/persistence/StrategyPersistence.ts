/**
 * Strategy Persistence - SQLite Implementation
 * 
 * Provides SQLite-based persistence with automatic table prefixing
 * to allow multiple strategies to share the same database file.
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { logger } from '../logging/logger';
import type { PersistenceAdapter, PersistencePayload, PersistenceTable } from './types';
import { PERSISTENCE_TABLES } from './types';

/**
 * Default database path
 */
export const DEFAULT_DB_PATH = './grid-strategies.sqlite';

/**
 * Environment variable for database path override
 */
export const DB_PATH_ENV_VAR = 'GRID_SQLITE_PATH';

/**
 * Options for creating a StrategyPersistence instance
 */
export interface StrategyPersistenceOptions {
  /**
   * Path to the SQLite database file.
   * Falls back to GRID_SQLITE_PATH env var, then DEFAULT_DB_PATH.
   */
  dbPath?: string;

  /**
   * Prefix for table names (e.g., 'cmm' creates 'cmm_orders', 'cmm_fills', etc.)
   * This should be a short, unique identifier for the strategy.
   */
  strategyPrefix: string;

  /**
   * Whether persistence is enabled. If false, acts as a no-op.
   */
  enabled?: boolean;
}

/**
 * Internal record structure for SQLite inserts
 */
interface InsertableRecord {
  ts: number;
  payload: string;
}

/**
 * SQLite-based persistence adapter with table prefixing
 * 
 * Each strategy uses its own set of tables prefixed with its identifier:
 * - cmm_orders, cmm_fills, cmm_position_snapshots, etc.
 * - ipmm_orders, ipmm_fills, ipmm_position_snapshots, etc.
 * - sd_orders, sd_fills, sd_position_snapshots, etc.
 */
/** Tables that accumulate one row per event and should be pruned by age. */
const PRUNABLE_TABLES: PersistenceTable[] = [
  'orders',
  'fills',
  'position_snapshots',
  'pnl_snapshots',
  'decisions',
].filter((t): t is PersistenceTable => (PERSISTENCE_TABLES as readonly string[]).includes(t));

export class StrategyPersistence implements PersistenceAdapter {
  private db: Database.Database | null = null;
  private readonly dbPath: string;
  private readonly prefix: string;
  private readonly enabled: boolean;
  private initialized = false;
  private pruneHandle: NodeJS.Timeout | null = null;
  private readonly retentionMs: number;

  constructor(options: StrategyPersistenceOptions) {
    this.dbPath = options.dbPath 
      || process.env[DB_PATH_ENV_VAR] 
      || DEFAULT_DB_PATH;
    this.prefix = options.strategyPrefix;
    this.enabled = options.enabled ?? true;

    // Event tables (orders/fills/snapshots) are append-only and otherwise grow
    // without bound on disk. Retain a rolling window; default 7 days, override
    // via GRID_PERSISTENCE_RETENTION_DAYS (0 disables pruning).
    const retentionDays = Number(process.env.GRID_PERSISTENCE_RETENTION_DAYS ?? '7');
    this.retentionMs = Number.isFinite(retentionDays) && retentionDays > 0
      ? retentionDays * 24 * 60 * 60 * 1000
      : 0;

    // Validate prefix
    if (!/^[a-z][a-z0-9_]*$/i.test(this.prefix)) {
      throw new Error(`Invalid strategy prefix: "${this.prefix}". Must be alphanumeric with underscores, starting with a letter.`);
    }
  }

  /**
   * Get the prefixed table name
   */
  private tableName(table: PersistenceTable): string {
    return `${this.prefix}_${table}`;
  }

  /**
   * Initialize the database and create tables
   */
  async init(): Promise<void> {
    if (!this.enabled) {
      logger.info('Persistence disabled, skipping initialization');
      return;
    }

    if (this.initialized) {
      return;
    }

    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (dir && dir !== '.' && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Open database
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');

    // Create tables with prefixed names
    const createTableSQL = PERSISTENCE_TABLES.map(table => `
      CREATE TABLE IF NOT EXISTS ${this.tableName(table)} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_${this.tableName(table)}_ts ON ${this.tableName(table)}(ts);
    `).join('\n');

    this.db.exec(createTableSQL);
    this.initialized = true;

    logger.info('Persistence initialized', { 
      dbPath: this.dbPath, 
      prefix: this.prefix,
      tables: PERSISTENCE_TABLES.map(t => this.tableName(t)),
    });

    // Prune once at startup, then hourly, so append-only event tables stay bounded.
    if (this.retentionMs > 0) {
      this.pruneOldRecords();
      this.pruneHandle = setInterval(() => this.pruneOldRecords(), 60 * 60 * 1000);
      // Don't keep the process alive solely for pruning.
      this.pruneHandle.unref?.();
    }
  }

  /**
   * Delete rows older than the retention window from append-only event tables,
   * then checkpoint the WAL so freed pages are reclaimed on disk.
   */
  private pruneOldRecords(): void {
    if (!this.enabled || !this.db || this.retentionMs <= 0) {
      return;
    }
    const cutoff = Date.now() - this.retentionMs;
    try {
      let deleted = 0;
      for (const table of PRUNABLE_TABLES) {
        const stmt = this.db.prepare(
          `DELETE FROM ${this.tableName(table)} WHERE ts < ?`
        );
        deleted += stmt.run(cutoff).changes;
      }
      if (deleted > 0) {
        this.db.pragma('wal_checkpoint(TRUNCATE)');
        logger.info('Persistence pruned old records', {
          prefix: this.prefix,
          deleted,
          retentionMs: this.retentionMs,
        });
      }
    } catch (error: any) {
      logger.error('Failed to prune persistence records', {
        prefix: this.prefix,
        error: error.message,
      });
    }
  }

  /**
   * Insert a record into a table
   */
  private insert(table: PersistenceTable, payload: PersistencePayload): void {
    if (!this.enabled || !this.db) {
      return;
    }

    const record: InsertableRecord = {
      ts: Date.now(),
      payload: JSON.stringify(payload),
    };

    try {
      const stmt = this.db.prepare(
        `INSERT INTO ${this.tableName(table)} (ts, payload) VALUES (@ts, @payload)`
      );
      stmt.run(record);
    } catch (error: any) {
      logger.error('Failed to insert persistence record', { 
        table: this.tableName(table), 
        error: error.message,
      });
    }
  }

  async saveOrder(payload: PersistencePayload): Promise<void> {
    this.insert('orders', payload);
  }

  async saveFill(payload: PersistencePayload): Promise<void> {
    this.insert('fills', payload);
  }

  async savePositionSnapshot(payload: PersistencePayload): Promise<void> {
    this.insert('position_snapshots', payload);
  }

  async savePnlSnapshot(payload: PersistencePayload): Promise<void> {
    this.insert('pnl_snapshots', payload);
  }

  async saveDecision(payload: PersistencePayload): Promise<void> {
    this.insert('decisions', payload);
  }

  async saveKillSwitchState(payload: PersistencePayload): Promise<void> {
    this.insert('kill_switch', payload);
  }

  async loadLatestKillSwitchState(): Promise<PersistencePayload | null> {
    if (!this.enabled || !this.db) {
      return null;
    }

    try {
      const stmt = this.db.prepare(
        `SELECT payload FROM ${this.tableName('kill_switch')} ORDER BY id DESC LIMIT 1`
      );
      const row = stmt.get() as { payload?: string } | undefined;
      
      if (!row?.payload) {
        return null;
      }
      
      return JSON.parse(row.payload) as PersistencePayload;
    } catch (error: any) {
      logger.error('Failed to load kill switch state', { error: error.message });
      return null;
    }
  }

  private loadRecords(table: PersistenceTable, limit: number = 1000): PersistencePayload[] {
    if (!this.enabled || !this.db) {
      return [];
    }

    try {
      const stmt = this.db.prepare(
        `SELECT payload FROM ${this.tableName(table)} ORDER BY id DESC LIMIT ?`
      );
      const rows = stmt.all(limit) as Array<{ payload?: string }>;
      return rows
        .map((row) => {
          if (!row?.payload) return null;
          try {
            return JSON.parse(row.payload) as PersistencePayload;
          } catch {
            return null;
          }
        })
        .filter((row): row is PersistencePayload => row !== null);
    } catch (error: any) {
      logger.error('Failed to load persistence records', {
        table: this.tableName(table),
        error: error.message,
      });
      return [];
    }
  }

  async loadOrders(limit: number = 1000): Promise<PersistencePayload[]> {
    return this.loadRecords('orders', limit);
  }

  async loadFills(limit: number = 1000): Promise<PersistencePayload[]> {
    return this.loadRecords('fills', limit);
  }

  async loadLatestPositionSnapshot(): Promise<PersistencePayload | null> {
    const rows = this.loadRecords('position_snapshots', 1);
    return rows.length > 0 ? rows[0] : null;
  }

  async flush(): Promise<void> {
    // SQLite with WAL mode auto-commits; nothing to flush
  }

  async close(): Promise<void> {
    if (this.pruneHandle) {
      clearInterval(this.pruneHandle);
      this.pruneHandle = null;
    }
    if (this.db) {
      try {
        this.db.close();
        this.db = null;
        this.initialized = false;
        logger.info('Persistence closed', { prefix: this.prefix });
      } catch (error: any) {
        logger.error('Failed to close persistence', { error: error.message });
      }
    }
  }

  /**
   * Get the database path being used
   */
  getDbPath(): string {
    return this.dbPath;
  }

  /**
   * Get the table prefix being used
   */
  getPrefix(): string {
    return this.prefix;
  }

  /**
   * Check if persistence is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

/**
 * Create a persistence adapter for a strategy
 * 
 * @param strategyPrefix - Short identifier for the strategy (e.g., 'cmm', 'sd')
 * @param options - Additional options
 * @returns Configured persistence adapter
 */
export function createPersistence(
  strategyPrefix: string,
  options: { enabled?: boolean; dbPath?: string } = {}
): StrategyPersistence {
  return new StrategyPersistence({
    strategyPrefix,
    enabled: options.enabled,
    dbPath: options.dbPath,
  });
}
