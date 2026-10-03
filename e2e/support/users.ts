import type { Browser, Page } from '@playwright/test';

import { expect } from '@playwright/test';
import { generate } from 'otplib';

export const PASSWORD = 'TestPass123!';

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/** Registers through the real UI and waits until the user box shows the name. */
export async function registerThroughUi(
  page: Page,
  {
    email,
    name,
    password = PASSWORD,
  }: { email: string; name: string; password?: string },
) {
  await page.goto('/');
  await page.getByRole('button', { name: 'ВХОД' }).click();
  await page.getByRole('button', { name: 'Регистрация' }).click();
  await page.getByPlaceholder('email@example.com').fill(email);
  await page.getByPlaceholder('Как вас подписать').fill(name);
  await page.getByPlaceholder('Пароль', { exact: true }).fill(password);
  await page.getByPlaceholder('Подтверждение пароля').fill(password);
  await page.getByRole('checkbox').check({ force: true }); // visually hidden (sr-only) checkbox
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();
  await expect(page.getByText(name)).toBeVisible();
}

/** Logs in through the real UI; stops at the 2FA prompt when there is one. */
export async function loginThroughUi(
  page: Page,
  { email, password = PASSWORD }: { email: string; password?: string },
) {
  await page.goto('/');
  await page.getByRole('button', { name: 'ВХОД' }).click();
  await page.getByPlaceholder('email@example.com').fill(email);
  await page.getByPlaceholder('Пароль', { exact: true }).fill(password);
  await page.getByRole('checkbox').check({ force: true });
  // "Войти" also names the mode switch above the form: the submit button is
  // the last exact match ("Войти по GitHub" is not an exact match).
  await page.getByRole('button', { name: 'Войти', exact: true }).last().click();
}

/** Signs in through the API: fast and independent of the login dialog. */
export async function loginThroughApi(
  page: Page,
  { email, password = PASSWORD }: { email: string; password?: string },
) {
  const response = await page.request.post('/api/v1/auth/login', {
    data: { mode: 'login', email, password, legalAccepted: true },
  });
  expect(response.ok()).toBe(true);
}

/** Registers through the API and returns the signed-in page's context. */
export async function registerThroughApi(
  page: Page,
  {
    email,
    name,
    password = PASSWORD,
  }: { email: string; name: string; password?: string },
) {
  const response = await page.request.post('/api/v1/auth/login', {
    data: {
      mode: 'register',
      email,
      displayName: name,
      password,
      confirmPassword: password,
      legalAccepted: true,
    },
  });
  expect(response.ok()).toBe(true);
}

/** A page in its own browser context: its own cookies, like another device. */
export async function newDevice(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

export async function totpCode(secret: string) {
  return generate({ secret });
}

export async function createFamilyThroughUi(page: Page, familyName: string) {
  await page.goto('/');
  await page.getByPlaceholder('Название (напр. Наша Семья)').fill(familyName);
  await page.getByRole('button', { name: 'Создать семью' }).click();
  await expect(page.getByText(familyName, { exact: false })).toBeVisible();
}
