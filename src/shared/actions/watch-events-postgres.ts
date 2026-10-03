'use server';

import { revalidatePath } from 'next/cache';

import { actionErrorMessage, apiJson } from '@/shared/api/go/server';
import { requireCurrentUser } from '@/shared/api/go/session';
import { RsvpStatus } from '@/shared/types';

export type WatchEventActionState = {
  error?: string;
  success?: boolean;
};

export async function createWatchEventAction(
  familyId: string,
  title: string,
  scheduledAt: string,
  seriesId?: string,
): Promise<WatchEventActionState> {
  const user = await requireCurrentUser().catch(() => {});
  const trimmedTitle = title.trim();

  if (!user) return { error: 'Не авторизован' };
  if (!trimmedTitle) return { error: 'Укажите название встречи' };

  const scheduledDate = new Date(scheduledAt);
  if (Number.isNaN(scheduledDate.getTime())) {
    return { error: 'Укажите корректную дату и время' };
  }

  try {
    await apiJson(`/families/${encodeURIComponent(familyId)}/events`, {
      method: 'POST',
      body: {
        title: trimmedTitle,
        scheduledAt: scheduledDate.toISOString(),
        seriesId,
      },
    });
  } catch (error) {
    return { error: actionErrorMessage(error, 'Не удалось создать встречу') };
  }

  revalidatePath('/');
  return { success: true };
}

export async function deleteWatchEventAction(
  eventId: string,
): Promise<WatchEventActionState> {
  const user = await requireCurrentUser().catch(() => {});

  if (!user) return { error: 'Не авторизован' };

  try {
    await apiJson(`/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
    });
  } catch (error) {
    return { error: actionErrorMessage(error, 'Не удалось удалить встречу') };
  }

  revalidatePath('/');
  return { success: true };
}

export async function setWatchEventRsvpAction(
  eventId: string,
  status: RsvpStatus,
): Promise<WatchEventActionState> {
  const user = await requireCurrentUser().catch(() => {});

  if (!user) return { error: 'Не авторизован' };

  try {
    await apiJson(`/events/${encodeURIComponent(eventId)}/rsvp`, {
      method: 'PUT',
      body: { status },
    });
  } catch (error) {
    return { error: actionErrorMessage(error, 'Не удалось отметиться') };
  }

  revalidatePath('/');
  return { success: true };
}
