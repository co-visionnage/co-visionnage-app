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

// Regression coverage for the fix-watch-events-series-family-scope fix:
// family_watch_events_insert_member checked family_id membership but never
// that an optional series_id belonged to that same family -- exercises the
// exact query shape scheduleWatchEventAction uses.

async function scheduleEvent(
  userId: string,
  familyId: string,
  seriesId: string | undefined,
  title: string,
) {
  return withUserContext(userId, (client) =>
    client.query<{ id: string }>(
      `
        INSERT INTO public.family_watch_events (family_id, series_id, created_by, title, scheduled_at)
        VALUES ($1, $2, $3, $4, NOW() + interval '1 day')
        RETURNING id
      `,
      [familyId, seriesId, userId, title],
    ),
  );
}

describe('family_watch_events series/family scoping', () => {
  it('allows scheduling an event linked to a series in the same family', async () => {
    const owner = await seedProfile('Owner');
    const family = await seedFamily(owner.id, 'Family A');
    const series = await seedSeries(family.id, owner.id, 'Show A');

    await expect(
      scheduleEvent(owner.id, family.id, series.id, 'Movie night'),
    ).resolves.toBeDefined();
  });

  it('allows scheduling an event with no linked series', async () => {
    const owner = await seedProfile('Owner');
    const family = await seedFamily(owner.id, 'Family B');

    await expect(
      scheduleEvent(owner.id, family.id, undefined, 'Just hanging out'),
    ).resolves.toBeDefined();
  });

  it('rejects linking an event to a series from a different family', async () => {
    const owner = await seedProfile('Owner');
    const otherOwner = await seedProfile('Other Owner');
    const family = await seedFamily(owner.id, 'Family C');
    const otherFamily = await seedFamily(otherOwner.id, 'Family D');
    const foreignSeries = await seedSeries(
      otherFamily.id,
      otherOwner.id,
      'Foreign Show',
    );

    await expect(
      scheduleEvent(owner.id, family.id, foreignSeries.id, 'Sneaky event'),
    ).rejects.toThrow(/row-level security/i);
  });
});
