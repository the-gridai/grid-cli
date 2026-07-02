/**
 * Persistence Configuration Schema
 * 
 * Shared Zod schema for persistence configuration used by all strategies.
 */

import { z } from 'zod';
import { DEFAULT_DB_PATH, DB_PATH_ENV_VAR } from './StrategyPersistence';

/**
 * Base persistence configuration schema (without default)
 * Use this when you need to extend the schema
 */
export const BasePersistenceConfigSchema = z.object({
  /**
   * Whether persistence is enabled.
   * When disabled, no data is saved (uses NoopPersistence).
   */
  enabled: z.boolean().default(true),

  /**
   * Optional database path override.
   * If not specified, falls back to:
   * 1. GRID_SQLITE_PATH environment variable
   * 2. Default: ./grid-strategies.sqlite
   */
  dbPath: z.string().min(1).optional(),
});

/**
 * Persistence configuration schema with default empty object
 * Use this in strategy configs where persistence is optional
 */
export const PersistenceConfigSchema = BasePersistenceConfigSchema.optional().transform(v => v ?? { enabled: true });

export type PersistenceConfig = z.infer<typeof PersistenceConfigSchema>;

/**
 * Resolve the database path from config and environment
 */
export function resolveDbPath(config?: PersistenceConfig): string {
  return config?.dbPath 
    || process.env[DB_PATH_ENV_VAR] 
    || DEFAULT_DB_PATH;
}

/**
 * Check if persistence is enabled in config
 */
export function isPersistenceEnabled(config?: PersistenceConfig): boolean {
  return config?.enabled ?? true;
}
