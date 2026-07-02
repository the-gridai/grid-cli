import { processInParallel } from '../../../../src/core/concurrency/process-in-parallel';

describe('processInParallel', () => {
  it('returns zero counts and no errors for an empty input', async () => {
    const result = await processInParallel<number>([], async () => {});
    expect(result).toEqual({ succeeded: 0, failed: 0, errors: [] });
  });

  it('runs every item exactly once', async () => {
    const seen: number[] = [];
    const result = await processInParallel(
      [1, 2, 3, 4, 5],
      async (n) => {
        seen.push(n);
      },
      { concurrency: 2 }
    );
    expect(result.succeeded).toBe(5);
    expect(result.failed).toBe(0);
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('never exceeds the concurrency cap', async () => {
    let inFlight = 0;
    let peak = 0;
    const resolvers: Array<() => void> = [];
    const items = Array.from({ length: 20 }, (_, i) => i);

    const runPromise = processInParallel(
      items,
      async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise<void>((resolve) => resolvers.push(resolve));
        inFlight--;
      },
      { concurrency: 3 }
    );

    // Let the first batch start.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(peak).toBeLessThanOrEqual(3);

    // Drain every queued resolver so workers can pick up more items.
    while (resolvers.length) {
      const r = resolvers.shift()!;
      r();
      await new Promise((resolve) => setTimeout(resolve, 1));
    }

    const result = await runPromise;
    expect(result.succeeded).toBe(20);
    expect(peak).toBeLessThanOrEqual(3);
  });

  it('collects errors per item without aborting the other workers', async () => {
    const result = await processInParallel(
      ['ok-1', 'bad-1', 'ok-2', 'bad-2', 'ok-3'],
      async (s) => {
        if (s.startsWith('bad')) throw new Error(`boom:${s}`);
      },
      { concurrency: 2 }
    );
    expect(result.succeeded).toBe(3);
    expect(result.failed).toBe(2);
    expect(result.errors.map((e) => e.item).sort()).toEqual(['bad-1', 'bad-2']);
    expect(result.errors.map((e) => e.error.message).sort()).toEqual([
      'boom:bad-1',
      'boom:bad-2',
    ]);
  });

  it('wraps non-Error throws into Error objects', async () => {
    const result = await processInParallel(['x'], async () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'string reject';
    });
    expect(result.failed).toBe(1);
    expect(result.errors[0].error).toBeInstanceOf(Error);
    expect(result.errors[0].error.message).toBe('string reject');
  });

  it('clamps concurrency < 1 to 1', async () => {
    const seen: number[] = [];
    await processInParallel(
      [1, 2, 3],
      async (n) => {
        seen.push(n);
      },
      { concurrency: 0 }
    );
    expect(seen.sort()).toEqual([1, 2, 3]);
  });
});
