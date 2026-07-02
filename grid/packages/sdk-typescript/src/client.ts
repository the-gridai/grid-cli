/**
 * Grid API Client
 *
 * Main entry point for the Grid SDK. Provides type-safe access to all Grid APIs
 * with automatic retry, rate limiting, and authentication.
 *
 * @example
 * ```typescript
 * import { GridClient } from '@the-gridai/grid-sdk';
 *
 * const client = new GridClient({
 *   apiUrl: 'https://api.thegrid.ai',
 *   signingKey: process.env.GRID_SIGNING_KEY!,
 *   fingerprint: process.env.GRID_FINGERPRINT!,
 * });
 *
 * // List orders
 * const orders = await client.orders.list();
 *
 * // Get account balances
 * const balances = await client.accounts.getTradingAccounts();
 * ```
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import http from 'http';
import https from 'https';
import { SignatureAuth } from './auth.js';
import { ApiError } from './errors.js';
import {
  loadProfile,
  loadFromEnv,
  autoLoadConfig,
  type LoadProfileOptions,
} from './profiles.js';
import { RateLimiter } from './http/rate-limiter.js';
import { withRetry } from './http/retry.js';
import { transformAxiosError } from './http/error-handler.js';
import {
  validatePlaceOrderRequest,
  validateResponse,
  validateArrayResponse,
  OrderSchema,
  MarketSchema,
  TickerSchema,
  OrderBookSchema,
  TradeSchema,
  TradingAccountSchema,
  ConsumptionInstrumentSchema,
} from './validators.js';
import type {
  GridClientConfig,
  Logger,
  ApiResponse,
  Order,
  PlaceOrderRequest,
  UpdateOrderRequest,
  OrderFilters,
  Trade,
  TradeFilters,
  Market,
  Ticker,
  OrderBook,
  PublicTrade,
  TradingAccount,
  CurrencyTradingAccount,
  IssuanceAccount,
  ConsumptionInstrument,
  SigningKey,
  RegisterSigningKeyRequest,
} from './types/index.js';

// Custom HTTP agents with increased connection limits
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 20,
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
];

/**
 * Grid API Client
 *
 * Provides access to all Grid Trading APIs with built-in authentication,
 * retry logic, and rate limiting.
 */
export class GridClient {
  private client: AxiosInstance;
  private auth: SignatureAuth;
  private rateLimiter: RateLimiter;
  private logger?: Logger;
  private config: GridClientConfig;
  private retriesEnabled: boolean;

  /**
   * Create a new GridClient instance
   *
   * @param config - Client configuration
   */
  constructor(config: GridClientConfig) {
    this.config = config;
    this.logger = config.logger;
    this.retriesEnabled = config.enableRetries ?? true;

    // Initialize authentication
    this.auth = new SignatureAuth({
      signingKey: config.signingKey,
      fingerprint: config.fingerprint,
      logger: this.logger,
    });

    // Initialize rate limiter
    this.rateLimiter = new RateLimiter(
      config.maxConcurrent ?? 10,
      config.minInterval ?? 100,
      this.logger
    );

    // Create Axios instance
    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeout ?? 30000,
      headers: {
        'Content-Type': 'application/json',
      },
      httpAgent,
      httpsAgent,
    });

    // Setup interceptors
    this.setupInterceptors();

    this.logger?.info('GridClient initialized', { apiUrl: config.apiUrl });
  }

  // ===========================================================================
  // Static Factory Methods
  // ===========================================================================

  /**
   * Create a GridClient from a named profile
   *
   * Loads credentials from the grid-cli credentials file (~/.grid-cli/credentials.json).
   * This allows reusing credentials configured via `grid profile add`.
   *
   * @param profileName - Name of the profile to load (default: current profile or GRID_PROFILE env)
   * @param options - Additional options (override URLs, custom credentials path)
   * @returns GridClient instance
   *
   * @example
   * ```typescript
   * // Load specific profile
   * const client = GridClient.fromProfile('production');
   *
   * // Load current/default profile
   * const client = GridClient.fromProfile();
   *
   * // Override API URL from profile
   * const client = GridClient.fromProfile('dev', {
   *   apiUrl: 'http://localhost:4000/v1'
   * });
   * ```
   */
  static fromProfile(profileName?: string, options?: LoadProfileOptions): GridClient {
    const config = loadProfile(profileName, options);
    return new GridClient(config);
  }

  /**
   * Create a GridClient from environment variables
   *
   * Loads credentials from environment variables. Useful for production deployments.
   *
   * Required environment variables:
   * - GRID_SIGNING_KEY or SIGNING_KEY
   * - GRID_FINGERPRINT or SIGNING_KEY_FINGERPRINT
   *
   * Optional:
   * - GRID_API_URL or API_URL (default: https://api.thegrid.ai/v1)
   * - GRID_WS_URL or WS_URL
   *
   * @returns GridClient instance
   *
   * @example
   * ```typescript
   * // In production with env vars set
   * const client = GridClient.fromEnv();
   * ```
   */
  static fromEnv(): GridClient {
    const config = loadFromEnv();
    return new GridClient(config);
  }

  /**
   * Create a GridClient with automatic configuration detection
   *
   * Tries to load configuration in this order:
   * 1. GRID_PROFILE env var -> load that profile
   * 2. Current profile from credentials file
   * 3. Environment variables (GRID_SIGNING_KEY, etc.)
   *
   * @returns GridClient instance
   *
   * @example
   * ```typescript
   * // Works with either profile or env vars
   * const client = GridClient.auto();
   * ```
   */
  static auto(): GridClient {
    const config = autoLoadConfig();
    return new GridClient(config);
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Setup request/response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor for authentication
    this.client.interceptors.request.use((req: InternalAxiosRequestConfig) => {
      const shouldSign =
        req.url && SIGNED_PATH_PREFIXES.some((prefix) => req.url!.startsWith(prefix));

      if (shouldSign && req.url && req.method) {
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
        const authHeaders = this.auth.getHeaders(req.method, pathForSign, body);

        req.headers.set('x-thegrid-signature', authHeaders['x-thegrid-signature']);
        req.headers.set('x-thegrid-timestamp', authHeaders['x-thegrid-timestamp']);
        req.headers.set('x-thegrid-fingerprint', authHeaders['x-thegrid-fingerprint']);
      }

      return req;
    });

    // Response interceptor for error transformation
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        throw transformAxiosError(error, this.logger);
      }
    );
  }

  // ===========================================================================
  // Orders API
  // ===========================================================================

  /**
   * Orders API namespace
   */
  public readonly orders = {
    /**
     * List orders with optional filtering
     */
    list: async (filters?: OrderFilters): Promise<Order[]> => {
      return this.withRetry(async () => {
        const response = await this.rateLimiter.execute(() =>
          this.client.get<ApiResponse<Order[]>>('/orders', {
            params: this.buildFilters(filters),
          })
        );

        if (!response.data?.data) {
          throw new ApiError('Invalid response format', 500);
        }

        return validateArrayResponse(response.data.data, OrderSchema);
      });
    },

    /**
     * Get order by ID
     */
    get: async (orderId: string): Promise<Order> => {
      return this.withRetry(async () => {
        const response = await this.rateLimiter.execute(() =>
          this.client.get<ApiResponse<Order>>(`/orders/${orderId}`)
        );

        if (!response.data?.data) {
          throw new ApiError('Invalid response format', 500);
        }

        return validateResponse(response.data.data, OrderSchema);
      });
    },

    /**
     * Place a new order
     */
    create: async (order: PlaceOrderRequest): Promise<Order> => {
      const validatedOrder = validatePlaceOrderRequest(order);

      return this.withRetry(async () => {
        const response = await this.rateLimiter.execute(() =>
          this.client.post<ApiResponse<{ order_id: string; client_order_id?: string }>>(
            '/orders',
            validatedOrder
          )
        );

        if (!response.data?.data) {
          throw new ApiError('Invalid response format', 500);
        }

        // Create order response has order_id, construct minimal Order
        return {
          id: response.data.data.order_id,
          order_id: response.data.data.order_id,
          market_id: order.market_id,
          side: order.side,
          type: order.type,
          status: 'active',
          price: order.price || null,
          filled_quantity: 0,
          time_in_force: order.time_in_force || 'gtc',
          client_order_id: response.data.data.client_order_id,
        } as Order;
      });
    },

    /**
     * Cancel an order
     */
    cancel: async (orderId: string): Promise<void> => {
      return this.withRetry(async () => {
        const response = await this.rateLimiter.execute(() =>
          this.client.delete<ApiResponse<Order>>(`/orders/${orderId}`)
        );

        if (response.status === 204 || response.status === 200) {
          return;
        }

        throw new ApiError(`Unexpected response status: ${response.status}`, response.status);
      });
    },

    /**
     * Update an order
     */
    update: async (orderId: string, updates: UpdateOrderRequest): Promise<Order> => {
      return this.withRetry(async () => {
        const response = await this.rateLimiter.execute(() =>
          this.client.put<ApiResponse<Order>>(`/orders/${orderId}`, updates)
        );

        if (!response.data?.data) {
          throw new ApiError('Invalid response format', 500);
        }

        return validateResponse(response.data.data, OrderSchema);
      });
    },

    /**
     * Cancel all open orders
     */
    cancelAll: async (): Promise<{ cancelled: number }> => {
      const orders = await this.orders.list({ status: 'active' } as OrderFilters);

      if (orders.length === 0) {
        return { cancelled: 0 };
      }

      this.logger?.info('Canceling orders', { count: orders.length });

      let cancelled = 0;
      const batchSize = 5;

      for (let i = 0; i < orders.length; i += batchSize) {
        const batch = orders.slice(i, i + batchSize);
        const batchPromises = batch.map((order) =>
          this.orders
            .cancel(order.id || order.order_id!)
            .then(() => {
              cancelled++;
              return true;
            })
            .catch(() => false)
        );

        await Promise.all(batchPromises);

        if (i + batchSize < orders.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      return { cancelled };
    },
  };

  // ===========================================================================
  // Markets API
  // ===========================================================================

  /**
   * Markets API namespace
   */
  public readonly markets = {
    /**
     * List all markets
     */
    list: async (): Promise<Market[]> => {
      return this.withRetry(async () => {
        const response = await this.rateLimiter.execute(() =>
          this.client.get<ApiResponse<Market[]>>('/markets')
        );

        if (!response.data?.data) {
          throw new ApiError('Invalid response format', 500);
        }

        return validateArrayResponse(response.data.data, MarketSchema);
      });
    },

    /**
     * Get market by ID
     */
    get: async (marketId: string): Promise<Market> => {
      return this.withRetry(async () => {
        const response = await this.rateLimiter.execute(() =>
          this.client.get<ApiResponse<Market>>(`/markets/${marketId}`)
        );

        if (!response.data?.data) {
          throw new ApiError('Invalid response format', 500);
        }

        return validateResponse(response.data.data, MarketSchema);
      });
    },

    /**
     * Get market ticker
     */
    getTicker: async (marketId: string): Promise<Ticker> => {
      return this.withRetry(async () => {
        const response = await this.rateLimiter.execute(() =>
          this.client.get<ApiResponse<Ticker>>(`/markets/${marketId}/ticker`)
        );

        if (!response.data?.data) {
          throw new ApiError('Invalid response format', 500);
        }

        return validateResponse(response.data.data, TickerSchema);
      });
    },

    /**
     * Get order book
     */
    getOrderBook: async (marketId: string, depth?: number): Promise<OrderBook> => {
      return this.withRetry(async () => {
        const params: Record<string, number> = {};
        if (depth) params.depth = depth;

        const response = await this.rateLimiter.execute(() =>
          this.client.get<ApiResponse<OrderBook>>(`/markets/${marketId}/orderbook`, {
            params,
          })
        );

        if (!response.data?.data) {
          throw new ApiError('Invalid response format', 500);
        }

        // Validate and normalize orderbook (the exchange uses buy/sell, normalize to bids/asks)
        const validated = validateResponse(response.data.data, OrderBookSchema);
        return validated as OrderBook;
      });
    },

    /**
     * Get market trades
     */
    getTrades: async (marketId: string, limit?: number): Promise<PublicTrade[]> => {
      return this.withRetry(async () => {
        const params: Record<string, unknown> = {};
        if (limit) params.limit = limit;

        const response = await this.rateLimiter.execute(() =>
          this.client.get<ApiResponse<PublicTrade[]>>(`/markets/${marketId}/trades`, {
            params,
          })
        );

        if (!response.data?.data) {
          throw new ApiError('Invalid response format', 500);
        }

        return response.data.data;
      });
    },

    /**
     * Alias for getTrades (for naming consistency)
     */
    getPublicTrades: async (marketId: string, limit?: number): Promise<PublicTrade[]> => {
      return this.markets.getTrades(marketId, limit);
    },
  };

  // ===========================================================================
  // Trades API
  // ===========================================================================

  /**
   * Trades API namespace
   */
  public readonly trades = {
    /**
     * Get user trade history
     */
    list: async (filters?: TradeFilters): Promise<Trade[]> => {
      return this.withRetry(async () => {
        const response = await this.rateLimiter.execute(() =>
          this.client.get<ApiResponse<Trade[]>>('/trades', {
            params: this.buildFilters(filters),
          })
        );

        if (!response.data?.data) {
          throw new ApiError('Invalid response format', 500);
        }

        return validateArrayResponse(response.data.data, TradeSchema);
      });
    },

    /**
     * Get trade by ID
     */
    get: async (tradeId: string): Promise<Trade> => {
      return this.withRetry(async () => {
        const response = await this.rateLimiter.execute(() =>
          this.client.get<ApiResponse<Trade>>(`/trades/${tradeId}`)
        );

        if (!response.data?.data) {
          throw new ApiError('Invalid response format', 500);
        }

        return validateResponse(response.data.data, TradeSchema);
      });
    },
  };

  // ===========================================================================
  // Accounts API
  // ===========================================================================

  /**
   * Accounts API namespace
   */
  public readonly accounts = {
    /**
     * Get trading accounts (balances)
     */
    getTradingAccounts: async (): Promise<TradingAccount[]> => {
      return this.withRetry(async () => {
        const response = await this.rateLimiter.execute(() =>
          this.client.get<ApiResponse<TradingAccount[]>>('/trading-accounts')
        );

        if (!response.data?.data) {
          throw new ApiError('Invalid response format', 500);
        }

        return validateArrayResponse(response.data.data, TradingAccountSchema);
      });
    },

    /**
     * Get specific trading account
     */
    getTradingAccount: async (accountId: string): Promise<TradingAccount> => {
      return this.withRetry(async () => {
        const response = await this.rateLimiter.execute(() =>
          this.client.get<ApiResponse<TradingAccount>>(`/trading-accounts/${accountId}`)
        );

        if (!response.data?.data) {
          throw new ApiError('Invalid response format', 500);
        }

        return validateResponse(response.data.data, TradingAccountSchema);
      });
    },

    /**
     * Get currency trading accounts
     */
    getCurrencyTradingAccounts: async (): Promise<CurrencyTradingAccount[]> => {
      return this.withRetry(async () => {
        const response = await this.rateLimiter.execute(() =>
          this.client.get<ApiResponse<CurrencyTradingAccount[]>>(
            '/currency-trading-accounts'
          )
        );

        if (!response.data?.data) {
          throw new ApiError('Invalid response format', 500);
        }

        return response.data.data;
      });
    },

    /**
     * Get consumption accounts (inference balances)
     */
    getConsumptionAccounts: async (): Promise<ConsumptionInstrument[]> => {
      return this.withRetry(async () => {
        const response = await this.rateLimiter.execute(() =>
          this.client.get<ApiResponse<ConsumptionInstrument[]>>('/consumption-accounts')
        );

        if (!response.data?.data) {
          throw new ApiError('Invalid response format', 500);
        }

        return validateArrayResponse(response.data.data, ConsumptionInstrumentSchema);
      });
    },

    /**
     * Get issuance accounts (for suppliers)
     */
    getIssuanceAccounts: async (): Promise<IssuanceAccount[]> => {
      return this.withRetry(async () => {
        const response = await this.rateLimiter.execute(() =>
          this.client.get<ApiResponse<IssuanceAccount[]>>('/issuance-accounts')
        );

        if (!response.data?.data) {
          throw new ApiError('Invalid response format', 500);
        }

        return response.data.data;
      });
    },

    /**
     * Get current user info
     */
    getMe: async (): Promise<unknown> => {
      return this.withRetry(async () => {
        const response = await this.rateLimiter.execute(() =>
          this.client.get<ApiResponse<unknown>>('/me')
        );

        if (!response.data?.data) {
          throw new ApiError('Invalid response format', 500);
        }

        return response.data.data;
      });
    },

    /**
     * Alias for getMe (compatibility with internal SDK)
     */
    me: async (): Promise<unknown> => {
      return this.accounts.getMe();
    },

    /**
     * Get positions (requires session auth in some environments)
     * Note: This may require cookie/session authentication
     */
    getPositions: async (filters?: Record<string, unknown>): Promise<unknown[]> => {
      return this.withRetry(async () => {
        const response = await this.rateLimiter.execute(() =>
          this.client.get<ApiResponse<unknown[]>>('/positions', {
            params: this.buildFilters(filters),
          })
        );

        if (!response.data?.data) {
          return [];
        }

        return response.data.data;
      });
    },
  };

  // ===========================================================================
  // Supply API
  // ===========================================================================

  /**
   * Supply API namespace
   */
  public readonly supply = {
    /**
     * Issue new supply
     */
    issue: async (instrumentId: string, quantity: number): Promise<unknown> => {
      return this.withRetry(async () => {
        const response = await this.rateLimiter.execute(() =>
          this.client.post<ApiResponse<unknown>>('/supply-issuances', {
            instrument_id: instrumentId,
            quantity,
          })
        );

        if (!response.data?.data) {
          throw new ApiError('Invalid response format', 500);
        }

        return response.data.data;
      });
    },

    /**
     * Get supply issuances
     */
    getIssuances: async (filters?: Record<string, unknown>): Promise<unknown[]> => {
      return this.withRetry(async () => {
        const response = await this.rateLimiter.execute(() =>
          this.client.get<ApiResponse<unknown[]>>('/supply-issuances', {
            params: this.buildFilters(filters),
          })
        );

        if (!response.data?.data) {
          throw new ApiError('Invalid response format', 500);
        }

        return response.data.data;
      });
    },

    /**
     * Alias for getIssuances
     */
    list: async (filters?: Record<string, unknown>): Promise<unknown[]> => {
      return this.supply.getIssuances(filters);
    },

    /**
     * Alias for issue (create supply issuance)
     */
    create: async (request: { instrument_id: string; quantity: string | number }): Promise<unknown> => {
      return this.supply.issue(request.instrument_id, Number(request.quantity));
    },

    /**
     * Get supply issuance summary
     */
    getSummary: async (): Promise<unknown> => {
      return this.withRetry(async () => {
        const response = await this.rateLimiter.execute(() =>
          this.client.get<ApiResponse<unknown>>('/supply-issuances/summary')
        );

        if (!response.data?.data) {
          throw new ApiError('Invalid response format', 500);
        }

        return response.data.data;
      });
    },

    /**
     * Transfer from issuance to trading account
     */
    transferToTrading: async (
      instrumentId: string,
      quantity: number,
      tradingAccountId?: string
    ): Promise<unknown> => {
      return this.withRetry(async () => {
        const payload: Record<string, unknown> = {
          instrument_id: instrumentId,
          quantity,
        };
        if (tradingAccountId) {
          payload.trading_account_id = tradingAccountId;
        }

        const response = await this.rateLimiter.execute(() =>
          this.client.post<ApiResponse<unknown>>('/issuance-accounts/transfer', payload)
        );

        if (!response.data?.data) {
          throw new ApiError('Invalid response format', 500);
        }

        return response.data.data;
      });
    },
  };

  // ===========================================================================
  // Transfers API
  // ===========================================================================

  /**
   * Transfers API namespace
   */
  public readonly transfers = {
    /**
     * Transfer to consumption account
     */
    toConsumption: async (instrumentId: string, quantity: number): Promise<unknown> => {
      return this.withRetry(async () => {
        const response = await this.rateLimiter.execute(() =>
          this.client.post('/transfers/trading-to-consumption', {
            instrument_id: instrumentId,
            quantity,
          })
        );
        return response.data;
      });
    },

    /**
     * Transfer to trading account
     */
    toTrading: async (instrumentId: string, quantity: number): Promise<unknown> => {
      return this.withRetry(async () => {
        const response = await this.rateLimiter.execute(() =>
          this.client.post('/transfers/consumption-to-trading', {
            instrument_id: instrumentId,
            quantity,
          })
        );
        return response.data;
      });
    },

    /**
     * Get transfer history
     */
    getHistory: async (
      marketId?: string,
      instrumentId?: string
    ): Promise<unknown[]> => {
      return this.withRetry(async () => {
        const filters: Record<string, unknown> = {};
        if (marketId) filters.market_id = marketId;
        if (instrumentId) filters.instrument_id = instrumentId;

        const response = await this.rateLimiter.execute(() =>
          this.client.get<ApiResponse<unknown[]>>('/transfer-histories', {
            params: this.buildFilters(filters),
          })
        );

        if (!response.data?.data) {
          throw new ApiError('Invalid response format', 500);
        }

        return response.data.data;
      });
    },
  };

  // ===========================================================================
  // Instruments API
  // ===========================================================================

  /**
   * Instruments API namespace
   */
  public readonly instruments = {
    /**
     * List all instruments
     */
    list: async (): Promise<unknown[]> => {
      return this.withRetry(async () => {
        const response = await this.rateLimiter.execute(() =>
          this.client.get<ApiResponse<unknown[]>>('/instruments')
        );

        if (!response.data?.data) {
          throw new ApiError('Invalid response format', 500);
        }

        return response.data.data;
      });
    },

    /**
     * Get instrument by ID
     */
    get: async (instrumentId: string): Promise<unknown> => {
      return this.withRetry(async () => {
        const response = await this.rateLimiter.execute(() =>
          this.client.get<ApiResponse<unknown>>(`/instruments/${instrumentId}`)
        );

        if (!response.data?.data) {
          throw new ApiError('Invalid response format', 500);
        }

        return response.data.data;
      });
    },

    /**
     * Get instrument by symbol
     */
    getBySymbol: async (symbol: string): Promise<unknown> => {
      return this.withRetry(async () => {
        const response = await this.rateLimiter.execute(() =>
          this.client.get<ApiResponse<unknown>>(`/instruments/by-symbol/${symbol}`)
        );

        if (!response.data?.data) {
          throw new ApiError('Invalid response format', 500);
        }

        return response.data.data;
      });
    },
  };

  // ===========================================================================
  // Signing Keys API
  // ===========================================================================

  /**
   * Signing Keys API namespace
   */
  public readonly signingKeys = {
    /**
     * Register a new signing key
     */
    register: async (keyData: RegisterSigningKeyRequest): Promise<SigningKey> => {
      return this.withRetry(async () => {
        const response = await this.rateLimiter.execute(() =>
          this.client.post<ApiResponse<SigningKey>>('/signing-keys', {
            signing_key: keyData,
          })
        );

        if (!response.data?.data) {
          throw new ApiError('Invalid response format', 500);
        }

        return response.data.data;
      });
    },

    /**
     * Revoke a signing key
     */
    revoke: async (keyId: string): Promise<void> => {
      return this.withRetry(async () => {
        await this.rateLimiter.execute(() => this.client.delete(`/signing-keys/${keyId}`));
      });
    },
  };

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Build filter parameters for API requests
   */
  private buildFilters(filters?: Record<string, unknown>): Record<string, string> {
    if (!filters) return {};

    const params: Record<string, string> = {};
    let filterIndex = 0;

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        params[`filters[${filterIndex}][field]`] = key;
        params[`filters[${filterIndex}][value]`] = String(value);
        filterIndex++;
      }
    }

    return params;
  }

  /**
   * Execute with retry if enabled
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    return withRetry(fn, {
      enabled: this.retriesEnabled,
      maxRetries: this.config.maxRetries ?? 3,
      logger: this.logger,
    });
  }

  /**
   * Get rate limiter status
   */
  public getRateLimiterStatus() {
    return this.rateLimiter.getStatus();
  }

  /**
   * Enable or disable retries
   */
  public setRetriesEnabled(enabled: boolean): void {
    this.retriesEnabled = enabled;
  }

  /**
   * Check if retries are enabled
   */
  public areRetriesEnabled(): boolean {
    return this.retriesEnabled;
  }
}
