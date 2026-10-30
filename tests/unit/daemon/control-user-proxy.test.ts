import http from 'http';

const mockClient = {
  listOrdersRaw: jest.fn().mockResolvedValue([]),
  placeOrder: jest.fn().mockResolvedValue({ order_id: 'dummy-order' }),
};
jest.mock('../../../src/core/config/config', () => ({ getConfig: jest.fn(() => ({})), getConfigForProfile: jest.fn(() => ({})) }));
jest.mock('../../../src/core/logging/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('../../../src/core/config/profiles', () => ({ registerDynamicProfile: jest.fn() }));
jest.mock('../../../src/sdk/http/client', () => ({ ApiClient: {
  getInstanceForProfile: jest.fn(() => mockClient), resetProfileInstance: jest.fn(),
  createInstance: jest.fn(() => mockClient),
} }));

import { ControlServer } from '../../../src/daemon/control-server';
import { ApiClient } from '../../../src/sdk/http/client';
import { registerDynamicProfile } from '../../../src/core/config/profiles';

async function post(port: number, path: string, body: unknown): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => {
      res.resume(); res.on('end', () => resolve(res.statusCode!));
    });
    req.on('error', reject); req.end(JSON.stringify(body));
  });
}

describe('Control API user-order proxy boundary', () => {
  let server: ControlServer;
  let port: number;
  const credentials = { signingKey: 'dummy-user-key', fingerprint: 'dummy-user-fp' };
  const order = { market_id: 'dummy-market', side: 'buy', type: 'market', quantity: '1' };
  beforeEach(async () => {
    jest.clearAllMocks();
    server = new ControlServer({ port: 0, host: '127.0.0.1', requireAuth: false });
    await server.start(); port = server.getAddress()!.port;
  });
  afterEach(async () => { await server.stop(); });

  it.each(['list', 'cancel-all', 'place'])('rejects caller-selected upstreams for %s before creating a client', async action => {
    expect(await post(port, `/orders/user/${action}`, { ...credentials, order, apiUrl: 'http://untrusted.invalid/private?route=' })).toBe(400);
    expect(ApiClient.createInstance).not.toHaveBeenCalled();
    expect(ApiClient.getInstanceForProfile).not.toHaveBeenCalled();
  });

  it('uses request-scoped credentials without registering them in shared profiles', async () => {
    expect(await post(port, '/orders/user/list', credentials)).toBe(200);
    expect(ApiClient.createInstance).toHaveBeenCalledWith({ signingCredentials: { signingKey: credentials.signingKey, fingerprint: credentials.fingerprint } });
    expect(registerDynamicProfile).not.toHaveBeenCalled();
  });
});
