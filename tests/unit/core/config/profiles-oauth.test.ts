import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  saveCredentialsFile,
  loadCredentialsFile,
  setProfile,
  getProfile,
  updateProfileOAuthTokens,
  clearProfileOAuthTokens,
  type CredentialsFile,
  type Profile,
} from '../../../../src/core/config/profiles';

jest.mock('../../../../src/core/logging/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Profile OAuth Persistence', () => {
  let tempDir: string;
  let originalEnv: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grid-cli-test-'));
    const credPath = path.join(tempDir, 'credentials.json');
    originalEnv = process.env.GRID_CREDENTIALS_FILE;
    process.env.GRID_CREDENTIALS_FILE = credPath;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.GRID_CREDENTIALS_FILE;
    } else {
      process.env.GRID_CREDENTIALS_FILE = originalEnv;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('can save and load a profile with OAuth fields', () => {
    const oauthProfile: Profile = {
      auth_type: 'oauth',
      api_url: 'http://localhost:4020/v1',
      access_token: 'grid_at_test123',
      refresh_token: 'grid_rt_test456',
      token_expires_at: '2026-04-07T12:00:00.000Z',
      oauth_scopes: ['account:read', 'trade:write'],
      oauth_client_id: 'grid-cli-dev-public-client',
      oauth_base_url: 'http://localhost:4020',
    };

    setProfile('oauth-user', oauthProfile);

    const loaded = getProfile('oauth-user');
    expect(loaded).not.toBeNull();
    expect(loaded!.auth_type).toBe('oauth');
    expect(loaded!.access_token).toBe('grid_at_test123');
    expect(loaded!.refresh_token).toBe('grid_rt_test456');
    expect(loaded!.oauth_scopes).toEqual(['account:read', 'trade:write']);
    expect(loaded!.oauth_client_id).toBe('grid-cli-dev-public-client');
  });

  it('backward-compat: profiles without auth_type load fine', () => {
    const legacyProfile: Profile = {
      api_url: 'http://localhost:4040/v1',
      signing_key: 'base64key',
      signing_key_fingerprint: 'fp123',
    };

    setProfile('legacy', legacyProfile);

    const loaded = getProfile('legacy');
    expect(loaded).not.toBeNull();
    expect(loaded!.auth_type).toBeUndefined();
    expect(loaded!.signing_key).toBe('base64key');
  });

  describe('updateProfileOAuthTokens', () => {
    it('updates tokens on an existing profile', () => {
      setProfile('refreshable', {
        auth_type: 'oauth',
        api_url: 'http://localhost:4020/v1',
        access_token: 'old_at',
        refresh_token: 'old_rt',
        token_expires_at: '2026-04-07T10:00:00.000Z',
        oauth_client_id: 'grid-cli-dev-public-client',
        oauth_base_url: 'http://localhost:4020',
      });

      updateProfileOAuthTokens('refreshable', {
        access_token: 'new_at',
        refresh_token: 'new_rt',
        token_expires_at: '2026-04-07T11:00:00.000Z',
      });

      const loaded = getProfile('refreshable');
      expect(loaded!.access_token).toBe('new_at');
      expect(loaded!.refresh_token).toBe('new_rt');
      expect(loaded!.token_expires_at).toBe('2026-04-07T11:00:00.000Z');
    });

    it('throws for non-existent profile', () => {
      expect(() =>
        updateProfileOAuthTokens('ghost', {
          access_token: 'x',
          refresh_token: 'y',
          token_expires_at: 'z',
        }),
      ).toThrow("Profile 'ghost' does not exist.");
    });
  });

  describe('clearProfileOAuthTokens', () => {
    it('removes OAuth fields from a profile', () => {
      setProfile('to-clear', {
        auth_type: 'oauth',
        api_url: 'http://localhost:4020/v1',
        access_token: 'at',
        refresh_token: 'rt',
        token_expires_at: '2026-04-07T12:00:00.000Z',
        oauth_scopes: ['account:read'],
        oauth_client_id: 'grid-cli-dev-public-client',
        oauth_base_url: 'http://localhost:4020',
      });

      clearProfileOAuthTokens('to-clear');

      const loaded = getProfile('to-clear');
      expect(loaded).not.toBeNull();
      expect(loaded!.access_token).toBeUndefined();
      expect(loaded!.refresh_token).toBeUndefined();
      expect(loaded!.oauth_scopes).toBeUndefined();
      expect(loaded!.auth_type).toBeUndefined();
      // api_url should remain
      expect(loaded!.api_url).toBe('http://localhost:4020/v1');
    });

    it('is a no-op for missing profile', () => {
      expect(() => clearProfileOAuthTokens('nonexistent')).not.toThrow();
    });
  });
});
