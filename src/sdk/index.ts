/**
 * GRID-cli SDK - Main entry point for external strategies
 * 
 * This module exports all the necessary components for building
 * trading strategies that can be run from anywhere on the system.
 */

// Export HTTP client
export { ApiClient, type TradingApiPingResult } from './http/client';

// Export Responses client (Open Responses spec compliant)
export { ResponsesClient } from './responses/client';
export { ExchangeClient } from './exchange/client';
export type { ExchangeApiKey, ExchangeSystemSettings } from './exchange/client';
export { generateSigningKeyPair, calculateSigningKeyFingerprint } from './auth/keygen';
// Export responses types (excluding TokenUsage which conflicts with consumption types)
export type {
  Model,
  ModelsResponse,
  Item,
  MessageItem,
  ToolCallItem,
  ToolResultItem,
  ImageItem,
  AudioItem,
  ItemDelta,
  ToolDefinition,
  ToolFunction,
  ToolParameter,
  Response,
  ResponseStatus,
  RequiredAction,
  ErrorInfo,
  StreamingEvent,
  ResponseCreatedEvent,
  ResponseItemAddedEvent,
  ResponseItemDeltaEvent,
  ResponseItemDoneEvent,
  ResponseDoneEvent,
  ErrorEvent,
  CreateResponseRequest,
  ContinueResponseRequest,
  InputContent,
  Session,
  SavedSession,
  ResponsesClientOptions,
} from './responses/types';
// Re-export TokenUsage from responses as ResponseTokenUsage to avoid conflict
export type { TokenUsage as ResponseTokenUsage } from './responses/types';

// Export timing utilities
export {
  setTimingEnabled,
  isTimingEnabled,
  getLastRequestTiming,
  getTimingHistory,
  clearTimingHistory,
  calculateTimingStats,
  formatTiming,
  formatTimingStats,
} from './http/timing';
export type { RequestTiming, TimingStats } from './http/timing';

// Retry control (for benchmarks)
export { setRetriesEnabled, areRetriesEnabled } from './http/retry';

// Export WebSocket clients
export { WebSocketClient, ConnectionState } from './ws/client';
export { TradingGatewayClient, GatewayState } from './ws/trading-gateway';
export type { OrderEvent, TradeEvent, TickerEvent, StreamDef, StreamType } from './ws/trading-gateway';

// Export all types
export * from './types';

// Export error classes
export * from '../core/errors';

// Export logger for strategy logging
export { logger } from '../core/logging/logger';

// Export configuration functions
export { getConfig, loadConfig } from '../core/config/config';

// Export validators (useful for custom validation)
export { validatePlaceOrderRequest, validateChatCompletionRequest } from './validators/inputs';

