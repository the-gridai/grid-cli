import http from 'http';
import crypto from 'crypto';
import nacl from 'tweetnacl';

jest.mock('../../../../src/core/config/config', () => ({
  getConfig: jest.fn(),
  getConfigForProfile: jest.fn(),
}));
jest.mock('../../../../src/core/logging/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn() },
}));

import { getConfig } from '../../../../src/core/config/config';
import { ControlApiAuth, createSignedHeaders } from '../../../../src/core/auth/control-api-auth';

const key = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(7));
const fingerprint = 'dummy-control-key';
const body = '{"quantity":1}';
const target = '/config/validate?strategyId=issuer';

function request(headers: Record<string, string>, url = target): http.IncomingMessage {
  return { method: 'POST', url, headers } as http.IncomingMessage;
}

describe('Control API request authentication', () => {
  beforeEach(() => {
    (getConfig as jest.Mock).mockReturnValue({
      SIGNING_KEY: Buffer.from(key.secretKey).toString('base64'),
      SIGNING_KEY_FINGERPRINT: fingerprint,
    });
  });

  it('accepts a signed query target and rejects changing its strategy', () => {
    const auth = new ControlApiAuth();
    const headers = createSignedHeaders('POST', target, body);
    expect(auth.authenticateRequest(request(headers, '/config/validate?strategyId=trader'), body).authenticated).toBe(false);
    expect(auth.authenticateRequest(request(headers), body).authenticated).toBe(true);
  });

  it('rejects a replay while allowing distinct identical operations in the same second', () => {
    const auth = new ControlApiAuth();
    const headers = createSignedHeaders('POST', '/orders/cancel-all', body);
    const req = request(headers, '/orders/cancel-all');
    expect(auth.authenticateRequest(req, body).authenticated).toBe(true);
    expect(auth.authenticateRequest(req, body).authenticated).toBe(false);
    const next = createSignedHeaders('POST', '/orders/cancel-all', body);
    expect(next['x-thegrid-nonce']).not.toBe(headers['x-thegrid-nonce']);
    expect(auth.authenticateRequest(request(next, '/orders/cancel-all'), body).authenticated).toBe(true);
  });

  it('rejects a legacy trading signature for a control operation', () => {
    const auth = new ControlApiAuth();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const path = '/orders/cancel-all';
    const signature = nacl.sign.detached(Buffer.from(`${timestamp}POST${path}${body}`), key.secretKey);
    const headers = {
      'x-thegrid-signature': Buffer.from(signature).toString('base64'),
      'x-thegrid-timestamp': timestamp,
      'x-thegrid-fingerprint': fingerprint,
      'x-thegrid-nonce': crypto.randomBytes(16).toString('hex'),
    };
    expect(auth.authenticateRequest(request(headers, path), body).authenticated).toBe(false);
  });

  it('rejects malformed header types and timestamps without throwing', () => {
    const auth = new ControlApiAuth();
    const headers = createSignedHeaders('POST', target, body);
    expect(auth.authenticateRequest(request({ ...headers, 'x-thegrid-timestamp': `${headers['x-thegrid-timestamp']}junk` }), body).authenticated).toBe(false);
    const req = request(headers);
    req.headers['x-thegrid-fingerprint'] = [fingerprint, fingerprint];
    expect(() => auth.authenticateRequest(req, body)).not.toThrow();
    expect(auth.authenticateRequest(req, body).authenticated).toBe(false);
  });
});

