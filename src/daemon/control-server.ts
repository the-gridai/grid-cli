/**
 * Control Server
 * 
 * HTTP server for dynamic configuration management.
 * Provides endpoints for reading and updating strategy configurations.
 * Supports both daemon mode (multi-strategy) and single-strategy mode.
 * 
 * @module control-server
 */

import http from 'http';
import { logger } from '../core/logging/logger';
import { ControlApiAuth } from '../core/auth/control-api-auth';
import type { ConfigManager, ConfigUpdateResult } from '../core/config/config-manager';
import {
  StrategyConfigStore,
  type CreateStrategyConfigInput,
  type UpdateStrategyConfigInput,
  type SavedStrategyConfigRow,
} from '../core/persistence/StrategyConfigStore';

/**
 * Strategy registration for daemon mode
 */
export interface RegisteredStrategy {
  id: string;
  name: string;
  type: string;
  configManager: ConfigManager<any>;
  /** Callback to apply config changes to the running strategy */
  onConfigUpdate?: (newConfig: any, oldConfig: any) => Promise<void>;
  /** Optional callback for strategies that support kill switch reset */
  onResetKillSwitch?: (reason?: string) => Promise<void>;
  /** Optional callback to cancel active orders (optionally scoped) */
  onCancelOrders?: (opts?: { marketId?: string; marketSymbol?: string; reason?: string }) => Promise<{
    cancelled: number;
    failed: number;
    markets: string[];
  }>;
  /** Pause/stop the running strategy (best-effort). */
  onPause?: (opts?: { marketId?: string; marketSymbol?: string; reason?: string }) => Promise<void>;
  /** Resume/start a previously paused/stopped strategy (best-effort). Per-market when marketId/marketSymbol set. */
  onResume?: (opts?: { reason?: string; marketId?: string; marketSymbol?: string }) => Promise<void>;
  /** Restart a strategy (best-effort). */
  onRestart?: (reason?: string) => Promise<void>;
  /** List active orders for this strategy (for dashboard display). */
  onListOrders?: () => Promise<any[]>;

  /** Per-market status (e.g. scheduled-issuer). */
  getMarketStatuses?: () => Array<Record<string, unknown>>;
  /**
   * Merge a partial per-market config (scheduled-issuer IssuerMarketConfig fields).
   * Returns the same shape as ConfigManager.updateConfig.
   */
  onPatchMarket?: (args: {
    marketKey: string;
    patch: Record<string, unknown>;
  }) => Promise<ConfigUpdateResult<unknown>>;

  /**
   * Drain any per-market apply warnings accumulated since the last drain.
   * Called right after a successful PATCH / PUT so the HTTP response can
   * include partial-apply failures alongside the persisted config.
   */
  consumePendingApplyWarnings?: () => Array<{
    marketKey: string;
    phase: 'add' | 'remove' | 're-init';
    reason: string;
    at: number;
  }>;
}

/**
 * Provider for aggregated order operations across all strategy instances.
 * Used by /orders/all and /orders/cancel-all endpoints.
 */
export interface OrderProvider {
  listAll: () => Promise<Array<{ strategyId: string; strategyName: string; strategyType: string; orders: any[] }>>;
  cancelAll: () => Promise<{ cancelled: number; failed: number; markets: string[] }>;
}

/**
 * Control server options
 */
export interface ControlServerOptions {
  /** Port to listen on */
  port: number;
  /** Host to bind to (default: 0.0.0.0) */
  host?: string;
  /** Profile for authentication credentials */
  profile?: string;
  /** Whether to require authentication for mutating requests */
  requireAuth?: boolean;
  /** Allow unauthenticated read requests (GET) */
  allowUnauthenticatedReads?: boolean;
  /**
   * SQLite path for `strategy_configs` table. When set, enables `/saved-configs*` CRUD.
   * Ignored when `configStore` is provided (the injected store wins).
   */
  strategyConfigDbPath?: string;
  /**
   * Shared SQLite store for `strategy_configs`. When provided, the control server reuses
   * the caller's connection instead of opening its own — needed so write-through updates
   * from the runner and reads from control-server HTTP handlers see the same state under
   * SQLite's default journaling.
   *
   * The control server does NOT close a store passed in via this option; that is the
   * caller's responsibility.
   */
  configStore?: StrategyConfigStore;
  /**
   * Apply a saved config blob to a running strategy (typically ConfigManager.replaceConfig).
   * `savedId` is the saved row id; config is the blob. Use `opts.targetStrategyId` to apply to a
   * different running instance id (defaults to `savedId`).
   */
  onActivateSavedConfig?: (
    savedId: string,
    config: Record<string, unknown>,
    opts?: { targetStrategyId?: string }
  ) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Request context with parsed body
 */
interface RequestContext {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  url: URL;
  method: string;
  body: string;
  parsedBody: unknown;
  /** Populated after successful auth on mutating requests. */
  actor?: string;
}

/**
 * Control Server
 * 
 * HTTP server that exposes configuration management endpoints.
 * Can operate in two modes:
 * 1. Single-strategy mode: One ConfigManager
 * 2. Multi-strategy mode: Multiple registered strategies
 */
interface ResolvedControlServerOptions {
  port: number;
  host: string;
  profile?: string;
  requireAuth: boolean;
  allowUnauthenticatedReads: boolean;
  strategyConfigDbPath?: string;
  configStore?: StrategyConfigStore;
  onActivateSavedConfig?: ControlServerOptions['onActivateSavedConfig'];
}

export class ControlServer {
  private server: http.Server | null = null;
  private auth: ControlApiAuth;
  private options: ResolvedControlServerOptions;
  private strategies: Map<string, RegisteredStrategy> = new Map();
  private singleConfigManager: ConfigManager<any> | null = null;
  private isRunning = false;
  private boundAddress: { port: number; host: string } | null = null;
  private statusProvider: (() => unknown) | null = null;
  private orderProvider: OrderProvider | null = null;
  private strategyConfigStore: StrategyConfigStore | null = null;
  /**
   * True when `strategyConfigStore` was created internally (from a path) and must be
   * closed on shutdown. False when injected via `ControlServerOptions.configStore` —
   * in that case the caller owns the lifecycle.
   */
  private ownsStrategyConfigStore = false;

  constructor(options: ControlServerOptions) {
    this.options = {
      host: '0.0.0.0',
      requireAuth: true,
      allowUnauthenticatedReads: true,
      ...options,
    };

    this.auth = new ControlApiAuth({
      profile: options.profile,
      allowUnauthenticatedReads: this.options.allowUnauthenticatedReads,
    });

    if (this.options.configStore) {
      this.strategyConfigStore = this.options.configStore;
      this.ownsStrategyConfigStore = false;
    }
  }

  private getStrategyConfigStore(): StrategyConfigStore | null {
    if (this.strategyConfigStore) {
      return this.strategyConfigStore;
    }
    const p = this.options.strategyConfigDbPath;
    if (!p) {
      return null;
    }
    this.strategyConfigStore = new StrategyConfigStore(p);
    this.strategyConfigStore.init();
    this.ownsStrategyConfigStore = true;
    return this.strategyConfigStore;
  }

  /**
   * Register a strategy for daemon mode
   */
  registerStrategy(strategy: RegisteredStrategy): void {
    this.strategies.set(strategy.id, strategy);
    logger.info('Strategy registered with control server', {
      id: strategy.id,
      name: strategy.name,
    });
  }

  /**
   * Unregister a strategy
   */
  unregisterStrategy(strategyId: string): void {
    this.strategies.delete(strategyId);
    logger.info('Strategy unregistered from control server', { id: strategyId });
  }

  /**
   * Set a single config manager for single-strategy mode
   */
  setSingleConfigManager(manager: ConfigManager<any>): void {
    this.singleConfigManager = manager;
  }

  /**
   * Set a callback that returns aggregated status (from MultiStrategyRunner).
   * This allows /status and /health to be served on the control port.
   */
  setStatusProvider(provider: () => unknown): void {
    this.statusProvider = provider;
  }

  setOrderProvider(provider: OrderProvider): void {
    this.orderProvider = provider;
  }

  /**
   * Start the control server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Control server already running');
      return;
    }

    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch(error => {
        logger.error('Control server error', { error: error.message });
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      });
    });

    this.server.requestTimeout = 30000;
    this.server.headersTimeout = 10000;
    this.server.keepAliveTimeout = 60000;

    await new Promise<void>((resolve, reject) => {
      this.server!.on('error', reject);
      this.server!.listen(this.options.port, this.options.host, () => {
        this.isRunning = true;
        // If port 0 was requested, Node chooses an ephemeral port; record it so
        // callers (tests, dashboards) can discover the real bound address.
        const addr = this.server!.address();
        if (addr && typeof addr === 'object') {
          this.options.port = addr.port;
        }
        this.boundAddress = { port: this.options.port, host: this.options.host };
        logger.info('Control server started', {
          port: this.options.port,
          host: this.options.host,
        });
        resolve();
      });
    });
  }

  /**
   * Stop the control server
   */
  async stop(): Promise<void> {
    if (!this.server || !this.isRunning) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.server!.close(() => {
        this.isRunning = false;
        this.boundAddress = null;
        this.server = null;
        logger.info('Control server stopped');
        resolve();
      });
    });
  }

  /**
   * Handle incoming HTTP request
   */
  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const url = new URL(req.url || '/', `http://localhost:${this.options.port}`);
    const method = req.method?.toUpperCase() || 'GET';

    // CORS headers — restrict to localhost origins (dashboard dev server)
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://127.0.0.1:3000',
    ];
    const requestOrigin = req.headers.origin || '';
    if (allowedOrigins.includes(requestOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-thegrid-signature, x-thegrid-timestamp, x-thegrid-fingerprint');

    // Handle preflight
    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Read request body
    const body = await this.readBody(req);
    let parsedBody: unknown = null;

    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        parsedBody = JSON.parse(body);
      } catch {
        this.sendError(res, 400, 'Invalid JSON body');
        return;
      }
    }

    // Authentication for mutating requests
    let actor: string | undefined;
    if (this.options.requireAuth && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const authResult = this.auth.authenticateRequest(req, body);
      if (!authResult.authenticated) {
        this.sendError(res, 401, authResult.error || 'Unauthorized');
        return;
      }
      const fp = authResult.fingerprint;
      actor = fp ? `fp:${fp.substring(0, 12)}` : 'control-api';
    }

    const ctx: RequestContext = { req, res, url, method, body, parsedBody, actor };

    // Route request
    await this.routeRequest(ctx);
  }

  /**
   * Route request to appropriate handler
   */
  private async routeRequest(ctx: RequestContext): Promise<void> {
    const { url, method, res } = ctx;
    const path = url.pathname;

    // Status / health endpoints (no auth, mirrors the health server)
    if (path === '/status' && method === 'GET') {
      if (this.statusProvider) {
        this.sendJson(res, 200, this.statusProvider());
      } else {
        this.sendJson(res, 200, { mode: 'single', healthy: true, timestamp: new Date().toISOString() });
      }
      return;
    }

    if (path === '/health' && method === 'GET') {
      if (this.statusProvider) {
        const status = this.statusProvider() as any;
        const healthy = status?.healthy ?? true;
        this.sendJson(res, healthy ? 200 : 503, { healthy });
      } else {
        this.sendJson(res, 200, { healthy: true });
      }
      return;
    }

    // Server metadata: surfaces configSource so the dashboard can show a clear
    // "JSON file is bootstrap-only, DB is source of truth" indicator. No auth.
    if (path === '/meta' && method === 'GET') {
      const store = this.getStrategyConfigStore();
      this.sendJson(res, 200, {
        configSource: store ? 'db' : 'file',
        strategyConfigDb: store
          ? { enabled: true, path: store.getDbPath?.() ?? null }
          : { enabled: false, path: null },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Single-strategy mode routes
    if (path === '/config') {
      if (this.singleConfigManager) {
        await this.handleSingleConfig(ctx);
        return;
      }
      // In daemon mode, /config returns all strategy configs
      await this.handleAllConfigs(ctx);
      return;
    }

    // Strategy-specific routes: /config/:strategyId
    const strategyMatch = path.match(/^\/config\/([^/]+)$/);
    if (strategyMatch) {
      const strategyId = strategyMatch[1];

      // Handle special paths first
      if (strategyId === 'validate') {
        await this.handleValidate(ctx);
        return;
      }

      await this.handleStrategyConfig(ctx, strategyId);
      return;
    }

    // Config change history route: /config/:strategyId/history (GET, no auth)
    const historyMatch = path.match(/^\/config\/([^/]+)\/history$/);
    if (historyMatch && method === 'GET') {
      await this.handleStrategyHistory(ctx, historyMatch[1]);
      return;
    }

    // List orders route: /config/:strategyId/orders (GET, no auth)
    const ordersMatch = path.match(/^\/config\/([^/]+)\/orders$/);
    if (ordersMatch && method === 'GET') {
      const strategyId = ordersMatch[1];
      await this.handleListOrders(ctx, strategyId);
      return;
    }

    // Cancel orders route: /config/:strategyId/cancel-orders
    const cancelMatch = path.match(/^\/config\/([^/]+)\/cancel-orders$/);
    if (cancelMatch && method === 'POST') {
      const strategyId = cancelMatch[1];
      await this.handleCancelOrders(ctx, strategyId);
      return;
    }

    // Per-market listing: GET /config/:strategyId/markets
    const strategyMarketsMatch = path.match(/^\/config\/([^/]+)\/markets$/);
    if (strategyMarketsMatch && method === 'GET') {
      await this.handleStrategyMarkets(ctx, strategyMarketsMatch[1]);
      return;
    }

    // POST /config/:strategyId/markets/:marketKey/pause|resume
    const marketPauseMatch = path.match(/^\/config\/([^/]+)\/markets\/([^/]+)\/pause$/);
    if (marketPauseMatch && method === 'POST') {
      await this.handleMarketPausePath(ctx, marketPauseMatch[1], marketPauseMatch[2]);
      return;
    }

    const marketResumeMatch = path.match(/^\/config\/([^/]+)\/markets\/([^/]+)\/resume$/);
    if (marketResumeMatch && method === 'POST') {
      await this.handleMarketResumePath(ctx, marketResumeMatch[1], marketResumeMatch[2]);
      return;
    }

    // PATCH /config/:strategyId/markets/:marketKey — partial per-market config
    const marketPatchMatch = path.match(/^\/config\/([^/]+)\/markets\/([^/]+)$/);
    if (marketPatchMatch && method === 'PATCH') {
      await this.handlePatchMarket(ctx, marketPatchMatch[1], marketPatchMatch[2]);
      return;
    }

    // Pause / resume / restart routes
    const pauseMatch = path.match(/^\/config\/([^/]+)\/pause$/);
    if (pauseMatch && method === 'POST') {
      const strategyId = pauseMatch[1];
      await this.handlePause(ctx, strategyId);
      return;
    }

    const resumeMatch = path.match(/^\/config\/([^/]+)\/resume$/);
    if (resumeMatch && method === 'POST') {
      const strategyId = resumeMatch[1];
      await this.handleResume(ctx, strategyId);
      return;
    }

    const restartMatch = path.match(/^\/config\/([^/]+)\/restart$/);
    if (restartMatch && method === 'POST') {
      const strategyId = restartMatch[1];
      await this.handleRestart(ctx, strategyId);
      return;
    }

    // Reset kill switch route: /config/:strategyId/reset-kill-switch
    const resetKillMatch = path.match(/^\/config\/([^/]+)\/reset-kill-switch$/);
    if (resetKillMatch && method === 'POST') {
      const strategyId = resetKillMatch[1];
      await this.handleResetKillSwitch(ctx, strategyId);
      return;
    }

    // Validate endpoint
    if (path === '/config/validate' && method === 'POST') {
      await this.handleValidate(ctx);
      return;
    }

    // User order management (proxy to Trading API with provided credentials)
    if (path === '/orders/user/list' && method === 'POST') {
      await this.handleUserListOrders(ctx);
      return;
    }

    if (path === '/orders/user/cancel-all' && method === 'POST') {
      await this.handleUserCancelAllOrders(ctx);
      return;
    }

    if (path === '/orders/user/place' && method === 'POST') {
      await this.handleUserPlaceOrder(ctx);
      return;
    }

    // Aggregated orders routes (all strategies)
    if (path === '/orders/all' && method === 'GET') {
      await this.handleListAllOrders(ctx);
      return;
    }

    if (path === '/orders/cancel-all' && method === 'POST') {
      await this.handleCancelAllOrders(ctx);
      return;
    }

    // Trading API proxies (GET, unauthenticated — same as other reads)
    if (path === '/markets' && method === 'GET') {
      await this.handleProxyMarkets(ctx);
      return;
    }
    if (path === '/instruments' && method === 'GET') {
      await this.handleProxyInstruments(ctx);
      return;
    }

    // Persisted strategy configs (SQLite)
    if (path === '/saved-configs' && method === 'GET') {
      await this.handleSavedConfigsList(ctx);
      return;
    }
    if (path === '/saved-configs' && method === 'POST') {
      await this.handleSavedConfigsCreate(ctx);
      return;
    }

    const savedActivateMatch = path.match(/^\/saved-configs\/([^/]+)\/activate$/);
    if (savedActivateMatch && method === 'POST') {
      await this.handleSavedConfigActivate(ctx, savedActivateMatch[1]);
      return;
    }

    const savedDupMatch = path.match(/^\/saved-configs\/([^/]+)\/duplicate$/);
    if (savedDupMatch && method === 'POST') {
      await this.handleSavedConfigDuplicate(ctx, savedDupMatch[1]);
      return;
    }

    const savedOneMatch = path.match(/^\/saved-configs\/([^/]+)$/);
    if (savedOneMatch) {
      await this.handleSavedConfigOne(ctx, savedOneMatch[1]);
      return;
    }

    // 404 for unknown routes
    this.sendError(res, 404, 'Not found');
  }

  /**
   * Handle single-strategy mode config requests
   */
  private async handleSingleConfig(ctx: RequestContext): Promise<void> {
    const { method, res, parsedBody, actor } = ctx;
    const manager = this.singleConfigManager!;
    const changeContext = { actor: actor ?? 'control-api', reason: `${method.toLowerCase()} /config` };

    switch (method) {
      case 'GET':
        this.sendJson(res, 200, { config: manager.getConfig() });
        break;

      case 'PATCH': {
        const result = await manager.updateConfig(parsedBody as any, changeContext);
        this.sendConfigResult(res, result);
        break;
      }

      case 'PUT': {
        const result = await manager.replaceConfig(parsedBody as any, changeContext);
        this.sendConfigResult(res, result);
        break;
      }

      default:
        this.sendError(res, 405, 'Method not allowed');
    }
  }

  /**
   * Handle requests for all strategy configs (daemon mode)
   */
  private async handleAllConfigs(ctx: RequestContext): Promise<void> {
    const { method, res } = ctx;

    if (method !== 'GET') {
      this.sendError(res, 405, 'Method not allowed. Use /config/:strategyId for updates.');
      return;
    }

    const configs: Record<string, ReturnType<typeof this.buildStrategyDescriptor>> = {};

    for (const [id, strategy] of this.strategies) {
      configs[id] = this.buildStrategyDescriptor(strategy);
    }

    this.sendJson(res, 200, { strategies: configs });
  }

  /**
   * Build the GET-shape for a single running strategy, enriched with persistence
   * metadata (version / schemaVersion / updatedAt / lastActor / lastReason) from
   * SQLite when available. These fields let the dashboard render a "Saved v12 by
   * fp:ab12… 2m ago" badge without a second round-trip.
   */
  private buildStrategyDescriptor(strategy: RegisteredStrategy): {
    id: string;
    name: string;
    type: string;
    config: unknown;
    version?: number;
    schemaVersion?: number;
    updatedAt?: number;
    createdAt?: number;
    lastActor?: string | null;
    lastReason?: string | null;
  } {
    const base = {
      id: strategy.id,
      name: strategy.name,
      type: strategy.type,
      config: strategy.configManager.getConfig(),
    };

    const store = this.getStrategyConfigStore();
    if (!store) return base;

    try {
      const row = store.get(strategy.id);
      if (!row) return base;

      // Most recent history row gives us the last actor/reason; gracefully
      // degrade if the history method or rows don't exist yet (older DBs).
      let lastActor: string | null = null;
      let lastReason: string | null = null;
      try {
        const hist = store.history?.(strategy.id, 1) ?? [];
        if (hist.length > 0) {
          lastActor = hist[0].actor ?? null;
          lastReason = hist[0].reason ?? null;
        }
      } catch {
        // best-effort; absence of history must not fail the GET
      }

      return {
        ...base,
        version: row.version,
        schemaVersion: row.schemaVersion,
        updatedAt: row.updatedAt,
        createdAt: row.createdAt,
        lastActor,
        lastReason,
      };
    } catch (error) {
      logger.debug('Failed to enrich strategy descriptor from SQLite', {
        strategyId: strategy.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return base;
    }
  }

  /**
   * Handle strategy-specific config requests
   */
  private async handleStrategyConfig(
    ctx: RequestContext,
    strategyId: string
  ): Promise<void> {
    const { method, res, parsedBody, actor } = ctx;

    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      this.sendError(res, 404, `Strategy not found: ${strategyId}`);
      return;
    }

    const manager = strategy.configManager;
    const changeContext = { actor: actor ?? 'control-api', reason: `${method.toLowerCase()} /config/${strategyId}` };

    switch (method) {
      case 'GET':
        this.sendJson(res, 200, this.buildStrategyDescriptor(strategy));
        break;

      case 'PATCH': {
        // ConfigManager.updateConfig() notifies change listeners internally
        // (the strategy registers its onConfigUpdate callback in the
        // constructor).  Do NOT call strategy.onConfigUpdate again here —
        // that caused orders to be cancelled and re-created twice per PATCH.
        const result = await manager.updateConfig(parsedBody as any, changeContext);
        const applyWarnings = strategy.consumePendingApplyWarnings?.();
        this.sendConfigResult(res, result, applyWarnings);
        break;
      }

      case 'PUT': {
        // Same: ConfigManager.replaceConfig() notifies listeners internally.
        const result = await manager.replaceConfig(parsedBody as any, changeContext);
        const applyWarnings = strategy.consumePendingApplyWarnings?.();
        this.sendConfigResult(res, result, applyWarnings);
        break;
      }

      default:
        this.sendError(res, 405, 'Method not allowed');
    }
  }

  /**
   * Return recent config-change audit rows for one strategy. GET-only, no auth —
   * same posture as the other read endpoints. Returns an empty list (200) rather
   * than 404 when the store has no rows, so the dashboard can render an empty
   * "no changes yet" state without special-casing errors.
   */
  private async handleStrategyHistory(ctx: RequestContext, strategyId: string): Promise<void> {
    const { method, res, url } = ctx;

    if (method !== 'GET') {
      this.sendError(res, 405, 'Method not allowed');
      return;
    }

    if (!this.strategies.has(strategyId)) {
      this.sendError(res, 404, `Strategy not found: ${strategyId}`);
      return;
    }

    const store = this.getStrategyConfigStore();
    if (!store) {
      // Config history requires SQLite. Without it, there's nothing to return,
      // but this is an expected configuration (single-strategy file mode), so
      // keep it a 200 with an empty list + source hint.
      this.sendJson(res, 200, { history: [], source: 'file' });
      return;
    }

    // Cap limit so a malicious/buggy caller can't exhaust the DB in one request.
    const rawLimit = url.searchParams.get('limit');
    const parsed = rawLimit ? parseInt(rawLimit, 10) : 25;
    const limit = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 200) : 25;

    try {
      const rows = store.history?.(strategyId, limit) ?? [];
      this.sendJson(res, 200, {
        history: rows,
        source: 'db',
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn('Failed to read strategy config history', { strategyId, error: msg });
      this.sendError(res, 500, `Failed to read history: ${msg}`);
    }
  }

  /**
   * Handle cancel orders request
   */
  private async handleListOrders(ctx: RequestContext, strategyId: string): Promise<void> {
    const { res } = ctx;
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      this.sendError(res, 404, `Strategy not found: ${strategyId}`);
      return;
    }
    if (!strategy.onListOrders) {
      this.sendJson(res, 200, { orders: [] });
      return;
    }
    try {
      const orders = await strategy.onListOrders();
      this.sendJson(res, 200, { orders });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn('Failed to list orders', { strategyId, error: msg });
      this.sendJson(res, 200, { orders: [], error: msg });
    }
  }

  private async handleCancelOrders(ctx: RequestContext, strategyId: string): Promise<void> {
    const { res, parsedBody } = ctx;

    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      this.sendError(res, 404, `Strategy not found: ${strategyId}`);
      return;
    }

    const body = (parsedBody && typeof parsedBody === 'object') ? (parsedBody as any) : {};
    const opts = {
      marketId: typeof body.marketId === 'string' ? body.marketId : undefined,
      marketSymbol: typeof body.marketSymbol === 'string' ? body.marketSymbol : undefined,
      reason: 'control-api',
    };

    if (strategy.onCancelOrders) {
      try {
        const result = await strategy.onCancelOrders(opts);
        this.sendJson(res, 200, { success: true, message: 'Cancel orders requested', ...result });
        return;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error('Cancel orders failed', { strategyId, error: msg });
        this.sendError(res, 500, `Cancel orders failed: ${msg}`);
        return;
      }
    }

    // Fallback: trigger a config update with the same config to force order cancellation
    try {
      const currentConfig = strategy.configManager.getConfig();
      if (strategy.onConfigUpdate) {
        await strategy.onConfigUpdate(currentConfig, currentConfig);
      }
      this.sendJson(res, 200, {
        success: true,
        message: 'Config refresh triggered (orders should be cancelled)',
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError(res, 500, `Cancel orders failed: ${msg}`);
    }
  }

  private async handlePause(ctx: RequestContext, strategyId: string): Promise<void> {
    const { res, parsedBody } = ctx;
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      this.sendError(res, 404, `Strategy not found: ${strategyId}`);
      return;
    }
    if (!strategy.onPause) {
      this.sendError(res, 400, `Strategy does not support pause: ${strategyId}`);
      return;
    }
    const body = (parsedBody && typeof parsedBody === 'object') ? (parsedBody as any) : {};
    const opts = {
      marketId: typeof body.marketId === 'string' ? body.marketId : undefined,
      marketSymbol: typeof body.marketSymbol === 'string' ? body.marketSymbol : undefined,
      reason: 'control-api',
    };
    try {
      await strategy.onPause(opts);
      this.sendJson(res, 200, { success: true, message: 'Pause requested' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError(res, 500, `Pause failed: ${msg}`);
    }
  }

  private async handleResume(ctx: RequestContext, strategyId: string): Promise<void> {
    const { res, parsedBody } = ctx;
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      this.sendError(res, 404, `Strategy not found: ${strategyId}`);
      return;
    }
    if (!strategy.onResume) {
      this.sendError(res, 400, `Strategy does not support resume: ${strategyId}`);
      return;
    }
    const body = (parsedBody && typeof parsedBody === 'object') ? (parsedBody as any) : {};
    try {
      await strategy.onResume({
        reason: 'control-api',
        marketId: typeof body.marketId === 'string' ? body.marketId : undefined,
        marketSymbol: typeof body.marketSymbol === 'string' ? body.marketSymbol : undefined,
      });
      this.sendJson(res, 200, { success: true, message: 'Resume requested' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError(res, 500, `Resume failed: ${msg}`);
    }
  }

  private async handleRestart(ctx: RequestContext, strategyId: string): Promise<void> {
    const { res } = ctx;
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      this.sendError(res, 404, `Strategy not found: ${strategyId}`);
      return;
    }
    if (!strategy.onRestart) {
      this.sendError(res, 400, `Strategy does not support restart: ${strategyId}`);
      return;
    }
    try {
      await strategy.onRestart('control-api');
      this.sendJson(res, 200, { success: true, message: 'Restart requested' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError(res, 500, `Restart failed: ${msg}`);
    }
  }

  /**
   * Handle kill switch reset request
   */
  private async handleResetKillSwitch(ctx: RequestContext, strategyId: string): Promise<void> {
    const { res } = ctx;

    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      this.sendError(res, 404, `Strategy not found: ${strategyId}`);
      return;
    }

    if (!strategy.onResetKillSwitch) {
      this.sendError(res, 400, `Strategy does not support kill switch reset: ${strategyId}`);
      return;
    }

    try {
      await strategy.onResetKillSwitch('control-api');
      this.sendJson(res, 200, { success: true, message: 'Kill switch reset requested' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Kill switch reset failed', { strategyId, error: msg });
      this.sendError(res, 500, `Kill switch reset failed: ${msg}`);
    }
  }

  /**
   * Handle config validation endpoint
   */
  private async handleValidate(ctx: RequestContext): Promise<void> {
    const { method, res, parsedBody, url } = ctx;

    if (method !== 'POST') {
      this.sendError(res, 405, 'Method not allowed');
      return;
    }

    // Check for strategyId in query params
    const strategyId = url.searchParams.get('strategyId');

    if (this.singleConfigManager) {
      // Single-strategy mode
      const result = this.singleConfigManager.validateConfig(parsedBody);
      this.sendJson(res, result.success ? 200 : 400, result);
      return;
    }

    if (!strategyId) {
      this.sendError(res, 400, 'strategyId query parameter required in daemon mode');
      return;
    }

    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      this.sendError(res, 404, `Strategy not found: ${strategyId}`);
      return;
    }

    const result = strategy.configManager.validateConfig(parsedBody);
    this.sendJson(res, result.success ? 200 : 400, result);
  }

  private async handleUserListOrders(ctx: RequestContext): Promise<void> {
    const { res, parsedBody } = ctx;
    const body = parsedBody as any;
    const signingKey = body?.signingKey;
    const fingerprint = body?.fingerprint;
    const apiUrl = body?.apiUrl;

    if (!signingKey || !fingerprint) {
      this.sendError(res, 400, 'signingKey and fingerprint are required');
      return;
    }

    try {
      const { registerDynamicProfile } = await import('../core/config/profiles');
      const { ApiClient } = await import('../sdk/http/client');

      const profileName = '__user_orders';
      registerDynamicProfile(profileName, {
        signing_key: signingKey,
        signing_key_fingerprint: fingerprint,
        api_url: apiUrl || process.env.API_URL,
      });

      ApiClient.resetProfileInstance(profileName);
      const client = ApiClient.getInstanceForProfile(profileName);
      const orders = await client.listOrdersRaw({ status: 'active' });
      const sorted = (orders ?? []).sort((a: any, b: any) => {
        const tA = a.submitted_at || a.created_at || '';
        const tB = b.submitted_at || b.created_at || '';
        return tA < tB ? -1 : tA > tB ? 1 : 0;
      });
      this.sendJson(res, 200, { orders: sorted, hasMore: sorted.length >= 50 });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn('User list orders failed', { error: msg });
      this.sendError(res, 500, `Failed to list orders: ${msg}`);
    }
  }

  private async handleUserCancelAllOrders(ctx: RequestContext): Promise<void> {
    const { res, parsedBody } = ctx;
    const body = parsedBody as any;
    const signingKey = body?.signingKey;
    const fingerprint = body?.fingerprint;
    const apiUrl = body?.apiUrl;

    if (!signingKey || !fingerprint) {
      this.sendError(res, 400, 'signingKey and fingerprint are required');
      return;
    }

    try {
      const { registerDynamicProfile } = await import('../core/config/profiles');
      const { ApiClient } = await import('../sdk/http/client');

      const profileName = '__user_cancel';
      registerDynamicProfile(profileName, {
        signing_key: signingKey,
        signing_key_fingerprint: fingerprint,
        api_url: apiUrl || process.env.API_URL,
      });

      ApiClient.resetProfileInstance(profileName);
      const client = ApiClient.getInstanceForProfile(profileName);
      const orders = await client.listOrdersRaw({ status: 'active' });
      if (!orders || orders.length === 0) {
        this.sendJson(res, 200, { success: true, cancelled: 0, failed: 0, remaining: 0, details: [] });
        return;
      }

      const sorted = orders.sort((a: any, b: any) => {
        const tA = a.submitted_at || a.created_at || '';
        const tB = b.submitted_at || b.created_at || '';
        return tA < tB ? -1 : tA > tB ? 1 : 0;
      });

      const details: Array<{
        orderId: string;
        market: string;
        side: string;
        price: string;
        timestamp: string;
        result: 'cancelled' | 'failed';
        error?: string;
      }> = [];

      let cancelled = 0;
      let failed = 0;

      const results = await Promise.allSettled(
        sorted.map((o: any) => {
          const orderId = o.order_id || o.id;
          return client.cancelOrder(orderId, { maxRetries: 0 }).then(() => ({ order: o, ok: true })).catch((err: any) => ({ order: o, ok: false, err }));
        })
      );

      for (const r of results) {
        const val = r.status === 'fulfilled' ? r.value : (r as any).reason;
        const o = val?.order;
        const ok = val?.ok ?? false;
        if (ok) {
          cancelled++;
          details.push({
            orderId: o?.order_id || o?.id || '',
            market: o?.instrument_name || o?.market_name || o?.market_id || '',
            side: o?.side || '',
            price: String(o?.price ?? ''),
            timestamp: o?.submitted_at || o?.created_at || '',
            result: 'cancelled',
          });
        } else {
          failed++;
          details.push({
            orderId: o?.order_id || o?.id || '',
            market: o?.instrument_name || o?.market_name || o?.market_id || '',
            side: o?.side || '',
            price: String(o?.price ?? ''),
            timestamp: o?.submitted_at || o?.created_at || '',
            result: 'failed',
            error: val?.err?.message,
          });
        }
      }

      const remaining = await client.listOrdersRaw({ status: 'active' });
      this.sendJson(res, 200, {
        success: true,
        cancelled,
        failed,
        remaining: remaining?.length ?? 0,
        details,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('User cancel all orders failed', { error: msg });
      this.sendError(res, 500, `Failed to cancel orders: ${msg}`);
    }
  }

  private async handleUserPlaceOrder(ctx: RequestContext): Promise<void> {
    const { res, parsedBody } = ctx;
    const body = parsedBody as any;
    const signingKey = body?.signingKey;
    const fingerprint = body?.fingerprint;
    const apiUrl = body?.apiUrl;
    const order = body?.order;

    if (!signingKey || !fingerprint) {
      this.sendError(res, 400, 'signingKey and fingerprint are required');
      return;
    }

    if (!order || !order.market_id || !order.side || !order.type || !order.quantity) {
      this.sendError(res, 400, 'order object with market_id, side, type, and quantity is required');
      return;
    }

    try {
      const { registerDynamicProfile } = await import('../core/config/profiles');
      const { ApiClient } = await import('../sdk/http/client');

      const profileName = '__user_place';
      registerDynamicProfile(profileName, {
        signing_key: signingKey,
        signing_key_fingerprint: fingerprint,
        api_url: apiUrl || process.env.API_URL,
      });

      ApiClient.resetProfileInstance(profileName);
      const client = ApiClient.getInstanceForProfile(profileName);
      const result = await client.placeOrder(order);

      this.sendJson(res, 200, {
        success: true,
        order_id: result.order_id,
        order: result,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn('User place order failed', { error: msg });
      this.sendError(res, 500, `Failed to place order: ${msg}`);
    }
  }

  private async handleListAllOrders(ctx: RequestContext): Promise<void> {
    const { res } = ctx;
    if (!this.orderProvider) {
      this.sendJson(res, 200, { strategies: [] });
      return;
    }
    try {
      const results = await this.orderProvider.listAll();
      this.sendJson(res, 200, { strategies: results });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn('Failed to list all orders', { error: msg });
      this.sendError(res, 500, `Failed to list orders: ${msg}`);
    }
  }

  private async handleCancelAllOrders(ctx: RequestContext): Promise<void> {
    const { res } = ctx;
    if (!this.orderProvider) {
      this.sendError(res, 400, 'No order provider configured');
      return;
    }
    try {
      const result = await this.orderProvider.cancelAll();
      this.sendJson(res, 200, { success: true, message: 'All orders cancelled', ...result });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to cancel all orders', { error: msg });
      this.sendError(res, 500, `Failed to cancel all orders: ${msg}`);
    }
  }

  private handleStrategyMarkets(ctx: RequestContext, strategyId: string): void {
    const { res } = ctx;
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      this.sendError(res, 404, `Strategy not found: ${strategyId}`);
      return;
    }
    if (!strategy.getMarketStatuses) {
      this.sendJson(res, 200, { markets: [] });
      return;
    }
    try {
      const markets = strategy.getMarketStatuses();
      this.sendJson(res, 200, { markets });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError(res, 500, msg);
    }
  }

  private marketOptsFromSegment(marketSegment: string): {
    marketId?: string;
    marketSymbol?: string;
  } {
    const raw = decodeURIComponent(marketSegment);
    if (/^market_[0-9a-f-]{36}$/i.test(raw)) {
      return { marketId: raw };
    }
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)
    ) {
      return { marketId: raw };
    }
    return { marketSymbol: raw };
  }

  private async handleMarketPausePath(
    ctx: RequestContext,
    strategyId: string,
    marketSegment: string
  ): Promise<void> {
    const { res } = ctx;
    const strategy = this.strategies.get(strategyId);
    if (!strategy?.onPause) {
      this.sendError(res, 404, `Strategy not found: ${strategyId}`);
      return;
    }
    try {
      await strategy.onPause({
        ...this.marketOptsFromSegment(marketSegment),
        reason: 'control-api-market-pause',
      });
      this.sendJson(res, 200, { success: true, message: 'Market pause requested' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError(res, 500, msg);
    }
  }

  private async handleMarketResumePath(
    ctx: RequestContext,
    strategyId: string,
    marketSegment: string
  ): Promise<void> {
    const { res } = ctx;
    const strategy = this.strategies.get(strategyId);
    if (!strategy?.onResume) {
      this.sendError(res, 404, `Strategy not found: ${strategyId}`);
      return;
    }
    try {
      await strategy.onResume({
        ...this.marketOptsFromSegment(marketSegment),
        reason: 'control-api-market-resume',
      });
      this.sendJson(res, 200, { success: true, message: 'Market resume requested' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError(res, 500, msg);
    }
  }

  private async handlePatchMarket(
    ctx: RequestContext,
    strategyId: string,
    marketSegment: string
  ): Promise<void> {
    const { res, parsedBody } = ctx;
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      this.sendError(res, 404, `Strategy not found: ${strategyId}`);
      return;
    }
    if (!strategy.onPatchMarket) {
      this.sendError(res, 400, 'Per-market PATCH is not supported for this strategy type');
      return;
    }
    const patch =
      parsedBody && typeof parsedBody === 'object' && !Array.isArray(parsedBody)
        ? (parsedBody as Record<string, unknown>)
        : null;
    if (!patch || Object.keys(patch).length === 0) {
      this.sendError(res, 400, 'JSON object body with at least one field is required');
      return;
    }
    const marketKey = decodeURIComponent(marketSegment);
    try {
      const result = await strategy.onPatchMarket({ marketKey, patch });
      const applyWarnings = strategy.consumePendingApplyWarnings?.();
      this.sendConfigResult(res, result, applyWarnings);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError(res, 500, msg);
    }
  }

  private async handleProxyMarkets(ctx: RequestContext): Promise<void> {
    const { res } = ctx;
    try {
      const { ApiClient } = await import('../sdk/http/client');
      const client = ApiClient.getInstance();
      const markets = await client.getMarkets();
      this.sendJson(res, 200, { markets });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn('Proxy GET /markets failed', { error: msg });
      this.sendError(res, 502, `markets proxy failed: ${msg}`);
    }
  }

  private async handleProxyInstruments(ctx: RequestContext): Promise<void> {
    const { res, url } = ctx;
    try {
      const { ApiClient } = await import('../sdk/http/client');
      const client = ApiClient.getInstance();
      const params = Object.fromEntries(url.searchParams.entries());
      const instruments =
        Object.keys(params).length > 0 ? await client.getInstruments(params) : await client.listInstruments();
      this.sendJson(res, 200, { instruments });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn('Proxy GET /instruments failed', { error: msg });
      this.sendError(res, 502, `instruments proxy failed: ${msg}`);
    }
  }

  private savedConfigsDisabled(res: http.ServerResponse): boolean {
    if (!this.options.strategyConfigDbPath) {
      this.sendError(res, 503, 'strategyConfigDbPath not configured on control server');
      return true;
    }
    return false;
  }

  private serializeSavedRow(row: SavedStrategyConfigRow) {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      enabled: row.enabled === 1,
      config: row.config,
      credentialsEnvPrefix: row.credentialsEnvPrefix,
      version: row.version,
      notes: row.notes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async handleSavedConfigsList(ctx: RequestContext): Promise<void> {
    const { res } = ctx;
    if (this.savedConfigsDisabled(res)) return;
    const store = this.getStrategyConfigStore()!;
    const rows = store.list().map((r) => this.serializeSavedRow(r));
    this.sendJson(res, 200, { savedConfigs: rows });
  }

  private async handleSavedConfigsCreate(ctx: RequestContext): Promise<void> {
    const { res, parsedBody } = ctx;
    if (this.savedConfigsDisabled(res)) return;
    const body = parsedBody as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      this.sendError(res, 400, 'JSON body required');
      return;
    }
    const id = body.id as string | undefined;
    const name = body.name as string | undefined;
    const type = body.type as string | undefined;
    const config = body.config as Record<string, unknown> | undefined;
    if (!id?.trim() || !name?.trim() || !type?.trim() || !config || typeof config !== 'object') {
      this.sendError(res, 400, 'id, name, type, and config are required');
      return;
    }
    const input: CreateStrategyConfigInput = {
      id: id.trim(),
      name: name.trim(),
      type: type.trim(),
      config,
      enabled: body.enabled !== false,
      credentialsEnvPrefix:
        typeof body.credentialsEnvPrefix === 'string' ? body.credentialsEnvPrefix : null,
      notes: typeof body.notes === 'string' ? body.notes : null,
    };
    const store = this.getStrategyConfigStore()!;
    if (store.get(input.id)) {
      this.sendError(res, 409, `saved config already exists: ${input.id}`);
      return;
    }
    try {
      const row = store.create(input);
      this.sendJson(res, 201, { savedConfig: this.serializeSavedRow(row) });
    } catch (e: any) {
      logger.error('saved-configs create failed', { error: e?.message });
      this.sendError(res, 500, e?.message || 'create failed');
    }
  }

  private async handleSavedConfigOne(ctx: RequestContext, id: string): Promise<void> {
    const { method, res, parsedBody } = ctx;
    if (this.savedConfigsDisabled(res)) return;
    const store = this.getStrategyConfigStore()!;

    if (method === 'GET') {
      const row = store.get(id);
      if (!row) {
        this.sendError(res, 404, `saved config not found: ${id}`);
        return;
      }
      this.sendJson(res, 200, { savedConfig: this.serializeSavedRow(row) });
      return;
    }

    if (method === 'DELETE') {
      const ok = store.delete(id);
      if (!ok) {
        this.sendError(res, 404, `saved config not found: ${id}`);
        return;
      }
      this.sendJson(res, 200, { success: true, deleted: id });
      return;
    }

    if (method === 'PUT') {
      const body = parsedBody as Record<string, unknown> | null;
      if (!body?.name || !body?.type || !body?.config) {
        this.sendError(res, 400, 'name, type, and config are required for PUT');
        return;
      }
      const existing = store.get(id);
      if (!existing) {
        this.sendError(res, 404, `saved config not found: ${id}`);
        return;
      }
      const updated = store.update(id, {
        name: String(body.name),
        type: String(body.type),
        config: body.config as Record<string, unknown>,
        enabled: typeof body.enabled === 'boolean' ? body.enabled : existing.enabled === 1,
        credentialsEnvPrefix:
          typeof body.credentialsEnvPrefix === 'string' ? body.credentialsEnvPrefix : existing.credentialsEnvPrefix,
        notes: typeof body.notes === 'string' ? body.notes : existing.notes,
      });
      this.sendJson(res, 200, { savedConfig: this.serializeSavedRow(updated!) });
      return;
    }

    if (method === 'PATCH') {
      const body = (parsedBody || {}) as UpdateStrategyConfigInput;
      const existing = store.get(id);
      if (!existing) {
        this.sendError(res, 404, `saved config not found: ${id}`);
        return;
      }
      const updated = store.update(id, body);
      this.sendJson(res, 200, { savedConfig: this.serializeSavedRow(updated!) });
      return;
    }

    this.sendError(res, 405, 'Method not allowed');
  }

  private async handleSavedConfigActivate(ctx: RequestContext, id: string): Promise<void> {
    const { res, parsedBody } = ctx;
    if (this.savedConfigsDisabled(res)) return;
    const activator = this.options.onActivateSavedConfig;
    if (!activator) {
      this.sendError(res, 503, 'onActivateSavedConfig not configured');
      return;
    }
    const store = this.getStrategyConfigStore()!;
    const row = store.get(id);
    if (!row) {
      this.sendError(res, 404, `saved config not found: ${id}`);
      return;
    }
    let targetStrategyId: string | undefined;
    if (parsedBody && typeof parsedBody === 'object' && !Array.isArray(parsedBody)) {
      const b = parsedBody as Record<string, unknown>;
      if (typeof b.targetStrategyId === 'string' && b.targetStrategyId.trim() !== '') {
        targetStrategyId = b.targetStrategyId.trim();
      }
    }
    try {
      const result = await activator(row.id, row.config, { targetStrategyId });
      if (!result.success) {
        this.sendError(res, 400, result.error || 'activation failed');
        return;
      }
      const appliedTo = targetStrategyId ?? row.id;
      this.sendJson(res, 200, {
        success: true,
        savedConfigId: row.id,
        appliedToStrategyId: appliedTo,
        strategyId: appliedTo,
        version: row.version,
      });
    } catch (e: any) {
      this.sendError(res, 500, e?.message || 'activation failed');
    }
  }

  private async handleSavedConfigDuplicate(ctx: RequestContext, sourceId: string): Promise<void> {
    const { res, parsedBody } = ctx;
    if (this.savedConfigsDisabled(res)) return;
    const body = (parsedBody || {}) as { newId?: string; name?: string };
    const newId = body.newId?.trim();
    if (!newId) {
      this.sendError(res, 400, 'newId is required in body');
      return;
    }
    const store = this.getStrategyConfigStore()!;
    const src = store.get(sourceId);
    if (!src) {
      this.sendError(res, 404, `saved config not found: ${sourceId}`);
      return;
    }
    if (store.get(newId)) {
      this.sendError(res, 409, `saved config already exists: ${newId}`);
      return;
    }
    const row = store.create({
      id: newId,
      name: body.name?.trim() || `${src.name} (copy)`,
      type: src.type,
      config: { ...src.config },
      enabled: true,
      credentialsEnvPrefix: src.credentialsEnvPrefix,
      notes: src.notes,
    });
    this.sendJson(res, 201, { savedConfig: this.serializeSavedRow(row) });
  }

  /**
   * Read request body
   */
  private static readonly MAX_BODY_SIZE = 1024 * 1024; // 1 MB

  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalSize = 0;
      req.on('data', (chunk: Buffer) => {
        totalSize += chunk.length;
        if (totalSize > ControlServer.MAX_BODY_SIZE) {
          req.destroy();
          reject(new Error('Request body too large'));
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });
  }

  /**
   * Send JSON response
   */
  private sendJson(res: http.ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
  }

  /**
   * Send error response
   */
  private sendError(res: http.ServerResponse, status: number, message: string): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: message }));
  }

  /**
   * Send config update result. Accepts an optional `applyWarnings` array so
   * callers can surface per-market apply failures that happened after the
   * config persisted to disk (e.g. a newly-added market whose instrument
   * resolution threw).
   */
  private sendConfigResult(
    res: http.ServerResponse,
    result: ConfigUpdateResult<unknown>,
    applyWarnings?: Array<{
      marketKey: string;
      phase: 'add' | 'remove' | 're-init';
      reason: string;
      at: number;
    }>
  ): void {
    if (result.success) {
      const body: Record<string, unknown> = {
        success: true,
        config: result.config,
      };
      if (applyWarnings && applyWarnings.length > 0) {
        body.applyWarnings = applyWarnings;
      }
      this.sendJson(res, 200, body);
      return;
    }
    // Validation failures are a client problem (400). Everything else
    // (persistence / durable store failures) is a server problem (500) —
    // critical that callers don't see a 2xx when the config didn't persist.
    const isValidation = !!result.validationErrors;
    const status = isValidation ? 400 : 500;
    this.sendJson(res, status, {
      success: false,
      error: result.error,
      validationErrors: result.validationErrors,
    });
  }

  /**
   * Get server address info
   */
  getAddress(): { port: number; host: string } | null {
    if (!this.server || !this.isRunning) {
      return null;
    }
    return this.boundAddress || { port: this.options.port, host: this.options.host };
  }
}

/**
 * Export types
 */
export type { ConfigUpdateResult };
