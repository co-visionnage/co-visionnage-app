import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

import { cache } from 'react';
import { cookies } from 'next/headers';

import { verifyTotpCode } from '@/shared/lib/totp';
import { query } from './database';

const SESSION_COOKIE_NAME = 'notre_cinema_session';
const SESSION_TTL_DAYS = 30;
const PASSWORD_KEY_LENGTH = 64;
const TWO_FACTOR_CHALLENGE_TTL_MINUTES = 5;

type SessionUserRow = {
  session_id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  expires_at: string;
};

type AuthProfileRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  password_hash: string | null;
  totp_enabled: boolean;
};

type SessionCreationRow = {
  user_id: string;
  email: string;
  display_name: string | null;
};

export type SessionUser = {
  id: string;
  email: string;
  displayName?: string;
};

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function getSessionExpiryDate() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS);
  return expiresAt;
}

function createPasswordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString(
    'hex',
  );
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [salt, storedHash] = passwordHash.split(':');

  if (!salt || !storedHash) {
    return false;
  }

  const passwordBuffer = scryptSync(password, salt, PASSWORD_KEY_LENGTH);
  const storedBuffer = Buffer.from(storedHash, 'hex');

  if (passwordBuffer.length !== storedBuffer.length) {
    return false;
  }

  return timingSafeEqual(passwordBuffer, storedBuffer);
}

async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

async function createSessionForProfile(userId: string) {
  const token = randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = getSessionExpiryDate();

  const result = await query<SessionCreationRow>(
    'SELECT * FROM public.create_session_for_profile($1, $2, $3)',
    [userId, tokenHash, expiresAt.toISOString()],
  );

  const user = result.rows[0];

  if (!user) {
    throw new Error('Failed to create session');
  }

  await setSessionCookie(token, expiresAt);

  return {
    id: user.user_id,
    email: user.email,
    displayName: user.display_name ?? undefined,
  } satisfies SessionUser;
}

export async function createUserSession(email: string, displayName?: string) {
  const token = randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = getSessionExpiryDate();

  const result = await query<SessionCreationRow>(
    'SELECT * FROM public.create_profile_session($1, $2, $3, $4)',
    [email, displayName ?? undefined, tokenHash, expiresAt.toISOString()],
  );

  const user = result.rows[0];

  if (!user) {
    throw new Error('Failed to create session');
  }

  await setSessionCookie(token, expiresAt);

  return {
    id: user.user_id,
    email: user.email,
    displayName: user.display_name ?? undefined,
  } satisfies SessionUser;
}

export async function registerUserSession(
  email: string,
  displayName: string,
  password: string,
) {
  const token = randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = getSessionExpiryDate();

  const result = await query<SessionCreationRow>(
    'SELECT * FROM public.register_profile_account($1, $2, $3, $4, $5)',
    [
      email,
      displayName,
      createPasswordHash(password),
      tokenHash,
      expiresAt.toISOString(),
    ],
  );

  const user = result.rows[0];

  if (!user) {
    throw new Error('Failed to register user');
  }

  await setSessionCookie(token, expiresAt);

  return {
    id: user.user_id,
    email: user.email,
    displayName: user.display_name ?? undefined,
  } satisfies SessionUser;
}

export type LoginResult =
  | { requiresTwoFactor: false; user: SessionUser }
  | { requiresTwoFactor: true; challengeToken: string };

export async function loginUserSession(
  email: string,
  password: string,
): Promise<LoginResult> {
  const result = await query<AuthProfileRow>(
    'SELECT * FROM public.get_profile_auth_by_email($1)',
    [email],
  );

  const user = result.rows[0];

  if (!user || !user.password_hash) {
    throw new Error('Неверный email или пароль');
  }

  if (!verifyPassword(password, user.password_hash)) {
    throw new Error('Неверный email или пароль');
  }

  if (user.totp_enabled) {
    // The client only ever sees this opaque token, never the userId --
    // proving password knowledge is what earns the right to attempt a TOTP
    // code, not just knowing (or guessing) whose account it is.
    const challengeToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + TWO_FACTOR_CHALLENGE_TTL_MINUTES * 60 * 1000,
    );

    await query('SELECT public.create_two_factor_challenge($1, $2, $3)', [
      user.user_id,
      hashToken(challengeToken),
      expiresAt.toISOString(),
    ]);

    return { requiresTwoFactor: true, challengeToken };
  }

  const sessionUser = await createSessionForProfile(user.user_id);
  return { requiresTwoFactor: false, user: sessionUser };
}

export async function verifyTwoFactorAndCreateSession(
  challengeToken: string,
  code: string,
): Promise<SessionUser> {
  const challengeTokenHash = hashToken(challengeToken);

  const challengeResult = await query<{
    get_two_factor_challenge: string | null;
  }>('SELECT public.get_two_factor_challenge($1)', [challengeTokenHash]);

  const userId = challengeResult.rows[0]?.get_two_factor_challenge;

  if (!userId) {
    throw new Error('Сессия входа истекла. Войдите заново.');
  }

  const result = await query<{ get_totp_secret_for_login: string | null }>(
    'SELECT public.get_totp_secret_for_login($1)',
    [userId],
  );

  const secret = result.rows[0]?.get_totp_secret_for_login;

  if (!secret || !(await verifyTotpCode(code, secret))) {
    throw new Error('Неверный код двухфакторной аутентификации');
  }

  // Consumed only now, on success -- a wrong code can be retried (bounded
  // by rate limiting in the route handler) without forcing the user back
  // through the password step.
  await query('SELECT public.delete_two_factor_challenge($1)', [
    challengeTokenHash,
  ]);

  return createSessionForProfile(userId);
}

// Wrapped in React's per-request cache: a single render (e.g. a page
// component calling getCurrentUser() directly, whose data-fetching helper
// also calls requireCurrentUser() internally) would otherwise hit
// get_session_user($1) once per call instead of once per request.
export const getSessionUser = cache(
  async (): Promise<SessionUser | undefined> => {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return;
    }

    const result = await query<SessionUserRow>(
      'SELECT * FROM public.get_session_user($1::text)',
      [hashToken(token)],
    );

    const session = result.rows[0];

    if (!session) {
      // getSessionUser is also called from plain page renders (Server
      // Components), where Next.js forbids mutating cookies at all -- only
      // Server Actions and Route Handlers may. There the delete is a no-op
      // best-effort cleanup of the now-invalid cookie; the caller still
      // correctly sees "logged out" either way since no session was found.
      try {
        cookieStore.delete(SESSION_COOKIE_NAME);
      } catch {
        // ignore -- see comment above
      }
      return;
    }

    return {
      id: session.user_id,
      email: session.email,
      displayName: session.display_name ?? undefined,
    };
  },
);

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user) {
    throw new Error('UNAUTHORIZED');
  }

  return user;
}

export async function clearUserSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await query('SELECT public.delete_session_by_token($1)', [
      hashToken(token),
    ]);
  }

  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),
  });
}
