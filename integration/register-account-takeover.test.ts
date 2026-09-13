import { afterAll, describe, expect, it } from 'vitest';

import {
  closePools,
  hashToken,
  pool,
  uniqueSuffix,
  withUserContext,
} from './database';

// Regression coverage for the fix-oauth-account-takeover fix:
// register_profile_account used to UPSERT onto an existing profiles row and
// only refuse when the existing password_hash was non-NULL and different
// from the submitted one. A GitHub-OAuth profile always has
// password_hash = NULL, so "registering" with a victim's OAuth email
// silently attached the attacker's password to the victim's account and
// logged the attacker into the victim's session -- with no email
// verification anywhere to have caught it. register_profile_account is
// SECURITY DEFINER, callable directly by app_user with no RLS context
// needed, same as the two-factor-challenge functions.

function email(suffix: string) {
  return `${suffix}@example.com`;
}

async function createOAuthProfile(mail: string, displayName: string) {
  const result = await pool.query<{ user_id: string }>(
    'SELECT * FROM public.create_profile_session($1, $2, $3, $4)',
    [mail, displayName, hashToken(`session-${uniqueSuffix()}`), futureDate()],
  );
  return result.rows[0].user_id;
}

async function register(
  mail: string,
  displayName: string,
  passwordHash: string,
) {
  return pool.query<{ user_id: string }>(
    'SELECT * FROM public.register_profile_account($1, $2, $3, $4, $5)',
    [
      mail,
      displayName,
      passwordHash,
      hashToken(`session-${uniqueSuffix()}`),
      futureDate(),
    ],
  );
}

function futureDate() {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString();
}

describe('register_profile_account cannot take over an existing account', () => {
  afterAll(async () => {
    await closePools();
  });

  it('rejects registering onto an email that already has an OAuth (password-less) profile', async () => {
    const mail = email(`oauth-victim-${uniqueSuffix()}`);
    const victimId = await createOAuthProfile(mail, 'Victim');

    await expect(
      register(mail, 'Attacker', 'attacker-password-hash'),
    ).rejects.toThrow(/ACCOUNT_ALREADY_EXISTS/);

    // The victim's row must be untouched: still no password hash, and no
    // session was created for the attacker under the victim's user id.
    // Read as the victim themselves -- profiles/app_sessions are
    // RLS-restricted to the owning user, so app_user with no session
    // context set sees nothing at all.
    const profile = await withUserContext(victimId, (client) =>
      client.query<{ password_hash: string | null }>(
        'SELECT password_hash FROM public.profiles WHERE id = $1',
        [victimId],
      ),
    );
    expect(profile.rows[0].password_hash).toBeNull();

    // Exactly the one session create_profile_session made for the victim
    // above -- the attacker's register() call must not have added another.
    const sessions = await withUserContext(victimId, (client) =>
      client.query('SELECT id FROM public.app_sessions WHERE user_id = $1', [
        victimId,
      ]),
    );
    expect(sessions.rows).toHaveLength(1);
  });

  it('rejects registering onto an email that already has a password-based profile', async () => {
    const mail = email(`pw-victim-${uniqueSuffix()}`);
    await register(mail, 'Victim', 'original-hash');

    await expect(register(mail, 'Attacker', 'attacker-hash')).rejects.toThrow(
      /ACCOUNT_ALREADY_EXISTS/,
    );
  });

  it('still allows registering a brand-new email', async () => {
    const mail = email(`fresh-${uniqueSuffix()}`);

    const result = await register(mail, 'New User', 'some-hash');

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ email: mail });
  });
});
