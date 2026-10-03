import { expect, test } from '@playwright/test';

import { waitForLetter } from './support/mail';
import {
  loginThroughApi,
  newDevice,
  pageAlert,
  PASSWORD,
  registerThroughApi,
  uniqueEmail,
  verifyEmailThroughLetter,
} from './support/users';

test.describe('account settings', () => {
  test('changing the password keeps this device signed in and signs the others out', async ({
    page,
    browser,
  }) => {
    const email = uniqueEmail('e2e-pass');
    const newPassword = 'Changed-Pass-7!';
    await registerThroughApi(page, { email, name: 'E2E Password' });
    await verifyEmailThroughLetter(page, email);

    // Second device with its own session.
    const other = await newDevice(browser);
    await loginThroughApi(other.page, { email });
    await other.page.goto('/settings');
    await expect(other.page.getByText('E2E Password')).toBeVisible();

    await page.goto('/settings');
    await page.getByLabel('Текущий пароль').fill(PASSWORD);
    await page.getByLabel('Новый пароль').fill(newPassword);
    await page.getByLabel('Подтверждение пароля').fill(newPassword);
    await page.getByRole('button', { name: 'Сменить пароль' }).click();
    await expect(page.getByText('Пароль изменён.')).toBeVisible();
    await waitForLetter(email, { subject: 'Пароль в notrecinema изменён' });

    // This device is still signed in; the other one is not.
    await page.reload();
    await expect(page.getByText('E2E Password')).toBeVisible();
    await other.page.reload();
    await expect(
      other.page.getByText('Войдите, чтобы открыть настройки'),
    ).toBeVisible();

    await other.context.close();
  });

  test('a wrong current password is refused', async ({ page }) => {
    const email = uniqueEmail('e2e-pass-wrong');
    await registerThroughApi(page, { email, name: 'E2E WrongPass' });

    await page.goto('/settings');
    await page.getByLabel('Текущий пароль').fill('Not-My-Password-1!');
    await page.getByLabel('Новый пароль').fill('Changed-Pass-7!');
    await page.getByLabel('Подтверждение пароля').fill('Changed-Pass-7!');
    await page.getByRole('button', { name: 'Сменить пароль' }).click();

    await expect(pageAlert(page)).toBeVisible();
  });

  test('the sessions list shows every device and revokes a chosen one', async ({
    page,
    browser,
  }) => {
    const email = uniqueEmail('e2e-sessions');
    await registerThroughApi(page, { email, name: 'E2E Sessions' });

    const other = await newDevice(browser);
    await loginThroughApi(other.page, { email });

    await page.goto('/settings');
    const rows = page.getByTestId('session-row');
    await expect(rows).toHaveCount(2);
    await expect(page.getByText('Это устройство')).toHaveCount(1);

    // Revoke the other device (the only row with a "Закрыть" button).
    await page.getByRole('button', { name: 'Закрыть' }).click();
    await expect(rows).toHaveCount(1);

    await other.page.goto('/settings');
    await expect(
      other.page.getByText('Войдите, чтобы открыть настройки'),
    ).toBeVisible();

    await other.context.close();
  });

  test('"sign out everywhere else" closes all other sessions at once', async ({
    page,
    browser,
  }) => {
    const email = uniqueEmail('e2e-sessions-all');
    await registerThroughApi(page, { email, name: 'E2E SessionsAll' });

    const devices = [await newDevice(browser), await newDevice(browser)];
    for (const device of devices) {
      await loginThroughApi(device.page, { email });
    }

    await page.goto('/settings');
    await expect(page.getByTestId('session-row')).toHaveCount(3);

    await page
      .getByRole('button', { name: 'Выйти на всех остальных устройствах' })
      .click();
    await expect(page.getByTestId('session-row')).toHaveCount(1);

    for (const device of devices) {
      await device.page.goto('/settings');
      await expect(
        device.page.getByText('Войдите, чтобы открыть настройки'),
      ).toBeVisible();
      await device.context.close();
    }
  });

  test('notification preferences are saved and survive a reload', async ({
    page,
  }) => {
    await registerThroughApi(page, {
      email: uniqueEmail('e2e-prefs'),
      name: 'E2E Prefs',
    });

    await page.goto('/settings');
    const emailSwitch = page.getByLabel('Новый сериал в списке: почта');
    await expect(emailSwitch).toBeChecked();
    // Categories without letters cannot be switched to email.
    await expect(page.getByLabel('Голосования: почта')).toBeDisabled();

    await emailSwitch.uncheck();
    await page.getByLabel('Голосования: push').uncheck();
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByText('Сохранено')).toBeVisible();

    await page.reload();
    await expect(
      page.getByLabel('Новый сериал в списке: почта'),
    ).not.toBeChecked();
    await expect(page.getByLabel('Голосования: push')).not.toBeChecked();
    await expect(
      page.getByLabel('Напоминание досмотреть: почта'),
    ).toBeChecked();
  });
});
