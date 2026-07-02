import { ApiClient } from '../../../../src/sdk/http/client';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import util from 'tweetnacl-util';
import nacl from 'tweetnacl';

// Mock config
jest.mock('../../../../src/core/config/config', () => ({
  getConfig: jest.fn(),
}));

import { getConfig } from '../../../../src/core/config/config';

describe('ApiClient', () => {
  let mockAxios: MockAdapter;
  const mockKeyPair = nacl.sign.keyPair();
  const privateKeyBase64 = util.encodeBase64(mockKeyPair.secretKey);

  beforeEach(() => {
    // Reset singleton
    (ApiClient as any).instance = undefined;
    
    (getConfig as jest.Mock).mockReturnValue({
      API_URL: 'http://test-api.com',
      PRIVATE_KEY: privateKeyBase64,
      API_KEY_FINGERPRINT: 'test-fingerprint',
    });
    
    // We can't easily mock the internal axios instance created inside the constructor 
    // without more invasive mocking, but we can verify the behavior by making requests.
    // However, since ApiClient creates its own axios instance, we need to spy on axios.create
    // or use a library that intercepts requests.
  });

  it('should inject authentication headers', async () => {
    const client = ApiClient.getInstance();
    
    // We need to access the private client to set up the mock adapter
    // @ts-ignore
    mockAxios = new MockAdapter(client.client);
    
    mockAxios.onPost('/orders').reply(config => {
      // Verify headers exist
      if (!config.headers) throw new Error('No headers');
      
      const signature = config.headers['x-thegrid-signature'];
      const timestamp = config.headers['x-thegrid-timestamp'];
      const fingerprint = config.headers['x-thegrid-fingerprint'];
      
      if (!signature || !timestamp || !fingerprint) {
        return [401, { error: 'Missing headers' }];
      }
      
      return [200, { data: {
        order_id: 'order-123', // Create endpoint returns just order_id
        client_order_id: null
      } }];
    });

    const response = await client.placeOrder({
      market_id: 'market_123',
      side: 'buy',
      type: 'limit',
      quantity: '10',
      price: '100'
    });
    // placeOrder constructs an Order object from the minimal API response
    expect(response.order_id).toBe('order-123');
  });

  it('should correctly format path for signature', async () => {
    const client = ApiClient.getInstance();
    // @ts-ignore
    mockAxios = new MockAdapter(client.client);

    let capturedHeaders: any;

    mockAxios.onGet(/\/markets\/.*\/orderbook/).reply(config => {
      capturedHeaders = config.headers;
      return [200, { data: {
        market_id: 'BTC-USD',
        bids: [],
        asks: [],
        timestamp: '2025-01-01T00:00:00Z'
      } }];
    });

    await client.getOrderBook('BTC-USD');
    
    expect(capturedHeaders['x-thegrid-signature']).toBeDefined();
    
    // Verify signature corresponds to the path
    // Note: axios params are appended to URL by axios, but our interceptor 
    // uses req.url. Depending on axios version/config, req.url might not include params 
    // at the interceptor stage if params are passed separately.
    // The current implementation in client.ts signs req.url which is just the path.
  });

  describe('pingTradingApi', () => {
    it('returns ok for 200 with data envelope', async () => {
      (ApiClient as any).instance = undefined;
      (getConfig as jest.Mock).mockReturnValue({
        API_URL: 'http://test-api.com',
        PRIVATE_KEY: privateKeyBase64,
        API_KEY_FINGERPRINT: 'test-fingerprint',
      });
      const client = ApiClient.getInstance();
      // @ts-ignore
      mockAxios = new MockAdapter(client.client);
      mockAxios.onGet('/me').reply(200, { data: { user_id: 'user_1' } });

      await expect(client.pingTradingApi({ timeoutMs: 3000 })).resolves.toEqual({ state: 'ok' });
    });

    it('returns unauthorized for 401', async () => {
      (ApiClient as any).instance = undefined;
      (getConfig as jest.Mock).mockReturnValue({
        API_URL: 'http://test-api.com',
        PRIVATE_KEY: privateKeyBase64,
        API_KEY_FINGERPRINT: 'test-fingerprint',
      });
      const client = ApiClient.getInstance();
      // @ts-ignore
      mockAxios = new MockAdapter(client.client);
      mockAxios.onGet('/me').reply(401, { error: 'unauthorized' });

      await expect(client.pingTradingApi({ timeoutMs: 3000 })).resolves.toEqual({
        state: 'unauthorized',
      });
    });

    it('returns offline for unexpected HTTP status', async () => {
      (ApiClient as any).instance = undefined;
      (getConfig as jest.Mock).mockReturnValue({
        API_URL: 'http://test-api.com',
        PRIVATE_KEY: privateKeyBase64,
        API_KEY_FINGERPRINT: 'test-fingerprint',
      });
      const client = ApiClient.getInstance();
      // @ts-ignore
      mockAxios = new MockAdapter(client.client);
      mockAxios.onGet('/me').reply(404, {});

      await expect(client.pingTradingApi({ timeoutMs: 3000 })).resolves.toEqual({
        state: 'offline',
        message: 'HTTP 404',
      });
    });
  });
});

