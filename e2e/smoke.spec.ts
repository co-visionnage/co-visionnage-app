import { expect, test } from '@playwright/test';

// End-to-end smoke test covering the app's core golden path: register,
// create a family, add a series, and see it show up. This mirrors the
// exact manual QA flow used throughout this project's development --
// turning it into a real test gives that repeated manual checking a
// permanent regression guard.
test('register, create a family, and add a series', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;
  const password = 'TestPass123!';

  await page.goto('/');
  await page.getByRole('button', { name: 'ВХОД' }).click();

  await page.getByRole('button', { name: 'Регистрация' }).click();
  await page.getByPlaceholder('email@example.com').fill(email);
  await page.getByPlaceholder('Как вас подписать').fill('E2E Tester');
  await page.getByPlaceholder('Пароль', { exact: true }).fill(password);
  await page.getByPlaceholder('Подтверждение пароля').fill(password);
  await page.getByRole('checkbox').check({ force: true }); // visually hidden (sr-only) checkbox

  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();

  await expect(page.getByText('E2E Tester')).toBeVisible();

  const familyName = `E2E Family ${Date.now()}`;
  await page.getByPlaceholder('Название (напр. Наша Семья)').fill(familyName);
  await page.getByRole('button', { name: 'Создать семью' }).click();

  await expect(page.getByText(familyName, { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'ДОБАВИТЬ СЕРИАЛ!' }).click();
  const seriesTitle = `E2E Series ${Date.now()}`;
  await page.getByPlaceholder('ВВЕДИ НАЗВАНИЕ').fill(seriesTitle);
  await page.getByRole('button', { name: 'ДОБАВИТЬ!' }).click();

  await expect(page.getByText(seriesTitle)).toBeVisible();
});
