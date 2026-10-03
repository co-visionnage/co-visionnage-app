'use server';

import { revalidatePath } from 'next/cache';

import { actionErrorMessage, apiJson } from '@/shared/api/go/server';
import { requireCurrentUser } from '@/shared/api/go/session';

export type CommentActionState = {
  error?: string;
  success?: boolean;
};

type ReactionDto = { userId: string; emoji: string };

export async function addSeriesCommentAction(
  seriesId: string,
  body: string,
  spoiler?: { season: number; episode?: number },
): Promise<CommentActionState> {
  const user = await requireCurrentUser().catch(() => {});
  const trimmedBody = body.trim();

  if (!user) return { error: 'Не авторизован' };
  if (!trimmedBody) return { error: 'Комментарий не может быть пустым' };
  if (trimmedBody.length > 2000) {
    return { error: 'Слишком длинный комментарий' };
  }

  try {
    await apiJson(`/series/${encodeURIComponent(seriesId)}/comments`, {
      method: 'POST',
      body: {
        body: trimmedBody,
        spoilerSeason: spoiler?.season,
        spoilerEpisode: spoiler?.episode,
      },
    });
  } catch (error) {
    return {
      error: actionErrorMessage(error, 'Не удалось добавить комментарий'),
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
    await apiJson(`/comments/${encodeURIComponent(commentId)}`, {
      method: 'DELETE',
    });
  } catch (error) {
    return {
      error: actionErrorMessage(error, 'Не удалось удалить комментарий'),
    };
  }

  revalidatePath('/');
  return { success: true };
}

// The API has separate add/remove endpoints; "toggle" is decided here from
// the current reactions of the signed-in user.
export async function toggleSeriesReactionAction(
  seriesId: string,
  emoji: string,
): Promise<CommentActionState> {
  const user = await requireCurrentUser().catch(() => {});

  if (!user) return { error: 'Не авторизован' };

  const base = `/series/${encodeURIComponent(seriesId)}/reactions`;

  try {
    const reactions = await apiJson<ReactionDto[]>(base);
    const reactedByMe = reactions.some(
      (reaction) => reaction.userId === user.id && reaction.emoji === emoji,
    );

    await (reactedByMe
      ? apiJson(`${base}/${encodeURIComponent(emoji)}`, { method: 'DELETE' })
      : apiJson(base, { method: 'POST', body: { emoji } }));
  } catch (error) {
    return {
      error: actionErrorMessage(error, 'Не удалось поставить реакцию'),
    };
  }

  revalidatePath('/');
  return { success: true };
}
