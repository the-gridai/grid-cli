/**
 * Mock Phoenix WebSocket server for testing TradingGatewayClient
 * 
 * Simulates the Phoenix Channel protocol used by the Grid Trading API
 */

import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../../src/core/logging/logger';

interface PhoenixMessage {
  topic: string;
  event: string;
  payload: any;
  ref: string;
}

/**
 * Mock Phoenix Channel server for testing
 */
export class MockPhoenixServer {
  private wss: WebSocketServer;
  private port: number;
  private clients: Map<WebSocket, { authenticated: boolean; subscriptions: Set<string> }> = new Map();
  private messageHistory: PhoenixMessage[] = [];
  
  // Configurable behavior
  public authDelay: number = 0;
  public authShouldFail: boolean = false;
  public subscribeDelay: number = 0;

  constructor(port: number = 3458) {
    this.port = port;
    this.wss = new WebSocketServer({ port: this.port });
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.wss.on('connection', (ws) => {
      logger.debug('MockPhoenix: Client connected');
      this.clients.set(ws, { authenticated: false, subscriptions: new Set() });

      ws.on('message', async (data) => {
        try {
          const msg = JSON.parse(data.toString()) as PhoenixMessage;
          this.messageHistory.push(msg);
          await this.handleMessage(ws, msg);
        } catch (error) {
          logger.error('MockPhoenix: Failed to parse message', { error });
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        logger.debug('MockPhoenix: Client disconnected');
      });
    });
  }

  private async handleMessage(ws: WebSocket, msg: PhoenixMessage): Promise<void> {
    const clientState = this.clients.get(ws);
    if (!clientState) return;

    // Handle channel join
    if (msg.event === 'phx_join' && msg.topic === 'ws:trading') {
      this.sendReply(ws, msg.ref, 'ok', {});
      return;
    }

    // Handle authentication
    if (msg.event === 'authenticate') {
      if (this.authDelay > 0) {
        await this.delay(this.authDelay);
      }

      if (this.authShouldFail) {
        this.sendReply(ws, msg.ref, 'error', { reason: 'invalid_signature' });
        ws.close();
        return;
      }

      // Validate auth payload
      const { timestamp, fingerprint, signature } = msg.payload;
      if (!timestamp || !fingerprint || !signature) {
        this.sendReply(ws, msg.ref, 'error', { reason: 'invalid_payload' });
        return;
      }

      clientState.authenticated = true;
      this.sendReply(ws, msg.ref, 'ok', { status: 'ok' });
      return;
    }

    // Handle subscribe (requires auth)
    if (msg.event === 'subscribe') {
      if (!clientState.authenticated) {
        this.sendReply(ws, msg.ref, 'error', { reason: 'unauthorized' });
        return;
      }

      if (this.subscribeDelay > 0) {
        await this.delay(this.subscribeDelay);
      }

      const streams = msg.payload.streams || [];
      const results = streams.map((stream: any) => {
        const key = stream.market ? `${stream.name}:${stream.market}` : stream.name;
        clientState.subscriptions.add(key);
        return { ...stream, subscribed: true };
      });

      // Send ack (not phx_reply)
      this.sendAck(ws, 'subscribe', msg.payload.request_id, 'ok', results);
      return;
    }

    // Handle unsubscribe
    if (msg.event === 'unsubscribe') {
      if (!clientState.authenticated) {
        this.sendReply(ws, msg.ref, 'error', { reason: 'unauthorized' });
        return;
      }

      const streams = msg.payload.streams || [];
      const results = streams.map((stream: any) => {
        const key = stream.market ? `${stream.name}:${stream.market}` : stream.name;
        clientState.subscriptions.delete(key);
        return { ...stream, subscribed: false };
      });

      this.sendAck(ws, 'unsubscribe', msg.payload.request_id, 'ok', results);
      return;
    }

    // Handle heartbeat
    if (msg.event === 'heartbeat' && msg.topic === 'phoenix') {
      this.sendReply(ws, msg.ref, 'ok', {});
      return;
    }
  }

  private sendReply(ws: WebSocket, ref: string, status: string, response: any): void {
    const reply: PhoenixMessage = {
      topic: 'ws:trading',
      event: 'phx_reply',
      payload: { status, response },
      ref
    };
    ws.send(JSON.stringify(reply));
  }

  private sendAck(ws: WebSocket, action: string, requestId: string, status: string, streams: any[]): void {
    const ack: PhoenixMessage = {
      topic: 'ws:trading',
      event: 'ack',
      payload: {
        type: 'ack',
        action,
        request_id: requestId,
        status,
        streams
      },
      ref: ''
    };
    ws.send(JSON.stringify(ack));
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Broadcast an order event to subscribed clients
   */
  broadcastOrderEvent(event: 'new_order' | 'order_update', data: any): void {
    const msg: PhoenixMessage = {
      topic: 'ws:trading',
      event,
      payload: { data },
      ref: ''
    };
    const msgStr = JSON.stringify(msg);

    for (const [ws, state] of this.clients) {
      if (state.authenticated && state.subscriptions.has('user.orders')) {
        ws.send(msgStr);
      }
    }
  }

  /**
   * Broadcast a trade event to subscribed clients
   */
  broadcastTradeEvent(marketId: string, event: 'new_trade' | 'update_trade', data: any): void {
    const msg: PhoenixMessage = {
      topic: 'ws:trading',
      event,
      payload: { data },
      ref: ''
    };
    const msgStr = JSON.stringify(msg);

    for (const [ws, state] of this.clients) {
      if (state.authenticated && state.subscriptions.has(`market.trades:${marketId}`)) {
        ws.send(msgStr);
      }
    }
  }

  /**
   * Broadcast a ticker event to subscribed clients
   */
  broadcastTickerEvent(marketId: string, data: any): void {
    const msg: PhoenixMessage = {
      topic: 'ws:trading',
      event: 'market_ticker',
      payload: { market_id: marketId, ...data },
      ref: ''
    };
    const msgStr = JSON.stringify(msg);

    for (const [ws, state] of this.clients) {
      if (state.authenticated && state.subscriptions.has(`market.ticker:${marketId}`)) {
        ws.send(msgStr);
      }
    }
  }

  getMessageHistory(): PhoenixMessage[] {
    return this.messageHistory;
  }

  clearHistory(): void {
    this.messageHistory = [];
  }

  disconnectAll(): void {
    for (const ws of this.clients.keys()) {
      ws.close();
    }
    this.clients.clear();
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.disconnectAll();
      this.wss.close(() => {
        logger.debug('MockPhoenix: Server stopped');
        resolve();
      });
    });
  }

  getUrl(): string {
    return `ws://localhost:${this.port}/trading_socket/websocket?vsn=1.0.0`;
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getAuthenticatedCount(): number {
    let count = 0;
    for (const state of this.clients.values()) {
      if (state.authenticated) count++;
    }
    return count;
  }

  reset(): void {
    this.authDelay = 0;
    this.authShouldFail = false;
    this.subscribeDelay = 0;
    this.clearHistory();
  }
}
