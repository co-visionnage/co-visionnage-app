import { expect, test } from '@playwright/test';

import { waitForLetter } from './support/mail';
import {
  loginThroughUi,
  registerThroughUi,
  totpCode,
  uniqueEmail,
  verifyEmailThroughLetter,
} from './support/users';

// Turns 2FA on from /settings and returns the TOTP secret and the backup
// codes shown right after confirmation.
async function enableTwoFactor(page: import('@playwright/test').Page) {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Настроить' }).click();

  const secretText = await page
    .getByText(/^[A-Z2-7]{16,}$/)
    .first()
    .textContent();
  const secret = secretText?.trim();
  expect(secret).toBeTruthy();

  await page
    .getByPlaceholder('Код из приложения')
    .fill(await totpCode(secret!));
  await page.getByRole('button', { name: 'Подтвердить и включить' }).click();

  const codes = page.getByTestId('backup-codes').getByRole('listitem');
  await expect(codes).toHaveCount(10);
  const backupCodes = await codes.allTextContents();

  await page.getByRole('button', { name: 'Я сохранил(а) коды' }).click();
  await expect(page.getByText('Включена')).toBeVisible();

  return { secret: secret!, backupCodes };
}

test.describe('two-factor authentication', () => {
  test('a backup code signs in once instead of the app code, and the account owner is told', async ({
    page,
  }) => {
    const email = uniqueEmail('e2e-2fa');
    await registerThroughUi(page, { email, name: 'E2E TwoFactor' });
    await verifyEmailThroughLetter(page, email);

    const { backupCodes } = await enableTwoFactor(page);
    await waitForLetter(email, {
      subject: 'Двухфакторная аутентификация включена',
    });
    await expect(page.getByText('Резервных кодов осталось: 10')).toBeVisible();

    // Sign out, then sign in with a backup code at the second step.
    await page.context().clearCookies();
    await loginThroughUi(page, { email });
    await page
      .getByPlaceholder('Код из приложения или резервный')
      .fill(backupCodes[0]);
    await page.getByRole('button', { name: 'Подтвердить' }).click();
    await expect(page.getByText('E2E TwoFactor')).toBeVisible();

    await waitForLetter(email, { subject: 'вошли с резервным кодом' });

    await page.goto('/settings');
    await expect(page.getByText('Резервных кодов осталось: 9')).toBeVisible();

    // The same code is spent: it cannot sign in a second time.
    await page.context().clearCookies();
    await loginThroughUi(page, { email });
    await page
      .getByPlaceholder('Код из приложения или резервный')
      .fill(backupCodes[0]);
    await page.getByRole('button', { name: 'Подтвердить' }).click();
    await expect(page.getByText('Неверный код')).toBeVisible();
  });

  test('regenerating backup codes invalidates the old set', async ({
    page,
  }) => {
    const email = uniqueEmail('e2e-2fa-regen');
    await registerThroughUi(page, { email, name: 'E2E Regen' });
    await verifyEmailThroughLetter(page, email);

    const { secret, backupCodes: oldCodes } = await enableTwoFactor(page);

    await page
      .getByPlaceholder('Код из приложения (для действий ниже)')
      .fill(await totpCode(secret));
    await page
      .getByRole('button', { name: 'Выпустить новые резервные коды' })
      .click();

    const fresh = page.getByTestId('backup-codes').getByRole('listitem');
    await expect(fresh).toHaveCount(10);
    const newCodes = await fresh.allTextContents();
    expect(newCodes).not.toEqual(oldCodes);
    await waitForLetter(email, { subject: 'Резервные коды 2FA выпущены' });

    // An old code no longer works...
    await page.context().clearCookies();
    await loginThroughUi(page, { email });
    await page
      .getByPlaceholder('Код из приложения или резервный')
      .fill(oldCodes[0]);
    await page.getByRole('button', { name: 'Подтвердить' }).click();
    await expect(page.getByText('Неверный код')).toBeVisible();

    // ...a new one does.
    await page
      .getByPlaceholder('Код из приложения или резервный')
      .fill(newCodes[0]);
    await page.getByRole('button', { name: 'Подтвердить' }).click();
    await expect(page.getByText('E2E Regen')).toBeVisible();
  });

  test('the authenticator code still works and 2FA can be switched off', async ({
    page,
  }) => {
    const email = uniqueEmail('e2e-2fa-off');
    await registerThroughUi(page, { email, name: 'E2E TotpOff' });
    await verifyEmailThroughLetter(page, email);
    const { secret } = await enableTwoFactor(page);

    await page
      .getByPlaceholder('Код из приложения (для действий ниже)')
      .fill(await totpCode(secret));
    await page.getByRole('button', { name: 'Отключить' }).click();
    await expect(page.getByRole('button', { name: 'Настроить' })).toBeVisible();
    await waitForLetter(email, {
      subject: 'Двухфакторная аутентификация отключена',
    });

    // With 2FA off, signing in needs the password only.
    await page.context().clearCookies();
    await loginThroughUi(page, { email });
    await expect(page.getByText('E2E TotpOff')).toBeVisible();
  });
});
