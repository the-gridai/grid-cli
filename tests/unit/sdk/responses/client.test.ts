/**
 * Tests for ResponsesClient
 *
 * Tests Open Responses spec compliance, Bearer auth, redirect handling, and streaming.
 */

import axios from 'axios';
import { Readable } from 'stream';
import { ResponsesClient } from '../../../../src/sdk/responses/client';
import type { Model } from '../../../../src/sdk/responses/types';

// Create mock axios instance
const mockAxiosInstance = {
  get: jest.fn(),
  post: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
  defaults: { baseURL: 'http://test.api' },
};

// Mock axios.create to return our mock instance
jest.mock('axios', () => ({
  create: jest.fn(() => mockAxiosInstance),
  post: jest.fn(),
  isAxiosError: jest.fn((err) => err?.isAxiosError === true),
}));

// Mock config
jest.mock('../../../../src/core/config/config', () => ({
  getConfig: jest.fn(() => ({
    API_URL: 'http://test.api',
    API_KEY: 'test-api-key',
    SDK_REQUEST_TIMEOUT: 30000,
    CONSUMPTION_API_URL: 'http://test.api/consumption',
  })),
  getConfigForProfile: jest.fn(() => ({
    API_URL: 'http://test.api',
    API_KEY: 'test-api-key',
    SDK_REQUEST_TIMEOUT: 30000,
  })),
}));

// Mock logger
jest.mock('../../../../src/core/logging/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ResponsesClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ResponsesClient.resetInstances();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ResponsesClient.getInstance();
      const instance2 = ResponsesClient.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should return different instances for different profiles', () => {
      const instance1 = ResponsesClient.getInstance({ profile: 'profile1' });
      const instance2 = ResponsesClient.getInstance({ profile: 'profile2' });
      expect(instance1).not.toBe(instance2);
    });

    it('should cache profile instances', () => {
      const instance1 = ResponsesClient.getInstance({ profile: 'test' });
      const instance2 = ResponsesClient.getInstance({ profile: 'test' });
      expect(instance1).toBe(instance2);
    });

    it('should add Bearer auth interceptor', () => {
      ResponsesClient.getInstance();
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
    });
  });

  describe('resetInstances', () => {
    it('should clear all cached instances', () => {
      const instance1 = ResponsesClient.getInstance();
      ResponsesClient.resetInstances();
      const instance2 = ResponsesClient.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('listModels', () => {
    it('should return array of models', async () => {
      const mockModels: Model[] = [
        { id: 'fast-inference', object: 'model', display_name: 'Fast Inference' },
        { id: 'prime-inference', object: 'model', display_name: 'Prime Inference' },
      ];
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: mockModels },
      });

      const client = ResponsesClient.getInstance();
      const models = await client.listModels();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/models');
      expect(models).toHaveLength(2);
      expect(models[0].id).toBe('fast-inference');
    });

    it('should return empty array when no models', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: [] },
      });

      const client = ResponsesClient.getInstance();
      const models = await client.listModels();

      expect(models).toEqual([]);
    });

    it('should handle missing data field gracefully', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {},
      });

      const client = ResponsesClient.getInstance();
      const models = await client.listModels();

      expect(models).toEqual([]);
    });

    it('should throw ApiError on network failure', async () => {
      const networkError = new Error('Network error');
      (networkError as any).isAxiosError = true;
      (networkError as any).code = 'ECONNREFUSED';
      mockAxiosInstance.get.mockRejectedValueOnce(networkError);

      const client = ResponsesClient.getInstance();
      await expect(client.listModels()).rejects.toThrow();
    });
  });

  describe('create', () => {
    it('should make POST request with OpenAI format', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 200,
        data: {
          id: 'chatcmpl-123',
          choices: [
            {
              message: { role: 'assistant', content: 'Hello!' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        },
      });

      const client = ResponsesClient.getInstance();
      const response = await client.create({
        model: 'fast-inference',
        input: 'Hello',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/chat/completions',
        expect.objectContaining({
          model: 'fast-inference',
          messages: expect.arrayContaining([expect.objectContaining({ role: 'user', content: 'Hello' })]),
          stream: false,
        })
      );
      expect(response.status).toBe('completed');
      expect(response.items).toHaveLength(1);
    });

    it('should handle 307 redirect to the inference gateway', async () => {
      // First call returns 307 with redirect URL
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 307,
        headers: { location: 'http://synapse:4001/v1/chat/completions?token=abc' },
      });

      // Mock axios.post for the redirect (not the instance method)
      const axiosPost = axios.post as jest.Mock;
      axiosPost.mockResolvedValueOnce({
        data: {
          id: 'chatcmpl-123',
          choices: [
            {
              message: { role: 'assistant', content: 'Hello from the gateway!' },
              finish_reason: 'stop',
            },
          ],
        },
        headers: {},
      });

      const client = ResponsesClient.getInstance();
      const response = await client.create({
        model: 'fast-inference',
        input: 'Hello',
      });

      // Verify redirect was followed and the local-development hostname was rewritten.
      expect(axiosPost).toHaveBeenCalledWith(
        expect.stringContaining('localhost:4001'),
        expect.any(Object),
        expect.any(Object)
      );
      expect(response.items[0]).toHaveProperty('content', 'Hello from the gateway!');
    });

    it('should not reuse a request id when the next response omits the header', async () => {
      mockAxiosInstance.post
        .mockResolvedValueOnce({
          status: 200,
          headers: { 'x-grid-request-id': 'request-one' },
          data: {
            id: 'chatcmpl-1',
            choices: [{ message: { role: 'assistant', content: 'One' }, finish_reason: 'stop' }],
          },
        })
        .mockResolvedValueOnce({
          status: 200,
          headers: {},
          data: {
            id: 'chatcmpl-2',
            choices: [{ message: { role: 'assistant', content: 'Two' }, finish_reason: 'stop' }],
          },
        });

      const client = ResponsesClient.getInstance();
      const first = await client.create({ model: 'fast-inference', input: 'One' });
      const second = await client.create({ model: 'fast-inference', input: 'Two' });

      expect(first.request_id).toBe('request-one');
      expect(second.request_id).toBeUndefined();
      expect(client.getLastRequestId()).toBeUndefined();
    });

    it('should throw error when redirect missing location header', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 307,
        headers: {}, // Missing location
      });

      const client = ResponsesClient.getInstance();
      await expect(
        client.create({
          model: 'fast-inference',
          input: 'Hello',
        })
      ).rejects.toThrow('Missing redirect location');
    });

    it('should convert instructions to system message', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 200,
        data: {
          id: 'chatcmpl-123',
          choices: [{ message: { role: 'assistant', content: 'Ahoy!' }, finish_reason: 'stop' }],
        },
      });

      const client = ResponsesClient.getInstance();
      await client.create({
        model: 'fast-inference',
        input: 'Hello',
        instructions: 'You are a pirate',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/chat/completions',
        expect.objectContaining({
          messages: expect.arrayContaining([expect.objectContaining({ role: 'system', content: 'You are a pirate' })]),
        })
      );
    });
  });

  describe('rewriteRedirectUrl', () => {
    // Access private method for testing via prototype
    it('should rewrite app hostname to localhost', () => {
      const client = ResponsesClient.getInstance();
      const rewrite = (client as any).rewriteRedirectUrl.bind(client);

      expect(rewrite('http://app:3336/v1/chat')).toBe('http://localhost:4001/v1/chat');
      expect(rewrite('http://app:4000/v1/chat')).toBe('http://localhost:4001/v1/chat');
    });

    it('should rewrite synapse hostname to localhost', () => {
      const client = ResponsesClient.getInstance();
      const rewrite = (client as any).rewriteRedirectUrl.bind(client);

      expect(rewrite('http://synapse:8080/v1/chat')).toBe('http://localhost:4001/v1/chat');
    });

    it('should rewrite litellm hostname to localhost', () => {
      const client = ResponsesClient.getInstance();
      const rewrite = (client as any).rewriteRedirectUrl.bind(client);

      expect(rewrite('http://litellm:4000/v1/chat')).toBe('http://localhost:4001/v1/chat');
    });

    it('should preserve localhost URLs', () => {
      const client = ResponsesClient.getInstance();
      const rewrite = (client as any).rewriteRedirectUrl.bind(client);

      expect(rewrite('http://localhost:4001/v1/chat')).toBe('http://localhost:4001/v1/chat');
    });

    it('should preserve external URLs', () => {
      const client = ResponsesClient.getInstance();
      const rewrite = (client as any).rewriteRedirectUrl.bind(client);

      expect(rewrite('https://api.example.com/v1/chat')).toBe('https://api.example.com/v1/chat');
    });

    it('should preserve query parameters', () => {
      const client = ResponsesClient.getInstance();
      const rewrite = (client as any).rewriteRedirectUrl.bind(client);

      const result = rewrite('http://app:3336/v1/chat?token=abc123&foo=bar');
      expect(result).toContain('token=abc123');
      expect(result).toContain('foo=bar');
    });
  });

  describe('toOpenAIFormat', () => {
    it('should convert string input to messages array', () => {
      const client = ResponsesClient.getInstance();
      const convert = (client as any).toOpenAIFormat.bind(client);

      const result = convert({ model: 'test', input: 'Hello' });
      expect(result.messages).toEqual([{ role: 'user', content: 'Hello' }]);
    });

    it('should convert items array to messages array', () => {
      const client = ResponsesClient.getInstance();
      const convert = (client as any).toOpenAIFormat.bind(client);

      const result = convert({
        model: 'test',
        input: [
          { type: 'message', role: 'user', content: 'Hello' },
          { type: 'message', role: 'assistant', content: 'Hi!' },
        ],
      });
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(result.messages[1]).toEqual({ role: 'assistant', content: 'Hi!' });
    });

    it('should include optional parameters', () => {
      const client = ResponsesClient.getInstance();
      const convert = (client as any).toOpenAIFormat.bind(client);

      const result = convert({
        model: 'test',
        input: 'Hello',
        temperature: 0.7,
        max_tokens: 1000,
      });
      expect(result.temperature).toBe(0.7);
      expect(result.max_tokens).toBe(1000);
    });
  });

  describe('error handling', () => {
    it('should handle 401 unauthorized', async () => {
      const error = new Error('Unauthorized') as any;
      error.isAxiosError = true;
      error.response = { status: 401, data: { error: 'Invalid API key' } };
      mockAxiosInstance.get.mockRejectedValueOnce(error);

      const client = ResponsesClient.getInstance();
      await expect(client.listModels()).rejects.toThrow();
    });

    it('should handle 402 payment required', async () => {
      const error = new Error('Payment Required') as any;
      error.isAxiosError = true;
      error.response = { status: 402, data: { error: 'Insufficient balance' } };
      mockAxiosInstance.post.mockRejectedValueOnce(error);

      const client = ResponsesClient.getInstance();
      await expect(client.create({ model: 'test', input: 'Hello' })).rejects.toThrow();
    });

    it('should handle 500 server error', async () => {
      const error = new Error('Server Error') as any;
      error.isAxiosError = true;
      error.response = { status: 500, data: { error: 'Internal error' } };
      mockAxiosInstance.get.mockRejectedValueOnce(error);

      const client = ResponsesClient.getInstance();
      await expect(client.listModels()).rejects.toThrow();
    });
  });
});

describe('stream', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ResponsesClient.resetInstances();
  });

  it('should yield error event on stream failure', async () => {
    mockAxiosInstance.post.mockRejectedValueOnce(new Error('Connection failed'));

    const client = ResponsesClient.getInstance();
    const events: any[] = [];

    for await (const event of client.stream({ model: 'test', input: 'Hello' })) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');
    expect(events[0].error.message).toContain('Connection failed');
  });

  it('captures the request id from the final streaming response without sending bearer auth', async () => {
    mockAxiosInstance.post.mockResolvedValueOnce({
      status: 307,
      headers: { location: 'https://gateway.example.com/v1/chat/completions?token=abc' },
    });

    const axiosPost = axios.post as jest.Mock;
    axiosPost.mockResolvedValueOnce({
      data: Readable.from(['data: {"choices":[]}\n', 'data: [DONE]\n']),
      headers: { 'x-grid-request-id': 'stream-request' },
    });

    const client = ResponsesClient.getInstance();
    const events: any[] = [];

    for await (const event of client.stream({ model: 'test', input: 'Hello' })) {
      events.push(event);
    }

    expect(events[events.length - 1].response.request_id).toBe('stream-request');
    expect(client.getLastRequestId()).toBe('stream-request');
    expect(axiosPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });
});
