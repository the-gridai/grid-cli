/**
 * WebSocket message types
 */

/**
 * WebSocket connection state
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed',
}

/**
 * WebSocket message base
 */
export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: string;
}

/**
 * Order update message
 */
export interface OrderUpdateMessage extends WebSocketMessage {
  type: 'order_update';
  data: {
    order_id: string;
    status: string;
    filled_quantity?: string;
    remaining_quantity?: string;
    average_fill_price?: string;
    updated_at: string;
  };
}

/**
 * Trade update message
 */
export interface TradeUpdateMessage extends WebSocketMessage {
  type: 'trade_update';
  data: {
    trade_id: string;
    order_id: string;
    market_id: string;
    price: string;
    quantity: string;
    execution_timestamp: string;
  };
}

/**
 * Market data update message
 */
export interface MarketDataMessage extends WebSocketMessage {
  type: 'market_data';
  data: {
    market_id: string;
    last_price?: string;
    bid?: string;
    ask?: string;
    volume_24h?: string;
  };
}

/**
 * Subscription request
 */
export interface SubscriptionRequest {
  action: 'subscribe' | 'unsubscribe';
  channels: string[];
}

/**
 * Subscription response
 */
export interface SubscriptionResponse {
  success: boolean;
  channels: string[];
  message?: string;
}

