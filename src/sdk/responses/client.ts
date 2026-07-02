/**
 * Open Responses Client
 * 
 * A dedicated client for the Grid consumption API following the Open Responses spec.
 * Uses Bearer token authentication and handles the exchange -> inference-gateway redirect flow.
 * 
 * Key features:
 * - Bearer token authentication (uses profile's api_key)
 * - Automatic 307 redirect handling
 * - SSE streaming support
 * - Open Responses spec compliant (items, events)
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import http from 'http';
import https from 'https';
import { getConfig, getConfigForProfile } from '../../core/config/config';
import { getGlobalProfileOverride } from '../../core/config/profiles';
import { resolveConsumptionBearerToken } from '../auth/bearer';
import { OAuthSession, oauthSessionFromConfig } from '../auth/oauth-session';
import { logger } from '../../core/logging/logger';
import { ApiError } from '../../core/errors';

import type {
  Model,
  ModelsResponse,
  Item,
  MessageItem,
  ToolCallItem,
  Response,
  StreamingEvent,
  CreateResponseRequest,
  ResponsesClientOptions,
  TokenUsage,
  OpenAIChatMessage,
  OpenAIChatRequest,
  OpenAIChatResponse,
} from './types';

// HTTP agents for connection reuse
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
});

/**
 * ResponsesClient - Open Responses compliant client for Grid consumption API
 */
export class ResponsesClient {
  private client: AxiosInstance;
  private staticBearer: string | undefined;
  private oauthSession: OAuthSession | null = null;
  private readonly profileName: string | undefined;
  private static instance: ResponsesClient;
  private static profileInstances: Map<string, ResponsesClient> = new Map();

  private constructor(options?: ResponsesClientOptions) {
    const config = options?.profile 
      ? getConfigForProfile(options.profile) 
      : getConfig();
    
    // Priority: explicit option > profile/config consumption URL > fallback to API_URL
    // Profile's consumption_api_url is merged into config.CONSUMPTION_API_URL by getConfigForProfile
    const baseURL = options?.apiUrl || config.CONSUMPTION_API_URL || config.API_URL;
    
    this.profileName = options?.profile;
    const staticBearer = resolveConsumptionBearerToken(config);
    const oauth = oauthSessionFromConfig(config);

    // Consumption API keys take precedence over OAuth on the consumption host.
    if (oauth && !config.API_KEY) {
      this.oauthSession = new OAuthSession(oauth, this.profileName);
      this.staticBearer = undefined;
    } else {
      this.oauthSession = null;
      this.staticBearer = staticBearer;
    }

    this.client = axios.create({
      baseURL,
      timeout: options?.timeout || config.SDK_REQUEST_TIMEOUT || 60000,
      headers: {
        'Content-Type': 'application/json',
      },
      httpAgent,
      httpsAgent,
      // Don't follow redirects automatically - we handle 307 manually
      maxRedirects: 0,
      validateStatus: (status) => status < 400 || status === 307,
    });

    // Consumption API: Authorization: Bearer (OAuth token, API key, or GRID_CLI_CONSUMPTION_KEY)
    this.client.interceptors.request.use(async (reqConfig) => {
      const token = this.oauthSession
        ? await this.oauthSession.ensureFreshAccessToken()
        : this.staticBearer;
      if (token) {
        reqConfig.headers.Authorization = `Bearer ${token}`;
      }
      return reqConfig;
    });

    logger.debug('ResponsesClient initialized', { 
      baseURL,
      authType: this.oauthSession ? 'oauth' : this.staticBearer ? 'bearer' : 'none',
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(options?: ResponsesClientOptions): ResponsesClient {
    const profileOverride = getGlobalProfileOverride();
    const profile = options?.profile || profileOverride;

    if (profile) {
      const cached = ResponsesClient.profileInstances.get(profile);
      if (cached) return cached;
      
      const instance = new ResponsesClient({ ...options, profile });
      ResponsesClient.profileInstances.set(profile, instance);
      return instance;
    }

    if (!ResponsesClient.instance) {
      ResponsesClient.instance = new ResponsesClient(options);
    }
    return ResponsesClient.instance;
  }

  /**
   * Reset all cached instances (useful for testing)
   */
  public static resetInstances(): void {
    ResponsesClient.instance = undefined as unknown as ResponsesClient;
    ResponsesClient.profileInstances.clear();
  }

  // ===========================================================================
  // Models API
  // ===========================================================================

  /**
   * List available models/specs from the API
   */
  public async listModels(): Promise<Model[]> {
    try {
      const response = await this.client.get<ModelsResponse>('/models');
      return response.data.data || [];
    } catch (error) {
      throw this.handleError(error, 'listModels');
    }
  }

  // ===========================================================================
  // Responses API
  // ===========================================================================

  /**
   * Create a response (non-streaming)
   */
  public async create(request: CreateResponseRequest): Promise<Response> {
    const chatRequest = this.toOpenAIFormat(request);
    chatRequest.stream = false;

    try {
      const response = await this.makeRequestWithRedirect('/chat/completions', chatRequest);
      return this.toOpenResponsesFormat(response.data, request);
    } catch (error) {
      throw this.handleError(error, 'create');
    }
  }

  /**
   * Stream a response with events
   */
  public async *stream(request: CreateResponseRequest): AsyncGenerator<StreamingEvent> {
    const chatRequest = this.toOpenAIFormat(request);
    chatRequest.stream = true;
    chatRequest.stream_options = { include_usage: true };

    try {
      // Get the redirect URL
      const redirectUrl = await this.getRedirectUrl('/chat/completions', chatRequest);
      
      // Make streaming request to the inference gateway
      const response = await this.makeStreamingRequest(redirectUrl, chatRequest);
      
      // Parse SSE events
      yield* this.parseSSEStream(response, request);
    } catch (error) {
      yield {
        type: 'error',
        error: {
          code: 'stream_error',
          message: error instanceof Error ? error.message : 'Unknown streaming error',
        },
      };
    }
  }

  // ===========================================================================
  // Request Handling
  // ===========================================================================

  /**
   * Make a request that handles the 307 redirect to the inference gateway
   */
  private async makeRequestWithRedirect(path: string, data: OpenAIChatRequest): Promise<{ data: OpenAIChatResponse }> {
    // First request to the API
    const apiResponse = await this.client.post(path, data);

    // Handle 307 redirect
    if (apiResponse.status === 307) {
      let redirectUrl = apiResponse.headers.location;
      if (!redirectUrl) {
        throw new ApiError('Missing redirect location', 307);
      }

      // Rewrite internal Docker hostname to localhost for local dev
      redirectUrl = this.rewriteRedirectUrl(redirectUrl);

      // Follow redirect to the inference gateway (no auth needed, token is in URL)
      const gatewayResponse = await axios.post(redirectUrl, data, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 120000, // Longer timeout for inference
        httpAgent,
        httpsAgent,
      });

      return gatewayResponse;
    }

    return apiResponse;
  }
  
  /**
   * Rewrite redirect URL to handle internal Docker hostnames
   * In development, the API may return URLs like http://app:3336 which need
   * to be rewritten for the client to access
   */
  private rewriteRedirectUrl(url: string): string {
    // Map internal Docker hostnames to localhost ports
    // Matches hostname regardless of port (e.g., app:3336, app:4000, etc.)
    const hostMappings: Record<string, number> = {
      'app': 4001,       // LLM Gateway -> LiteLLM
      'synapse': 4001,   // inference gateway -> LiteLLM
      'litellm': 4001,   // LiteLLM direct
    };
    
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname;
      
      if (hostMappings[hostname]) {
        parsed.hostname = 'localhost';
        parsed.port = hostMappings[hostname].toString();
        return parsed.toString();
      }
    } catch {
      // If URL parsing fails, return as-is
    }
    
    return url;
  }

  /**
   * Get the redirect URL from the API
   */
  private async getRedirectUrl(path: string, data: OpenAIChatRequest): Promise<string> {
    const response = await this.client.post(path, data);

    if (response.status === 307) {
      const redirectUrl = response.headers.location;
      if (!redirectUrl) {
        throw new ApiError('Missing redirect location', 307);
      }
      // Rewrite internal Docker hostname for local dev
      return this.rewriteRedirectUrl(redirectUrl);
    }

    // If we got a direct response (no redirect), return the original URL
    // This shouldn't happen with the current API but handle it gracefully
    throw new ApiError('Expected redirect from the API', response.status);
  }

  /**
   * Make a streaming request to the LLM gateway
   * 
   * In local development, this is LiteLLM which requires its own API key.
   * The LLM_GATEWAY_API_KEY env var (defaults to sk-1234 for local dev) is used.
   * 
   * Uses AbortController to prevent hanging on slow/stalled connections.
   * Default timeout is 5 minutes for streaming responses.
   */
  private async makeStreamingRequest(
    url: string, 
    data: OpenAIChatRequest,
    timeoutMs: number = 300000 // 5 minute default for streaming
  ): Promise<NodeJS.ReadableStream> {
    // Get LLM gateway API key from env (default for local LiteLLM: sk-1234)
    const llmGatewayKey = process.env.LLM_GATEWAY_API_KEY || 'sk-1234';
    
    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    
    try {
      const response = await axios.post(url, data, {
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${llmGatewayKey}`,
        },
        responseType: 'stream',
        signal: controller.signal,
        httpAgent,
        httpsAgent,
      });

      // Clear timeout once we start receiving data, 
      // but set up a new one for idle detection
      clearTimeout(timeoutId);
      
      return response.data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (controller.signal.aborted) {
        throw new ApiError('Streaming request timed out', 408);
      }
      throw error;
    }
  }

  /**
   * Parse SSE stream into Open Responses events
   */
  private async *parseSSEStream(
    stream: NodeJS.ReadableStream, 
    originalRequest: CreateResponseRequest
  ): AsyncGenerator<StreamingEvent> {
    let buffer = '';
    const responseId = `resp_${Date.now()}`;
    const items: Item[] = [];
    let currentItemContent = '';
    let usage: TokenUsage | undefined;
    let model = originalRequest.model;

    // Emit response.created
    yield {
      type: 'response.created',
      response: {
        id: responseId,
        object: 'response',
        created: Math.floor(Date.now() / 1000),
        model,
        items: [],
        status: 'in_progress',
      },
    };

    for await (const chunk of stream) {
      buffer += chunk.toString();

      // Process complete SSE messages
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          
          if (data === '[DONE]') {
            // Build final message item
            if (currentItemContent) {
              const messageItem: MessageItem = {
                type: 'message',
                role: 'assistant',
                content: currentItemContent,
              };
              items.push(messageItem);

              yield {
                type: 'response.item.done',
                item: messageItem,
              };
            }

            // Emit response.done
            yield {
              type: 'response.done',
              response: {
                id: responseId,
                object: 'response',
                created: Math.floor(Date.now() / 1000),
                model,
                items,
                usage,
                status: 'completed',
              },
            };
            return;
          }

          try {
            const parsed = JSON.parse(data);
            
            // Update model from response
            if (parsed.model) {
              model = parsed.model;
            }

            // Extract usage from final chunk
            if (parsed.usage) {
              usage = {
                prompt_tokens: parsed.usage.prompt_tokens || 0,
                completion_tokens: parsed.usage.completion_tokens || 0,
                total_tokens: parsed.usage.total_tokens || 0,
              };
            }

            // Process choices
            if (parsed.choices && parsed.choices.length > 0) {
              const choice = parsed.choices[0];
              
              // Handle tool calls
              if (choice.delta?.tool_calls) {
                for (const toolCall of choice.delta.tool_calls) {
                  if (toolCall.function) {
                    const toolItem: ToolCallItem = {
                      type: 'tool_call',
                      id: toolCall.id || `call_${Date.now()}`,
                      name: toolCall.function.name || '',
                      arguments: toolCall.function.arguments || '',
                    };
                    
                    yield {
                      type: 'response.item.added',
                      item: toolItem,
                    };
                  }
                }
              }

              // Handle content deltas
              if (choice.delta?.content) {
                const content = choice.delta.content;
                currentItemContent += content;

                yield {
                  type: 'response.item.delta',
                  delta: {
                    type: 'message',
                    role: 'assistant',
                    content,
                  },
                };
              }

              // Check for finish reason
              if (choice.finish_reason === 'tool_calls') {
                // Response requires action (tool execution)
                // This will be handled in response.done
              }
            }
          } catch (parseError) {
            logger.debug('Failed to parse SSE chunk', { data, error: parseError });
          }
        }
      }
    }

    // If stream ended without [DONE], still emit final events
    if (currentItemContent) {
      const messageItem: MessageItem = {
        type: 'message',
        role: 'assistant',
        content: currentItemContent,
      };
      items.push(messageItem);

      yield {
        type: 'response.item.done',
        item: messageItem,
      };
    }

    yield {
      type: 'response.done',
      response: {
        id: responseId,
        object: 'response',
        created: Math.floor(Date.now() / 1000),
        model,
        items,
        usage,
        status: 'completed',
      },
    };
  }

  // ===========================================================================
  // Format Conversion
  // ===========================================================================

  /**
   * Convert Open Responses request to OpenAI chat format
   */
  private toOpenAIFormat(request: CreateResponseRequest): OpenAIChatRequest {
    const messages: OpenAIChatMessage[] = [];

    // Add system instructions
    if (request.instructions) {
      messages.push({
        role: 'system',
        content: request.instructions,
      });
    }

    // Convert input to messages
    if (typeof request.input === 'string') {
      messages.push({
        role: 'user',
        content: request.input,
      });
    } else if (Array.isArray(request.input)) {
      for (const item of request.input) {
        if (item.type === 'message') {
          messages.push({
            role: item.role,
            content: item.content,
          });
        } else if (item.type === 'tool_result') {
          messages.push({
            role: 'tool',
            tool_call_id: item.tool_call_id,
            content: item.content,
          });
        }
        // Image and audio items would need special handling
      }
    }

    const chatRequest: OpenAIChatRequest = {
      model: request.model,
      messages,
      stream: request.stream ?? true,
    };

    // Add optional parameters
    if (request.temperature !== undefined) chatRequest.temperature = request.temperature;
    if (request.max_tokens !== undefined) chatRequest.max_tokens = request.max_tokens;
    if (request.top_p !== undefined) chatRequest.top_p = request.top_p;
    if (request.frequency_penalty !== undefined) chatRequest.frequency_penalty = request.frequency_penalty;
    if (request.presence_penalty !== undefined) chatRequest.presence_penalty = request.presence_penalty;
    if (request.stop !== undefined) chatRequest.stop = request.stop;
    if (request.user !== undefined) chatRequest.user = request.user;

    // Add tools if specified
    if (request.tools && request.tools.length > 0) {
      chatRequest.tools = request.tools;
    }

    return chatRequest;
  }

  /**
   * Convert OpenAI response to Open Responses format
   */
  private toOpenResponsesFormat(data: OpenAIChatResponse, originalRequest: CreateResponseRequest): Response {
    const items: Item[] = [];

    // Convert choices to items
    if (data.choices && data.choices.length > 0) {
      const choice = data.choices[0];
      
      // Handle assistant message
      if (choice.message?.content) {
        items.push({
          type: 'message',
          role: 'assistant',
          content: choice.message.content,
        });
      }

      // Handle tool calls
      if (choice.message?.tool_calls) {
        for (const toolCall of choice.message.tool_calls) {
          items.push({
            type: 'tool_call',
            id: toolCall.id,
            name: toolCall.function.name,
            arguments: toolCall.function.arguments,
          });
        }
      }
    }

    // Determine status
    let status: Response['status'] = 'completed';
    let requiredAction: Response['required_action'];
    
    const toolCalls = items.filter(i => i.type === 'tool_call') as ToolCallItem[];
    if (toolCalls.length > 0) {
      status = 'requires_action';
      requiredAction = {
        type: 'tool_calls',
        tool_calls: toolCalls,
      };
    }

    return {
      id: data.id || `resp_${Date.now()}`,
      object: 'response',
      created: data.created || Math.floor(Date.now() / 1000),
      model: data.model || originalRequest.model,
      items,
      usage: data.usage ? {
        prompt_tokens: data.usage.prompt_tokens || 0,
        completion_tokens: data.usage.completion_tokens || 0,
        total_tokens: data.usage.total_tokens || 0,
      } : undefined,
      status,
      required_action: requiredAction,
    };
  }

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  /**
   * Handle and transform errors
   */
  private handleError(error: unknown, operation: string): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>;
      const status = axiosError.response?.status || 500;
      const message = axiosError.response?.data?.error?.message 
        || axiosError.response?.data?.errors?.detail
        || axiosError.message
        || 'Unknown error';

      logger.error(`ResponsesClient.${operation} failed`, {
        status,
        message,
        url: axiosError.config?.url,
      });

      return new ApiError(message, status);
    }

    if (error instanceof Error) {
      logger.error(`ResponsesClient.${operation} failed`, { error: error.message });
      return error;
    }

    return new Error(`Unknown error in ${operation}`);
  }
}
