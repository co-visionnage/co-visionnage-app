'use server';

import { revalidatePath } from 'next/cache';

import { actionErrorMessage, apiJson } from '@/shared/api/go/server';
import { requireCurrentUser } from '@/shared/api/go/session';

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
    await apiJson(`/series/${encodeURIComponent(seriesId)}/progress`, {
      method: 'PUT',
      body: { currentSeason, currentEpisode },
    });
  } catch (error) {
    return {
      error: actionErrorMessage(error, 'Не удалось сохранить прогресс'),
    };
  }

  revalidatePath('/');
  return { success: true };
}
