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
  id: string;           // e.g., "llama-3.1-70b"
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
export type Item = 
  | MessageItem
  | ToolCallItem
  | ToolResultItem
  | ImageItem
  | AudioItem;

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
