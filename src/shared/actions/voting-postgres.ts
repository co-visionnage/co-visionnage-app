'use server';

import { revalidatePath } from 'next/cache';

import {
  requireCurrentUser,
  withUserContext,
} from '@/shared/api/postgres/server';

export type VotingActionState = {
  error?: string;
  success?: boolean;
};

export async function createWatchPollAction(
  familyId: string,
  seriesIds: string[],
  title: string,
): Promise<VotingActionState> {
  const user = await requireCurrentUser().catch(() => {});
  const trimmedTitle = title.trim();
  const uniqueSeriesIds = [...new Set(seriesIds)];

  if (!user) return { error: 'Не авторизован' };
  if (uniqueSeriesIds.length < 2) {
    return { error: 'Выберите хотя бы два сериала для голосования' };
  }

  try {
    await withUserContext(user.id, async (client) => {
      const pollResult = await client.query<{ id: string }>(
        `
          INSERT INTO public.family_watch_polls (family_id, created_by, title)
          VALUES ($1, $2, $3)
          RETURNING id
        `,
        [familyId, user.id, trimmedTitle || 'Что смотрим сегодня?'],
      );

      const pollId = pollResult.rows[0].id;

      // Scoped to family_id, not just "any series that exists" -- the FK
      // on family_watch_poll_options.series_id only requires the id to
      // exist somewhere, not that it belongs to this poll's family.
      await client.query(
        `
          INSERT INTO public.family_watch_poll_options (poll_id, series_id)
          SELECT $1, series.id
          FROM public.family_series series
          WHERE series.id = ANY($2::uuid[])
            AND series.family_id = $3
          ON CONFLICT DO NOTHING
        `,
        [pollId, uniqueSeriesIds, familyId],
      );
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Не удалось создать голосование',
    };
  }

  revalidatePath('/');
  return { success: true };
}

export async function voteWatchPollAction(
  pollId: string,
  optionId: string,
): Promise<VotingActionState> {
  const user = await requireCurrentUser().catch(() => {});

  if (!user) return { error: 'Не авторизован' };

  try {
    await withUserContext(user.id, async (client) => {
      await client.query(
        `
          INSERT INTO public.family_watch_poll_votes (poll_id, option_id, user_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (poll_id, user_id) DO UPDATE
          SET option_id = EXCLUDED.option_id
        `,
        [pollId, optionId, user.id],
      );
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Не удалось проголосовать',
    };
  }

  revalidatePath('/');
  return { success: true };
}

export async function closeWatchPollAction(
  pollId: string,
): Promise<VotingActionState> {
  const user = await requireCurrentUser().catch(() => {});

  if (!user) return { error: 'Не авторизован' };

  try {
    await withUserContext(user.id, async (client) => {
      await client.query(
        `
          UPDATE public.family_watch_polls
          SET is_open = false, closed_at = NOW()
          WHERE id = $1
        `,
        [pollId],
      );
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Не удалось завершить голосование',
    };
  }

  revalidatePath('/');
  return { success: true };
}
