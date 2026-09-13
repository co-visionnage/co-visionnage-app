import { afterAll, describe, expect, it } from 'vitest';

import {
  addFamilyMember,
  closePools,
  seedFamily,
  seedProfile,
  seedSeries,
  withUserContext,
} from './database';

// Coverage for family_series_comments / family_series_reactions RLS policies
// (0003_series_comments_and_reactions.sql), exercised the same way
// comments-postgres.ts's server actions do: everything through
// withUserContext, never a superuser bypass.

async function addComment(userId: string, seriesId: string, body: string) {
  return withUserContext(userId, (client) =>
    client.query<{ id: string }>(
      `
        INSERT INTO public.family_series_comments (series_id, user_id, body)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [seriesId, userId, body],
    ),
  );
}

async function deleteComment(userId: string, commentId: string) {
  return withUserContext(userId, (client) =>
    client.query('DELETE FROM public.family_series_comments WHERE id = $1', [
      commentId,
    ]),
  );
}

async function addReaction(userId: string, seriesId: string, emoji: string) {
  return withUserContext(userId, (client) =>
    client.query<{ id: string }>(
      `
        INSERT INTO public.family_series_reactions (series_id, user_id, emoji)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [seriesId, userId, emoji],
    ),
  );
}

async function deleteReaction(userId: string, reactionId: string) {
  return withUserContext(userId, (client) =>
    client.query('DELETE FROM public.family_series_reactions WHERE id = $1', [
      reactionId,
    ]),
  );
}

afterAll(async () => {
  await closePools();
});

describe('family series comments RLS', () => {
  it('allows a family member to comment on the family series', async () => {
    const owner = await seedProfile('Owner');
    const family = await seedFamily(owner.id, 'Family A');
    const series = await seedSeries(family.id, owner.id, 'Show A');

    await expect(
      addComment(owner.id, series.id, 'Great episode!'),
    ).resolves.toBeDefined();
  });

  it('rejects a comment from a user outside the series family', async () => {
    const owner = await seedProfile('Owner');
    const outsider = await seedProfile('Outsider');
    const family = await seedFamily(owner.id, 'Family B');
    const series = await seedSeries(family.id, owner.id, 'Show B');

    await expect(
      addComment(outsider.id, series.id, 'Sneaky comment'),
    ).rejects.toThrow(/row-level security/i);
  });

  it("rejects inserting a comment under someone else's user_id", async () => {
    const owner = await seedProfile('Owner');
    const member = await seedProfile('Member');
    const family = await seedFamily(owner.id, 'Family C');
    await addFamilyMember(family.id, member.id);
    const series = await seedSeries(family.id, owner.id, 'Show C');

    // member's own session tries to insert a comment attributed to owner
    await expect(
      withUserContext(member.id, (client) =>
        client.query(
          `
            INSERT INTO public.family_series_comments (series_id, user_id, body)
            VALUES ($1, $2, $3)
          `,
          [series.id, owner.id, 'Forged comment'],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('lets the comment author delete their own comment', async () => {
    const owner = await seedProfile('Owner');
    const member = await seedProfile('Member');
    const family = await seedFamily(owner.id, 'Family D');
    await addFamilyMember(family.id, member.id);
    const series = await seedSeries(family.id, owner.id, 'Show D');

    const comment = await addComment(member.id, series.id, 'My comment');
    const commentId = comment.rows[0].id;

    await deleteComment(member.id, commentId);

    const remaining = await withUserContext(owner.id, (client) =>
      client.query(
        'SELECT id FROM public.family_series_comments WHERE id = $1',
        [commentId],
      ),
    );
    expect(remaining.rows).toHaveLength(0);
  });

  it('lets the family owner delete a comment written by another member', async () => {
    const owner = await seedProfile('Owner');
    const member = await seedProfile('Member');
    const family = await seedFamily(owner.id, 'Family E');
    await addFamilyMember(family.id, member.id);
    const series = await seedSeries(family.id, owner.id, 'Show E');

    const comment = await addComment(member.id, series.id, "Member's comment");
    const commentId = comment.rows[0].id;

    await deleteComment(owner.id, commentId);

    const remaining = await withUserContext(owner.id, (client) =>
      client.query(
        'SELECT id FROM public.family_series_comments WHERE id = $1',
        [commentId],
      ),
    );
    expect(remaining.rows).toHaveLength(0);
  });

  it("does not let a plain member delete another member's comment", async () => {
    const owner = await seedProfile('Owner');
    const memberA = await seedProfile('Member A');
    const memberB = await seedProfile('Member B');
    const family = await seedFamily(owner.id, 'Family F');
    await addFamilyMember(family.id, memberA.id);
    await addFamilyMember(family.id, memberB.id);
    const series = await seedSeries(family.id, owner.id, 'Show F');

    const comment = await addComment(memberA.id, series.id, "A's comment");
    const commentId = comment.rows[0].id;

    // DELETE affecting zero rows due to RLS is not an error -- it silently
    // deletes nothing, so assert the comment is still there afterward.
    await deleteComment(memberB.id, commentId);

    const remaining = await withUserContext(owner.id, (client) =>
      client.query(
        'SELECT id FROM public.family_series_comments WHERE id = $1',
        [commentId],
      ),
    );
    expect(remaining.rows).toHaveLength(1);
  });

  it('does not let an outsider delete a comment in a family they do not belong to', async () => {
    const owner = await seedProfile('Owner');
    const outsider = await seedProfile('Outsider');
    const family = await seedFamily(owner.id, 'Family G');
    const series = await seedSeries(family.id, owner.id, 'Show G');

    const comment = await addComment(owner.id, series.id, "Owner's comment");
    const commentId = comment.rows[0].id;

    await deleteComment(outsider.id, commentId);

    const remaining = await withUserContext(owner.id, (client) =>
      client.query(
        'SELECT id FROM public.family_series_comments WHERE id = $1',
        [commentId],
      ),
    );
    expect(remaining.rows).toHaveLength(1);
  });
});

describe('family series reactions RLS', () => {
  it('allows a family member to react to the family series', async () => {
    const owner = await seedProfile('Owner');
    const family = await seedFamily(owner.id, 'Family H');
    const series = await seedSeries(family.id, owner.id, 'Show H');

    await expect(addReaction(owner.id, series.id, '❤️')).resolves.toBeDefined();
  });

  it('rejects a reaction from a user outside the series family', async () => {
    const owner = await seedProfile('Owner');
    const outsider = await seedProfile('Outsider');
    const family = await seedFamily(owner.id, 'Family I');
    const series = await seedSeries(family.id, owner.id, 'Show I');

    await expect(addReaction(outsider.id, series.id, '❤️')).rejects.toThrow(
      /row-level security/i,
    );
  });

  it('lets a member remove their own reaction', async () => {
    const owner = await seedProfile('Owner');
    const family = await seedFamily(owner.id, 'Family J');
    const series = await seedSeries(family.id, owner.id, 'Show J');

    const reaction = await addReaction(owner.id, series.id, '🔥');
    await deleteReaction(owner.id, reaction.rows[0].id);

    const remaining = await withUserContext(owner.id, (client) =>
      client.query(
        'SELECT id FROM public.family_series_reactions WHERE id = $1',
        [reaction.rows[0].id],
      ),
    );
    expect(remaining.rows).toHaveLength(0);
  });

  it("does not let another family member remove someone else's reaction", async () => {
    const owner = await seedProfile('Owner');
    const member = await seedProfile('Member');
    const family = await seedFamily(owner.id, 'Family K');
    await addFamilyMember(family.id, member.id);
    const series = await seedSeries(family.id, owner.id, 'Show K');

    const reaction = await addReaction(owner.id, series.id, '👍');

    // Unlike comments, reactions have no "owner can moderate" clause -- only
    // the reacting user themselves can remove their own reaction.
    await deleteReaction(member.id, reaction.rows[0].id);

    const remaining = await withUserContext(owner.id, (client) =>
      client.query(
        'SELECT id FROM public.family_series_reactions WHERE id = $1',
        [reaction.rows[0].id],
      ),
    );
    expect(remaining.rows).toHaveLength(1);
  });

  it('enforces one reaction per (series, user, emoji)', async () => {
    const owner = await seedProfile('Owner');
    const family = await seedFamily(owner.id, 'Family L');
    const series = await seedSeries(family.id, owner.id, 'Show L');

    await addReaction(owner.id, series.id, '😂');
    await expect(addReaction(owner.id, series.id, '😂')).rejects.toThrow(
      /duplicate key/i,
    );
  });
});
