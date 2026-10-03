import { NextResponse } from 'next/server';

import { hashToken } from '@/shared/api/postgres/auth';
import { resetPasswordWithToken } from '@/shared/api/postgres/emailFlows';
import { getPasswordProblem } from '@/shared/lib/password';
import { checkRateLimit, getClientIp } from '@/shared/lib/rateLimit';

const IP_RATE_LIMIT_MAX_ATTEMPTS = 10;
const IP_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const TOKEN_RATE_LIMIT_MAX_ATTEMPTS = 5;
const TOKEN_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

type RequestBody = {
  token?: string;
  newPassword?: string;
  confirmPassword?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => {})) as RequestBody | null;
  const token = body?.token?.trim();
  const newPassword = body?.newPassword ?? '';
  const confirmPassword = body?.confirmPassword ?? '';

  if (!token) {
    return NextResponse.json({ error: 'token обязателен' }, { status: 400 });
  }

  const isWithinIpLimit = await checkRateLimit(
    `pwreset-confirm:ip:${getClientIp(request)}`,
    IP_RATE_LIMIT_MAX_ATTEMPTS,
    IP_RATE_LIMIT_WINDOW_SECONDS,
  );

  if (!isWithinIpLimit) {
    return NextResponse.json(
      { error: 'Слишком много попыток. Попробуйте позже.' },
      { status: 429 },
    );
  }

  const isWithinTokenLimit = await checkRateLimit(
    `pwreset-confirm:token:${hashToken(token)}`,
    TOKEN_RATE_LIMIT_MAX_ATTEMPTS,
    TOKEN_RATE_LIMIT_WINDOW_SECONDS,
  );

  if (!isWithinTokenLimit) {
    return NextResponse.json(
      { error: 'Слишком много попыток. Запросите новую ссылку.' },
      { status: 429 },
    );
  }

  const passwordProblem = getPasswordProblem(newPassword);

  if (passwordProblem) {
    return NextResponse.json({ error: passwordProblem }, { status: 400 });
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { error: 'Пароль и подтверждение не совпадают' },
      { status: 400 },
    );
  }

  const isReset = await resetPasswordWithToken(token, newPassword);

  if (!isReset) {
    return NextResponse.json(
      { error: 'Ссылка недействительна или истекла. Запросите новую.' },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}
