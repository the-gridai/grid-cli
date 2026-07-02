/**
 * Grid CLI Daemon Runner
 *
 * Production-ready daemon that runs multiple trading strategies with:
 * - Multi-strategy support (run issuer + market-maker simultaneously)
 * - Health/readiness endpoints for Kubernetes
 * - Structured logging and observability
 * - Graceful shutdown
 */

import { fileURLToPath } from 'url';
import { logger } from '../core/logging/logger';
import { MultiStrategyRunner } from './multi-strategy-runner';
import { loadMultiStrategyConfig, mergeStrategyConfigsFromDb, seedDbFromFileConfig } from './multi-strategy-config';
import { StrategyConfigStore } from '../core/persistence/StrategyConfigStore';
import {
  installFatalDiagnostics,
  logFatalDiagnostics,
  recordDiagnosticBreadcrumb,
} from '../core/diagnostics/fatal-diagnostics';

/**
 * Main entry point
 *
 * Runs the multi-strategy daemon using configuration from CONFIG_PATH
 */
export async function main(): Promise<void> {
  installFatalDiagnostics();

  const configPath = process.env.CONFIG_PATH || '/app/config/strategy.json';

  logger.info('Starting multi-strategy daemon', { configPath });
  recordDiagnosticBreadcrumb('daemon_main_start', { configPath });

  const loaded = loadMultiStrategyConfig(configPath);
  recordDiagnosticBreadcrumb('daemon_config_loaded', {
    configPath,
    strategyCount: loaded.strategies?.length ?? 0,
    strategyIds: loaded.strategies?.map((s) => s.id) ?? [],
    configSource: loaded.global?.configSource,
  });

  // One SQLite connection shared across seed, merge, and runtime write-through.
  const dbPath =
    loaded.global?.strategyConfigDbPath ||
    process.env.STRATEGY_CONFIG_DB_PATH ||
    process.env.GRID_SQLITE_PATH;
  const configStore = new StrategyConfigStore(dbPath);
  configStore.init();
  recordDiagnosticBreadcrumb('daemon_config_store_initialized', { dbPath });

  try {
    // Seed SQLite from JSON on first boot; existing DB rows are preserved.
    seedDbFromFileConfig(loaded, { store: configStore });
    recordDiagnosticBreadcrumb('daemon_config_store_seeded', { dbPath });

    const config = mergeStrategyConfigsFromDb(loaded, { store: configStore });
    recordDiagnosticBreadcrumb('daemon_config_merged', {
      strategyCount: config.strategies?.length ?? 0,
      strategyIds: config.strategies?.map((s) => s.id) ?? [],
    });

    const runner = new MultiStrategyRunner(config, configPath, { configStore });

    // Hand off store ownership to the daemon lifecycle: close on process exit
    // rather than when the runner stops, so any late writes during shutdown
    // have a chance to land.
    const closeStore = (): void => {
      try {
        configStore.close();
      } catch {
        // best-effort
      }
    };
    process.once('exit', closeStore);

    recordDiagnosticBreadcrumb('daemon_runner_starting');
    await runner.start();
    recordDiagnosticBreadcrumb('daemon_runner_started');

    // Keep the process running
    process.stdin.resume();
  } catch (err) {
    recordDiagnosticBreadcrumb('daemon_main_error', {
      error: err instanceof Error ? err.message : String(err),
    });
    logFatalDiagnostics('main_catch', err);
    configStore.close();
    throw err;
  }
}

// Allow running directly (ESM-compatible check)
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  installFatalDiagnostics();
  main().catch((error) => {
    console.error('Fatal error:', error);
    logFatalDiagnostics('main_catch', error);
    process.exit(1);
  });
}
