import http from 'http';
import { z } from 'zod';

// Mock modules that use import.meta before importing
jest.mock('../../../src/core/config/config', () => ({
  getConfig: jest.fn(() => ({})),
  getConfigForProfile: jest.fn(() => ({})),
}));

jest.mock('../../../src/core/logging/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { ConfigManager } from '../../../src/core/config/config-manager';
import { ControlServer } from '../../../src/daemon/control-server';

// Simple test schema
const TestConfigSchema = z.object({
  name: z.string(),
  value: z.number(),
});

type TestConfig = z.infer<typeof TestConfigSchema>;

// Helper to make HTTP requests
async function makeRequest(
  port: number,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: 'localhost',
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode || 500,
            data: data ? JSON.parse(data) : {}
          });
        } catch {
          resolve({ status: res.statusCode || 500, data: {} });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

describe('ControlServer', () => {
  let server: ControlServer;
  let port: number;

  beforeEach(async () => {
    // Use ephemeral port to avoid conflicts across Jest workers.
    port = 0;
    server = new ControlServer({
      port,
      requireAuth: false, // Disable auth for tests
      allowUnauthenticatedReads: true,
    });
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('single strategy mode', () => {
    let configManager: ConfigManager<TestConfig>;

    beforeEach(async () => {
      configManager = new ConfigManager({
        initialConfig: { name: 'test', value: 42 },
        schema: TestConfigSchema,
      });
      server.setSingleConfigManager(configManager);
      await server.start();
      port = server.getAddress()!.port;
    });

    it('should return config on GET /config', async () => {
      const { status, data } = await makeRequest(port, 'GET', '/config');

      expect(status).toBe(200);
      expect((data as any).config).toEqual({ name: 'test', value: 42 });
    });

    it('should update config on PATCH /config', async () => {
      const { status, data } = await makeRequest(port, 'PATCH', '/config', { value: 100 });

      expect(status).toBe(200);
      expect((data as any).success).toBe(true);
      expect(configManager.getConfig().value).toBe(100);
    });

    it('should reject invalid updates on PATCH /config', async () => {
      const { status, data } = await makeRequest(port, 'PATCH', '/config', { value: 'invalid' });

      expect(status).toBe(400);
      expect((data as any).success).toBe(false);
      expect((data as any).validationErrors).toBeDefined();
      expect(configManager.getConfig().value).toBe(42); // unchanged
    });

    it('should replace config on PUT /config', async () => {
      const { status, data } = await makeRequest(port, 'PUT', '/config', {
        name: 'new',
        value: 999
      });

      expect(status).toBe(200);
      expect((data as any).success).toBe(true);
      expect(configManager.getConfig()).toEqual({ name: 'new', value: 999 });
    });
  });

  describe('multi strategy mode', () => {
    let config1: ConfigManager<TestConfig>;
    let config2: ConfigManager<TestConfig>;

    beforeEach(async () => {
      config1 = new ConfigManager({
        initialConfig: { name: 'strategy1', value: 1 },
        schema: TestConfigSchema,
      });
      config2 = new ConfigManager({
        initialConfig: { name: 'strategy2', value: 2 },
        schema: TestConfigSchema,
      });

      server.registerStrategy({
        id: 'strat1',
        name: 'Strategy One',
        type: 'test',
        configManager: config1,
      });
      server.registerStrategy({
        id: 'strat2',
        name: 'Strategy Two',
        type: 'test',
        configManager: config2,
      });

      await server.start();
      port = server.getAddress()!.port;
    });

    it('should return all configs on GET /config', async () => {
      const { status, data } = await makeRequest(port, 'GET', '/config');

      expect(status).toBe(200);
      const strategies = (data as any).strategies;
      expect(strategies.strat1.config).toEqual({ name: 'strategy1', value: 1 });
      expect(strategies.strat2.config).toEqual({ name: 'strategy2', value: 2 });
    });

    it('should return specific strategy config on GET /config/:id', async () => {
      const { status, data } = await makeRequest(port, 'GET', '/config/strat1');

      expect(status).toBe(200);
      expect((data as any).config).toEqual({ name: 'strategy1', value: 1 });
      expect((data as any).name).toBe('Strategy One');
    });

    it('should return 404 for unknown strategy', async () => {
      const { status, data } = await makeRequest(port, 'GET', '/config/unknown');

      expect(status).toBe(404);
      expect((data as any).error).toContain('not found');
    });

    it('should update specific strategy on PATCH /config/:id', async () => {
      const { status, data } = await makeRequest(port, 'PATCH', '/config/strat1', { value: 100 });

      expect(status).toBe(200);
      expect((data as any).success).toBe(true);
      expect(config1.getConfig().value).toBe(100);
      expect(config2.getConfig().value).toBe(2); // unchanged
    });

    it('should reset kill switch on POST /config/:id/reset-kill-switch when supported', async () => {
      const reset = jest.fn().mockResolvedValue(undefined);

      // Override registration with reset handler
      server.registerStrategy({
        id: 'killable',
        name: 'Killable Strategy',
        type: 'test',
        configManager: config1,
        onResetKillSwitch: reset,
      });

      const { status, data } = await makeRequest(port, 'POST', '/config/killable/reset-kill-switch', {});
      expect(status).toBe(200);
      expect((data as any).success).toBe(true);
      expect(reset).toHaveBeenCalled();
    });

    it('should return 400 on POST /config/:id/reset-kill-switch when unsupported', async () => {
      const { status, data } = await makeRequest(port, 'POST', '/config/strat1/reset-kill-switch', {});
      expect(status).toBe(400);
      expect((data as any).error).toContain('does not support kill switch reset');
    });

    it('should return empty markets on GET /config/:id/markets when not implemented', async () => {
      const { status, data } = await makeRequest(port, 'GET', '/config/strat1/markets');
      expect(status).toBe(200);
      expect((data as any).markets).toEqual([]);
    });

    it('should return markets on GET /config/:id/markets when getMarketStatuses is set', async () => {
      server.registerStrategy({
        id: 'with-markets',
        name: 'With Markets',
        type: 'scheduled-issuer',
        configManager: config1,
        getMarketStatuses: () => [{ marketKey: 'market_abc', paused: true }],
      });

      const { status, data } = await makeRequest(port, 'GET', '/config/with-markets/markets');
      expect(status).toBe(200);
      expect((data as any).markets).toEqual([{ marketKey: 'market_abc', paused: true }]);
    });

    it('should call onPause with market id from POST /config/:id/markets/:key/pause', async () => {
      const onPause = jest.fn().mockResolvedValue(undefined);
      server.registerStrategy({
        id: 'pause-path',
        name: 'Pause Path',
        type: 'test',
        configManager: config1,
        onPause,
      });

      const mid = '550e8400-e29b-41d4-a716-446655440000';
      const { status } = await makeRequest(port, 'POST', `/config/pause-path/markets/${mid}/pause`, {});
      expect(status).toBe(200);
      expect(onPause).toHaveBeenCalledWith(
        expect.objectContaining({
          marketId: mid,
          reason: 'control-api-market-pause',
        })
      );
    });

    it('should call onPause with marketSymbol for non-uuid path segment', async () => {
      const onPause = jest.fn().mockResolvedValue(undefined);
      server.registerStrategy({
        id: 'pause-sym',
        name: 'Pause Sym',
        type: 'test',
        configManager: config1,
        onPause,
      });

      const { status } = await makeRequest(
        port,
        'POST',
        '/config/pause-sym/markets/ETH-USDC%2FGRID/pause',
        {}
      );
      expect(status).toBe(200);
      expect(onPause).toHaveBeenCalledWith(
        expect.objectContaining({
          marketSymbol: 'ETH-USDC/GRID',
          reason: 'control-api-market-pause',
        })
      );
    });

    it('should call onResume from POST .../markets/:key/resume', async () => {
      const onResume = jest.fn().mockResolvedValue(undefined);
      server.registerStrategy({
        id: 'resume-path',
        name: 'Resume Path',
        type: 'test',
        configManager: config1,
        onResume,
      });

      const { status } = await makeRequest(port, 'POST', '/config/resume-path/markets/foo/resume', {});
      expect(status).toBe(200);
      expect(onResume).toHaveBeenCalledWith(
        expect.objectContaining({
          marketSymbol: 'foo',
          reason: 'control-api-market-resume',
        })
      );
    });

    it('should call onPatchMarket on PATCH /config/:id/markets/:key', async () => {
      const onPatchMarket = jest.fn().mockResolvedValue({
        success: true,
        config: config1.getConfig(),
      });
      server.registerStrategy({
        id: 'patchy',
        name: 'Patchy',
        type: 'test',
        configManager: config1,
        onPatchMarket,
      });

      const { status, data } = await makeRequest(port, 'PATCH', '/config/patchy/markets/mk-1', { quantity: 3 });
      expect(status).toBe(200);
      expect((data as any).success).toBe(true);
      expect(onPatchMarket).toHaveBeenCalledWith({
        marketKey: 'mk-1',
        patch: { quantity: 3 },
      });
    });

    it('should return 400 when PATCH market is not supported', async () => {
      const { status, data } = await makeRequest(port, 'PATCH', '/config/strat1/markets/x', { quantity: 1 });
      expect(status).toBe(400);
      expect(String((data as any).error)).toContain('not supported');
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      const configManager = new ConfigManager({
        initialConfig: { name: 'test', value: 42 },
        schema: TestConfigSchema,
      });
      server.setSingleConfigManager(configManager);
      await server.start();
      port = server.getAddress()!.port;
    });

    it('should return 404 for unknown routes', async () => {
      const { status, data } = await makeRequest(port, 'GET', '/unknown');

      expect(status).toBe(404);
      expect((data as any).error).toBe('Not found');
    });

    it('should return 405 for unsupported methods', async () => {
      const { status, data } = await makeRequest(port, 'DELETE', '/config');

      expect(status).toBe(405);
    });

    it('should return 400 for invalid JSON body', async () => {
      return new Promise((resolve) => {
        const options: http.RequestOptions = {
          hostname: 'localhost',
          port,
          path: '/config',
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
        };

        const req = http.request(options, (res) => {
          expect(res.statusCode).toBe(400);
          resolve(undefined);
        });

        req.write('not valid json');
        req.end();
      });
    });
  });

  describe('CORS', () => {
    beforeEach(async () => {
      const configManager = new ConfigManager({
        initialConfig: { name: 'test', value: 42 },
        schema: TestConfigSchema,
      });
      server.setSingleConfigManager(configManager);
      await server.start();
      port = server.getAddress()!.port;
    });

    it('should include CORS headers for allowed origins', async () => {
      return new Promise((resolve) => {
        const req = http.request({
          hostname: 'localhost',
          port,
          path: '/config',
          method: 'GET',
          headers: { Origin: 'http://localhost:5173' },
        }, (res) => {
          expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
          resolve(undefined);
        });
        req.end();
      });
    });

    it('should respond to OPTIONS preflight', async () => {
      return new Promise((resolve) => {
        const req = http.request({
          hostname: 'localhost',
          port,
          path: '/config',
          method: 'OPTIONS',
        }, (res) => {
          expect(res.statusCode).toBe(204);
          expect(res.headers['access-control-allow-methods']).toContain('PATCH');
          resolve(undefined);
        });
        req.end();
      });
    });
  });

  describe('lifecycle', () => {
    it('should report address when running', async () => {
      const configManager = new ConfigManager({
        initialConfig: { name: 'test', value: 42 },
        schema: TestConfigSchema,
      });
      server.setSingleConfigManager(configManager);

      expect(server.getAddress()).toBeNull();

      await server.start();
      const addr = server.getAddress();
      expect(addr).not.toBeNull();
      expect(addr?.port).toBeGreaterThan(0);

      await server.stop();
      expect(server.getAddress()).toBeNull();
    });
  });
});
