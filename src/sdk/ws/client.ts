/**
 * WebSocket Client with automatic reconnection and heartbeat
 * 
 * Production-ready WebSocket client with:
 * - Automatic reconnection with exponential backoff
 * - Ping/pong heartbeat monitoring
 * - Connection state management
 * - Message queue for offline periods
 * - Event-based API
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { getConfig } from '../../core/config/config';
import { logger } from '../../core/logging/logger';

/**
 * Connection state enum
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed'
}

/**
 * WebSocket message types
 */
export interface WSMessage {
  type: string;
  data: any;
  timestamp?: string;
}

/**
 * WebSocket configuration
 */
export interface WSConfig {
  reconnectDelay: number;
  maxReconnectDelay: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  heartbeatTimeout: number;
}

/**
 * Default WebSocket configuration
 */
const DEFAULT_WS_CONFIG: WSConfig = {
  reconnectDelay: 1000,
  maxReconnectDelay: 30000,
  maxReconnectAttempts: 10,
  heartbeatInterval: 30000, // 30 seconds
  heartbeatTimeout: 5000,   // 5 seconds
};

/**
 * WebSocket Client with resilience features
 * 
 * @fires connected - Emitted when connection is established
 * @fires disconnected - Emitted when connection is lost
 * @fires message - Emitted when a message is received
 * @fires error - Emitted when an error occurs
 * @fires reconnecting - Emitted when reconnection is attempted
 */
export class WebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private static instance: WebSocketClient;
  
  private reconnectAttempts = 0;
  private reconnectTimer?: NodeJS.Timeout;
  private heartbeatInterval?: NodeJS.Timeout;
  private heartbeatTimeout?: NodeJS.Timeout;
  
  private messageQueue: WSMessage[] = [];
  private config: WSConfig;
  private wsUrl: string;
  private shouldReconnect = true;

  private constructor() {
    super();
    this.config = DEFAULT_WS_CONFIG;
    this.wsUrl = getConfig().WS_URL;
    
    logger.debug('WebSocket client initialized', { url: this.wsUrl });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): WebSocketClient {
    if (!WebSocketClient.instance) {
      WebSocketClient.instance = new WebSocketClient();
    }
    return WebSocketClient.instance;
  }

  /**
   * Connect to WebSocket server
   * 
   * @param url - Optional WebSocket URL (uses config default if not provided)
   */
  public connect(url?: string): void {
    if (url) {
      this.wsUrl = url;
    }

    if (this.state === ConnectionState.CONNECTING || this.state === ConnectionState.CONNECTED) {
      logger.warn('WebSocket already connecting or connected');
      return;
    }

    this.setState(ConnectionState.CONNECTING);
    logger.info('Connecting to WebSocket', { url: this.wsUrl });

    try {
      this.ws = new WebSocket(this.wsUrl);
      this.setupEventHandlers();
    } catch (error) {
      logger.error('Failed to create WebSocket connection', { error });
      this.handleDisconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    logger.info('Disconnecting WebSocket');
    this.shouldReconnect = false;
    this.cleanup();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.setState(ConnectionState.DISCONNECTED);
  }

  /**
   * Send a message through WebSocket
   * 
   * @param message - Message to send
   * @param queueIfDisconnected - Queue message if disconnected (default: true)
   */
  public send(message: WSMessage, queueIfDisconnected: boolean = true): void {
    if (this.state === ConnectionState.CONNECTED && this.ws) {
      try {
        this.ws.send(JSON.stringify(message));
        logger.debug('WebSocket message sent', { type: message.type });
      } catch (error) {
        logger.error('Failed to send WebSocket message', { error, message });
        
        if (queueIfDisconnected) {
          this.queueMessage(message);
        }
      }
    } else if (queueIfDisconnected) {
      this.queueMessage(message);
    } else {
      logger.warn('Cannot send message: WebSocket not connected', {
        state: this.state,
        messageType: message.type
      });
    }
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
    return this.state === ConnectionState.CONNECTED;
  }

  /**
   * Update WebSocket configuration
   */
  public updateConfig(config: Partial<WSConfig>): void {
    this.config = { ...this.config, ...config };
    logger.debug('WebSocket config updated', config);
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.on('open', () => {
      logger.info('WebSocket connected');
      this.setState(ConnectionState.CONNECTED);
      this.reconnectAttempts = 0;
      
      this.emit('connected');
      this.setupHeartbeat();
      this.processMessageQueue();
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        // Convert Buffer or other data types to string
        let str: string;
        if (data instanceof Buffer) {
          str = data.toString('utf8');
        } else if (Array.isArray(data)) {
          str = Buffer.concat(data).toString('utf8');
        } else {
          str = data.toString();
        }
        
        const message = JSON.parse(str) as WSMessage;
        logger.debug('WebSocket message received', { type: message.type });
        
        // Handle pong responses
        if (message.type === 'pong') {
          this.handlePong();
          return;
        }
        
        this.emit('message', message);
      } catch (error) {
        logger.error('Failed to parse WebSocket message', { error, data: data.toString() });
      }
    });

    this.ws.on('error', (error) => {
      logger.error('WebSocket error', { error });
      this.emit('error', error);
    });

    this.ws.on('close', (code, reason) => {
      logger.warn('WebSocket closed', { code, reason: reason.toString() });
      this.handleDisconnect();
    });

    this.ws.on('pong', () => {
      this.handlePong();
    });
  }

  /**
   * Setup heartbeat mechanism
   */
  private setupHeartbeat(): void {
    this.clearHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      if (this.state === ConnectionState.CONNECTED && this.ws) {
        try {
          // Send ping
          this.ws.ping();
          logger.debug('WebSocket ping sent');
          
          // Set timeout for pong response
          this.heartbeatTimeout = setTimeout(() => {
            logger.warn('WebSocket heartbeat timeout - no pong received');
            this.handleDisconnect();
          }, this.config.heartbeatTimeout);
          
        } catch (error) {
          logger.error('Failed to send heartbeat ping', { error });
          this.handleDisconnect();
        }
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Handle pong response
   */
  private handlePong(): void {
    logger.debug('WebSocket pong received');
    
    // Clear the heartbeat timeout
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

    // Close the old socket to prevent stale connections
    if (this.ws) {
      try { this.ws.removeAllListeners(); this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
    
    const wasConnected = this.state === ConnectionState.CONNECTED;
    this.setState(ConnectionState.DISCONNECTED);
    
    if (wasConnected) {
      this.emit('disconnected');
    }

    // Attempt reconnection if enabled
    if (this.shouldReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached', {
        attempts: this.reconnectAttempts,
        max: this.config.maxReconnectAttempts
      });
      this.setState(ConnectionState.FAILED);
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
    
    this.setState(ConnectionState.RECONNECTING);
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });
    
    logger.info('Scheduling reconnection', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.config.maxReconnectAttempts,
      delay
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
    logger.debug('Message queued', {
      type: message.type,
      queueSize: this.messageQueue.length
    });
    
    // Limit queue size to prevent memory issues
    if (this.messageQueue.length > 100) {
      this.messageQueue.shift();
      logger.warn('Message queue full, dropping oldest message');
    }
  }

  /**
   * Process queued messages
   */
  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) {
      return;
    }

    logger.info('Processing queued messages', { count: this.messageQueue.length });
    
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
      logger.debug('WebSocket state changed', {
        from: previousState,
        to: state
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

  /**
   * Subscribe to a channel/topic
   * 
   * @param channel - Channel name
   * @param params - Optional subscription parameters
   */
  public subscribe(channel: string, params?: any): void {
    this.send({
      type: 'subscribe',
      data: {
        channel,
        ...params
      }
    });
  }

  /**
   * Unsubscribe from a channel/topic
   * 
   * @param channel - Channel name
   */
  public unsubscribe(channel: string): void {
    this.send({
      type: 'unsubscribe',
      data: {
        channel
      }
    });
  }

  /**
   * Get connection statistics
   */
  public getStats() {
    return {
      state: this.state,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
      shouldReconnect: this.shouldReconnect
    };
  }
}
