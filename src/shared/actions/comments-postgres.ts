'use server';

import { revalidatePath } from 'next/cache';

import {
  requireCurrentUser,
  withUserContext,
} from '@/shared/api/postgres/server';

export type CommentActionState = {
  error?: string;
  success?: boolean;
};

export async function addSeriesCommentAction(
  seriesId: string,
  body: string,
): Promise<CommentActionState> {
  const user = await requireCurrentUser().catch(() => {});
  const trimmedBody = body.trim();

  if (!user) return { error: 'Не авторизован' };
  if (!trimmedBody) return { error: 'Комментарий не может быть пустым' };
  if (trimmedBody.length > 2000) {
    return { error: 'Слишком длинный комментарий' };
  }

  try {
    await withUserContext(user.id, async (client) => {
      await client.query(
        `
          INSERT INTO public.family_series_comments (series_id, user_id, body)
          VALUES ($1, $2, $3)
        `,
        [seriesId, user.id, trimmedBody],
      );
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Не удалось добавить комментарий',
    };
  }

  revalidatePath('/');
  return { success: true };
}

export async function deleteSeriesCommentAction(
  commentId: string,
): Promise<CommentActionState> {
  const user = await requireCurrentUser().catch(() => {});

  if (!user) return { error: 'Не авторизован' };

  try {
    await withUserContext(user.id, async (client) => {
      await client.query(
        'DELETE FROM public.family_series_comments WHERE id = $1',
        [commentId],
      );
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Не удалось удалить комментарий',
    };
  }

  revalidatePath('/');
  return { success: true };
}

export async function toggleSeriesReactionAction(
  seriesId: string,
  emoji: string,
): Promise<CommentActionState> {
  const user = await requireCurrentUser().catch(() => {});

  if (!user) return { error: 'Не авторизован' };

  try {
    await withUserContext(user.id, async (client) => {
      const existing = await client.query<{ id: string }>(
        `
          SELECT id
          FROM public.family_series_reactions
          WHERE series_id = $1
            AND user_id = $2
            AND emoji = $3
          LIMIT 1
        `,
        [seriesId, user.id, emoji],
      );

      if (existing.rows[0]) {
        await client.query(
          'DELETE FROM public.family_series_reactions WHERE id = $1',
          [existing.rows[0].id],
        );
        return;
      }

      await client.query(
        `
          INSERT INTO public.family_series_reactions (series_id, user_id, emoji)
          VALUES ($1, $2, $3)
        `,
        [seriesId, user.id, emoji],
      );
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Не удалось поставить реакцию',
    };
  }

  revalidatePath('/');
  return { success: true };
}
