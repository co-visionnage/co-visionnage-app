import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

import { cookies } from 'next/headers';

import { query } from './database';

const SESSION_COOKIE_NAME = 'co_visionnage_session';
const SESSION_TTL_DAYS = 30;
const PASSWORD_KEY_LENGTH = 64;

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

function verifyPassword(password: string, passwordHash: string) {
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

export async function loginUserSession(email: string, password: string) {
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

  return createSessionForProfile(user.user_id);
}

export async function getSessionUser(): Promise<SessionUser | undefined> {
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
    cookieStore.delete(SESSION_COOKIE_NAME);
    return;
  }

  return {
    id: session.user_id,
    email: session.email,
    displayName: session.display_name ?? undefined,
  };
}

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
