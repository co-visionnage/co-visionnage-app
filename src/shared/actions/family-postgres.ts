'use server';

import { revalidatePath } from 'next/cache';

import {
  requireCurrentUser,
  withUserContext,
} from '@/shared/api/postgres/server';

export type FamilyActionState = {
  error?: string;
  success?: boolean;
};

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let index = 0; index < 6; index++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `BRTL-${result}`;
}

export async function createFamily(
  _previousState: FamilyActionState,
  formData: FormData,
): Promise<FamilyActionState> {
  const user = await requireCurrentUser().catch(() => {});
  const name = String(formData.get('familyName') ?? '').trim();

  if (!user) return { error: 'Не авторизован' };
  if (!name) return { error: 'Введите название семьи' };

  try {
    await withUserContext(user.id, async (client) => {
      const familyResult = await client.query<{ id: string }>(
        `
          INSERT INTO public.families (name, invite_code, owner_id)
          VALUES ($1, $2, $3)
          RETURNING id
        `,
        [name, generateInviteCode(), user.id],
      );

      const family = familyResult.rows[0];

      await client.query(
        `
          INSERT INTO public.family_members (family_id, user_id, role)
          VALUES ($1, $2, 'owner')
        `,
        [family.id, user.id],
      );
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Не удалось создать семью',
    };
  }

  revalidatePath('/');
  return { success: true };
}

export async function joinFamily(
  _previousState: FamilyActionState,
  formData: FormData,
): Promise<FamilyActionState> {
  const user = await requireCurrentUser().catch(() => {});
  const inviteCode = String(formData.get('inviteCode') ?? '')
    .trim()
    .toUpperCase();

  if (!user) return { error: 'Не авторизован' };
  if (!inviteCode) return { error: 'Введите код' };

  try {
    const result = await withUserContext(user.id, async (client) => {
      const familyResult = await client.query<{ family_id: string }>(
        'SELECT * FROM public.find_family_by_invite_code($1)',
        [inviteCode],
      );

      const family = familyResult.rows[0];

      if (!family) {
        return { error: `Семья с кодом ${inviteCode} не найдена` };
      }

      await client.query(
        `
          INSERT INTO public.family_members (family_id, user_id, role)
          VALUES ($1, $2, 'member')
        `,
        [family.family_id, user.id],
      );

      return { success: true } as FamilyActionState;
    });

    if (result.error) {
      return result;
    }
  } catch (error) {
    if (
      typeof error === 'object' &&
      error &&
      'code' in error &&
      error.code === '23505'
    ) {
      return { error: 'Вы уже состоите в этой семье' };
    }

    return {
      error:
        error instanceof Error ? error.message : 'Не удалось вступить в семью',
    };
  }

  revalidatePath('/');
  return { success: true };
}
