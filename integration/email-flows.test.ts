import { afterAll, describe, expect, it } from 'vitest';

import { POST as confirmPasswordReset } from '@/app/api/auth/password-reset/confirm/route';
import { POST as requestPasswordResetRoute } from '@/app/api/auth/password-reset/request/route';
import { POST as verifyEmailRoute } from '@/app/api/auth/verify-email/route';
import { verifyPassword } from '@/shared/api/postgres/auth';
import {
  isEmailVerified,
  requestEmailVerification,
  requestPasswordReset,
  resetPasswordWithToken,
  verifyEmailWithToken,
} from '@/shared/api/postgres/emailFlows';
import {
  closePools,
  hashToken,
  pool,
  uniqueSuffix,
  withUserContext,
} from './database';

// Подтверждение email и сброс пароля поверх SQL-функций миграции 0031.
// Письма здесь не проверяются (их шлёт notrecinema-worker): проверяется
// всё, что делает само приложение -- потребление токена, события в outbox
// и ответы роутов. Токен создаёт воркер, поэтому тест делает то же, что он:
// кладёт хэш токена через create_email_token.

const OLD_PASSWORD_HASH = 'old-salt:old-key';

afterAll(async () => {
  await closePools();
});

async function register() {
  const email = `${uniqueSuffix()}@example.com`;
  const result = await pool.query<{ user_id: string }>(
    'SELECT * FROM public.register_profile_account($1, $2, $3, $4, $5)',
    [
      email,
      'Anna',
      OLD_PASSWORD_HASH,
      hashToken(`session-${uniqueSuffix()}`),
      new Date(Date.now() + 3_600_000).toISOString(),
    ],
  );
  return { id: result.rows[0].user_id, email };
}

async function mintToken(
  userId: string,
  kind: 'verify_email' | 'reset_password',
  ttlMs = 3_600_000,
) {
  const token = `token-${uniqueSuffix()}`;
  await pool.query('SELECT public.create_email_token($1, $2, $3, $4)', [
    userId,
    kind,
    hashToken(token),
    new Date(Date.now() + ttlMs).toISOString(),
  ]);
  return token;
}

async function countEvents(userId: string, eventType: string) {
  const result = await pool.query<{ count: string }>(
    'SELECT count(*) FROM public.outbox_events WHERE aggregate_id = $1 AND event_type = $2',
    [userId, eventType],
  );
  return Number(result.rows[0].count);
}

async function passwordHashOf(userId: string) {
  return withUserContext(userId, async (client) => {
    const result = await client.query<{ password_hash: string }>(
      'SELECT password_hash FROM public.profiles WHERE id = $1',
      [userId],
    );
    return result.rows[0].password_hash;
  });
}

async function sessionCount(userId: string) {
  return withUserContext(userId, async (client) => {
    const result = await client.query<{ count: string }>(
      'SELECT count(*) FROM public.app_sessions WHERE user_id = $1',
      [userId],
    );
    return Number(result.rows[0].count);
  });
}

// Роуты ограничивают запросы по IP: у каждого вызова свой адрес, иначе
// счётчик окна в БД копился бы между прогонами и тест стал бы нестабильным.
function jsonRequest(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-real-ip': `test-${uniqueSuffix()}`,
    },
    body: JSON.stringify(body),
  });
}

describe('verifyEmailWithToken', () => {
  it('a fresh registration is unverified and queues the verification email', async () => {
    const user = await register();

    expect(await isEmailVerified(user.id)).toBe(false);
    expect(await countEvents(user.id, 'email.verification_requested')).toBe(1);
  });

  it('verifies the account once and refuses the same token again', async () => {
    const user = await register();
    const token = await mintToken(user.id, 'verify_email');

    expect(await verifyEmailWithToken(token)).toBe(true);
    expect(await isEmailVerified(user.id)).toBe(true);
    expect(await verifyEmailWithToken(token)).toBe(false);
  });

  it('refuses unknown, expired and wrong-kind tokens', async () => {
    const user = await register();

    expect(await verifyEmailWithToken('no-such-token')).toBe(false);

    const expired = await mintToken(user.id, 'verify_email', -60_000);
    expect(await verifyEmailWithToken(expired)).toBe(false);

    const resetKind = await mintToken(user.id, 'reset_password');
    expect(await verifyEmailWithToken(resetKind)).toBe(false);

    expect(await isEmailVerified(user.id)).toBe(false);
  });

  it('a newer token invalidates the previous one', async () => {
    const user = await register();
    const first = await mintToken(user.id, 'verify_email');
    const second = await mintToken(user.id, 'verify_email');

    expect(await verifyEmailWithToken(first)).toBe(false);
    expect(await verifyEmailWithToken(second)).toBe(true);
  });
});

describe('requestEmailVerification', () => {
  it('queues another letter for an unverified user and refuses a verified one', async () => {
    const user = await register();

    expect(await requestEmailVerification(user.id)).toBe('queued');
    expect(await countEvents(user.id, 'email.verification_requested')).toBe(2);

    const token = await mintToken(user.id, 'verify_email');
    await verifyEmailWithToken(token);

    expect(await requestEmailVerification(user.id)).toBe('already-verified');
    expect(await countEvents(user.id, 'email.verification_requested')).toBe(2);
  });
});

describe('password reset', () => {
  it('queues a letter for a known email and silently ignores an unknown one', async () => {
    const user = await register();

    await requestPasswordReset(user.email);
    expect(await countEvents(user.id, 'email.password_reset_requested')).toBe(
      1,
    );

    await expect(
      requestPasswordReset(`nobody-${uniqueSuffix()}@example.com`),
    ).resolves.toBeUndefined();
  });

  it('sets the new password, closes every session and queues a security notice', async () => {
    const user = await register();
    expect(await sessionCount(user.id)).toBeGreaterThan(0);

    const token = await mintToken(user.id, 'reset_password');
    expect(await resetPasswordWithToken(token, 'brand-new-pass-9!')).toBe(true);

    const hash = await passwordHashOf(user.id);
    expect(hash).not.toBe(OLD_PASSWORD_HASH);
    expect(verifyPassword('brand-new-pass-9!', hash)).toBe(true);
    expect(verifyPassword('not-the-password-1!', hash)).toBe(false);

    expect(await sessionCount(user.id)).toBe(0);
    expect(await countEvents(user.id, 'security.password_changed')).toBe(1);
    // Получатель письма владеет адресом: сброс заодно его подтверждает.
    expect(await isEmailVerified(user.id)).toBe(true);
  });

  it('refuses reuse, unknown, expired and wrong-kind tokens', async () => {
    const user = await register();

    const used = await mintToken(user.id, 'reset_password');
    expect(await resetPasswordWithToken(used, 'brand-new-pass-9!')).toBe(true);
    expect(await resetPasswordWithToken(used, 'another-pass-7!')).toBe(false);

    expect(await resetPasswordWithToken('nope', 'brand-new-pass-9!')).toBe(
      false,
    );

    const expired = await mintToken(user.id, 'reset_password', -60_000);
    expect(await resetPasswordWithToken(expired, 'brand-new-pass-9!')).toBe(
      false,
    );

    const verifyKind = await mintToken(user.id, 'verify_email');
    expect(await resetPasswordWithToken(verifyKind, 'brand-new-pass-9!')).toBe(
      false,
    );
  });
});

describe('routes', () => {
  it('POST /api/auth/verify-email validates input and consumes the token', async () => {
    const user = await register();
    const token = await mintToken(user.id, 'verify_email');

    const missing = await verifyEmailRoute(
      jsonRequest('/api/auth/verify-email', {}),
    );
    expect(missing.status).toBe(400);

    const invalid = await verifyEmailRoute(
      jsonRequest('/api/auth/verify-email', { token: 'nope' }),
    );
    expect(invalid.status).toBe(400);

    const ok = await verifyEmailRoute(
      jsonRequest('/api/auth/verify-email', { token }),
    );
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ success: true });

    const reused = await verifyEmailRoute(
      jsonRequest('/api/auth/verify-email', { token }),
    );
    expect(reused.status).toBe(400);
  });

  it('POST /api/auth/password-reset/request answers 200 for known and unknown emails alike', async () => {
    const user = await register();

    const known = await requestPasswordResetRoute(
      jsonRequest('/api/auth/password-reset/request', { email: user.email }),
    );
    const unknown = await requestPasswordResetRoute(
      jsonRequest('/api/auth/password-reset/request', {
        email: `nobody-${uniqueSuffix()}@example.com`,
      }),
    );

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(await known.json()).toEqual(await unknown.json());
    expect(await countEvents(user.id, 'email.password_reset_requested')).toBe(
      1,
    );

    const malformed = await requestPasswordResetRoute(
      jsonRequest('/api/auth/password-reset/request', {
        email: 'not-an-email',
      }),
    );
    expect(malformed.status).toBe(400);
  });

  it('POST /api/auth/password-reset/request limits repeated requests for one email', async () => {
    const user = await register();

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await requestPasswordResetRoute(
        jsonRequest('/api/auth/password-reset/request', { email: user.email }),
      );
      statuses.push(response.status);
    }

    expect(statuses).toEqual([200, 200, 200, 429]);
  });

  it('POST /api/auth/password-reset/confirm checks the password before touching the token', async () => {
    const user = await register();
    const token = await mintToken(user.id, 'reset_password');

    const weak = await confirmPasswordReset(
      jsonRequest('/api/auth/password-reset/confirm', {
        token,
        newPassword: 'short',
        confirmPassword: 'short',
      }),
    );
    expect(weak.status).toBe(400);

    const mismatch = await confirmPasswordReset(
      jsonRequest('/api/auth/password-reset/confirm', {
        token,
        newPassword: 'brand-new-pass-9!',
        confirmPassword: 'brand-new-pass-8!',
      }),
    );
    expect(mismatch.status).toBe(400);

    // Отклонённые попытки не сожгли токен.
    const ok = await confirmPasswordReset(
      jsonRequest('/api/auth/password-reset/confirm', {
        token,
        newPassword: 'brand-new-pass-9!',
        confirmPassword: 'brand-new-pass-9!',
      }),
    );
    expect(ok.status).toBe(200);

    const reused = await confirmPasswordReset(
      jsonRequest('/api/auth/password-reset/confirm', {
        token,
        newPassword: 'brand-new-pass-9!',
        confirmPassword: 'brand-new-pass-9!',
      }),
    );
    expect(reused.status).toBe(400);

    const missing = await confirmPasswordReset(
      jsonRequest('/api/auth/password-reset/confirm', {
        newPassword: 'brand-new-pass-9!',
        confirmPassword: 'brand-new-pass-9!',
      }),
    );
    expect(missing.status).toBe(400);
  });
});
