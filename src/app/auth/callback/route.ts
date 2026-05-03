import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { createUserSession } from '@/shared/api/postgres/auth';
import { ENV } from '@/shared/config/environment';

const GITHUB_OAUTH_STATE_COOKIE = 'co_visionnage_github_oauth_state';

type GitHubAccessTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GitHubUserResponse = {
  login: string;
  name: string | null;
  email: string | null;
};

type GitHubEmailResponse = {
  email: string;
  primary: boolean;
  verified: boolean;
};

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const next = searchParams.get('next') ?? '/';

  const cookieStore = await cookies();
  const storedState = cookieStore.get(GITHUB_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(GITHUB_OAUTH_STATE_COOKIE);

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(
      `${origin}${next}?authError=${encodeURIComponent('GitHub OAuth state is invalid')}`,
    );
  }

  if (!ENV.GITHUB_CLIENT_ID || !ENV.GITHUB_CLIENT_SECRET) {
    return NextResponse.redirect(
      `${origin}${next}?authError=${encodeURIComponent('GitHub OAuth is not configured')}`,
    );
  }

  try {
    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: ENV.GITHUB_CLIENT_ID,
          client_secret: ENV.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: `${origin}/auth/callback`,
        }),
        cache: 'no-store',
      },
    );

    const tokenPayload =
      (await tokenResponse.json()) as GitHubAccessTokenResponse;

    if (!tokenResponse.ok || !tokenPayload.access_token) {
      throw new Error(
        tokenPayload.error_description ||
          tokenPayload.error ||
          'GitHub token exchange failed',
      );
    }

    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${tokenPayload.access_token}`,
        'User-Agent': 'co-visionnage',
      },
      cache: 'no-store',
    });

    const githubUser = (await userResponse.json()) as GitHubUserResponse;

    if (!userResponse.ok || !githubUser.login) {
      throw new Error('Failed to load GitHub profile');
    }

    let resolvedEmail = githubUser.email;

    if (!resolvedEmail) {
      const emailResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${tokenPayload.access_token}`,
          'User-Agent': 'co-visionnage',
        },
        cache: 'no-store',
      });

      if (emailResponse.ok) {
        const emailPayload =
          (await emailResponse.json()) as GitHubEmailResponse[];
        const primaryEmail =
          emailPayload.find((item) => item.primary && item.verified) ??
          emailPayload.find((item) => item.verified) ??
          emailPayload[0];

        resolvedEmail = primaryEmail?.email ?? undefined;
      }
    }

    if (!resolvedEmail) {
      resolvedEmail = `${githubUser.login.toLowerCase()}@users.noreply.github.com`;
    }

    await createUserSession(resolvedEmail, githubUser.name || githubUser.login);

    return NextResponse.redirect(`${origin}${next}`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'GitHub authentication failed';
    return NextResponse.redirect(
      `${origin}${next}?authError=${encodeURIComponent(message)}`,
    );
  }
}
