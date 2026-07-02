import { logger } from '../logging/logger';

/**
 * Lifecycle state for tracking shutdown status
 */
let isShuttingDown = false;
let shutdownHandlersRegistered = false;

/**
 * Check if the application is currently shutting down
 * @returns true if shutdown is in progress
 */
export function isShutdownInProgress(): boolean {
  return isShuttingDown;
}

/**
 * Setup graceful shutdown handlers for SIGINT and SIGTERM signals.
 * This ensures that cron jobs and other resources are properly cleaned up
 * when the process is terminated.
 * 
 * @param onShutdown - Async callback to execute before process exits
 * @param options - Configuration options
 * @param options.exitCode - Exit code to use (default: 0)
 * @param options.timeout - Maximum time to wait for shutdown in ms (default: 10000)
 * 
 * @example
 * ```typescript
 * setupGracefulShutdown(async () => {
 *   scheduler.stopAll();
 *   await database.close();
 * });
 * ```
 */
export function setupGracefulShutdown(
  onShutdown: () => Promise<void>,
  options: { exitCode?: number; timeout?: number } = {}
): void {
  const { exitCode = 0, timeout = 10000 } = options;

  // Prevent duplicate registration
  if (shutdownHandlersRegistered) {
    logger.warn('Shutdown handlers already registered, skipping');
    return;
  }

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

  const handleShutdown = async (signal: string) => {
    // Prevent multiple shutdowns
    if (isShuttingDown) {
      logger.info('Shutdown already in progress, ignoring signal', { signal });
      return;
    }

    isShuttingDown = true;
    console.log(`\n[Lifecycle] Received ${signal}, initiating graceful shutdown...`);
    logger.info('Graceful shutdown initiated', { signal });

    // Set a timeout to force exit if shutdown takes too long
    const forceExitTimeout = setTimeout(() => {
      console.error('[Lifecycle] Shutdown timeout exceeded, forcing exit');
      logger.error('Shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, timeout);

    try {
      await onShutdown();
      clearTimeout(forceExitTimeout);
      console.log('[Lifecycle] Graceful shutdown complete');
      logger.info('Graceful shutdown complete');
      process.exit(exitCode);
    } catch (error) {
      clearTimeout(forceExitTimeout);
      console.error('[Lifecycle] Error during shutdown:', error);
      logger.error('Error during shutdown', { error });
      process.exit(1);
    }
  };

  signals.forEach(signal => {
    process.on(signal, () => handleShutdown(signal));
  });

  // Also handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    console.error('[Lifecycle] Uncaught exception:', error);
    logger.error('Uncaught exception', { error });
    await handleShutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason, promise) => {
    console.error('[Lifecycle] Unhandled rejection at:', promise, 'reason:', reason);
    logger.error('Unhandled rejection', { reason });
    await handleShutdown('unhandledRejection');
  });

  shutdownHandlersRegistered = true;
  logger.info('Graceful shutdown handlers registered');
}

/**
 * Reset the lifecycle state (primarily for testing)
 */
export function resetLifecycleState(): void {
  isShuttingDown = false;
  shutdownHandlersRegistered = false;
}
