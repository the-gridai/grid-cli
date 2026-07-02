/**
 * OpenTelemetry API helpers for grid-cli application code.
 *
 * This module contains ONLY `@opentelemetry/api` imports — no SDK references.
 * The SDK is initialized in `src/instrumentation.ts` which is loaded via
 * the Node.js `--import` flag before this module is ever imported.
 *
 * When tracing is disabled (no SDK registered), all OTel API calls return
 * no-op implementations with zero overhead. This is by design.
 *
 * @see https://medium.com/@tedsuo/opentelemetry-nodejs-all-you-need-to-know-a4e1c8f2f93
 *      "Never reference any SDK package outside of installation and setup."
 */

import {
  trace,
  context,
  propagation,
  SpanKind,
  SpanStatusCode,
  type Tracer,
  type Span,
} from '@opentelemetry/api';

/**
 * Get a named tracer. The underlying implementation is provided by the SDK
 * registered in `src/instrumentation.ts`. If no SDK is registered, this
 * returns a no-op tracer (safe to call, creates no overhead).
 */
export function getTracer(name: string = 'grid-cli'): Tracer {
  return trace.getTracer(name);
}

/**
 * Returns true when a real (non-no-op) TracerProvider has been registered.
 * Useful for conditional logic that should only run when tracing is active.
 */
export function isTracingEnabled(): boolean {
  // The no-op tracer provider returns spans with an all-zero traceId.
  // A real provider returns valid random traceIds.
  const span = trace.getTracer('probe').startSpan('probe');
  const valid = span.spanContext().traceId !== '00000000000000000000000000000000';
  span.end();
  return valid;
}

export { trace, context, propagation, SpanKind, SpanStatusCode };
export type { Tracer, Span };
