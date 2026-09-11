'use server';

import { revalidatePath } from 'next/cache';

import {
  requireCurrentUser,
  withUserContext,
} from '@/shared/api/postgres/server';

export type ProgressActionState = {
  error?: string;
  success?: boolean;
};

export async function setSeriesProgressAction(
  seriesId: string,
  currentSeason: number,
  currentEpisode: number,
): Promise<ProgressActionState> {
  const user = await requireCurrentUser().catch(() => {});

  if (!user) return { error: 'Не авторизован' };
  if (currentSeason < 1 || currentEpisode < 0) {
    return { error: 'Некорректный номер сезона или серии' };
  }

  try {
    await withUserContext(user.id, async (client) => {
      await client.query(
        `
          INSERT INTO public.family_series_progress (
            series_id,
            user_id,
            current_season,
            current_episode
          )
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (series_id, user_id) DO UPDATE
          SET current_season = EXCLUDED.current_season,
              current_episode = EXCLUDED.current_episode
        `,
        [seriesId, user.id, currentSeason, currentEpisode],
      );
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Не удалось сохранить прогресс',
    };
  }

  revalidatePath('/');
  return { success: true };
}
