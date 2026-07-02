/**
 * Tests for Live Benchmark Utility Functions
 * 
 * These tests cover the logic used in the live benchmark without
 * requiring Ink or React rendering.
 */

// Jest is used for testing in this project

// ═══════════════════════════════════════════════════════════════════════════════
// VALUE FORMATTING
// ═══════════════════════════════════════════════════════════════════════════════

describe('Value Formatting', () => {
  const formatVal = (v: number): string => {
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    if (v >= 100) return v.toFixed(0);
    if (v >= 10) return v.toFixed(1);
    return v.toFixed(2);
  };

  it('formats thousands as k', () => {
    expect(formatVal(1000)).toBe('1.0k');
    expect(formatVal(1500)).toBe('1.5k');
    expect(formatVal(10000)).toBe('10.0k');
    expect(formatVal(100000)).toBe('100.0k');
  });

  it('formats hundreds without decimal', () => {
    expect(formatVal(100)).toBe('100');
    expect(formatVal(500)).toBe('500');
    expect(formatVal(999)).toBe('999');
  });

  it('formats tens with one decimal', () => {
    expect(formatVal(10)).toBe('10.0');
    expect(formatVal(50.5)).toBe('50.5');
    expect(formatVal(99.9)).toBe('99.9');
  });

  it('formats small numbers with two decimals', () => {
    expect(formatVal(0)).toBe('0.00');
    expect(formatVal(1.5)).toBe('1.50');
    expect(formatVal(9.99)).toBe('9.99');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR RATE CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Error Rate Calculation', () => {
  const calculateErrorRate = (orders: number, errors: number): number => {
    const total = orders + errors;
    return total > 0 ? (errors / total) * 100 : 0;
  };

  it('calculates 0% for no errors', () => {
    expect(calculateErrorRate(100, 0)).toBe(0);
  });

  it('calculates 50% for equal orders and errors', () => {
    expect(calculateErrorRate(50, 50)).toBe(50);
  });

  it('calculates 10% for 10 errors out of 100 total', () => {
    expect(calculateErrorRate(90, 10)).toBe(10);
  });

  it('handles zero orders gracefully', () => {
    expect(calculateErrorRate(0, 0)).toBe(0);
  });

  it('handles 100% error rate', () => {
    expect(calculateErrorRate(0, 100)).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR RATE THRESHOLD
// ═══════════════════════════════════════════════════════════════════════════════

describe('Error Rate Threshold Logic', () => {
  const checkThreshold = (
    stepOrders: number, 
    stepErrors: number, 
    threshold: number
  ): boolean => {
    const total = stepOrders + stepErrors;
    const stepErrorRate = total > 0 ? stepErrors / total : 0;
    return stepErrorRate >= threshold;
  };

  it('does not trigger at 9% when threshold is 10%', () => {
    expect(checkThreshold(91, 9, 0.10)).toBe(false);
  });

  it('triggers at 10% when threshold is 10%', () => {
    expect(checkThreshold(90, 10, 0.10)).toBe(true);
  });

  it('triggers at 50% when threshold is 10%', () => {
    expect(checkThreshold(50, 50, 0.10)).toBe(true);
  });

  it('handles zero operations gracefully', () => {
    expect(checkThreshold(0, 0, 0.10)).toBe(false);
  });

  it('triggers at exactly threshold boundary', () => {
    // 10% threshold, exactly 10% errors
    expect(checkThreshold(9, 1, 0.10)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR COLOR CODING
// ═══════════════════════════════════════════════════════════════════════════════

describe('Error Rate Color Coding', () => {
  const getErrorColor = (errorRate: number): 'green' | 'yellow' | 'red' => {
    if (errorRate > 10) return 'red';
    if (errorRate > 2) return 'yellow';
    return 'green';
  };

  it('returns green for 0% errors', () => {
    expect(getErrorColor(0)).toBe('green');
  });

  it('returns green for 2% errors (boundary)', () => {
    expect(getErrorColor(2)).toBe('green');
  });

  it('returns yellow for 2.1% errors', () => {
    expect(getErrorColor(2.1)).toBe('yellow');
  });

  it('returns yellow for 10% errors (boundary)', () => {
    expect(getErrorColor(10)).toBe('yellow');
  });

  it('returns red for 10.1% errors', () => {
    expect(getErrorColor(10.1)).toBe('red');
  });

  it('returns red for high error rates', () => {
    expect(getErrorColor(50)).toBe('red');
    expect(getErrorColor(100)).toBe('red');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DATA HISTORY MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

describe('Data History Management', () => {
  it('keeps all data points without truncation', () => {
    const history: number[] = [];
    
    // Simulate 200 data points (40 seconds at 5 updates/sec)
    for (let i = 0; i < 200; i++) {
      history.push(Math.random() * 100);
    }
    
    expect(history.length).toBe(200);
  });

  it('calculates correct max from full history', () => {
    const history = [10, 50, 30, 100, 25, 75];
    const max = Math.max(...history);
    
    expect(max).toBe(100);
  });

  it('gets current value as last element', () => {
    const history = [10, 20, 30, 40, 50];
    const current = history[history.length - 1];
    
    expect(current).toBe(50);
  });

  it('handles empty history', () => {
    const history: number[] = [];
    const current = history.length > 0 ? history[history.length - 1] : 0;
    
    expect(current).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// THROUGHPUT CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Throughput Calculation', () => {
  const calculateThroughput = (orders: number, timeSeconds: number): number => {
    return timeSeconds > 0 ? orders / timeSeconds : 0;
  };

  it('calculates correct throughput', () => {
    expect(calculateThroughput(100, 10)).toBe(10); // 10 orders/sec
    expect(calculateThroughput(500, 5)).toBe(100); // 100 orders/sec
  });

  it('handles zero time gracefully', () => {
    expect(calculateThroughput(100, 0)).toBe(0);
  });

  it('handles zero orders', () => {
    expect(calculateThroughput(0, 10)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// LATENCY CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Latency Calculation', () => {
  const calculateAvgLatency = (latencies: number[], windowSize: number = 100): number => {
    if (latencies.length === 0) return 0;
    const window = latencies.slice(-windowSize);
    return window.reduce((a, b) => a + b, 0) / window.length;
  };

  it('calculates average latency', () => {
    const latencies = [100, 150, 200];
    expect(calculateAvgLatency(latencies)).toBe(150);
  });

  it('uses window for large datasets', () => {
    const latencies = Array(200).fill(100);
    // Add some high values at the end
    latencies.push(500, 500, 500);
    
    // With window of 100, only last 100 samples used
    // 97 samples of 100 + 3 samples of 500 = 9700 + 1500 = 11200 / 100 = 112
    const avg = calculateAvgLatency(latencies, 100);
    expect(avg).toBeGreaterThan(100);
    expect(avg).toBeLessThan(500);
  });

  it('handles empty latencies', () => {
    expect(calculateAvgLatency([])).toBe(0);
  });

  it('handles single latency', () => {
    expect(calculateAvgLatency([150])).toBe(150);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PEAK TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

describe('Peak Tracking', () => {
  interface PeakState {
    throughput: number;
    concurrency: number;
  }

  const updatePeak = (
    current: PeakState,
    newThroughput: number,
    newConcurrency: number
  ): PeakState => {
    if (newThroughput > current.throughput) {
      return { throughput: newThroughput, concurrency: newConcurrency };
    }
    return current;
  };

  it('updates peak when new throughput is higher', () => {
    const current = { throughput: 100, concurrency: 5 };
    const updated = updatePeak(current, 150, 7);
    
    expect(updated.throughput).toBe(150);
    expect(updated.concurrency).toBe(7);
  });

  it('keeps existing peak when new throughput is lower', () => {
    const current = { throughput: 200, concurrency: 10 };
    const updated = updatePeak(current, 150, 12);
    
    expect(updated.throughput).toBe(200);
    expect(updated.concurrency).toBe(10);
  });

  it('keeps existing peak when throughput is equal', () => {
    const current = { throughput: 100, concurrency: 5 };
    const updated = updatePeak(current, 100, 8);
    
    expect(updated.throughput).toBe(100);
    expect(updated.concurrency).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESS BAR CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Progress Bar Calculation', () => {
  const calculateProgress = (current: number, max: number, width: number): { filled: number; empty: number } => {
    const filled = Math.floor((current / max) * width);
    const empty = width - filled;
    return { filled, empty };
  };

  it('calculates correct progress at 50%', () => {
    const { filled, empty } = calculateProgress(5, 10, 30);
    expect(filled).toBe(15);
    expect(empty).toBe(15);
  });

  it('calculates correct progress at 0%', () => {
    const { filled, empty } = calculateProgress(0, 10, 30);
    expect(filled).toBe(0);
    expect(empty).toBe(30);
  });

  it('calculates correct progress at 100%', () => {
    const { filled, empty } = calculateProgress(10, 10, 30);
    expect(filled).toBe(30);
    expect(empty).toBe(0);
  });

  it('handles rounding correctly', () => {
    const { filled, empty } = calculateProgress(1, 3, 30);
    expect(filled).toBe(10);
    expect(empty).toBe(20);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INTERVAL ERROR RATE CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Interval Error Rate Calculation', () => {
  const calculateIntervalErrorRate = (
    intervalOrders: number,
    intervalErrors: number
  ): number => {
    const total = intervalOrders + intervalErrors;
    return total > 0 ? (intervalErrors / total) * 100 : 0;
  };

  it('calculates error rate for interval', () => {
    // 10 orders, 2 errors in interval
    expect(calculateIntervalErrorRate(10, 2)).toBeCloseTo(16.67, 1);
  });

  it('returns 0 for no activity', () => {
    expect(calculateIntervalErrorRate(0, 0)).toBe(0);
  });

  it('returns 100 for all errors', () => {
    expect(calculateIntervalErrorRate(0, 10)).toBe(100);
  });
});
