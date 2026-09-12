'use server';

import { getFamilyMemberEmailsWithClient } from '@/shared/api/postgres/queries';
import {
  requireCurrentUser,
  withUserContext,
} from '@/shared/api/postgres/server';
import { notifyFamilyByEmail } from '@/shared/lib/email/notifyFamilyByEmail';
import { notifyFamily } from '@/shared/lib/push/notifyFamily';
import { SeriesData } from '@/shared/types';

async function notifyFamilyOfEvent(
  userId: string,
  familyId: string,
  title: string,
  body: string,
) {
  try {
    await withUserContext(userId, async (client) => {
      await notifyFamily(client, familyId, userId, {
        title,
        body,
        url: '/',
      });

      const emails = await getFamilyMemberEmailsWithClient(
        client,
        familyId,
        userId,
      );
      await notifyFamilyByEmail(emails, title, body);
    });
  } catch {
    // best-effort — notification failures must never break the underlying action
  }
}

export interface SeriesActionState {
  error?: string;
  success?: boolean;
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
    await withUserContext(user.id, async (client) => {
      const newSeries = await client.query<{ id: string }>(
        `
          INSERT INTO public.family_series (
            family_id,
            title,
            genres,
            year,
            image_url,
            created_by,
            total_seasons,
            total_episodes,
            episode_runtime_minutes,
            trailer_url
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id
        `,
        [
          familyId,
          data.title,
          data.genres,
          data.year,
          data.image_url ?? undefined,
          user.id,
          data.totalSeasons ?? undefined,
          data.totalEpisodes ?? undefined,
          data.episodeRuntimeMinutes ?? undefined,
          data.trailerUrl ?? undefined,
        ],
      );

      await client.query(
        `
          INSERT INTO public.family_series_status (
            series_id,
            user_id,
            status,
            rating,
            comment,
            watched_at
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          newSeries.rows[0].id,
          user.id,
          data.status,
          data.status === 'watched' ? (data.rating ?? undefined) : undefined,
          data.status === 'watched' ? (data.comment ?? undefined) : undefined,
          data.status === 'watched' ? new Date() : undefined,
        ],
      );
    });

    await notifyFamilyOfEvent(
      user.id,
      familyId,
      'Новый сериал в списке',
      `${user.displayName ?? user.email} добавил(а) «${data.title}»`,
    );

    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Ошибка добавления сериала',
    };
  }
}

export async function deleteAction(id: string): Promise<SeriesActionState> {
  const user = await requireCurrentUser().catch(() => {});

  if (!user) {
    return { error: 'Не авторизован' };
  }

  try {
    await withUserContext(user.id, async (client) => {
      await client.query('DELETE FROM public.family_series WHERE id = $1', [
        id,
      ]);
    });

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Ошибка удаления',
    };
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
    let familyId: string | undefined;
    let seriesTitle = '';

    await withUserContext(user.id, async (client) => {
      await client.query(
        `
          INSERT INTO public.family_series_status (
            series_id,
            user_id,
            status,
            rating,
            comment,
            watched_at
          )
          VALUES ($1, $2, 'watched', $3, $4, NOW())
          ON CONFLICT (series_id, user_id) DO UPDATE
          SET status = EXCLUDED.status,
              rating = EXCLUDED.rating,
              comment = EXCLUDED.comment,
              watched_at = COALESCE(family_series_status.watched_at, NOW())
        `,
        [id, user.id, rating, comment || undefined],
      );

      const seriesResult = await client.query<{
        family_id: string;
        title: string;
      }>('SELECT family_id, title FROM public.family_series WHERE id = $1', [
        id,
      ]);
      familyId = seriesResult.rows[0]?.family_id;
      seriesTitle = seriesResult.rows[0]?.title ?? '';
    });

    if (familyId) {
      await notifyFamilyOfEvent(
        user.id,
        familyId,
        'Отметили сериал',
        `${user.displayName ?? user.email} посмотрел(а) «${seriesTitle}»`,
      );
    }

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Ошибка отметки',
    };
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
    await withUserContext(user.id, async (client) => {
      await client.query(
        `
          UPDATE public.family_series_status
          SET status = 'to-watch',
              rating = NULL,
              comment = NULL,
              watched_at = NULL
          WHERE series_id = $1
            AND user_id = $2
        `,
        [id, user.id],
      );
    });

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Ошибка перемещения',
    };
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
    await withUserContext(user.id, async (client) => {
      if (
        updates.title !== undefined ||
        updates.genres !== undefined ||
        updates.year !== undefined ||
        updates.image_url !== undefined ||
        updates.totalSeasons !== undefined ||
        updates.totalEpisodes !== undefined ||
        updates.episodeRuntimeMinutes !== undefined ||
        updates.trailerUrl !== undefined
      ) {
        await client.query(
          `
            UPDATE public.family_series
            SET title = COALESCE($2, title),
                genres = COALESCE($3, genres),
                year = COALESCE($4, year),
                image_url = CASE
                  WHEN $5::text IS NULL THEN image_url
                  ELSE $5
                END,
                total_seasons = COALESCE($6, total_seasons),
                total_episodes = COALESCE($7, total_episodes),
                episode_runtime_minutes = COALESCE($8, episode_runtime_minutes),
                trailer_url = COALESCE($9, trailer_url)
            WHERE id = $1
          `,
          [
            id,
            updates.title ?? undefined,
            updates.genres ?? undefined,
            updates.year ?? undefined,
            updates.image_url === undefined ? undefined : updates.image_url,
            updates.totalSeasons ?? undefined,
            updates.totalEpisodes ?? undefined,
            updates.episodeRuntimeMinutes ?? undefined,
            updates.trailerUrl ?? undefined,
          ],
        );
      }

      if (updates.rating !== undefined || updates.comment !== undefined) {
        await client.query(
          `
            UPDATE public.family_series_status
            SET rating = COALESCE($3, rating),
                comment = COALESCE($4, comment)
            WHERE series_id = $1
              AND user_id = $2
          `,
          [
            id,
            user.id,
            updates.rating ?? undefined,
            updates.comment ?? undefined,
          ],
        );
      }
    });

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Ошибка редактирования',
    };
  }
}
