import { describe, expect, it } from 'vitest';

import { checkRateLimit } from '@/shared/lib/rateLimit';
import { uniqueSuffix } from './database';

// Regression coverage for the fix-invite-code-strength-and-join-rate-limit
// fix: joinFamily was the only user-facing action in the app with no
// throttling at all, letting an authenticated user guess arbitrarily many
// 6-character invite codes. Exercises the exact bucket key
// (`join-family:user:<id>`) joinFamily now checks before looking up the
// invite code.

describe('joinFamily rate limit', () => {
  it('allows up to the configured number of join attempts per user', async () => {
    const userId = `test-user-${uniqueSuffix()}`;
    const bucket = `join-family:user:${userId}`;

    for (let attempt = 0; attempt < 10; attempt++) {
      expect(await checkRateLimit(bucket, 10, 600)).toBe(true);
    }
  });

  it('rejects further attempts once a user exceeds the limit', async () => {
    const userId = `test-user-${uniqueSuffix()}`;
    const bucket = `join-family:user:${userId}`;

    for (let attempt = 0; attempt < 10; attempt++) {
      await checkRateLimit(bucket, 10, 600);
    }

    expect(await checkRateLimit(bucket, 10, 600)).toBe(false);
  });

  it("does not let one user's guesses count against another user's bucket", async () => {
    const userA = `test-user-${uniqueSuffix()}`;
    const userB = `test-user-${uniqueSuffix()}`;

    for (let attempt = 0; attempt < 10; attempt++) {
      await checkRateLimit(`join-family:user:${userA}`, 10, 600);
    }

    expect(await checkRateLimit(`join-family:user:${userB}`, 10, 600)).toBe(
      true,
    );
  });
});
