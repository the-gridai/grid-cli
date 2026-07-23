/**
 * GRID API Client with resilience and type safety
 * 
 * Production-ready SDK client with:
 * - Automatic retry with exponential backoff
 * - Rate limiting to prevent API throttling
 * - Type-safe request/response handling
 * - Input/output validation
 * - Structured error handling
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import http from 'http';
import https from 'https';
import { getConfig, getConfigForProfile, type Config } from '../../core/config/config';
import { getGlobalProfileOverride, updateProfileOAuthTokens, getActiveProfileName } from '../../core/config/profiles';
import { SignatureAuth } from '../auth/signature';
import { refreshAccessToken } from '../auth/oauth-client';
import { logger } from '../../core/logging/logger';
import { RateLimiter } from './rate-limiter';
import { withRetry, type RetryConfig } from './retry';
import { transformAxiosError } from './error-handler';
import { ApiError, NetworkError, OrderAlreadyCancelledError } from '../../core/errors';
import {
  startRequestTiming,
  recordTiming,
  completeRequestTiming,
  parseServerTimingHeaders,
  Timer,
} from './timing';

// Custom HTTP agents with increased connection limits for high-throughput benchmarks
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 100,      // Allow many concurrent connections per host
  maxFreeSockets: 20,   // Keep some sockets warm
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 20,
});

const SIGNED_PATH_PREFIXES = [
  '/orders',
  '/markets',
  '/trades',
  '/positions',
  '/transfer-histories',
  '/price-histories',
  '/trading-accounts',
  '/currency-trading-accounts',
  '/issuance-accounts',
  '/consumption-accounts',
  '/supply-issuances',
  '/supplier-liability',
  '/transfers',
  '/instruments',
  '/me',
  '/account',
  '/diagnostics',
];

// Import types
import type {
  PlaceOrderRequest,
  Order,
  UpdateOrderRequest,
  Trade,
  OrderFilters,
  TradeFilters,
  ListAllOrdersOptions,
  ListAllResult,
  ListAllTruncationReason,
} from '../types/orders';
import type { CursorPaging, PaginatedResult } from '../types/api';
import type {
  Market,
  Instrument,
  Ticker,
  OrderBook,
  PublicTrade,
  MarketStats,
  OHLCV,
} from '../types/markets';
import type {
  TradingAccount,
  CurrencyTradingAccount,
  AccountLimits,
  ConsumptionInstrument,
  IssuanceAccount,
  TransferFromIssuanceRequest,
} from '../types/accounts';
import type { ChatCompletionRequest, ChatCompletionResponse } from '../types/consumption';
import type { DiagnosticsData, DiagnosticsResponse } from '../types/diagnostics';
import type { SigningKey, RegisterSigningKeyRequest } from '../types/user';
import type { ApiResponse } from '../types/api';

/**
 * Result of a lightweight Trading API (`/v1`, e.g. port 4040) reachability check.
 * Uses `GET /me` with the same signature (or OAuth) auth as other routes — **no retries**
 * so `grid status` fails fast when the server is down.
 */
export type TradingApiPingResult =
  | { state: 'ok' }
  | { state: 'unauthorized' }
  | { state: 'offline'; message: string };

export type TradingApiHealthResult =
  | { state: 'ok'; service?: string }
  | { state: 'offline'; message: string };

// Import validators
import {
  validateResponse,
  validateArrayResponse,
  OrderSchema,
  MarketSchema,
  InstrumentSchema,
  TickerSchema,
  OrderBookSchema,
  TradeSchema,
  TradingAccountSchema,
  ConsumptionInstrumentSchema,
  ChatCompletionResponseSchema,
} from '../validators/responses';
import { validatePlaceOrderRequest } from '../validators/inputs';

/**
 * API Client for GRID Exchange
 * 
 * Singleton instance with built-in retry, rate limiting, and error handling
 */
/**
 * Options for creating an ApiClient instance
 */
export interface ApiClientOptions {
  /** Use a specific credential profile */
  profile?: string;
  /** Override API URL */
  apiUrl?: string;
  /** Override WebSocket URL */
  wsUrl?: string;
}

export class ApiClient {
  private client: AxiosInstance;
  private static instance: ApiClient;
  private static profileInstances: Map<string, ApiClient> = new Map();
  private static traceCounter = 0;
  private auth: SignatureAuth | null = null;
  private oauthConfig: {
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: string;
    clientId: string;
    baseUrl: string;
  } | null = null;
  private rateLimiter: RateLimiter;
  private profileName: string | undefined;
  private readonly traceHttp: boolean;
  private refreshPromise: Promise<void> | null = null;

  private constructor(options?: ApiClientOptions) {
    this.profileName = options?.profile;
    this.traceHttp = process.env.HTTP_TRACE === '1' || process.env.HTTP_TRACE === 'true';
    
    // Get config for specified profile or default
    const config = options?.profile ? getConfigForProfile(options.profile) : getConfig();
    
    this.rateLimiter = new RateLimiter(
      config.SDK_RATE_LIMIT_CONCURRENT || 10,
      config.SDK_RATE_LIMIT_INTERVAL ?? 0
    );
    
    // Create Axios instance with custom agents for high concurrency
    this.client = axios.create({
      baseURL: config.API_URL,
      timeout: config.SDK_REQUEST_TIMEOUT || 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'grid-cli/1.0',
      },
      httpAgent,
      httpsAgent,
    });

    // Initialize authentication: OAuth bearer or Ed25519 signature
    this.initAuth(config, options);

    // Add request interceptor for authentication and timing
    this.client.interceptors.request.use(async (req: InternalAxiosRequestConfig) => {
      const requestId = this.nextRequestId();
      const traceStartMs = Date.now();
      (req as any).__requestId = requestId;
      (req as any).__traceStartMs = traceStartMs;
      req.headers.set('x-grid-trace-id', requestId);

      // Start timing if enabled
      const timer = startRequestTiming();
      if (timer) {
        (req as any).__timer = timer;
        timer.mark('requestStart');
      }

      // OAuth bearer auth takes priority when configured
      if (this.oauthConfig) {
        await this.ensureFreshOAuthToken();
        req.headers.set('Authorization', `Bearer ${this.oauthConfig.accessToken}`);
        if (timer) timer.mark('requestSent');
        if (this.traceHttp) {
          logger.info('HTTP request start', {
            requestId,
            profile: this.profileName || 'default',
            method: String(req.method || 'get').toUpperCase(),
            url: req.baseURL ? `${req.baseURL}${req.url || ''}` : req.url,
            signed: false,
            authType: 'oauth',
          });
        }
        return req;
      }
      
      const shouldUseSignatureAuth =
        req.url && SIGNED_PATH_PREFIXES.some((prefix) => req.url!.startsWith(prefix));
      
      if (this.auth && shouldUseSignatureAuth && req.url && req.method) {
        try {
          // Time serialization
          if (timer) timer.mark('serializeStart');
          
          const baseURL = req.baseURL || '';
          const url = req.url;
          
          const cleanBase = baseURL.replace(/\/$/, '');
          const cleanUrl = url.replace(/^\//, '');
          const fullUrlString = cleanBase ? `${cleanBase}/${cleanUrl}` : `/${cleanUrl}`;
          
          let pathForSign = fullUrlString;
          if (fullUrlString.startsWith('http')) {
            const u = new URL(fullUrlString);
            pathForSign = u.pathname;
          } else if (!fullUrlString.startsWith('/')) {
            pathForSign = '/' + fullUrlString;
          }

          const body = req.data ? JSON.stringify(req.data) : '';
          
          if (timer) {
            timer.mark('serializeEnd');
            recordTiming('requestSerializationMs', timer.durationBetween('serializeStart', 'serializeEnd'));
          }
          
          // Time signature generation
          if (timer) timer.mark('signatureStart');
          
          const authHeaders = this.auth.getHeaders(req.method, pathForSign, body);
          
          if (timer) {
            timer.mark('signatureEnd');
            recordTiming('signatureGenerationMs', timer.durationBetween('signatureStart', 'signatureEnd'));
          }
          
          req.headers.set('x-thegrid-signature', authHeaders['x-thegrid-signature']);
          req.headers.set('x-thegrid-timestamp', authHeaders['x-thegrid-timestamp']);
          req.headers.set('x-thegrid-fingerprint', authHeaders['x-thegrid-fingerprint']);
        } catch (error) {
          logger.error('Failed to sign request — aborting', { error });
          throw error;
        }
      }
      
      // Mark when request is being sent
      if (timer) timer.mark('requestSent');

      if (this.traceHttp) {
        logger.info('HTTP request start', {
          requestId,
          profile: this.profileName || 'default',
          method: String(req.method || 'get').toUpperCase(),
          url: req.baseURL ? `${req.baseURL}${req.url || ''}` : req.url,
          signed: !!shouldUseSignatureAuth,
          params: this.traceParams(req.params),
          body: this.traceBody(req.data),
        });
      }
      
      return req;
    });

    // Add response interceptor for error transformation and timing
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        const requestId = (response.config as any).__requestId as string | undefined;
        const traceStartMs = (response.config as any).__traceStartMs as number | undefined;
        const elapsedMs = traceStartMs ? Date.now() - traceStartMs : undefined;
        const timer = (response.config as any).__timer as Timer | undefined;
        
        if (timer) {
          // Mark response received (TTFB approximation)
          timer.mark('responseReceived');
          const ttfb = timer.durationBetween('requestSent', 'responseReceived');
          recordTiming('timeToFirstByteMs', ttfb);
          
          // Time response parsing (already done by axios, estimate as small)
          timer.mark('parseStart');
          
          // Parse server timing headers
          const headers: Record<string, string> = {};
          if (response.headers) {
            for (const [key, value] of Object.entries(response.headers)) {
              if (typeof value === 'string') {
                headers[key.toLowerCase()] = value;
              }
            }
          }
          
          const serverTiming = parseServerTimingHeaders(headers);
          if (serverTiming.serverReportedMs !== undefined) {
            recordTiming('serverReportedMs', serverTiming.serverReportedMs);
          }
          if (serverTiming.serverAuthMs !== undefined) {
            recordTiming('serverAuthMs', serverTiming.serverAuthMs);
          }
          if (serverTiming.serverHandlerMs !== undefined) {
            recordTiming('serverHandlerMs', serverTiming.serverHandlerMs);
          }
          
          timer.mark('parseEnd');
          recordTiming('responseParsingMs', timer.durationBetween('parseStart', 'parseEnd'));
          recordTiming('responseDownloadMs', 0.1); // Axios doesn't expose this separately
          
          // Complete timing
          completeRequestTiming(timer);
        }
        
        if (this.traceHttp) {
          logger.info('HTTP request success', {
            requestId,
            profile: this.profileName || 'default',
            method: String(response.config.method || 'get').toUpperCase(),
            url: response.config.baseURL
              ? `${response.config.baseURL}${response.config.url || ''}`
              : response.config.url,
            status: response.status,
            elapsedMs,
          });
        }
        
        return response;
      },
      (error: AxiosError) => {
        const requestId = (error.config as any)?.__requestId as string | undefined;
        const traceStartMs = (error.config as any)?.__traceStartMs as number | undefined;
        const elapsedMs = traceStartMs ? Date.now() - traceStartMs : undefined;

        // Still try to capture timing on errors
        const timer = (error.config as any)?.__timer as Timer | undefined;
        if (timer) {
          timer.mark('errorReceived');
          const ttfb = timer.durationBetween('requestSent', 'errorReceived');
          recordTiming('timeToFirstByteMs', ttfb);
          completeRequestTiming(timer);
        }
        
        logger.error('HTTP request failed', {
          requestId,
          profile: this.profileName || 'default',
          method: String(error.config?.method || 'get').toUpperCase(),
          url: error.config?.baseURL
            ? `${error.config.baseURL}${error.config.url || ''}`
            : error.config?.url,
          status: error.response?.status,
          elapsedMs,
          params: this.traceParams(error.config?.params),
          body: this.traceBody(error.config?.data),
          response: this.traceBody(error.response?.data),
          code: error.code,
        });

        throw transformAxiosError(error);
      }
    );

  }

  private nextRequestId(): string {
    ApiClient.traceCounter += 1;
    const suffix = ApiClient.traceCounter.toString().padStart(6, '0');
    return `http-${Date.now()}-${suffix}`;
  }

  private traceParams(params: unknown): unknown {
    if (!params || typeof params !== 'object') return params;
    try {
      return JSON.parse(JSON.stringify(params));
    } catch {
      return '[unserializable params]';
    }
  }

  private traceBody(body: unknown): unknown {
    if (body === undefined || body === null) return undefined;
    if (typeof body === 'string') {
      try {
        return JSON.parse(body);
      } catch {
        return body.length > 1000 ? `${body.slice(0, 1000)}...` : body;
      }
    }
    if (typeof body === 'object') {
      try {
        return JSON.parse(JSON.stringify(body));
      } catch {
        return '[unserializable body]';
      }
    }
    return body;
  }

  private initAuth(config: Config, options?: ApiClientOptions): void {
    if (config.AUTH_TYPE === 'oauth' && config.ACCESS_TOKEN && config.REFRESH_TOKEN) {
      this.oauthConfig = {
        accessToken: config.ACCESS_TOKEN,
        refreshToken: config.REFRESH_TOKEN,
        tokenExpiresAt: config.TOKEN_EXPIRES_AT || '',
        clientId: config.OAUTH_CLIENT_ID || '',
        baseUrl: config.OAUTH_BASE_URL || '',
      };
      logger.info('ApiClient initialized with OAuth bearer authentication');
      return;
    }

    try {
      this.auth = new SignatureAuth(options?.profile ? { profile: options.profile } : undefined);
      logger.info('ApiClient initialized with signature authentication');
    } catch (e) {
      logger.info('ApiClient initialized without authentication', { error: e });
    }
  }

  private async ensureFreshOAuthToken(): Promise<void> {
    if (!this.oauthConfig) return;

    const expiresAt = this.oauthConfig.tokenExpiresAt
      ? new Date(this.oauthConfig.tokenExpiresAt).getTime()
      : 0;

    // Token is still fresh — no refresh needed
    if (expiresAt > Date.now() + 60_000) return;

    // Deduplicate: if a refresh is already in flight, await it instead of starting another
    if (this.refreshPromise) {
      await this.refreshPromise;
      return;
    }

    this.refreshPromise = this.doRefreshOAuthToken();
    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async doRefreshOAuthToken(): Promise<void> {
    if (!this.oauthConfig) return;

    try {
      const tokens = await refreshAccessToken(
        this.oauthConfig.baseUrl,
        this.oauthConfig.clientId,
        this.oauthConfig.refreshToken,
      );

      const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
      this.oauthConfig.accessToken = tokens.access_token;
      this.oauthConfig.refreshToken = tokens.refresh_token;
      this.oauthConfig.tokenExpiresAt = newExpiresAt;

      const profileName = this.profileName || getActiveProfileName() || 'default';
      try {
        updateProfileOAuthTokens(profileName, {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: newExpiresAt,
        });
      } catch (e) {
        logger.warn('Failed to persist refreshed OAuth tokens', { error: e });
      }

      logger.info('OAuth token refreshed successfully');
    } catch (e) {
      logger.error('Failed to refresh OAuth token', { error: e });
      throw new ApiError(
        'OAuth session expired. Run `grid auth login` to re-authenticate.',
        401,
      );
    }
  }

  /**
   * Get singleton instance
   * If a global profile override is set (via --profile flag), uses that profile
   * Otherwise returns default instance (env-based)
   */
  public static getInstance(): ApiClient {
    // Check for global profile override (set by CLI --profile flag)
    const profileOverride = getGlobalProfileOverride();
    
    if (profileOverride) {
      // Use profile-specific instance
      return ApiClient.getInstanceForProfile(profileOverride);
    }
    
    // Default instance (env-based)
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  /**
   * Get an instance for a specific profile
   * Profile instances are cached for efficiency
   */
  public static getInstanceForProfile(profileName: string): ApiClient {
    if (!ApiClient.profileInstances.has(profileName)) {
      ApiClient.profileInstances.set(profileName, new ApiClient({ profile: profileName }));
    }
    return ApiClient.profileInstances.get(profileName)!;
  }

  /**
   * Create a new instance with custom options (not cached)
   */
  public static createInstance(options: ApiClientOptions): ApiClient {
    return new ApiClient(options);
  }

  /**
   * Reset all cached instances (useful for testing)
   */
  public static resetInstances(): void {
    ApiClient.instance = undefined as unknown as ApiClient;
    ApiClient.profileInstances.clear();
  }

  /**
   * Reset a single profile instance (used when credentials change for a profile)
   */
  public static resetProfileInstance(profileName: string): void {
    ApiClient.profileInstances.delete(profileName);
  }

  /**
   * Get the profile name this client was created with
   */
  public getProfileName(): string | undefined {
    return this.profileName;
  }

  // ===== Order Methods =====

  /**
   * Exchange order statuses treated as non-terminal.
   * Used for client-side filtering when callers ask for `status=active`.
   */
  private static readonly ACTIVE_STATUSES = new Set([
    'active', 'pending', 'partially_filled', 'open', 'cancellation_pending',
  ]);

  /** Maximum page size accepted by the orders endpoint. */
  private static readonly MAX_ORDER_PAGE_SIZE = 500;

  /**
   * List one validated page of orders.
   *
   * For a complete result set use {@link listAllOrders}. Pass `next` from a
   * prior page's `paging.next_cursor` to advance.
   */
  public async listOrders(filters?: OrderFilters): Promise<Order[]> {
    const page = await this.listOrdersPage(filters);
    return page.data;
  }

  /** List one validated page of orders with cursor metadata. */
  public async listOrdersPage(filters?: OrderFilters): Promise<PaginatedResult<Order>> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<Order[]>>('/orders', {
          params: this.buildOrderQueryParams(filters),
        })
      );

      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }

      return {
        data: validateArrayResponse(response.data.data, OrderSchema),
        paging: ApiClient.normalizePaging(response.data.paging),
      };
    });
  }

  /**
   * Exhaust cursor pages and return all matching validated orders.
   * Check `truncated` before treating the list as complete.
   */
  public async listAllOrders(
    filters?: OrderFilters,
    options?: ListAllOrdersOptions
  ): Promise<ListAllResult<Order>> {
    return this.paginateOrders(
      (pageFilters) => this.listOrdersPage(pageFilters),
      filters as Record<string, unknown> | undefined,
      options
    );
  }

  /**
   * List one page without response validation.
   * Useful when schema mismatches must not hide orders.
   *
   * Active-status results are also filtered client-side for compatibility
   * with deployments that do not filter status server-side.
   */
  public async listOrdersRaw(filters?: Record<string, string>): Promise<any[]> {
    const page = await this.listOrdersRawPage(filters);
    return page.data;
  }

  /** List one raw page of orders with cursor metadata. */
  public async listOrdersRawPage(
    filters?: Record<string, string>
  ): Promise<PaginatedResult<any>> {
    return withRetry(async () => {
      const params = this.buildOrderQueryParams(filters);
      const response = await this.rateLimiter.execute(() =>
        this.client.get<any>('/orders', { params })
      );

      const data = response.data?.data;
      let orders: any[] = Array.isArray(data)
        ? data
        : Array.isArray(response.data)
          ? response.data
          : [];

      const statusFilter = filters?.status ?? params.status;
      if (
        typeof statusFilter === 'string' &&
        statusFilter.toLowerCase() === 'active'
      ) {
        orders = orders.filter((o: any) =>
          ApiClient.ACTIVE_STATUSES.has(String(o?.status ?? '').toLowerCase())
        );
      }

      return {
        data: orders,
        paging: ApiClient.normalizePaging(response.data?.paging),
      };
    });
  }

  /**
   * Exhaust cursor pages for raw order listings.
   *
   * Numeric `page` is never sent because this endpoint advances with
   * `next=<paging.next_cursor>`. Pagination stops safely and reports
   * `truncated: true` if the server omits or repeats a required cursor.
   */
  public async listAllOrdersRaw(
    filters?: Record<string, string>,
    options?: ListAllOrdersOptions
  ): Promise<ListAllResult<any>> {
    return this.paginateOrders(
      (pageFilters) =>
        this.listOrdersRawPage(pageFilters as Record<string, string>),
      filters,
      options
    );
  }

  private async paginateOrders<T>(
    fetchPage: (
      filters: Record<string, unknown>
    ) => Promise<PaginatedResult<T>>,
    filters?: Record<string, unknown>,
    options?: ListAllOrdersOptions
  ): Promise<ListAllResult<T>> {
    const pageSize = ApiClient.clampOrderPageSize(options?.pageSize ?? 500);
    const maxPages = Math.max(1, options?.maxPages ?? 20);
    const baseFilters: Record<string, unknown> = { ...(filters ?? {}) };
    delete baseFilters.page;
    delete baseFilters.next;
    delete baseFilters.prev;
    delete baseFilters.limit;

    const all: T[] = [];
    const seenIds = new Set<string>();
    let nextCursor: string | undefined;
    let pagesFetched = 0;
    let truncated = false;
    let truncationReason: ListAllTruncationReason | undefined;
    let hasMore = false;

    for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
      const pageFilters: Record<string, unknown> = {
        ...baseFilters,
        limit: String(pageSize),
      };
      if (nextCursor) {
        pageFilters.next = nextCursor;
      }

      const { data, paging } = await fetchPage(pageFilters);
      pagesFetched++;
      hasMore = paging.has_more;

      for (const order of data) {
        const orderId = String(
          (order as any)?.order_id ?? (order as any)?.id ?? ''
        );
        if (!orderId) {
          logger.warn('Dropping order row without an id during pagination', {
            marketId: baseFilters.market_id,
            pageIndex: pageIndex + 1,
          });
          continue;
        }
        if (seenIds.has(orderId)) continue;
        seenIds.add(orderId);
        all.push(order);
      }

      if (!paging.has_more) {
        hasMore = false;
        break;
      }

      const cursor = paging.next_cursor;
      if (!cursor) {
        truncated = true;
        truncationReason = 'missing_cursor';
        logger.warn('Order pagination stopped because the next cursor was missing', {
          fetched: all.length,
          marketId: baseFilters.market_id,
          pageIndex: pageIndex + 1,
        });
        break;
      }

      if (cursor === nextCursor) {
        truncated = true;
        truncationReason = 'stuck_cursor';
        logger.error('Order pagination stopped because the cursor did not advance', {
          cursor,
          fetched: all.length,
          marketId: baseFilters.market_id,
        });
        break;
      }

      nextCursor = cursor;

      if (data.length === 0) {
        truncated = true;
        truncationReason = 'empty_page_with_more';
        break;
      }

      if (pageIndex + 1 >= maxPages) {
        truncated = true;
        truncationReason = 'max_pages';
        logger.warn('Order pagination reached maxPages before exhaustion', {
          maxPages,
          fetched: all.length,
          marketId: baseFilters.market_id,
        });
        break;
      }
    }

    return {
      data: all,
      truncated,
      truncationReason,
      pagesFetched,
      hasMore: truncated ? true : hasMore,
    };
  }

  private static clampOrderPageSize(size: number): number {
    if (!Number.isFinite(size)) return ApiClient.MAX_ORDER_PAGE_SIZE;
    return Math.min(
      ApiClient.MAX_ORDER_PAGE_SIZE,
      Math.max(1, Math.floor(size))
    );
  }

  private static normalizePaging(raw: unknown): CursorPaging {
    const paging = (raw ?? {}) as Record<string, unknown>;
    const next =
      typeof paging.next_cursor === 'string' ? paging.next_cursor.trim() : '';
    const prev =
      typeof paging.prev_cursor === 'string' ? paging.prev_cursor.trim() : '';

    return {
      next_cursor: next.length > 0 ? next : null,
      prev_cursor: prev.length > 0 ? prev : null,
      has_more: Boolean(paging.has_more),
    };
  }

  /**
   * Get order details
   * 
   * @param orderId - Order ID
   * @returns Promise resolving to order details
   */
  public async getOrder(orderId: string): Promise<Order> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<Order>>(`/orders/${orderId}`)
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return validateResponse(response.data.data, OrderSchema);
    });
  }

  /**
   * Place a new order
   * 
   * @param order - Order parameters
   * @returns Promise resolving to created order (simplified response with order_id)
   * @throws ValidationError if order parameters are invalid
   * @throws InsufficientBalanceError if account has insufficient balance
   */
  public async placeOrder(order: PlaceOrderRequest): Promise<Order> {
    // Validate input
    const validatedOrder = validatePlaceOrderRequest(order);
    
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.post<ApiResponse<Record<string, unknown>>>('/orders', validatedOrder)
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      // API may return full order or just order_id; prefer the actual response
      const data = response.data.data;
      if (data.order_id && data.status) {
        return data as unknown as Order;
      }

      // Fallback: API only returned order_id, construct a minimal response.
      // Callers should NOT rely on fields other than order_id being accurate.
      return {
        id: data.order_id,
        order_id: data.order_id,
        market_id: order.market_id,
        side: order.side,
        type: order.type,
        status: 'active',
        price: order.price || '0',
        filled_quantity: 0,
        time_in_force: order.time_in_force || 'gtc',
        client_order_id: data.client_order_id
      } as Order;
    });
  }

  /**
   * Cancel an order
   * 
   * @param orderId - Order ID to cancel
   * @returns Promise resolving when order is cancelled
   */
  public async cancelOrder(orderId: string, options?: { maxRetries?: number }): Promise<void> {
    // Build retry config - only override maxRetries if explicitly provided
    const retryConfig: Partial<RetryConfig> = {};
    if (options?.maxRetries !== undefined) {
      retryConfig.maxRetries = options.maxRetries;
    }

    try {
      return await withRetry(async () => {
        const response = await this.rateLimiter.execute(() =>
          this.client.delete<ApiResponse<Order>>(`/orders/${orderId}`)
        );
        
        // 204 No Content is the standard success response for DELETE
        // The order was cancelled successfully, no body returned
        if (response.status === 204) {
          return;
        }
        
        // Some APIs might return 200 with the cancelled order - handle that too
        if (response.status === 200 && response.data?.data) {
          return; // Success with body
        }
        
        // Any other response is unexpected
        throw new ApiError(`Unexpected response status: ${response.status}`, response.status);
      }, retryConfig);
    } catch (error) {
      // The exchange returns 500 for already-cancelled orders — treat as success
      if (error instanceof OrderAlreadyCancelledError) {
        logger.debug('Order already cancelled, treating as success', { orderId });
        return;
      }
      throw error;
    }
  }

  /**
   * Open-order counts from GridExchange projections (eventually consistent).
   */
  public async countOpenOrders(): Promise<{
    count: number;
    by_market: Array<{ market_id: string; count: number }>;
  }> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<
          ApiResponse<{
            count: number;
            by_market: Array<{ market_id: string; count: number }>;
          }>
        >('/orders/count')
      );

      const data = response.data?.data;
      if (!data || typeof data.count !== 'number') {
        throw new ApiError('Invalid response format', response.status || 500);
      }

      return {
        count: data.count,
        by_market: data.by_market ?? [],
      };
    });
  }

  /**
   * Cancel all open orders for the authenticated trader.
   *
   * Uses `DELETE /orders` (account-wide) or `DELETE /markets/:market_id/orders`
   * when `marketId` is set. The `cancelled` field is a pre-cancel projection
   * count from Cortex (telemetry; may be stale vs actual aggregate cancels).
   *
   * @param marketId - Optional market id to scope cancellation
   * @returns Promise resolving to reported cancelled count
   */
  public async cancelAllOrders(marketId?: string): Promise<{ cancelled: number }> {
    return withRetry(async () => {
      const path =
        marketId != null && marketId !== ''
          ? `/markets/${encodeURIComponent(marketId)}/orders`
          : '/orders';

      const response = await this.rateLimiter.execute(() =>
        this.client.delete<ApiResponse<{ cancelled: number }>>(path)
      );

      if (response.status === 200 && response.data?.data) {
        const cancelled = response.data.data.cancelled;
        if (typeof cancelled !== 'number') {
          throw new ApiError('Invalid response format', response.status);
        }
        logger.info('Bulk cancel completed', { marketId: marketId ?? null, cancelled });
        return { cancelled };
      }

      throw new ApiError(`Unexpected response status: ${response.status}`, response.status);
    });
  }

  /**
   * Update an existing order
   * 
   * @param orderId - Order ID
   * @param updates - Order updates
   * @returns Promise resolving to updated order
   */
  public async updateOrder(orderId: string, updates: UpdateOrderRequest): Promise<Order> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.put<ApiResponse<Order>>(`/orders/${orderId}`, updates)
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return validateResponse(response.data.data, OrderSchema);
    });
  }

  // ===== Market Methods =====

  /**
   * List all markets
   * 
   * @returns Promise resolving to array of markets
   */
  public async getMarkets(): Promise<Market[]> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<Market[]>>('/markets')
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return validateArrayResponse(response.data.data, MarketSchema);
    });
  }

  /**
   * Get market details
   * 
   * @param marketId - Market ID
   * @returns Promise resolving to market details
   */
  public async getMarket(marketId: string): Promise<Market> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<Market>>(`/markets/${marketId}`)
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return validateResponse(response.data.data, MarketSchema);
    });
  }

  /**
   * Get market ticker
   * 
   * @param marketId - Market ID
   * @returns Promise resolving to ticker data
   */
  public async getTicker(marketId: string): Promise<Ticker> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<Ticker>>(`/markets/${marketId}/ticker`)
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return validateResponse(response.data.data, TickerSchema);
    });
  }

  /**
   * Get order book
   * 
   * @param marketId - Market ID
   * @param depth - Order book depth (optional)
   * @returns Promise resolving to order book
   */
  public async getOrderBook(marketId: string, depth?: number): Promise<OrderBook> {
    return withRetry(async () => {
      const params: any = {};
      if (depth) params.depth = depth;
      
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<OrderBook>>(`/markets/${marketId}/orderbook`, { params })
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      // Validate and normalize orderbook (the exchange uses buy/sell, normalize to bids/asks)
      const validated = validateResponse(response.data.data, OrderBookSchema);
      return validated as OrderBook;
    });
  }

  /**
   * Get market trades
   * 
   * @param marketId - Market ID
   * @param params - Query parameters
   * @returns Promise resolving to array of public trades
   */
  public async getMarketTrades(marketId: string, params?: any): Promise<PublicTrade[]> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<PublicTrade[]>>(`/markets/${marketId}/trades`, { params })
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return response.data.data;
    });
  }

  // ===== Trade Methods =====

  /**
   * Get user trade history
   * 
   * @param filters - Trade filters
   * @returns Promise resolving to array of trades
   */
  public async getTrades(filters?: TradeFilters): Promise<Trade[]> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<Trade[]>>('/trades', { params: this.buildFilters(filters) })
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return validateArrayResponse(response.data.data, TradeSchema);
    });
  }

  /**
   * Get trade details
   * 
   * @param tradeId - Trade ID
   * @returns Promise resolving to trade details
   */
  public async getTrade(tradeId: string): Promise<Trade> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<Trade>>(`/trades/${tradeId}`)
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return validateResponse(response.data.data, TradeSchema);
    });
  }

  // ===== Account Methods =====

  /**
   * Check unauthenticated Trading API liveness with `GET /health`.
   * This verifies that the Trading listener is reachable before credentials are tested.
   */
  public async checkTradingHealth(options?: { timeoutMs?: number }): Promise<TradingApiHealthResult> {
    const timeoutMs = options?.timeoutMs ?? 5000;

    try {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<{ status?: string; service?: string }>>('/health', {
          timeout: timeoutMs,
          validateStatus: () => true,
        })
      );

      if (response.status >= 200 && response.status < 300 && response.data?.data?.status === 'ok') {
        return { state: 'ok', service: response.data.data.service };
      }

      return {
        state: 'offline',
        message: response.status ? `HTTP ${response.status}` : 'unexpected response',
      };
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      const code = err.code;

      if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
        return { state: 'offline', message: `timed out after ${timeoutMs}ms` };
      }

      if (code === 'ECONNREFUSED') {
        return { state: 'offline', message: 'connection refused' };
      }

      if (code === 'ENOTFOUND') {
        return { state: 'offline', message: 'host not found' };
      }

      return { state: 'offline', message: err.message || 'network error' };
    }
  }

  /**
   * Ping Trading API with `GET /me` (signed). Does not use `withRetry`.
   *
   * @param options.timeoutMs - Abort if no response (default 5000)
   */
  public async pingTradingApi(options?: { timeoutMs?: number }): Promise<TradingApiPingResult> {
    const timeoutMs = options?.timeoutMs ?? 5000;

    try {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<unknown>>('/me', {
          timeout: timeoutMs,
          validateStatus: () => true,
        })
      );

      if (response.status >= 200 && response.status < 300 && response.data?.data !== undefined) {
        return { state: 'ok' };
      }

      if (response.status === 401 || response.status === 403) {
        return { state: 'unauthorized' };
      }

      return {
        state: 'offline',
        message: response.status ? `HTTP ${response.status}` : 'unexpected response',
      };
    } catch (error: unknown) {
      if (error instanceof NetworkError && error.message === 'Request timeout') {
        return {
          state: 'offline',
          message: `Request timeout (${timeoutMs}ms) — start Phoenix / Trading API (e.g. :4040) or fix API_URL`,
        };
      }

      const err = error as { code?: string; message?: string };
      const code = err.code;
      let message: string;

      if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
        message = `timed out after ${timeoutMs}ms (start Trading API / Phoenix, e.g. mix phx.server port 4040)`;
      } else if (code === 'ECONNREFUSED') {
        message = 'connection refused';
      } else if (code === 'ENOTFOUND') {
        message = 'host not found';
      } else if (typeof err.message === 'string' && err.message.length > 0) {
        message = err.message;
      } else {
        message = 'network error';
      }

      return { state: 'offline', message };
    }
  }

  /**
   * Get trading account balances
   * 
   * @returns Promise resolving to array of trading accounts
   */
  public async getTradingAccounts(): Promise<TradingAccount[]> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<TradingAccount[]>>('/trading-accounts')
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return validateArrayResponse(response.data.data, TradingAccountSchema);
    });
  }

  /**
   * Get specific trading account
   * 
   * @param accountId - Account ID
   * @returns Promise resolving to trading account
   */
  public async getTradingAccount(accountId: string): Promise<TradingAccount> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<TradingAccount>>(`/trading-accounts/${accountId}`)
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return validateResponse(response.data.data, TradingAccountSchema);
    });
  }

  /**
   * Get currency trading accounts
   * 
   * @returns Promise resolving to array of currency accounts
   */
  public async getCurrencyTradingAccounts(): Promise<CurrencyTradingAccount[]> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<CurrencyTradingAccount[]>>('/currency-trading-accounts')
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return response.data.data;
    });
  }

  /**
   * Get specific currency trading account
   * 
   * @param accountId - Account ID
   * @returns Promise resolving to currency trading account
   */
  public async getCurrencyTradingAccount(accountId: string): Promise<CurrencyTradingAccount> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<CurrencyTradingAccount>>(`/currency-trading-accounts/${accountId}`)
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return response.data.data;
    });
  }

  // ===== Issuance Methods (Suppliers) =====

  /**
   * Get issuance accounts
   * 
   * @returns Promise resolving to array of issuance accounts
   */
  public async getIssuanceAccounts(): Promise<IssuanceAccount[]> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<IssuanceAccount[]>>('/issuance-accounts')
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return response.data.data;
    });
  }

  /**
   * Transfer from issuance account to trading account
   * 
   * @param transfer - Transfer parameters
   * @returns Promise resolving to transfer result
   */
  public async transferFromIssuance(transfer: TransferFromIssuanceRequest): Promise<any> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.post<ApiResponse<any>>('/issuance-accounts/transfer', transfer)
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return response.data.data;
    });
  }

  /**
   * Transfer to trading account (with optional auto-create)
   * 
   * @param instrumentId - Instrument ID
   * @param tradingAccountId - Trading account ID (optional, auto-created if omitted)
   * @param quantity - Quantity to transfer
   * @returns Promise resolving to transfer result
   */
  public async transferToTradingAccount(
    instrumentId: string,
    tradingAccountId: string | undefined,
    quantity: number
  ): Promise<any> {
    return withRetry(async () => {
      const payload: Record<string, any> = {
        instrument_id: instrumentId,
        quantity
      };
      if (tradingAccountId) {
        payload.trading_account_id = tradingAccountId;
      }
      const response = await this.rateLimiter.execute(() =>
        this.client.post<ApiResponse<any>>('/issuance-accounts/transfer', payload)
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return response.data.data;
    });
  }

  // ===== Supply Issuance Methods =====

  /**
   * Issue new supply
   * 
   * @param instrumentId - Instrument ID
   * @param quantity - Quantity to issue
   * @returns Promise resolving to issuance result
   */
  public async issueSupply(instrumentId: string, quantity: number): Promise<any> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.post<ApiResponse<any>>('/supply-issuances', {
          instrument_id: instrumentId,
          quantity
        })
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return response.data.data;
    });
  }

  /**
   * Get supply issuances
   * 
   * @param filters - Optional filters
   * @returns Promise resolving to array of issuances
   */
  public async getSupplyIssuances(filters?: any): Promise<any[]> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<any[]>>('/supply-issuances', { 
          params: this.buildFilters(filters) 
        })
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return response.data.data;
    });
  }

  /**
   * Get supply issuance summary
   * 
   * @returns Promise resolving to issuance summary
   */
  public async getSupplyIssuanceSummary(): Promise<any> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<any>>('/supply-issuances/summary')
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return response.data.data;
    });
  }

  /**
   * Get supplier liability
   * 
   * @param filters - Optional filters
   * @returns Promise resolving to array of liabilities
   */
  public async getSupplierLiability(filters?: any): Promise<any[]> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<any[]>>('/supplier-liability', { 
          params: this.buildFilters(filters) 
        })
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return response.data.data;
    });
  }

  /**
   * Get supplier liability by instrument
   * 
   * @param instrumentId - Instrument ID
   * @returns Promise resolving to liability for instrument
   */
  public async getSupplierLiabilityByInstrument(instrumentId: string): Promise<any> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<any>>(`/supplier-liability/${instrumentId}`)
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return response.data.data;
    });
  }

  /**
   * Get current user/account info
   * 
   * @returns Promise resolving to account info
   */
  public async getMe(): Promise<any> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<any>>('/me')
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return response.data.data;
    });
  }

  /**
   * Get effective order limits for a market.
   */
  public async getAccountLimits(marketId: string): Promise<AccountLimits> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<AccountLimits>>('/account/limits', {
          params: { market_id: marketId },
        })
      );

      if (!response.data?.data) {
        throw new ApiError('Invalid account limits response format', 500);
      }

      return response.data.data;
    });
  }

  /**
   * Get read-only Trading API diagnostics.
   */
  public async getDiagnostics(options?: { timeoutMs?: number }): Promise<DiagnosticsData> {
    const response = await this.rateLimiter.execute(() =>
      this.client.get<DiagnosticsResponse>('/diagnostics', {
        timeout: options?.timeoutMs,
      })
    );

    if (!response.data?.data) {
      throw new ApiError('Invalid diagnostics response format', 500);
    }

    return response.data.data;
  }

  /**
   * Get instruments (trading API)
   * 
   * @param params - Optional query params
   * @returns Promise resolving to instruments
   */
  public async getInstruments(params?: any): Promise<any> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<any>>('/instruments', { params })
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return response.data.data;
    });
  }

  // ===== Instrument Methods =====

  /**
   * List all instruments
   * 
   * @returns Promise resolving to array of instruments
   */
  public async listInstruments(): Promise<Instrument[]> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<Instrument[]>>('/instruments')
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return validateArrayResponse(response.data.data, InstrumentSchema);
    });
  }

  /**
   * Get instrument by ID
   * 
   * @param instrumentId - Instrument ID
   * @returns Promise resolving to instrument
   */
  public async getInstrument(instrumentId: string): Promise<Instrument> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<Instrument>>(`/instruments/${instrumentId}`)
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return validateResponse(response.data.data, InstrumentSchema);
    });
  }

  /**
   * Get instrument by symbol
   * 
   * @param symbol - Instrument symbol
   * @returns Promise resolving to instrument
   */
  public async getInstrumentBySymbol(symbol: string): Promise<Instrument> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<Instrument>>(`/instruments/by-symbol/${symbol}`)
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return validateResponse(response.data.data, InstrumentSchema);
    });
  }

  // ===== Price History Methods =====

  /**
   * Get OHLCV price history
   * 
   * @param marketId - Market ID
   * @param resolution - Time resolution
   * @param fromTimestamp - Start timestamp
   * @param toTimestamp - End timestamp
   * @returns Promise resolving to array of OHLCV data
   */
  public async getPriceHistory(
    marketId: string,
    resolution: string,
    fromTimestamp: number,
    toTimestamp: number
  ): Promise<OHLCV[]> {
    return withRetry(async () => {
      const params = {
        'filters[0][field]': 'market_id',
        'filters[0][value]': marketId,
        'filters[1][field]': 'resolution',
        'filters[1][value]': resolution,
        'filters[2][field]': 'from',
        'filters[2][value]': fromTimestamp.toString(),
        'filters[3][field]': 'to',
        'filters[3][value]': toTimestamp.toString(),
        'order_by[]': 'period_start',
        'order_directions[]': 'asc'
      };

      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<OHLCV[]>>('/price-histories', { params })
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return response.data.data;
    });
  }

  // ===== Market Stats Methods =====

  /**
   * Get market statistics
   * 
   * @param marketId - Market ID
   * @returns Promise resolving to market stats
   */
  public async getMarketStats(marketId: string): Promise<MarketStats> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<MarketStats>>(`/markets/${marketId}/stats`)
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return response.data.data;
    });
  }

  /**
   * Get public trades for a market
   * 
   * @param marketId - Market ID
   * @param limit - Number of trades to retrieve
   * @returns Promise resolving to array of public trades
   */
  public async getPublicTrades(marketId: string, limit: number = 50): Promise<PublicTrade[]> {
    return withRetry(async () => {
      const params = {
        'filters[0][field]': 'market_id',
        'filters[0][value]': marketId,
        'order_by[]': 'execution_timestamp',
        'order_directions[]': 'desc',
        'page_size': limit
      };

      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<PublicTrade[]>>(`/markets/${marketId}/trades`, { params })
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return response.data.data;
    });
  }

  // ===== Consumption API Methods =====

  /**
   * Get consumption accounts (balances for inference specs)
   * 
   * Uses the Trading API's /consumption-accounts endpoint which
   * supports signature authentication (unlike Exchange API which needs session auth)
   * 
   * @returns Promise resolving to array of consumption instruments/accounts
   */
  public async getConsumptionInstruments(): Promise<ConsumptionInstrument[]> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<ConsumptionInstrument[]>>('/consumption-accounts')
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return validateArrayResponse(response.data.data, ConsumptionInstrumentSchema);
    });
  }

  /**
   * Chat completion request
   * 
   * @param request - Chat completion parameters
   * @returns Promise resolving to chat completion response
   */
  public async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.post<ApiResponse<ChatCompletionResponse>>('/chat/completions', request)
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return validateResponse(response.data.data, ChatCompletionResponseSchema);
    });
  }

  // Session-auth methods (registerUser, login, logout) removed — they bypass
  // all SDK resilience layers and require cookie auth. Use the web UI instead.

  // ===== Signing Key Methods =====

  /**
   * Register a signing key
   * 
   * @param keyData - Signing key data
   * @returns Promise resolving to created signing key
   */
  public async registerSigningKey(keyData: RegisterSigningKeyRequest): Promise<SigningKey> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.post<ApiResponse<SigningKey>>('/signing-keys', {
          signing_key: keyData
        })
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return response.data.data;
    });
  }

  /**
   * Revoke a signing key
   * 
   * @param keyId - Signing key ID
   * @returns Promise resolving to revocation response
   */
  public async revokeSigningKey(keyId: string): Promise<any> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.delete<ApiResponse<any>>(`/signing-keys/${keyId}`)
      );
      
      return response.data;
    });
  }

  // ===== Helper Methods =====

  /**
   * Build flat query parameters for order-list endpoints.
   *
   * Date aliases are normalized and unsupported numeric-page keys are omitted
   * so callers advance only with the response cursor.
   */
  private buildOrderQueryParams(
    filters?: OrderFilters | Record<string, unknown> | null
  ): Record<string, unknown> {
    if (!filters) return {};

    const keyAliases: Record<string, string> = {
      from_date: 'start_datetime',
      to_date: 'end_datetime',
    };
    const params: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(filters as Record<string, unknown>)) {
      if (value === undefined || value === null) continue;
      if (key === 'page' || key === 'page_size' || key === 'pageSize') continue;

      params[keyAliases[key] ?? key] = value;
    }

    return params;
  }

  /**
   * Build filter parameters from object
   */
  private buildFilters(filters?: any): any {
    if (!filters) return {};
    
    const params: any = {};
    let filterIndex = 0;
    
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        // The exchange API uses Phoenix Flop for filtering - params must be nested under 'flop'
        params[`flop[filters][${filterIndex}][field]`] = key;
        params[`flop[filters][${filterIndex}][value]`] = value;
        filterIndex++;
      }
    }
    
    return params;
  }

  // Session-auth user management methods removed — they require cookie/session
  // authentication that the CLI doesn't support. Use the web UI instead.

  // ===== Transfer Methods =====

  /**
   * Transfer units from trading account to consumption account
   * 
   * This moves units from your trading account to your consumption account,
   * making them available for AI inference. Units are auto-committed on deposit.
   * 
   * @param instrumentId - The instrument to transfer (e.g., FAST-INFERENCE instrument ID)
   * @param quantity - Number of units to transfer
   * @returns Transfer response with transfer_id
   */
  public async transferToConsumption(instrumentId: string, quantity: number): Promise<any> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.post('/transfers/trading-to-consumption', {
          instrument_id: instrumentId,
          quantity
        })
      );
      return response.data;
    });
  }

  /**
   * Transfer units from consumption account back to trading account
   * 
   * This moves available (non-committed) units from your consumption account
   * back to your trading account, allowing them to be sold on the market.
   * 
   * @param instrumentId - The instrument to transfer
   * @param quantity - Number of units to transfer
   * @returns Transfer response with transfer_id
   */
  public async transferToTrading(instrumentId: string, quantity: number): Promise<any> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.post('/transfers/consumption-to-trading', {
          instrument_id: instrumentId,
          quantity
        })
      );
      return response.data;
    });
  }

  /**
   * Get transfer history
   * Works with signature auth - CLI compatible!
   */
  public async getTransferHistory(marketId?: string, instrumentId?: string): Promise<any[]> {
    return withRetry(async () => {
      const filters: any = {};
      if (marketId) filters.market_id = marketId;
      if (instrumentId) filters.instrument_id = instrumentId;
      
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<any[]>>('/transfer-histories', { 
          params: this.buildFilters(filters) 
        })
      );
      
      if (!response.data?.data) {
        throw new ApiError('Invalid response format', 500);
      }
      
      return response.data.data;
    });
  }

  /**
   * Get positions (used by strategies for reconciliation)
   */
  public async getPositions(filters?: Record<string, string>): Promise<any[]> {
    return withRetry(async () => {
      const response = await this.rateLimiter.execute(() =>
        this.client.get<ApiResponse<any[]>>('/positions', { params: filters })
      );
      return response.data?.data || [];
    });
  }

  /**
   * Get rate limiter status
   */
  public getRateLimiterStatus() {
    return this.rateLimiter.getStatus();
  }
}

