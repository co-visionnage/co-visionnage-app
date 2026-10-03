'use server';

import { revalidatePath } from 'next/cache';

import { actionErrorMessage, apiJson } from '@/shared/api/go/server';
import { requireCurrentUser } from '@/shared/api/go/session';

export type VotingActionState = {
  error?: string;
  success?: boolean;
};

const DEFAULT_POLL_TITLE = 'Что смотрим сегодня?';

export async function createWatchPollAction(
  familyId: string,
  seriesIds: string[],
  title: string,
): Promise<VotingActionState> {
  const user = await requireCurrentUser().catch(() => {});
  const uniqueSeriesIds = [...new Set(seriesIds)];

  if (!user) return { error: 'Не авторизован' };
  if (uniqueSeriesIds.length < 2) {
    return { error: 'Выберите хотя бы два сериала для голосования' };
  }

  try {
    await apiJson(`/families/${encodeURIComponent(familyId)}/polls`, {
      method: 'POST',
      body: {
        title: title.trim() || DEFAULT_POLL_TITLE,
        seriesIds: uniqueSeriesIds,
      },
    });
  } catch (error) {
    return {
      error: actionErrorMessage(error, 'Не удалось создать голосование'),
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
    await apiJson(`/polls/${encodeURIComponent(pollId)}/votes`, {
      method: 'POST',
      body: { optionId },
    });
  } catch (error) {
    return { error: actionErrorMessage(error, 'Не удалось проголосовать') };
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
    await apiJson(`/polls/${encodeURIComponent(pollId)}/close`, {
      method: 'POST',
    });
  } catch (error) {
    return {
      error: actionErrorMessage(error, 'Не удалось завершить голосование'),
    };
  }

  revalidatePath('/');
  return { success: true };
}
