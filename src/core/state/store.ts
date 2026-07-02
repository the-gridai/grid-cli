import { Pool } from 'pg';
import { getConfig } from '../config/config';
import { logger } from '../logging/logger';

export class StateManager {
  private pool: Pool;
  private static instance: StateManager;

  private constructor() {
    const config = getConfig();
    
    this.pool = new Pool({
      host: config.DB_HOST,
      port: config.DB_PORT,
      user: config.DB_USER,
      password: config.DB_PASSWORD,
      database: config.DB_NAME,
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle client — pool will reconnect automatically', { error: err });
    });
  }

  public static getInstance(): StateManager {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager();
    }
    return StateManager.instance;
  }

  public async initSchema() {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Orders Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          market_id TEXT,
          side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
          price DECIMAL NOT NULL CHECK (price > 0),
          quantity DECIMAL NOT NULL CHECK (quantity > 0),
          status TEXT NOT NULL DEFAULT 'open',
          order_type TEXT DEFAULT 'limit',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Add columns if they don't exist (migrations for existing dbs)
      await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS market_id TEXT;`);
      await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'limit';`);

      // Trades Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS trades (
          id TEXT PRIMARY KEY,
          order_id TEXT REFERENCES orders(id),
          price DECIMAL NOT NULL,
          quantity DECIMAL NOT NULL,
          fee DECIMAL DEFAULT 0,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Indices
      await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_trades_executed_at ON trades(executed_at);`);
      
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  public getPool(): Pool {
    return this.pool;
  }

  // Helper for single queries
  public async query(text: string, params?: any[]) {
    return this.pool.query(text, params);
  }

  public async close() {
    await this.pool.end();
  }
}
