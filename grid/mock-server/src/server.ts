#!/usr/bin/env node
/**
 * Grid Mock Server
 *
 * A lightweight mock server implementing the Grid Trading API for SDK development and testing.
 *
 * Usage:
 *   npx @the-gridai/grid-mock-server --port 3000
 *   grid-mock-server --port 3000
 */

import express, { Request, Response, NextFunction } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

import ordersRouter from './routes/orders.js';
import marketsRouter from './routes/markets.js';
import tradesRouter from './routes/trades.js';
import accountsRouter from './routes/accounts.js';
import supplyRouter from './routes/supply.js';
import transfersRouter from './routes/transfers.js';
import instrumentsRouter from './routes/instruments.js';
import signingKeysRouter from './routes/signing-keys.js';
import issuanceRouter from './routes/issuance.js';

const app = express();

// Parse JSON bodies
app.use(express.json());

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// CORS headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, x-thegrid-signature, x-thegrid-timestamp, x-thegrid-fingerprint'
  );
  next();
});

// Handle preflight requests
app.options('*', (_req: Request, res: Response) => {
  res.sendStatus(204);
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'grid-mock-server' });
});

// API info
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Grid Mock Server',
    version: '0.1.0',
    description: 'Mock server for Grid SDK development and testing',
    endpoints: {
      health: '/health',
      orders: '/orders',
      markets: '/markets',
      trades: '/trades',
      tradingAccounts: '/trading-accounts',
      consumptionAccounts: '/consumption-accounts',
      issuanceAccounts: '/issuance-accounts',
      supplyIssuances: '/supply-issuances',
      transfers: '/transfers',
      instruments: '/instruments',
      signingKeys: '/signing-keys',
      issuanceTransfer: '/issuance-accounts/transfer',
      me: '/me',
    },
  });
});

// Mount routes
app.use('/orders', ordersRouter);
app.use('/markets', marketsRouter);
app.use('/trades', tradesRouter);
app.use('/trading', accountsRouter);
app.use('/supply-issuances', supplyRouter);
app.use('/transfers', transfersRouter);
app.use('/trading', transfersRouter); // Also mount at /trading for transfer-histories
app.use('/instruments', instrumentsRouter);
app.use('/signing-keys', signingKeysRouter);
app.use('/issuance-accounts', issuanceRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.path} not found`,
    },
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  });
});

// Create HTTP server (for use by tests)
const server = http.createServer(app);

// Start server function
function startServer(port: number = 3000) {
  // WebSocket server
  const wss = new WebSocketServer({ server, path: '/ws' });

  // WebSocket connection handling
  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected');

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('WebSocket message:', message);

        // Handle subscription messages
        if (message.type === 'subscribe') {
          ws.send(
            JSON.stringify({
              type: 'subscribed',
              data: { channel: message.data?.channel },
            })
          );
        }

        if (message.type === 'unsubscribe') {
          ws.send(
            JSON.stringify({
              type: 'unsubscribed',
              data: { channel: message.data?.channel },
            })
          );
        }
      } catch {
        console.error('Invalid WebSocket message');
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
    });

    // Send welcome message
    ws.send(
      JSON.stringify({
        type: 'connected',
        data: { message: 'Connected to Grid Mock Server' },
      })
    );
  });

  // Periodic ticker updates to WebSocket clients
  setInterval(() => {
    const tickerUpdate = {
      type: 'ticker',
      market_id: 'mkt-btc-usd',
      ticker: {
        market_id: 'mkt-btc-usd',
        symbol: 'BTC-USD',
        last_price: (52000 + Math.random() * 100).toFixed(2),
        volume_24h: '1234.56',
        highest_bid: '51999.00',
        lowest_ask: '52001.00',
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(tickerUpdate));
      }
    });
  }, 5000);

  // Start server
  server.listen(port, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║           Grid Mock Server v0.1.0            ║
╠══════════════════════════════════════════════╣
║  HTTP:      http://localhost:${port}             ║
║  WebSocket: ws://localhost:${port}/ws            ║
╠══════════════════════════════════════════════╣
║  Endpoints:                                  ║
║    GET  /health                              ║
║    GET  /orders                      ║
║    POST /orders                      ║
║    GET  /markets                     ║
║    GET  /markets/:id/ticker          ║
║    GET  /trading-accounts            ║
║    GET  /consumption-accounts        ║
╚══════════════════════════════════════════════╝
    `);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  return server;
}

// Only start server if run directly (not imported)
import { fileURLToPath } from 'url';
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let port = 3000;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' || args[i] === '-p') {
      port = parseInt(args[i + 1], 10) || 3000;
      i++;
    }
  }

  startServer(port);
}

export { app, server, startServer };
