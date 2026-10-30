import nacl from 'tweetnacl';
import http from 'http';
import MockAdapter from 'axios-mock-adapter';

jest.mock('../../../../src/core/config/config', () => ({ getConfig: jest.fn() }));
import { getConfig } from '../../../../src/core/config/config';
import { ApiClient } from '../../../../src/sdk/http/client';

const key = Buffer.from(nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(5)).secretKey).toString('base64');

describe('request-scoped API credentials', () => {
  beforeEach(() => {
    ApiClient.resetInstances();
    (getConfig as jest.Mock).mockReturnValue({
      API_URL: 'http://configured-api.invalid/v1',
      AUTH_TYPE: 'oauth', ACCESS_TOKEN: 'dummy-server-token', REFRESH_TOKEN: 'dummy-server-refresh',
      TOKEN_EXPIRES_AT: new Date(Date.now() + 3600000).toISOString(),
    });
  });

  it('signs as the supplied user instead of the ambient OAuth principal', async () => {
    const client = ApiClient.createInstance({ signingCredentials: { signingKey: key, fingerprint: 'dummy-user' } });
    const adapter = new MockAdapter((client as any).client);
    adapter.onGet('/orders').reply(config => {
      expect(config.baseURL).toBe('http://configured-api.invalid/v1');
      expect(config.headers?.['x-thegrid-fingerprint']).toBe('dummy-user');
      expect(config.headers?.Authorization).toBeUndefined();
      return [200, { data: [] }];
    });
    await expect(client.listOrdersRaw()).resolves.toEqual([]);
    expect((client as any).client.defaults.maxRedirects).toBe(0);
    expect((ApiClient as any).profileInstances.size).toBe(0);
    adapter.restore();
  });

  it('rejects malformed explicit credentials instead of falling back', () => {
    expect(() => ApiClient.createInstance({ signingCredentials: { signingKey: 'invalid', fingerprint: 'dummy-user' } })).toThrow();
  });

  it('does not follow an upstream redirect carrying a request-owned identity', async () => {
    let forwarded = 0;
    const target = http.createServer((_req, res) => {
      forwarded++;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ data: [] }));
    });
    const upstream = http.createServer((_req, res) => {
      res.writeHead(302, { Location: `http://127.0.0.1:${(target.address() as { port: number }).port}/orders` });
      res.end();
    });
    const listen = (server: http.Server) => new Promise<void>(resolve => { server.listen(0, '127.0.0.1', resolve); });
    const close = (server: http.Server) => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); });
    await listen(target);
    await listen(upstream);
    try {
      (getConfig as jest.Mock).mockReturnValue({ API_URL: `http://127.0.0.1:${(upstream.address() as { port: number }).port}` });
      const client = ApiClient.createInstance({ signingCredentials: { signingKey: key, fingerprint: 'dummy-user' } });
      await expect(client.listOrdersRaw()).rejects.toThrow();
      expect(forwarded).toBe(0);
    } finally {
      await close(upstream);
      await close(target);
    }
  });
});
