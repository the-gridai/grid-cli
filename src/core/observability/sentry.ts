/**
 * Sentry Error Tracking Integration
 * 
 * Provides centralized error tracking and performance monitoring
 * for grid-cli strategies and operations.
 */

import * as Sentry from '@sentry/node';
import { logger } from '../logging/logger';

// Track initialization state
let isInitialized = false;

/**
 * Initialize Sentry error tracking
 * 
 * Should be called early in application startup.
 * Safe to call multiple times - will only initialize once.
 */
export function initSentry(): void {
  if (isInitialized) {
    logger.debug('Sentry already initialized, skipping');
    return;
  }

  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    logger.info('SENTRY_DSN not configured, error tracking disabled');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.GIT_SHA || 'unknown',
      
      // Sample rate for performance monitoring (0.0 to 1.0)
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      
      // Sample rate for error events (0.0 to 1.0)
      sampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE || '1.0'),
      
      // Additional context
      initialScope: {
        tags: {
          service: 'grid-cli',
          strategy: process.env.STRATEGY_NAME || 'unknown',
        },
      },
      
      // Filter out sensitive data
      beforeSend(event) {
        // Remove any potential secrets from error messages
        if (event.message) {
          event.message = sanitizeMessage(event.message);
        }
        return event;
      },
    });

    isInitialized = true;
    logger.info('Sentry initialized', { 
      environment: process.env.NODE_ENV,
      release: process.env.GIT_SHA 
    });
  } catch (error) {
    logger.warn('Failed to initialize Sentry', { error });
  }
}

/**
 * Check if Sentry is initialized and enabled
 */
export function isSentryEnabled(): boolean {
  return isInitialized;
}

/**
 * Capture an exception with optional context
 */
export function captureException(
  error: Error | unknown,
  context?: Record<string, unknown>
): string | undefined {
  if (!isInitialized) {
    return undefined;
  }

  return Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture a message with optional severity level
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, unknown>
): string | undefined {
  if (!isInitialized) {
    return undefined;
  }

  return Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id?: string; email?: string; username?: string }): void {
  if (!isInitialized) {
    return;
  }

  Sentry.setUser(user);
}

/**
 * Add a breadcrumb for debugging
 */
export function addBreadcrumb(breadcrumb: {
  message: string;
  category?: string;
  level?: Sentry.SeverityLevel;
  data?: Record<string, unknown>;
}): void {
  if (!isInitialized) {
    return;
  }

  Sentry.addBreadcrumb({
    message: breadcrumb.message,
    category: breadcrumb.category || 'grid-cli',
    level: breadcrumb.level || 'info',
    data: breadcrumb.data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Set extra context that will be sent with all events
 */
export function setContext(name: string, context: Record<string, unknown>): void {
  if (!isInitialized) {
    return;
  }

  Sentry.setContext(name, context);
}

/**
 * Set a tag that will be sent with all events
 */
export function setTag(key: string, value: string): void {
  if (!isInitialized) {
    return;
  }

  Sentry.setTag(key, value);
}

/**
 * Flush pending events before shutdown
 * Returns a promise that resolves when events are sent (or timeout)
 */
export async function flush(timeout = 2000): Promise<boolean> {
  if (!isInitialized) {
    return true;
  }

  return Sentry.flush(timeout);
}

/**
 * Wrap an async function with Sentry error tracking
 */
export function withErrorTracking<T>(
  name: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  return Sentry.startSpan(
    {
      name,
      op: 'function',
    },
    async () => {
      try {
        addBreadcrumb({
          message: `Starting: ${name}`,
          category: 'operation',
          level: 'info',
          data: context,
        });
        
        return await fn();
      } catch (error) {
        captureException(error, { operation: name, ...context });
        throw error;
      }
    }
  );
}

/**
 * Sanitize potentially sensitive data from messages
 */
function sanitizeMessage(message: string): string {
  // Remove potential API keys, tokens, private keys
  return message
    .replace(/([A-Za-z0-9+/]{40,})/g, '[REDACTED]')
    .replace(/(Bearer\s+)[^\s]+/gi, '$1[REDACTED]')
    .replace(/(key|token|secret|password|private)[=:]\s*\S+/gi, '$1=[REDACTED]');
}
