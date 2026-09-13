import { afterAll, describe, expect, it } from 'vitest';

import {
  addFamilyMember,
  adminPool,
  closePools,
  seedFamily,
  seedProfile,
  seedSeries,
  withUserContext,
} from './database';

// Regression coverage for the fix-voting-cross-tenant-checks fix: the RLS
// policies on family_watch_poll_votes only checked that poll_id belonged to
// a family the voter is a member of, never that option_id actually belonged
// to that same poll_id -- letting a member of one family inject a vote that
// counted toward a completely different family's poll. Also covers
// createWatchPollAction's series_id scoping fix.

async function seedPoll(familyId: string, createdBy: string, title: string) {
  const result = await adminPool.query<{ id: string }>(
    `
      INSERT INTO public.family_watch_polls (family_id, created_by, title)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [familyId, createdBy, title],
  );
  return { id: result.rows[0].id };
}

async function seedPollOption(pollId: string, seriesId: string) {
  const result = await adminPool.query<{ id: string }>(
    `
      INSERT INTO public.family_watch_poll_options (poll_id, series_id)
      VALUES ($1, $2)
      RETURNING id
    `,
    [pollId, seriesId],
  );
  return { id: result.rows[0].id };
}

async function vote(userId: string, pollId: string, optionId: string) {
  return withUserContext(userId, (client) =>
    client.query(
      `
        INSERT INTO public.family_watch_poll_votes (poll_id, option_id, user_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (poll_id, user_id) DO UPDATE
        SET option_id = EXCLUDED.option_id
      `,
      [pollId, optionId, userId],
    ),
  );
}

afterAll(async () => {
  await closePools();
});

describe('watch poll tenant isolation', () => {
  it('rejects a vote whose option belongs to a different poll than the one supplied', async () => {
    const attacker = await seedProfile('Attacker');
    const victim = await seedProfile('Victim');
    const familyA = await seedFamily(attacker.id, 'Family A');
    const familyB = await seedFamily(victim.id, 'Family B');
    const seriesA = await seedSeries(familyA.id, attacker.id, 'A Show');
    const seriesB = await seedSeries(familyB.id, victim.id, 'B Show');
    const pollA = await seedPoll(familyA.id, attacker.id, 'Poll A');
    const pollB = await seedPoll(familyB.id, victim.id, 'Poll B');
    await seedPollOption(pollA.id, seriesA.id);
    const optionB = await seedPollOption(pollB.id, seriesB.id);

    // attacker's own poll_id (passes the family-membership check) paired
    // with an option belonging to the victim's poll
    await expect(vote(attacker.id, pollA.id, optionB.id)).rejects.toThrow(
      /row-level security/i,
    );
  });

  it('allows a normal same-poll vote', async () => {
    const owner = await seedProfile('Owner');
    const family = await seedFamily(owner.id, 'Family C');
    const series = await seedSeries(family.id, owner.id, 'C Show');
    const poll = await seedPoll(family.id, owner.id, 'Poll C');
    const option = await seedPollOption(poll.id, series.id);

    await expect(vote(owner.id, poll.id, option.id)).resolves.toBeDefined();
  });

  it('rejects a vote for a poll in a family the voter does not belong to at all', async () => {
    const outsider = await seedProfile('Outsider');
    const insider = await seedProfile('Insider');
    const family = await seedFamily(insider.id, 'Family D');
    const series = await seedSeries(family.id, insider.id, 'D Show');
    const poll = await seedPoll(family.id, insider.id, 'Poll D');
    const option = await seedPollOption(poll.id, series.id);

    await expect(vote(outsider.id, poll.id, option.id)).rejects.toThrow(
      /row-level security/i,
    );
  });

  it("createWatchPollAction's series scoping only creates options for series in the poll's own family", async () => {
    const owner = await seedProfile('Poll Creator');
    const familyOwn = await seedFamily(owner.id, 'Own Family');
    const otherOwner = await seedProfile('Other Family Owner');
    const familyOther = await seedFamily(otherOwner.id, 'Other Family');
    const ownSeries = await seedSeries(familyOwn.id, owner.id, 'Own Show');
    const foreignSeries = await seedSeries(
      familyOther.id,
      otherOwner.id,
      'Foreign Show',
    );

    const pollId = await withUserContext(owner.id, async (client) => {
      const pollResult = await client.query<{ id: string }>(
        `
          INSERT INTO public.family_watch_polls (family_id, created_by, title)
          VALUES ($1, $2, $3)
          RETURNING id
        `,
        [familyOwn.id, owner.id, 'Mixed poll'],
      );
      const newPollId = pollResult.rows[0].id;

      // Exact query shape used by createWatchPollAction.
      await client.query(
        `
          INSERT INTO public.family_watch_poll_options (poll_id, series_id)
          SELECT $1, series.id
          FROM public.family_series series
          WHERE series.id = ANY($2::uuid[])
            AND series.family_id = $3
          ON CONFLICT DO NOTHING
        `,
        [newPollId, [ownSeries.id, foreignSeries.id], familyOwn.id],
      );

      return newPollId;
    });

    // Read back as the poll's own owner (a legitimate family member), not a
    // superuser bypass -- family_watch_poll_options' own SELECT policy
    // already allows this, and app_user has no BYPASSRLS to make
    // `SET row_security = off` do anything anyway.
    const options = await withUserContext(owner.id, (client) =>
      client.query<{ series_id: string }>(
        'SELECT series_id FROM public.family_watch_poll_options WHERE poll_id = $1',
        [pollId],
      ),
    );

    expect(options.rows).toEqual([{ series_id: ownSeries.id }]);
  });
});

// Regression coverage for the fix-closed-poll-voting-and-close-permissions
// fix: voting/closing had no database-level check that a poll was still
// open, and any family member (not just the creator/owner) could close or
// rename someone else's poll.

async function closePoll(userId: string, pollId: string) {
  return withUserContext(userId, (client) =>
    client.query(
      `
        UPDATE public.family_watch_polls
        SET is_open = false, closed_at = NOW()
        WHERE id = $1
      `,
      [pollId],
    ),
  );
}

describe('watch poll closing and closed-poll voting', () => {
  it('rejects a new vote on a poll that has already been closed', async () => {
    const owner = await seedProfile('Owner');
    const member = await seedProfile('Member');
    const family = await seedFamily(owner.id, 'Family E');
    await addFamilyMember(family.id, member.id);
    const series = await seedSeries(family.id, owner.id, 'E Show');
    const poll = await seedPoll(family.id, owner.id, 'Poll E');
    const option = await seedPollOption(poll.id, series.id);

    await closePoll(owner.id, poll.id);

    await expect(vote(member.id, poll.id, option.id)).rejects.toThrow(
      /row-level security/i,
    );
  });

  it('rejects rewriting an existing vote after the poll closes', async () => {
    const owner = await seedProfile('Owner');
    const family = await seedFamily(owner.id, 'Family F');
    const series = await seedSeries(family.id, owner.id, 'F Show');
    const poll = await seedPoll(family.id, owner.id, 'Poll F');
    const optionOne = await seedPollOption(poll.id, series.id);
    const seriesTwo = await seedSeries(family.id, owner.id, 'F Show 2');
    const optionTwo = await seedPollOption(poll.id, seriesTwo.id);

    await vote(owner.id, poll.id, optionOne.id);
    await closePoll(owner.id, poll.id);

    await expect(vote(owner.id, poll.id, optionTwo.id)).rejects.toThrow(
      /row-level security/i,
    );
  });

  it('lets the poll creator close their own poll', async () => {
    const owner = await seedProfile('Owner');
    const family = await seedFamily(owner.id, 'Family G');
    const poll = await seedPoll(family.id, owner.id, 'Poll G');

    await closePoll(owner.id, poll.id);

    const result = await withUserContext(owner.id, (client) =>
      client.query<{ is_open: boolean }>(
        'SELECT is_open FROM public.family_watch_polls WHERE id = $1',
        [poll.id],
      ),
    );
    expect(result.rows[0].is_open).toBe(false);
  });

  it('lets the family owner close a poll created by another member', async () => {
    const owner = await seedProfile('Owner');
    const member = await seedProfile('Member');
    const family = await seedFamily(owner.id, 'Family H');
    await addFamilyMember(family.id, member.id);
    const poll = await seedPoll(family.id, member.id, 'Poll H');

    await closePoll(owner.id, poll.id);

    const result = await withUserContext(owner.id, (client) =>
      client.query<{ is_open: boolean }>(
        'SELECT is_open FROM public.family_watch_polls WHERE id = $1',
        [poll.id],
      ),
    );
    expect(result.rows[0].is_open).toBe(false);
  });

  it("does not let a plain member close another member's poll", async () => {
    const owner = await seedProfile('Owner');
    const memberA = await seedProfile('Member A');
    const memberB = await seedProfile('Member B');
    const family = await seedFamily(owner.id, 'Family I');
    await addFamilyMember(family.id, memberA.id);
    await addFamilyMember(family.id, memberB.id);
    const poll = await seedPoll(family.id, memberA.id, 'Poll I');

    // An UPDATE that touches zero rows under RLS is a silent no-op, not an
    // error, so assert the poll is still open afterward.
    await closePoll(memberB.id, poll.id);

    const result = await withUserContext(owner.id, (client) =>
      client.query<{ is_open: boolean }>(
        'SELECT is_open FROM public.family_watch_polls WHERE id = $1',
        [poll.id],
      ),
    );
    expect(result.rows[0].is_open).toBe(true);
  });
});
