import { afterAll, describe, expect, it } from 'vitest';

import {
  closePools,
  seedFamily,
  seedProfile,
  seedSeries,
  withUserContext,
} from './database';

afterAll(async () => {
  await closePools();
});

// Regression coverage for the chore-harden-update-series-next-episode fix:
// update_series_next_episode is SECURITY DEFINER (bypasses RLS by design,
// since the scheduled episode-check cron runs with no logged-in user) but
// previously had no assertion that the calling session belonged to the
// target series' family. checkNextEpisodeAction already gates this
// indirectly via an RLS-scoped SELECT before calling it, but the function
// itself now enforces it too, so it's safe even if a future caller skips
// that lookup.

async function updateNextEpisode(
  callerId: string,
  seriesId: string,
  airDate: string,
  label: string,
) {
  return withUserContext(callerId, (client) =>
    client.query('SELECT public.update_series_next_episode($1, $2, $3)', [
      seriesId,
      airDate,
      label,
    ]),
  );
}

describe('update_series_next_episode', () => {
  it("updates the next-episode fields for a series in the caller's own family", async () => {
    const owner = await seedProfile('Owner');
    const family = await seedFamily(owner.id, 'Family A');
    const series = await seedSeries(family.id, owner.id, 'Show A');

    await updateNextEpisode(owner.id, series.id, '2026-01-01', 'S1E1');

    const result = await withUserContext(owner.id, (client) =>
      client.query<{ next_episode_label: string | null }>(
        'SELECT next_episode_label FROM public.family_series WHERE id = $1',
        [series.id],
      ),
    );
    expect(result.rows[0].next_episode_label).toBe('S1E1');
  });

  it('does not update a series belonging to a family the caller is not in', async () => {
    const owner = await seedProfile('Owner');
    const outsider = await seedProfile('Outsider');
    const family = await seedFamily(owner.id, 'Family B');
    const series = await seedSeries(family.id, owner.id, 'Show B');

    // A zero-row UPDATE under the new guard is not an error -- assert the
    // field is still unset afterward rather than expecting a throw.
    await updateNextEpisode(outsider.id, series.id, '2026-01-01', 'S1E1');

    const result = await withUserContext(owner.id, (client) =>
      client.query<{ next_episode_label: string | null }>(
        'SELECT next_episode_label FROM public.family_series WHERE id = $1',
        [series.id],
      ),
    );
    expect(result.rows[0].next_episode_label).toBeNull();
  });
});
