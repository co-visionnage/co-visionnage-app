'use server';

import {
  requireCurrentUser,
  withUserContext,
} from '@/shared/api/postgres/server';
import {
  generateTotpQrCode,
  generateTotpSecret,
  verifyTotpCode,
} from '@/shared/lib/totp';

export type TwoFactorSetupState = {
  error?: string;
  qrCodeDataUrl?: string;
  secret?: string;
};

export async function startTwoFactorSetupAction(): Promise<TwoFactorSetupState> {
  const user = await requireCurrentUser().catch(() => {});
  if (!user) return { error: 'Не авторизован' };

  try {
    const secret = generateTotpSecret();

    // Overwriting totp_secret while totp_enabled is already true would
    // desync the authenticator app (still showing codes for the old
    // secret) from the database (now expecting the new one), locking the
    // user out at their next login. Disabling 2FA first (which requires a
    // valid current code) is the only way to re-run setup.
    const alreadyEnabled = await withUserContext(user.id, async (client) => {
      const existing = await client.query<{ totp_enabled: boolean }>(
        'SELECT totp_enabled FROM public.profiles WHERE id = $1',
        [user.id],
      );

      if (existing.rows[0]?.totp_enabled) {
        return true;
      }

      await client.query(
        'UPDATE public.profiles SET totp_secret = $2 WHERE id = $1',
        [user.id, secret],
      );
      return false;
    });

    if (alreadyEnabled) {
      return {
        error:
          'Двухфакторная аутентификация уже включена. Сначала отключите её, чтобы настроить заново.',
      };
    }

    const qrCodeDataUrl = await generateTotpQrCode(user.email, secret);

    return { qrCodeDataUrl, secret };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Не удалось начать настройку',
    };
  }
}

export type TwoFactorActionState = {
  error?: string;
  success?: boolean;
};

export async function confirmTwoFactorAction(
  code: string,
): Promise<TwoFactorActionState> {
  const user = await requireCurrentUser().catch(() => {});
  if (!user) return { error: 'Не авторизован' };

  try {
    return await withUserContext(user.id, async (client) => {
      const result = await client.query<{ totp_secret: string | null }>(
        'SELECT totp_secret FROM public.profiles WHERE id = $1',
        [user.id],
      );

      const secret = result.rows[0]?.totp_secret;
      if (!secret) {
        return { error: 'Сначала начните настройку — отсканируйте QR-код' };
      }

      if (!(await verifyTotpCode(code, secret))) {
        return { error: 'Неверный код' };
      }

      await client.query(
        'UPDATE public.profiles SET totp_enabled = true WHERE id = $1',
        [user.id],
      );

      return { success: true };
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Не удалось подтвердить код',
    };
  }
}

export async function disableTwoFactorAction(
  code: string,
): Promise<TwoFactorActionState> {
  const user = await requireCurrentUser().catch(() => {});
  if (!user) return { error: 'Не авторизован' };

  try {
    return await withUserContext(user.id, async (client) => {
      const result = await client.query<{ totp_secret: string | null }>(
        'SELECT totp_secret FROM public.profiles WHERE id = $1',
        [user.id],
      );

      const secret = result.rows[0]?.totp_secret;
      if (!secret || !(await verifyTotpCode(code, secret))) {
        return { error: 'Неверный код' };
      }

      await client.query(
        `
          UPDATE public.profiles
          SET totp_enabled = false, totp_secret = NULL
          WHERE id = $1
        `,
        [user.id],
      );

      return { success: true };
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Не удалось отключить 2FA',
    };
  }
}
