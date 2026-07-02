/**
 * Multi-profile credentials management for grid-cli
 * 
 * Similar to AWS CLI's credentials file, this allows managing multiple
 * credential profiles and switching between them.
 * 
 * File location: ~/.grid-cli/credentials.json
 * 
 * ## Usage
 * 
 *   - CLI flag: `grid --profile marketmaker order list`
 *   - Set current: `grid profile use marketmaker`
 *   - Environment: `GRID_PROFILE=marketmaker grid order list`
 *   - SDK: `ApiClient.getInstanceForProfile('marketmaker')`
 * 
 * ## Configuration Precedence (highest to lowest)
 * 
 *   1. `--profile` flag - Explicit per-command override
 *   2. Current profile - Set via `grid profile use <name>`
 *   3. Environment variables / .env file - Fallback when no profile is set
 * 
 * This ensures:
 *   - `--profile prod` always uses prod credentials (highest priority)
 *   - `grid profile use dev` makes dev profile active for all commands
 *   - .env files only used when no profile is configured
 *   - Kubernetes deployments using env vars work when no profile is set
 * 
 * ## Profile Selection Priority
 * 
 * The active profile is determined by (first match wins):
 * 
 *   1. Explicit argument to function (SDK use)
 *   2. Global override set by --profile CLI flag
 *   3. GRID_PROFILE environment variable
 *   4. current_profile from credentials file (set via `grid profile use`)
 *   5. "default" profile if it exists
 * 
 * @module profiles
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { z } from 'zod';
import { logger } from '../logging/logger';

// Schema for consumption session configuration
export const ConsumptionConfigSchema = z.object({
  /** Default inference spec (e.g., "fast-inference", "prime-inference") */
  default_spec: z.string().optional(),
  /** Default system instructions for hotwire */
  default_instructions: z.string().optional(),
  /** Automatically transfer from trading when consumption balance is low */
  auto_fund: z.boolean().optional(),
  /** Amount to transfer when auto-funding (default: 1000) */
  auto_fund_amount: z.number().optional(),
  /** Default temperature for inference (0-2) */
  default_temperature: z.number().min(0).max(2).optional(),
  /** Default max tokens for inference */
  default_max_tokens: z.number().optional(),
});

export type ConsumptionConfig = z.infer<typeof ConsumptionConfigSchema>;

// Schema for a single profile
export const ProfileSchema = z.object({
  description: z.string().optional(),
  api_url: z.string().url().optional(),
  ws_url: z.string().optional(),
  consumption_api_url: z.string().url().optional(),
  signing_key: z.string().optional(),
  signing_key_fingerprint: z.string().optional(),
  // Legacy/alternative names
  private_key: z.string().optional(),
  api_key_fingerprint: z.string().optional(),
  api_key: z.string().optional(),
  // OAuth fields (populated by `grid auth login` device flow)
  auth_type: z.enum(['signing_key', 'oauth']).optional(),
  access_token: z.string().optional(),
  refresh_token: z.string().optional(),
  token_expires_at: z.string().optional(),
  oauth_scopes: z.array(z.string()).optional(),
  oauth_client_id: z.string().optional(),
  oauth_base_url: z.string().optional(),
  // Consumption session configuration
  consumption: ConsumptionConfigSchema.optional(),
});

export type Profile = z.infer<typeof ProfileSchema>;

// Schema for the credentials file
export const CredentialsFileSchema = z.object({
  version: z.number().default(1),
  // Note: we support both current_profile (new) and default_profile (legacy) for backward compat
  current_profile: z.string().optional(),
  default_profile: z.string().optional(), // legacy, prefer current_profile
  profiles: z.record(z.string(), ProfileSchema),
});

export type CredentialsFile = z.infer<typeof CredentialsFileSchema>;

// Default credentials file path
const CREDENTIALS_DIR = path.join(os.homedir(), '.grid-cli');
const CREDENTIALS_FILE = path.join(CREDENTIALS_DIR, 'credentials.json');

/**
 * Get the path to the credentials file
 */
export function getCredentialsPath(): string {
  return process.env.GRID_CREDENTIALS_FILE || CREDENTIALS_FILE;
}

/**
 * Ensure the credentials directory exists
 */
function ensureCredentialsDir(): void {
  const credentialsPath = getCredentialsPath();
  const dir = path.dirname(credentialsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

/**
 * Load the credentials file
 */
export function loadCredentialsFile(): CredentialsFile | null {
  const credentialsPath = getCredentialsPath();
  
  if (!fs.existsSync(credentialsPath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(credentialsPath, 'utf8');
    const data = JSON.parse(content);
    return CredentialsFileSchema.parse(data);
  } catch (error) {
    logger.warn('Failed to load credentials file', { 
      path: credentialsPath, 
      error: error instanceof Error ? error.message : String(error) 
    });
    return null;
  }
}

/**
 * Save the credentials file
 */
export function saveCredentialsFile(credentials: CredentialsFile): void {
  ensureCredentialsDir();
  const credentialsPath = getCredentialsPath();
  
  // Validate before saving
  CredentialsFileSchema.parse(credentials);
  
  const content = JSON.stringify(credentials, null, 2);
  fs.writeFileSync(credentialsPath, content, { mode: 0o600 });
  logger.info('Credentials file saved', { path: credentialsPath });
}

/**
 * In-memory registry for dynamically created profiles.
 * Used by multi-strategy daemon to give each strategy its own credentials.
 */
const dynamicProfiles: Map<string, Profile> = new Map();

/**
 * Register a dynamic profile (in-memory only, not persisted to file).
 * Used by multi-strategy daemon to create per-strategy credential profiles.
 */
export function registerDynamicProfile(profileName: string, profile: Profile): void {
  dynamicProfiles.set(profileName, profile);
  logger.debug(`Registered dynamic profile: ${profileName}`);
}

/**
 * Clear all dynamic profiles (useful for testing)
 */
export function clearDynamicProfiles(): void {
  dynamicProfiles.clear();
}

/**
 * Get a specific profile by name.
 * Checks dynamic profiles first, then file-based profiles.
 */
export function getProfile(profileName: string): Profile | null {
  // Check dynamic profiles first (for multi-strategy support)
  const dynamicProfile = dynamicProfiles.get(profileName);
  if (dynamicProfile) {
    return dynamicProfile;
  }
  
  // Fall back to file-based profiles
  const credentials = loadCredentialsFile();
  if (!credentials) {
    return null;
  }
  
  return credentials.profiles[profileName] || null;
}

/**
 * Get the currently active profile name based on priority:
 * 1. Explicit profile name passed as argument
 * 2. GRID_PROFILE environment variable
 * 3. default_profile from credentials file
 * 4. 'default' if it exists
 */
export function getActiveProfileName(explicitProfile?: string): string | null {
  // 1. Explicit profile name passed as argument
  if (explicitProfile) {
    return explicitProfile;
  }
  
  // 2. Global override (set by --profile flag)
  if (globalProfileOverride) {
    return globalProfileOverride;
  }
  
  // 3. Environment variable
  const envProfile = process.env.GRID_PROFILE;
  if (envProfile) {
    return envProfile;
  }
  
  // 3. Current profile from file (with backward compat for default_profile)
  const credentials = loadCredentialsFile();
  if (credentials?.current_profile) {
    return credentials.current_profile;
  }
  // Backward compat: support legacy default_profile field
  if (credentials?.default_profile) {
    return credentials.default_profile;
  }
  
  // 4. Check if 'default' profile exists (legacy fallback)
  if (credentials?.profiles['default']) {
    return 'default';
  }
  
  return null;
}

/**
 * Get the active profile configuration
 */
export function getActiveProfile(explicitProfile?: string): Profile | null {
  const profileName = getActiveProfileName(explicitProfile);
  if (!profileName) {
    return null;
  }
  
  return getProfile(profileName);
}

/**
 * List all available profiles
 */
export function listProfiles(): { name: string; profile: Profile; isCurrent: boolean }[] {
  const credentials = loadCredentialsFile();
  if (!credentials) {
    return [];
  }
  
  // Support both current_profile (new) and default_profile (legacy)
  const currentProfileName = credentials.current_profile || credentials.default_profile;
  
  return Object.entries(credentials.profiles).map(([name, profile]) => ({
    name,
    profile,
    isCurrent: name === currentProfileName,
  }));
}

/**
 * Set or update a profile
 */
export function setProfile(name: string, profile: Profile): void {
  let credentials = loadCredentialsFile();
  
  if (!credentials) {
    credentials = {
      version: 1,
      profiles: {},
    };
  }
  
  // Validate the profile
  ProfileSchema.parse(profile);
  
  credentials.profiles[name] = profile;
  saveCredentialsFile(credentials);
}

/**
 * Delete a profile
 */
export function deleteProfile(name: string): boolean {
  const credentials = loadCredentialsFile();
  if (!credentials || !credentials.profiles[name]) {
    return false;
  }
  
  delete credentials.profiles[name];
  
  // If deleting the current profile, clear it
  if (credentials.current_profile === name) {
    delete credentials.current_profile;
  }
  // Also clear legacy default_profile if it matches
  if (credentials.default_profile === name) {
    delete credentials.default_profile;
  }
  
  saveCredentialsFile(credentials);
  return true;
}

/**
 * Set the current active profile
 */
export function setCurrentProfile(name: string): void {
  const credentials = loadCredentialsFile();
  if (!credentials) {
    throw new Error('No credentials file found. Create a profile first.');
  }
  
  if (!credentials.profiles[name]) {
    throw new Error(`Profile '${name}' does not exist.`);
  }
  
  // Use current_profile (new), clear default_profile (legacy) for clean migration
  credentials.current_profile = name;
  delete credentials.default_profile;
  saveCredentialsFile(credentials);
}

/**
 * @deprecated Use setCurrentProfile instead
 */
export const setDefaultProfile = setCurrentProfile;

/**
 * Check if a profile exists
 */
export function profileExists(name: string): boolean {
  const credentials = loadCredentialsFile();
  return credentials?.profiles[name] !== undefined;
}

/**
 * Initialize credentials file with empty structure
 */
export function initCredentialsFile(): void {
  if (fs.existsSync(getCredentialsPath())) {
    return; // Don't overwrite existing file
  }
  
  const initialCredentials: CredentialsFile = {
    version: 1,
    profiles: {},
  };
  
  saveCredentialsFile(initialCredentials);
}

/**
 * Merge profile config with environment variables
 * 
 * @param profile - Profile configuration
 * @param profileTakesPrecedence - If true, profile values override env vars (for explicit --profile flag)
 */
export function mergeProfileWithEnv(profile: Profile | null, profileTakesPrecedence: boolean = false): Profile {
  const envSigningKey = process.env.SIGNING_KEY || process.env.PRIVATE_KEY;
  const envFingerprint = process.env.SIGNING_KEY_FINGERPRINT || process.env.API_KEY_FINGERPRINT;
  const envApiUrl = process.env.API_URL;
  const envWsUrl = process.env.WS_URL;
  const envConsumptionApiUrl = process.env.CONSUMPTION_API_URL;
  const envApiKey = process.env.API_KEY;
  
  // Preserve OAuth fields from the profile (env vars don't carry these)
  const oauthFields: Partial<Profile> = {};
  if (profile?.auth_type) oauthFields.auth_type = profile.auth_type;
  if (profile?.access_token) oauthFields.access_token = profile.access_token;
  if (profile?.refresh_token) oauthFields.refresh_token = profile.refresh_token;
  if (profile?.token_expires_at) oauthFields.token_expires_at = profile.token_expires_at;
  if (profile?.oauth_scopes) oauthFields.oauth_scopes = profile.oauth_scopes;
  if (profile?.oauth_client_id) oauthFields.oauth_client_id = profile.oauth_client_id;
  if (profile?.oauth_base_url) oauthFields.oauth_base_url = profile.oauth_base_url;

  if (profileTakesPrecedence && profile) {
    return {
      description: profile.description,
      api_url: profile.api_url || envApiUrl,
      ws_url: profile.ws_url || envWsUrl,
      consumption_api_url: profile.consumption_api_url || envConsumptionApiUrl,
      signing_key: profile.signing_key || profile.private_key || envSigningKey,
      signing_key_fingerprint: profile.signing_key_fingerprint || profile.api_key_fingerprint || envFingerprint,
      api_key: profile.api_key || envApiKey,
      ...oauthFields,
    };
  }
  
  return {
    description: profile?.description,
    api_url: envApiUrl || profile?.api_url,
    ws_url: envWsUrl || profile?.ws_url,
    consumption_api_url: envConsumptionApiUrl || profile?.consumption_api_url,
    signing_key: envSigningKey || profile?.signing_key || profile?.private_key,
    signing_key_fingerprint: envFingerprint || profile?.signing_key_fingerprint || profile?.api_key_fingerprint,
    api_key: envApiKey || profile?.api_key,
    ...oauthFields,
  };
}

// Global state for the currently selected profile (set by CLI)
let globalProfileOverride: string | undefined;

/**
 * Set the global profile override (used by CLI --profile flag)
 */
export function setGlobalProfileOverride(profileName: string | undefined): void {
  globalProfileOverride = profileName;
}

/**
 * Get the global profile override
 */
export function getGlobalProfileOverride(): string | undefined {
  return globalProfileOverride;
}

/**
 * Check if user has explicitly set a current profile (via `grid profile use`)
 */
export function hasUserSetCurrentProfile(): boolean {
  const credentials = loadCredentialsFile();
  return !!(credentials?.current_profile || credentials?.default_profile);
}

/**
 * Get effective configuration by merging profile and environment
 * 
 * Precedence (highest to lowest):
 *   1. --profile flag (explicitProfile or globalProfileOverride)
 *   2. Current profile set via `grid profile use`
 *   3. Environment variables / .env file
 * 
 * @param explicitProfile - If provided, this profile's values take precedence over env vars
 */
export function getEffectiveConfig(explicitProfile?: string): Profile {
  const profileName = explicitProfile || globalProfileOverride;
  const profile = getActiveProfile(profileName);
  
  // Profile takes precedence when:
  // 1. Argument to this function (SDK use)
  // 2. Global override (--profile flag)
  // 3. GRID_PROFILE environment variable
  // 4. User has set a current profile via `grid profile use`
  const profileTakesPrecedence = !!(
    explicitProfile || 
    globalProfileOverride || 
    process.env.GRID_PROFILE ||
    hasUserSetCurrentProfile()
  );
  return mergeProfileWithEnv(profile, profileTakesPrecedence);
}

/**
 * Get consumption configuration from the active profile
 * 
 * Merges profile consumption config with environment variables:
 *   - GRID_DEFAULT_SPEC - Default inference spec
 *   - GRID_AUTO_FUND - Enable auto-fund (true/false)
 *   - GRID_AUTO_FUND_AMOUNT - Amount to transfer when auto-funding
 */
export function getConsumptionConfig(explicitProfile?: string): ConsumptionConfig {
  const profileName = explicitProfile || globalProfileOverride;
  const profile = getActiveProfile(profileName);
  const profileConfig = profile?.consumption || {};
  
  // Environment overrides
  const envSpec = process.env.GRID_DEFAULT_SPEC;
  const envAutoFund = process.env.GRID_AUTO_FUND;
  const envAutoFundAmount = process.env.GRID_AUTO_FUND_AMOUNT;
  const envInstructions = process.env.GRID_DEFAULT_INSTRUCTIONS;
  const envTemperature = process.env.GRID_DEFAULT_TEMPERATURE;
  const envMaxTokens = process.env.GRID_DEFAULT_MAX_TOKENS;
  
  return {
    default_spec: envSpec || profileConfig.default_spec,
    default_instructions: envInstructions || profileConfig.default_instructions,
    auto_fund: envAutoFund !== undefined ? envAutoFund === 'true' : profileConfig.auto_fund,
    auto_fund_amount: envAutoFundAmount ? parseInt(envAutoFundAmount, 10) : profileConfig.auto_fund_amount,
    default_temperature: envTemperature ? parseFloat(envTemperature) : profileConfig.default_temperature,
    default_max_tokens: envMaxTokens ? parseInt(envMaxTokens, 10) : profileConfig.default_max_tokens,
  };
}

/**
 * Update OAuth tokens for a profile after login or token refresh.
 */
export function updateProfileOAuthTokens(
  profileName: string,
  tokens: {
    access_token: string;
    refresh_token: string;
    token_expires_at: string;
    oauth_scopes?: string[];
  },
): void {
  const credentials = loadCredentialsFile();
  if (!credentials || !credentials.profiles[profileName]) {
    throw new Error(`Profile '${profileName}' does not exist.`);
  }

  const profile = credentials.profiles[profileName];
  profile.access_token = tokens.access_token;
  profile.refresh_token = tokens.refresh_token;
  profile.token_expires_at = tokens.token_expires_at;
  if (tokens.oauth_scopes) {
    profile.oauth_scopes = tokens.oauth_scopes;
  }

  saveCredentialsFile(credentials);
}

/**
 * Clear OAuth credentials from a profile (used by logout).
 */
export function clearProfileOAuthTokens(profileName: string): void {
  const credentials = loadCredentialsFile();
  if (!credentials || !credentials.profiles[profileName]) {
    return;
  }

  const profile = credentials.profiles[profileName];
  delete profile.access_token;
  delete profile.refresh_token;
  delete profile.token_expires_at;
  delete profile.oauth_scopes;
  delete profile.oauth_client_id;
  delete profile.oauth_base_url;
  profile.auth_type = undefined;

  saveCredentialsFile(credentials);
}

/**
 * Update consumption configuration for a profile
 */
export function setConsumptionConfig(profileName: string, config: Partial<ConsumptionConfig>): void {
  const credentials = loadCredentialsFile();
  if (!credentials) {
    throw new Error('No credentials file found. Create a profile first.');
  }
  
  if (!credentials.profiles[profileName]) {
    throw new Error(`Profile '${profileName}' does not exist.`);
  }
  
  // Merge with existing consumption config
  const existingConfig = credentials.profiles[profileName].consumption || {};
  credentials.profiles[profileName].consumption = {
    ...existingConfig,
    ...config,
  };
  
  saveCredentialsFile(credentials);
}
