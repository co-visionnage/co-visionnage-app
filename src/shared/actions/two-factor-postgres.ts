'use server';

import { actionErrorMessage, apiJson } from '@/shared/api/go/server';
import { requireCurrentUser } from '@/shared/api/go/session';

export type TwoFactorSetupState = {
  error?: string;
  qrCodeDataUrl?: string;
  secret?: string;
};

export async function startTwoFactorSetupAction(): Promise<TwoFactorSetupState> {
  const user = await requireCurrentUser().catch(() => {});
  if (!user) return { error: 'Не авторизован' };

  try {
    return await apiJson<{ qrCodeDataUrl: string; secret: string }>(
      '/auth/2fa/setup',
      { method: 'POST' },
    );
  } catch (error) {
    return {
      error: actionErrorMessage(error, 'Не удалось начать настройку'),
    };
  }
}

export type TwoFactorActionState = {
  error?: string;
  success?: boolean;
  // One-time backup codes, shown once right after enabling 2FA or
  // regenerating them; the API stores only their hashes.
  backupCodes?: string[];
};

export async function confirmTwoFactorAction(
  code: string,
): Promise<TwoFactorActionState> {
  const user = await requireCurrentUser().catch(() => {});
  if (!user) return { error: 'Не авторизован' };

  try {
    const result = await apiJson<{ backupCodes: string[] }>(
      '/auth/2fa/confirm',
      { method: 'POST', body: { code } },
    );
    return { success: true, backupCodes: result.backupCodes };
  } catch (error) {
    return {
      error: actionErrorMessage(error, 'Не удалось подтвердить код'),
    };
  }
}

export async function regenerateBackupCodesAction(
  code: string,
): Promise<TwoFactorActionState> {
  const user = await requireCurrentUser().catch(() => {});
  if (!user) return { error: 'Не авторизован' };

  try {
    const result = await apiJson<{ backupCodes: string[] }>(
      '/auth/2fa/backup-codes/regenerate',
      { method: 'POST', body: { code } },
    );
    return { success: true, backupCodes: result.backupCodes };
  } catch (error) {
    return {
      error: actionErrorMessage(error, 'Не удалось выпустить новые коды'),
    };
  }
}

export async function disableTwoFactorAction(
  code: string,
): Promise<TwoFactorActionState> {
  const user = await requireCurrentUser().catch(() => {});
  if (!user) return { error: 'Не авторизован' };

  try {
    await apiJson('/auth/2fa/disable', { method: 'POST', body: { code } });
    return { success: true };
  } catch (error) {
    return {
      error: actionErrorMessage(error, 'Не удалось отключить 2FA'),
    };
  }
}
