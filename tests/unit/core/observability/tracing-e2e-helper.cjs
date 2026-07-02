/**
 * E2E helper for tracing tests — run with:
 *   node --import <instrumentation.js> tracing-e2e-helper.cjs
 *
 * Starts a capture server, makes several HTTP requests (raw http + axios),
 * and prints a JSON object with the captured traceparent headers to stdout.
 */
const http = require('http');
const { trace, context, SpanKind } = require('@opentelemetry/api');

async function main() {
  // Dynamic import for axios (ESM)
  const axios = (await import('axios')).default;

  const captured = {};

  // Start capture server
  const server = http.createServer((req, res) => {
    const url = req.url || '/';
    captured[url] = req.headers['traceparent'] || null;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  // 1. Raw http.get
  await new Promise((resolve, reject) => {
    http.get(`${base}/raw-get`, (res) => {
      res.on('data', () => {});
      res.on('end', resolve);
    }).on('error', reject);
  });

  // 2. Axios GET
  await axios.get(`${base}/axios-get`);

  // 3. Two requests under a parent span
  const tracer = trace.getTracer('e2e-test');
  const parent = tracer.startSpan('test.parent', { kind: SpanKind.INTERNAL });
  const parentCtx = trace.setSpan(context.active(), parent);
  const parentTraceId = parent.spanContext().traceId;

  await context.with(parentCtx, async () => {
    await new Promise((resolve, reject) => {
      http.get(`${base}/parented-1`, (res) => {
        res.on('data', () => {});
        res.on('end', resolve);
      }).on('error', reject);
    });
    await new Promise((resolve, reject) => {
      http.get(`${base}/parented-2`, (res) => {
        res.on('data', () => {});
        res.on('end', resolve);
      }).on('error', reject);
    });
  });
  parent.end();

  // Count client spans
  // Access the span processor's exporter if available
  let clientSpanCount = 0;
  try {
    const { InMemorySpanExporter } = require('@opentelemetry/sdk-trace-base');
    // The SDK may have registered a different exporter; count via trace API
    // We just verify spans were created by checking the captured headers
    clientSpanCount = Object.values(captured).filter(Boolean).length;
  } catch {
    clientSpanCount = Object.values(captured).filter(Boolean).length;
  }

  server.close();

  // Output results as JSON
  const result = {
    httpGetTraceparent: captured['/raw-get'],
    axiosGetTraceparent: captured['/axios-get'],
    parentedReq1Traceparent: captured['/parented-1'],
    parentedReq2Traceparent: captured['/parented-2'],
    parentTraceId,
    clientSpanCount,
  };

  process.stdout.write(JSON.stringify(result));
}

main().catch((err) => {
  process.stderr.write(err.stack || err.message);
  process.exit(1);
});
