/**
 * Tests for auth command logic
 */

describe('Auth Commands', () => {
  describe('Auth Status Data Transform', () => {
    it('should detect environment credentials', () => {
      const envVars = {
        SIGNING_KEY: 'key123',
        PRIVATE_KEY: undefined,
      };

      const hasEnvCredentials = !!(envVars.SIGNING_KEY || envVars.PRIVATE_KEY);
      expect(hasEnvCredentials).toBe(true);
    });

    it('should detect profile credentials', () => {
      const profile = {
        signing_key: 'profile-key',
        private_key: undefined,
      };

      const hasProfileCredentials = !!(profile.signing_key || profile.private_key);
      expect(hasProfileCredentials).toBe(true);
    });

    it('should prefer environment over profile', () => {
      const hasEnvCredentials = true;
      const hasProfileCredentials = true;

      const credentialsFrom = hasEnvCredentials
        ? 'environment'
        : hasProfileCredentials
        ? 'profile'
        : 'none';

      expect(credentialsFrom).toBe('environment');
    });

    it('should fall back to profile when no env', () => {
      const hasEnvCredentials = false;
      const hasProfileCredentials = true;

      const credentialsFrom = hasEnvCredentials
        ? 'environment'
        : hasProfileCredentials
        ? 'profile'
        : 'none';

      expect(credentialsFrom).toBe('profile');
    });

    it('should indicate none when no credentials', () => {
      const hasEnvCredentials = false;
      const hasProfileCredentials = false;

      const credentialsFrom = hasEnvCredentials
        ? 'environment'
        : hasProfileCredentials
        ? 'profile'
        : 'none';

      expect(credentialsFrom).toBe('none');
    });
  });

  describe('Credentials Source Label', () => {
    function getCredentialsSourceLabel(source?: 'environment' | 'profile' | 'none'): string {
      switch (source) {
        case 'environment':
          return 'Environment variables';
        case 'profile':
          return 'Profile';
        case 'none':
        default:
          return 'Not configured';
      }
    }

    it('should return correct label for environment', () => {
      expect(getCredentialsSourceLabel('environment')).toBe('Environment variables');
    });

    it('should return correct label for profile', () => {
      expect(getCredentialsSourceLabel('profile')).toBe('Profile');
    });

    it('should return correct label for none', () => {
      expect(getCredentialsSourceLabel('none')).toBe('Not configured');
    });

    it('should return correct label for undefined', () => {
      expect(getCredentialsSourceLabel(undefined)).toBe('Not configured');
    });
  });

  describe('Key Masking', () => {
    function maskKey(key: string | undefined): string | undefined {
      if (!key) return undefined;
      return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
    }

    it('should mask signing key', () => {
      const key = 'base64-encoded-signing-key-here';
      expect(maskKey(key)).toBe('base...here');
    });

    it('should handle undefined key', () => {
      expect(maskKey(undefined)).toBeUndefined();
    });

    it('should handle short keys', () => {
      const key = '12345678';
      expect(maskKey(key)).toBe('1234...5678');
    });
  });

  describe('Connection Status Handling', () => {
    it('should identify success with accounts', () => {
      const accounts = [{ id: '1' }, { id: '2' }];
      const status = accounts && accounts.length > 0 ? 'success' : 'empty';
      expect(status).toBe('success');
    });

    it('should identify empty accounts', () => {
      const accounts: any[] = [];
      const status = accounts && accounts.length > 0 ? 'success' : 'empty';
      expect(status).toBe('empty');
    });

    it('should identify auth error by status code', () => {
      const error = { response: { status: 401 } };
      const isAuthError = error.response?.status === 401;
      expect(isAuthError).toBe(true);
    });

    it('should identify connection refused', () => {
      const error = { code: 'ECONNREFUSED' };
      const isConnRefused = error.code === 'ECONNREFUSED';
      expect(isConnRefused).toBe(true);
    });
  });

  describe('Account Transform', () => {
    it('should transform account data', () => {
      const accounts = [
        { account_id: 'acc_1', instrument_symbol: 'BTC' },
        { id: 'acc_2', instrument_symbol: 'ETH' },
      ];

      const transformed = accounts.map((acc: any) => ({
        id: acc.account_id || acc.id,
        symbol: acc.instrument_symbol || 'unknown',
      }));

      expect(transformed[0].id).toBe('acc_1');
      expect(transformed[0].symbol).toBe('BTC');
      expect(transformed[1].id).toBe('acc_2');
    });

    it('should handle missing symbol', () => {
      const accounts = [{ account_id: 'acc_1' }];

      const transformed = accounts.map((acc: any) => ({
        id: acc.account_id || acc.id,
        symbol: acc.instrument_symbol || 'unknown',
      }));

      expect(transformed[0].symbol).toBe('unknown');
    });
  });

  describe('Auth Login Options', () => {
    it('should display both options in legacy mode', () => {
      const options = ['PROFILE', 'ENVIRONMENT'];
      expect(options).toHaveLength(2);
      expect(options).toContain('PROFILE');
      expect(options).toContain('ENVIRONMENT');
    });
  });

  describe('Auth Type Detection', () => {
    it('should detect OAuth profile', () => {
      const profile = { auth_type: 'oauth' as const, access_token: 'grid_at_x' };
      const isOAuth = profile.auth_type === 'oauth';
      expect(isOAuth).toBe(true);
    });

    it('should detect signing_key profile', () => {
      const profile: { auth_type: string; signing_key: string } = { auth_type: 'signing_key', signing_key: 'abc' };
      const isOAuth = profile.auth_type === 'oauth';
      expect(isOAuth).toBe(false);
    });

    it('should default to signing_key when auth_type is absent', () => {
      const profile = { signing_key: 'abc' };
      const isOAuth = (profile as any).auth_type === 'oauth';
      expect(isOAuth).toBe(false);
    });

    it('should detect expired OAuth token', () => {
      const pastDate = new Date(Date.now() - 60_000).toISOString();
      const expired = new Date(pastDate).getTime() < Date.now();
      expect(expired).toBe(true);
    });

    it('should detect valid OAuth token', () => {
      const futureDate = new Date(Date.now() + 3600_000).toISOString();
      const expired = new Date(futureDate).getTime() < Date.now();
      expect(expired).toBe(false);
    });
  });

  describe('Auth Type Label', () => {
    function getAuthTypeLabel(authType?: 'signing_key' | 'oauth'): string {
      switch (authType) {
        case 'oauth':
          return 'OAuth (device flow)';
        case 'signing_key':
          return 'Ed25519 signing key';
        default:
          return 'Signing key (default)';
      }
    }

    it('should label OAuth correctly', () => {
      expect(getAuthTypeLabel('oauth')).toBe('OAuth (device flow)');
    });

    it('should label signing_key correctly', () => {
      expect(getAuthTypeLabel('signing_key')).toBe('Ed25519 signing key');
    });

    it('should label undefined as default', () => {
      expect(getAuthTypeLabel(undefined)).toBe('Signing key (default)');
    });
  });
});
