/**
 * Order routes for mock server
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { orders, trades, markets, Order, Trade } from '../data.js';

const router = Router();

// List orders
router.get('/', (req: Request, res: Response) => {
  const orderList = Array.from(orders.values());

  // Apply filters if present
  const filteredOrders = orderList.filter((order) => {
    // Parse filter params (format: filters[0][field]=status&filters[0][value]=active)
    for (let i = 0; i < 10; i++) {
      const field = req.query[`filters[${i}][field]`] as string;
      const value = req.query[`filters[${i}][value]`] as string;

      if (!field || !value) continue;

      if (field === 'status' && order.status !== value) return false;
      if (field === 'market_id' && order.market_id !== value) return false;
      if (field === 'side' && order.side !== value) return false;
    }
    return true;
  });

  res.json({ data: filteredOrders });
});

// Get order by ID
router.get('/:orderId', (req: Request, res: Response) => {
  const order = orders.get(req.params.orderId);

  if (!order) {
    return res.status(404).json({
      error: {
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found',
      },
    });
  }

  res.json({ data: order });
});

// Place order
router.post('/', (req: Request, res: Response) => {
  const { market_id, side, type, quantity, price, stop_price, time_in_force, client_order_id } =
    req.body;

  // Validate required fields
  if (!market_id || !side || !type || !quantity) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Missing required fields: market_id, side, type, quantity',
      },
    });
  }

  // Validate market exists
  const market = markets.find((m) => m.market_id === market_id || m.name === market_id);
  if (!market) {
    return res.status(400).json({
      error: {
        code: 'MARKET_NOT_FOUND',
        message: `Market ${market_id} not found`,
      },
    });
  }

  // Validate limit orders have price
  if ((type === 'limit' || type === 'stop_limit') && !price) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Limit orders require a price',
      },
    });
  }

  // Validate stop orders have stop_price
  if ((type === 'stop' || type === 'stop_limit') && !stop_price) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Stop orders require a stop_price',
      },
    });
  }

  const orderId = `order-${uuidv4().slice(0, 8)}`;
  const now = new Date().toISOString();

  const order: Order = {
    id: orderId,
    order_id: orderId,
    market_id: market.market_id,
    market_name: market.name,
    instrument_id: market.allowed_instruments?.[0] || '',
    side,
    type,
    status: 'active',
    quantity: String(quantity),
    filled_quantity: 0,
    price: price ? String(price) : null,
    average_price: null,
    stop_price: stop_price ? String(stop_price) : null,
    fee: '0',
    time_in_force: time_in_force || 'gtc',
    client_order_id: client_order_id || null,
    created_at: now,
    updated_at: now,
  };

  orders.set(orderId, order);

  // For market orders, simulate immediate fill
  if (type === 'market') {
    simulateFill(orderId);
  }

  res.status(201).json({
    data: {
      order_id: orderId,
      client_order_id: order.client_order_id,
    },
  });
});

// Update order
router.put('/:orderId', (req: Request, res: Response) => {
  const order = orders.get(req.params.orderId);

  if (!order) {
    return res.status(404).json({
      error: {
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found',
      },
    });
  }

  if (order.status !== 'active' && order.status !== 'open') {
    return res.status(400).json({
      error: {
        code: 'INVALID_ORDER_STATE',
        message: 'Cannot update order in current state',
      },
    });
  }

  const { price, quantity, stop_price, time_in_force } = req.body;

  if (price) order.price = String(price);
  if (quantity) order.quantity = String(quantity);
  if (stop_price) order.stop_price = String(stop_price);
  if (time_in_force) order.time_in_force = time_in_force;
  order.updated_at = new Date().toISOString();

  orders.set(order.order_id, order);

  res.json({ data: order });
});

// Cancel order
router.delete('/:orderId', (req: Request, res: Response) => {
  const order = orders.get(req.params.orderId);

  if (!order) {
    return res.status(404).json({
      error: {
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found',
      },
    });
  }

  if (order.status === 'filled' || order.status === 'cancelled') {
    return res.status(400).json({
      error: {
        code: 'INVALID_ORDER_STATE',
        message: 'Cannot cancel order in current state',
      },
    });
  }

  order.status = 'cancelled';
  order.updated_at = new Date().toISOString();
  orders.set(order.order_id, order);

  res.status(204).send();
});

// Helper: simulate order fill
function simulateFill(orderId: string) {
  const order = orders.get(orderId);
  if (!order) return;

  const fillPrice = order.price || '50000'; // Default price for market orders
  const fillQuantity = parseFloat(order.quantity);

  order.status = 'filled';
  order.filled_quantity = fillQuantity;
  order.average_price = fillPrice;
  order.fee = (fillQuantity * parseFloat(fillPrice) * 0.001).toFixed(2);
  order.updated_at = new Date().toISOString();
  orders.set(order.order_id, order);

  // Create trade record
  const tradeId = `trade-${uuidv4().slice(0, 8)}`;
  const trade: Trade = {
    id: tradeId,
    trade_id: tradeId,
    market_id: order.market_id,
    market_name: order.market_name,
    instrument_id: order.instrument_id,
    price: fillPrice,
    quantity: order.quantity,
    total_value: (fillQuantity * parseFloat(fillPrice)).toFixed(2),
    fee: order.fee,
    side: order.side,
    execution_timestamp: order.updated_at,
    settlement_timestamp: null,
    order_id: order.order_id,
  };

  trades.set(tradeId, trade);
}

export default router;
