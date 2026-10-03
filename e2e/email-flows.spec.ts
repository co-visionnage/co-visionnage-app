import { expect, test } from '@playwright/test';

import { linkTo, waitForLetter } from './support/mail';
import {
  loginThroughUi,
  pageAlert,
  registerThroughUi,
  uniqueEmail,
  verifyEmailThroughLetter,
} from './support/users';

test.describe('email flows', () => {
  test('registration sends a verification letter, its link confirms the address and the banner disappears', async ({
    page,
  }) => {
    const email = uniqueEmail('e2e-verify');
    await registerThroughUi(page, { email, name: 'E2E Verify' });

    const banner = page.getByRole('region', { name: 'Подтверждение email' });
    await expect(banner).toBeVisible();

    const letter = await waitForLetter(email, {
      subject: 'Подтвердите email',
    });
    await page.goto(linkTo(letter, '/verify-email'));
    await expect(page.getByText('Email подтверждён. Спасибо!')).toBeVisible();

    await page.goto('/');
    await expect(page.getByText('E2E Verify')).toBeVisible();
    await expect(banner).not.toBeVisible();

    // Verifying sends the welcome letter.
    await waitForLetter(email, { subject: 'Добро пожаловать' });
  });

  test('the banner can resend the verification letter', async ({ page }) => {
    const email = uniqueEmail('e2e-resend');
    await registerThroughUi(page, { email, name: 'E2E Resend' });
    await waitForLetter(email, { subject: 'Подтвердите email' });

    await page.getByRole('button', { name: 'Отправить ещё раз' }).click();
    await expect(
      page.getByText('Письмо отправлено. Проверьте почту.'),
    ).toBeVisible();

    const second = await waitForLetter(email, {
      subject: 'Подтвердите email',
      skip: 1,
    });
    await page.goto(linkTo(second, '/verify-email'));
    await expect(page.getByText('Email подтверждён. Спасибо!')).toBeVisible();
  });

  test('a used verification link is rejected the second time', async ({
    page,
  }) => {
    const email = uniqueEmail('e2e-used');
    await registerThroughUi(page, { email, name: 'E2E Used' });
    const letter = await waitForLetter(email, {
      subject: 'Подтвердите email',
    });
    const link = linkTo(letter, '/verify-email');

    await page.goto(link);
    await expect(page.getByText('Email подтверждён. Спасибо!')).toBeVisible();

    await page.goto(link);
    await expect(pageAlert(page)).toBeVisible();
  });

  test('forgot password: the letter link sets a new password that works, the old one does not', async ({
    page,
  }) => {
    const email = uniqueEmail('e2e-reset');
    const newPassword = 'Brand-New-Pass-9!';
    await registerThroughUi(page, { email, name: 'E2E Reset' });
    await verifyEmailThroughLetter(page, email);

    await page.context().clearCookies();
    await page.goto('/forgot-password');
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Отправить ссылку' }).click();

    const letter = await waitForLetter(email, { subject: 'Сброс пароля' });
    await page.goto(linkTo(letter, '/reset-password'));
    await page.getByLabel('Новый пароль').fill(newPassword);
    await page.getByLabel('Подтверждение пароля').fill(newPassword);
    await page.getByRole('button', { name: 'Сохранить пароль' }).click();
    await expect(page.getByText('Пароль изменён.')).toBeVisible();

    // The change is announced by a security letter.
    await waitForLetter(email, { subject: 'Пароль в notrecinema изменён' });

    // The old password no longer signs in...
    const rejected = await page.request.post('/api/v1/auth/login', {
      data: {
        mode: 'login',
        email,
        password: 'TestPass123!',
        legalAccepted: true,
      },
    });
    expect(rejected.ok()).toBe(false);

    // ...the new one does, through the real login dialog.
    await loginThroughUi(page, { email, password: newPassword });
    await expect(page.getByText('E2E Reset')).toBeVisible();
  });

  test('a reset link cannot be reused', async ({ page }) => {
    const email = uniqueEmail('e2e-reset-twice');
    await registerThroughUi(page, { email, name: 'E2E Twice' });

    await page.goto('/forgot-password');
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Отправить ссылку' }).click();
    const letter = await waitForLetter(email, { subject: 'Сброс пароля' });
    const link = linkTo(letter, '/reset-password');

    for (const password of ['First-New-Pass-1!', 'Second-New-Pass-2!']) {
      await page.goto(link);
      await page.getByLabel('Новый пароль').fill(password);
      await page.getByLabel('Подтверждение пароля').fill(password);
      await page.getByRole('button', { name: 'Сохранить пароль' }).click();

      await (password.startsWith('First')
        ? expect(page.getByText('Пароль изменён.')).toBeVisible()
        : expect(pageAlert(page)).toBeVisible());
    }
  });
});
