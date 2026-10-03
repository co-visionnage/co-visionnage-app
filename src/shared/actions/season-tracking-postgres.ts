'use server';

import { actionErrorMessage, apiJson } from '@/shared/api/go/server';
import { requireCurrentUser } from '@/shared/api/go/session';

// The checks themselves (external OMDb/Kinopoisk/TMDB calls, the per-user
// rate limit, the notification to the family) live in the Go API.

export type CheckUpdatesState = {
  error?: string;
  updated?: boolean;
  newTotalSeasons?: number;
};

export async function checkSeriesUpdatesAction(
  seriesId: string,
): Promise<CheckUpdatesState> {
  const user = await requireCurrentUser().catch(() => {});
  if (!user) return { error: 'Не авторизован' };

  try {
    const result = await apiJson<{
      updated: boolean;
      newTotalSeasons?: number;
    }>(`/series/${encodeURIComponent(seriesId)}/season-updates/check`, {
      method: 'POST',
    });

    return {
      updated: result.updated,
      newTotalSeasons: result.newTotalSeasons,
    };
  } catch (error) {
    return {
      error: actionErrorMessage(error, 'Ошибка проверки обновлений'),
    };
  }
}

export type CheckNextEpisodeState = {
  error?: string;
  airDate?: string;
  label?: string;
};

export async function checkNextEpisodeAction(
  seriesId: string,
): Promise<CheckNextEpisodeState> {
  const user = await requireCurrentUser().catch(() => {});
  if (!user) return { error: 'Не авторизован' };

  try {
    const entry = await apiJson<{
      nextEpisodeAirDate?: string;
      nextEpisodeLabel?: string;
    }>(`/series/${encodeURIComponent(seriesId)}/next-episode/check`, {
      method: 'POST',
    });

    return { airDate: entry.nextEpisodeAirDate, label: entry.nextEpisodeLabel };
  } catch (error) {
    return {
      error: actionErrorMessage(error, 'Ошибка проверки даты выхода'),
    };
  }
}
