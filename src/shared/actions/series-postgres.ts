'use server';

import {
  requireCurrentUser,
  withUserContext,
} from '@/shared/api/postgres/server';
import { SeriesData } from '@/shared/types';

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
            created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `,
        [
          familyId,
          data.title,
          data.genres,
          data.year,
          data.image_url ?? undefined,
          user.id,
        ],
      );

      await client.query(
        `
          INSERT INTO public.family_series_status (
            series_id,
            user_id,
            status,
            rating,
            comment
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          newSeries.rows[0].id,
          user.id,
          data.status,
          data.status === 'watched' ? (data.rating ?? undefined) : undefined,
          data.status === 'watched' ? (data.comment ?? undefined) : undefined,
        ],
      );
    });

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
    await withUserContext(user.id, async (client) => {
      await client.query(
        `
          INSERT INTO public.family_series_status (
            series_id,
            user_id,
            status,
            rating,
            comment
          )
          VALUES ($1, $2, 'watched', $3, $4)
          ON CONFLICT (series_id, user_id) DO UPDATE
          SET status = EXCLUDED.status,
              rating = EXCLUDED.rating,
              comment = EXCLUDED.comment
        `,
        [id, user.id, rating, comment || undefined],
      );
    });

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
              comment = NULL
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
        updates.image_url !== undefined
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
                END
            WHERE id = $1
          `,
          [
            id,
            updates.title ?? undefined,
            updates.genres ?? undefined,
            updates.year ?? undefined,
            updates.image_url === undefined ? undefined : updates.image_url,
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
