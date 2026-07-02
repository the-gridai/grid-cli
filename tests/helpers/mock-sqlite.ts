/**
 * Mock SQLite (better-sqlite3) for Testing
 * 
 * Provides a configurable mock of the better-sqlite3 Database class for unit tests.
 */

export interface MockStatement {
  run: jest.Mock;
  get: jest.Mock;
  all: jest.Mock;
}

export interface MockDatabaseConfig {
  shouldFailOnOpen?: boolean;
  shouldFailOnExec?: boolean;
  shouldFailOnPrepare?: boolean;
  shouldFailOnClose?: boolean;
  queryResults?: Record<string, any>;
}

/**
 * Creates a mock better-sqlite3 Database instance for testing
 */
export function createMockDatabase(config: MockDatabaseConfig = {}) {
  const {
    shouldFailOnOpen = false,
    shouldFailOnExec = false,
    shouldFailOnPrepare = false,
    shouldFailOnClose = false,
    queryResults = {},
  } = config;

  if (shouldFailOnOpen) {
    throw new Error('Mock database open error');
  }

  // Track executed queries
  const executedQueries: Array<{ type: 'exec' | 'run' | 'get' | 'all'; sql: string; params?: any }> = [];
  const insertedRows: Map<string, any[]> = new Map();

  const createStatement = (sql: string): MockStatement => ({
    run: jest.fn((params?: any) => {
      if (shouldFailOnPrepare) throw new Error('Mock statement run error');
      executedQueries.push({ type: 'run', sql, params });
      
      // Track inserts by table name
      const insertMatch = sql.match(/INSERT INTO (\w+)/i);
      if (insertMatch) {
        const tableName = insertMatch[1];
        if (!insertedRows.has(tableName)) {
          insertedRows.set(tableName, []);
        }
        insertedRows.get(tableName)!.push(params);
      }
      
      return { changes: 1, lastInsertRowid: Date.now() };
    }),
    get: jest.fn((_params?: any) => {
      if (shouldFailOnPrepare) throw new Error('Mock statement get error');
      executedQueries.push({ type: 'get', sql });
      
      // Return configured results for SELECT queries
      const selectMatch = sql.match(/SELECT .* FROM (\w+)/i);
      if (selectMatch) {
        const tableName = selectMatch[1];
        if (queryResults[tableName]) {
          return queryResults[tableName];
        }
        // Return last inserted row if available
        const rows = insertedRows.get(tableName);
        if (rows && rows.length > 0) {
          return rows[rows.length - 1];
        }
      }
      return undefined;
    }),
    all: jest.fn((_params?: any) => {
      if (shouldFailOnPrepare) throw new Error('Mock statement all error');
      executedQueries.push({ type: 'all', sql });
      
      const selectMatch = sql.match(/SELECT .* FROM (\w+)/i);
      if (selectMatch) {
        const tableName = selectMatch[1];
        if (queryResults[tableName]) {
          return Array.isArray(queryResults[tableName]) 
            ? queryResults[tableName] 
            : [queryResults[tableName]];
        }
        return insertedRows.get(tableName) || [];
      }
      return [];
    }),
  });

  const mockDb = {
    pragma: jest.fn((_pragma: string) => {
      // No-op for pragma calls
    }),

    exec: jest.fn((sql: string) => {
      if (shouldFailOnExec) throw new Error('Mock database exec error');
      executedQueries.push({ type: 'exec', sql });
    }),

    prepare: jest.fn((sql: string) => {
      if (shouldFailOnPrepare) throw new Error('Mock database prepare error');
      return createStatement(sql);
    }),

    close: jest.fn(() => {
      if (shouldFailOnClose) throw new Error('Mock database close error');
    }),

    // Test helpers

    /**
     * Get all executed queries
     */
    _getExecutedQueries: () => executedQueries,

    /**
     * Get inserted rows for a table
     */
    _getInsertedRows: (tableName: string) => insertedRows.get(tableName) || [],

    /**
     * Check if a table was created
     */
    _wasTableCreated: (tableName: string) => {
      return executedQueries.some(
        q => q.type === 'exec' && q.sql.includes(`CREATE TABLE`) && q.sql.includes(tableName)
      );
    },

    /**
     * Reset all tracked state
     */
    _reset: () => {
      executedQueries.length = 0;
      insertedRows.clear();
      mockDb.pragma.mockClear();
      mockDb.exec.mockClear();
      mockDb.prepare.mockClear();
      mockDb.close.mockClear();
    },
  };

  return mockDb;
}

export type MockDatabase = ReturnType<typeof createMockDatabase>;

/**
 * Create a mock Database class for jest.mock()
 */
export function createMockDatabaseClass(config: MockDatabaseConfig = {}) {
  return jest.fn().mockImplementation(() => createMockDatabase(config));
}

/**
 * Helper to set up better-sqlite3 mock for a test file
 * 
 * Usage:
 * ```typescript
 * jest.mock('better-sqlite3', () => {
 *   return mockBetterSqlite3();
 * });
 * ```
 */
export function mockBetterSqlite3(config: MockDatabaseConfig = {}) {
  const mockInstance = createMockDatabase(config);
  const MockDatabase = jest.fn().mockImplementation(() => mockInstance);
  
  // Attach the instance for test access
  (MockDatabase as any)._mockInstance = mockInstance;
  
  return MockDatabase;
}

/**
 * Helper to create a payload for persistence tests
 */
export function createTestPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    orderId: 'order_test123',
    marketId: 'market_test123',
    side: 'sell',
    price: 1.0,
    quantity: 10,
    timestamp: Date.now(),
    ...overrides,
  };
}
