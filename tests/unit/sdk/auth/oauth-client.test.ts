import axios from 'axios';
import {
  requestDeviceCode,
  pollForToken,
  refreshAccessToken,
  revokeToken,
  GRID_CLI_CLIENT_ID,
  DEFAULT_SCOPES,
} from '../../../../src/sdk/auth/oauth-client';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Suppress logger output in tests
jest.mock('../../../../src/core/logging/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('OAuth Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constants', () => {
    it('exports a well-known client_id', () => {
      expect(GRID_CLI_CLIENT_ID).toBe('grid-cli-public');
    });

    it('exports default scopes covering all operations', () => {
      expect(DEFAULT_SCOPES).toContain('account:read');
      expect(DEFAULT_SCOPES).toContain('trade:write');
      expect(DEFAULT_SCOPES).toContain('supply:read');
      expect(DEFAULT_SCOPES).toContain('keys:manage');
      expect(DEFAULT_SCOPES.length).toBeGreaterThanOrEqual(7);
    });
  });

  describe('requestDeviceCode', () => {
    const baseUrl = 'http://localhost:4020';

    it('sends POST to /api/v1/oauth/device/code with client_id and scope', async () => {
      const mockResponse = {
        data: {
          device_code: 'dev_abc123',
          user_code: 'ABCD-1234',
          verification_uri: 'http://localhost:4000/api/v1/oauth/device',
          expires_in: 900,
          interval: 5,
        },
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await requestDeviceCode(baseUrl, 'my-client', ['account:read']);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:4020/api/v1/oauth/device/code',
        { client_id: 'my-client', scope: 'account:read' },
      );
      expect(result.device_code).toBe('dev_abc123');
      expect(result.user_code).toBe('ABCD-1234');
      expect(result.interval).toBe(5);
    });

    it('joins multiple scopes with spaces', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { device_code: 'x', user_code: 'Y', verification_uri: 'z', expires_in: 60, interval: 5 },
      });

      await requestDeviceCode(baseUrl, 'c', ['account:read', 'trade:write']);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ scope: 'account:read trade:write' }),
      );
    });
  });

  describe('pollForToken', () => {
    const baseUrl = 'http://localhost:4020';

    it('returns success when token is issued', async () => {
      const tokenResponse = {
        access_token: 'grid_at_abc',
        refresh_token: 'grid_rt_xyz',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'account:read',
      };
      mockedAxios.post.mockResolvedValueOnce({ data: tokenResponse });

      const result = await pollForToken(baseUrl, 'client', 'dev_code', 0.01, 10);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.tokens.access_token).toBe('grid_at_abc');
      }
    });

    it('returns denied on access_denied error', async () => {
      const axiosError = new axios.AxiosError('denied');
      (axiosError as any).response = {
        data: { error: 'access_denied', error_description: 'User denied' },
      };
      mockedAxios.post.mockRejectedValueOnce(axiosError);

      const result = await pollForToken(baseUrl, 'client', 'dev_code', 0.01, 10);

      expect(result.status).toBe('denied');
    });

    it('returns expired on expired_token error', async () => {
      const axiosError = new axios.AxiosError('expired');
      (axiosError as any).response = {
        data: { error: 'expired_token' },
      };
      mockedAxios.post.mockRejectedValueOnce(axiosError);

      const result = await pollForToken(baseUrl, 'client', 'dev_code', 0.01, 10);

      expect(result.status).toBe('expired');
    });

    it('retries on authorization_pending then succeeds', async () => {
      const pendingError = new axios.AxiosError('pending');
      (pendingError as any).response = {
        data: { error: 'authorization_pending' },
      };

      const tokenResponse = {
        access_token: 'grid_at_ok',
        refresh_token: 'grid_rt_ok',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'account:read',
      };

      mockedAxios.post
        .mockRejectedValueOnce(pendingError)
        .mockResolvedValueOnce({ data: tokenResponse });

      const result = await pollForToken(baseUrl, 'client', 'dev_code', 0.01, 10);

      expect(result.status).toBe('success');
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('refreshAccessToken', () => {
    it('sends refresh_token grant type', async () => {
      const tokenResponse = {
        data: {
          access_token: 'grid_at_new',
          refresh_token: 'grid_rt_new',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'account:read',
        },
      };
      mockedAxios.post.mockResolvedValue(tokenResponse);

      const result = await refreshAccessToken('http://localhost:4020', 'client-id', 'grid_rt_old');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:4020/api/v1/oauth/token',
        {
          grant_type: 'refresh_token',
          client_id: 'client-id',
          refresh_token: 'grid_rt_old',
        },
      );
      expect(result.access_token).toBe('grid_at_new');
    });
  });

  describe('revokeToken', () => {
    it('sends POST to /api/v1/oauth/revoke', async () => {
      mockedAxios.post.mockResolvedValue({ data: {} });

      await revokeToken('http://localhost:4020', 'grid_at_abc');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:4020/api/v1/oauth/revoke',
        { token: 'grid_at_abc' },
      );
    });
  });
});
