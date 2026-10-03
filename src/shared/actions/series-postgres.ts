'use server';

import { actionErrorMessage, apiJson } from '@/shared/api/go/server';
import { requireCurrentUser } from '@/shared/api/go/session';
import { SeriesData } from '@/shared/types';

// Notifying the family (email + push) is the worker's job now: the API
// records an outbox event in the same transaction as the change, so a
// notification is neither lost on a crash nor sent for a rolled-back change.

export interface SeriesActionState {
  error?: string;
  success?: boolean;
}

const seriesPath = (id: string) => `/series/${encodeURIComponent(id)}`;

function toApiSeries(data: SeriesData) {
  return {
    title: data.title,
    genres: data.genres,
    year: data.year,
    imageUrl: data.image_url ?? undefined,
    totalSeasons: data.totalSeasons,
    totalEpisodes: data.totalEpisodes,
    episodeRuntimeMinutes: data.episodeRuntimeMinutes,
    trailerUrl: data.trailerUrl,
    mediaType: data.mediaType,
    externalSource: data.externalSource,
    externalId: data.externalId,
    status: data.status,
    rating: data.status === 'watched' ? data.rating : undefined,
    comment: data.status === 'watched' ? data.comment : undefined,
  };
}

export async function addSeriesAction(
  familyId: string,
  data: SeriesData,
): Promise<SeriesActionState> {
  const user = await requireCurrentUser().catch(() => {});

  if (!user) {
    return { error: 'Не авторизован' };
  }

  try {
    await apiJson(`/families/${encodeURIComponent(familyId)}/series`, {
      method: 'POST',
      body: toApiSeries(data),
    });

    return { success: true };
  } catch (error) {
    return { error: actionErrorMessage(error, 'Ошибка добавления сериала') };
  }
}

export interface SeriesBulkActionState {
  error?: string;
  addedCount?: number;
}

// Mirrors the API's own cap so an oversized import fails fast with a clear
// message instead of after uploading the whole payload.
const MAX_BULK_IMPORT_ITEMS = 500;

// Used by bulk import (Trakt watchlist / IMDb CSV export): one request, one
// transaction, one activity-log entry and one notification instead of one
// round trip per title.
export async function addSeriesBulkAction(
  familyId: string,
  items: SeriesData[],
): Promise<SeriesBulkActionState> {
  const user = await requireCurrentUser().catch(() => {});

  if (!user) {
    return { error: 'Не авторизован' };
  }

  if (items.length === 0) {
    return { addedCount: 0 };
  }

  if (items.length > MAX_BULK_IMPORT_ITEMS) {
    return {
      error: `Слишком много сериалов за один раз (максимум ${MAX_BULK_IMPORT_ITEMS})`,
    };
  }

  try {
    const result = await apiJson<{ addedCount: number }>(
      `/families/${encodeURIComponent(familyId)}/series/bulk`,
      {
        method: 'POST',
        body: { items: items.map((item) => toApiSeries(item)) },
      },
    );

    return { addedCount: result.addedCount };
  } catch (error) {
    return { error: actionErrorMessage(error, 'Ошибка добавления сериалов') };
  }
}

export async function deleteAction(id: string): Promise<SeriesActionState> {
  const user = await requireCurrentUser().catch(() => {});

  if (!user) {
    return { error: 'Не авторизован' };
  }

  try {
    await apiJson(seriesPath(id), { method: 'DELETE' });
    return { success: true };
  } catch (error) {
    return { error: actionErrorMessage(error, 'Ошибка удаления') };
  }
}

export async function markWatchedAction(
  id: string,
  rating: number,
  comment: string,
): Promise<SeriesActionState> {
  const user = await requireCurrentUser().catch(() => {});

  if (!user) {
    return { error: 'Не авторизован' };
  }

  try {
    await apiJson(`${seriesPath(id)}/status`, {
      method: 'PUT',
      body: { status: 'watched', rating, comment: comment || undefined },
    });
    return { success: true };
  } catch (error) {
    return { error: actionErrorMessage(error, 'Ошибка отметки') };
  }
}

export async function moveToWatchListAction(
  id: string,
): Promise<SeriesActionState> {
  const user = await requireCurrentUser().catch(() => {});

  if (!user) {
    return { error: 'Не авторизован' };
  }

  try {
    // Back to "to-watch" without a rating or comment.
    await apiJson(`${seriesPath(id)}/status`, {
      method: 'PUT',
      body: { status: 'to-watch' },
    });
    return { success: true };
  } catch (error) {
    return { error: actionErrorMessage(error, 'Ошибка перемещения') };
  }
}

export async function editAction(
  id: string,
  updates: Partial<SeriesData>,
): Promise<SeriesActionState> {
  const user = await requireCurrentUser().catch(() => {});

  if (!user) {
    return { error: 'Не авторизован' };
  }

  try {
    await apiJson(seriesPath(id), {
      method: 'PATCH',
      body: {
        title: updates.title,
        genres: updates.genres,
        year: updates.year,
        imageUrl: updates.image_url ?? undefined,
        totalSeasons: updates.totalSeasons,
        totalEpisodes: updates.totalEpisodes,
        episodeRuntimeMinutes: updates.episodeRuntimeMinutes,
        trailerUrl: updates.trailerUrl,
        rating: updates.rating,
        comment: updates.comment,
      },
    });
    return { success: true };
  } catch (error) {
    return { error: actionErrorMessage(error, 'Ошибка редактирования') };
  }
}
