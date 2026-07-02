/**
 * OpenTelemetry instrumentation — loaded via Node.js `--require` flag.
 *
 * LOADING ORDER IS CRITICAL:
 * 1. Load .env so GRID_TRACING_ENABLED is available
 * 2. Set up the provider and register it globally
 * 3. Create and enable HttpInstrumentation (patches http/https)
 * 4. Application code loads — http/https are already patched
 *
 * @see https://opentelemetry.io/docs/languages/js/getting-started/nodejs/
 */

// Load .env files BEFORE checking the flag — this file runs before the
// app's config module, so process.env won't have .env values yet.
const path = require('path');
const fs = require('fs');
const scriptDir = __dirname;
const possibleRoots = [
  path.resolve(scriptDir, '..', '..'),       // from dist/src/
  path.resolve(scriptDir, '..'),             // from src/
  process.cwd(),
];
for (const root of possibleRoots) {
  const envLocal = path.join(root, '.env.local');
  const envFile = path.join(root, '.env');
  // .env.local overrides .env; load base first, local second
  if (fs.existsSync(envFile)) {
    try { require('dotenv').config({ path: envFile, override: false }); } catch {}
  }
  if (fs.existsSync(envLocal)) {
    try { require('dotenv').config({ path: envLocal, override: true }); } catch {}
  }
  if (fs.existsSync(envFile) || fs.existsSync(envLocal)) break;
}

const enabled = process.env.GRID_TRACING_ENABLED === 'true' || process.env.GRID_TRACING_ENABLED === '1';

if (enabled) {

// Step 1: Set up the tracer provider
const { NodeTracerProvider, SimpleSpanProcessor, BatchSpanProcessor } = require('@opentelemetry/sdk-trace-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { ATTR_SERVICE_NAME } = require('@opentelemetry/semantic-conventions');
const { W3CTraceContextPropagator } = require('@opentelemetry/core');
const { propagation } = require('@opentelemetry/api');

const endpoint = process.env.GRID_OTEL_ENDPOINT || 'http://tempo:4318';
const serviceName = process.env.GRID_SERVICE_NAME || 'grid-cli';
const useBatch = process.env.GRID_SPAN_BATCH === 'true';

propagation.setGlobalPropagator(new W3CTraceContextPropagator());

const exporter = new OTLPTraceExporter({ url: `${endpoint}/v1/traces` });
const processor = useBatch
  ? new BatchSpanProcessor(exporter, { maxQueueSize: 4096, maxExportBatchSize: 512, scheduledDelayMillis: 1000 })
  : new SimpleSpanProcessor(exporter);

const provider = new NodeTracerProvider({
  resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: serviceName }),
  spanProcessors: [processor],
});

provider.register();

// Step 2: Enable HTTP instrumentation — MUST happen after provider.register()
// and before application code loads http/https.
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const httpInst = new HttpInstrumentation({ ignoreIncomingRequestHook: () => true });
httpInst.setTracerProvider(provider);
httpInst.enable();

// Step 3: Graceful shutdown
const shutdown = async () => {
  try {
    httpInst.disable();
    await provider.forceFlush();
    await provider.shutdown();
  } catch { /* export errors are non-fatal for a CLI tool */ }
};
process.on('beforeExit', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

} // if (enabled)
