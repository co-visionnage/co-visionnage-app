'use server';

import { revalidatePath } from 'next/cache';

import {
  requireCurrentUser,
  withUserContext,
} from '@/shared/api/postgres/server';
import { setActiveFamilyIdCookie } from '@/shared/lib/activeFamily';
import { logFamilyActivity } from '@/shared/lib/activityLog';

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

const MAX_INVITE_CODE_ATTEMPTS = 5;

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
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
    let familyId: string | undefined;

    for (let attempt = 1; ; attempt++) {
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

          familyId = familyResult.rows[0].id;

          await client.query(
            `
              INSERT INTO public.family_members (family_id, user_id, role)
              VALUES ($1, $2, 'owner')
            `,
            [familyId, user.id],
          );
        });
        break;
      } catch (error) {
        // invite_code is the only unique column this insert can collide on;
        // a random 6-character code hits it rarely, but with enough
        // families it will happen eventually -- retry with a fresh code
        // rather than surfacing it to the user as "failed to create family".
        if (isUniqueViolation(error) && attempt < MAX_INVITE_CODE_ATTEMPTS) {
          continue;
        }
        throw error;
      }
    }

    if (familyId) {
      await setActiveFamilyIdCookie(familyId);
    }
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

      await logFamilyActivity(client, {
        familyId: family.family_id,
        actorId: user.id,
        actorLabel: user.displayName ?? user.email,
        action: 'member_joined',
      });

      return {
        success: true,
        familyId: family.family_id,
      } as FamilyActionState & { familyId: string };
    });

    if (result.error) {
      return result;
    }

    if ('familyId' in result) {
      await setActiveFamilyIdCookie(result.familyId);
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

export async function setMemberRoleAction(
  familyId: string,
  memberUserId: string,
  role: 'admin' | 'member',
): Promise<FamilyActionState> {
  const user = await requireCurrentUser().catch(() => {});

  if (!user) return { error: 'Не авторизован' };

  try {
    await withUserContext(user.id, async (client) => {
      const membershipResult = await client.query<{ role: string }>(
        `
          SELECT role
          FROM public.family_members
          WHERE family_id = $1
            AND user_id = $2
          LIMIT 1
        `,
        [familyId, user.id],
      );

      if (membershipResult.rows[0]?.role !== 'owner') {
        throw new Error('Только владелец семьи может менять роли участников');
      }

      await client.query(
        `
          UPDATE public.family_members
          SET role = $3
          WHERE family_id = $1
            AND user_id = $2
            AND role != 'owner'
        `,
        [familyId, memberUserId, role],
      );

      const targetResult = await client.query<{
        display_name: string | null;
        email: string;
      }>('SELECT display_name, email FROM public.profiles WHERE id = $1', [
        memberUserId,
      ]);
      const target = targetResult.rows[0];

      await logFamilyActivity(client, {
        familyId,
        actorId: user.id,
        actorLabel: user.displayName ?? user.email,
        action: 'role_changed',
        targetLabel: target ? (target.display_name ?? target.email) : undefined,
        detail: role,
      });
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Не удалось изменить роль',
    };
  }

  revalidatePath('/');
  return { success: true };
}

export async function transferFamilyOwnershipAction(
  familyId: string,
  newOwnerUserId: string,
): Promise<FamilyActionState> {
  const user = await requireCurrentUser().catch(() => {});

  if (!user) return { error: 'Не авторизован' };

  try {
    await withUserContext(user.id, async (client) => {
      await client.query('SELECT public.transfer_family_ownership($1, $2)', [
        familyId,
        newOwnerUserId,
      ]);

      const targetResult = await client.query<{
        display_name: string | null;
        email: string;
      }>('SELECT display_name, email FROM public.profiles WHERE id = $1', [
        newOwnerUserId,
      ]);
      const target = targetResult.rows[0];

      await logFamilyActivity(client, {
        familyId,
        actorId: user.id,
        actorLabel: user.displayName ?? user.email,
        action: 'ownership_transferred',
        targetLabel: target ? (target.display_name ?? target.email) : undefined,
      });
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Не удалось передать владение семьёй',
    };
  }

  revalidatePath('/');
  return { success: true };
}
