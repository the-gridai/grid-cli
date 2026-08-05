/**
 * Contract tests for filter serialization on non-order list endpoints.
 *
 * These endpoints previously sent nested `flop[filters][N][field]` parameters.
 * Once an endpoint declares `allowed_filterable`, the nested form is ignored
 * server-side and the filter silently has no effect, so filters must be sent
 * as flat top-level keys.
 */

import { ApiClient } from '../../../../src/sdk/http/client';
import MockAdapter from 'axios-mock-adapter';
import util from 'tweetnacl-util';
import nacl from 'tweetnacl';

jest.mock('../../../../src/core/config/config', () => ({
  getConfig: jest.fn(),
}));

import { getConfig } from '../../../../src/core/config/config';

function parseParams(config: { params?: Record<string, unknown>; url?: string }): Record<string, string> {
  const out: Record<string, string> = {};
  const params = config.params ?? {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    out[key] = String(value);
  }
  const url = config.url ?? '';
  const qIndex = url.indexOf('?');
  if (qIndex >= 0) {
    const search = new URLSearchParams(url.slice(qIndex + 1));
    for (const [key, value] of search.entries()) {
      out[key] = value;
    }
  }
  return out;
}

function expectNoNestedFilters(captured: Record<string, string>): void {
  for (const key of Object.keys(captured)) {
    expect(key.includes('flop')).toBe(false);
    expect(key.includes('filters')).toBe(false);
  }
}

describe('ApiClient list endpoints send flat filter params', () => {
  let mockAxios: MockAdapter;
  const mockKeyPair = nacl.sign.keyPair();
  const privateKeyBase64 = util.encodeBase64(mockKeyPair.secretKey);
  const MARKET_A = 'market-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  beforeEach(() => {
    (ApiClient as any).instance = undefined;
    (getConfig as jest.Mock).mockReturnValue({
      API_URL: 'http://test-api.com',
      PRIVATE_KEY: privateKeyBase64,
      API_KEY_FINGERPRINT: 'test-fingerprint',
    });
    const client = ApiClient.getInstance();
    // @ts-expect-error access private axios instance for mocking
    mockAxios = new MockAdapter(client.client);
  });

  afterEach(() => {
    mockAxios.restore();
    (ApiClient as any).instance = undefined;
  });

  it('getTrades sends flat filters', async () => {
    const client = ApiClient.getInstance();
    let captured: Record<string, string> = {};

    mockAxios.onGet('/trades').reply((config) => {
      captured = parseParams(config);
      return [200, { data: [] }];
    });

    await client.getTrades({ market_id: MARKET_A, limit: 25 } as any);

    expect(captured.market_id).toBe(MARKET_A);
    expect(captured.limit).toBe('25');
    expectNoNestedFilters(captured);
  });

  it('getSupplyIssuances sends flat filters', async () => {
    const client = ApiClient.getInstance();
    let captured: Record<string, string> = {};

    mockAxios.onGet('/supply-issuances').reply((config) => {
      captured = parseParams(config);
      return [200, { data: [] }];
    });

    await client.getSupplyIssuances({ instrument_id: 'inst-1' });

    expect(captured.instrument_id).toBe('inst-1');
    expectNoNestedFilters(captured);
  });

  it('getSupplierLiability sends flat filters', async () => {
    const client = ApiClient.getInstance();
    let captured: Record<string, string> = {};

    mockAxios.onGet('/supplier-liability').reply((config) => {
      captured = parseParams(config);
      return [200, { data: [] }];
    });

    await client.getSupplierLiability({ instrument_id: 'inst-1' });

    expect(captured.instrument_id).toBe('inst-1');
    expectNoNestedFilters(captured);
  });

  it('getTransferHistory sends flat filters', async () => {
    const client = ApiClient.getInstance();
    let captured: Record<string, string> = {};

    mockAxios.onGet('/transfer-histories').reply((config) => {
      captured = parseParams(config);
      return [200, { data: [] }];
    });

    await client.getTransferHistory(MARKET_A, 'inst-1');

    expect(captured.market_id).toBe(MARKET_A);
    expect(captured.instrument_id).toBe('inst-1');
    expectNoNestedFilters(captured);
  });
});
