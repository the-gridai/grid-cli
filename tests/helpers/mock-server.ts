/**
 * Mock server utilities for testing
 * 
 * Provides HTTP and WebSocket mock servers for testing
 */

import { Server as HTTPServer, createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer } from 'ws';
import { logger } from '../../src/core/logging/logger';

/**
 * Mock HTTP response configuration
 */
export interface MockResponse {
  status: number;
  data: any;
  delay?: number;
  headers?: Record<string, string>;
}

/**
 * Mock HTTP server for testing API calls
 */
export class MockHttpServer {
  private server: HTTPServer;
  private port: number;
  private handlers: Map<string, MockResponse> = new Map();
  private requestHistory: Array<{
    method: string;
    url: string;
    body: any;
    timestamp: Date;
  }> = [];

  constructor(port: number = 3456) {
    this.port = port;
    this.server = createServer((req, res) => this.handleRequest(req, res));
  }

  /**
   * Start the mock server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        logger.info(`Mock HTTP server started on port ${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the mock server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        logger.info('Mock HTTP server stopped');
        resolve();
      });
    });
  }

  /**
   * Configure response for a specific endpoint
   */
  mockEndpoint(method: string, path: string, response: MockResponse): void {
    const key = `${method.toUpperCase()}:${path}`;
    this.handlers.set(key, response);
  }

  /**
   * Handle incoming request
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method || 'GET';
    const url = req.url || '/';
    
    // Read body
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      // Record request
      this.requestHistory.push({
        method,
        url,
        body: body ? JSON.parse(body) : null,
        timestamp: new Date()
      });

      // Find handler
      const key = `${method}:${url}`;
      const mockResponse = this.handlers.get(key);

      if (!mockResponse) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: { message: 'Not found' } }));
        return;
      }

      // Simulate delay
      if (mockResponse.delay) {
        await new Promise(resolve => setTimeout(resolve, mockResponse.delay));
      }

      // Set headers
      res.writeHead(mockResponse.status, {
        'Content-Type': 'application/json',
        ...mockResponse.headers
      });

      res.end(JSON.stringify(mockResponse.data));
    });
  }

  /**
   * Get request history
   */
  getRequestHistory() {
    return this.requestHistory;
  }

  /**
   * Clear request history
   */
  clearHistory(): void {
    this.requestHistory = [];
  }

  /**
   * Reset all handlers
   */
  reset(): void {
    this.handlers.clear();
    this.clearHistory();
  }

  /**
   * Get base URL
   */
  getBaseUrl(): string {
    return `http://localhost:${this.port}`;
  }
}

/**
 * Mock WebSocket server for testing real-time features
 */
export class MockWebSocketServer {
  private wss: WebSocketServer;
  private port: number;
  private clients: Set<any> = new Set();
  private messageHistory: any[] = [];

  constructor(port: number = 3457) {
    this.port = port;
    this.wss = new WebSocketServer({ port: this.port });
    this.setupHandlers();
  }

  /**
   * Setup WebSocket handlers
   */
  private setupHandlers(): void {
    this.wss.on('connection', (ws) => {
      logger.info('Mock WebSocket client connected');
      this.clients.add(ws);

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        this.messageHistory.push(message);
        this.handleMessage(ws, message);
      });

      ws.on('ping', () => {
        ws.pong();
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        logger.info('Mock WebSocket client disconnected');
      });
    });
  }

  /**
   * Handle client messages
   */
  private handleMessage(ws: any, message: any): void {
    if (message.type === 'subscribe') {
      // Acknowledge subscription
      ws.send(JSON.stringify({
        type: 'subscribed',
        data: { channel: message.data.channel }
      }));
    } else if (message.type === 'unsubscribe') {
      // Acknowledge unsubscription
      ws.send(JSON.stringify({
        type: 'unsubscribed',
        data: { channel: message.data.channel }
      }));
    }
  }

  /**
   * Broadcast message to all clients
   */
  broadcast(message: any): void {
    const data = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === 1) { // OPEN
        client.send(data);
      }
    });
  }

  /**
   * Send message to specific client
   */
  sendToClient(client: any, message: any): void {
    if (this.clients.has(client) && client.readyState === 1) {
      client.send(JSON.stringify(message));
    }
  }

  /**
   * Disconnect all clients
   */
  disconnectAll(): void {
    this.clients.forEach(client => {
      client.close();
    });
    this.clients.clear();
  }

  /**
   * Get message history
   */
  getMessageHistory() {
    return this.messageHistory;
  }

  /**
   * Clear message history
   */
  clearHistory(): void {
    this.messageHistory = [];
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.disconnectAll();
      this.wss.close(() => {
        logger.info('Mock WebSocket server stopped');
        resolve();
      });
    });
  }

  /**
   * Get WebSocket URL
   */
  getUrl(): string {
    return `ws://localhost:${this.port}`;
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size;
  }
}

/**
 * Helper to create mock API responses
 */
export const mockApiResponse = <T>(data: T, meta?: any): any => ({
  data,
  meta
});

/**
 * Helper to create mock error responses
 */
export const mockErrorResponse = (
  code: string,
  message: string,
  statusCode: number = 400,
  details?: any
): MockResponse => ({
  status: statusCode,
  data: {
    error: {
      code,
      message,
      details
    }
  }
});

/**
 * Helper to create delayed response
 */
export const mockDelayedResponse = <T>(
  data: T,
  delay: number,
  statusCode: number = 200
): MockResponse => ({
  status: statusCode,
  data: mockApiResponse(data),
  delay
});

