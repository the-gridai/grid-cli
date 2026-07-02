/**
 * WebSocket Client for Grid Trading API
 *
 * Provides real-time updates for orders, trades, and market data.
 *
 * @example
 * ```typescript
 * import { GridClient, GridWebSocket } from '@the-gridai/grid-sdk';
 *
 * const client = new GridClient({ ... });
 * const ws = new GridWebSocket({
 *   wsUrl: 'wss://api.thegrid.ai/ws',
 *   signingKey: process.env.GRID_SIGNING_KEY!,
 *   fingerprint: process.env.GRID_FINGERPRINT!,
 * });
 *
 * ws.connect();
 *
 * ws.subscribeToOrders((event) => {
 *   console.log('Order update:', event);
 * });
 *
 * ws.subscribeToTrades((event) => {
 *   console.log('Trade:', event);
 * });
 * ```
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { WebSocketError } from './errors.js';
import type {
  Logger,
  ConnectionState,
  WSConfig,
  WSMessage,
  OrderEvent,
  TradeEvent,
  TickerEvent,
} from './types/index.js';
import { ConnectionState as ConnState } from './types/index.js';

/**
 * WebSocket client configuration
 */
export interface GridWebSocketConfig {
  /** WebSocket URL */
  wsUrl: string;
  /** Ed25519 signing key (base64 encoded) */
  signingKey: string;
  /** Signing key fingerprint */
  fingerprint: string;
  /** Optional logger */
  logger?: Logger;
  /** Reconnection delay in ms (default: 1000) */
  reconnectDelay?: number;
  /** Maximum reconnection delay in ms (default: 30000) */
  maxReconnectDelay?: number;
  /** Maximum reconnection attempts (default: 10) */
  maxReconnectAttempts?: number;
  /** Heartbeat interval in ms (default: 30000) */
  heartbeatInterval?: number;
  /** Heartbeat timeout in ms (default: 5000) */
  heartbeatTimeout?: number;
}

/**
 * Default WebSocket configuration
 */
const DEFAULT_WS_CONFIG: WSConfig = {
  reconnectDelay: 1000,
  maxReconnectDelay: 30000,
  maxReconnectAttempts: 10,
  heartbeatInterval: 30000,
  heartbeatTimeout: 5000,
};

type OrderCallback = (event: OrderEvent) => void;
type TradeCallback = (event: TradeEvent) => void;
type TickerCallback = (event: TickerEvent) => void;

/**
 * Grid WebSocket Client
 *
 * Provides real-time streaming data from the Grid Trading API with
 * automatic reconnection, heartbeat monitoring, and event-based API.
 *
 * @fires connected - Emitted when connection is established
 * @fires disconnected - Emitted when connection is lost
 * @fires message - Emitted when any message is received
 * @fires error - Emitted when an error occurs
 * @fires reconnecting - Emitted when reconnection is attempted
 * @fires order - Emitted when an order event is received
 * @fires trade - Emitted when a trade event is received
 * @fires ticker - Emitted when a ticker event is received
 */
export class GridWebSocket extends EventEmitter {
  private ws: WebSocket | null = null;
  private state: ConnectionState = ConnState.DISCONNECTED;
  private logger?: Logger;
  private config: WSConfig;
  private wsUrl: string;

  private reconnectAttempts = 0;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private heartbeatInterval?: ReturnType<typeof setInterval>;
  private heartbeatTimeout?: ReturnType<typeof setTimeout>;

  private messageQueue: WSMessage[] = [];
  private shouldReconnect = true;

  private orderCallbacks: Set<OrderCallback> = new Set();
  private tradeCallbacks: Set<TradeCallback> = new Set();
  private tickerCallbacks: Map<string, Set<TickerCallback>> = new Map();

  /**
   * Create a new GridWebSocket instance
   */
  constructor(options: GridWebSocketConfig) {
    super();
    this.wsUrl = options.wsUrl;
    this.logger = options.logger;
    this.config = {
      ...DEFAULT_WS_CONFIG,
      reconnectDelay: options.reconnectDelay ?? DEFAULT_WS_CONFIG.reconnectDelay,
      maxReconnectDelay: options.maxReconnectDelay ?? DEFAULT_WS_CONFIG.maxReconnectDelay,
      maxReconnectAttempts:
        options.maxReconnectAttempts ?? DEFAULT_WS_CONFIG.maxReconnectAttempts,
      heartbeatInterval: options.heartbeatInterval ?? DEFAULT_WS_CONFIG.heartbeatInterval,
      heartbeatTimeout: options.heartbeatTimeout ?? DEFAULT_WS_CONFIG.heartbeatTimeout,
    };

    // Auth is available for future use if WebSocket needs signing
    // For now, authentication happens at connection time via URL params or headers

    this.logger?.debug('GridWebSocket initialized', { url: this.wsUrl });
  }

  /**
   * Connect to WebSocket server
   */
  public connect(url?: string): void {
    if (url) {
      this.wsUrl = url;
    }

    if (this.state === ConnState.CONNECTING || this.state === ConnState.CONNECTED) {
      this.logger?.warn('WebSocket already connecting or connected');
      return;
    }

    this.setState(ConnState.CONNECTING);
    this.logger?.info('Connecting to WebSocket', { url: this.wsUrl });

    try {
      this.ws = new WebSocket(this.wsUrl);
      this.setupEventHandlers();
    } catch (error) {
      this.logger?.error('Failed to create WebSocket connection', { error });
      this.handleDisconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    this.logger?.info('Disconnecting WebSocket');
    this.shouldReconnect = false;
    this.cleanup();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setState(ConnState.DISCONNECTED);
  }

  /**
   * Send a message through WebSocket
   */
  public send(message: WSMessage, queueIfDisconnected: boolean = true): void {
    if (this.state === ConnState.CONNECTED && this.ws) {
      try {
        this.ws.send(JSON.stringify(message));
        this.logger?.debug('WebSocket message sent', { type: message.type });
      } catch (error) {
        this.logger?.error('Failed to send WebSocket message', { error, message });

        if (queueIfDisconnected) {
          this.queueMessage(message);
        }
      }
    } else if (queueIfDisconnected) {
      this.queueMessage(message);
    } else {
      this.logger?.warn('Cannot send message: WebSocket not connected', {
        state: this.state,
        messageType: message.type,
      });
    }
  }

  /**
   * Subscribe to order events
   */
  public subscribeToOrders(callback: OrderCallback): () => void {
    this.orderCallbacks.add(callback);

    // Send subscription message if connected
    if (this.state === ConnState.CONNECTED) {
      this.send({ type: 'subscribe', data: { channel: 'orders' } });
    }

    // Return unsubscribe function
    return () => {
      this.orderCallbacks.delete(callback);
      if (this.orderCallbacks.size === 0 && this.state === ConnState.CONNECTED) {
        this.send({ type: 'unsubscribe', data: { channel: 'orders' } });
      }
    };
  }

  /**
   * Subscribe to trade events
   */
  public subscribeToTrades(callback: TradeCallback): () => void {
    this.tradeCallbacks.add(callback);

    if (this.state === ConnState.CONNECTED) {
      this.send({ type: 'subscribe', data: { channel: 'trades' } });
    }

    return () => {
      this.tradeCallbacks.delete(callback);
      if (this.tradeCallbacks.size === 0 && this.state === ConnState.CONNECTED) {
        this.send({ type: 'unsubscribe', data: { channel: 'trades' } });
      }
    };
  }

  /**
   * Subscribe to ticker events for a specific market
   */
  public subscribeToTicker(marketId: string, callback: TickerCallback): () => void {
    if (!this.tickerCallbacks.has(marketId)) {
      this.tickerCallbacks.set(marketId, new Set());
    }
    this.tickerCallbacks.get(marketId)!.add(callback);

    if (this.state === ConnState.CONNECTED) {
      this.send({ type: 'subscribe', data: { channel: 'ticker', market_id: marketId } });
    }

    return () => {
      const callbacks = this.tickerCallbacks.get(marketId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.tickerCallbacks.delete(marketId);
          if (this.state === ConnState.CONNECTED) {
            this.send({ type: 'unsubscribe', data: { channel: 'ticker', market_id: marketId } });
          }
        }
      }
    };
  }

  /**
   * Get current connection state
   */
  public getState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.state === ConnState.CONNECTED;
  }

  /**
   * Get connection statistics
   */
  public getStats() {
    return {
      state: this.state,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
      shouldReconnect: this.shouldReconnect,
      subscriptions: {
        orders: this.orderCallbacks.size > 0,
        trades: this.tradeCallbacks.size > 0,
        tickers: Array.from(this.tickerCallbacks.keys()),
      },
    };
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.on('open', () => {
      this.logger?.info('WebSocket connected');
      this.setState(ConnState.CONNECTED);
      this.reconnectAttempts = 0;

      this.emit('connected');
      this.setupHeartbeat();
      this.resubscribeAll();
      this.processMessageQueue();
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        let str: string;
        if (data instanceof Buffer) {
          str = data.toString('utf8');
        } else if (Array.isArray(data)) {
          str = Buffer.concat(data).toString('utf8');
        } else {
          str = data.toString();
        }

        const message = JSON.parse(str) as WSMessage;
        this.logger?.debug('WebSocket message received', { type: message.type });

        // Handle pong responses
        if (message.type === 'pong') {
          this.handlePong();
          return;
        }

        // Route messages to appropriate handlers
        this.routeMessage(message);

        this.emit('message', message);
      } catch (error) {
        this.logger?.error('Failed to parse WebSocket message', { error, data: data.toString() });
      }
    });

    this.ws.on('error', (error) => {
      this.logger?.error('WebSocket error', { error });
      this.emit('error', new WebSocketError(error.message));
    });

    this.ws.on('close', (code, reason) => {
      this.logger?.warn('WebSocket closed', { code, reason: reason.toString() });
      this.handleDisconnect();
    });

    this.ws.on('pong', () => {
      this.handlePong();
    });
  }

  /**
   * Route incoming messages to appropriate callbacks
   */
  private routeMessage(message: WSMessage): void {
    const type = message.type;

    // Order events
    if (
      type === 'order_created' ||
      type === 'order_updated' ||
      type === 'order_filled' ||
      type === 'order_cancelled'
    ) {
      const event = message as unknown as OrderEvent;
      this.orderCallbacks.forEach((cb) => cb(event));
      this.emit('order', event);
      return;
    }

    // Trade events
    if (type === 'trade') {
      const event = message as unknown as TradeEvent;
      this.tradeCallbacks.forEach((cb) => cb(event));
      this.emit('trade', event);
      return;
    }

    // Ticker events
    if (type === 'ticker') {
      const event = message as unknown as TickerEvent;
      const marketId = event.market_id;
      const callbacks = this.tickerCallbacks.get(marketId);
      if (callbacks) {
        callbacks.forEach((cb) => cb(event));
      }
      this.emit('ticker', event);
      return;
    }
  }

  /**
   * Resubscribe to all active subscriptions after reconnect
   */
  private resubscribeAll(): void {
    if (this.orderCallbacks.size > 0) {
      this.send({ type: 'subscribe', data: { channel: 'orders' } });
    }
    if (this.tradeCallbacks.size > 0) {
      this.send({ type: 'subscribe', data: { channel: 'trades' } });
    }
    for (const marketId of this.tickerCallbacks.keys()) {
      this.send({ type: 'subscribe', data: { channel: 'ticker', market_id: marketId } });
    }
  }

  /**
   * Setup heartbeat mechanism
   */
  private setupHeartbeat(): void {
    this.clearHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      if (this.state === ConnState.CONNECTED && this.ws) {
        try {
          this.ws.ping();
          this.logger?.debug('WebSocket ping sent');

          this.heartbeatTimeout = setTimeout(() => {
            this.logger?.warn('WebSocket heartbeat timeout - no pong received');
            this.handleDisconnect();
          }, this.config.heartbeatTimeout);
        } catch (error) {
          this.logger?.error('Failed to send heartbeat ping', { error });
          this.handleDisconnect();
        }
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Handle pong response
   */
  private handlePong(): void {
    this.logger?.debug('WebSocket pong received');

    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = undefined;
    }
  }

  /**
   * Clear heartbeat timers
   */
  private clearHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }

    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = undefined;
    }
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(): void {
    this.cleanup();

    const wasConnected = this.state === ConnState.CONNECTED;
    this.setState(ConnState.DISCONNECTED);

    if (wasConnected) {
      this.emit('disconnected');
    }

    if (this.shouldReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.logger?.error('Max reconnection attempts reached', {
        attempts: this.reconnectAttempts,
        max: this.config.maxReconnectAttempts,
      });
      this.setState(ConnState.FAILED);
      this.emit('failed');
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectAttempts++;
    const delay = this.calculateReconnectDelay();

    this.setState(ConnState.RECONNECTING);
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    this.logger?.info('Scheduling reconnection', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.config.maxReconnectAttempts,
      delay,
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, delay);
  }

  /**
   * Calculate reconnection delay with exponential backoff
   */
  private calculateReconnectDelay(): number {
    const exponentialDelay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    const jitter = Math.random() * 1000;
    return Math.min(exponentialDelay + jitter, this.config.maxReconnectDelay);
  }

  /**
   * Queue message for later sending
   */
  private queueMessage(message: WSMessage): void {
    this.messageQueue.push(message);
    this.logger?.debug('Message queued', {
      type: message.type,
      queueSize: this.messageQueue.length,
    });

    if (this.messageQueue.length > 100) {
      this.messageQueue.shift();
      this.logger?.warn('Message queue full, dropping oldest message');
    }
  }

  /**
   * Process queued messages
   */
  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) {
      return;
    }

    this.logger?.info('Processing queued messages', { count: this.messageQueue.length });

    const messages = [...this.messageQueue];
    this.messageQueue = [];

    for (const message of messages) {
      this.send(message, false);
    }
  }

  /**
   * Set connection state
   */
  private setState(state: ConnectionState): void {
    const previousState = this.state;
    this.state = state;

    if (previousState !== state) {
      this.logger?.debug('WebSocket state changed', {
        from: previousState,
        to: state,
      });
      this.emit('stateChange', { from: previousState, to: state });
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.clearHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }
}
