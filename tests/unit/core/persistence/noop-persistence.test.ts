/**
 * NoopPersistence Tests
 */

import { NoopPersistence, createNoopPersistence } from '../../../../src/core/persistence';

describe('NoopPersistence', () => {
  describe('init', () => {
    it('resolves immediately', async () => {
      await expect(NoopPersistence.init()).resolves.toBeUndefined();
    });
  });

  describe('saveOrder', () => {
    it('resolves without side effects', async () => {
      await expect(NoopPersistence.saveOrder({ orderId: 'test' })).resolves.toBeUndefined();
    });
  });

  describe('saveFill', () => {
    it('resolves without side effects', async () => {
      await expect(NoopPersistence.saveFill({ fillId: 'test' })).resolves.toBeUndefined();
    });
  });

  describe('savePositionSnapshot', () => {
    it('resolves without side effects', async () => {
      await expect(NoopPersistence.savePositionSnapshot({ position: 100 })).resolves.toBeUndefined();
    });
  });

  describe('savePnlSnapshot', () => {
    it('resolves without side effects', async () => {
      await expect(NoopPersistence.savePnlSnapshot({ pnl: 50 })).resolves.toBeUndefined();
    });
  });

  describe('saveDecision', () => {
    it('resolves without side effects', async () => {
      await expect(NoopPersistence.saveDecision({ decision: 'test' })).resolves.toBeUndefined();
    });
  });

  describe('saveKillSwitchState', () => {
    it('resolves without side effects', async () => {
      await expect(NoopPersistence.saveKillSwitchState({ triggered: true })).resolves.toBeUndefined();
    });
  });

  describe('loadLatestKillSwitchState', () => {
    it('returns null', async () => {
      const result = await NoopPersistence.loadLatestKillSwitchState();
      expect(result).toBeNull();
    });
  });

  describe('flush', () => {
    it('resolves immediately', async () => {
      await expect(NoopPersistence.flush()).resolves.toBeUndefined();
    });
  });

  describe('read helpers', () => {
    it('loadOrders returns empty array', async () => {
      await expect(NoopPersistence.loadOrders()).resolves.toEqual([]);
    });

    it('loadFills returns empty array', async () => {
      await expect(NoopPersistence.loadFills()).resolves.toEqual([]);
    });

    it('loadLatestPositionSnapshot returns null', async () => {
      await expect(NoopPersistence.loadLatestPositionSnapshot()).resolves.toBeNull();
    });
  });

  describe('close', () => {
    it('resolves immediately', async () => {
      await expect(NoopPersistence.close()).resolves.toBeUndefined();
    });
  });

  describe('createNoopPersistence', () => {
    it('returns the NoopPersistence singleton', () => {
      const noop = createNoopPersistence();
      expect(noop).toBe(NoopPersistence);
    });

    it('returns same instance on multiple calls', () => {
      const noop1 = createNoopPersistence();
      const noop2 = createNoopPersistence();
      expect(noop1).toBe(noop2);
    });
  });
});
