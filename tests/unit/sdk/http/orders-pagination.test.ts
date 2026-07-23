/**
 * Contract tests for Trading API order listing.
 *
 * - GET /v1/orders returns `{ data, paging: { next_cursor, prev_cursor, has_more } }`
 * - Next page: top-level query param `next=<paging.next_cursor>`
 * - Numeric `page` is unsupported; cursor pagination must be used
 * - Filters are flat top-level keys (`market_id`, `status`, `limit`, …)
 * - Max `limit` is 500
 *
 * These tests mock HTTP at the axios boundary and assert the exact query
 * parameters and page advancement behavior.
 */

import { ApiClient } from '../../../../src/sdk/http/client';
import MockAdapter from 'axios-mock-adapter';
import util from 'tweetnacl-util';
import nacl from 'tweetnacl';

jest.mock('../../../../src/core/config/config', () => ({
  getConfig: jest.fn(),
}));

import { getConfig } from '../../../../src/core/config/config';

type OrderRow = {
  order_id: string;
  market_id: string;
  side: string;
  status: string;
  quantity: string;
  filled_quantity: number;
  price: string;
  time_in_force: string;
  type: string;
  submitted_at: string;
};

function makeOrder(id: number, marketId: string): OrderRow {
  return {
    order_id: `ord_${String(id).padStart(4, '0')}`,
    market_id: marketId,
    side: 'sell',
    status: 'active',
    quantity: '10',
    filled_quantity: 0,
    price: '1.00',
    time_in_force: 'gtc',
    type: 'limit',
    submitted_at: new Date(Date.now() - id * 1000).toISOString(),
  };
}

function parseParams(config: { params?: Record<string, unknown>; url?: string }): Record<string, string> {
  const out: Record<string, string> = {};
  const params = config.params ?? {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    out[key] = String(value);
  }
  // Also parse query string if axios already serialized it into the URL.
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

describe('ApiClient orders cursor pagination contract', () => {
  let mockAxios: MockAdapter;
  const mockKeyPair = nacl.sign.keyPair();
  const privateKeyBase64 = util.encodeBase64(mockKeyPair.secretKey);
  const MARKET_A = 'market-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const MARKET_B = 'market-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

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

  it('listOrdersPage sends flat filters without nested filter parameters', async () => {
    const client = ApiClient.getInstance();
    let captured: Record<string, string> = {};

    mockAxios.onGet('/orders').reply((config) => {
      captured = parseParams(config);
      return [
        200,
        {
          data: [makeOrder(1, MARKET_A)],
          paging: { next_cursor: null, prev_cursor: null, has_more: false },
        },
      ];
    });

    await client.listOrdersPage({
      status: 'active' as any,
      market_id: MARKET_A,
      limit: 100,
    });

    expect(captured.market_id).toBe(MARKET_A);
    expect(captured.status).toBe('active');
    expect(captured.limit).toBe('100');
    expect(captured.page).toBeUndefined();
    for (const key of Object.keys(captured)) {
      expect(key.includes('filters')).toBe(false);
    }
  });

  it('listOrdersPage maps from_date/to_date aliases to start_datetime/end_datetime', async () => {
    const client = ApiClient.getInstance();
    let captured: Record<string, string> = {};

    mockAxios.onGet('/orders').reply((config) => {
      captured = parseParams(config);
      return [
        200,
        {
          data: [],
          paging: { next_cursor: null, prev_cursor: null, has_more: false },
        },
      ];
    });

    await client.listOrdersPage({
      from_date: '2026-01-01T00:00:00Z',
      to_date: '2026-01-02T00:00:00Z',
    });

    expect(captured.start_datetime).toBe('2026-01-01T00:00:00Z');
    expect(captured.end_datetime).toBe('2026-01-02T00:00:00Z');
    expect(captured.from_date).toBeUndefined();
    expect(captured.to_date).toBeUndefined();
  });

  it('listOrdersPage drops unsupported numeric page parameters', async () => {
    const client = ApiClient.getInstance();
    let captured: Record<string, string> = {};

    mockAxios.onGet('/orders').reply((config) => {
      captured = parseParams(config);
      return [
        200,
        {
          data: [],
          paging: { next_cursor: null, prev_cursor: null, has_more: false },
        },
      ];
    });

    await client.listOrdersRawPage({
      status: 'active',
      market_id: MARKET_A,
      limit: '500',
      page: '2',
    } as any);

    expect(captured.page).toBeUndefined();
    expect(captured.market_id).toBe(MARKET_A);
  });

  it('listAllOrdersRaw follows next_cursor with top-level next across >500 rows', async () => {
    const client = ApiClient.getInstance();
    // 650 orders: page1 = 500, page2 = 150. Page 2 IDs must differ from page 1.
    const allOrders = Array.from({ length: 650 }, (_, i) => makeOrder(i + 1, MARKET_A));
    const page1 = allOrders.slice(0, 500);
    const page2 = allOrders.slice(500);
    const CURSOR_1 = 'cursor_after_ord_0500';

    const requests: Array<Record<string, string>> = [];

    mockAxios.onGet('/orders').reply((config) => {
      const params = parseParams(config);
      requests.push(params);

      // Server-side market filter must be applied (flat market_id).
      expect(params.market_id).toBe(MARKET_A);
      expect(params.status).toBe('active');
      expect(params.page).toBeUndefined();
      expect(Number(params.limit)).toBeLessThanOrEqual(500);

      if (!params.next) {
        return [
          200,
          {
            data: page1,
            paging: {
              next_cursor: CURSOR_1,
              prev_cursor: null,
              has_more: true,
            },
          },
        ];
      }

      expect(params.next).toBe(CURSOR_1);
      return [
        200,
        {
          data: page2,
          paging: {
            next_cursor: null,
            prev_cursor: 'cursor_before_page2',
            has_more: false,
          },
        },
      ];
    });

    const result = await client.listAllOrdersRaw(
      { status: 'active', market_id: MARKET_A },
      { pageSize: 500, maxPages: 4 }
    );

    expect(requests).toHaveLength(2);
    expect(requests[0].next).toBeUndefined();
    expect(requests[1].next).toBe(CURSOR_1);

    expect(result.truncated).toBe(false);
    expect(result.data).toHaveLength(650);

    const ids = result.data.map((o) => o.order_id);
    const unique = new Set(ids);
    expect(unique.size).toBe(650);

    // Page 2 must contain different IDs than page 1.
    const page1Ids = new Set(page1.map((o) => o.order_id));
    const page2Ids = page2.map((o) => o.order_id);
    for (const id of page2Ids) {
      expect(page1Ids.has(id)).toBe(false);
      expect(ids).toContain(id);
    }

    // Past the 500 cliff.
    expect(ids).toContain('ord_0500');
    expect(ids).toContain('ord_0501');
    expect(ids).toContain('ord_0650');
  });

  it('listAllOrdersRaw applies market_id server-side and does not mix other markets', async () => {
    const client = ApiClient.getInstance();
    const marketAOrders = Array.from({ length: 3 }, (_, i) => makeOrder(i + 1, MARKET_A));

    mockAxios.onGet('/orders').reply((config) => {
      const params = parseParams(config);
      expect(params.market_id).toBe(MARKET_A);
      // Simulate server filter: never return MARKET_B rows when market_id=A.
      const data = marketAOrders.filter((o) => o.market_id === params.market_id);
      expect(data.every((o) => o.market_id === MARKET_A)).toBe(true);
      expect(data.some((o) => o.market_id === MARKET_B)).toBe(false);
      return [
        200,
        {
          data,
          paging: { next_cursor: null, prev_cursor: null, has_more: false },
        },
      ];
    });

    const result = await client.listAllOrdersRaw({
      status: 'active',
      market_id: MARKET_A,
    });

    expect(result.truncated).toBe(false);
    expect(result.data).toHaveLength(3);
    expect(result.data.every((o) => o.market_id === MARKET_A)).toBe(true);
  });

  it('listAllOrdersRaw marks truncated when has_more is true but next_cursor is null', async () => {
    const client = ApiClient.getInstance();
    const requests: Array<Record<string, string>> = [];

    mockAxios.onGet('/orders').reply((config) => {
      requests.push(parseParams(config));
      return [
        200,
        {
          data: [makeOrder(1, MARKET_A)],
          // Aggregate responses may omit a cursor while still reporting more data.
          paging: { next_cursor: null, prev_cursor: null, has_more: true },
        },
      ];
    });

    const result = await client.listAllOrdersRaw({ status: 'active' }, { maxPages: 5 });

    expect(result.data).toHaveLength(1);
    expect(result.truncated).toBe(true);
    expect(result.truncationReason).toBe('missing_cursor');
    // Must not loop forever / retry with empty next.
    expect(requests).toHaveLength(1);
  });

  it('listAllOrdersRaw aborts if the cursor does not advance', async () => {
    const client = ApiClient.getInstance();
    const requests: Array<Record<string, string>> = [];
    const STUCK = 'stuck_cursor';

    mockAxios.onGet('/orders').reply((config) => {
      const params = parseParams(config);
      requests.push(params);
      return [
        200,
        {
          data: [makeOrder(requests.length, MARKET_A)],
          paging: {
            next_cursor: STUCK,
            prev_cursor: null,
            has_more: true,
          },
        },
      ];
    });

    const result = await client.listAllOrdersRaw(
      { status: 'active', market_id: MARKET_A },
      { pageSize: 1, maxPages: 10 }
    );

    // First page (no next) + second page (next=STUCK) then abort when cursor repeats.
    expect(requests.length).toBe(2);
    expect(requests[1].next).toBe(STUCK);
    expect(result.truncated).toBe(true);
    expect(result.truncationReason).toBe('stuck_cursor');
    expect(result.data.length).toBeGreaterThanOrEqual(1);
  });

  it('listAllOrdersRaw marks truncated when maxPages is hit with has_more', async () => {
    const client = ApiClient.getInstance();
    let page = 0;

    mockAxios.onGet('/orders').reply(() => {
      page += 1;
      return [
        200,
        {
          data: [makeOrder(page, MARKET_A)],
          paging: {
            next_cursor: `cursor_${page}`,
            prev_cursor: null,
            has_more: true,
          },
        },
      ];
    });

    const result = await client.listAllOrdersRaw(
      { status: 'active', market_id: MARKET_A },
      { pageSize: 1, maxPages: 3 }
    );

    expect(result.pagesFetched).toBe(3);
    expect(result.data).toHaveLength(3);
    expect(result.truncated).toBe(true);
    expect(result.truncationReason).toBe('max_pages');
  });

  it('listAllOrdersRaw clamps pageSize to the API maximum of 500', async () => {
    const client = ApiClient.getInstance();
    let capturedLimit: string | undefined;

    mockAxios.onGet('/orders').reply((config) => {
      const params = parseParams(config);
      capturedLimit = params.limit;
      return [
        200,
        {
          data: [],
          paging: { next_cursor: null, prev_cursor: null, has_more: false },
        },
      ];
    });

    await client.listAllOrdersRaw(
      { status: 'active', market_id: MARKET_A },
      { pageSize: 9999 }
    );

    expect(capturedLimit).toBe('500');
  });

  it('listOrdersRawPage filters status=active client-side for non-active rows', async () => {
    const client = ApiClient.getInstance();

    mockAxios.onGet('/orders').reply(200, {
      data: [
        makeOrder(1, MARKET_A),
        { ...makeOrder(2, MARKET_A), status: 'cancelled' },
        { ...makeOrder(3, MARKET_A), status: 'filled' },
      ],
      paging: { next_cursor: null, prev_cursor: null, has_more: false },
    });

    const page = await client.listOrdersRawPage({ status: 'active', market_id: MARKET_A });
    expect(page.data).toHaveLength(1);
    expect(page.data[0].order_id).toBe('ord_0001');
    expect(page.paging.has_more).toBe(false);
  });
});
