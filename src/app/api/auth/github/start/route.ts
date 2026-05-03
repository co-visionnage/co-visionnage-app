import { randomBytes } from 'node:crypto';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { ENV } from '@/shared/config/environment';

const GITHUB_OAUTH_STATE_COOKIE = 'co_visionnage_github_oauth_state';

export async function GET(request: Request) {
  if (!ENV.GITHUB_CLIENT_ID) {
    return NextResponse.json(
      { error: 'GITHUB_CLIENT_ID is missing' },
      { status: 500 },
    );
  }

  const { origin, searchParams } = new URL(request.url);
  const legalAccepted = searchParams.get('legalAccepted') === 'true';

  if (!legalAccepted) {
    return NextResponse.redirect(
      `${origin}/?authError=${encodeURIComponent('Нужно принять правовые документы')}`,
    );
  }

  const state = randomBytes(24).toString('hex');
  const cookieStore = await cookies();

  cookieStore.set(GITHUB_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10,
  });

  const githubAuthorizationUrl = new URL(
    'https://github.com/login/oauth/authorize',
  );
  githubAuthorizationUrl.searchParams.set('client_id', ENV.GITHUB_CLIENT_ID);
  githubAuthorizationUrl.searchParams.set(
    'redirect_uri',
    `${origin}/auth/callback`,
  );
  githubAuthorizationUrl.searchParams.set('scope', 'read:user user:email');
  githubAuthorizationUrl.searchParams.set('state', state);

  return NextResponse.redirect(githubAuthorizationUrl);
}
