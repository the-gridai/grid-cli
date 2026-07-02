/**
 * @the-gridai/grid-sdk
 *
 * Official TypeScript SDK for the Grid Trading Platform.
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
 * // Place an order
 * const order = await client.orders.create({
 *   market_id: 'BTC-USD',
 *   side: 'buy',
 *   type: 'limit',
 *   quantity: '1.0',
 *   price: '50000',
 * });
 *
 * // Get account balances
 * const balances = await client.accounts.getTradingAccounts();
 * ```
 *
 * @packageDocumentation
 */

// Main client
export { GridClient } from './client.js';

// WebSocket client
export { GridWebSocket, type GridWebSocketConfig } from './websocket.js';

// Profile management (load credentials from grid-cli profile store)
export {
  loadProfile,
  loadFromEnv,
  autoLoadConfig,
  getAvailableProfiles,
  getCurrentProfile,
  getProfile,
  credentialsFileExists,
  getCredentialsPath,
  type Profile,
  type LoadProfileOptions,
} from './profiles.js';

// Authentication
export { SignatureAuth, generateKeyPair, calculateFingerprint, type SignatureAuthOptions, type AuthHeaders } from './auth.js';

// Errors
export {
  GridError,
  ApiError,
  AuthenticationError,
  NetworkError,
  RateLimitError,
  ValidationError,
  InsufficientBalanceError,
  OrderNotFoundError,
  MarketNotFoundError,
  WebSocketError,
} from './errors.js';

// Types
export type {
  // Config
  GridClientConfig,
  Logger,
  // API
  ApiResponse,
  ApiErrorResponse,
  ApiResponseMeta,
  // Orders
  OrderSide,
  OrderType,
  TimeInForce,
  OrderStatus,
  PlaceOrderRequest,
  Order,
  OrderFilters,
  UpdateOrderRequest,
  Trade,
  TradeFilters,
  // Markets
  MarketStatus,
  Market,
  Instrument,
  Ticker,
  OrderBookLevel,
  OrderBook,
  PublicTrade,
  MarketStats,
  OHLCV,
  // Accounts
  TradingAccount,
  CurrencyTradingAccount,
  IssuanceAccount,
  TransferFromIssuanceRequest,
  TransferToConsumptionRequest,
  TransferToTradingRequest,
  ConsumptionInstrument,
  // User
  User,
  SigningKey,
  RegisterSigningKeyRequest,
  // WebSocket
  WSConfig,
  WSMessage,
  OrderEvent,
  TradeEvent,
  TickerEvent,
} from './types/index.js';

// Re-export ConnectionState enum value (both as type and value)
export { ConnectionState } from './types/index.js';

// Validators (for advanced use cases)
export {
  validatePlaceOrderRequest,
  validateUpdateOrderRequest,
  validateResponse,
  validateArrayResponse,
  validateInput,
  // Schemas for custom validation
  PlaceOrderRequestSchema,
  UpdateOrderRequestSchema,
  OrderSchema,
  TradeSchema,
  MarketSchema,
  TickerSchema,
  OrderBookSchema,
  TradingAccountSchema,
  ConsumptionInstrumentSchema,
} from './validators.js';

// HTTP utilities (for advanced use cases)
export {
  RateLimiter,
  withRetry,
  sleep,
  isRetryableError,
  type RateLimiterConfig,
  type RetryConfig,
} from './http/index.js';
