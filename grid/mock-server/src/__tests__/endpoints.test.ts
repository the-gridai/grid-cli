/**
 * Tests for mock server endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { app } from '../server.js';

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  // Start server on random port
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        baseUrl = `http://localhost:${address.port}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

async function fetchJson(path: string, options: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await response.json();
  return { status: response.status, data };
}

describe('Health endpoint', () => {
  it('should return OK status', async () => {
    const { status, data } = await fetchJson('/health');
    expect(status).toBe(200);
    expect(data.status).toBe('ok');
  });
});

describe('Markets endpoints', () => {
  it('should list markets', async () => {
    const { status, data } = await fetchJson('/markets');
    expect(status).toBe(200);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
  });

  it('should get market by ID', async () => {
    const { status, data } = await fetchJson('/markets/mkt-btc-usd');
    expect(status).toBe(200);
    expect(data.data.market_id).toBe('mkt-btc-usd');
  });

  it('should return 404 for unknown market', async () => {
    const { status, data } = await fetchJson('/markets/unknown');
    expect(status).toBe(404);
    expect(data.error.code).toBe('MARKET_NOT_FOUND');
  });

  it('should get ticker', async () => {
    const { status, data } = await fetchJson('/markets/mkt-btc-usd/ticker');
    expect(status).toBe(200);
    expect(data.data.last_price).toBeDefined();
    expect(data.data.highest_bid).toBeDefined();
  });

  it('should get order book', async () => {
    const { status, data } = await fetchJson('/markets/mkt-btc-usd/orderbook');
    expect(status).toBe(200);
    // The exchange format uses buy/sell instead of bids/asks
    expect(Array.isArray(data.data.buy)).toBe(true);
    expect(Array.isArray(data.data.sell)).toBe(true);
    // Each level should have quantity, price, total, order_count
    expect(data.data.buy[0]).toHaveProperty('quantity');
    expect(data.data.buy[0]).toHaveProperty('price');
    expect(data.data.buy[0]).toHaveProperty('total');
    expect(data.data.buy[0]).toHaveProperty('order_count');
  });
});

describe('Orders endpoints', () => {
  it('should list orders (empty initially)', async () => {
    const { status, data } = await fetchJson('/orders');
    expect(status).toBe(200);
    expect(Array.isArray(data.data)).toBe(true);
  });

  it('should place a limit order', async () => {
    const { status, data } = await fetchJson('/orders', {
      method: 'POST',
      body: JSON.stringify({
        market_id: 'mkt-btc-usd',
        side: 'buy',
        type: 'limit',
        quantity: '1.0',
        price: '50000',
      }),
    });

    expect(status).toBe(201);
    expect(data.data.order_id).toBeDefined();
  });

  it('should reject limit order without price', async () => {
    const { status, data } = await fetchJson('/orders', {
      method: 'POST',
      body: JSON.stringify({
        market_id: 'mkt-btc-usd',
        side: 'buy',
        type: 'limit',
        quantity: '1.0',
      }),
    });

    expect(status).toBe(400);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should place and cancel order', async () => {
    // Place order
    const createResult = await fetchJson('/orders', {
      method: 'POST',
      body: JSON.stringify({
        market_id: 'mkt-btc-usd',
        side: 'buy',
        type: 'limit',
        quantity: '1.0',
        price: '49000',
      }),
    });

    expect(createResult.status).toBe(201);
    const orderId = createResult.data.data.order_id;

    // Cancel order
    const cancelResponse = await fetch(`${baseUrl}/orders/${orderId}`, {
      method: 'DELETE',
    });

    expect(cancelResponse.status).toBe(204);

    // Verify cancelled
    const { data: getResult } = await fetchJson(`/orders/${orderId}`);
    expect(getResult.data.status).toBe('cancelled');
  });
});

describe('Accounts endpoints', () => {
  it('should get trading accounts', async () => {
    const { status, data } = await fetchJson('/trading/trading-accounts');
    expect(status).toBe(200);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
  });

  it('should get consumption accounts', async () => {
    const { status, data } = await fetchJson('/trading/consumption-accounts');
    expect(status).toBe(200);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data[0].uncommitted_balance).toBe(5000000);
    expect(typeof data.data[0].uncommitted_balance).toBe('number');
    expect(data.data[0].available_balance).toBeUndefined();
  });

  it('should get current user', async () => {
    const { status, data } = await fetchJson('/trading/me');
    expect(status).toBe(200);
    expect(data.data.user_id).toBeDefined();
    expect(data.data.email).toBeDefined();
  });
});

describe('Supply endpoints', () => {
  it('should list supply issuances', async () => {
    const { status, data } = await fetchJson('/supply-issuances');
    expect(status).toBe(200);
    expect(Array.isArray(data.data)).toBe(true);
  });

  it('should create supply issuance', async () => {
    const { status, data } = await fetchJson('/supply-issuances', {
      method: 'POST',
      body: JSON.stringify({
        instrument_id: 'compute',
        quantity: 1000,
      }),
    });

    expect(status).toBe(201);
    expect(data.data.id).toBeDefined();
    expect(data.data.quantity).toBe(1000);
  });
});

describe('Transfer endpoints', () => {
  it('should transfer to consumption', async () => {
    const { status, data } = await fetchJson('/transfers/trading-to-consumption', {
      method: 'POST',
      body: JSON.stringify({
        instrument_id: 'compute',
        quantity: 100,
      }),
    });

    expect(status).toBe(200);
    expect(data.data.status).toBe('completed');
  });

  it('should transfer to trading', async () => {
    const { status, data } = await fetchJson('/transfers/consumption-to-trading', {
      method: 'POST',
      body: JSON.stringify({
        instrument_id: 'compute',
        quantity: 50,
      }),
    });

    expect(status).toBe(200);
    expect(data.data.status).toBe('completed');
  });
});

describe('Instruments endpoints', () => {
  it('should list instruments', async () => {
    const { status, data } = await fetchJson('/instruments');
    expect(status).toBe(200);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
  });

  it('should get instrument by ID', async () => {
    const { status, data } = await fetchJson('/instruments/instr-prime');
    expect(status).toBe(200);
    expect(data.data.id).toBe('instr-prime');
    expect(data.data.symbol).toBe('PRIME-INFERENCE');
  });

  it('should get instrument by symbol', async () => {
    const { status, data } = await fetchJson('/instruments/by-symbol/USD');
    expect(status).toBe(200);
    expect(data.data.symbol).toBe('USD');
    expect(data.data.type).toBe('currency');
  });

  it('should return 404 for unknown instrument', async () => {
    const { status, data } = await fetchJson('/instruments/unknown');
    expect(status).toBe(404);
    expect(data.error.code).toBe('INSTRUMENT_NOT_FOUND');
  });
});

describe('Signing keys endpoints', () => {
  it('should register a signing key', async () => {
    const { status, data } = await fetchJson('/signing-keys', {
      method: 'POST',
      body: JSON.stringify({
        signing_key: {
          public_key: 'test-public-key-base64',
          label: 'Test Key',
        },
      }),
    });

    expect(status).toBe(201);
    expect(data.data.id).toBeDefined();
    expect(data.data.public_key).toBe('test-public-key-base64');
    expect(data.data.status).toBe('active');
  });

  it('should list signing keys', async () => {
    const { status, data } = await fetchJson('/signing-keys');
    expect(status).toBe(200);
    expect(Array.isArray(data.data)).toBe(true);
  });

  it('should reject invalid signing key registration', async () => {
    const { status, data } = await fetchJson('/signing-keys', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    expect(status).toBe(400);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Trades endpoints', () => {
  it('should list trades', async () => {
    const { status, data } = await fetchJson('/trades');
    expect(status).toBe(200);
    expect(Array.isArray(data.data)).toBe(true);
  });

  it('should filter trades by market_id', async () => {
    const { status, data } = await fetchJson('/trades?filters[0][field]=market_id&filters[0][value]=mkt-btc-usd');
    expect(status).toBe(200);
    expect(Array.isArray(data.data)).toBe(true);
  });

  it('should return 404 for unknown trade', async () => {
    const { status, data } = await fetchJson('/trades/unknown-trade');
    expect(status).toBe(404);
    expect(data.error.code).toBe('TRADE_NOT_FOUND');
  });
});

describe('Order update endpoint', () => {
  it('should update order price', async () => {
    // Create order first
    const createResult = await fetchJson('/orders', {
      method: 'POST',
      body: JSON.stringify({
        market_id: 'mkt-btc-usd',
        side: 'buy',
        type: 'limit',
        quantity: '2.0',
        price: '48000',
      }),
    });

    expect(createResult.status).toBe(201);
    const orderId = createResult.data.data.order_id;

    // Update order
    const { status, data } = await fetchJson(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({
        price: '47000',
      }),
    });

    expect(status).toBe(200);
    expect(data.data.price).toBe('47000');
  });

  it('should reject update for cancelled order', async () => {
    // Create and cancel order
    const createResult = await fetchJson('/orders', {
      method: 'POST',
      body: JSON.stringify({
        market_id: 'mkt-btc-usd',
        side: 'sell',
        type: 'limit',
        quantity: '1.0',
        price: '52000',
      }),
    });

    const orderId = createResult.data.data.order_id;

    // Cancel order
    await fetch(`${baseUrl}/orders/${orderId}`, {
      method: 'DELETE',
    });

    // Try to update cancelled order
    const { status, data } = await fetchJson(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({
        price: '51000',
      }),
    });

    expect(status).toBe(400);
    expect(data.error.code).toBe('INVALID_ORDER_STATE');
  });
});

describe('Market trades endpoint', () => {
  it('should get public trades for market', async () => {
    const { status, data } = await fetchJson('/markets/mkt-btc-usd/trades');
    expect(status).toBe(200);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
  });

  it('should limit trades', async () => {
    const { status, data } = await fetchJson('/markets/mkt-btc-usd/trades?limit=5');
    expect(status).toBe(200);
    expect(data.data.length).toBeLessThanOrEqual(5);
  });

  it('should return 404 for unknown market', async () => {
    const { status, data } = await fetchJson('/markets/unknown/trades');
    expect(status).toBe(404);
    expect(data.error.code).toBe('MARKET_NOT_FOUND');
  });
});

describe('Extended account endpoints', () => {
  it('should get specific trading account', async () => {
    // First list accounts to get an ID
    const listResult = await fetchJson('/trading/trading-accounts');
    expect(listResult.data.data.length).toBeGreaterThan(0);

    const accountId = listResult.data.data[0].account_id;
    const { status, data } = await fetchJson(`/trading/trading-accounts/${accountId}`);
    expect(status).toBe(200);
    expect(data.data.account_id).toBe(accountId);
  });

  it('should return 404 for unknown trading account', async () => {
    const { status, data } = await fetchJson('/trading/trading-accounts/unknown');
    expect(status).toBe(404);
    expect(data.error.code).toBe('ACCOUNT_NOT_FOUND');
  });

  it('should get currency trading accounts', async () => {
    const { status, data } = await fetchJson('/trading/currency-trading-accounts');
    expect(status).toBe(200);
    expect(Array.isArray(data.data)).toBe(true);
  });

  it('should get issuance accounts', async () => {
    const { status, data } = await fetchJson('/trading/issuance-accounts');
    expect(status).toBe(200);
    expect(Array.isArray(data.data)).toBe(true);
  });
});

describe('Supply summary endpoint', () => {
  it('should get supply summary', async () => {
    const { status, data } = await fetchJson('/supply-issuances/summary');
    expect(status).toBe(200);
    expect(typeof data.data.total_issued).toBe('number');
    expect(typeof data.data.total_issuances).toBe('number');
  });
});

describe('Transfer history endpoint', () => {
  it('should get transfer history', async () => {
    const { status, data } = await fetchJson('/trading/transfer-histories');
    expect(status).toBe(200);
    expect(Array.isArray(data.data)).toBe(true);
  });

  it('should filter transfer history by instrument', async () => {
    const { status, data } = await fetchJson('/trading/transfer-histories?filters[0][field]=instrument_id&filters[0][value]=compute');
    expect(status).toBe(200);
    expect(Array.isArray(data.data)).toBe(true);
  });
});

describe('Signing key revoke endpoint', () => {
  it('should register and revoke signing key', async () => {
    // Register key
    const registerResult = await fetchJson('/signing-keys', {
      method: 'POST',
      body: JSON.stringify({
        signing_key: {
          public_key: 'revoke-test-key-base64',
          label: 'Revoke Test Key',
        },
      }),
    });

    expect(registerResult.status).toBe(201);
    const keyId = registerResult.data.data.id;

    // Revoke key
    const revokeResponse = await fetch(`${baseUrl}/signing-keys/${keyId}`, {
      method: 'DELETE',
    });

    expect(revokeResponse.status).toBe(204);
  });

  it('should return 404 for unknown key revocation', async () => {
    const response = await fetch(`${baseUrl}/signing-keys/unknown-key`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(404);
  });
});

describe('Issuance account endpoints', () => {
  it('should transfer from issuance to trading', async () => {
    const { status, data } = await fetchJson('/issuance-accounts/transfer', {
      method: 'POST',
      body: JSON.stringify({
        instrument_id: 'instr-prime',
        quantity: 500,
      }),
    });

    expect(status).toBe(201);
    expect(data.data.id).toBeDefined();
    expect(data.data.quantity).toBe(500);
    expect(data.data.status).toBe('completed');
  });

  it('should reject invalid transfer', async () => {
    const { status, data } = await fetchJson('/issuance-accounts/transfer', {
      method: 'POST',
      body: JSON.stringify({
        instrument_id: 'instr-prime',
      }),
    });

    expect(status).toBe(400);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });
});
