/**
 * Base Strategy Interface and Types
 * 
 * Defines the core interfaces for trading strategies with
 * dynamic configuration support.
 * 
 * @module base-strategy
 */

import type { ConfigManager } from '../core/config/config-manager';

/**
 * Result of a config transition validation
 */
export interface ConfigTransitionResult {
  /** Whether the transition is valid */
  valid: boolean;
  /** Warning messages (transition allowed but with caveats) */
  warnings?: string[];
  /** Error messages (transition not allowed) */
  errors?: string[];
  /** Actions that will be taken during transition */
  actions?: string[];
}

/**
 * Base strategy interface
 * 
 * All trading strategies should implement this interface.
 */
export interface Strategy {
  /**
   * Start the strategy
   */
  start(): Promise<void>;

  /**
   * Stop the strategy gracefully
   */
  stop(): Promise<void>;
}

/**
 * Strategy with dynamic configuration support
 * 
 * Extends the base strategy with methods for handling
 * runtime configuration changes.
 */
export interface DynamicConfigStrategy<T = unknown> extends Strategy {
  /**
   * Handle a configuration update
   * 
   * This is called after the new configuration has been validated
   * and stored. The strategy should:
   * 1. Cancel any active orders (if applicable)
   * 2. Update internal state with new config values
   * 3. Resume operations with the new configuration
   * 
   * @param newConfig - The new validated configuration
   * @param oldConfig - The previous configuration
   */
  onConfigUpdate(newConfig: T, oldConfig: T): Promise<void>;

  /**
   * Validate a configuration transition before it's applied
   * 
   * This allows the strategy to check if a proposed config change
   * is safe and what actions will be taken. The validation happens
   * BEFORE the config is applied.
   * 
   * @param newConfig - The proposed new configuration
   * @returns Validation result with any warnings or errors
   */
  validateConfigTransition(newConfig: T): ConfigTransitionResult;

  /**
   * Get the ConfigManager for this strategy
   */
  getConfigManager(): ConfigManager<any>;
}

/**
 * Type guard to check if a strategy supports dynamic config
 */
export function isDynamicConfigStrategy<T>(
  strategy: Strategy
): strategy is DynamicConfigStrategy<T> {
  return (
    typeof (strategy as DynamicConfigStrategy<T>).onConfigUpdate === 'function' &&
    typeof (strategy as DynamicConfigStrategy<T>).validateConfigTransition === 'function'
  );
}

/**
 * Helper to create a config transition result
 */
export function createConfigTransitionResult(
  options: Partial<ConfigTransitionResult> = {}
): ConfigTransitionResult {
  return {
    valid: options.valid ?? true,
    warnings: options.warnings || [],
    errors: options.errors || [],
    actions: options.actions || [],
  };
}

/**
 * Common config change analysis utilities
 */
export const ConfigChangeAnalysis = {
  /**
   * Check if a numeric value changed
   */
  numericChanged(
    oldVal: number | undefined,
    newVal: number | undefined
  ): boolean {
    return oldVal !== newVal;
  },

  /**
   * Check if a boolean value changed
   */
  booleanChanged(
    oldVal: boolean | undefined,
    newVal: boolean | undefined
  ): boolean {
    return oldVal !== newVal;
  },

  /**
   * Check if a string value changed
   */
  stringChanged(
    oldVal: string | undefined,
    newVal: string | undefined
  ): boolean {
    return oldVal !== newVal;
  },

  /**
   * Check if an array has different length
   */
  arrayLengthChanged<T>(
    oldArr: T[] | undefined,
    newArr: T[] | undefined
  ): boolean {
    return (oldArr?.length ?? 0) !== (newArr?.length ?? 0);
  },

  /**
   * Get IDs that were added to an array
   */
  getAddedIds<T extends { id?: string; marketId?: string }>(
    oldArr: T[] | undefined,
    newArr: T[] | undefined,
    idField: keyof T = 'id' as keyof T
  ): string[] {
    const oldIds = new Set((oldArr || []).map(item => String(item[idField])));
    return (newArr || [])
      .filter(item => !oldIds.has(String(item[idField])))
      .map(item => String(item[idField]));
  },

  /**
   * Get IDs that were removed from an array
   */
  getRemovedIds<T extends { id?: string; marketId?: string }>(
    oldArr: T[] | undefined,
    newArr: T[] | undefined,
    idField: keyof T = 'id' as keyof T
  ): string[] {
    const newIds = new Set((newArr || []).map(item => String(item[idField])));
    return (oldArr || [])
      .filter(item => !newIds.has(String(item[idField])))
      .map(item => String(item[idField]));
  },

  /**
   * Compare two objects for equality (shallow)
   */
  objectsEqual(
    obj1: Record<string, unknown> | undefined,
    obj2: Record<string, unknown> | undefined
  ): boolean {
    if (obj1 === obj2) return true;
    if (!obj1 || !obj2) return false;

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    return keys1.every(key => obj1[key] === obj2[key]);
  },
};

/**
 * Export types for external use
 */
export type { ConfigManager };
