import { NextResponse } from 'next/server';

import { verifyEmailWithToken } from '@/shared/api/postgres/emailFlows';
import { checkRateLimit, getClientIp } from '@/shared/lib/rateLimit';

const IP_RATE_LIMIT_MAX_ATTEMPTS = 30;
const IP_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => {})) as {
    token?: string;
  } | null;
  const token = body?.token?.trim();

  if (!token) {
    return NextResponse.json({ error: 'token обязателен' }, { status: 400 });
  }

  const isWithinIpLimit = await checkRateLimit(
    `verify-email:ip:${getClientIp(request)}`,
    IP_RATE_LIMIT_MAX_ATTEMPTS,
    IP_RATE_LIMIT_WINDOW_SECONDS,
  );

  if (!isWithinIpLimit) {
    return NextResponse.json(
      { error: 'Слишком много попыток. Попробуйте позже.' },
      { status: 429 },
    );
  }

  const isVerified = await verifyEmailWithToken(token);

  if (!isVerified) {
    return NextResponse.json(
      { error: 'Ссылка недействительна или истекла. Запросите новую.' },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}
