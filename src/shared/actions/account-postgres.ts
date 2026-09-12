'use server';

import { revalidatePath } from 'next/cache';

import {
  clearUserSession,
  requireCurrentUser,
  verifyPassword,
  withUserContext,
} from '@/shared/api/postgres/server';

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
    const result = await withUserContext(user.id, async (client) => {
      const profileResult = await client.query<{
        password_hash: string | null;
      }>('SELECT password_hash FROM public.profiles WHERE id = $1', [
        user.id,
      ]);

      const passwordHash = profileResult.rows[0]?.password_hash;

      if (!passwordHash || !verifyPassword(password, passwordHash)) {
        return { error: 'Неверный пароль' };
      }

      const membershipResult = await client.query<{
        role: string;
        member_count: string;
      }>(
        `
          SELECT
            member.role,
            (
              SELECT COUNT(*) FROM public.family_members other
              WHERE other.family_id = member.family_id
            ) AS member_count
          FROM public.family_members member
          WHERE member.user_id = $1
          LIMIT 1
        `,
        [user.id],
      );

      const membership = membershipResult.rows[0];

      if (membership?.role === 'owner' && Number(membership.member_count) > 1) {
        return {
          error:
            'Вы владелец семьи с другими участниками. Сначала передайте владение другому участнику (в разделе «Участники»), потом удаляйте аккаунт.',
        };
      }

      await client.query('SELECT public.delete_own_profile($1)', [user.id]);
      return { success: true };
    });

    if (result.success) {
      await clearUserSession();
      revalidatePath('/');
    }

    return result;
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Не удалось удалить аккаунт',
    };
  }
}
