import React, { useState, useEffect } from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { ApiClient } from '../../../sdk/http/client';
import { logger } from '../../../core/logging/logger';
import { ActionFeedbackView, ActionStatus } from '../../ui/views';

interface OrderCancelAppProps {
  orderId: string;
}

function OrderCancelApp({ orderId }: OrderCancelAppProps): React.ReactElement {
  const [status, setStatus] = useState<ActionStatus>('pending');
  const [details, setDetails] = useState<{ label: string; value: string }[]>([]);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    async function cancelOrder() {
      const client = ApiClient.getInstance();
      
      try {
        await client.cancelOrder(orderId);
        
        setDetails([
          { label: 'Order ID', value: orderId },
        ]);
        setStatus('success');
        
      } catch (err: any) {
        logger.error('Failed to cancel order:', { error: err });
        setError(err.message);
        setStatus('error');
      }
    }

    cancelOrder();
  }, [orderId]);

  return (
    <ActionFeedbackView
      title={status === 'pending' ? `Canceling order ${orderId}...` : (status === 'success' ? 'Order Cancelled' : 'Cancel Failed')}
      status={status}
      details={details}
      error={error}
    />
  );
}

export const cancelOrderCommand = new Command('cancel')
  .description('Cancel an order')
  .argument('<order-id>', 'Order ID to cancel')
  .action(async (orderId: string) => {
    const { waitUntilExit } = render(
      <OrderCancelApp orderId={orderId} />
    );
    
    await waitUntilExit();
  });
