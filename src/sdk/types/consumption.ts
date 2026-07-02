/**
 * Consumption API types for AI inference
 */

/**
 * Chat message role
 */
export type ChatRole = 'system' | 'user' | 'assistant' | 'function';

/**
 * Chat message
 */
export interface ChatMessage {
  role: string; // API can return various roles, keep as string
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

/**
 * Chat completion request
 */
export interface ChatCompletionRequest {
  model: string; // Instrument ID or model name
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  n?: number;
  logit_bias?: Record<string, number>;
  user?: string;
  [key: string]: any; // Allow additional parameters
}

/**
 * Chat completion choice
 */
export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: string | null; // API can return various finish reasons
  logprobs?: any;
}

/**
 * Token usage information
 */
export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Chat completion response
 */
export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: TokenUsage;
  system_fingerprint?: string;
}

/**
 * Streaming chunk
 */
export interface ChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: Partial<ChatMessage>;
    finish_reason: string | null;
  }>;
}
