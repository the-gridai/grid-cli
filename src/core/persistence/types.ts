/**
 * Persistence Adapter Interface
 * 
 * Defines the contract for strategy persistence implementations.
 * All strategies use this interface for saving audit trails and state.
 */

/**
 * Generic payload type for persistence records
 */
export type PersistencePayload = Record<string, unknown>;

/**
 * Persistence adapter interface
 * 
 * Implementations must handle:
 * - Order placement records
 * - Fill event records  
 * - Position snapshots
 * - P&L snapshots
 * - Trading decision records
 * - Kill switch state (for recovery after restart)
 */
export interface PersistenceAdapter {
  /**
   * Initialize the persistence adapter (create tables, etc.)
   */
  init(): Promise<void>;

  /**
   * Save an order placement record
   */
  saveOrder(payload: PersistencePayload): Promise<void>;

  /**
   * Save a fill event record
   */
  saveFill(payload: PersistencePayload): Promise<void>;

  /**
   * Save a position snapshot
   */
  savePositionSnapshot(payload: PersistencePayload): Promise<void>;

  /**
   * Save a P&L snapshot
   */
  savePnlSnapshot(payload: PersistencePayload): Promise<void>;

  /**
   * Save a trading decision record
   */
  saveDecision(payload: PersistencePayload): Promise<void>;

  /**
   * Save kill switch state (for recovery after restart)
   */
  saveKillSwitchState(payload: PersistencePayload): Promise<void>;

  /**
   * Load the latest kill switch state
   * @returns The latest state or null if none exists
   */
  loadLatestKillSwitchState(): Promise<PersistencePayload | null>;

  /**
   * Load persisted order records (most recent first by default implementation)
   */
  loadOrders(limit?: number): Promise<PersistencePayload[]>;

  /**
   * Load persisted fill records (most recent first by default implementation)
   */
  loadFills(limit?: number): Promise<PersistencePayload[]>;

  /**
   * Load the latest position snapshot
   */
  loadLatestPositionSnapshot(): Promise<PersistencePayload | null>;

  /**
   * Flush any pending writes
   */
  flush(): Promise<void>;

  /**
   * Close the persistence adapter and release resources
   */
  close(): Promise<void>;
}

/**
 * Table names used by persistence adapters
 */
export const PERSISTENCE_TABLES = [
  'orders',
  'fills', 
  'position_snapshots',
  'pnl_snapshots',
  'decisions',
  'kill_switch',
] as const;

export type PersistenceTable = typeof PERSISTENCE_TABLES[number];
