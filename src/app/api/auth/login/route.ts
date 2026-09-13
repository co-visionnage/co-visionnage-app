import { NextResponse } from 'next/server';

import {
  loginUserSession,
  registerUserSession,
} from '@/shared/api/postgres/auth';
import { checkRateLimit, getClientIp } from '@/shared/lib/rateLimit';
import { AuthMode } from '@/shared/types';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hasLetterPattern = /[A-Za-zА-Яа-яЁё]/;
const hasDigitPattern = /\d/;
const hasSpecialPattern = /[^A-Za-zА-Яа-яЁё0-9]/;

const IP_RATE_LIMIT_MAX_ATTEMPTS = 30;
const IP_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const EMAIL_RATE_LIMIT_MAX_ATTEMPTS = 5;
const EMAIL_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

type RequestBody = {
  mode?: AuthMode;
  provider?: 'email';
  email?: string;
  displayName?: string;
  password?: string;
  confirmPassword?: string;
  legalAccepted?: boolean;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => {})) as RequestBody | null;

  const mode = body?.mode ?? 'login';
  const email = body?.email?.trim().toLowerCase();
  const displayName = body?.displayName?.trim();
  const password = body?.password ?? '';
  const confirmPassword = body?.confirmPassword ?? '';
  const legalAccepted = body?.legalAccepted === true;

  const clientIp = getClientIp(request);
  const isWithinIpLimit = await checkRateLimit(
    `auth:ip:${clientIp}`,
    IP_RATE_LIMIT_MAX_ATTEMPTS,
    IP_RATE_LIMIT_WINDOW_SECONDS,
  );

  if (!isWithinIpLimit) {
    return NextResponse.json(
      { error: 'Слишком много попыток. Попробуйте позже.' },
      { status: 429 },
    );
  }

  if (!legalAccepted) {
    return NextResponse.json(
      {
        error: 'Нужно принять пользовательское соглашение и правовые документы',
      },
      { status: 400 },
    );
  }

  if (!email || !emailPattern.test(email)) {
    return NextResponse.json(
      { error: 'Введите корректный email-адрес' },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Пароль должен быть не короче 8 символов' },
      { status: 400 },
    );
  }

  if (
    !hasLetterPattern.test(password) ||
    !hasDigitPattern.test(password) ||
    !hasSpecialPattern.test(password)
  ) {
    return NextResponse.json(
      {
        error: 'Пароль должен содержать буквы, цифры и хотя бы один спецсимвол',
      },
      { status: 400 },
    );
  }

  if (mode === 'login') {
    const isWithinEmailLimit = await checkRateLimit(
      `auth:login-email:${email}`,
      EMAIL_RATE_LIMIT_MAX_ATTEMPTS,
      EMAIL_RATE_LIMIT_WINDOW_SECONDS,
    );

    if (!isWithinEmailLimit) {
      return NextResponse.json(
        {
          error:
            'Слишком много попыток входа для этого email. Попробуйте позже.',
        },
        { status: 429 },
      );
    }
  }

  if (mode === 'register') {
    if (!displayName || displayName.length < 2) {
      return NextResponse.json(
        { error: 'Укажите имя не короче 2 символов' },
        { status: 400 },
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Пароль и подтверждение не совпадают' },
        { status: 400 },
      );
    }
  }

  try {
    if (mode === 'register') {
      await registerUserSession(email, displayName!, password);
      return NextResponse.json({ success: true });
    }

    const result = await loginUserSession(email, password);

    if (result.requiresTwoFactor) {
      return NextResponse.json({
        success: true,
        requiresTwoFactor: true,
        challengeToken: result.challengeToken,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'ACCOUNT_ALREADY_EXISTS') {
      return NextResponse.json(
        {
          error:
            'Пользователь с таким email уже существует. Войдите в аккаунт.',
        },
        { status: 400 },
      );
    }

    if (
      typeof error === 'object' &&
      error &&
      'code' in error &&
      error.code === '23505'
    ) {
      return NextResponse.json(
        { error: 'Пользователь с таким email уже существует' },
        { status: 400 },
      );
    }

    if (
      typeof error === 'object' &&
      error &&
      'code' in error &&
      error.code === '28P01'
    ) {
      return NextResponse.json(
        {
          error:
            'Приложение не может подключиться к PostgreSQL: пароль или настройки пользователя app_user не совпадают с текущей БД.',
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Не удалось создать сессию',
      },
      { status: 500 },
    );
  }
}
