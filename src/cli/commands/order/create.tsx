import React, { useState, useEffect } from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { ApiClient } from '../../../sdk/http/client';
import { StateManager } from '../../../core/state/store';
import { logger } from '../../../core/logging/logger';
import { ActionFeedbackView, ActionStatus } from '../../ui/views';
import type { OrderType } from '../../../sdk/types/orders';

interface OrderCreateAppProps {
  market: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  type: OrderType;
}

function OrderCreateApp({ market, side, quantity, price, type }: OrderCreateAppProps): React.ReactElement {
  const [status, setStatus] = useState<ActionStatus>('pending');
  const [details, setDetails] = useState<{ label: string; value: string }[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [message, setMessage] = useState<string | undefined>();

  useEffect(() => {
    async function createOrder() {
      const client = ApiClient.getInstance();
      const state = StateManager.getInstance();
      
      const orderPayload = {
        market_id: market,
        side,
        type,
        quantity: quantity.toString(),
        price: price.toString(),
        time_in_force: 'gtc' as const
      };

      try {
        const response = await client.placeOrder(orderPayload);
        const orderId = response.order_id!;
        
        // Save to local DB
        try {
          await state.query(
            `INSERT INTO orders (id, market_id, side, quantity, price, status, order_type, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
             ON CONFLICT (id) DO UPDATE SET
               status = EXCLUDED.status,
               updated_at = NOW()`,
            [orderId, market, side, quantity.toString(), price.toString(), response.status || 'active', type]
          );
        } catch (dbError) {
          logger.warn('Failed to persist order locally:', { error: dbError });
        }

        setDetails([
          { label: 'Order ID', value: orderId },
          { label: 'Status', value: response.status || 'submitted' },
          { label: 'Side', value: side.toUpperCase() },
          { label: 'Quantity', value: String(quantity) },
          { label: 'Price', value: String(price) },
          { label: 'Market', value: market },
        ]);
        setMessage('Order saved to local database.');
        setStatus('success');
        
        await state.close();
        
      } catch (err: any) {
        logger.error('Failed to create order:', { error: err });
        
        let errorMessage = err.message;
        if (err.response) {
          errorMessage = `Status ${err.response.status}: ${JSON.stringify(err.response.data)}`;
        }
        
        setError(errorMessage);
        setStatus('error');
        
        await state.close();
      }
    }

    createOrder();
  }, [market, side, quantity, price, type]);

  return (
    <ActionFeedbackView
      title={status === 'pending' ? `Submitting ${side} order for ${quantity} @ ${price}...` : (status === 'success' ? 'Order Created' : 'Order Failed')}
      status={status}
      details={details}
      error={error}
      message={message}
    />
  );
}

export const createOrderCommand = new Command('create')
  .description('Create a new order')
  .requiredOption('--market <marketId>', 'Market ID (e.g. BTC-USD)')
  .requiredOption('--side <side>', 'buy or sell')
  .requiredOption('--qty <quantity>', 'Quantity of credits')
  .requiredOption('--price <price>', 'Price per credit')
  .option('--type <type>', 'Order type (limit, market, stop)', 'limit')
  .action(async (options) => {
    const { market, side, qty, price, type } = options;
    
    // Validate inputs
    if (!['buy', 'sell'].includes(side)) {
      const { waitUntilExit } = render(
        <ActionFeedbackView
          title="Validation Error"
          status="error"
          error='Side must be "buy" or "sell"'
        />
      );
      await waitUntilExit();
      process.exit(1);
    }
    
    const quantity = parseFloat(qty);
    const priceNum = parseFloat(price);
    
    if (isNaN(quantity) || quantity <= 0) {
      const { waitUntilExit } = render(
        <ActionFeedbackView
          title="Validation Error"
          status="error"
          error="Quantity must be a positive number"
        />
      );
      await waitUntilExit();
      process.exit(1);
    }
    
    if (type === 'limit' && (isNaN(priceNum) || priceNum <= 0)) {
      const { waitUntilExit } = render(
        <ActionFeedbackView
          title="Validation Error"
          status="error"
          error="Price must be a positive number for limit orders"
        />
      );
      await waitUntilExit();
      process.exit(1);
    }

    const { waitUntilExit } = render(
      <OrderCreateApp
        market={market}
        side={side}
        quantity={quantity}
        price={priceNum}
        type={type as OrderType}
      />
    );
    
    await waitUntilExit();
  });
