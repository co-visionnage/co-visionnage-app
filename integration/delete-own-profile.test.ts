import { afterAll, describe, expect, it } from 'vitest';

import { closePools, seedProfile, withUserContext } from './database';

// Regression coverage for the chore-harden-delete-own-profile fix:
// delete_own_profile is SECURITY DEFINER (it must bypass RLS to let ON
// DELETE CASCADE reach every table the deleted user owns), so it used to
// trust its p_user_id argument outright. deleteAccountAction always passes
// the caller's own id, so this was never reachable through the app, but the
// function itself provided no guarantee -- it now refuses to delete
// anything but the calling session's own row.

async function deleteOwnProfile(sessionUserId: string, targetUserId: string) {
  return withUserContext(sessionUserId, (client) =>
    client.query('SELECT public.delete_own_profile($1)', [targetUserId]),
  );
}

describe('delete_own_profile', () => {
  afterAll(async () => {
    await closePools();
  });

  it("deletes the calling session's own profile", async () => {
    const user = await seedProfile('Self Deleter');

    await deleteOwnProfile(user.id, user.id);

    // The session var itself is just an arbitrary uuid set for this
    // connection, not tied to a real login -- still usable to check via the
    // profiles self-select RLS policy whether the row is really gone.
    const remaining = await withUserContext(user.id, (client) =>
      client.query('SELECT id FROM public.profiles WHERE id = $1', [user.id]),
    );
    expect(remaining.rows).toHaveLength(0);
  });

  it('does not delete a different user even if passed as the argument', async () => {
    const attacker = await seedProfile('Attacker');
    const victim = await seedProfile('Victim');

    // attacker's own session, but the victim's id as the argument
    await deleteOwnProfile(attacker.id, victim.id);

    const victimStillThere = await withUserContext(victim.id, (client) =>
      client.query('SELECT id FROM public.profiles WHERE id = $1', [victim.id]),
    );
    expect(victimStillThere.rows).toHaveLength(1);

    const attackerStillThere = await withUserContext(attacker.id, (client) =>
      client.query('SELECT id FROM public.profiles WHERE id = $1', [
        attacker.id,
      ]),
    );
    expect(attackerStillThere.rows).toHaveLength(1);
  });
});
