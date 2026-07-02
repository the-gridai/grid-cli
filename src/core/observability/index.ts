/**
 * Observability Module
 * 
 * Centralizes error tracking, monitoring, and telemetry.
 */

export {
  initSentry,
  isSentryEnabled,
  captureException,
  captureMessage,
  setUser,
  addBreadcrumb,
  setContext,
  setTag,
  flush,
  withErrorTracking,
} from './sentry';

export {
  isTracingEnabled,
  getTracer,
  trace,
  context,
  propagation,
  SpanKind,
  SpanStatusCode,
  type Tracer,
  type Span,
} from './tracing';
