'use server';

import {
  requireCurrentUser,
  withUserContext,
} from '@/shared/api/postgres/server';

export type PushActionState = {
  error?: string;
  success?: boolean;
};

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function savePushSubscriptionAction(
  subscription: PushSubscriptionInput,
): Promise<PushActionState> {
  const user = await requireCurrentUser().catch(() => {});

  if (!user) return { error: 'Не авторизован' };

  try {
    await withUserContext(user.id, async (client) => {
      await client.query(
        `
          INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (endpoint) DO UPDATE
          SET p256dh = EXCLUDED.p256dh,
              auth = EXCLUDED.auth
        `,
        [
          user.id,
          subscription.endpoint,
          subscription.keys.p256dh,
          subscription.keys.auth,
        ],
      );
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Не удалось подключить уведомления',
    };
  }

  return { success: true };
}

export async function removePushSubscriptionAction(
  endpoint: string,
): Promise<PushActionState> {
  const user = await requireCurrentUser().catch(() => {});

  if (!user) return { error: 'Не авторизован' };

  try {
    await withUserContext(user.id, async (client) => {
      await client.query(
        'DELETE FROM public.push_subscriptions WHERE endpoint = $1',
        [endpoint],
      );
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Не удалось отключить уведомления',
    };
  }

  return { success: true };
}
