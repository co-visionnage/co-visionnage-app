'use server';

import { actionErrorMessage, apiJson } from '@/shared/api/go/server';
import { requireCurrentUser } from '@/shared/api/go/session';

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
    await apiJson('/notifications/subscriptions', {
      method: 'POST',
      body: subscription,
    });
  } catch (error) {
    return {
      error: actionErrorMessage(error, 'Не удалось подключить уведомления'),
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
    await apiJson('/notifications/subscriptions', {
      method: 'DELETE',
      body: { endpoint },
    });
  } catch (error) {
    return {
      error: actionErrorMessage(error, 'Не удалось отключить уведомления'),
    };
  }

  return { success: true };
}
