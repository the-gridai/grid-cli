/**
 * StrategyPersistence Tests
 */

import * as fs from 'fs';
import * as path from 'path';
import { StrategyPersistence, createPersistence, DEFAULT_DB_PATH } from '../../../../src/core/persistence';

// We'll use a real temp database for these tests to verify actual behavior
const TEST_DB_PATH = '/tmp/test-persistence.sqlite';

describe('StrategyPersistence', () => {
  let persistence: StrategyPersistence;

  beforeEach(() => {
    // Clean up any existing test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  afterEach(async () => {
    if (persistence) {
      await persistence.close();
    }
    // Clean up test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('constructor', () => {
    it('accepts valid alphanumeric prefix', () => {
      persistence = new StrategyPersistence({
        strategyPrefix: 'test',
        dbPath: TEST_DB_PATH,
      });
      expect(persistence.getPrefix()).toBe('test');
    });

    it('accepts prefix with underscores', () => {
      persistence = new StrategyPersistence({
        strategyPrefix: 'test_strategy',
        dbPath: TEST_DB_PATH,
      });
      expect(persistence.getPrefix()).toBe('test_strategy');
    });

    it('accepts prefix with numbers', () => {
      persistence = new StrategyPersistence({
        strategyPrefix: 'strategy1',
        dbPath: TEST_DB_PATH,
      });
      expect(persistence.getPrefix()).toBe('strategy1');
    });

    it('rejects prefix starting with number', () => {
      expect(() => {
        new StrategyPersistence({
          strategyPrefix: '1test',
          dbPath: TEST_DB_PATH,
        });
      }).toThrow('Invalid strategy prefix');
    });

    it('rejects prefix with spaces', () => {
      expect(() => {
        new StrategyPersistence({
          strategyPrefix: 'test strategy',
          dbPath: TEST_DB_PATH,
        });
      }).toThrow('Invalid strategy prefix');
    });

    it('rejects prefix with special characters', () => {
      expect(() => {
        new StrategyPersistence({
          strategyPrefix: 'test-strategy',
          dbPath: TEST_DB_PATH,
        });
      }).toThrow('Invalid strategy prefix');
    });

    it('uses default path when not provided', () => {
      persistence = new StrategyPersistence({
        strategyPrefix: 'test',
      });
      expect(persistence.getDbPath()).toBe(DEFAULT_DB_PATH);
    });

    it('respects enabled flag', () => {
      persistence = new StrategyPersistence({
        strategyPrefix: 'test',
        dbPath: TEST_DB_PATH,
        enabled: false,
      });
      expect(persistence.isEnabled()).toBe(false);
    });
  });

  describe('init', () => {
    it('creates database and tables', async () => {
      persistence = new StrategyPersistence({
        strategyPrefix: 'test',
        dbPath: TEST_DB_PATH,
      });
      
      await persistence.init();
      
      expect(fs.existsSync(TEST_DB_PATH)).toBe(true);
    });

    it('creates tables with prefix', async () => {
      persistence = new StrategyPersistence({
        strategyPrefix: 'myprefix',
        dbPath: TEST_DB_PATH,
      });
      
      await persistence.init();
      
      // Verify by trying to save - would fail if table doesn't exist
      await expect(persistence.saveOrder({ test: true })).resolves.not.toThrow();
    });

    it('handles already initialized state', async () => {
      persistence = new StrategyPersistence({
        strategyPrefix: 'test',
        dbPath: TEST_DB_PATH,
      });
      
      await persistence.init();
      await persistence.init(); // Second call should not throw
      
      expect(fs.existsSync(TEST_DB_PATH)).toBe(true);
    });

    it('does nothing when disabled', async () => {
      persistence = new StrategyPersistence({
        strategyPrefix: 'test',
        dbPath: TEST_DB_PATH,
        enabled: false,
      });
      
      await persistence.init();
      
      expect(fs.existsSync(TEST_DB_PATH)).toBe(false);
    });

    it('creates parent directory if needed', async () => {
      const nestedPath = '/tmp/nested/dir/test.sqlite';
      const nestedDir = path.dirname(nestedPath);
      
      // Clean up if exists
      if (fs.existsSync(nestedPath)) {
        fs.unlinkSync(nestedPath);
      }
      if (fs.existsSync(nestedDir)) {
        fs.rmSync(nestedDir, { recursive: true });
      }
      
      persistence = new StrategyPersistence({
        strategyPrefix: 'test',
        dbPath: nestedPath,
      });
      
      await persistence.init();
      
      expect(fs.existsSync(nestedPath)).toBe(true);
      
      // Clean up
      fs.unlinkSync(nestedPath);
      fs.rmSync(nestedDir, { recursive: true });
    });
  });

  describe('save methods', () => {
    beforeEach(async () => {
      persistence = new StrategyPersistence({
        strategyPrefix: 'test',
        dbPath: TEST_DB_PATH,
      });
      await persistence.init();
    });

    it('saveOrder inserts record', async () => {
      const payload = { orderId: 'order123', price: 1.5 };
      await expect(persistence.saveOrder(payload)).resolves.not.toThrow();
    });

    it('saveFill inserts record', async () => {
      const payload = { orderId: 'order123', quantity: 10 };
      await expect(persistence.saveFill(payload)).resolves.not.toThrow();
    });

    it('savePositionSnapshot inserts record', async () => {
      const payload = { position: 100, timestamp: Date.now() };
      await expect(persistence.savePositionSnapshot(payload)).resolves.not.toThrow();
    });

    it('savePnlSnapshot inserts record', async () => {
      const payload = { pnl: 50.5, timestamp: Date.now() };
      await expect(persistence.savePnlSnapshot(payload)).resolves.not.toThrow();
    });

    it('saveDecision inserts record', async () => {
      const payload = { decision: 'place_order', reason: 'test' };
      await expect(persistence.saveDecision(payload)).resolves.not.toThrow();
    });

    it('saveKillSwitchState inserts record', async () => {
      const payload = { triggered: true, reason: 'test' };
      await expect(persistence.saveKillSwitchState(payload)).resolves.not.toThrow();
    });

    it('handles complex nested payload', async () => {
      const payload = {
        orderId: 'order123',
        nested: {
          deep: {
            value: 'test',
          },
        },
        array: [1, 2, 3],
      };
      await expect(persistence.saveOrder(payload)).resolves.not.toThrow();
    });

    it('does nothing when disabled', async () => {
      await persistence.close();
      
      persistence = new StrategyPersistence({
        strategyPrefix: 'test',
        dbPath: TEST_DB_PATH,
        enabled: false,
      });
      await persistence.init();
      
      // Should not throw even though db doesn't exist
      await expect(persistence.saveOrder({ test: true })).resolves.not.toThrow();
    });
  });

  describe('loadLatestKillSwitchState', () => {
    beforeEach(async () => {
      persistence = new StrategyPersistence({
        strategyPrefix: 'test',
        dbPath: TEST_DB_PATH,
      });
      await persistence.init();
    });

    it('returns null when no records', async () => {
      const result = await persistence.loadLatestKillSwitchState();
      expect(result).toBeNull();
    });

    it('returns latest record', async () => {
      await persistence.saveKillSwitchState({ triggered: false, count: 1 });
      await persistence.saveKillSwitchState({ triggered: true, count: 2 });
      
      const result = await persistence.loadLatestKillSwitchState();
      
      expect(result).toEqual({ triggered: true, count: 2 });
    });

    it('returns null when disabled', async () => {
      await persistence.close();
      
      persistence = new StrategyPersistence({
        strategyPrefix: 'test',
        dbPath: TEST_DB_PATH,
        enabled: false,
      });
      
      const result = await persistence.loadLatestKillSwitchState();
      expect(result).toBeNull();
    });
  });

  describe('read helpers', () => {
    beforeEach(async () => {
      persistence = new StrategyPersistence({
        strategyPrefix: 'test',
        dbPath: TEST_DB_PATH,
      });
      await persistence.init();
    });

    it('loads persisted orders', async () => {
      await persistence.saveOrder({ order_id: 'o1', side: 'buy' });
      await persistence.saveOrder({ order_id: 'o2', side: 'sell' });
      const rows = await persistence.loadOrders(10);
      expect(rows.length).toBeGreaterThanOrEqual(2);
      expect(rows[0]).toHaveProperty('order_id');
    });

    it('loads persisted fills', async () => {
      await persistence.saveFill({ order_id: 'o1', side: 'buy', quantity: 5, price: 2 });
      const rows = await persistence.loadFills(10);
      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(rows[0]).toHaveProperty('quantity');
    });

    it('loads latest position snapshot', async () => {
      await persistence.savePositionSnapshot({ inventory: 10 });
      await persistence.savePositionSnapshot({ inventory: 25 });
      const latest = await persistence.loadLatestPositionSnapshot();
      expect(latest).toEqual({ inventory: 25 });
    });
  });

  describe('close', () => {
    it('closes database connection', async () => {
      persistence = new StrategyPersistence({
        strategyPrefix: 'test',
        dbPath: TEST_DB_PATH,
      });
      await persistence.init();
      
      await expect(persistence.close()).resolves.not.toThrow();
    });

    it('handles already closed state', async () => {
      persistence = new StrategyPersistence({
        strategyPrefix: 'test',
        dbPath: TEST_DB_PATH,
      });
      await persistence.init();
      
      await persistence.close();
      await expect(persistence.close()).resolves.not.toThrow();
    });

    it('handles never initialized state', async () => {
      persistence = new StrategyPersistence({
        strategyPrefix: 'test',
        dbPath: TEST_DB_PATH,
      });
      
      await expect(persistence.close()).resolves.not.toThrow();
    });
  });

  describe('createPersistence factory', () => {
    it('creates persistence with prefix', () => {
      const p = createPersistence('factory_test', { dbPath: TEST_DB_PATH });
      expect(p.getPrefix()).toBe('factory_test');
      expect(p.getDbPath()).toBe(TEST_DB_PATH);
    });

    it('creates persistence with default enabled', () => {
      const p = createPersistence('factory_test', { dbPath: TEST_DB_PATH });
      expect(p.isEnabled()).toBe(true);
    });

    it('creates disabled persistence', () => {
      const p = createPersistence('factory_test', { enabled: false });
      expect(p.isEnabled()).toBe(false);
    });
  });
});
