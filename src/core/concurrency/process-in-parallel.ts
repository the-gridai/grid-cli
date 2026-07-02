/**
 * Bounded-concurrency task runner. Each input is passed to `worker`, up to
 * `concurrency` workers run in parallel, and errors on one item never block
 * progress on the others.
 *
 * Callers inspect the returned result to decide whether to log warnings or
 * propagate. Unlike `Promise.all`, a failure in one worker does NOT reject
 * the aggregate; unlike `Promise.allSettled`, the result is compact and has
 * a bounded concurrency floor so large input arrays don't explode fan-out.
 */

export interface ProcessResult<T> {
  /** Number of items whose worker resolved without throwing. */
  succeeded: number;
  /** Number of items whose worker threw or rejected. */
  failed: number;
  /** Per-item errors for the failed items, in the order they occurred. */
  errors: Array<{ item: T; error: Error }>;
}

export interface ProcessOptions {
  /**
   * Maximum number of workers running at once. Defaults to 10. Values <1 are
   * clamped to 1. Irrelevant when items.length <= concurrency.
   */
  concurrency?: number;
}

export async function processInParallel<T>(
  items: T[],
  worker: (item: T, index: number) => Promise<void>,
  options: ProcessOptions = {}
): Promise<ProcessResult<T>> {
  const concurrency = Math.max(1, options.concurrency ?? 10);
  const errors: Array<{ item: T; error: Error }> = [];
  let succeeded = 0;
  let failed = 0;
  let cursor = 0;

  const runOne = async (): Promise<void> => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      const item = items[i];
      try {
        await worker(item, i);
        succeeded++;
      } catch (err) {
        failed++;
        errors.push({
          item,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    }
  };

  const workerCount = Math.min(concurrency, items.length);
  const runners: Promise<void>[] = [];
  for (let i = 0; i < workerCount; i++) {
    runners.push(runOne());
  }
  await Promise.all(runners);

  return { succeeded, failed, errors };
}
