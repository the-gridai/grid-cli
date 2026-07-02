-- Drop tables if they exist to ensure clean state during this refactor (in dev)
-- In prod, we would use proper ALTER/DROP migrations.
DROP TABLE IF EXISTS kv_store;

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  price DECIMAL NOT NULL CHECK (price > 0),
  quantity DECIMAL NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id),
  price DECIMAL NOT NULL,
  quantity DECIMAL NOT NULL,
  fee DECIMAL DEFAULT 0,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_trades_executed_at ON trades(executed_at);
CREATE INDEX IF NOT EXISTS idx_trades_order_id ON trades(order_id);
