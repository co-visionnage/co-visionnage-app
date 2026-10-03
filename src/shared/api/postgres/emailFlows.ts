import { cache } from 'react';

import { createPasswordHash, hashToken } from './auth';
import { query, withUserContext } from './database';

// Подтверждение email и сброс пароля. Письма не отправляются отсюда:
// SQL-функции (миграция 0031 схемы) и outbox_events кладут событие, а
// notrecinema-worker создаёт токен и шлёт письмо через Resend. Здесь только
// потребление токена из ссылки и постановка события в очередь.

export type ResendVerificationResult = 'queued' | 'already-verified';

export async function verifyEmailWithToken(token: string): Promise<boolean> {
  const result = await query<{ verify_email_with_token: boolean }>(
    'SELECT public.verify_email_with_token($1)',
    [hashToken(token)],
  );

  return result.rows[0]?.verify_email_with_token === true;
}

/**
 * Ставит письмо со ссылкой на сброс в очередь. Ничего не сообщает о том,
 * есть ли такой аккаунт: для неизвестного email SQL-функция молча ничего не
 * делает, а вызывающий роут отвечает одинаково в обоих случаях.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await query('SELECT public.request_password_reset($1)', [email]);
}

/**
 * Меняет пароль по токену из письма. SQL-функция заодно гасит токен,
 * подтверждает email, закрывает все сессии пользователя и кладёт событие
 * для письма-уведомления. false -- токен неверный, истёк или уже использован.
 */
export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
): Promise<boolean> {
  const result = await query<{ reset_password_with_token: string | null }>(
    'SELECT public.reset_password_with_token($1, $2)',
    [hashToken(token), createPasswordHash(newPassword)],
  );

  return Boolean(result.rows[0]?.reset_password_with_token);
}

export async function requestEmailVerification(
  userId: string,
): Promise<ResendVerificationResult> {
  return withUserContext(userId, async (client) => {
    const profile = await client.query<{ verified: boolean }>(
      'SELECT email_verified_at IS NOT NULL AS verified FROM public.profiles WHERE id = $1',
      [userId],
    );

    if (profile.rows[0]?.verified) {
      return 'already-verified';
    }

    await client.query(
      `INSERT INTO public.outbox_events (aggregate_type, aggregate_id, event_type, payload)
       VALUES ('profile', $1, 'email.verification_requested', $2)`,
      [userId, JSON.stringify({ userId })],
    );

    return 'queued';
  });
}

// В React-кэше запроса: layout вызывает это на каждый рендер, а страницы
// могут спросить то же самое ещё раз.
export const isEmailVerified = cache(async (userId: string) => {
  return withUserContext(userId, async (client) => {
    const result = await client.query<{ verified: boolean }>(
      'SELECT email_verified_at IS NOT NULL AS verified FROM public.profiles WHERE id = $1',
      [userId],
    );

    // Профиль не найден -- считаем подтверждённым, чтобы не показывать
    // баннер там, где он всё равно ничем не поможет.
    return result.rows[0]?.verified ?? true;
  });
});
