import { NextResponse } from 'next/server';

import { requestPasswordReset } from '@/shared/api/postgres/emailFlows';
import { checkRateLimit, getClientIp } from '@/shared/lib/rateLimit';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const IP_RATE_LIMIT_MAX_ATTEMPTS = 10;
const IP_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const EMAIL_RATE_LIMIT_MAX_ATTEMPTS = 3;
const EMAIL_RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => {})) as {
    email?: string;
  } | null;
  const email = body?.email?.trim().toLowerCase();

  if (!email || !emailPattern.test(email)) {
    return NextResponse.json(
      { error: 'Введите корректный email-адрес' },
      { status: 400 },
    );
  }

  const isWithinIpLimit = await checkRateLimit(
    `pwreset-request:ip:${getClientIp(request)}`,
    IP_RATE_LIMIT_MAX_ATTEMPTS,
    IP_RATE_LIMIT_WINDOW_SECONDS,
  );

  if (!isWithinIpLimit) {
    return NextResponse.json(
      { error: 'Слишком много попыток. Попробуйте позже.' },
      { status: 429 },
    );
  }

  const isWithinEmailLimit = await checkRateLimit(
    `pwreset-request:email:${email}`,
    EMAIL_RATE_LIMIT_MAX_ATTEMPTS,
    EMAIL_RATE_LIMIT_WINDOW_SECONDS,
  );

  if (!isWithinEmailLimit) {
    return NextResponse.json(
      { error: 'Слишком много запросов для этого email. Попробуйте позже.' },
      { status: 429 },
    );
  }

  await requestPasswordReset(email);

  // Ответ одинаков для существующего и несуществующего аккаунта: форма
  // сброса не должна превращаться в способ узнать, кто зарегистрирован.
  return NextResponse.json({ success: true });
}
