import { logger } from '../logging/logger';

export interface DiagnosticBreadcrumb {
  at: string;
  event: string;
  details?: Record<string, unknown>;
}

export interface FatalDiagnosticsOptions {
  maxBreadcrumbs?: number;
  exitOnUncaughtException?: boolean;
}

type FatalKind =
  | 'uncaught_exception'
  | 'unhandled_rejection'
  | 'warning'
  | 'signal'
  | 'main_catch'
  | 'manual';

const DEFAULT_MAX_BREADCRUMBS = 100;
const SECRET_KEY_RE = /(secret|signing[_-]?key|private[_-]?key|token|password|authorization|fingerprint)/i;

let breadcrumbs: DiagnosticBreadcrumb[] = [];
let maxBreadcrumbs = DEFAULT_MAX_BREADCRUMBS;
let installed = false;

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[max_depth]';
  if (value == null) return value;
  if (value instanceof Error) return errorToObject(value);
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET_KEY_RE.test(key) ? '[redacted]' : sanitizeValue(raw, depth + 1);
  }
  return out;
}

function errorToObject(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const maybeCause = (error as Error & { cause?: unknown }).cause;
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(maybeCause ? { cause: sanitizeValue(maybeCause) } : {}),
    };
  }

  return {
    name: typeof error,
    message: String(error),
    value: sanitizeValue(error),
  };
}

function processSnapshot(): Record<string, unknown> {
  const memory = process.memoryUsage();
  return {
    pid: process.pid,
    nodeVersion: process.version,
    platform: process.platform,
    uptimeSeconds: Math.round(process.uptime()),
    argv: process.argv,
    cwd: process.cwd(),
    memory: {
      rss: memory.rss,
      heapTotal: memory.heapTotal,
      heapUsed: memory.heapUsed,
      external: memory.external,
      arrayBuffers: memory.arrayBuffers,
    },
    env: {
      NODE_ENV: process.env.NODE_ENV,
      API_URL: process.env.API_URL,
      WS_URL: process.env.WS_URL,
      CONFIG_PATH: process.env.CONFIG_PATH,
      STRATEGY_CONFIG_DB_PATH: process.env.STRATEGY_CONFIG_DB_PATH,
      GRID_SQLITE_PATH: process.env.GRID_SQLITE_PATH,
      CONTROL_PORT: process.env.CONTROL_PORT,
      LOG_LEVEL: process.env.LOG_LEVEL,
    },
  };
}

export function recordDiagnosticBreadcrumb(event: string, details?: Record<string, unknown>): void {
  breadcrumbs.push({
    at: new Date().toISOString(),
    event,
    details: details ? (sanitizeValue(details) as Record<string, unknown>) : undefined,
  });

  if (breadcrumbs.length > maxBreadcrumbs) {
    breadcrumbs = breadcrumbs.slice(-maxBreadcrumbs);
  }
}

export function getDiagnosticBreadcrumbs(): DiagnosticBreadcrumb[] {
  return [...breadcrumbs];
}

export function clearDiagnosticBreadcrumbs(): void {
  breadcrumbs = [];
}

export function logFatalDiagnostics(kind: FatalKind, error: unknown, details?: Record<string, unknown>): void {
  logger.error('grid_cli_fatal_diagnostics', {
    kind,
    error: errorToObject(error),
    details: details ? sanitizeValue(details) : undefined,
    process: processSnapshot(),
    recentBreadcrumbs: getDiagnosticBreadcrumbs(),
  });
}

export function installFatalDiagnostics(options: FatalDiagnosticsOptions = {}): void {
  maxBreadcrumbs = options.maxBreadcrumbs ?? DEFAULT_MAX_BREADCRUMBS;
  if (installed) return;
  installed = true;

  process.on('uncaughtException', (error) => {
    recordDiagnosticBreadcrumb('process_uncaught_exception', {
      name: error.name,
      message: error.message,
    });
    logFatalDiagnostics('uncaught_exception', error);

    if (options.exitOnUncaughtException !== false) {
      process.exitCode = 1;
      setTimeout(() => process.exit(1), 250).unref();
    }
  });

  process.on('unhandledRejection', (reason) => {
    recordDiagnosticBreadcrumb('process_unhandled_rejection', {
      reason: errorToObject(reason),
    });
    logFatalDiagnostics('unhandled_rejection', reason);
  });

  process.on('warning', (warning) => {
    recordDiagnosticBreadcrumb('process_warning', {
      name: warning.name,
      message: warning.message,
    });
    logFatalDiagnostics('warning', warning);
  });

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      recordDiagnosticBreadcrumb('process_signal', { signal });
      logFatalDiagnostics('signal', new Error(`Received ${signal}`), { signal });
    });
  }
}

