/**
 * ConfigManager - Dynamic Configuration Management
 * 
 * Provides centralized configuration management with:
 * - In-memory config state with Zod validation
 * - Change notification via callbacks
 * - Atomic file persistence with backup
 * - Deep merge for partial updates
 * 
 * @module config-manager
 */

import fs from 'fs';
import path from 'path';
import { z, ZodSchema, ZodError } from 'zod';
import { logger } from '../logging/logger';
import { deepMerge, setAtPath, getAtPath } from './deep-merge';
import type { DeepPartial } from './deep-merge';

/**
 * Result of a config update operation
 */
export interface ConfigUpdateResult<T = unknown> {
  success: boolean;
  config?: T;
  previousConfig?: T;
  error?: string;
  validationErrors?: z.ZodIssue[];
}

/**
 * Metadata describing *who* and *why* is triggering a config change.
 * Threaded through to change listeners so persistence layers can record an audit trail.
 */
export interface ConfigChangeContext {
  actor?: string;
  reason?: string;
  /** Free-form extra fields for listener-specific context. */
  [key: string]: unknown;
}

/**
 * Callback function type for config changes
 */
export type ConfigChangeCallback<T> = (
  newConfig: T,
  oldConfig: T,
  context?: ConfigChangeContext
) => void | Promise<void>;

/**
 * Options for `onConfigChange` registration.
 */
export interface OnConfigChangeOptions {
  /**
   * When true the listener participates in the commit path: if it throws or
   * rejects, the update is aborted, the in-memory state is rolled back, and
   * the `updateConfig`/`replaceConfig`/`setValue` call returns `success: false`.
   *
   * Use for persistence listeners where losing the write is unacceptable.
   * Non-critical listeners (default) run after commit and are best-effort.
   */
  critical?: boolean;
}

interface ListenerRecord<T> {
  callback: ConfigChangeCallback<T>;
  critical: boolean;
}

/**
 * Options for ConfigManager construction
 */
export interface ConfigManagerOptions<T> {
  /** Initial configuration */
  initialConfig: T;
  /** Zod schema for validation */
  schema: ZodSchema<T>;
  /** Path to config file (for persistence) */
  configPath?: string;
  /** Whether to create backup before saving */
  createBackup?: boolean;
  /** Strategy ID (for logging context) */
  strategyId?: string;
}

/**
 * ConfigManager class
 * 
 * Generic configuration manager that handles validation, persistence,
 * and change notifications for any Zod-validated config type.
 */
export class ConfigManager<T extends Record<string, unknown>> {
  private config: T;
  private schema: ZodSchema<T>;
  private configPath: string | null;
  private createBackup: boolean;
  private strategyId: string;
  private changeCallbacks: Set<ListenerRecord<T>> = new Set();

  constructor(options: ConfigManagerOptions<T>) {
    this.config = options.initialConfig;
    this.schema = options.schema;
    this.configPath = options.configPath || null;
    this.createBackup = options.createBackup ?? true;
    this.strategyId = options.strategyId || 'config-manager';

    logger.info(`[${this.strategyId}] ConfigManager initialized`, {
      hasConfigPath: !!this.configPath,
      createBackup: this.createBackup,
    });
  }

  /**
   * Get the current configuration
   */
  getConfig(): Readonly<T> {
    return this.config;
  }

  /**
   * Get a specific value from the configuration using dot notation
   * 
   * @example
   * manager.getValue('global.refreshIntervalMs') // 15000
   */
  getValue<V = unknown>(path: string): V | undefined {
    return getAtPath<V>(this.config as Record<string, unknown>, path);
  }

  /**
   * Update the configuration with a partial update (deep merge)
   *
   * @param partial - Partial configuration to merge
   * @param context - Optional metadata (actor/reason) forwarded to change listeners
   * @returns Result of the update operation
   */
  async updateConfig(
    partial: DeepPartial<T>,
    context?: ConfigChangeContext
  ): Promise<ConfigUpdateResult<T>> {
    const oldConfig = this.config;

    let validated: T;
    try {
      const merged = deepMerge(this.config, partial);
      validated = this.schema.parse(merged);
    } catch (error) {
      return this.toFailureResult(error, 'Config update validation failed');
    }

    return this.commit(validated, oldConfig, context, 'updated');
  }

  /**
   * Set a single value using dot notation path
   *
   * @param path - Dot notation path (e.g., 'global.refreshIntervalMs')
   * @param value - Value to set
   * @param context - Optional metadata (actor/reason) forwarded to change listeners
   * @returns Result of the update operation
   */
  async setValue(
    path: string,
    value: unknown,
    context?: ConfigChangeContext
  ): Promise<ConfigUpdateResult<T>> {
    const oldConfig = this.config;

    let validated: T;
    try {
      const updated = setAtPath(this.config as Record<string, unknown>, path, value) as T;
      validated = this.schema.parse(updated);
    } catch (error) {
      return this.toFailureResult(error, 'Config setValue validation failed', { path });
    }

    return this.commit(validated, oldConfig, context, 'value set', { path, value });
  }

  /**
   * Replace the entire configuration
   *
   * @param newConfig - Complete new configuration
   * @param context - Optional metadata (actor/reason) forwarded to change listeners
   * @returns Result of the update operation
   */
  async replaceConfig(
    newConfig: T,
    context?: ConfigChangeContext
  ): Promise<ConfigUpdateResult<T>> {
    const oldConfig = this.config;

    let validated: T;
    try {
      validated = this.schema.parse(newConfig);
    } catch (error) {
      return this.toFailureResult(error, 'Config replace validation failed');
    }

    return this.commit(validated, oldConfig, context, 'replaced');
  }

  /**
   * Shared commit path: run critical listeners (abort on failure), then
   * best-effort disk persistence and non-critical listeners.
   *
   * If any critical listener fails the in-memory state is rolled back to
   * `oldConfig` and the caller receives `success: false`.
   */
  private async commit(
    newConfig: T,
    oldConfig: T,
    context: ConfigChangeContext | undefined,
    action: string,
    logExtras: Record<string, unknown> = {}
  ): Promise<ConfigUpdateResult<T>> {
    this.config = newConfig;

    try {
      await this.runCriticalListeners(newConfig, oldConfig, context);
    } catch (error) {
      this.config = oldConfig;
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[${this.strategyId}] Config ${action} aborted — persistence failed; rolled back`, {
        error: message,
        ...logExtras,
      });
      return {
        success: false,
        error: `Persistence failed: ${message}`,
      };
    }

    // Post-commit, best-effort work below. Failures here do NOT fail the API
    // because the authoritative write (critical listener) already succeeded.
    if (this.configPath) {
      try {
        await this.persistToDisk();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`[${this.strategyId}] Post-commit disk persist failed`, {
          error: message,
          ...logExtras,
        });
      }
    }

    await this.runNonCriticalListeners(newConfig, oldConfig, context);

    logger.info(`[${this.strategyId}] Config ${action} successfully`, logExtras);

    return {
      success: true,
      config: newConfig,
      previousConfig: oldConfig,
    };
  }

  private toFailureResult(
    error: unknown,
    logMessage: string,
    logExtras: Record<string, unknown> = {}
  ): ConfigUpdateResult<T> {
    if (error instanceof ZodError) {
      logger.warn(`[${this.strategyId}] ${logMessage}`, {
        ...logExtras,
        errors: error.issues,
      });
      return {
        success: false,
        error: 'Validation failed',
        validationErrors: error.issues,
      };
    }
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[${this.strategyId}] ${logMessage}`, { ...logExtras, error: message });
    return { success: false, error: message };
  }

  /**
   * Validate a configuration without applying it
   * 
   * @param config - Configuration to validate
   * @returns Validation result
   */
  validateConfig(config: unknown): ConfigUpdateResult<T> {
    try {
      const validated = this.schema.parse(config);
      return {
        success: true,
        config: validated,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          success: false,
          error: 'Validation failed',
          validationErrors: error.issues,
        };
      }

      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Reload configuration from file
   * 
   * @returns Result of the reload operation
   */
  async reloadFromFile(): Promise<ConfigUpdateResult<T>> {
    if (!this.configPath) {
      return {
        success: false,
        error: 'No config path configured for persistence',
      };
    }

    try {
      const content = await fs.promises.readFile(this.configPath, 'utf8');
      const parsed = JSON.parse(content);

      return this.replaceConfig(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[${this.strategyId}] Failed to reload config from file`, { error: message });

      return {
        success: false,
        error: `Failed to reload: ${message}`,
      };
    }
  }

  /**
   * Register a callback for config changes.
   *
   * By default the callback is *non-critical*: it runs after commit and any
   * errors are logged but do not fail the update. Pass `{ critical: true }`
   * to register a callback that must succeed for the update to commit — on
   * failure the in-memory state is rolled back and the caller gets a failure
   * result. This is the right option for persistence-style listeners.
   *
   * @param callback - Function to call when config changes
   * @param options  - Listener options (criticality)
   * @returns Unsubscribe function
   */
  onConfigChange(
    callback: ConfigChangeCallback<T>,
    options?: OnConfigChangeOptions
  ): () => void {
    const record: ListenerRecord<T> = { callback, critical: !!options?.critical };
    this.changeCallbacks.add(record);

    return () => {
      this.changeCallbacks.delete(record);
    };
  }

  /**
   * Set the config file path for persistence
   */
  setConfigPath(configPath: string): void {
    this.configPath = configPath;
  }

  /**
   * Get the current config file path
   */
  getConfigPath(): string | null {
    return this.configPath;
  }

  /**
   * Persist current configuration to disk
   * 
   * Uses atomic write (temp file + rename) to prevent corruption.
   * Creates a backup if configured.
   */
  private async persistToDisk(): Promise<void> {
    if (!this.configPath) {
      return;
    }

    try {
      const dir = path.dirname(this.configPath);
      const filename = path.basename(this.configPath);
      const tempPath = path.join(dir, `.${filename}.tmp`);
      const backupPath = `${this.configPath}.bak`;

      // Ensure directory exists
      await fs.promises.mkdir(dir, { recursive: true });

      // Write to temp file
      const content = JSON.stringify(this.config, null, 2);
      await fs.promises.writeFile(tempPath, content, 'utf8');

      // Create backup if enabled and original file exists
      if (this.createBackup) {
        try {
          await fs.promises.access(this.configPath);
          await fs.promises.copyFile(this.configPath, backupPath);
          logger.debug(`[${this.strategyId}] Created config backup`, { backupPath });
        } catch {
          // Original file doesn't exist, skip backup
        }
      }

      // Atomic rename
      await fs.promises.rename(tempPath, this.configPath);

      logger.info(`[${this.strategyId}] Config persisted to disk`, { path: this.configPath });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[${this.strategyId}] Failed to persist config`, { error: message });
      throw error;
    }
  }

  /**
   * Run critical listeners sequentially. The first failure (thrown or
   * rejected) is re-thrown so the commit path can roll back.
   */
  private async runCriticalListeners(
    newConfig: T,
    oldConfig: T,
    context?: ConfigChangeContext
  ): Promise<void> {
    for (const record of this.changeCallbacks) {
      if (!record.critical) continue;
      await record.callback(newConfig, oldConfig, context);
    }
  }

  /**
   * Run non-critical listeners. Errors are logged but never propagated:
   * callers have already been told the update succeeded.
   */
  private async runNonCriticalListeners(
    newConfig: T,
    oldConfig: T,
    context?: ConfigChangeContext
  ): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const record of this.changeCallbacks) {
      if (record.critical) continue;
      try {
        const result = record.callback(newConfig, oldConfig, context);
        if (result instanceof Promise) {
          promises.push(
            result.catch((err) => {
              logger.error(`[${this.strategyId}] Non-critical config listener failed`, {
                error: err instanceof Error ? err.message : String(err),
              });
            })
          );
        }
      } catch (error) {
        logger.error(`[${this.strategyId}] Non-critical config listener threw`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    await Promise.all(promises);
  }
}

/**
 * Factory function to create a ConfigManager from a config file
 * 
 * @param configPath - Path to the config file
 * @param schema - Zod schema for validation
 * @param strategyId - Optional strategy identifier
 * @returns ConfigManager instance
 */
export async function createConfigManagerFromFile<T extends Record<string, unknown>>(
  configPath: string,
  schema: ZodSchema<T>,
  strategyId?: string
): Promise<ConfigManager<T>> {
  const content = await fs.promises.readFile(configPath, 'utf8');
  const parsed = JSON.parse(content);
  const validated = schema.parse(parsed);

  return new ConfigManager<T>({
    initialConfig: validated,
    schema,
    configPath,
    strategyId,
  });
}

/**
 * Re-export types for convenience
 */
export type { DeepPartial } from './deep-merge';
