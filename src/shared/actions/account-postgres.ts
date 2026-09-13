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
      }>('SELECT password_hash FROM public.profiles WHERE id = $1', [user.id]);

      const passwordHash = profileResult.rows[0]?.password_hash;

      if (!passwordHash || !verifyPassword(password, passwordHash)) {
        return { error: 'Неверный пароль' };
      }

      // Checks every family this user belongs to, not just one: a user can
      // be a plain member of one family and the owner of another (multi-
      // family membership is a supported feature), and missing any single
      // family they own with other members would let delete_own_profile's
      // ON DELETE CASCADE wipe that family out from under its members.
      const blockingFamilies = await client.query<{ name: string }>(
        `
          SELECT family.name
          FROM public.family_members member
          JOIN public.families family ON family.id = member.family_id
          WHERE member.user_id = $1
            AND member.role = 'owner'
            AND (
              SELECT COUNT(*) FROM public.family_members other
              WHERE other.family_id = member.family_id
            ) > 1
        `,
        [user.id],
      );

      if (blockingFamilies.rows.length > 0) {
        const familyNames = blockingFamilies.rows
          .map((row) => row.name)
          .join(', ');
        return {
          error: `Вы владелец семей с другими участниками (${familyNames}). Сначала передайте владение в каждой из них (в разделе «Участники»), потом удаляйте аккаунт.`,
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
