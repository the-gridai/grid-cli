/**
 * Trading Gateway WebSocket Client
 * 
 * Connects to the Grid Trading API WebSocket for real-time events:
 * - user.orders: Order creation, updates, fills
 * - market.trades: Trade executions
 * - market.ticker: Price updates
 * 
 * Uses Phoenix Channel protocol for communication.
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { getConfig, getConfigForProfile } from '../../core/config/config';
import { logger } from '../../core/logging/logger';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

import { decodeBase64Lenient } from '../../core/utils/base64';

/**
 * Connection state
 */
export enum GatewayState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  AUTHENTICATING = 'authenticating',
  AUTHENTICATED = 'authenticated',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed'
}

/**
 * Stream types
 */
export type StreamType = 'user.orders' | 'market.trades' | 'market.ticker';

/**
 * Stream definition
 */
export interface StreamDef {
  name: StreamType;
  market?: string;
}

/**
 * Order event from WebSocket
 */
export interface OrderEvent {
  event: 'new_order' | 'order_update';
  data: {
    order_id: string;
    client_order_id?: string;
    market_id: string;
    trading_account_id: string;
    side: 'buy' | 'sell';
    order_type: string;
    status: string;
    original_quantity: string;
    remaining_quantity: string;
    filled_quantity: string;
    price: string;
    average_fill_price?: string;
    created_at: string;
    updated_at?: string;
  };
}

/**
 * Trade event from WebSocket
 */
export interface TradeEvent {
  event: 'new_trade' | 'update_trade';
  data: {
    trade_id: string;
    market_id: string;
    price: string;
    quantity: string;
    side: 'buy' | 'sell';
    executed_at: string;
    maker_order_id?: string;
    taker_order_id?: string;
  };
}

/**
 * Ticker event from WebSocket
 */
export interface TickerEvent {
  event: 'market_ticker';
  data: {
    market_id: string;
    last_price: string;
    bid: string;
    ask: string;
    volume_24h: string;
  };
}

/**
 * Phoenix message format (v1.0.0 - map format)
 */
interface PhoenixMessage {
  topic: string;
  event: string;
  payload: any;
  ref: string;
}

/**
 * Trading Gateway Client
 * 
 * @fires connected - Connection established
 * @fires authenticated - Authentication successful
 * @fires disconnected - Connection lost
 * @fires order - Order event received
 * @fires trade - Trade event received
 * @fires ticker - Ticker event received
 * @fires error - Error occurred
 */
export class TradingGatewayClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private state: GatewayState = GatewayState.DISCONNECTED;
  private connectionPromise: Promise<void> | null = null;
  private static instance: TradingGatewayClient;
  private static profileInstances: Map<string, TradingGatewayClient> = new Map();
  
  private wsUrl: string;
  private profileName?: string;
  private refCounter = 0;
  private joinRef: string | null = null;
  private heartbeatInterval?: NodeJS.Timeout;
  private pendingReplies: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();
  private subscribedStreams: Set<string> = new Set();
  
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer?: NodeJS.Timeout;
  private heartbeatTimeout?: NodeJS.Timeout;
  private shouldReconnect = true;
  
  // Track pending ack requests by request_id
  private pendingAcks: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();
  
  // Cache latest ticker data per market for pricing strategies
  private tickerCache: Map<string, { lastPrice: string; bid: string; ask: string; updatedAt: Date }> = new Map();

  private static withDefaultVsn(url: string): string {
    return /[?&]vsn=/.test(url) ? url : `${url}${url.includes('?') ? '&' : '?'}vsn=1.0.0`;
  }

  private static normalizeGatewayWsUrl(rawWsUrl: string): string {
    const wsUrl = (rawWsUrl || '').trim();

    try {
      const parsed = new URL(wsUrl);
      const pathname = parsed.pathname || '';
      const normalizedPath = pathname.replace(/\/+$/, '');

      // Legacy short form: /ws -> rewrite to Phoenix socket path.
      if (normalizedPath === '/ws') {
        parsed.pathname = '/trading_socket/websocket';
        return TradingGatewayClient.withDefaultVsn(parsed.toString());
      }

      // Full Phoenix endpoint already provided.
      if (normalizedPath === '/trading_socket/websocket') {
        return TradingGatewayClient.withDefaultVsn(parsed.toString());
      }

      // Explicit endpoint (e.g. /v1/) should be used as-is.
      return parsed.toString();
    } catch {
      // Best-effort fallback for non-standard inputs.
      if (wsUrl.includes('/trading_socket/websocket')) {
        const base = wsUrl.split('?')[0];
        return TradingGatewayClient.withDefaultVsn(base);
      }
      if (wsUrl.includes('/ws')) {
        return TradingGatewayClient.withDefaultVsn(wsUrl.replace('/ws', '/trading_socket/websocket'));
      }
      return wsUrl;
    }
  }

  private constructor(profileName?: string) {
    super();
    this.profileName = profileName;
    const config = profileName ? getConfigForProfile(profileName) : getConfig();

    this.wsUrl = TradingGatewayClient.normalizeGatewayWsUrl(config.WS_URL);

    // Add a default error listener so unhandled WS errors don't crash the process
    this.on('error', (err) => {
      logger.error('TradingGatewayClient unhandled error', { error: err?.message || err });
    });

    logger.debug('TradingGatewayClient initialized', { url: this.wsUrl, profile: profileName });
  }

  /**
   * Get singleton instance (default, no profile)
   */
  public static getInstance(): TradingGatewayClient {
    if (!TradingGatewayClient.instance) {
      TradingGatewayClient.instance = new TradingGatewayClient();
    }
    return TradingGatewayClient.instance;
  }

  /**
   * Get instance for a specific profile (for multi-strategy credential isolation)
   */
  public static getInstanceForProfile(profileName: string): TradingGatewayClient {
    if (!TradingGatewayClient.profileInstances.has(profileName)) {
      TradingGatewayClient.profileInstances.set(profileName, new TradingGatewayClient(profileName));
    }
    return TradingGatewayClient.profileInstances.get(profileName)!;
  }

  /**
   * Reset singleton instance (for per-strategy credentials)
   */
  public static resetInstance(): void {
    if (TradingGatewayClient.instance) {
      // Disconnect existing instance before resetting
      TradingGatewayClient.instance.disconnect();
      TradingGatewayClient.instance = undefined as unknown as TradingGatewayClient;
    }
  }

  /**
   * Reset all instances (for testing)
   */
  public static resetAllInstances(): void {
    TradingGatewayClient.resetInstance();
    TradingGatewayClient.profileInstances.forEach(instance => instance.disconnect());
    TradingGatewayClient.profileInstances.clear();
  }

  /**
   * Connect and authenticate
   */
  public async connect(): Promise<void> {
    // If already connected, return immediately
    if (this.state === GatewayState.AUTHENTICATED) {
      logger.debug('TradingGateway already authenticated');
      return;
    }

    // If connection in progress, wait for it to complete
    if (this.connectionPromise) {
      logger.debug('TradingGateway connection already in progress, waiting...');
      return this.connectionPromise;
    }

    // Start new connection
    this.setState(GatewayState.CONNECTING);
    
    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl, {
          rejectUnauthorized: process.env.NODE_ENV !== 'development',
          headers: { 'User-Agent': 'grid-cli/1.0' },
        });
        
        this.ws.on('open', async () => {
          logger.info('TradingGateway WebSocket connected');
          this.setState(GatewayState.CONNECTED);
          this.reconnectAttempts = 0;
          
          try {
            // Join the channel
            await this.joinChannel();
            
            // Authenticate
            await this.authenticate();
            
            this.startHeartbeat();
            this.emit('connected');
            this.connectionPromise = null;
            resolve();
          } catch (error) {
            this.connectionPromise = null;
            reject(error);
          }
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data);
        });

        this.ws.on('error', (error) => {
          logger.error('TradingGateway WebSocket error', { error });
          this.emit('error', error);
        });

        this.ws.on('close', (code, reason) => {
          logger.warn('TradingGateway WebSocket closed', { code, reason: reason.toString() });
          this.handleDisconnect();
        });

      } catch (error) {
        logger.error('Failed to create TradingGateway connection', { error });
        this.connectionPromise = null;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  /**
   * Join the Phoenix channel
   */
  private async joinChannel(): Promise<void> {
    const ref = this.nextRef();
    this.joinRef = ref;
    
    return this.sendAndWait({
      topic: 'ws:trading',
      event: 'phx_join',
      payload: {},
      ref
    });
  }

  /**
   * Authenticate with signature
   */
  private async authenticate(): Promise<void> {
    this.setState(GatewayState.AUTHENTICATING);
    
    // Use profile-specific config if this instance was created for a profile
    const config = this.profileName ? getConfigForProfile(this.profileName) : getConfig();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    // Support both naming conventions
    const fingerprint = config.API_KEY_FINGERPRINT || (config as any).SIGNING_KEY_FINGERPRINT;
    const privateKey = config.PRIVATE_KEY || (config as any).SIGNING_KEY;
    
    if (!fingerprint || !privateKey) {
      throw new Error('Missing API credentials for WebSocket authentication (SIGNING_KEY/SIGNING_KEY_FINGERPRINT or PRIVATE_KEY/API_KEY_FINGERPRINT required)');
    }
    
    // Sign timestamp + fingerprint
    const message = timestamp + fingerprint;
    const messageBytes = naclUtil.decodeUTF8(message);
    
    // Decode the private key - it may be a 32-byte seed or 64-byte full key
    let secretKeyBytes = decodeBase64Lenient(privateKey);
    
    // If it's a 32-byte seed, derive the full keypair
    if (secretKeyBytes.length === 32) {
      const keyPair = nacl.sign.keyPair.fromSeed(secretKeyBytes);
      secretKeyBytes = keyPair.secretKey;
    }
    
    const signature = nacl.sign.detached(messageBytes, secretKeyBytes);
    const signatureBase64 = naclUtil.encodeBase64(signature);
    
    const ref = this.nextRef();
    
    await this.sendAndWait({
      topic: 'ws:trading',
      event: 'authenticate',
      payload: {
        timestamp,
        fingerprint,
        signature: signatureBase64
      },
      ref
    });
    
    this.setState(GatewayState.AUTHENTICATED);
    logger.info('TradingGateway authenticated');
    this.emit('authenticated');
  }

  /**
   * Subscribe to streams
   */
  public async subscribe(streams: StreamDef[]): Promise<void> {
    if (this.state !== GatewayState.AUTHENTICATED) {
      throw new Error('Must be authenticated to subscribe');
    }

    const requestId = `req-${Date.now()}`;
    const ref = this.nextRef();
    
    const formattedStreams = streams.map(s => ({
      name: s.name,
      ...(s.market && { market: s.market })
    }));
    
    // Send and wait for ack (not phx_reply)
    await this.sendAndWaitForAck(requestId, {
      topic: 'ws:trading',
      event: 'subscribe',
      payload: {
        streams: formattedStreams,
        request_id: requestId
      },
      ref
    });

    // Track subscribed streams
    for (const stream of streams) {
      const key = stream.market ? `${stream.name}:${stream.market}` : stream.name;
      this.subscribedStreams.add(key);
    }
    
    logger.info('TradingGateway subscribed to streams', { streams: formattedStreams });
  }

  /**
   * Unsubscribe from streams
   */
  public async unsubscribe(streams: StreamDef[]): Promise<void> {
    if (this.state !== GatewayState.AUTHENTICATED) {
      return;
    }

    const requestId = `req-${Date.now()}`;
    const ref = this.nextRef();
    
    const formattedStreams = streams.map(s => ({
      name: s.name,
      ...(s.market && { market: s.market })
    }));
    
    // Send and wait for ack (not phx_reply)
    await this.sendAndWaitForAck(requestId, {
      topic: 'ws:trading',
      event: 'unsubscribe',
      payload: {
        streams: formattedStreams,
        request_id: requestId
      },
      ref
    });

    // Remove from tracked streams
    for (const stream of streams) {
      const key = stream.market ? `${stream.name}:${stream.market}` : stream.name;
      this.subscribedStreams.delete(key);
    }
    
    logger.info('TradingGateway unsubscribed from streams', { streams: formattedStreams });
  }

  /**
   * Disconnect
   */
  public disconnect(): void {
    this.shouldReconnect = false;
    this.cleanup();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.setState(GatewayState.DISCONNECTED);
    logger.info('TradingGateway disconnected');
  }

  /**
   * Get current state
   */
  public getState(): GatewayState {
    return this.state;
  }

  /**
   * Check if authenticated
   */
  public isAuthenticated(): boolean {
    return this.state === GatewayState.AUTHENTICATED;
  }

  /**
   * Get cached ticker for a market (from WebSocket updates)
   * Returns null if no ticker data available
   */
  public getCachedTicker(marketId: string): { lastPrice: string; bid: string; ask: string; updatedAt: Date } | null {
    return this.tickerCache.get(marketId) || null;
  }

  /**
   * Check if ticker cache is fresh (within maxAgeMs)
   */
  public isTickerFresh(marketId: string, maxAgeMs: number = 60000): boolean {
    const cached = this.tickerCache.get(marketId);
    if (!cached) return false;
    return (Date.now() - cached.updatedAt.getTime()) < maxAgeMs;
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const str = data instanceof Buffer ? data.toString('utf8') : data.toString();
      const msg = JSON.parse(str) as PhoenixMessage;
      
      logger.debug('TradingGateway message received', { event: msg.event, topic: msg.topic });

      // Handle Phoenix replies
      if (msg.event === 'phx_reply') {
        this.handleReply(msg);
        return;
      }

      // Handle heartbeat
      if (msg.event === 'phx_close') {
        this.handleDisconnect();
        return;
      }

      // Handle order events
      if (msg.event === 'new_order' || msg.event === 'order_update') {
        const orderEvent: OrderEvent = {
          event: msg.event as 'new_order' | 'order_update',
          data: msg.payload.data
        };
        this.emit('order', orderEvent);
        return;
      }

      // Handle trade events
      if (msg.event === 'new_trade' || msg.event === 'update_trade') {
        const tradeEvent: TradeEvent = {
          event: msg.event as 'new_trade' | 'update_trade',
          data: msg.payload.data
        };
        this.emit('trade', tradeEvent);
        return;
      }

      // Handle ticker events
      if (msg.event === 'market_ticker') {
        const tickerData = msg.payload;
        
        // Cache the ticker data for pricing strategies
        if (tickerData.market_id) {
          this.tickerCache.set(tickerData.market_id, {
            lastPrice: tickerData.last_price || '0',
            bid: tickerData.bid || '0',
            ask: tickerData.ask || '0',
            updatedAt: new Date()
          });
        }
        
        const tickerEvent: TickerEvent = {
          event: 'market_ticker',
          data: tickerData
        };
        this.emit('ticker', tickerEvent);
        return;
      }

      // Handle ack messages (subscription confirmations)
      if (msg.event === 'ack') {
        this.handleAck(msg);
        return;
      }

    } catch (error) {
      logger.error('Failed to parse TradingGateway message', { error, data: data.toString() });
    }
  }

  /**
   * Handle Phoenix reply
   */
  private handleReply(msg: PhoenixMessage): void {
    // Any phx_reply (including heartbeat replies) proves the connection is alive
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = undefined;
    }

    const pending = this.pendingReplies.get(msg.ref);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingReplies.delete(msg.ref);
      
      if (msg.payload.status === 'ok') {
        pending.resolve(msg.payload.response);
      } else {
        pending.reject(new Error(msg.payload.response?.reason || 'Unknown error'));
      }
    }
  }

  /**
   * Handle ack messages (subscribe/unsubscribe confirmations)
   */
  private handleAck(msg: PhoenixMessage): void {
    const requestId = msg.payload?.request_id;
    if (!requestId) {
      logger.debug('TradingGateway ack received without request_id', { payload: msg.payload });
      return;
    }
    
    const pending = this.pendingAcks.get(requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingAcks.delete(requestId);
      
      const status = msg.payload?.status;
      if (status === 'ok' || status === 'partial') {
        pending.resolve(msg.payload);
      } else {
        pending.reject(new Error(`Subscription failed: ${status}`));
      }
    }
    
    logger.debug('TradingGateway ack received', { 
      requestId, 
      action: msg.payload?.action,
      status: msg.payload?.status,
      streams: msg.payload?.streams?.length 
    });
  }

  /**
   * Send message and wait for reply (for phx_reply responses)
   */
  private sendAndWait(msg: PhoenixMessage, timeoutMs: number = 10000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(msg.ref);
        reject(new Error(`Timeout waiting for reply to ${msg.event}`));
      }, timeoutMs);
      
      this.pendingReplies.set(msg.ref, { resolve, reject, timeout });
      this.send(msg);
    });
  }

  /**
   * Send message and wait for ack (for subscribe/unsubscribe)
   */
  private sendAndWaitForAck(requestId: string, msg: PhoenixMessage, timeoutMs: number = 10000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingAcks.delete(requestId);
        reject(new Error(`Timeout waiting for ack to ${msg.event}`));
      }, timeoutMs);
      
      this.pendingAcks.set(requestId, { resolve, reject, timeout });
      this.send(msg);
    });
  }

  /**
   * Send message
   */
  private send(msg: PhoenixMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    
    this.ws.send(JSON.stringify(msg));
    logger.debug('TradingGateway message sent', { event: msg.event });
  }

  /**
   * Get next reference number
   */
  private nextRef(): string {
    return String(++this.refCounter);
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const ref = this.nextRef();
        this.send({
          topic: 'phoenix',
          event: 'heartbeat',
          payload: {},
          ref
        });
        
        this.heartbeatTimeout = setTimeout(() => {
          logger.warn('TradingGateway heartbeat timeout — no reply received, reconnecting');
          this.handleDisconnect();
        }, 10000);
      }
    }, 30000);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
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
   * Handle disconnect
   */
  private handleDisconnect(): void {
    this.cleanup();
    
    this.setState(GatewayState.DISCONNECTED);
    
    this.emit('disconnected');

    if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('TradingGateway max reconnection attempts reached');
      this.setState(GatewayState.FAILED);
    }
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    this.setState(GatewayState.RECONNECTING);
    logger.info('TradingGateway scheduling reconnect', { attempt: this.reconnectAttempts, delay });
    
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = undefined;
      
      try {
        await this.connect();
        
        // Re-subscribe to previous streams
        if (this.subscribedStreams.size > 0) {
          const streams: StreamDef[] = Array.from(this.subscribedStreams).map(key => {
            const [name, market] = key.split(':');
            return { name: name as StreamType, ...(market && { market }) };
          });
          await this.subscribe(streams);
        }
      } catch (error) {
        logger.error('TradingGateway reconnect failed', { error });
        this.handleDisconnect();
      }
    }, delay);
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.stopHeartbeat();
    this.connectionPromise = null;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    // Clean up old WebSocket to prevent listener leaks
    if (this.ws) {
      try { this.ws.removeAllListeners(); this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
    
    // Reject all pending replies
    for (const [, pending] of this.pendingReplies) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
    }
    this.pendingReplies.clear();
    
    // Reject all pending acks
    for (const [, pending] of this.pendingAcks) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
    }
    this.pendingAcks.clear();
  }

  /**
   * Set state
   */
  private setState(state: GatewayState): void {
    const prev = this.state;
    this.state = state;
    
    if (prev !== state) {
      logger.debug('TradingGateway state changed', { from: prev, to: state });
    }
  }
}
