import { describe, expect, it } from 'vitest';

import { mapWithConcurrency } from './concurrency';

describe('mapWithConcurrency', () => {
  it('returns results in input order regardless of completion order', async () => {
    const delays = [30, 10, 20, 5];

    const results = await mapWithConcurrency(delays, 4, async (delay) => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return delay;
    });

    expect(results).toEqual(delays);
  });

  it('never runs more than `limit` calls concurrently', async () => {
    let active = 0;
    let maxActive = 0;
    const items = Array.from({ length: 10 }, (_, index) => index);

    await mapWithConcurrency(items, 3, async (item) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return item;
    });

    expect(maxActive).toBeLessThanOrEqual(3);
    expect(maxActive).toBeGreaterThan(1); // proves it actually parallelizes, not serial
  });

  it('processes every item exactly once', async () => {
    const items = Array.from({ length: 25 }, (_, index) => index);
    const seen: number[] = [];

    await mapWithConcurrency(items, 5, async (item) => {
      seen.push(item);
      return item;
    });

    expect(seen.slice().sort((a, b) => a - b)).toEqual(items);
  });

  it('handles an empty array without hanging', async () => {
    const results = await mapWithConcurrency([], 5, async (item) => item);
    expect(results).toEqual([]);
  });

  it('handles a limit larger than the item count', async () => {
    const results = await mapWithConcurrency(
      [1, 2],
      10,
      async (item) => item * 2,
    );
    expect(results).toEqual([2, 4]);
  });

  it('propagates a rejection from the mapper', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (item) => {
        if (item === 2) throw new Error('boom');
        return item;
      }),
    ).rejects.toThrow('boom');
  });
});
