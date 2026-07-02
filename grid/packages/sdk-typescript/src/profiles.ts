/**
 * Profile management for Grid SDK
 *
 * Loads credentials from the Grid CLI's credential store (~/.grid-cli/credentials.json)
 * This allows SDK users to reuse credentials configured via `grid profile add`.
 *
 * @example
 * ```typescript
 * import { GridClient, loadProfile, getAvailableProfiles } from '@the-gridai/grid-sdk';
 *
 * // List available profiles
 * const profiles = getAvailableProfiles();
 * console.log('Available profiles:', profiles);
 *
 * // Load a specific profile
 * const config = loadProfile('production');
 * const client = new GridClient(config);
 *
 * // Or use the convenience method
 * const client = GridClient.fromProfile('production');
 *
 * // Use current/default profile
 * const client = GridClient.fromProfile();
 * ```
 *
 * @module profiles
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import type { GridClientConfig } from './types/index.js';

// Default credentials file location (same as grid-cli)
const CREDENTIALS_DIR = path.join(os.homedir(), '.grid-cli');
const CREDENTIALS_FILE = path.join(CREDENTIALS_DIR, 'credentials.json');

/**
 * Profile data structure (matches grid-cli's format)
 */
export interface Profile {
  description?: string;
  api_url?: string;
  ws_url?: string;
  signing_key?: string;
  signing_key_fingerprint?: string;
  // Legacy field names (for backward compatibility)
  private_key?: string;
  api_key_fingerprint?: string;
  api_key?: string;
}

/**
 * Credentials file structure
 */
interface CredentialsFile {
  version?: number;
  current_profile?: string;
  default_profile?: string; // legacy
  profiles: Record<string, Profile>;
}

/**
 * Options for loading a profile
 */
export interface LoadProfileOptions {
  /** Path to credentials file (default: ~/.grid-cli/credentials.json) */
  credentialsPath?: string;
  /** Override API URL from profile */
  apiUrl?: string;
  /** Override WebSocket URL from profile */
  wsUrl?: string;
}

/**
 * Get the path to the credentials file
 */
export function getCredentialsPath(): string {
  return process.env.GRID_CREDENTIALS_PATH || CREDENTIALS_FILE;
}

/**
 * Check if credentials file exists
 */
export function credentialsFileExists(credentialsPath?: string): boolean {
  const filePath = credentialsPath || getCredentialsPath();
  return fs.existsSync(filePath);
}

/**
 * Load and parse the credentials file
 */
function loadCredentialsFile(credentialsPath?: string): CredentialsFile | null {
  const filePath = credentialsPath || getCredentialsPath();

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as CredentialsFile;
  } catch (error) {
    throw new Error(`Failed to parse credentials file at ${filePath}: ${error}`);
  }
}

/**
 * Get list of available profile names
 *
 * @param credentialsPath - Optional path to credentials file
 * @returns Array of profile names, or empty array if no credentials file
 *
 * @example
 * ```typescript
 * const profiles = getAvailableProfiles();
 * // ['default', 'production', 'staging']
 * ```
 */
export function getAvailableProfiles(credentialsPath?: string): string[] {
  const credentials = loadCredentialsFile(credentialsPath);
  if (!credentials?.profiles) {
    return [];
  }
  return Object.keys(credentials.profiles);
}

/**
 * Get the current/default profile name
 *
 * @param credentialsPath - Optional path to credentials file
 * @returns Profile name or undefined if no default is set
 */
export function getCurrentProfile(credentialsPath?: string): string | undefined {
  // Check environment variable first
  if (process.env.GRID_PROFILE) {
    return process.env.GRID_PROFILE;
  }

  const credentials = loadCredentialsFile(credentialsPath);
  if (!credentials) {
    return undefined;
  }

  // Try current_profile, then default_profile (legacy), then 'default'
  return (
    credentials.current_profile ||
    credentials.default_profile ||
    (credentials.profiles['default'] ? 'default' : undefined)
  );
}

/**
 * Get profile data by name
 *
 * @param profileName - Name of the profile to load
 * @param credentialsPath - Optional path to credentials file
 * @returns Profile data or undefined if not found
 */
export function getProfile(profileName: string, credentialsPath?: string): Profile | undefined {
  const credentials = loadCredentialsFile(credentialsPath);
  return credentials?.profiles[profileName];
}

/**
 * Load a profile and return GridClientConfig
 *
 * This is the main function for loading credentials from the grid-cli profile store.
 *
 * @param profileName - Name of profile to load (default: current profile or GRID_PROFILE env)
 * @param options - Additional options
 * @returns GridClientConfig ready to use with GridClient constructor
 * @throws Error if profile not found or missing required fields
 *
 * @example
 * ```typescript
 * // Load specific profile
 * const config = loadProfile('production');
 * const client = new GridClient(config);
 *
 * // Load current profile
 * const config = loadProfile();
 * const client = new GridClient(config);
 *
 * // Override API URL
 * const config = loadProfile('production', {
 *   apiUrl: 'http://localhost:4000/v1'
 * });
 * ```
 */
export function loadProfile(
  profileName?: string,
  options: LoadProfileOptions = {}
): GridClientConfig {
  const credentialsPath = options.credentialsPath || getCredentialsPath();

  // Determine which profile to load
  const targetProfile = profileName || getCurrentProfile(credentialsPath);

  if (!targetProfile) {
    throw new Error(
      'No profile specified and no default profile found. ' +
        'Set GRID_PROFILE environment variable, use `grid profile use <name>`, ' +
        'or pass a profile name to loadProfile().'
    );
  }

  const profile = getProfile(targetProfile, credentialsPath);

  if (!profile) {
    const available = getAvailableProfiles(credentialsPath);
    throw new Error(
      `Profile "${targetProfile}" not found. ` +
        (available.length > 0
          ? `Available profiles: ${available.join(', ')}`
          : `No profiles found in ${credentialsPath}`)
    );
  }

  // Get signing key (support both new and legacy field names)
  const signingKey = profile.signing_key || profile.private_key;
  const fingerprint = profile.signing_key_fingerprint || profile.api_key_fingerprint;

  if (!signingKey) {
    throw new Error(`Profile "${targetProfile}" is missing signing_key (or private_key)`);
  }

  if (!fingerprint) {
    throw new Error(
      `Profile "${targetProfile}" is missing signing_key_fingerprint (or api_key_fingerprint)`
    );
  }

  // Build config with defaults
  const apiUrl =
    options.apiUrl ||
    profile.api_url ||
    process.env.GRID_API_URL ||
    'https://api.thegrid.ai/v1';

  const wsUrl =
    options.wsUrl ||
    profile.ws_url ||
    process.env.GRID_WS_URL ||
    apiUrl
      .replace(/^http/, 'ws')
      .replace(/\/(?:api\/v1(?:\/trading)?|v1(?:\/trading)?)(?:\/.*)?$/, '/ws');

  return {
    apiUrl,
    wsUrl,
    signingKey,
    fingerprint,
  };
}

/**
 * Load profile from environment variables
 *
 * Convenience function for loading credentials from environment variables.
 * Useful for production deployments where credentials are injected via env.
 *
 * Required environment variables:
 * - GRID_SIGNING_KEY or SIGNING_KEY
 * - GRID_FINGERPRINT or SIGNING_KEY_FINGERPRINT
 *
 * Optional environment variables:
 * - GRID_API_URL or API_URL (default: https://api.thegrid.ai/v1)
 * - GRID_WS_URL or WS_URL
 *
 * @returns GridClientConfig
 * @throws Error if required environment variables are missing
 *
 * @example
 * ```typescript
 * // In production with env vars set:
 * // GRID_SIGNING_KEY=base64...
 * // GRID_FINGERPRINT=hash...
 * const config = loadFromEnv();
 * const client = new GridClient(config);
 * ```
 */
export function loadFromEnv(): GridClientConfig {
  const signingKey = process.env.GRID_SIGNING_KEY || process.env.SIGNING_KEY;
  const fingerprint =
    process.env.GRID_FINGERPRINT ||
    process.env.SIGNING_KEY_FINGERPRINT ||
    process.env.API_KEY_FINGERPRINT;

  if (!signingKey) {
    throw new Error(
      'Missing signing key. Set GRID_SIGNING_KEY or SIGNING_KEY environment variable.'
    );
  }

  if (!fingerprint) {
    throw new Error(
      'Missing fingerprint. Set GRID_FINGERPRINT or SIGNING_KEY_FINGERPRINT environment variable.'
    );
  }

  const apiUrl =
    process.env.GRID_API_URL || process.env.API_URL || 'https://api.thegrid.ai/v1';

  const wsUrl =
    process.env.GRID_WS_URL ||
    process.env.WS_URL ||
    apiUrl
      .replace(/^http/, 'ws')
      .replace(/\/(?:api\/v1(?:\/trading)?|v1(?:\/trading)?)(?:\/.*)?$/, '/ws');

  return {
    apiUrl,
    wsUrl,
    signingKey,
    fingerprint,
  };
}

/**
 * Auto-load configuration from profile or environment
 *
 * Tries to load configuration in this order:
 * 1. GRID_PROFILE environment variable -> load that profile
 * 2. Current profile from credentials file
 * 3. Environment variables (GRID_SIGNING_KEY, etc.)
 *
 * @returns GridClientConfig
 * @throws Error if no configuration source is available
 *
 * @example
 * ```typescript
 * // Works with either profile or env vars
 * const config = autoLoadConfig();
 * const client = new GridClient(config);
 * ```
 */
export function autoLoadConfig(): GridClientConfig {
  // Try profile first
  if (process.env.GRID_PROFILE || credentialsFileExists()) {
    try {
      return loadProfile();
    } catch {
      // Fall through to env vars
    }
  }

  // Fall back to environment variables
  return loadFromEnv();
}
