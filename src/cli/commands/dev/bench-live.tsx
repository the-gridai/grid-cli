/**
 * Live Progressive Benchmark
 * 
 * Places CROSSING limit orders (same price) to trigger matching and settlement.
 * Tracks both order placement throughput AND full settlement pipeline latency.
 * 
 * Features:
 * - Multi-account trading: N accounts trade against each other
 * - Full OpenTelemetry tracing with OTLP export to Tempo
 * - W3C traceparent propagation for end-to-end trace correlation
 * - x-grid-benchmark-id/name headers for trace filtering in Grafana
 * - Configuration summary displayed before benchmark starts
 * - Grafana annotations at benchmark start/end
 */

import { Command } from 'commander';
import { ApiClient } from '../../../sdk/http/client.js';
import { setRetriesEnabled } from '../../../sdk/http/retry.js';
import { logger } from '../../../core/logging/logger.js';
import { randomBytes, randomUUID } from 'crypto';
import {
  getBenchTracer,
  trace, context, SpanKind, SpanStatusCode,
  type Tracer, type Span,
} from './bench-tracing.js';

// ═══════════════════════════════════════════════════════════════════════════════
// ANSI COLOR CODES
// ═══════════════════════════════════════════════════════════════════════════════

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

// ═══════════════════════════════════════════════════════════════════════════════
// CHART RENDERING
// ═══════════════════════════════════════════════════════════════════════════════

const BLOCKS = [' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

function renderChart(title: string, data: number[], width: number, height: number, color: string, unit: string, minScale: number = 1): string[] {
  const lines: string[] = [];
  const current = data.length > 0 ? data[data.length - 1] : 0;
  const dataMax = data.length > 0 ? Math.max(...data) : 0;
  const yMax = Math.max(dataMax, minScale);
  const samples = resampleData(data, width);
  
  const chartRows: string[] = [];
  for (let row = 0; row < height; row++) {
    let line = '';
    const rowFromBottom = height - 1 - row;
    for (let col = 0; col < samples.length; col++) {
      const val = samples[col];
      const normalized = yMax > 0 ? val / yMax : 0;
      const totalLevels = height * 8;
      const barLevel = Math.round(normalized * totalLevels);
      const rowBaseLine = rowFromBottom * 8;
      if (barLevel >= rowBaseLine + 8) line += '█';
      else if (barLevel <= rowBaseLine) line += ' ';
      else line += BLOCKS[barLevel - rowBaseLine];
    }
    chartRows.push(line);
  }
  
  const fmtVal = (v: number): string => {
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    if (v >= 100) return v.toFixed(0);
    if (v >= 10) return v.toFixed(1);
    return v.toFixed(2);
  };

  const yMaxLabel = fmtVal(yMax).padStart(6);
  const yMidLabel = fmtVal(yMax / 2).padStart(6);
  const midRow = Math.floor(height / 2);
  lines.push(`${c.bold}${color}${title.padEnd(10)}${fmtVal(current)}${c.reset}${c.gray}${unit}${c.reset}`);
  for (let i = 0; i < chartRows.length; i++) {
    let label = '      ';
    if (i === 0) label = yMaxLabel;
    else if (i === midRow) label = yMidLabel;
    else if (i === height - 1) label = '     0';
    lines.push(`${c.gray}${label}│${c.reset}${color}${chartRows[i]}${c.reset}`);
  }
  lines.push(`${c.gray}      └${'─'.repeat(width)}${c.reset}`);
  return lines;
}

function resampleData(data: number[], targetWidth: number): number[] {
  if (data.length === 0) return new Array(targetWidth).fill(0);
  if (data.length <= targetWidth) return [...new Array(targetWidth - data.length).fill(0), ...data];
  const result: number[] = [];
  const bucketSize = data.length / targetWidth;
  for (let i = 0; i < targetWidth; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.floor((i + 1) * bucketSize);
    const bucket = data.slice(start, end);
    result.push(bucket.length > 0 ? Math.max(...bucket) : 0);
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN RENDERING
// ═══════════════════════════════════════════════════════════════════════════════

function clearScreen() { process.stdout.write('\x1b[2J\x1b[H'); }

function renderConfig(cfg: BenchConfig) {
  const lines: string[] = [''];
  lines.push(`  ${c.bold}${c.blue}██ GRID BENCHMARK${c.reset} ${c.gray}│${c.reset} ${c.bold}Configuration${c.reset}`);
  lines.push('');
  lines.push(`  ${c.gray}┌──────────────────────────────────────────────────────────────────┐${c.reset}`);
  lines.push(`  ${c.gray}│${c.reset} ${c.cyan}Engine${c.reset}           ${cfg.engine.padEnd(12)} ${c.gray}│${c.reset} ${c.cyan}Concurrency${c.reset}     ${String(cfg.minConcurrent)}-${String(cfg.maxConcurrent).padEnd(5)} ${c.gray}│${c.reset}`);
  lines.push(`  ${c.gray}│${c.reset} ${c.cyan}Step Size${c.reset}        ${String(cfg.stepSize).padEnd(12)} ${c.gray}│${c.reset} ${c.cyan}Step Duration${c.reset}   ${cfg.stepDuration}s${' '.repeat(7 - String(cfg.stepDuration).length)} ${c.gray}│${c.reset}`);
  lines.push(`  ${c.gray}│${c.reset} ${c.cyan}Failure Thresh${c.reset}   ${(cfg.failureThreshold * 100).toFixed(0)}%${' '.repeat(10)} ${c.gray}│${c.reset} ${c.cyan}Accounts${c.reset}        ${String(cfg.accounts).padEnd(8)} ${c.gray}│${c.reset}`);
  lines.push(`  ${c.gray}│${c.reset} ${c.cyan}Rate Limit${c.reset}       ${cfg.rateLimitConcurrent}@${cfg.rateLimitInterval}ms${' '.repeat(Math.max(0, 7 - String(cfg.rateLimitConcurrent).length))} ${c.gray}│${c.reset} ${c.cyan}Tracing${c.reset}         ${cfg.tracing ? 'ON (OTel)' : 'OFF'}${' '.repeat(cfg.tracing ? 0 : 5)} ${c.gray}│${c.reset}`);
  lines.push(`  ${c.gray}│${c.reset} ${c.cyan}Markets${c.reset}          ${cfg.marketCount} market(s)${' '.repeat(30)} ${c.gray}│${c.reset}`);
  lines.push(`  ${c.gray}│${c.reset} ${c.cyan}API URL${c.reset}          ${cfg.apiUrl.slice(0, 45)}${' '.repeat(Math.max(0, 15))} ${c.gray}│${c.reset}`);
  if (cfg.benchmarkName) {
    lines.push(`  ${c.gray}│${c.reset} ${c.cyan}Benchmark Name${c.reset}   ${cfg.benchmarkName.slice(0, 45)}${' '.repeat(Math.max(0, 15))} ${c.gray}│${c.reset}`);
  }
  if (cfg.grafanaUrl) {
    lines.push(`  ${c.gray}│${c.reset} ${c.cyan}Grafana${c.reset}          ${cfg.grafanaUrl.slice(0, 45)}${' '.repeat(Math.max(0, 15))} ${c.gray}│${c.reset}`);
  }
  if (process.env.GRID_OTEL_ENDPOINT) {
    lines.push(`  ${c.gray}│${c.reset} ${c.cyan}OTLP Endpoint${c.reset}    ${process.env.GRID_OTEL_ENDPOINT.slice(0, 45)}${' '.repeat(Math.max(0, 15))} ${c.gray}│${c.reset}`);
  }
  lines.push(`  ${c.gray}└──────────────────────────────────────────────────────────────────┘${c.reset}`);
  lines.push('');
  console.log(lines.join('\n'));
}

function renderScreen(state: BenchState) {
  clearScreen();
  const { status, step, elapsedSec, concurrency, maxConcurrent, throughputHistory, latencyHistory,
    totalOrders, totalErrors, currentThroughput, peakThroughput, peakConcurrency, failureThreshold,
    totalMatches, settledCount, settlementThroughputHistory, errorHistory } = state;
  const lines: string[] = [];
  const mins = Math.floor(elapsedSec / 60);
  const secs = Math.floor(elapsedSec % 60);
  const timeStr = mins > 0 ? `${mins}m${secs}s` : `${secs}s`;
  const statusColor = status === 'running' ? c.green : status === 'draining' ? c.cyan : status === 'complete' ? c.green : c.red;
  const statusIcon = status === 'running' ? '●' : status === 'draining' ? '◐' : status === 'complete' ? '✓' : '✗';
  const phaseHint = status === 'running' ? `${c.gray}Ctrl+C to stop${c.reset}` : status === 'draining' ? `${c.gray}Settling...${c.reset}` : `${c.gray}Done${c.reset}`;
  
  lines.push('');
  lines.push(`  ${c.bold}${c.blue}██ GRID BENCHMARK${c.reset} ${c.gray}│${c.reset} ${c.bold}${statusColor}${statusIcon} ${status.toUpperCase()}${c.reset} ${c.gray}│ Step ${step} │ ${timeStr} │${c.reset} ${phaseHint}`);
  lines.push('');
  
  const W = 28, H = 6;
  const ch1 = renderChart('PLACE/s', throughputHistory, W, H, c.green, '/s', 10);
  const ch2 = renderChart('PLACE LAT', latencyHistory, W, H, c.yellow, 'ms', 50);
  const ch3 = renderChart('ERROR', errorHistory, W, H, c.red, '%', 5);
  for (let i = 0; i < Math.max(ch1.length, ch2.length, ch3.length); i++)
    lines.push(`  ${ch1[i] || ''}  ${ch2[i] || ''}  ${ch3[i] || ''}`);
  lines.push('');
  
  const ch4 = renderChart('SETTLE/s', settlementThroughputHistory, W, H, c.cyan, '/s', 10);
  const ch5 = renderChart('PENDING', state.pendingHistory, W, H, c.magenta, '', 1);
  const ch6 = renderChart('SETTL %', state.settlementLatencyHistory, W, H, c.yellow, '%', 100);
  for (let i = 0; i < Math.max(ch4.length, ch5.length, ch6.length); i++)
    lines.push(`  ${ch4[i] || ''}  ${ch5[i] || ''}  ${ch6[i] || ''}`);
  lines.push('');
  
  const errorRate = (totalOrders + totalErrors) > 0 ? (totalErrors / (totalOrders + totalErrors) * 100) : 0;
  const errColor = errorRate > 10 ? c.red : errorRate > 2 ? c.yellow : c.green;
  const settlePct = totalMatches > 0 ? (settledCount / totalMatches * 100).toFixed(0) : '0';
  
  lines.push(`  ${c.gray}╭───────────────────────────────────────────────────────────────────────────────────────────────╮${c.reset}`);
  lines.push(`  ${c.gray}│${c.reset} ${c.gray}LOAD${c.reset} ${c.bold}${c.cyan}${String(concurrency).padStart(3)}${c.reset} ${c.gray}│${c.reset} ${c.gray}PLACED${c.reset} ${c.bold}${c.green}${totalOrders.toLocaleString().padStart(6)}${c.reset} ${c.gray}│${c.reset} ${c.gray}RATE${c.reset} ${c.bold}${c.green}${currentThroughput.toFixed(0).padStart(4)}/s${c.reset} ${c.gray}│${c.reset} ${c.gray}SETTLD${c.reset} ${c.bold}${c.cyan}${settledCount.toLocaleString().padStart(5)}/${totalMatches}${c.reset} ${c.gray}│${c.reset} ${c.gray}S%${c.reset} ${c.bold}${c.magenta}${settlePct.padStart(3)}%${c.reset} ${c.gray}│${c.reset} ${c.gray}ERR${c.reset} ${c.bold}${errColor}${errorRate.toFixed(1).padStart(4)}%${c.reset} ${c.gray}│${c.reset} ${c.gray}PEAK${c.reset} ${c.bold}${c.cyan}${peakThroughput.toFixed(0)}/s@${peakConcurrency}${c.reset} ${c.gray}│${c.reset}`);
  lines.push(`  ${c.gray}╰───────────────────────────────────────────────────────────────────────────────────────────────╯${c.reset}`);
  lines.push('');
  
  const pFill = Math.min(50, Math.max(0, Math.floor((concurrency / maxConcurrent) * 50)));
  lines.push(`  ${c.gray}Load:${c.reset} ${c.cyan}${'█'.repeat(pFill)}${c.reset}${c.gray}${'░'.repeat(50 - pFill)}${c.reset} ${c.gray}${concurrency}/${maxConcurrent}${c.reset}`);
  if (state.pollError) lines.push(`  ${c.dim}${c.red}Poll: ${state.pollError}${c.reset}`);
  
  if (status === 'failed') { lines.push(''); lines.push(`  ${c.red}⚠ Breaking point at concurrency ${concurrency} (${(failureThreshold * 100).toFixed(0)}% threshold)${c.reset}`); }
  else if (status === 'draining') { lines.push(''); lines.push(`  ${c.cyan}◐ Draining: ${settledCount}/${totalMatches} settled${c.reset}`); }
  else if (status === 'stalled') { lines.push(''); lines.push(`  ${c.red}⚠ Settlement stalled! ${settledCount}/${totalMatches}${c.reset}`); }
  else if (status === 'complete') { lines.push(''); lines.push(`  ${c.green}✓ Done! Peak: ${peakThroughput.toFixed(0)}/s @${peakConcurrency} │ ${settledCount}/${totalMatches} trades │ ${timeStr}${c.reset}`); }
  lines.push('');
  console.log(lines.join('\n'));
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATE & CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

interface BenchConfig {
  minConcurrent: number; maxConcurrent: number; stepSize: number; stepDuration: number; failureThreshold: number;
  engine: string; accounts: number; tracing: boolean; grafanaUrl: string;
  rateLimitConcurrent: number; rateLimitInterval: number;
  marketCount: number; marketNames: string[]; apiUrl: string;
  benchmarkName: string; benchmarkId: string;
}

interface BenchState {
  status: 'starting' | 'running' | 'draining' | 'stalled' | 'failed' | 'complete';
  step: number; elapsedSec: number; concurrency: number; maxConcurrent: number;
  throughputHistory: number[]; latencyHistory: number[]; errorHistory: number[];
  settlementLatencyHistory: number[]; settlementThroughputHistory: number[]; pendingHistory: number[];
  totalOrders: number; totalErrors: number; totalMatches: number; settledCount: number;
  currentThroughput: number; currentLatency: number; currentSettlementLatency: number;
  peakThroughput: number; peakConcurrency: number; failureThreshold: number; pollError: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRAFANA ANNOTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function postGrafanaAnnotation(grafanaUrl: string, text: string, tags: string[]) {
  if (!grafanaUrl) return;
  try {
    const { default: axios } = await import('axios');
    await axios.post(`${grafanaUrl}/api/annotations`, { text, tags }, {
      auth: { username: 'admin', password: 'admin' },
      headers: { 'Content-Type': 'application/json' },
      timeout: 3000,
    });
  } catch { /* best-effort */ }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTLEMENT TRACKER
// ═══════════════════════════════════════════════════════════════════════════════

class SettlementTracker {
  private lastSettledCount = 0;
  public lastPollError = '';
  private settledInLastInterval = 0;
  private client: ApiClient;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private totalPlaced = 0;
  
  constructor(client: ApiClient) { this.client = client; }
  recordPlaced(count: number) { this.totalPlaced += count; }
  get pendingCount(): number { return Math.max(0, this.totalPlaced / 2 - this.lastSettledCount); }
  get totalSettled(): number { return this.lastSettledCount; }
  
  getAndResetIntervalSettled(): number {
    const n = this.settledInLastInterval;
    this.settledInLastInterval = 0;
    return n;
  }
  
  startPolling(ms = 1000) { this.pollInterval = setInterval(() => this.poll(), ms); }
  stopPolling() { if (this.pollInterval) { clearInterval(this.pollInterval); this.pollInterval = null; } }
  
  private async poll() {
    // Settlement counts come from an operator-provided command so the benchmark
    // stays backend-agnostic. Set GRID_BENCH_SETTLEMENT_CMD to any shell command
    // that prints `status|count` lines (a `settled|N` line is required); when
    // unset, settlement tracking is disabled and the benchmark reports fills only.
    const settlementCmd = process.env.GRID_BENCH_SETTLEMENT_CMD;
    if (!settlementCmd) {
      this.lastPollError = 'set GRID_BENCH_SETTLEMENT_CMD to enable settlement tracking';
      return;
    }
    try {
      const { execSync } = await import('child_process');
      const result = execSync(settlementCmd, { timeout: 3000 }).toString().trim();
      
      let settled = 0;
      for (const line of result.split('\n')) {
        const [status, count] = line.split('|');
        if (status === 'settled') settled = parseInt(count);
      }
      const newSettled = settled - this.lastSettledCount;
      if (newSettled > 0) this.settledInLastInterval += newSettled;
      this.lastSettledCount = settled;
      this.lastPollError = '';
    } catch (err: any) {
      this.lastPollError = err?.message?.slice(0, 80) || String(err).slice(0, 80);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN BENCHMARK
// ═══════════════════════════════════════════════════════════════════════════════

interface BenchOpts {
  minConcurrent: number; maxConcurrent: number; stepSize: number; stepDuration: number;
  failureThreshold: number; engine: 'all' | 'old' | 'new';
  accounts: number; tracing: boolean; grafanaUrl: string;
  benchmarkName: string;
}

async function tracedPlaceOrder(
  tracer: Tracer | null,
  client: ApiClient,
  order: { market_id: string; side: string; type: string; quantity: string; price: string; time_in_force: string },
  label: string,
): Promise<void> {
  if (!tracer) {
    await client.placeOrder(order as any);
    return;
  }
  
  // Create a business-level span. The underlying HTTP request automatically
  // gets its own child span + traceparent propagation via the OTel HTTP
  // instrumentation registered in core/observability/tracing.ts.
  const span = tracer.startSpan(`grid.benchmark.place_order.${label}`, {
    kind: SpanKind.INTERNAL,
    attributes: {
      'grid.order.side': order.side,
      'grid.order.market_id': order.market_id,
    },
  });
  
  const ctx = trace.setSpan(context.active(), span);
  try {
    await context.with(ctx, async () => {
      const t0 = performance.now();
      await client.placeOrder(order as any);
      span.setAttribute('grid.http.duration_ms', performance.now() - t0);
      span.setStatus({ code: SpanStatusCode.OK });
    });
  } catch (err: any) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: err?.message || 'failed' });
    throw err;
  } finally {
    span.end();
  }
}

async function runLiveBenchmark(opts: BenchOpts): Promise<void> {
  const { minConcurrent, maxConcurrent, stepSize, stepDuration, failureThreshold, engine,
    accounts, tracing, grafanaUrl, benchmarkName } = opts;

  logger.transports.forEach((t: any) => { t.silent = true; });
  setRetriesEnabled(false);
  
  const benchmarkId = randomUUID();
  let tracer: Tracer | null = null;
  let rootSpan: Span | null = null;
  
  if (tracing) {
    tracer = getBenchTracer();
    rootSpan = tracer.startSpan('grid.benchmark.run', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'grid.benchmark.id': benchmarkId,
        'grid.benchmark.name': benchmarkName,
        'grid.benchmark.engine': engine,
        'grid.benchmark.max_concurrent': maxConcurrent,
        'grid.benchmark.accounts': accounts,
      },
    });
  }
  
  const state: BenchState = {
    status: 'starting', step: 1, elapsedSec: 0, concurrency: minConcurrent, maxConcurrent,
    throughputHistory: [], latencyHistory: [], errorHistory: [],
    settlementLatencyHistory: [], settlementThroughputHistory: [], pendingHistory: [],
    totalOrders: 0, totalErrors: 0, totalMatches: 0, settledCount: 0,
    currentThroughput: 0, currentLatency: 0, currentSettlementLatency: 0,
    peakThroughput: 0, peakConcurrency: 1, failureThreshold, pollError: '',
  };
  
  try {
    // Build client pool: either one default client or N profile-based clients
    const clients: ApiClient[] = [];
    if (accounts > 1) {
      for (let i = 1; i <= accounts; i++) {
        const profileName = `bench_${String(i).padStart(3, '0')}`;
        try {
          clients.push(ApiClient.getInstanceForProfile(profileName));
        } catch {
          console.log(`  ${c.yellow}Warning: profile '${profileName}' not found, skipping${c.reset}`);
        }
      }
      if (clients.length < 2) {
        console.log(`\n  ${c.red}✗ Need at least 2 accounts for multi-account benchmark. Found: ${clients.length}${c.reset}`);
        console.log(`  ${c.gray}Run: BENCH_ACCOUNTS=${accounts} make reset${c.reset}\n`);
        return;
      }
    } else {
      clients.push(ApiClient.getInstance());
    }
    
    // Trace propagation (traceparent) is handled automatically by the OTel HTTP
    // instrumentation. We only need to set the static benchmark metadata headers.
    for (const client of clients) {
      (client as any).client.defaults.headers.common['x-grid-benchmark-id'] = benchmarkId;
      (client as any).client.defaults.headers.common['x-grid-benchmark-name'] = benchmarkName;
    }
    
    const primaryClient = clients[0];
    
    let markets;
    try {
      markets = await primaryClient.getMarkets();
    } catch {
      state.status = 'failed'; renderScreen(state);
      console.log(`\n  ${c.red}✗ Cannot connect to server${c.reset}\n`);
      return;
    }
    
    let active = markets.filter(m => m.status === 'active');
    if (engine === 'old') active = active.filter(m => m.market_id.startsWith('market_'));
    else if (engine === 'new') active = active.filter(m => !m.market_id.startsWith('market_'));
    active = active.slice(0, 3);
    
    if (!active.length) {
      state.status = 'failed'; renderScreen(state);
      console.log(`\n  ${c.red}✗ No active markets for engine=${engine}${c.reset}\n`);
      return;
    }
    
    const prices: Record<string, number> = {};
    for (const m of active) {
      try {
        const t = await primaryClient.getTicker(m.market_id);
        prices[m.market_id] = parseFloat(t.last_price || t.highest_bid || '100');
      } catch { prices[m.market_id] = 100; }
    }
    const marketIds = Object.keys(prices);
    
    const rateLimitConcurrent = parseInt(process.env.SDK_RATE_LIMIT_CONCURRENT || '10');
    const rateLimitInterval = parseInt(process.env.SDK_RATE_LIMIT_INTERVAL || '100');
    
    const benchConfig: BenchConfig = {
      minConcurrent, maxConcurrent, stepSize, stepDuration, failureThreshold, engine,
      accounts: clients.length, tracing, grafanaUrl: grafanaUrl || '',
      rateLimitConcurrent, rateLimitInterval,
      marketCount: marketIds.length,
      marketNames: active.map(m => m.market_id.slice(0, 12) + '...'),
      apiUrl: (primaryClient as any).client?.defaults?.baseURL || 'unknown',
      benchmarkName, benchmarkId,
    };
    
    renderConfig(benchConfig);
    if (tracing) console.log(`  ${c.gray}Benchmark ID: ${benchmarkId}${c.reset}`);
    await new Promise(r => setTimeout(r, 2000));
    
    await postGrafanaAnnotation(grafanaUrl,
      `Benchmark START: ${benchmarkName || 'unnamed'} engine=${engine} conc=${maxConcurrent} accounts=${clients.length}`,
      ['benchmark', 'start', benchmarkId]);
    
    const tracker = new SettlementTracker(primaryClient);
    tracker.startPolling(1000);
    
    state.status = 'running';
    const benchStart = Date.now();
    let orders = 0, errors = 0;
    let latencies: number[] = [];
    let lastTime = Date.now(), lastOrders = 0, lastErrors = 0;
    let curConc = minConcurrent, zeroThroughputCount = 0, shouldStop = false;
    const ZERO_THROUGHPUT_LIMIT = 10;
    
    const renderInterval = setInterval(() => {
      const now = Date.now();
      const dt = (now - lastTime) / 1000;
      const dOrders = orders - lastOrders;
      const dErrors = errors - lastErrors;
      const tp = dt > 0 ? dOrders / dt : 0;
      const avgLat = latencies.length > 0 ? latencies.slice(-100).reduce((a, b) => a + b, 0) / Math.min(100, latencies.length) : 0;
      const errRate = (dOrders + dErrors) > 0 ? (dErrors / (dOrders + dErrors)) * 100 : 0;
      
      if (tp > state.peakThroughput) { state.peakThroughput = tp; state.peakConcurrency = curConc; }
      if (tp === 0 && state.peakThroughput > 0) { zeroThroughputCount++; if (zeroThroughputCount >= ZERO_THROUGHPUT_LIMIT) shouldStop = true; }
      else zeroThroughputCount = 0;
      
      const settledInterval = tracker.getAndResetIntervalSettled();
      const settleTp = dt > 0 ? settledInterval / dt : 0;
      const totalMatches = Math.floor(orders / 2);
      const settlePct = totalMatches > 0 ? (tracker.totalSettled / totalMatches) * 100 : 0;
      
      Object.assign(state, {
        elapsedSec: (now - benchStart) / 1000, totalOrders: orders, totalErrors: errors,
        totalMatches, settledCount: tracker.totalSettled, currentThroughput: tp,
        currentLatency: avgLat, currentSettlementLatency: settlePct, concurrency: curConc,
        pollError: tracker.lastPollError,
      });
      state.throughputHistory.push(tp); state.latencyHistory.push(avgLat);
      state.errorHistory.push(errRate); state.settlementThroughputHistory.push(settleTp);
      state.settlementLatencyHistory.push(settlePct); state.pendingHistory.push(tracker.pendingCount);
      
      lastTime = now; lastOrders = orders; lastErrors = errors;
      renderScreen(state);
    }, 500);
    
    // Main benchmark loop
    while (curConc <= maxConcurrent && !shouldStop) {
      state.concurrency = curConc;
      const stepStart = Date.now();
      const stepErrors = errors, stepOrders = orders;
      
      while ((Date.now() - stepStart) < stepDuration * 1000 && !shouldStop) {
        const batch: Promise<void>[] = [];
        
        for (let i = 0; i < curConc; i++) {
          const mid = marketIds[Math.floor(Math.random() * marketIds.length)];
          const basePrice = prices[mid];
          
          // For multi-account: seller and buyer are different accounts
          const sellerIdx = i % clients.length;
          let buyerIdx = (i + 1) % clients.length;
          if (buyerIdx === sellerIdx && clients.length > 1) buyerIdx = (sellerIdx + 1) % clients.length;
          const seller = clients[sellerIdx];
          const buyer = clients[buyerIdx];
          
          batch.push((async () => {
            const t0 = performance.now();
            const pairSpan = tracer?.startSpan('grid.benchmark.order_pair', {
              kind: SpanKind.CLIENT,
              attributes: { 'grid.market_id': mid, 'grid.benchmark.concurrency': curConc },
            });
            
            const pairCtx = pairSpan
              ? trace.setSpan(context.active(), pairSpan)
              : context.active();
            
            try {
              await context.with(pairCtx, async () => {
                const matchPrice = basePrice.toFixed(4);
                const orderOpts = { market_id: mid, type: 'limit' as const, quantity: '1', price: matchPrice, time_in_force: 'gtc' as const };
                
                await tracedPlaceOrder(tracer, seller, { ...orderOpts, side: 'sell' }, 'sell');
                await tracedPlaceOrder(tracer, buyer, { ...orderOpts, side: 'buy' }, 'buy');
                orders += 2;
                latencies.push(performance.now() - t0);
                tracker.recordPlaced(2);
                pairSpan?.setStatus({ code: SpanStatusCode.OK });
              });
            } catch {
              errors++;
              pairSpan?.setStatus({ code: SpanStatusCode.ERROR, message: 'order_failed' });
            } finally {
              pairSpan?.end();
            }
          })());
        }
        
        await Promise.all(batch);
      }
      
      if (shouldStop) break;
      const stepOrd = orders - stepOrders;
      const stepErr = errors - stepErrors;
      if (stepOrd > 0 && stepErr / (stepOrd + stepErr) >= failureThreshold) { state.status = 'failed'; break; }
      curConc += stepSize;
      state.step++;
    }
    
    // Drain phase
    if (state.status !== 'failed') {
      state.status = 'draining'; state.currentThroughput = 0;
      let lastSettled = tracker.totalSettled, lastProgressAt = Date.now();
      
      while (tracker.totalSettled < state.totalMatches) {
        await new Promise(r => setTimeout(r, 500));
        const now = Date.now();
        state.elapsedSec = (now - benchStart) / 1000; state.settledCount = tracker.totalSettled;
        const si = tracker.getAndResetIntervalSettled();
        const sp = state.totalMatches > 0 ? (tracker.totalSettled / state.totalMatches) * 100 : 0;
        state.currentSettlementLatency = sp;
        state.settlementThroughputHistory.push(si / 0.5); state.settlementLatencyHistory.push(sp);
        state.pendingHistory.push(tracker.pendingCount);
        state.throughputHistory.push(0); state.latencyHistory.push(0); state.errorHistory.push(0);
        renderScreen(state);
        if (tracker.totalSettled > lastSettled) { lastSettled = tracker.totalSettled; lastProgressAt = now; }
        if (now - lastProgressAt > 10_000) { state.status = 'stalled'; renderScreen(state); break; }
      }
      
      if (state.status === 'draining') state.status = 'complete';
      clearInterval(renderInterval);
      state.elapsedSec = (Date.now() - benchStart) / 1000; state.settledCount = tracker.totalSettled;
      state.currentSettlementLatency = state.totalMatches > 0 ? (tracker.totalSettled / state.totalMatches) * 100 : 0;
      renderScreen(state);
    }
    
    await postGrafanaAnnotation(grafanaUrl,
      `Benchmark END: ${benchmarkName || 'unnamed'} peak=${state.peakThroughput.toFixed(0)}/s@${state.peakConcurrency} orders=${state.totalOrders} trades=${state.settledCount}`,
      ['benchmark', 'end', benchmarkId]);
    
    tracker.stopPolling();
    
    if (rootSpan) {
      rootSpan.setAttributes({
        'grid.benchmark.peak_throughput': state.peakThroughput,
        'grid.benchmark.peak_concurrency': state.peakConcurrency,
        'grid.benchmark.total_orders': state.totalOrders,
        'grid.benchmark.total_trades': state.settledCount,
        'grid.benchmark.total_errors': state.totalErrors,
        'grid.benchmark.status': state.status,
      });
      rootSpan.end();
    }
    
  } finally {
    logger.transports.forEach((t: any) => { t.silent = false; });
    setRetriesEnabled(true);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLI COMMAND
// ═══════════════════════════════════════════════════════════════════════════════

export const liveCommand = new Command('live')
  .description('Live progressive benchmark with real-time ASCII charts')
  .option('--min-concurrent <n>', 'Starting concurrency level', '1')
  .option('--max-concurrent <n>', 'Maximum concurrency level', '30')
  .option('--step-size <n>', 'Concurrency increase per step', '2')
  .option('--step-duration <s>', 'Duration of each step in seconds', '5')
  .option('--failure-threshold <f>', 'Error rate to trigger failure (0.0-1.0)', '0.1')
  .option('--engine <type>', 'Market engine filter: all, old, new', 'all')
  .option('--accounts <n>', 'Number of trading accounts (requires seeded bench_NNN profiles)', '1')
  .option('--tracing', 'Enable OpenTelemetry tracing with OTLP export', false)
  .option('--benchmark-name <name>', 'Name for this benchmark run', '')
  .option('--grafana-url <url>', 'Grafana URL for annotations')
  .action(async (opts) => {
    process.env.SDK_RATE_LIMIT_INTERVAL = process.env.SDK_RATE_LIMIT_INTERVAL || '0';
    process.env.SDK_RATE_LIMIT_CONCURRENT = process.env.SDK_RATE_LIMIT_CONCURRENT || '200';
    
    const engine = (['all', 'old', 'new'].includes(opts.engine) ? opts.engine : 'all') as 'all' | 'old' | 'new';
    
    await runLiveBenchmark({
      minConcurrent: parseInt(opts.minConcurrent),
      maxConcurrent: parseInt(opts.maxConcurrent),
      stepSize: parseInt(opts.stepSize),
      stepDuration: parseInt(opts.stepDuration),
      failureThreshold: parseFloat(opts.failureThreshold),
      engine,
      accounts: parseInt(opts.accounts),
      tracing: !!opts.tracing,
      benchmarkName: opts.benchmarkName || `bench-${engine}-${Date.now()}`,
      grafanaUrl: opts.grafanaUrl || process.env.GRAFANA_URL || '',
    });
  });
