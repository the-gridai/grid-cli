/**
 * User and authentication types for GRID Exchange
 */

/**
 * User information
 */
export interface User {
  user_id: string;
  id?: string; // Alias
  email: string;
  name?: string;
  email_verified: boolean;
  accepted_terms: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * User registration request
 */
export interface RegisterUserRequest {
  email: string;
  password: string;
  password_confirmation: string;
  accepted_terms?: boolean;
}

/**
 * User login request
 */
export interface LoginRequest {
  email: string;
  password: string;
  remember_me?: boolean;
}

/**
 * API key information
 */
export interface ApiKey {
  key_id: string;
  id?: string; // Alias
  name: string;
  key_prefix: string;
  is_active: boolean;
  expires_at?: string;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Create API key request
 */
export interface CreateApiKeyRequest {
  name: string;
  expires_at?: string;
}

/**
 * Update API key request
 */
export interface UpdateApiKeyRequest {
  name?: string;
  is_active?: boolean;
}

/**
 * Signing key information
 */
export interface SigningKey {
  key_id: string;
  id?: string; // Alias
  label: string;
  fingerprint: string;
  public_key: string;
  is_active: boolean;
  created_at: string;
  last_used_at?: string;
}

/**
 * Register signing key request
 */
export interface RegisterSigningKeyRequest {
  label: string;
  public_key: string;
}

/**
 * Password reset request
 */
export interface PasswordResetRequest {
  email: string;
}

/**
 * Password change request
 */
export interface ChangePasswordRequest {
  password: string;
  password_confirmation: string;
}

/**
 * Update user name request
 */
export interface UpdateUserNameRequest {
  name: string;
}

