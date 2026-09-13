import { createHash } from 'node:crypto';

import { NextResponse } from 'next/server';

import { verifyTwoFactorAndCreateSession } from '@/shared/api/postgres/auth';
import { checkRateLimit, getClientIp } from '@/shared/lib/rateLimit';

const IP_RATE_LIMIT_MAX_ATTEMPTS = 30;
const IP_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const TOKEN_RATE_LIMIT_MAX_ATTEMPTS = 5;
const TOKEN_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

type RequestBody = {
  challengeToken?: string;
  code?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => {})) as RequestBody | null;

  const challengeToken = body?.challengeToken?.trim();
  const code = body?.code?.trim();

  if (!challengeToken || !code) {
    return NextResponse.json(
      { error: 'challengeToken и code обязательны' },
      { status: 400 },
    );
  }

  const isWithinIpLimit = await checkRateLimit(
    `2fa:ip:${getClientIp(request)}`,
    IP_RATE_LIMIT_MAX_ATTEMPTS,
    IP_RATE_LIMIT_WINDOW_SECONDS,
  );

  if (!isWithinIpLimit) {
    return NextResponse.json(
      { error: 'Слишком много попыток. Попробуйте позже.' },
      { status: 429 },
    );
  }

  // Rate-limited on a hash of the token, not the token itself -- the token
  // is a bearer secret, so this bucket is inherently per-login-attempt
  // rather than per-account, which is what actually bounds TOTP brute
  // force during the challenge's short lifetime.
  const tokenBucketKey = createHash('sha256')
    .update(challengeToken)
    .digest('hex');
  const isWithinTokenLimit = await checkRateLimit(
    `2fa:token:${tokenBucketKey}`,
    TOKEN_RATE_LIMIT_MAX_ATTEMPTS,
    TOKEN_RATE_LIMIT_WINDOW_SECONDS,
  );

  if (!isWithinTokenLimit) {
    return NextResponse.json(
      { error: 'Слишком много попыток. Войдите заново.' },
      { status: 429 },
    );
  }

  try {
    await verifyTwoFactorAndCreateSession(challengeToken, code);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Не удалось подтвердить код',
      },
      { status: 400 },
    );
  }
}
