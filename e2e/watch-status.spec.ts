import { expect, test } from '@playwright/test';

// Covers marking a series as already-watched (with a rating) at creation
// time, and confirms it lands under the "СМОТРЕЛИ" tab rather than
// "ХОТИМ" -- the family_series_status write addSeriesAction makes
// alongside the family_series insert, not exercised by smoke.spec.ts
// (which only adds a to-watch series).
test('adding a series as already-watched files it under СМОТРЕЛИ with its rating', async ({
  page,
}) => {
  const email = `e2e-watched-${Date.now()}@example.com`;
  const password = 'TestPass123!';

  await page.goto('/');
  await page.getByRole('button', { name: 'ВХОД' }).click();
  await page.getByRole('button', { name: 'Регистрация' }).click();
  await page.getByPlaceholder('email@example.com').fill(email);
  await page.getByPlaceholder('Как вас подписать').fill('E2E Watcher');
  await page.getByPlaceholder('Пароль', { exact: true }).fill(password);
  await page.getByPlaceholder('Подтверждение пароля').fill(password);
  await page.getByRole('checkbox').check({ force: true });
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();

  await expect(page.getByText('E2E Watcher')).toBeVisible();

  const familyName = `E2E Watched Family ${Date.now()}`;
  await page.getByPlaceholder('Название (напр. Наша Семья)').fill(familyName);
  await page.getByRole('button', { name: 'Создать семью' }).click();
  await expect(page.getByText(familyName, { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'ДОБАВИТЬ СЕРИАЛ!' }).click();

  const dialog = page.getByRole('dialog');
  const seriesTitle = `E2E Watched Show ${Date.now()}`;
  await dialog.getByPlaceholder('ВВЕДИ НАЗВАНИЕ').fill(seriesTitle);

  // The status Select defaults to "ХОТИМ ПОСМОТРЕТЬ" -- switch it to
  // "УЖЕ ПОСМОТРЕЛИ" so the rating field appears and the insert goes
  // through addSeriesAction's status='watched' branch.
  await dialog.getByRole('combobox').nth(1).click();
  await page.getByRole('option', { name: 'УЖЕ ПОСМОТРЕЛИ' }).click();

  await dialog.getByRole('combobox').nth(2).click();
  await page.getByRole('option', { name: '★★★★★ ОТЛИЧНО!' }).click();

  await dialog.getByRole('button', { name: 'ДОБАВИТЬ!' }).click();
  await expect(dialog).not.toBeVisible();

  // The default tab is ХОТИМ -- the series must not show up there since it
  // was added as already-watched.
  await expect(page.getByRole('tab', { name: /ХОТИМ/ })).toHaveText(
    /ХОТИМ \(0\)/,
  );
  await expect(page.getByText(seriesTitle)).not.toBeVisible();

  await page.getByRole('tab', { name: /СМОТРЕЛИ/ }).click();
  await expect(page.getByText(seriesTitle)).toBeVisible();
});
