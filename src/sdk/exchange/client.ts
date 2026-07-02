/**
 * Exchange API client (session or OAuth bearer).
 *
 * Used for programmatic key management and account settings on `/api/v1/*`
 * at the OAuth hostname (not the Trading `/v1` host).
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import http from 'http';
import https from 'https';
import { getConfig, getConfigForProfile, type Config } from '../../core/config/config';
import { getGlobalProfileOverride } from '../../core/config/profiles';
import { ApiError } from '../../core/errors';
import { logger } from '../../core/logging/logger';
import type { ApiResponse } from '../types/api';
import type { RegisterSigningKeyRequest, SigningKey } from '../types/user';
import {
  OAuthSession,
  oauthSessionFromConfig,
  resolveExchangeBaseUrl,
} from '../auth/oauth-session';

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

export interface ExchangeApiKey {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  expires_at?: string | null;
  key?: string;
}

export interface ExchangeSystemSettings {
  account_mode: string;
  auto_transfer_enabled: boolean;
  auto_top_up_enabled: boolean;
  auto_top_up_quantity?: number | null;
  auto_top_up_trigger_threshold?: number | null;
  auto_reload_enabled: boolean;
  auto_reload_threshold_usd?: string | null;
  auto_reload_amount_usd?: string | null;
  auto_reload_monthly_limit_usd?: string | null;
}

export interface ExchangeClientOptions {
  profile?: string;
}

export class ExchangeClient {
  private client: AxiosInstance;
  private oauthSession: OAuthSession | null = null;
  private static instance: ExchangeClient;
  private static profileInstances = new Map<string, ExchangeClient>();

  private constructor(options?: ExchangeClientOptions) {
    const config = options?.profile ? getConfigForProfile(options.profile) : getConfig();
    const baseURL = `${resolveExchangeBaseUrl(config)}/api/v1`;

    this.client = axios.create({
      baseURL,
      timeout: config.SDK_REQUEST_TIMEOUT || 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'grid-cli/1.0',
      },
      httpAgent,
      httpsAgent,
    });

    const oauth = oauthSessionFromConfig(config);
    if (!oauth) {
      throw new ApiError(
        'Exchange API key and settings commands require OAuth. Run `grid auth login` first.',
        401,
      );
    }
    this.oauthSession = new OAuthSession(oauth, options?.profile);

    this.client.interceptors.request.use(async (req) => {
      const token = await this.oauthSession!.ensureFreshAccessToken();
      req.headers.set('Authorization', `Bearer ${token}`);
      return req;
    });

    this.client.interceptors.response.use(
      (res) => res,
      (error: AxiosError) => {
        const status = error.response?.status || 500;
        const body = error.response?.data as Record<string, unknown> | undefined;
        const message =
          (body?.error_description as string) ||
          (body?.error as string) ||
          (body?.errors as { detail?: string })?.detail ||
          error.message;
        throw new ApiError(message, status);
      },
    );

    logger.debug('ExchangeClient initialized', { baseURL });
  }

  public static getInstance(options?: ExchangeClientOptions): ExchangeClient {
    const profileOverride = getGlobalProfileOverride();
    const profile = options?.profile || profileOverride;

    if (profile) {
      const cached = ExchangeClient.profileInstances.get(profile);
      if (cached) return cached;
      const instance = new ExchangeClient({ profile });
      ExchangeClient.profileInstances.set(profile, instance);
      return instance;
    }

    if (!ExchangeClient.instance) {
      ExchangeClient.instance = new ExchangeClient();
    }
    return ExchangeClient.instance;
  }

  public static resetInstances(): void {
    ExchangeClient.instance = undefined as unknown as ExchangeClient;
    ExchangeClient.profileInstances.clear();
  }

  public async listApiKeys(): Promise<ExchangeApiKey[]> {
    const response = await this.client.get<ApiResponse<ExchangeApiKey[]>>('/api-keys');
    return response.data?.data ?? [];
  }

  public async createApiKey(name: string, expiresAt?: string): Promise<ExchangeApiKey> {
    const response = await this.client.post<ApiResponse<ExchangeApiKey>>('/api-keys', {
      api_key: { name, ...(expiresAt ? { expires_at: expiresAt } : {}) },
    });
    if (!response.data?.data) {
      throw new ApiError('Invalid response format', 500);
    }
    return response.data.data;
  }

  public async revokeApiKey(id: string): Promise<void> {
    await this.client.delete(`/api-keys/${id}`);
  }

  public async listSigningKeys(): Promise<SigningKey[]> {
    const response = await this.client.get<ApiResponse<SigningKey[]>>('/signing-keys');
    return response.data?.data ?? [];
  }

  public async createSigningKey(keyData: RegisterSigningKeyRequest): Promise<SigningKey> {
    const response = await this.client.post<ApiResponse<SigningKey>>('/signing-keys', {
      signing_key: keyData,
    });
    if (!response.data?.data) {
      throw new ApiError('Invalid response format', 500);
    }
    return response.data.data;
  }

  public async revokeSigningKey(id: string): Promise<void> {
    await this.client.delete(`/signing-keys/${id}`);
  }

  public async getSystemSettings(): Promise<ExchangeSystemSettings> {
    const response = await this.client.get<ApiResponse<ExchangeSystemSettings>>(
      '/self/system-settings',
    );
    if (!response.data?.data) {
      throw new ApiError('Invalid response format', 500);
    }
    return response.data.data;
  }

  public async patchAutoReload(attrs: Record<string, boolean | string | number>): Promise<ExchangeSystemSettings> {
    const response = await this.client.patch<ApiResponse<ExchangeSystemSettings>>(
      '/self/system-settings/auto_reload',
      attrs,
    );
    if (!response.data?.data) {
      throw new ApiError('Invalid response format', 500);
    }
    return response.data.data;
  }

  /** PATCH auto-transfer override (`auto_transfer_enabled` or `auto_transfer_override: null` for system default). */
  public async patchAutoTransfer(
    attrs: { auto_transfer_enabled?: boolean; auto_transfer_override?: boolean | null },
  ): Promise<ExchangeSystemSettings> {
    const response = await this.client.patch<ApiResponse<ExchangeSystemSettings>>(
      '/self/system-settings/auto-transfer',
      attrs,
    );
    if (!response.data?.data) {
      throw new ApiError('Invalid response format', 500);
    }
    return response.data.data;
  }

  public async toggleAutoTopUp(): Promise<void> {
    await this.client.post('/self/system-settings/auto-top-up/toggle');
  }

  public async switchAccountMode(mode: 'easy' | 'advanced'): Promise<void> {
    await this.client.post('/self/system-settings/account-mode', { mode });
  }
}
