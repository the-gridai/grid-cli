/**
 * Multi-Strategy Runner
 * 
 * Orchestrates multiple trading strategies running concurrently.
 * Provides aggregated health endpoints and graceful lifecycle management.
 * Includes a control API for dynamic configuration updates.
 * 
 * @module multi-strategy-runner
 */

import http from 'http';
import { logger } from '../core/logging/logger';
import {
  initSentry,
  setTag,
  flush as flushSentry
} from '../core/observability';
import { StrategyInstance, StrategyInstanceStatus } from './strategy-instance';
import { ControlServer, type RegisteredStrategy } from './control-server';
import type { MultiStrategyConfig, StrategyInstanceConfig } from './multi-strategy-config';
import { StrategyConfigStore } from '../core/persistence/StrategyConfigStore';
import { recordDiagnosticBreadcrumb } from '../core/diagnostics/fatal-diagnostics';

function sanitizePrometheusLabel(value: string): string {
  return value.replace(/[\\"]/g, '').replace(/\n/g, ' ');
}

/**
 * Aggregated status for all strategy instances
 */
export interface AggregatedStatus {
  mode: 'multi';
  healthy: boolean;
  uptime: number;
  instances: StrategyInstanceStatus[];
  timestamp: string;
}

/**
 * Multi-Strategy Runner
 * 
 * Manages lifecycle of multiple strategy instances with:
 * - Parallel startup with error isolation
 * - Aggregated health/status endpoints
 * - Control API for dynamic configuration
 * - Graceful shutdown of all instances
 */
export interface MultiStrategyRunnerOptions {
  /**
   * Externally-owned StrategyConfigStore. When provided the runner does NOT
   * close it on shutdown — the caller is responsible for lifecycle. This lets
   * seed, merge, and write-through all share a single SQLite connection.
   */
  configStore?: StrategyConfigStore;
}

export class MultiStrategyRunner {
  private config: MultiStrategyConfig;
  private configPath: string | null = null;
  private instances: Map<string, StrategyInstance> = new Map();
  private healthServer: http.Server | null = null;
  private controlServer: ControlServer | null = null;
  private configStore: StrategyConfigStore | null = null;
  private ownsConfigStore: boolean = false;
  private startedAt: Date | null = null;
  private isRunning: boolean = false;
  private registeredControlStrategies: Set<string> = new Set();

  constructor(
    config: MultiStrategyConfig,
    configPath?: string,
    options?: MultiStrategyRunnerOptions
  ) {
    this.config = config;
    this.configPath = configPath || null;
    if (options?.configStore) {
      this.configStore = options.configStore;
      this.configStore.init();
      this.ownsConfigStore = false;
    }
  }

  /**
   * Lazily create (or return existing) StrategyConfigStore for write-through persistence.
   * Returns null if no DB path can be resolved.
   */
  private getOrCreateConfigStore(): StrategyConfigStore | null {
    if (this.configStore) return this.configStore;

    const dbPath =
      this.config.global?.strategyConfigDbPath ||
      process.env.STRATEGY_CONFIG_DB_PATH ||
      process.env.GRID_SQLITE_PATH;

    try {
      this.configStore = new StrategyConfigStore(dbPath);
      this.configStore.init();
      this.ownsConfigStore = true;
      return this.configStore;
    } catch (err) {
      logger.error('Failed to initialize StrategyConfigStore for write-through', { error: err });
      return null;
    }
  }

  /**
   * Start all enabled strategy instances
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('MultiStrategyRunner already running');
      return;
    }

    const healthPort = this.config.global?.healthPort || 8080;
    const enabledStrategies = this.config.strategies.filter(s => s.enabled);
    recordDiagnosticBreadcrumb('multi_runner_start', {
      healthPort,
      controlPort: this.config.global?.controlPort,
      enabledStrategyIds: enabledStrategies.map((s) => s.id),
      enabledStrategyCount: enabledStrategies.length,
    });

    console.log('\n' + '═'.repeat(60));
    console.log('🚀 GRID CLI Multi-Strategy Daemon');
    console.log('═'.repeat(60));
    console.log(`Mode: multi-strategy`);
    console.log(`Strategies: ${enabledStrategies.length} enabled`);
    console.log(`Health Port: ${healthPort}`);
    console.log('═'.repeat(60) + '\n');

    // Initialize observability
    if (this.config.global?.sentryEnabled !== false) {
      initSentry();
    }
    setTag('daemon_mode', 'multi');
    setTag('strategy_count', String(enabledStrategies.length));

    // Start health server first (always available)
    await this.startHealthServer(healthPort);

    this.startedAt = new Date();
    this.isRunning = true;

    // Create all instances up-front so status/control views are complete.
    for (const strategyConfig of enabledStrategies) {
      const instance = new StrategyInstance(strategyConfig);
      this.instances.set(strategyConfig.id, instance);
    }

    // Start in a deterministic order: issuer first, then activity simulator, then others.
    const startupOrder = this.orderStrategiesForStartup(enabledStrategies);

    // Bind the control API before slow strategy startup. With many markets,
    // scheduled-issuer initialization can take minutes; dashboard reads should
    // still receive config/status instead of nginx connection-refused errors.
    const controlPort = this.config.global?.controlPort;
    const enableControlApi = this.config.global?.enableControlApi ?? (controlPort !== undefined);

    if (enableControlApi) {
      const port = controlPort || healthPort + 1;
      await this.startControlServer(port);
    }

    for (const strategyConfig of startupOrder) {
      const instance = this.instances.get(strategyConfig.id);
      if (!instance) continue;

      try {
        recordDiagnosticBreadcrumb('multi_runner_strategy_starting', {
          strategyId: strategyConfig.id,
          strategyName: strategyConfig.name,
          strategyType: strategyConfig.type,
        });
        await instance.start();
        this.registerInstanceWithControlServer(strategyConfig.id, instance);
        recordDiagnosticBreadcrumb('multi_runner_strategy_started', {
          strategyId: strategyConfig.id,
          strategyName: strategyConfig.name,
          strategyType: strategyConfig.type,
        });
      } catch (error: any) {
        recordDiagnosticBreadcrumb('multi_runner_strategy_start_failed', {
          strategyId: strategyConfig.id,
          strategyName: strategyConfig.name,
          strategyType: strategyConfig.type,
          error: error?.message || String(error),
        });
        logger.error(`[${strategyConfig.id}] Failed to start`, {
          error: error.message,
        });
        console.error(`❌ [${strategyConfig.id}] Failed to start: ${error.message}`);
        // Continue so one failure does not block other strategies.
      }
    }

    // Log summary
    const runningCount = Array.from(this.instances.values())
      .filter(i => i.isHealthy()).length;

    console.log('\n' + '═'.repeat(60));
    console.log(`✅ Started ${runningCount}/${enabledStrategies.length} strategies`);

    for (const instance of this.instances.values()) {
      const status = instance.getStatus();
      const icon = status.status === 'running' ? '✓' : '✗';
      const color = status.status === 'running' ? '\x1b[32m' : '\x1b[31m';
      console.log(`${color}  ${icon} ${status.name} (${status.type}): ${status.status}\x1b[0m`);
    }

    console.log('═'.repeat(60));
    console.log(`\n🏥 Health: http://0.0.0.0:${healthPort}/health`);
    console.log(`📊 Status: http://0.0.0.0:${healthPort}/status`);
    if (this.controlServer) {
      const addr = this.controlServer.getAddress();
      if (addr) {
        console.log(`🎛️  Config: http://0.0.0.0:${addr.port}/config`);
      }
    }
    console.log('\nPress Ctrl+C to stop\n');

    // Setup graceful shutdown handlers
    this.setupShutdownHandlers();
  }

  private orderStrategiesForStartup(enabledStrategies: StrategyInstanceConfig[]): StrategyInstanceConfig[] {
    // Lower startupPriority starts first; instances without one keep their
    // config-file order after prioritized instances.
    return [...enabledStrategies].sort((a, b) => {
      const aPriority = a.startupPriority ?? 100;
      const bPriority = b.startupPriority ?? 100;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return 0;
    });
  }

  /**
   * Stop all strategy instances
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('\n⏹️  Stopping multi-strategy daemon...');
    this.isRunning = false;

    // Stop all instances in parallel
    const stopPromises = Array.from(this.instances.values()).map(async instance => {
      try {
        await instance.stop();
        console.log(`  ✓ Stopped ${instance.getName()}`);
      } catch (error: any) {
        console.error(`  ✗ Error stopping ${instance.getName()}: ${error.message}`);
      }
    });

    await Promise.all(stopPromises);

    // Stop control server
    if (this.controlServer) {
      await this.controlServer.stop();
      console.log('  ✓ Control server stopped');
    }

    // Stop health server
    if (this.healthServer) {
      await new Promise<void>((resolve) => {
        this.healthServer!.close(() => resolve());
      });
      console.log('  ✓ Health server stopped');
    }

    // Close SQLite config store (only if we own it; externally-provided stores
    // are the caller's responsibility).
    if (this.configStore && this.ownsConfigStore) {
      this.configStore.close();
      this.configStore = null;
    }

    // Flush Sentry events
    await flushSentry(2000);

    console.log('\n✅ Multi-strategy daemon stopped gracefully\n');
  }

  /**
   * Get aggregated status of all instances
   */
  getAggregatedStatus(): AggregatedStatus {
    const instances = Array.from(this.instances.values()).map(i => i.getStatus());
    // Healthy if at least one strategy is running (partial availability is OK)
    const anyHealthy = instances.length > 0 && instances.some(i => i.status === 'running');
    const uptime = this.startedAt ? Date.now() - this.startedAt.getTime() : 0;

    return {
      mode: 'multi',
      healthy: anyHealthy,
      uptime,
      instances,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Start the control API server for dynamic config updates
   */
  private async startControlServer(port: number): Promise<void> {
    recordDiagnosticBreadcrumb('control_server_starting', { port });
    const controlApiProfile = this.config.global?.controlApiProfile;
    const strategyConfigDbPath =
      this.config.global?.strategyConfigDbPath ||
      process.env.STRATEGY_CONFIG_DB_PATH ||
      process.env.GRID_SQLITE_PATH;

    // Reuse the runner's shared store when available so write-through updates and
    // HTTP reads share one SQLite connection under the default journaling mode.
    // Fall back to the path so environments that boot the control server without
    // pre-seeding still get saved-config CRUD.
    const sharedStore = this.getOrCreateConfigStore() ?? undefined;

    this.controlServer = new ControlServer({
      port,
      profile: controlApiProfile,
      requireAuth: true,
      allowUnauthenticatedReads: true,
      strategyConfigDbPath,
      configStore: sharedStore,
      onActivateSavedConfig: async (savedId, cfg, opts) => {
        const targetId = opts?.targetStrategyId?.trim() || savedId;
        const instance = this.instances.get(targetId);
        if (!instance || !instance.isHealthy()) {
          return { success: false, error: 'Strategy instance not running' };
        }
        const cm = instance.getConfigManager();
        if (!cm) {
          return { success: false, error: 'Strategy does not support dynamic config' };
        }
        const result = await cm.replaceConfig(cfg as any);
        return { success: !!result.success, error: result.error };
      },
    });

    // Register any instances that are already ready. During normal startup the
    // control server is bound before strategies initialize, so most instances
    // register after their individual `start()` completes.
    for (const [id, instance] of this.instances) {
      this.registerInstanceWithControlServer(id, instance);
    }

    // Wire status provider so /status and /health work on the control port too
    this.controlServer.setStatusProvider(() => this.getAggregatedStatus());

    // Wire order provider so /orders/all and /orders/cancel-all can reach ALL instances
    this.controlServer.setOrderProvider({
      listAll: async () => {
        const results: Array<{ strategyId: string; strategyName: string; strategyType: string; orders: any[] }> = [];
        for (const [id, instance] of this.instances) {
          if (!instance.isHealthy()) continue;
          try {
            const orders = await instance.listOrders();
            results.push({ strategyId: id, strategyName: instance.getName(), strategyType: instance.getType(), orders });
          } catch {
            results.push({ strategyId: id, strategyName: instance.getName(), strategyType: instance.getType(), orders: [] });
          }
        }
        return results;
      },
      cancelAll: async () => {
        let totalCancelled = 0;
        let totalFailed = 0;
        const allMarkets: string[] = [];
        const MAX_PASSES = 10;

        for (let pass = 0; pass < MAX_PASSES; pass++) {
          let passCancelled = 0;
          for (const [, instance] of this.instances) {
            if (!instance.isHealthy()) continue;
            try {
              const result = await instance.cancelOrders({ reason: 'cancel-all-global' });
              passCancelled += result.cancelled;
              totalCancelled += result.cancelled;
              totalFailed += result.failed;
              if (pass === 0) allMarkets.push(...result.markets);
            } catch {
              totalFailed++;
            }
          }
          if (passCancelled === 0) break;
          await new Promise(r => setTimeout(r, 1000));
        }

        return { cancelled: totalCancelled, failed: totalFailed, markets: allMarkets };
      },
    });

    try {
      await this.controlServer.start();
      recordDiagnosticBreadcrumb('control_server_started', { port });
      logger.info('Control server started', { port });
    } catch (error: any) {
      recordDiagnosticBreadcrumb('control_server_start_failed', {
        port,
        error: error?.message || String(error),
      });
      throw error;
    }
  }

  private registerInstanceWithControlServer(id: string, instance: StrategyInstance): void {
    if (!this.controlServer || this.registeredControlStrategies.has(id)) return;

    const configManager = instance.getConfigManager();
    if (!configManager) {
      logger.debug(`Strategy ${id} is not ready for control registration`);
      return;
    }

    const registration: RegisteredStrategy = {
      id,
      name: instance.getName(),
      type: instance.getType(),
      configManager,
      onConfigUpdate: async (newConfig, oldConfig) => {
        await instance.applyConfigUpdate(newConfig, oldConfig);
      },
      onResetKillSwitch: async (reason?: string) => {
        await instance.resetKillSwitch(reason);
      },
      onCancelOrders: async (opts) => {
        return await instance.cancelOrders(opts);
      },
      onPause: async (opts) => {
        await instance.pause(opts);
      },
      onResume: async (opts) => {
        await instance.resume(opts);
      },
      onRestart: async () => {
        await instance.restart();
      },
      onListOrders: async () => {
        return await instance.listOrders();
      },
      getMarketStatuses: () => instance.getMarketStatuses() ?? [],
      onPatchMarket: async ({ marketKey, patch }) => {
        return await instance.patchMarket(marketKey, patch);
      },
      consumePendingApplyWarnings: () => instance.consumePendingApplyWarnings?.() ?? [],
    };

    this.controlServer.registerStrategy(registration);
    this.registeredControlStrategies.add(id);
    logger.info(`Registered strategy ${id} with control server`);

    const store = this.getOrCreateConfigStore();
    if (store) {
      configManager.onConfigChange(
        (
          newConfig: Record<string, unknown>,
          _oldConfig,
          context
        ) => {
          const actor =
            (context?.actor as string | undefined) ?? 'control-api';
          const reason =
            (context?.reason as string | undefined) ?? 'config-update';

          const existing = store.get(id);
          if (existing) {
            store.update(id, { config: newConfig, actor, reason });
          } else {
            store.create({
              id,
              name: instance.getName(),
              type: instance.getType(),
              config: newConfig,
              actor,
              reason,
            });
          }
          logger.debug(`Persisted config update to SQLite`, {
            strategyId: id,
            actor,
            reason,
          });
        },
        { critical: true }
      );
    } else {
      logger.error(
        `Write-through disabled for ${id}: no SQLite store available — ` +
          `config changes will NOT survive restart`
      );
    }
  }

  /**
   * Start the health/status HTTP server
   */
  private async startHealthServer(port: number): Promise<void> {
    this.healthServer = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${port}`);

      const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
        'http://127.0.0.1:3000',
      ];
      const origin = req.headers.origin || '';
      if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
      res.setHeader('Content-Type', 'application/json');

      switch (url.pathname) {
        case '/live':
        case '/livez': {
          // Liveness only proves the Node process/event loop can answer.
          // Strategy readiness belongs on /ready so slow market startup does
          // not create a kubelet kill/restart loop.
          res.writeHead(200);
          res.end(JSON.stringify({
            alive: true,
            mode: 'multi',
            uptime: this.startedAt ? Date.now() - this.startedAt.getTime() : 0,
          }));
          break;
        }

        case '/health':
        case '/healthz': {
          // Liveness probe - at least one strategy running
          const status = this.getAggregatedStatus();
          const hasRunning = status.instances.some(i => i.status === 'running');
          res.writeHead(hasRunning || !this.isRunning ? 200 : 503);
          res.end(JSON.stringify({
            status: hasRunning ? 'healthy' : 'unhealthy',
            mode: 'multi',
            strategies: status.instances.length,
            running: status.instances.filter(i => i.status === 'running').length,
          }));
          break;
        }

        case '/ready':
        case '/readyz': {
          // Readiness probe - all enabled strategies running
          const status = this.getAggregatedStatus();
          res.writeHead(status.healthy ? 200 : 503);
          res.end(JSON.stringify({
            ready: status.healthy,
            mode: 'multi',
            strategies: status.instances.length,
            running: status.instances.filter(i => i.status === 'running').length,
          }));
          break;
        }

        case '/status': {
          // Detailed status for debugging
          const status = this.getAggregatedStatus();
          res.writeHead(200);
          res.end(JSON.stringify(status, null, 2));
          break;
        }

        case '/metrics': {
          // Prometheus-style metrics
          res.setHeader('Content-Type', 'text/plain');
          res.writeHead(200);
          res.end(this.getPrometheusMetrics());
          break;
        }

        default:
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Not found' }));
      }
    });

    await new Promise<void>((resolve, reject) => {
      this.healthServer!.on('error', reject);
      this.healthServer!.listen(port, '0.0.0.0', () => {
        logger.info('Health server started', { port });
        resolve();
      });
    });
  }

  /**
   * Generate Prometheus-style metrics
   */
  private getPrometheusMetrics(): string {
    const status = this.getAggregatedStatus();
    const lines: string[] = [
      '# HELP grid_cli_multi_daemon_up Whether the multi-strategy daemon is up',
      '# TYPE grid_cli_multi_daemon_up gauge',
      `grid_cli_multi_daemon_up 1`,
      '',
      '# HELP grid_cli_multi_daemon_strategies_total Total number of configured strategies',
      '# TYPE grid_cli_multi_daemon_strategies_total gauge',
      `grid_cli_multi_daemon_strategies_total ${status.instances.length}`,
      '',
      '# HELP grid_cli_multi_daemon_strategies_running Number of running strategies',
      '# TYPE grid_cli_multi_daemon_strategies_running gauge',
      `grid_cli_multi_daemon_strategies_running ${status.instances.filter(i => i.status === 'running').length}`,
      '',
      '# HELP grid_cli_multi_daemon_uptime_seconds Daemon uptime in seconds',
      '# TYPE grid_cli_multi_daemon_uptime_seconds gauge',
      `grid_cli_multi_daemon_uptime_seconds ${Math.floor(status.uptime / 1000)}`,
      '',
      '# HELP grid_cli_strategy_status Strategy instance status (1=running, 0=not running)',
      '# TYPE grid_cli_strategy_status gauge',
    ];

    for (const instance of status.instances) {
      const running = instance.status === 'running' ? 1 : 0;
      const id = sanitizePrometheusLabel(instance.id);
      const name = sanitizePrometheusLabel(instance.name);
      const type = sanitizePrometheusLabel(instance.type);
      lines.push(`grid_cli_strategy_status{id="${id}",name="${name}",type="${type}"} ${running}`);
    }

    lines.push('');
    lines.push('# HELP grid_cli_strategy_uptime_seconds Strategy instance uptime in seconds');
    lines.push('# TYPE grid_cli_strategy_uptime_seconds gauge');

    for (const instance of status.instances) {
      const uptime = Math.floor(instance.metrics.uptime / 1000);
      const id = sanitizePrometheusLabel(instance.id);
      const name = sanitizePrometheusLabel(instance.name);
      const type = sanitizePrometheusLabel(instance.type);
      lines.push(`grid_cli_strategy_uptime_seconds{id="${id}",name="${name}",type="${type}"} ${uptime}`);
    }

    return lines.join('\n') + '\n';
  }

  private shutdownHandlersRegistered = false;

  /**
   * Setup graceful shutdown signal handlers (idempotent)
   */
  private setupShutdownHandlers(): void {
    if (this.shutdownHandlersRegistered) return;
    this.shutdownHandlersRegistered = true;

    let isShuttingDown = false;
    const shutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      console.log(`\n⚠️  Received ${signal}, initiating graceful shutdown...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}
