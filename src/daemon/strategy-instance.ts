/**
 * Strategy Instance Wrapper
 * 
 * Wraps individual strategy execution with lifecycle management,
 * status tracking, and error isolation. Each instance manages one
 * strategy type (scheduled-issuer or multi-market-maker).
 * 
 * @module strategy-instance
 */

import { logger } from '../core/logging/logger';
import { captureException, setTag, setContext } from '../core/observability';
import type { StrategyInstanceConfig, StrategyCredentials } from './multi-strategy-config';
import type { ConfigManager, ConfigUpdateResult } from '../core/config/config-manager';
import { isDynamicConfigStrategy, type DynamicConfigStrategy } from '../strategies/base-strategy';
import { recordDiagnosticBreadcrumb } from '../core/diagnostics/fatal-diagnostics';

/**
 * Instance status values
 */
export type InstanceStatus = 'stopped' | 'starting' | 'running' | 'error' | 'stopping';

/**
 * Status information for a strategy instance
 */
export interface StrategyInstanceStatus {
  id: string;
  name: string;
  type: string;
  status: InstanceStatus;
  startedAt: Date | null;
  lastError: string | null;
  metrics: {
    uptime: number;
  };
  /** Optional per-market breakdown (e.g. scheduled-issuer). */
  markets?: Array<Record<string, unknown>>;
  /** When `markets` is set, same as `markets.length` (convenience for /status). */
  marketCount?: number;
}

/**
 * Strategy interface that all strategies implement
 */
interface Strategy {
  start(): Promise<void>;
  stop(): Promise<void>;
}

function validationIssues(error: any): Array<Record<string, unknown>> | undefined {
  const issues = error?.issues || error?.errors;
  if (!Array.isArray(issues)) return undefined;

  return issues.map((issue: any) => ({
    path: Array.isArray(issue?.path) ? issue.path.join('.') : String(issue?.path ?? ''),
    message: issue?.message,
    code: issue?.code,
  }));
}

function summarizeStrategyConfig(config: Record<string, unknown>): Record<string, unknown> {
  const markets = Array.isArray(config.markets)
    ? config.markets.map((market: any, index) => ({
        index,
        instrumentSymbol: market?.instrumentSymbol,
        instrumentId: market?.instrumentId,
        marketSymbol: market?.marketSymbol,
        marketId: market?.marketId,
        enabled: market?.enabled,
        quantity: market?.quantity,
      }))
    : undefined;

  return {
    mode: config.mode,
    profile: config.profile,
    instrumentSymbol: config.instrumentSymbol,
    instrumentId: config.instrumentId,
    marketSymbol: config.marketSymbol,
    marketId: config.marketId,
    quantity: config.quantity,
    marketsCount: markets?.length,
    markets,
  };
}

/**
 * Wraps a single strategy with lifecycle management
 */
export class StrategyInstance {
  private readonly id: string;
  private readonly name: string;
  private readonly type: string;
  // Keep the latest config so pause/restart uses current settings.
  private strategyConfig: Record<string, unknown>;
  private readonly credentials: StrategyCredentials;

  private strategy: Strategy | null = null;
  private status: InstanceStatus = 'stopped';
  private startedAt: Date | null = null;
  private lastError: string | null = null;

  constructor(config: StrategyInstanceConfig) {
    this.id = config.id;
    this.name = config.name || config.id;
    this.type = config.type;
    this.strategyConfig = config.config ?? {};
    this.credentials = config.credentials;
  }

  /**
   * Apply prefixed credentials and return a unique profile name for this strategy.
   * This creates a unique profile for each strategy so they don't share credentials.
   */
  private async applyCredentials(): Promise<string | undefined> {
    const prefix = this.credentials?.envPrefix;
    if (!prefix) {
      // Log the default credentials being used
      this.logCredentialInfo('(default/env)');
      return undefined; // No prefix, use default credentials
    }

    // Create a unique profile name for this strategy
    const profileName = `__strategy_${this.id}`;

    // Get the prefixed credentials
    const signingKey = process.env[`${prefix}SIGNING_KEY`] || process.env[`${prefix}PRIVATE_KEY`];
    const fingerprint = process.env[`${prefix}SIGNING_KEY_FINGERPRINT`] || process.env[`${prefix}API_KEY_FINGERPRINT`];

    if (!signingKey || !fingerprint) {
      logger.warn(`[${this.name}] Missing credentials for prefix ${prefix}`);
      console.log(`[${this.name}] ⚠️ Missing credentials for prefix ${prefix}`);
      this.logCredentialInfo(prefix);
      return undefined;
    }

    // Store credentials in env vars with the profile-specific prefix
    // This allows getConfigForProfile to pick them up
    process.env[`GRID_PROFILE_${profileName}_SIGNING_KEY`] = signingKey;
    process.env[`GRID_PROFILE_${profileName}_SIGNING_KEY_FINGERPRINT`] = fingerprint;

    // Also set as standard env vars for the profile system to find
    // Each profile gets its own set of credentials stored with the strategy ID
    const { registerDynamicProfile } = await import('../core/config/profiles');
    registerDynamicProfile(profileName, {
      signing_key: signingKey,
      signing_key_fingerprint: fingerprint,
      api_url: process.env.API_URL,
      ws_url: process.env.WS_URL,
    });

    logger.info(`[${this.name}] Registered dynamic profile: ${profileName} with prefix: ${prefix}`);
    this.logCredentialInfo(prefix);

    return profileName;
  }

  /**
   * Log credential info for debugging (without exposing secrets)
   */
  private logCredentialInfo(source: string): void {
    // Look for credentials with the prefix first, then fall back to global
    const prefix = this.credentials?.envPrefix || '';
    const fingerprint = process.env[`${prefix}SIGNING_KEY_FINGERPRINT`]
      || process.env[`${prefix}API_KEY_FINGERPRINT`]
      || process.env.SIGNING_KEY_FINGERPRINT
      || process.env.API_KEY_FINGERPRINT;
    const signingKey = process.env[`${prefix}SIGNING_KEY`]
      || process.env[`${prefix}PRIVATE_KEY`]
      || process.env.SIGNING_KEY
      || process.env.PRIVATE_KEY;

    console.log(`[${this.name}] Credentials loaded from: ${source}`);
    console.log(`[${this.name}]    Fingerprint: ${fingerprint ? 'set' : '(not set)'}`);
    console.log(`[${this.name}]    Signing Key: ${signingKey ? 'set' : '(not set)'}`);

    logger.info(`[${this.name}] Credentials loaded`, {
      source,
      hasFingerprint: !!fingerprint,
      hasSigningKey: !!signingKey,
    });
  }

  /**
   * Get the instance ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * Get the instance name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get the strategy type
   */
  getType(): string {
    return this.type;
  }

  /**
   * Start the strategy instance
   */
  async start(): Promise<void> {
    if (this.status === 'running' || this.status === 'starting') {
      logger.warn(`[${this.name}] Strategy already running/starting`);
      return;
    }

    this.status = 'starting';
    this.lastError = null;

    logger.info(`[${this.name}] Starting strategy instance`, {
      type: this.type,
      id: this.id,
    });
    recordDiagnosticBreadcrumb('strategy_instance_starting', {
      strategyId: this.id,
      strategyName: this.name,
      strategyType: this.type,
      config: summarizeStrategyConfig(this.strategyConfig),
    });

    try {
      // Apply per-strategy credentials if configured and get unique profile name
      const profileName = await this.applyCredentials();

      // Create the strategy based on type, passing the profile for credential isolation
      console.log(`[${this.name}] Creating strategy instance (${this.type})...`);
      recordDiagnosticBreadcrumb('strategy_instance_create_strategy', {
        strategyId: this.id,
        strategyName: this.name,
        strategyType: this.type,
        profileName,
      });
      this.strategy = await this.createStrategy(profileName);
      console.log(`[${this.name}] Strategy created, calling start()...`);

      // Start the strategy
      await this.strategy.start();

      this.status = 'running';
      this.startedAt = new Date();

      console.log(`[${this.name}] ✓ Strategy instance started successfully`);
      logger.info(`[${this.name}] Strategy instance started successfully`);
      recordDiagnosticBreadcrumb('strategy_instance_started', {
        strategyId: this.id,
        strategyName: this.name,
        strategyType: this.type,
      });
    } catch (error: any) {
      this.status = 'error';
      this.lastError = error.message;
      const issues = validationIssues(error);

      console.error(`[${this.name}] ✗ Failed to start:`, error.message);
      logger.error(`[${this.name}] Failed to start strategy`, {
        error: error.message,
        stack: error.stack,
        validationIssues: issues,
        config: summarizeStrategyConfig(this.strategyConfig),
      });
      recordDiagnosticBreadcrumb('strategy_instance_start_failed', {
        strategyId: this.id,
        strategyName: this.name,
        strategyType: this.type,
        error: error.message,
        validationIssues: issues,
        config: summarizeStrategyConfig(this.strategyConfig),
      });

      captureException(error, {
        strategyId: this.id,
        strategyType: this.type,
      });

      throw error;
    }
  }

  /**
   * Stop the strategy instance
   */
  async stop(): Promise<void> {
    if (this.status === 'stopped' || this.status === 'stopping') {
      return;
    }

    this.status = 'stopping';
    logger.info(`[${this.name}] Stopping strategy instance`);

    try {
      if (this.strategy) {
        await this.strategy.stop();
        this.strategy = null;
      }

      this.status = 'stopped';
      logger.info(`[${this.name}] Strategy instance stopped`);
    } catch (error: any) {
      this.status = 'error';
      this.lastError = error.message;

      logger.error(`[${this.name}] Error stopping strategy`, {
        error: error.message,
      });
    }
  }

  /**
   * Get current status of the instance
   */
  getStatus(): StrategyInstanceStatus {
    const uptime = this.startedAt
      ? Date.now() - this.startedAt.getTime()
      : 0;

    const s: any = this.strategy;
    const markets =
      s && typeof s.getMarketStatuses === 'function' ? s.getMarketStatuses() : undefined;

    return {
      id: this.id,
      name: this.name,
      type: this.type,
      status: this.status,
      startedAt: this.startedAt,
      lastError: this.lastError,
      metrics: {
        uptime,
      },
      ...(Array.isArray(markets)
        ? { markets, marketCount: markets.length }
        : {}),
    };
  }

  /**
   * Check if the instance is healthy
   */
  isHealthy(): boolean {
    return this.status === 'running';
  }

  /**
   * Check if the strategy supports dynamic config updates
   */
  supportsDynamicConfig(): boolean {
    return this.strategy !== null && isDynamicConfigStrategy(this.strategy);
  }

  /**
   * Get the ConfigManager if the strategy supports dynamic config
   */
  getConfigManager(): ConfigManager<any> | null {
    if (this.strategy && isDynamicConfigStrategy(this.strategy)) {
      return (this.strategy as DynamicConfigStrategy).getConfigManager();
    }
    return null;
  }

  /**
   * Apply a config update to the running strategy
   */
  async applyConfigUpdate(newConfig: any, oldConfig: any): Promise<void> {
    if (this.strategy && isDynamicConfigStrategy(this.strategy)) {
      await (this.strategy as DynamicConfigStrategy).onConfigUpdate(newConfig, oldConfig);
      // Persist for future restart/resume.
      this.strategyConfig = newConfig as Record<string, unknown>;
    } else {
      throw new Error('Strategy does not support dynamic config updates');
    }
  }

  /**
   * Cancel active orders (best-effort; may be scoped by marketId/marketSymbol).
   */
  async cancelOrders(opts?: { marketId?: string; marketSymbol?: string; reason?: string }): Promise<{
    cancelled: number;
    failed: number;
    markets: string[];
  }> {
    const s: any = this.strategy as any;
    if (s && typeof s.cancelOrders === 'function') {
      return await s.cancelOrders(opts);
    }
    if (s && typeof s.cancelAllOrders === 'function') {
      return await s.cancelAllOrders(opts);
    }
    // As a fallback, try a no-op config refresh if dynamic config exists (some strategies cancel on update).
    const cm = this.getConfigManager();
    if (cm && this.strategy && isDynamicConfigStrategy(this.strategy)) {
      const current = cm.getConfig();
      await (this.strategy as DynamicConfigStrategy).onConfigUpdate(current, current);
    }
    return { cancelled: 0, failed: 0, markets: [] };
  }

  /**
   * Pause strategy: cancel orders then stop.
   */
  async pause(opts?: { marketId?: string; marketSymbol?: string; reason?: string }): Promise<void> {
    const s: any = this.strategy;
    if ((opts?.marketId || opts?.marketSymbol) && s && typeof s.pauseMarket === 'function') {
      await s.pauseMarket({
        marketId: opts.marketId,
        marketSymbol: opts.marketSymbol,
      });
      return;
    }

    try {
      await this.cancelOrders(opts);
    } catch {
      // Continue to stop even if cancellation fails.
    }

    if (!this.strategy) {
      this.status = 'stopped';
      this.startedAt = null;
      return;
    }

    this.status = 'stopping';
    try {
      await this.strategy.stop();
    } finally {
      // Keep the strategy object so its ConfigManager remains available while paused.
      this.status = 'stopped';
      this.startedAt = null;
    }
  }

  /**
   * Resume strategy by (re)starting if not running.
   */
  async resume(opts?: { marketId?: string; marketSymbol?: string; reason?: string }): Promise<void> {
    const s: any = this.strategy;
    if ((opts?.marketId || opts?.marketSymbol) && s && typeof s.resumeMarket === 'function') {
      await s.resumeMarket({
        marketId: opts.marketId,
        marketSymbol: opts.marketSymbol,
      });
      return;
    }

    if (this.status === 'running' || this.status === 'starting') return;
    if (this.strategy) {
      this.status = 'starting';
      this.lastError = null;
      try {
        await this.strategy.start();
        this.status = 'running';
        this.startedAt = new Date();
        return;
      } catch (error: any) {
        this.status = 'error';
        this.lastError = error?.message || String(error);
        throw error;
      }
    }
    await this.start();
  }

  /**
   * Per-market status for strategies that implement getMarketStatuses().
   */
  getMarketStatuses(): Array<Record<string, unknown>> | undefined {
    const s: any = this.strategy;
    if (s && typeof s.getMarketStatuses === 'function') {
      return s.getMarketStatuses();
    }
    return undefined;
  }

  /**
   * Partial update for one market (scheduled-issuer PATCH .../markets/:key).
   */
  async patchMarket(
    marketKey: string,
    patch: Record<string, unknown>
  ): Promise<ConfigUpdateResult<unknown>> {
    const s: any = this.strategy;
    if (s && typeof s.patchMarketConfig === 'function') {
      return await s.patchMarketConfig(marketKey, patch);
    }
    return {
      success: false,
      error: 'Strategy does not support per-market config patches',
    };
  }

  /**
   * Drain per-market apply warnings from the wrapped strategy, if it exposes
   * that surface. Strategies that don't populate warnings return an empty
   * array (handled via the optional-chained call).
   */
  consumePendingApplyWarnings(): Array<{
    marketKey: string;
    phase: 'add' | 'remove' | 're-init';
    reason: string;
    at: number;
  }> {
    const s: any = this.strategy;
    if (s && typeof s.consumePendingApplyWarnings === 'function') {
      return s.consumePendingApplyWarnings();
    }
    return [];
  }

  /**
   * List active orders via the strategy's API client (raw, no Zod).
   */
  async listOrders(): Promise<any[]> {
    const s: any = this.strategy as any;
    if (s?.client?.listOrdersRaw) {
      return await s.client.listOrdersRaw({ status: 'active' });
    }
    if (s?.client?.listOrders) {
      return await s.client.listOrders({ status: 'active' });
    }
    return [];
  }

  /**
   * Restart strategy instance (stop then start).
   */
  async restart(): Promise<void> {
    if (this.strategy) {
      try {
        this.status = 'stopping';
        await this.strategy.stop();
      } catch {
        // ignore
      }
      this.status = 'starting';
      this.lastError = null;
      try {
        await this.strategy.start();
        this.status = 'running';
        this.startedAt = new Date();
        return;
      } catch (error: any) {
        this.status = 'error';
        this.lastError = error?.message || String(error);
        throw error;
      }
    }
    await this.start();
  }

  /**
   * Reset a strategy kill switch if supported.
   *
   * Not all strategies implement a kill switch; this is best-effort and will
   * throw if unsupported so the Control API can return a clear error.
   */
  async resetKillSwitch(reason?: string): Promise<void> {
    const s: any = this.strategy as any;
    if (s && typeof s.resetKillSwitch === 'function') {
      await s.resetKillSwitch(reason || 'manual');
      return;
    }
    throw new Error('Strategy does not support kill switch reset');
  }

  /**
   * Create the strategy for this instance by loading its module.
   *
   * Strategy modules are resolved by type name relative to this module:
   * `strategies/<type>/index.{js,ts}` at the project root (compiled builds
   * resolve to `dist/strategies/<type>/index.js`). A module must export one of:
   *
   *   - `createStrategy(config): Strategy | Promise<Strategy>` — preferred
   *     factory function, or
   *   - a default-exported class constructed as `new Default(config)`.
   *
   * If the module also exports `validateConfig(config)`, it is applied to the
   * instance config (with the resolved `profile` injected) before the strategy
   * is constructed, so configuration errors fail fast with the strategy's own
   * error messages.
   *
   * @param profileName - Optional profile name for credential isolation
   */
  private async createStrategy(profileName?: string): Promise<Strategy> {
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(this.type)) {
      throw new Error(`Invalid strategy type name: ${this.type}`);
    }

    const module = await this.loadStrategyModule(this.type);

    // Inject profile into config for credential isolation
    const configWithProfile = { ...this.strategyConfig, profile: profileName };

    let config: unknown = configWithProfile;
    if (typeof module.validateConfig === 'function') {
      try {
        config = module.validateConfig(configWithProfile);
      } catch (error: any) {
        recordDiagnosticBreadcrumb('strategy_config_validation_failed', {
          strategyId: this.id,
          strategyName: this.name,
          strategyType: this.type,
          validationIssues: validationIssues(error),
          config: summarizeStrategyConfig(configWithProfile),
        });
        throw error;
      }
    }

    setTag('strategy', this.type);
    setTag('instance_id', this.id);
    setContext('strategy_config', {
      instanceId: this.id,
      instanceName: this.name,
      strategyType: this.type,
      config: summarizeStrategyConfig(config as Record<string, unknown>),
    });

    if (typeof module.createStrategy === 'function') {
      return module.createStrategy(config);
    }
    if (typeof module.default === 'function') {
      const StrategyClass = module.default as new (config: unknown) => Strategy;
      return new StrategyClass(config);
    }
    throw new Error(
      `Strategy module for type '${this.type}' must export createStrategy(config) or a default class`
    );
  }

  /**
   * Load a strategy module by type name, trying compiled and source layouts.
   */
  private async loadStrategyModule(type: string): Promise<{
    createStrategy?: (config: unknown) => Strategy | Promise<Strategy>;
    validateConfig?: (config: unknown) => unknown;
    default?: unknown;
  }> {
    const candidates = [
      `../../strategies/${type}/index.js`,
      `../../strategies/${type}/index.ts`,
    ];
    const errors: string[] = [];
    for (const candidate of candidates) {
      try {
        return await import(candidate);
      } catch (err: any) {
        errors.push(err?.message || String(err));
      }
    }
    throw new Error(
      `Cannot load strategy module for type '${type}' ` +
        `(looked for strategies/${type}/index.{js,ts}): ${errors.join('; ')}`
    );
  }
}
