import { NextResponse } from 'next/server';

import {
  loginUserSession,
  registerUserSession,
} from '@/shared/api/postgres/auth';
import { AuthMode } from '@/shared/types';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hasLetterPattern = /[A-Za-zА-Яа-яЁё]/;
const hasDigitPattern = /\d/;
const hasSpecialPattern = /[^A-Za-zА-Яа-яЁё0-9]/;

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
    await (mode === 'register'
      ? registerUserSession(email, displayName!, password)
      : loginUserSession(email, password));

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
