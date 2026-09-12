/**
 * Runs `fn` over `items` with at most `limit` calls in flight at once.
 * Used to bound fan-out for per-item external API calls (e.g. cron jobs
 * that check dozens of tracked series) without either serializing every
 * call or firing them all at once.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );

  return results;
}
