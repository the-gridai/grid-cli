#!/usr/bin/env node
/**
 * GRID CLI process entry point.
 *
 * Kept separate from `./index`, which is the library entry: an embedding
 * overlay imports `buildProgram`/`run` from there and supplies its own extra
 * commands, so importing it must never start the CLI.
 *
 * OpenTelemetry instrumentation is handled by `src/instrumentation.ts`, loaded
 * via the Node.js `--require` flag in the bin/grid shim. By the time this file
 * runs, HTTP auto-instrumentation is already active and every outgoing request
 * automatically gets W3C traceparent propagation.
 */
import chalk from 'chalk';
import { run } from './index';
import { logger } from '../core/logging/logger';

run().catch((err) => {
  logger.error('Fatal Error:', { error: err });
  console.error(chalk.red('Fatal Error:'), err);
  process.exit(1);
});
