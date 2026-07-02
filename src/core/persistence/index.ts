/**
 * Persistence Module
 * 
 * Provides SQLite-based persistence for strategies with automatic
 * table prefixing to allow multiple strategies to share the same database.
 * 
 * @example
 * ```typescript
 * import { StrategyPersistence, NoopPersistence, PersistenceConfigSchema } from '../../src/core/persistence';
 * 
 * // In strategy config
 * const ConfigSchema = z.object({
 *   persistence: PersistenceConfigSchema,
 *   // ... other config
 * });
 * 
 * // In strategy initialization
 * const persistence = config.persistence.enabled
 *   ? new StrategyPersistence({
 *       strategyPrefix: 'my_strategy',
 *       dbPath: config.persistence.dbPath,
 *     })
 *   : NoopPersistence;
 * 
 * await persistence.init();
 * 
 * // Save records
 * await persistence.saveOrder({ ... });
 * await persistence.saveFill({ ... });
 * 
 * // Cleanup
 * await persistence.close();
 * ```
 */

// Types
export type {
  PersistenceAdapter,
  PersistencePayload,
  PersistenceTable,
} from './types';
export { PERSISTENCE_TABLES } from './types';

// Implementations
export {
  StrategyPersistence,
  createPersistence,
  DEFAULT_DB_PATH,
  DB_PATH_ENV_VAR,
  type StrategyPersistenceOptions,
} from './StrategyPersistence';

export {
  NoopPersistence,
  createNoopPersistence,
} from './NoopPersistence';

// Configuration
export {
  BasePersistenceConfigSchema,
  PersistenceConfigSchema,
  type PersistenceConfig,
  resolveDbPath,
  isPersistenceEnabled,
} from './config';

export {
  StrategyConfigStore,
  createStrategyConfigStore,
  STRATEGY_CONFIG_TABLE,
  type SavedStrategyConfigRow,
  type CreateStrategyConfigInput,
  type UpdateStrategyConfigInput,
} from './StrategyConfigStore';

export { normalizeMarketKey, isMarketIdLike } from './market-key';
