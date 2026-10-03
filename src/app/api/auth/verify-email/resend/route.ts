import { NextResponse } from 'next/server';

import { getSessionUser } from '@/shared/api/postgres/auth';
import { requestEmailVerification } from '@/shared/api/postgres/emailFlows';
import { checkRateLimit } from '@/shared/lib/rateLimit';

const USER_RATE_LIMIT_MAX_ATTEMPTS = 3;
const USER_RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

export async function POST() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: 'Требуется вход' }, { status: 401 });
  }

  const isWithinUserLimit = await checkRateLimit(
    `verify-email-resend:user:${user.id}`,
    USER_RATE_LIMIT_MAX_ATTEMPTS,
    USER_RATE_LIMIT_WINDOW_SECONDS,
  );

  if (!isWithinUserLimit) {
    return NextResponse.json(
      { error: 'Письмо уже отправлялось недавно. Попробуйте позже.' },
      { status: 429 },
    );
  }

  const result = await requestEmailVerification(user.id);

  if (result === 'already-verified') {
    return NextResponse.json(
      { error: 'Email уже подтверждён' },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true });
}
