import { describe, expect, it } from 'vitest';

import { checkRateLimit } from '@/shared/lib/rateLimit';
import { uniqueSuffix } from './database';

// Exercises the real public.check_rate_limit (0016_rate_limiting.sql)
// through checkRateLimit exactly as the app calls it -- including the new
// per-user bucket used by checkSeriesUpdatesAction/checkNextEpisodeAction
// to throttle their external OMDb/Kinopoisk/TMDB calls.

describe('checkRateLimit', () => {
  it('allows attempts up to the configured maximum', async () => {
    const bucket = `test:${uniqueSuffix()}`;

    expect(await checkRateLimit(bucket, 3, 60)).toBe(true);
    expect(await checkRateLimit(bucket, 3, 60)).toBe(true);
    expect(await checkRateLimit(bucket, 3, 60)).toBe(true);
  });

  it('rejects once a bucket exceeds its maximum within the window', async () => {
    const bucket = `test:${uniqueSuffix()}`;

    await checkRateLimit(bucket, 2, 60);
    await checkRateLimit(bucket, 2, 60);

    expect(await checkRateLimit(bucket, 2, 60)).toBe(false);
  });

  it('keeps separate buckets independent', async () => {
    const bucketA = `test:${uniqueSuffix()}`;
    const bucketB = `test:${uniqueSuffix()}`;

    await checkRateLimit(bucketA, 1, 60);
    await checkRateLimit(bucketA, 1, 60); // exhausts bucket A only

    expect(await checkRateLimit(bucketB, 1, 60)).toBe(true);
  });

  it('resets the count once the window has fully elapsed', async () => {
    const bucket = `test:${uniqueSuffix()}`;

    await checkRateLimit(bucket, 1, 1); // 1-second window
    expect(await checkRateLimit(bucket, 1, 1)).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 1100));

    expect(await checkRateLimit(bucket, 1, 1)).toBe(true);
  });
});
