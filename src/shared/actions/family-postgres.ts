'use server';

import { revalidatePath } from 'next/cache';

import { actionErrorMessage, apiJson } from '@/shared/api/go/server';
import { requireCurrentUser } from '@/shared/api/go/session';
import { setActiveFamilyIdCookie } from '@/shared/lib/activeFamily';

export type FamilyActionState = {
  error?: string;
  success?: boolean;
};

type FamilyDto = { id: string };

export async function createFamily(
  _previousState: FamilyActionState,
  formData: FormData,
): Promise<FamilyActionState> {
  const user = await requireCurrentUser().catch(() => {});
  const name = String(formData.get('familyName') ?? '').trim();

  if (!user) return { error: 'Не авторизован' };
  if (!name) return { error: 'Введите название семьи' };

  try {
    const family = await apiJson<FamilyDto>('/families', {
      method: 'POST',
      body: { name },
    });
    await setActiveFamilyIdCookie(family.id);
  } catch (error) {
    return {
      error: actionErrorMessage(error, 'Не удалось создать семью'),
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
    const family = await apiJson<FamilyDto>('/families/join', {
      method: 'POST',
      body: { inviteCode },
    });
    await setActiveFamilyIdCookie(family.id);
  } catch (error) {
    return {
      error: actionErrorMessage(error, 'Не удалось вступить в семью'),
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
    await apiJson(
      `/families/${encodeURIComponent(familyId)}/members/${encodeURIComponent(memberUserId)}/role`,
      { method: 'PUT', body: { role } },
    );
  } catch (error) {
    return { error: actionErrorMessage(error, 'Не удалось изменить роль') };
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
    await apiJson(
      `/families/${encodeURIComponent(familyId)}/transfer-ownership`,
      { method: 'POST', body: { newOwnerUserId } },
    );
  } catch (error) {
    return {
      error: actionErrorMessage(error, 'Не удалось передать владение семьёй'),
    };
  }

  revalidatePath('/');
  return { success: true };
}
