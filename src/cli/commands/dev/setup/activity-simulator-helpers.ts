import { type Profile } from '../../../../core/config/profiles.js';

export function parsePositiveNumber(input: string, fieldName: string): number {
  const value = Number(input);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive number`);
  }
  return value;
}

export function profileHasSigningCredentials(profile: Profile | null): boolean {
  if (!profile) return false;
  const signingKey = profile.signing_key || profile.private_key;
  const fingerprint = profile.signing_key_fingerprint || profile.api_key_fingerprint;
  return Boolean(signingKey && fingerprint);
}

export function buildUpdatedProfile(
  existing: Profile | null,
  options: {
    apiUrl?: string;
    wsUrl?: string;
    signingKey?: string;
    fingerprint?: string;
    roleLabel: string;
  }
): Profile {
  const merged: Profile = {
    description: existing?.description || `${options.roleLabel} profile for activity-simulator`,
    api_url: options.apiUrl ?? existing?.api_url,
    ws_url: options.wsUrl ?? existing?.ws_url,
    consumption_api_url: existing?.consumption_api_url,
    signing_key: options.signingKey ?? existing?.signing_key ?? existing?.private_key,
    signing_key_fingerprint:
      options.fingerprint ?? existing?.signing_key_fingerprint ?? existing?.api_key_fingerprint,
    api_key: existing?.api_key,
    consumption: existing?.consumption,
  };

  if (!profileHasSigningCredentials(merged)) {
    throw new Error(
      `${options.roleLabel} profile is missing signing credentials. Provide --${options.roleLabel}-signing-key and --${options.roleLabel}-fingerprint or create the profile first with "grid profile set".`
    );
  }

  return merged;
}

export function maxAvailableBalance(accounts: Array<{ available_balance: string }>): number {
  return accounts.reduce((max, account) => {
    const available = Number(account.available_balance);
    if (!Number.isFinite(available)) return max;
    return Math.max(max, available);
  }, 0);
}
