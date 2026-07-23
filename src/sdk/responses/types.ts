/**
 * Open Responses API Types
 *
 * Based on the Open Responses specification (https://www.openresponses.org/)
 * for multi-provider, interoperable LLM interfaces.
 *
 * Key concepts:
 * - Items: atomic unit of model output and tool use
 * - Streaming events: real-time output
 * - Tool invocation patterns: for agentic workflows
 */

// =============================================================================
// Models
// =============================================================================

/**
 * Model available for inference
 */
export interface Model {
  id: string; // e.g., "llama-3.1-70b"
  display_name: string; // e.g., "Llama 3.1 70B"
  object: 'model';
}

/**
 * Models list response
 */
export interface ModelsResponse {
  object: 'list';
  data: Model[];
}

// =============================================================================
// Items - Atomic unit of output (Open Responses spec)
// =============================================================================

/**
 * Message item - text content from user, assistant, or system
 */
export interface MessageItem {
  type: 'message';
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Tool call item - request to execute a tool
 */
export interface ToolCallItem {
  type: 'tool_call';
  id: string;
  name: string;
  arguments: string; // JSON string
}

/**
 * Tool result item - result from tool execution
 */
export interface ToolResultItem {
  type: 'tool_result';
  tool_call_id: string;
  content: string;
}

/**
 * Image item - image content (multimodal)
 */
export interface ImageItem {
  type: 'image';
  id?: string;
  url?: string;
  base64?: string;
  media_type?: string;
}

/**
 * Audio item - audio content (multimodal)
 */
export interface AudioItem {
  type: 'audio';
  id?: string;
  url?: string;
  base64?: string;
  media_type?: string;
}

/**
 * Union of all item types
 */
export type Item = MessageItem | ToolCallItem | ToolResultItem | ImageItem | AudioItem;

/**
 * Item delta for streaming
 */
export interface ItemDelta {
  type: Item['type'];
  id?: string;
  role?: string;
  content?: string;
  name?: string;
  arguments?: string;
}

// =============================================================================
// Tool Definitions
// =============================================================================

/**
 * Tool parameter definition
 */
export interface ToolParameter {
  type: string;
  description?: string;
  enum?: string[];
  required?: boolean;
}

/**
 * Tool function definition
 */
export interface ToolFunction {
  name: string;
  description?: string;
  parameters?: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
}

/**
 * Tool definition for agentic workflows
 */
export interface ToolDefinition {
  type: 'function';
  function: ToolFunction;
}

// =============================================================================
// Token Usage
// =============================================================================

/**
 * Token usage information
 */
export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// =============================================================================
// Response
// =============================================================================

/**
 * Response status
 */
export type ResponseStatus = 'completed' | 'in_progress' | 'requires_action' | 'failed' | 'cancelled';

/**
 * Required action for agentic loops
 */
export interface RequiredAction {
  type: 'tool_calls';
  tool_calls: ToolCallItem[];
}

/**
 * Response object - the main output from a model
 */
export interface Response {
  id: string;
  object: 'response';
  created: number;
  model: string;
  items: Item[];
  usage?: TokenUsage;
  status: ResponseStatus;
  required_action?: RequiredAction;
  error?: ErrorInfo;
  /**
   * Server-issued Grid request id (`x-grid-request-id` header from dispatch).
   * The handle for `GET /v1/usage/:request_id` — tokens, settled cost, timing.
   */
  request_id?: string;
}

// =============================================================================
// Usage receipts (spend transparency)
// =============================================================================

/** Cost lifecycle on a receipt. Settles asynchronously after the response. */
export type UsageCostStatus = 'pending' | 'reconciled' | 'unpriced' | 'cancelled';

/** One FIFO draw from an acquisition lot; cost == sum of subtotals. */
export interface UsageCostDraw {
  acquisition_price_per_token: string | null;
  tokens: number;
  subtotal: string | null;
}

/** Agent-consumable cost object: money is decimal strings, never floats. */
export interface UsageCost {
  amount: string | null;
  currency: string;
  status: UsageCostStatus;
  effective_price_per_token: string | null;
  metering_policy_version: string | null;
  reconciled_at: string | null;
  /** Present on single-receipt lookups; omitted from list entries. */
  breakdown?: UsageCostDraw[];
}

/** Per-request usage receipt (`GET /v1/usage/:request_id`). */
export interface UsageReceipt {
  request_id: string;
  status: 'pending' | 'reconciled' | 'error';
  requested_model: string | null;
  serving_model: string | null;
  endpoint: string | null;
  /** API key that made the request; null on rows that predate attribution. */
  api_key_id: string | null;
  created_at: string;
  usage: {
    input_tokens: number | null;
    output_tokens: number | null;
    total_tokens: number | null;
  };
  cost: UsageCost;
  timing: {
    ttft_ms: number | null;
    tokens_per_second: number | null;
    duration_ms: number | null;
  };
}

/** Paginated usage list (`GET /v1/usage`), Trading API paging conventions. */
export interface UsageListResponse {
  data: UsageReceipt[];
  paging: {
    next_cursor: string | null;
    prev_cursor: string | null;
    has_more: boolean;
  };
}

/** Filters for the usage list endpoint. */
export interface ListUsageParams {
  from?: string;
  to?: string;
  status?: 'pending' | 'reconciled' | 'error';
  cost_status?: UsageCostStatus;
  model?: string;
  api_key_id?: string;
  order_by?: 'inserted_at' | 'total_tokens';
  order_direction?: 'asc' | 'desc';
  limit?: number;
  /** Opaque cursor from `paging.next_cursor` (forward pagination). */
  next?: string;
  /** Opaque cursor from `paging.prev_cursor` (backward pagination). */
  prev?: string;
}

/** One set of usage/spend aggregates (totals or a single bucket). */
export interface UsageSummaryAggregates {
  request_count: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost: {
    /** Decimal string; sum of the priced portion. Null when nothing priced. */
    reconciled_amount: string | null;
    currency: string;
    reconciled_requests: number;
    pending_requests: number;
    unpriced_requests: number;
    cancelled_requests: number;
    /** Tokens without a known cost basis; never converted to dollars. */
    unpriced_tokens: number;
  };
}

/** Aggregated usage/spend (`GET /v1/usage/summary`). */
export interface UsageSummaryResponse {
  totals: UsageSummaryAggregates;
  group_by: 'day' | 'model' | 'api_key' | null;
  /** Start of the applied window (defaults to 30 days before `to`). */
  from: string;
  /** End of the applied window (defaults to now). */
  to: string;
  /** Present only when group_by was requested; at most 100 entries. */
  buckets?: Array<UsageSummaryAggregates & { key: string | null }>;
}

/** Params for the usage summary endpoint. */
export interface UsageSummaryParams {
  /** Window start; defaults to 30 days before `to`. Max span: 31 days. */
  from?: string;
  /** Window end; defaults to now. */
  to?: string;
  group_by?: 'day' | 'model' | 'api_key';
  api_key_id?: string;
}

// =============================================================================
// Streaming Events
// =============================================================================

/**
 * Error information
 */
export interface ErrorInfo {
  code: string;
  message: string;
  param?: string;
  type?: string;
}

/**
 * Response created event
 */
export interface ResponseCreatedEvent {
  type: 'response.created';
  response: Response;
}

/**
 * Item added event
 */
export interface ResponseItemAddedEvent {
  type: 'response.item.added';
  item: Item;
}

/**
 * Item delta event (streaming content)
 */
export interface ResponseItemDeltaEvent {
  type: 'response.item.delta';
  item_id?: string;
  delta: ItemDelta;
}

/**
 * Item done event
 */
export interface ResponseItemDoneEvent {
  type: 'response.item.done';
  item: Item;
}

/**
 * Response done event
 */
export interface ResponseDoneEvent {
  type: 'response.done';
  response: Response;
}

/**
 * Error event
 */
export interface ErrorEvent {
  type: 'error';
  error: ErrorInfo;
}

/**
 * Union of all streaming event types
 */
export type StreamingEvent =
  | ResponseCreatedEvent
  | ResponseItemAddedEvent
  | ResponseItemDeltaEvent
  | ResponseItemDoneEvent
  | ResponseDoneEvent
  | ErrorEvent;

// =============================================================================
// Requests
// =============================================================================

/**
 * Input content - can be items array or simple string
 */
export type InputContent = Item[] | string;

/**
 * Create response request
 */
export interface CreateResponseRequest {
  /** Model ID to use */
  model: string;
  /** Input content - items or simple string prompt */
  input: InputContent;
  /** System instructions */
  instructions?: string;
  /** Tool definitions for agentic workflows */
  tools?: ToolDefinition[];
  /** Maximum turns for agentic loop (default: 1 for single-turn, set higher for agentic) */
  max_turns?: number;
  /** Enable streaming (default: true) */
  stream?: boolean;
  /** Temperature for sampling (0-2) */
  temperature?: number;
  /** Maximum tokens per response */
  max_tokens?: number;
  /** Top-p sampling */
  top_p?: number;
  /** Frequency penalty */
  frequency_penalty?: number;
  /** Presence penalty */
  presence_penalty?: number;
  /** Stop sequences */
  stop?: string | string[];
  /** User identifier for tracking */
  user?: string;
}

/**
 * Continue response request (for agentic loops)
 */
export interface ContinueResponseRequest {
  /** Response ID to continue */
  response_id: string;
  /** New items (typically tool results) */
  items: Item[];
}

// =============================================================================
// Session Management
// =============================================================================

/**
 * Session state for multi-turn conversations
 */
export interface Session {
  id: string;
  model: string;
  items: Item[];
  turn: number;
  max_turns?: number;
  created: number;
  updated: number;
  status: 'active' | 'completed' | 'saved';
}

/**
 * Session save format
 */
export interface SavedSession {
  version: 1;
  session: Session;
  metadata?: {
    saved_at: string;
    profile?: string;
  };
}

// =============================================================================
// Client Options
// =============================================================================

/**
 * Options for ResponsesClient
 */
export interface ResponsesClientOptions {
  /** Use a specific credential profile */
  profile?: string;
  /** Override API URL */
  apiUrl?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
}

// =============================================================================
// OpenAI Format Types (OpenAI-compatible wire format)
// =============================================================================

/**
 * OpenAI-style chat message
 */
export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
}

/**
 * OpenAI-style chat completion request
 */
export interface OpenAIChatRequest {
  model: string;
  messages: OpenAIChatMessage[];
  stream?: boolean;
  stream_options?: { include_usage?: boolean };
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  user?: string;
  tools?: ToolDefinition[];
}

/**
 * OpenAI-style chat completion response
 */
export interface OpenAIChatResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
