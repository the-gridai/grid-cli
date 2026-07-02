import React from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { StateManager } from '../../../core/state/store';
import { ApiClient } from '../../../sdk/http/client';
import { logger } from '../../../core/logging/logger';
import { OrderListView, OrderData } from '../../ui/views/OrderListView';

export const listOrdersCommand = new Command('list')
  .description('List all orders')
  .option('--status <status>', 'Filter by status (open, filled, cancelled, active)')
  .option('--local', 'Fetch from local database instead of API')
  .option('--limit <n>', 'Limit number of results', '50')
  .action(async (options) => {
    // If --local flag, query local database
    if (options.local) {
      const state = StateManager.getInstance();
      
      try {
        let query = 'SELECT * FROM orders';
        const params: any[] = [];
        
        if (options.status) {
          query += ' WHERE status = $1';
          params.push(options.status);
        }
        
        query += ' ORDER BY created_at DESC';
        
        const result = await state.query(query, params);
        
        const orders: OrderData[] = result.rows.map((row: any) => ({
          id: row.id,
          side: row.side as 'buy' | 'sell',
          size: row.quantity,
          price: row.price,
          status: row.status,
          submitted: row.created_at,
        }));
        
        const { waitUntilExit } = render(
          <OrderListView orders={orders} source="database" />
        );
        await waitUntilExit();
        
      } catch (error: any) {
        logger.error('Failed to list orders:', { error });
        const { waitUntilExit } = render(
          <OrderListView orders={[]} error={error.message} source="database" />
        );
        await waitUntilExit();
      } finally {
        await state.close();
      }
      return;
    }

    // Default: query API
    const client = ApiClient.getInstance();
    
    try {
      const filters: any = {};
      if (options.status) {
        filters.status = options.status;
      }
      
      const apiOrders = await client.listOrders(filters);
      
      // Apply limit
      const limit = parseInt(options.limit, 10) || 50;
      const limitedOrders = apiOrders.slice(0, limit);
      
      const orders: OrderData[] = limitedOrders.map((order: any) => ({
        id: order.order_id,
        side: order.side as 'buy' | 'sell',
        size: order.quantity,
        price: order.price,
        status: order.status,
        submitted: order.submitted_at || order.created_at,
      }));
      
      const { waitUntilExit } = render(
        <OrderListView orders={orders} source="api" total={apiOrders.length} />
      );
      await waitUntilExit();
      
    } catch (error: any) {
      logger.error('Failed to fetch orders from API:', { error });
      const { waitUntilExit } = render(
        <OrderListView orders={[]} error={error.message} source="api" />
      );
      await waitUntilExit();
    }
  });
