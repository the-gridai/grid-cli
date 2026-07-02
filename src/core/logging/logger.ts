import winston from 'winston';

const level = process.env.LOG_LEVEL || 'info';

export const logger = winston.createLogger({
  level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'grid-cli' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

/**
 * Decide where Winston writes beyond the File transports:
 *
 * - TUI: the interactive terminal UI paints its own chrome; any stdout output
 *   would fight the curses surface. Silent. Errors are surfaced in the UI.
 * - CLI: one-shot subcommand. Only errors go to stderr so the normal CLI
 *   output (JSON responses, prompts) stays clean. File logs keep the full
 *   detail for post-mortem.
 * - Daemon (default, including production k8s): every level emits to stdout
 *   as structured JSON so the Kubelet ships it to Loki/Grafana without an
 *   exec-into-pod step. This is what lets an operator grep
 *   `Failed to place sell order` in Grafana instead of tailing
 *   /app/combined.log inside a running pod.
 *
 * CONSOLE_LOG_LEVEL env overrides the per-mode default; the literal string
 * `silent` disables the Console transport entirely (e.g. when the operator
 * really does want the production pod to log only to files).
 */
const entrypoint = process.argv[1] ?? '';
const isCliEntrypoint =
  entrypoint.includes('cli/index') ||
  entrypoint.endsWith('/bin/grid') ||
  entrypoint.endsWith('bin/grid');

// "No args => TUI" is only valid for the CLI entrypoint. Strategy/daemon
// processes also run with process.argv.length === 2 and must keep daemon logs.
const isTuiMode =
  isCliEntrypoint &&
  (process.argv.includes('tui') ||
    process.argv.includes('--interactive') ||
    process.argv.includes('-i') ||
    process.argv.length === 2);

const runtimeMode: 'tui' | 'cli' | 'daemon' = isCliEntrypoint
  ? isTuiMode
    ? 'tui'
    : 'cli'
  : 'daemon';

const defaultConsoleLevel =
  runtimeMode === 'tui' ? 'silent' : runtimeMode === 'cli' ? 'error' : level;
const consoleLogLevel = process.env.CONSOLE_LOG_LEVEL || defaultConsoleLevel;

if (consoleLogLevel !== 'silent') {
  // Daemon-in-production emits JSON so Loki can parse the structured fields
  // (market, orderId, statusCode, error, etc). Interactive dev still gets
  // the colorized "simple" format that humans prefer.
  const isStructured =
    runtimeMode === 'daemon' && process.env.NODE_ENV === 'production';

  const format = isStructured
    ? winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      )
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      );

  const stderrLevels =
    // In daemon mode, keep warns on stdout so Loki/Grafana setups that ingest
    // stdout-only still surface operator-critical warnings (e.g. order
    // placement rejections). Errors remain on stderr.
    runtimeMode === 'daemon' ? ['error'] : ['error', 'warn'];

  logger.add(
    new winston.transports.Console({
      level: consoleLogLevel,
      format,
      // Daemon sends warn to stdout for observability pipelines that only
      // ingest stdout. Other modes keep warn+error on stderr.
      stderrLevels,
    })
  );
}
