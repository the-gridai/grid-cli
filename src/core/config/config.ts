import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { getEffectiveConfig, getGlobalProfileOverride, hasUserSetCurrentProfile, type Profile } from './profiles';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Smart .env loading - only as fallback for local development
// Priority (lowest to highest): 1) .env file, 2) .env.local file, 3) Environment variables, 4) Profile credentials
function loadDotenvIfNeeded(): void {
  // Skip dotenv entirely if key env vars are already set (production/K8s)
  if (process.env.SIGNING_KEY || process.env.PRIVATE_KEY || process.env.TRADING_PRIVATE_KEY_PATH) {
    return;
  }

  // Find .env relative to the grid-cli installation, not cwd
  const possibleBasePaths = [
    // Relative to this file (works for both src and dist)
    path.resolve(__dirname, '..', '..', '..'),
    path.resolve(__dirname, '..', '..', '..', '..'),
    // Fallback to cwd for other environments
    process.cwd(),
  ];

  for (const basePath of possibleBasePaths) {
    const envPath = path.resolve(basePath, '.env');
    if (fs.existsSync(envPath)) {
      // override: false means existing env vars take precedence
      dotenv.config({ path: envPath, override: false });

      // Then load .env.local if it exists (overrides .env values)
      const envLocalPath = path.resolve(basePath, '.env.local');
      if (fs.existsSync(envLocalPath)) {
        dotenv.config({ path: envLocalPath, override: true });
      }
      return;
    }
  }
}

loadDotenvIfNeeded();

const ConfigSchema = z.object({
  API_URL: z.string().default('https://trading.api.dev.thegrid.ai/v1'),
  CONSUMPTION_API_URL: z.string().default('https://api.dev.thegrid.ai/v1'),
  WS_URL: z.string().default('wss://trading.api.dev.thegrid.ai/v1/'),
  API_KEY: z.string().optional(),
  TRADING_PRIVATE_KEY_PATH: z.string().optional(),
  TRADING_PUBLIC_KEY_PATH: z.string().optional(),
  GRID_CLI_CONSUMPTION_KEY: z.string().optional(),
  // Direct key configuration (for testing/backwards compatibility)
  // Supports both PRIVATE_KEY/API_KEY_FINGERPRINT and SIGNING_KEY/SIGNING_KEY_FINGERPRINT
  PRIVATE_KEY: z.string().optional(),
  API_KEY_FINGERPRINT: z.string().optional(),
  SIGNING_KEY: z.string().optional(),
  SIGNING_KEY_FINGERPRINT: z.string().optional(),
  // OAuth fields (populated from profile when auth_type is "oauth")
  AUTH_TYPE: z.enum(['signing_key', 'oauth']).optional(),
  ACCESS_TOKEN: z.string().optional(),
  REFRESH_TOKEN: z.string().optional(),
  TOKEN_EXPIRES_AT: z.string().optional(),
  OAUTH_CLIENT_ID: z.string().optional(),
  OAUTH_BASE_URL: z.string().optional(),
  // PostgreSQL Configuration
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('postgres'),
  DB_NAME: z.string().default('grid-cli'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  // SDK Configuration
  SDK_MAX_RETRIES: z.coerce.number().default(2),
  SDK_RATE_LIMIT_CONCURRENT: z.coerce.number().default(10),
  SDK_RATE_LIMIT_INTERVAL: z.coerce.number().default(0),
  SDK_REQUEST_TIMEOUT: z.coerce.number().default(30000),
});

export type Config = z.infer<typeof ConfigSchema>;

let config: Config | null = null;

/**
 * Apply profile configuration to the base config
 * When a profile is explicitly selected, profile values OVERRIDE env vars
 * This ensures --profile flag works as expected
 */
function applyProfileConfig(baseConfig: Config, profile: Profile, isExplicitProfile: boolean): Config {
  const oauthOverrides: Partial<Config> = {};
  if (profile.auth_type) oauthOverrides.AUTH_TYPE = profile.auth_type;
  if (profile.access_token) oauthOverrides.ACCESS_TOKEN = profile.access_token;
  if (profile.refresh_token) oauthOverrides.REFRESH_TOKEN = profile.refresh_token;
  if (profile.token_expires_at) oauthOverrides.TOKEN_EXPIRES_AT = profile.token_expires_at;
  if (profile.oauth_client_id) oauthOverrides.OAUTH_CLIENT_ID = profile.oauth_client_id;
  if (profile.oauth_base_url) oauthOverrides.OAUTH_BASE_URL = profile.oauth_base_url;

  if (isExplicitProfile) {
    return {
      ...baseConfig,
      API_URL: profile.api_url || baseConfig.API_URL,
      WS_URL: profile.ws_url || baseConfig.WS_URL,
      CONSUMPTION_API_URL: profile.consumption_api_url || baseConfig.CONSUMPTION_API_URL,
      SIGNING_KEY: profile.signing_key || profile.private_key || baseConfig.SIGNING_KEY,
      SIGNING_KEY_FINGERPRINT: profile.signing_key_fingerprint || profile.api_key_fingerprint || baseConfig.SIGNING_KEY_FINGERPRINT,
      API_KEY: profile.api_key || baseConfig.API_KEY,
      PRIVATE_KEY: profile.signing_key || profile.private_key || baseConfig.PRIVATE_KEY,
      API_KEY_FINGERPRINT: profile.signing_key_fingerprint || profile.api_key_fingerprint || baseConfig.API_KEY_FINGERPRINT,
      ...oauthOverrides,
    };
  } else {
    return {
      ...baseConfig,
      API_URL: baseConfig.API_URL || profile.api_url || baseConfig.API_URL,
      WS_URL: baseConfig.WS_URL || profile.ws_url || baseConfig.WS_URL,
      CONSUMPTION_API_URL: baseConfig.CONSUMPTION_API_URL || profile.consumption_api_url || baseConfig.CONSUMPTION_API_URL,
      SIGNING_KEY: baseConfig.SIGNING_KEY || profile.signing_key || profile.private_key,
      SIGNING_KEY_FINGERPRINT: baseConfig.SIGNING_KEY_FINGERPRINT || profile.signing_key_fingerprint || profile.api_key_fingerprint,
      API_KEY: baseConfig.API_KEY || profile.api_key,
      PRIVATE_KEY: baseConfig.PRIVATE_KEY || profile.signing_key || profile.private_key,
      API_KEY_FINGERPRINT: baseConfig.API_KEY_FINGERPRINT || profile.signing_key_fingerprint || profile.api_key_fingerprint,
      ...oauthOverrides,
    };
  }
}

export const loadConfig = (): Config => {
  if (config) return config;

  const parsed = ConfigSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('Invalid configuration:', parsed.error.format());
    process.exit(1);
  }

  config = parsed.data;
  return config;
};

/**
 * Get config with profile overrides applied
 * This is the main function to use for getting configuration
 * 
 * Precedence (highest to lowest):
 *   1. --profile flag
 *   2. Current profile set via `grid profile use`
 *   3. Environment variables / .env file
 */
export const getConfig = (): Config => {
  // Load base config from env if not already loaded
  if (!config) {
    loadConfig();
  }
  
  // Check if we should apply profile config
  const profileOverride = getGlobalProfileOverride();
  // Profile takes precedence if:
  // - --profile flag was used
  // - GRID_PROFILE env var is set
  // - User has set a current profile via `grid profile use`
  const isExplicitProfile = !!(profileOverride || process.env.GRID_PROFILE || hasUserSetCurrentProfile());
  const effectiveProfile = getEffectiveConfig(profileOverride);
  
  // If profile has credentials (signing-key or OAuth), apply them
  if (effectiveProfile.signing_key || effectiveProfile.api_url || effectiveProfile.auth_type === 'oauth') {
    return applyProfileConfig(config!, effectiveProfile, isExplicitProfile);
  }
  
  return config!;
};

/**
 * Reset the cached config (useful for testing or profile switching)
 */
export const resetConfig = (): void => {
  config = null;
};

/**
 * Get config for a specific profile (SDK use)
 * Profile values take precedence since this is an explicit profile request
 */
export const getConfigForProfile = (profileName: string): Config => {
  if (!config) {
    loadConfig();
  }
  
  const profile = getEffectiveConfig(profileName);
  return applyProfileConfig(config!, profile, true); // true = explicit profile
};
