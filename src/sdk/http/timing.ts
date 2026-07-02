/**
 * Request Timing Instrumentation
 * 
 * Measures latency at each layer of the request lifecycle for debugging
 * and benchmark analysis.
 */

/**
 * Detailed timing breakdown for a single request
 */
export interface RequestTiming {
  // SDK preparation phase
  signatureGenerationMs: number;    // Time to generate Ed25519 signature
  requestSerializationMs: number;   // Time to serialize request body
  
  // Network phase
  timeToFirstByteMs: number;        // Time until first response byte (TTFB)
  responseDownloadMs: number;       // Time to receive full response
  
  // Response processing phase
  responseParsingMs: number;        // JSON parsing time
  responseValidationMs: number;     // Schema validation time (if any)
  
  // Totals
  totalClientMs: number;            // Total time on client side
  
  // Server-reported timing (from headers)
  serverReportedMs?: number;        // From X-Response-Time header
  serverAuthMs?: number;            // From X-Auth-Time header
  serverHandlerMs?: number;         // From X-Handler-Time header
}

/**
 * Aggregate timing statistics for multiple requests
 */
export interface TimingStats {
  count: number;
  
  // Averages
  avgSignatureMs: number;
  avgTtfbMs: number;
  avgServerMs: number;
  avgTotalMs: number;
  
  // Percentiles
  p50TotalMs: number;
  p95TotalMs: number;
  p99TotalMs: number;
  
  // Min/Max
  minTotalMs: number;
  maxTotalMs: number;
  
  // Breakdown percentages (of total time)
  signaturePct: number;
  networkPct: number;
  serverPct: number;
  parsingPct: number;
}

/**
 * Timer utility for measuring durations
 */
export class Timer {
  private startTime: number = 0;
  private markers: Map<string, number> = new Map();
  
  start(): void {
    this.startTime = performance.now();
  }
  
  mark(label: string): void {
    this.markers.set(label, performance.now());
  }
  
  elapsed(): number {
    return performance.now() - this.startTime;
  }
  
  elapsedSince(label: string): number {
    const markerTime = this.markers.get(label);
    if (!markerTime) return 0;
    return performance.now() - markerTime;
  }
  
  durationBetween(startLabel: string, endLabel: string): number {
    const startTime = this.markers.get(startLabel);
    const endTime = this.markers.get(endLabel);
    if (!startTime || !endTime) return 0;
    return endTime - startTime;
  }
  
  reset(): void {
    this.startTime = 0;
    this.markers.clear();
  }
}

/**
 * Global timing state for tracking request timings
 */
let timingEnabled = false;
let currentRequestTiming: Partial<RequestTiming> | null = null;
let lastRequestTiming: RequestTiming | null = null;
const timingHistory: RequestTiming[] = [];
const MAX_HISTORY = 1000;

/**
 * Enable or disable timing collection
 */
export function setTimingEnabled(enabled: boolean): void {
  timingEnabled = enabled;
}

/**
 * Check if timing is enabled
 */
export function isTimingEnabled(): boolean {
  return timingEnabled;
}

/**
 * Start timing a new request
 */
export function startRequestTiming(): Timer | null {
  if (!timingEnabled) return null;
  
  currentRequestTiming = {
    signatureGenerationMs: 0,
    requestSerializationMs: 0,
    timeToFirstByteMs: 0,
    responseDownloadMs: 0,
    responseParsingMs: 0,
    responseValidationMs: 0,
    totalClientMs: 0,
  };
  
  const timer = new Timer();
  timer.start();
  return timer;
}

/**
 * Record a timing measurement for the current request
 */
export function recordTiming(key: keyof RequestTiming, value: number): void {
  if (currentRequestTiming) {
    (currentRequestTiming as any)[key] = value;
  }
}

/**
 * Complete timing for the current request
 */
export function completeRequestTiming(timer: Timer): RequestTiming | null {
  if (!currentRequestTiming || !timer) return null;
  
  currentRequestTiming.totalClientMs = timer.elapsed();
  
  const timing = currentRequestTiming as RequestTiming;
  lastRequestTiming = timing;
  
  // Add to history (bounded)
  timingHistory.push(timing);
  if (timingHistory.length > MAX_HISTORY) {
    timingHistory.shift();
  }
  
  currentRequestTiming = null;
  return timing;
}

/**
 * Get the last completed request timing
 */
export function getLastRequestTiming(): RequestTiming | null {
  return lastRequestTiming;
}

/**
 * Get timing history
 */
export function getTimingHistory(): RequestTiming[] {
  return [...timingHistory];
}

/**
 * Clear timing history
 */
export function clearTimingHistory(): void {
  timingHistory.length = 0;
  lastRequestTiming = null;
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  const index = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, index)];
}

/**
 * Calculate aggregate timing statistics from history
 */
export function calculateTimingStats(timings?: RequestTiming[]): TimingStats {
  const data = timings || timingHistory;
  
  if (data.length === 0) {
    return {
      count: 0,
      avgSignatureMs: 0,
      avgTtfbMs: 0,
      avgServerMs: 0,
      avgTotalMs: 0,
      p50TotalMs: 0,
      p95TotalMs: 0,
      p99TotalMs: 0,
      minTotalMs: 0,
      maxTotalMs: 0,
      signaturePct: 0,
      networkPct: 0,
      serverPct: 0,
      parsingPct: 0,
    };
  }
  
  // Calculate sums
  let sumSignature = 0;
  let sumTtfb = 0;
  let sumServer = 0;
  let sumTotal = 0;
  let sumParsing = 0;
  let serverCount = 0;
  
  const totals: number[] = [];
  
  for (const t of data) {
    sumSignature += t.signatureGenerationMs;
    sumTtfb += t.timeToFirstByteMs;
    sumTotal += t.totalClientMs;
    sumParsing += t.responseParsingMs;
    totals.push(t.totalClientMs);
    
    if (t.serverReportedMs !== undefined) {
      sumServer += t.serverReportedMs;
      serverCount++;
    }
  }
  
  // Sort totals for percentiles
  totals.sort((a, b) => a - b);
  
  const count = data.length;
  const avgTotal = sumTotal / count;
  const avgSignature = sumSignature / count;
  const avgTtfb = sumTtfb / count;
  const avgParsing = sumParsing / count;
  const avgServer = serverCount > 0 ? sumServer / serverCount : 0;
  
  // Calculate network time as TTFB minus signature minus server time
  const avgNetwork = Math.max(0, avgTtfb - avgSignature - avgServer);
  
  return {
    count,
    avgSignatureMs: Math.round(avgSignature * 100) / 100,
    avgTtfbMs: Math.round(avgTtfb * 100) / 100,
    avgServerMs: Math.round(avgServer * 100) / 100,
    avgTotalMs: Math.round(avgTotal * 100) / 100,
    p50TotalMs: Math.round(percentile(totals, 50) * 100) / 100,
    p95TotalMs: Math.round(percentile(totals, 95) * 100) / 100,
    p99TotalMs: Math.round(percentile(totals, 99) * 100) / 100,
    minTotalMs: Math.round(Math.min(...totals) * 100) / 100,
    maxTotalMs: Math.round(Math.max(...totals) * 100) / 100,
    signaturePct: avgTotal > 0 ? Math.round((avgSignature / avgTotal) * 100) : 0,
    networkPct: avgTotal > 0 ? Math.round((avgNetwork / avgTotal) * 100) : 0,
    serverPct: avgTotal > 0 ? Math.round((avgServer / avgTotal) * 100) : 0,
    parsingPct: avgTotal > 0 ? Math.round((avgParsing / avgTotal) * 100) : 0,
  };
}

/**
 * Format timing for console output
 */
export function formatTiming(timing: RequestTiming): string {
  const lines = [
    '',
    'Request Timing:',
    `  Signature generation:  ${timing.signatureGenerationMs.toFixed(1)}ms`,
    `  Request serialization: ${timing.requestSerializationMs.toFixed(1)}ms`,
    `  Time to first byte:    ${timing.timeToFirstByteMs.toFixed(1)}ms`,
    `  Response download:     ${timing.responseDownloadMs.toFixed(1)}ms`,
    `  Response parsing:      ${timing.responseParsingMs.toFixed(1)}ms`,
    '  ─────────────────────────────',
    `  Total client time:     ${timing.totalClientMs.toFixed(1)}ms`,
  ];
  
  if (timing.serverReportedMs !== undefined) {
    lines.push(`  Server reported:       ${timing.serverReportedMs.toFixed(1)}ms (from header)`);
  }
  
  return lines.join('\n');
}

/**
 * Format timing stats for reports
 */
export function formatTimingStats(stats: TimingStats): string {
  if (stats.count === 0) {
    return 'No timing data collected';
  }
  
  return `
Timing Statistics (${stats.count} requests):
  Average:     ${stats.avgTotalMs}ms
  Median:      ${stats.p50TotalMs}ms
  95th %ile:   ${stats.p95TotalMs}ms
  99th %ile:   ${stats.p99TotalMs}ms
  Min/Max:     ${stats.minTotalMs}ms / ${stats.maxTotalMs}ms
  
Breakdown:
  Signature:   ${stats.avgSignatureMs}ms (${stats.signaturePct}%)
  Network:     ~${(stats.avgTtfbMs - stats.avgSignatureMs - stats.avgServerMs).toFixed(1)}ms (${stats.networkPct}%)
  Server:      ${stats.avgServerMs}ms (${stats.serverPct}%)
  Parsing:     ~${(stats.avgTotalMs - stats.avgTtfbMs).toFixed(1)}ms (${stats.parsingPct}%)
`.trim();
}

/**
 * Parse server timing headers
 */
export function parseServerTimingHeaders(headers: Record<string, string>): Partial<RequestTiming> {
  const result: Partial<RequestTiming> = {};
  
  // X-Response-Time header (common format)
  const responseTime = headers['x-response-time'];
  if (responseTime) {
    const ms = parseFloat(responseTime);
    if (!isNaN(ms)) {
      result.serverReportedMs = ms;
    }
  }
  
  // X-Auth-Time header
  const authTime = headers['x-auth-time'];
  if (authTime) {
    const ms = parseFloat(authTime);
    if (!isNaN(ms)) {
      result.serverAuthMs = ms;
    }
  }
  
  // X-Handler-Time header
  const handlerTime = headers['x-handler-time'];
  if (handlerTime) {
    const ms = parseFloat(handlerTime);
    if (!isNaN(ms)) {
      result.serverHandlerMs = ms;
    }
  }
  
  // Server-Timing header (W3C standard)
  // Format: auth;dur=12, handler;dur=33, total;dur=45
  const serverTiming = headers['server-timing'];
  if (serverTiming) {
    const parts = serverTiming.split(',');
    for (const part of parts) {
      const match = part.match(/(\w+);dur=([\d.]+)/);
      if (match) {
        const [, name, duration] = match;
        const ms = parseFloat(duration);
        if (!isNaN(ms)) {
          switch (name.toLowerCase()) {
            case 'auth':
              result.serverAuthMs = ms;
              break;
            case 'handler':
              result.serverHandlerMs = ms;
              break;
            case 'total':
              result.serverReportedMs = ms;
              break;
          }
        }
      }
    }
  }
  
  return result;
}
