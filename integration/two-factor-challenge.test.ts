import { randomBytes } from 'node:crypto';

import { afterAll, describe, expect, it } from 'vitest';

import { closePools, hashToken, pool, seedProfile } from './database';

// Regression coverage for the fix-2fa-verify-requires-password fix: the 2FA
// login step used to accept a bare, client-supplied userId with no proof of
// a prior password check. It now issues a single-use, short-lived challenge
// token (this table + these three SECURITY DEFINER functions) instead --
// these tests exercise those functions directly, the same way
// loginUserSession / verifyTwoFactorAndCreateSession do.

async function createChallenge(userId: string, expiresAt: Date) {
  const tokenHash = hashToken(randomBytes(32).toString('hex'));
  await pool.query('SELECT public.create_two_factor_challenge($1, $2, $3)', [
    userId,
    tokenHash,
    expiresAt.toISOString(),
  ]);
  return tokenHash;
}

async function getChallenge(tokenHash: string) {
  const result = await pool.query<{ get_two_factor_challenge: string | null }>(
    'SELECT public.get_two_factor_challenge($1)',
    [tokenHash],
  );
  return result.rows[0]?.get_two_factor_challenge ?? undefined;
}

async function deleteChallenge(tokenHash: string) {
  await pool.query('SELECT public.delete_two_factor_challenge($1)', [
    tokenHash,
  ]);
}

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

describe('two-factor challenge', () => {
  afterAll(async () => {
    await closePools();
  });

  it('resolves to the user id that created it', async () => {
    const user = await seedProfile('Challenge Test User');
    const tokenHash = await createChallenge(user.id, minutesFromNow(5));

    await expect(getChallenge(tokenHash)).resolves.toBe(user.id);
  });

  it('returns null for a token that was never issued', async () => {
    const bogusHash = hashToken('never-issued');
    await expect(getChallenge(bogusHash)).resolves.toBeUndefined();
  });

  it('returns null once expired', async () => {
    const user = await seedProfile('Expired Challenge User');
    const tokenHash = await createChallenge(user.id, minutesFromNow(-1));

    await expect(getChallenge(tokenHash)).resolves.toBeUndefined();
  });

  it('is single-use: a correct verification consumes it via delete', async () => {
    const user = await seedProfile('Single Use Challenge User');
    const tokenHash = await createChallenge(user.id, minutesFromNow(5));

    await expect(getChallenge(tokenHash)).resolves.toBe(user.id);

    await deleteChallenge(tokenHash);

    await expect(getChallenge(tokenHash)).resolves.toBeUndefined();
  });

  it('does NOT consume the challenge on a failed code check (get is read-only)', async () => {
    const user = await seedProfile('Retry Challenge User');
    const tokenHash = await createChallenge(user.id, minutesFromNow(5));

    // Simulate the route checking the challenge, then rejecting because the
    // TOTP code was wrong -- it must not call delete in that path, so a
    // second attempt with the correct code still works.
    await expect(getChallenge(tokenHash)).resolves.toBe(user.id);
    await expect(getChallenge(tokenHash)).resolves.toBe(user.id);
  });

  it('creating a new challenge for the same user invalidates the previous one', async () => {
    const user = await seedProfile('Replaced Challenge User');
    const firstToken = await createChallenge(user.id, minutesFromNow(5));
    const secondToken = await createChallenge(user.id, minutesFromNow(5));

    await expect(getChallenge(firstToken)).resolves.toBeUndefined();
    await expect(getChallenge(secondToken)).resolves.toBe(user.id);
  });
});
