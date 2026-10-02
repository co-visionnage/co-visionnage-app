import { afterAll, describe, expect, it } from 'vitest';

import {
  addFamilyMember,
  closePools,
  seedFamily,
  seedProfile,
  seedSeries,
  withUserContext,
} from './database';

afterAll(async () => {
  await closePools();
});

// Coverage for family_series / family_series_status RLS policies, exercised
// the same way addSeriesAction/editAction/deleteAction/markWatchedAction/
// moveToWatchListAction do -- none of series-postgres.ts's core CRUD had
// integration coverage before this (only the bulk-import path did).

async function addSeries(
  userId: string,
  familyId: string,
  title: string,
): Promise<{ id: string }> {
  const result = await withUserContext(userId, (client) =>
    client.query<{ id: string }>(
      `
        INSERT INTO public.family_series (
          family_id, title, genres, year, created_by, media_type
        )
        VALUES ($1, $2, ARRAY[]::text[], 2024, $3, 'series')
        RETURNING id
      `,
      [familyId, title, userId],
    ),
  );
  return { id: result.rows[0].id };
}

async function editSeriesTitle(
  userId: string,
  seriesId: string,
  title: string,
) {
  return withUserContext(userId, (client) =>
    client.query('UPDATE public.family_series SET title = $2 WHERE id = $1', [
      seriesId,
      title,
    ]),
  );
}

async function deleteSeries(userId: string, seriesId: string) {
  return withUserContext(userId, (client) =>
    client.query('DELETE FROM public.family_series WHERE id = $1', [seriesId]),
  );
}

async function getSeriesTitle(
  viewerId: string,
  seriesId: string,
): Promise<string | undefined> {
  const result = await withUserContext(viewerId, (client) =>
    client.query<{ title: string }>(
      'SELECT title FROM public.family_series WHERE id = $1',
      [seriesId],
    ),
  );
  return result.rows[0]?.title;
}

async function markWatched(userId: string, seriesId: string, rating: number) {
  return withUserContext(userId, (client) =>
    client.query(
      `
        INSERT INTO public.family_series_status (
          series_id, user_id, status, rating, watched_at
        )
        VALUES ($1, $2, 'watched', $3, NOW())
        ON CONFLICT (series_id, user_id) DO UPDATE
        SET status = EXCLUDED.status,
            rating = EXCLUDED.rating,
            watched_at = COALESCE(family_series_status.watched_at, NOW())
      `,
      [seriesId, userId, rating],
    ),
  );
}

async function getStatus(
  viewerId: string,
  seriesId: string,
  userId: string,
): Promise<string | undefined> {
  const result = await withUserContext(viewerId, (client) =>
    client.query<{ status: string }>(
      'SELECT status FROM public.family_series_status WHERE series_id = $1 AND user_id = $2',
      [seriesId, userId],
    ),
  );
  return result.rows[0]?.status;
}

describe('family_series insert (addSeriesAction)', () => {
  it('allows a family member to add a series to their own family', async () => {
    const owner = await seedProfile('Owner');
    const family = await seedFamily(owner.id, 'Family A');

    await expect(
      addSeries(owner.id, family.id, 'Show A'),
    ).resolves.toBeDefined();
  });

  it('rejects adding a series to a family the user does not belong to', async () => {
    const owner = await seedProfile('Owner');
    const outsider = await seedProfile('Outsider');
    const family = await seedFamily(owner.id, 'Family B');

    await expect(
      addSeries(outsider.id, family.id, 'Sneaky Show'),
    ).rejects.toThrow(/row-level security/i);
  });

  it('rejects inserting a series attributed to a different created_by', async () => {
    const owner = await seedProfile('Owner');
    const member = await seedProfile('Member');
    const family = await seedFamily(owner.id, 'Family C');
    await addFamilyMember(family.id, member.id);

    await expect(
      withUserContext(member.id, (client) =>
        client.query(
          `
            INSERT INTO public.family_series (family_id, title, genres, year, created_by, media_type)
            VALUES ($1, $2, ARRAY[]::text[], 2024, $3, 'series')
          `,
          [family.id, 'Forged Show', owner.id],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });
});

describe('family_series update/delete (editAction/deleteAction)', () => {
  it('lets any family member edit a series in their family', async () => {
    const owner = await seedProfile('Owner');
    const member = await seedProfile('Member');
    const family = await seedFamily(owner.id, 'Family D');
    await addFamilyMember(family.id, member.id);
    const series = await addSeries(owner.id, family.id, 'Original Title');

    await editSeriesTitle(member.id, series.id, 'Updated Title');

    expect(await getSeriesTitle(owner.id, series.id)).toBe('Updated Title');
  });

  it('does not let an outsider edit a series in a family they do not belong to', async () => {
    const owner = await seedProfile('Owner');
    const outsider = await seedProfile('Outsider');
    const family = await seedFamily(owner.id, 'Family E');
    const series = await addSeries(owner.id, family.id, 'Original Title');

    // A zero-row UPDATE under RLS is not an error.
    await editSeriesTitle(outsider.id, series.id, 'Hijacked Title');

    expect(await getSeriesTitle(owner.id, series.id)).toBe('Original Title');
  });

  it('lets any family member delete a series in their family', async () => {
    const owner = await seedProfile('Owner');
    const member = await seedProfile('Member');
    const family = await seedFamily(owner.id, 'Family F');
    await addFamilyMember(family.id, member.id);
    const series = await addSeries(owner.id, family.id, 'To Delete');

    await deleteSeries(member.id, series.id);

    expect(await getSeriesTitle(owner.id, series.id)).toBeUndefined();
  });

  it('does not let an outsider delete a series in a family they do not belong to', async () => {
    const owner = await seedProfile('Owner');
    const outsider = await seedProfile('Outsider');
    const family = await seedFamily(owner.id, 'Family G');
    const series = await addSeries(owner.id, family.id, 'Protected Show');

    await deleteSeries(outsider.id, series.id);

    expect(await getSeriesTitle(owner.id, series.id)).toBe('Protected Show');
  });
});

describe('family_series_status (markWatchedAction/moveToWatchListAction)', () => {
  it('lets a family member mark a series as watched for themselves', async () => {
    const owner = await seedProfile('Owner');
    const family = await seedFamily(owner.id, 'Family H');
    const series = await seedSeries(family.id, owner.id, 'Show H');

    await markWatched(owner.id, series.id, 4);

    expect(await getStatus(owner.id, series.id, owner.id)).toBe('watched');
  });

  it("rejects marking a status for a series outside the user's family", async () => {
    const owner = await seedProfile('Owner');
    const outsider = await seedProfile('Outsider');
    const family = await seedFamily(owner.id, 'Family I');
    const series = await seedSeries(family.id, owner.id, 'Show I');

    await expect(markWatched(outsider.id, series.id, 4)).rejects.toThrow(
      /row-level security/i,
    );
  });

  it('rejects inserting a status row attributed to a different user_id', async () => {
    const owner = await seedProfile('Owner');
    const member = await seedProfile('Member');
    const family = await seedFamily(owner.id, 'Family J');
    await addFamilyMember(family.id, member.id);
    const series = await seedSeries(family.id, owner.id, 'Show J');

    await expect(
      withUserContext(member.id, (client) =>
        client.query(
          `
            INSERT INTO public.family_series_status (series_id, user_id, status)
            VALUES ($1, $2, 'watched')
          `,
          [series.id, owner.id],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("keeps each family member's watch status independent", async () => {
    const owner = await seedProfile('Owner');
    const member = await seedProfile('Member');
    const family = await seedFamily(owner.id, 'Family K');
    await addFamilyMember(family.id, member.id);
    const series = await seedSeries(family.id, owner.id, 'Show K');

    await markWatched(owner.id, series.id, 5);

    expect(await getStatus(owner.id, series.id, owner.id)).toBe('watched');
    expect(await getStatus(owner.id, series.id, member.id)).toBeUndefined();
  });
});
