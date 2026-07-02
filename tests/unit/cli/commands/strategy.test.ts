/**
 * Tests for strategy command logic
 */

import path from 'path';

describe('Strategy Commands', () => {
  describe('Strategy Path Resolution', () => {
    it('should resolve built-in strategy path', () => {
      const strategyName = 'simple-market-maker';
      const cwd = '/home/user/grid-cli';

      const isFilePath = strategyName.endsWith('.ts') ||
        strategyName.includes('/') ||
        strategyName.includes('\\');

      expect(isFilePath).toBe(false);

      const strategyPath = path.resolve(cwd, `strategies/examples/${strategyName}.ts`);
      expect(strategyPath).toBe('/home/user/grid-cli/strategies/examples/simple-market-maker.ts');
    });

    it('should resolve external file path', () => {
      const strategyName = './my-strategies/bot.ts';

      const isFilePath = strategyName.endsWith('.ts') ||
        strategyName.includes('/') ||
        strategyName.includes('\\');

      expect(isFilePath).toBe(true);
    });

    it('should detect .ts extension', () => {
      const strategyName = 'custom-strategy.ts';
      expect(strategyName.endsWith('.ts')).toBe(true);
    });

    it('should detect forward slash in path', () => {
      const strategyName = '../strategies/custom.ts';
      expect(strategyName.includes('/')).toBe(true);
    });

    it('should detect backslash in path (Windows)', () => {
      const strategyName = '..\\strategies\\custom.ts';
      expect(strategyName.includes('\\')).toBe(true);
    });
  });

  describe('Config Path Resolution', () => {
    it('should resolve default config for built-in strategy', () => {
      const strategyName = 'simple-market-maker';
      const cwd = '/home/user/grid-cli';

      const defaultConfigPath = path.resolve(cwd, `strategies/examples/${strategyName}.config.json`);
      expect(defaultConfigPath).toBe('/home/user/grid-cli/strategies/examples/simple-market-maker.config.json');
    });

    it('should resolve config next to external strategy', () => {
      const strategyPath = '/home/user/strategies/my-bot.ts';
      const strategyDir = path.dirname(strategyPath);
      const strategyBaseName = path.basename(strategyPath, '.ts');
      const configPath = path.join(strategyDir, `${strategyBaseName}.config.json`);

      expect(configPath).toBe('/home/user/strategies/my-bot.config.json');
    });
  });

  describe('Config Merging', () => {
    it('should merge CLI options with config file', () => {
      const configFile = {
        marketId: 'BTC-USD',
        spreadPercentage: 0.5,
        orderSize: 10,
        refreshIntervalMs: 5000,
      };

      const cliOptions = {
        market: 'ETH-USD', // Override
        spread: undefined, // Keep from config
        size: '20', // Override
        interval: undefined, // Keep from config
      };

      const merged = { ...configFile };
      if (cliOptions.market) merged.marketId = cliOptions.market;
      if (cliOptions.spread) merged.spreadPercentage = parseFloat(cliOptions.spread);
      if (cliOptions.size) merged.orderSize = parseInt(cliOptions.size);
      if (cliOptions.interval) merged.refreshIntervalMs = parseInt(cliOptions.interval);

      expect(merged.marketId).toBe('ETH-USD');
      expect(merged.spreadPercentage).toBe(0.5);
      expect(merged.orderSize).toBe(20);
      expect(merged.refreshIntervalMs).toBe(5000);
    });

    it('should use CLI options when no config', () => {
      const config: any = {};
      const cliOptions = {
        market: 'BTC-USD',
        spread: '0.5',
        size: '10',
        interval: '3000',
      };

      if (cliOptions.market) config.marketId = cliOptions.market;
      if (cliOptions.spread) config.spreadPercentage = parseFloat(cliOptions.spread);
      if (cliOptions.size) config.orderSize = parseInt(cliOptions.size);
      if (cliOptions.interval) config.refreshIntervalMs = parseInt(cliOptions.interval);

      expect(config.marketId).toBe('BTC-USD');
      expect(config.spreadPercentage).toBe(0.5);
      expect(config.orderSize).toBe(10);
      expect(config.refreshIntervalMs).toBe(3000);
    });
  });

  describe('Environment Variable Setting', () => {
    it('should set env vars from config', () => {
      const config = {
        marketId: 'BTC-USD',
        spreadPercentage: 0.5,
        orderSize: 10,
        refreshIntervalMs: 3000,
      };

      const envVars: Record<string, string> = {};
      if (config.marketId) envVars.MARKET_ID = config.marketId;
      if (config.spreadPercentage) envVars.SPREAD_PERCENTAGE = config.spreadPercentage.toString();
      if (config.orderSize) envVars.ORDER_SIZE = config.orderSize.toString();
      if (config.refreshIntervalMs) envVars.REFRESH_INTERVAL_MS = config.refreshIntervalMs.toString();

      expect(envVars.MARKET_ID).toBe('BTC-USD');
      expect(envVars.SPREAD_PERCENTAGE).toBe('0.5');
      expect(envVars.ORDER_SIZE).toBe('10');
      expect(envVars.REFRESH_INTERVAL_MS).toBe('3000');
    });
  });

  describe('Strategy List Filtering', () => {
    it('should filter only .ts files', () => {
      const files = [
        'simple-market-maker.ts',
        'grid-trader.ts',
        'README.md',
        'config.json',
        '.gitignore',
      ];

      const strategies = files.filter(f => f.endsWith('.ts'));

      expect(strategies).toHaveLength(2);
      expect(strategies).toContain('simple-market-maker.ts');
      expect(strategies).toContain('grid-trader.ts');
    });

    it('should extract strategy name from filename', () => {
      const files = ['simple-market-maker.ts', 'grid-trader.ts'];

      const strategyNames = files.map(f => f.replace('.ts', ''));

      expect(strategyNames).toEqual(['simple-market-maker', 'grid-trader']);
    });
  });

  describe('Strategy Module Validation', () => {
    it('should check for run function export', () => {
      const validModule = {
        run: async () => {},
      };

      const invalidModule = {
        start: async () => {},
      };

      expect(typeof validModule.run === 'function').toBe(true);
      expect(typeof (invalidModule as any).run === 'function').toBe(false);
    });
  });
});
