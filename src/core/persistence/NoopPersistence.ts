/**
 * No-op Persistence Adapter
 * 
 * A persistence adapter that does nothing. Used when persistence is disabled.
 */

import type { PersistenceAdapter, PersistencePayload } from './types';

/**
 * No-op implementation of PersistenceAdapter
 * 
 * All methods are no-ops that return immediately.
 * Use this when persistence is disabled to avoid null checks.
 */
export const NoopPersistence: PersistenceAdapter = {
  async init(): Promise<void> {
    // No-op
  },

  async saveOrder(_payload: PersistencePayload): Promise<void> {
    // No-op
  },

  async saveFill(_payload: PersistencePayload): Promise<void> {
    // No-op
  },

  async savePositionSnapshot(_payload: PersistencePayload): Promise<void> {
    // No-op
  },

  async savePnlSnapshot(_payload: PersistencePayload): Promise<void> {
    // No-op
  },

  async saveDecision(_payload: PersistencePayload): Promise<void> {
    // No-op
  },

  async saveKillSwitchState(_payload: PersistencePayload): Promise<void> {
    // No-op
  },

  async loadLatestKillSwitchState(): Promise<PersistencePayload | null> {
    return null;
  },

  async loadOrders(): Promise<PersistencePayload[]> {
    return [];
  },

  async loadFills(): Promise<PersistencePayload[]> {
    return [];
  },

  async loadLatestPositionSnapshot(): Promise<PersistencePayload | null> {
    return null;
  },

  async flush(): Promise<void> {
    // No-op
  },

  async close(): Promise<void> {
    // No-op
  },
};

/**
 * Create a no-op persistence adapter
 * 
 * This is a convenience function that returns the singleton NoopPersistence.
 */
export function createNoopPersistence(): PersistenceAdapter {
  return NoopPersistence;
}
