'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { actionErrorMessage, apiJson } from '@/shared/api/go/server';
import { requireCurrentUser } from '@/shared/api/go/session';

const SESSION_COOKIE_NAME = 'notre_cinema_session';

export type DeleteAccountState = {
  error?: string;
  success?: boolean;
};

export async function deleteAccountAction(
  password: string,
): Promise<DeleteAccountState> {
  const user = await requireCurrentUser().catch(() => {});
  if (!user) return { error: 'Не авторизован' };

  try {
    await apiJson('/users/me', { method: 'DELETE', body: { password } });
  } catch (error) {
    return {
      error: actionErrorMessage(error, 'Не удалось удалить аккаунт'),
    };
  }

  // The API ended the session server-side, but its Set-Cookie never reached
  // the browser (this call is server-to-server): drop the cookie here.
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  revalidatePath('/');
  return { success: true };
}
