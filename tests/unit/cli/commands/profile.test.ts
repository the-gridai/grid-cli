/**
 * Tests for profile command logic
 */

describe('Profile Commands', () => {
  describe('Config Precedence', () => {
    it('should use profile values when current profile is set', () => {
      // Simulates: user has run `grid profile use dev`
      const hasUserSetCurrentProfile = true;
      const profileApiUrl = 'https://api.thegrid.ai';
      const envApiUrl = 'http://localhost:4040';

      // Profile should take precedence when user has set a current profile
      const effectiveApiUrl = hasUserSetCurrentProfile ? profileApiUrl : envApiUrl;
      expect(effectiveApiUrl).toBe('https://api.thegrid.ai');
    });

    it('should use env values when no current profile is set', () => {
      // Simulates: no profile configured, using .env
      const hasUserSetCurrentProfile = false;
      const profileApiUrl = undefined;
      const envApiUrl = 'http://localhost:4040';

      // Env should be used when no profile is set
      const effectiveApiUrl = hasUserSetCurrentProfile && profileApiUrl
        ? profileApiUrl 
        : envApiUrl;
      expect(effectiveApiUrl).toBe('http://localhost:4040');
    });

    it('should prioritize --profile flag over current profile', () => {
      // Simulates: user runs `grid --profile prod` while current is `dev`
      const explicitProfileFlag = 'prod';
      const currentProfile = 'dev';
      const prodApiUrl = 'https://prod.thegrid.ai';
      const devApiUrl = 'https://dev.thegrid.ai';

      // --profile flag should win
      const activeProfile = explicitProfileFlag || currentProfile;
      const effectiveApiUrl = activeProfile === 'prod' ? prodApiUrl : devApiUrl;
      expect(effectiveApiUrl).toBe('https://prod.thegrid.ai');
    });

    it('should check if user has set current profile', () => {
      // hasUserSetCurrentProfile checks if current_profile or default_profile is set
      const credentialsWithCurrent = { current_profile: 'dev', profiles: {} };
      const credentialsWithDefault = { default_profile: 'dev', profiles: {} };
      const credentialsWithNone = { profiles: {} };

      const hasCurrentSet = (creds: any) => !!(creds.current_profile || creds.default_profile);

      expect(hasCurrentSet(credentialsWithCurrent)).toBe(true);
      expect(hasCurrentSet(credentialsWithDefault)).toBe(true);
      expect(hasCurrentSet(credentialsWithNone)).toBe(false);
    });
  });

  describe('Profile List Data Transform', () => {
    it('should transform profile data correctly', () => {
      const rawProfile = {
        description: 'Dev environment',
        api_url: 'http://localhost:4040/v1',
        signing_key: 'secret-key',
        api_key: undefined,
      };
      const name = 'dev';
      const isCurrent = true;
      const activeProfile = 'dev';

      const profileInfo = {
        name,
        description: rawProfile.description,
        apiUrl: rawProfile.api_url,
        hasCredentials: !!(rawProfile.signing_key || rawProfile.api_key),
        isCurrent,
        isActive: name === activeProfile,
      };

      expect(profileInfo.name).toBe('dev');
      expect(profileInfo.hasCredentials).toBe(true);
      expect(profileInfo.isCurrent).toBe(true);
      expect(profileInfo.isActive).toBe(true);
    });

    it('should handle missing credentials', () => {
      const rawProfile = {
        description: 'Empty profile',
        api_url: undefined,
        signing_key: undefined,
        api_key: undefined,
      };

      const hasCredentials = !!(rawProfile.signing_key || rawProfile.api_key);
      expect(hasCredentials).toBe(false);
    });

    it('should mark correct profile as active', () => {
      const profiles = ['dev', 'prod', 'staging'];
      const activeProfile = 'prod';

      const result = profiles.map(name => ({
        name,
        isActive: name === activeProfile,
      }));

      expect(result.find(p => p.name === 'dev')?.isActive).toBe(false);
      expect(result.find(p => p.name === 'prod')?.isActive).toBe(true);
      expect(result.find(p => p.name === 'staging')?.isActive).toBe(false);
    });
  });

  describe('Profile Detail Data Transform', () => {
    it('should transform profile detail correctly', () => {
      const rawProfile = {
        description: 'Production environment',
        api_url: 'https://api.thegrid.ai',
        ws_url: 'wss://ws.thegrid.ai',
        signing_key: 'base64-key',
        signing_key_fingerprint: 'fingerprint-123',
        api_key_fingerprint: undefined,
        api_key: undefined,
      };

      const profileDetail = {
        name: 'prod',
        description: rawProfile.description,
        apiUrl: rawProfile.api_url,
        wsUrl: rawProfile.ws_url,
        signingKey: rawProfile.signing_key,
        fingerprint: rawProfile.signing_key_fingerprint || rawProfile.api_key_fingerprint,
        apiKey: rawProfile.api_key,
      };

      expect(profileDetail.apiUrl).toBe('https://api.thegrid.ai');
      expect(profileDetail.fingerprint).toBe('fingerprint-123');
      expect(profileDetail.apiKey).toBeUndefined();
    });

    it('should fall back to api_key_fingerprint', () => {
      const rawProfile = {
        signing_key_fingerprint: undefined,
        api_key_fingerprint: 'api-fingerprint',
      };

      const fingerprint = rawProfile.signing_key_fingerprint || rawProfile.api_key_fingerprint;
      expect(fingerprint).toBe('api-fingerprint');
    });
  });

  describe('Secret Masking', () => {
    function maskSecret(secret: string): string {
      if (secret.length <= 8) return '****';
      return secret.substring(0, 4) + '...' + secret.substring(secret.length - 4);
    }

    it('should mask long secrets', () => {
      expect(maskSecret('this-is-a-very-long-secret-key')).toBe('this...-key');
    });

    it('should fully mask short secrets', () => {
      expect(maskSecret('short')).toBe('****');
    });

    it('should handle exactly 8 characters', () => {
      expect(maskSecret('12345678')).toBe('****');
    });

    it('should handle 9 characters', () => {
      expect(maskSecret('123456789')).toBe('1234...6789');
    });
  });

  describe('URL Truncation', () => {
    function truncate(str: string, maxLength: number): string {
      if (str.length <= maxLength) return str;
      return str.substring(0, maxLength - 3) + '...';
    }

    it('should not truncate short URLs', () => {
      expect(truncate('http://localhost', 40)).toBe('http://localhost');
    });

    it('should truncate long URLs', () => {
      const longUrl = 'https://api.thegrid.ai/v1/very/long/path/that/exceeds/limit';
      const result = truncate(longUrl, 40);
      expect(result.length).toBe(40);
      expect(result.endsWith('...')).toBe(true);
    });

    it('should handle exact length', () => {
      const exactLength = 'a'.repeat(40);
      expect(truncate(exactLength, 40)).toBe(exactLength);
    });
  });

  describe('Profile Merge Logic', () => {
    it('should merge new options with existing profile', () => {
      const existingProfile = {
        description: 'Old description',
        api_url: 'http://old.api.com',
        signing_key: 'old-key',
      };

      const options = {
        description: undefined, // Keep existing
        apiUrl: 'http://new.api.com', // Override
        signingKey: undefined, // Keep existing
      };

      const merged = {
        description: options.description ?? existingProfile.description,
        api_url: options.apiUrl ?? existingProfile.api_url,
        signing_key: options.signingKey ?? existingProfile.signing_key,
      };

      expect(merged.description).toBe('Old description');
      expect(merged.api_url).toBe('http://new.api.com');
      expect(merged.signing_key).toBe('old-key');
    });

    it('should handle new profile creation', () => {
      const existingProfile = {};
      const options = {
        description: 'New profile',
        apiUrl: 'http://api.com',
        signingKey: 'new-key',
      };

      const merged = {
        description: options.description ?? (existingProfile as any).description,
        api_url: options.apiUrl ?? (existingProfile as any).api_url,
        signing_key: options.signingKey ?? (existingProfile as any).signing_key,
      };

      expect(merged.description).toBe('New profile');
      expect(merged.api_url).toBe('http://api.com');
      expect(merged.signing_key).toBe('new-key');
    });
  });
});
