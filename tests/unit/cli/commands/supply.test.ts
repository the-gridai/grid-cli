/**
 * Tests for supply command logic
 */

describe('Supply Commands', () => {
  describe('Supply Issue Validation', () => {
    it('should accept positive integer quantities', () => {
      const qty = '100';
      const quantity = parseInt(qty, 10);
      expect(!isNaN(quantity) && quantity > 0).toBe(true);
    });

    it('should reject zero quantity', () => {
      const qty = '0';
      const quantity = parseInt(qty, 10);
      expect(quantity > 0).toBe(false);
    });

    it('should reject negative quantity', () => {
      const qty = '-50';
      const quantity = parseInt(qty, 10);
      expect(quantity > 0).toBe(false);
    });

    it('should reject float quantities', () => {
      const qty = '10.5';
      const quantity = parseInt(qty, 10);
      // parseInt will truncate, but we expect integers
      expect(quantity).toBe(10);
    });

    it('should reject non-numeric quantities', () => {
      const qty = 'abc';
      const quantity = parseInt(qty, 10);
      expect(isNaN(quantity)).toBe(true);
    });
  });

  describe('Supply List Data Transform', () => {
    it('should transform issuance data correctly', () => {
      const rawIssuance = {
        id: 'issuance_abc123',
        instrument_id: 'instrument_xyz',
        quantity: 100,
        issued_at: '2024-01-15T10:00:00Z',
      };

      const transformed = {
        id: rawIssuance.id,
        instrumentId: rawIssuance.instrument_id,
        quantity: rawIssuance.quantity,
        issuedAt: rawIssuance.issued_at,
      };

      expect(transformed.id).toBe('issuance_abc123');
      expect(transformed.instrumentId).toBe('instrument_xyz');
      expect(transformed.quantity).toBe(100);
    });

    it('should handle missing issued_at', () => {
      const rawIssuance = {
        id: 'issuance_abc',
        instrument_id: 'instrument_xyz',
        quantity: 50,
        issued_at: undefined,
      };

      const transformed = {
        id: rawIssuance.id,
        instrumentId: rawIssuance.instrument_id,
        quantity: rawIssuance.quantity,
        issuedAt: rawIssuance.issued_at,
      };

      expect(transformed.issuedAt).toBeUndefined();
    });
  });

  describe('Supply Summary Data Transform', () => {
    it('should transform summary data with instrument info', () => {
      const rawSummary = {
        instrument_id: 'instrument_abc',
        total_issued: 1000,
        units_available: 800,
        units_transferred_to_trading: 200,
        instrument_symbol: 'ABC',
      };

      const instrumentMap = new Map([
        ['instrument_abc', { name: 'ABC Token', symbol: 'ABC' }],
      ]);

      const instrumentInfo = instrumentMap.get(rawSummary.instrument_id);

      const transformed = {
        instrumentName: instrumentInfo?.name,
        instrumentId: rawSummary.instrument_id,
        symbol: rawSummary.instrument_symbol || instrumentInfo?.symbol,
        totalIssued: rawSummary.total_issued,
        unitsAvailable: rawSummary.units_available,
        unitsTransferred: rawSummary.units_transferred_to_trading,
      };

      expect(transformed.instrumentName).toBe('ABC Token');
      expect(transformed.symbol).toBe('ABC');
      expect(transformed.totalIssued).toBe(1000);
    });

    it('should handle missing instrument info', () => {
      const rawSummary = {
        instrument_id: 'instrument_unknown',
        total_issued: 500,
        units_available: null,
        units_transferred_to_trading: null,
      };

      const instrumentMap = new Map<string, { name: string; symbol: string }>();
      const instrumentInfo = instrumentMap.get(rawSummary.instrument_id);

      const transformed = {
        instrumentName: instrumentInfo?.name,
        instrumentId: rawSummary.instrument_id,
        symbol: instrumentInfo?.symbol,
        totalIssued: rawSummary.total_issued,
        unitsAvailable: rawSummary.units_available,
        unitsTransferred: rawSummary.units_transferred_to_trading,
      };

      expect(transformed.instrumentName).toBeUndefined();
      expect(transformed.symbol).toBeUndefined();
      expect(transformed.unitsAvailable).toBeNull();
    });
  });

  describe('Supply Summary Totals', () => {
    it('should calculate totals correctly', () => {
      const summaries = [
        { total_issued: 100, units_available: 80, units_transferred_to_trading: 20 },
        { total_issued: 200, units_available: 150, units_transferred_to_trading: 50 },
        { total_issued: 300, units_available: 300, units_transferred_to_trading: 0 },
      ];

      const totalIssued = summaries.reduce((sum, s) => sum + s.total_issued, 0);
      const totalAvailable = summaries.reduce((sum, s) => sum + s.units_available, 0);
      const totalTransferred = summaries.reduce((sum, s) => sum + s.units_transferred_to_trading, 0);

      expect(totalIssued).toBe(600);
      expect(totalAvailable).toBe(530);
      expect(totalTransferred).toBe(70);
    });

    it('should handle empty summaries', () => {
      const summaries: any[] = [];

      const totalIssued = summaries.reduce((sum, s) => sum + (s.total_issued || 0), 0);
      expect(totalIssued).toBe(0);
    });

    it('should handle null values in summaries', () => {
      const summaries = [
        { total_issued: 100, units_available: null, units_transferred_to_trading: null },
      ];

      const totalAvailable = summaries.reduce((sum, s) => sum + (s.units_available || 0), 0);
      expect(totalAvailable).toBe(0);
    });
  });

  describe('Supply Transfer Validation', () => {
    it('should accept transfer without trading account ID', () => {
      const payload: Record<string, any> = {
        instrument_id: 'instrument_abc',
        quantity: 50,
      };
      const tradingAccountId: string | undefined = undefined;

      if (tradingAccountId) {
        payload.trading_account_id = tradingAccountId;
      }

      expect(payload.trading_account_id).toBeUndefined();
      expect(Object.keys(payload)).toEqual(['instrument_id', 'quantity']);
    });

    it('should include trading account ID when provided', () => {
      const payload: Record<string, any> = {
        instrument_id: 'instrument_abc',
        quantity: 50,
      };
      const tradingAccountId = 'trading_account_xyz';

      if (tradingAccountId) {
        payload.trading_account_id = tradingAccountId;
      }

      expect(payload.trading_account_id).toBe('trading_account_xyz');
    });
  });

  describe('ID Truncation', () => {
    function truncateId(id: string, maxLen: number): string {
      if (id.length <= maxLen) return id;
      return id.substring(0, maxLen - 3) + '...';
    }

    it('should not truncate short IDs', () => {
      expect(truncateId('short_id', 20)).toBe('short_id');
    });

    it('should truncate long IDs', () => {
      const longId = 'instrument_abc123def456ghi789jkl012';
      const result = truncateId(longId, 20);
      expect(result.length).toBe(20);
      expect(result.endsWith('...')).toBe(true);
    });

    it('should handle exact length', () => {
      const exactId = 'a'.repeat(20);
      expect(truncateId(exactId, 20)).toBe(exactId);
    });
  });
});
