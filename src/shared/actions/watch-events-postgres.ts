'use server';

import { revalidatePath } from 'next/cache';

import {
  requireCurrentUser,
  withUserContext,
} from '@/shared/api/postgres/server';
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
    await withUserContext(user.id, async (client) => {
      const eventResult = await client.query<{ id: string }>(
        `
          INSERT INTO public.family_watch_events (family_id, series_id, created_by, title, scheduled_at)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `,
        [familyId, seriesId ?? undefined, user.id, trimmedTitle, scheduledDate],
      );

      await client.query(
        `
          INSERT INTO public.family_watch_event_rsvps (event_id, user_id, status)
          VALUES ($1, $2, 'going')
        `,
        [eventResult.rows[0].id, user.id],
      );
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Не удалось создать встречу',
    };
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
    await withUserContext(user.id, async (client) => {
      await client.query(
        'DELETE FROM public.family_watch_events WHERE id = $1',
        [eventId],
      );
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Не удалось удалить встречу',
    };
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
    await withUserContext(user.id, async (client) => {
      await client.query(
        `
          INSERT INTO public.family_watch_event_rsvps (event_id, user_id, status)
          VALUES ($1, $2, $3)
          ON CONFLICT (event_id, user_id) DO UPDATE
          SET status = EXCLUDED.status
        `,
        [eventId, user.id, status],
      );
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Не удалось отметиться',
    };
  }

  revalidatePath('/');
  return { success: true };
}
