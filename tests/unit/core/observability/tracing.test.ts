/**
 * Tests for OpenTelemetry tracing.
 *
 * API-level tests run in Jest. End-to-end auto-instrumentation tests run
 * as a spawned Node.js process with `--import instrumentation.js` to
 * properly exercise the HttpInstrumentation monkey-patch.
 *
 * @opentelemetry/instrumentation-http requires `--import` to patch Node's
 * http module BEFORE any code loads it. Jest's module system pre-loads
 * http during its own init, making setupFiles too late. This is a known
 * limitation documented by the OTel project.
 */

import { execSync } from 'child_process';
import path from 'path';
import { isTracingEnabled, getTracer } from '../../../../src/core/observability/tracing';

const W3C_TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

describe('tracing API helpers', () => {
  test('getTracer returns a tracer (no-op when SDK not registered)', () => {
    const tracer = getTracer('test');
    expect(tracer).toBeDefined();
    expect(typeof tracer.startSpan).toBe('function');
  });

  test('isTracingEnabled returns false when no SDK is registered', () => {
    // In Jest, no SDK is registered (no --import), so this should be false
    expect(isTracingEnabled()).toBe(false);
  });
});

describe('auto-instrumentation (spawned process with --import)', () => {
  const srcDir = path.resolve(__dirname, '../../../../src');
  const instrumentationPath = path.join(srcDir, 'instrumentation.cjs');
  const testScriptPath = path.join(__dirname, 'tracing-e2e-helper.cjs');

  test('HTTP requests get W3C traceparent headers via auto-instrumentation', () => {
    // Spawn a real Node process with --require so http is patched via
    // require-in-the-middle before any application code runs.
    const result = execSync(
      `node --require "${instrumentationPath}" "${testScriptPath}"`,
      {
        timeout: 15000,
        env: {
          ...process.env,
          GRID_TRACING_ENABLED: 'true',
          GRID_OTEL_ENDPOINT: 'http://127.0.0.1:19999', // non-existent, that's fine
          NODE_TLS_REJECT_UNAUTHORIZED: '0',
        },
      },
    ).toString().trim();

    const data = JSON.parse(result);

    // 1. Raw http.get got a traceparent
    expect(data.httpGetTraceparent).toBeDefined();
    expect(data.httpGetTraceparent).toMatch(W3C_TRACEPARENT);

    // 2. Axios get got a traceparent
    expect(data.axiosGetTraceparent).toBeDefined();
    expect(data.axiosGetTraceparent).toMatch(W3C_TRACEPARENT);

    // 3. Requests under a parent span share the same traceId
    const [, traceId1] = data.parentedReq1Traceparent.match(W3C_TRACEPARENT)!;
    const [, traceId2] = data.parentedReq2Traceparent.match(W3C_TRACEPARENT)!;
    expect(traceId1).toBe(traceId2);

    // 4. The traceId matches the parent span's traceId
    expect(traceId1).toBe(data.parentTraceId);

    // 5. Independent requests get different traceIds
    const [, indep1] = data.httpGetTraceparent.match(W3C_TRACEPARENT)!;
    const [, indep2] = data.axiosGetTraceparent.match(W3C_TRACEPARENT)!;
    expect(indep1).not.toBe(indep2);

    // 6. Client spans were recorded
    expect(data.clientSpanCount).toBeGreaterThanOrEqual(1);
  });
});
