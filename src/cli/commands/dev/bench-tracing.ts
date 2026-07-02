/**
 * Benchmark-specific tracing helpers.
 *
 * The core OTel SDK (provider, http instrumentation, OTLP exporter) is set up
 * by `src/instrumentation.ts` via the `--import` flag. By the time this module
 * loads, all HTTP requests are already auto-instrumented.
 *
 * This module provides only API-level helpers for benchmark-specific spans.
 */

import {
  trace, context, SpanKind, SpanStatusCode,
  type Tracer, type Span,
} from '@opentelemetry/api';

export function getBenchTracer(): Tracer {
  return trace.getTracer('grid-cli-benchmark', '1.0.0');
}

export { trace, context, SpanKind, SpanStatusCode };
export type { Tracer, Span };
