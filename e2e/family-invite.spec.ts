import { expect, test } from '@playwright/test';

// Covers the family invite/join flow with two independent users -- the
// only other multi-user path in the app besides voting/polls, and not
// exercised by smoke.spec.ts (which only ever has one user). Uses two
// separate browser contexts so each user gets their own session cookie,
// same as two different people on two different devices.
test('a second user can join a family via its invite code and see its series', async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();

  const ownerEmail = `e2e-invite-owner-${Date.now()}@example.com`;
  const password = 'TestPass123!';

  await ownerPage.goto('/');
  await ownerPage.getByRole('button', { name: 'ВХОД' }).click();
  await ownerPage.getByRole('button', { name: 'Регистрация' }).click();
  await ownerPage.getByPlaceholder('email@example.com').fill(ownerEmail);
  await ownerPage.getByPlaceholder('Как вас подписать').fill('E2E Inviter');
  await ownerPage.getByPlaceholder('Пароль', { exact: true }).fill(password);
  await ownerPage.getByPlaceholder('Подтверждение пароля').fill(password);
  await ownerPage.getByRole('checkbox').check({ force: true });
  await ownerPage.getByRole('button', { name: 'Зарегистрироваться' }).click();
  await expect(ownerPage.getByText('E2E Inviter')).toBeVisible();

  const familyName = `E2E Invite Family ${Date.now()}`;
  await ownerPage
    .getByPlaceholder('Название (напр. Наша Семья)')
    .fill(familyName);
  await ownerPage.getByRole('button', { name: 'Создать семью' }).click();
  await expect(ownerPage.getByText(familyName, { exact: false })).toBeVisible();

  const seriesTitle = `E2E Shared Show ${Date.now()}`;
  await ownerPage.getByRole('button', { name: 'ДОБАВИТЬ СЕРИАЛ!' }).click();
  await ownerPage
    .getByRole('dialog')
    .getByPlaceholder('ВВЕДИ НАЗВАНИЕ')
    .fill(seriesTitle);
  await ownerPage
    .getByRole('dialog')
    .getByRole('button', { name: 'ДОБАВИТЬ!' })
    .click();
  await expect(ownerPage.getByText(seriesTitle)).toBeVisible();

  // Playwright's own Locator.innerText(), not the DOM node property the
  // unicorn rule is meant to flag -- textContent() would include the
  // "Копировать"/"Скопировано" toggle text in a way that's harder to
  // reason about, and Playwright's docs recommend innerText for
  // user-visible text.
  const inviteCodeButtonText = await ownerPage
    .getByRole('button', { name: /Код:/ })
    // eslint-disable-next-line unicorn/prefer-dom-node-text-content
    .innerText();
  const inviteCodeMatch = inviteCodeButtonText.match(/BRTL-[A-Z0-9]{6}/);
  expect(inviteCodeMatch).not.toBeNull();
  const inviteCode = inviteCodeMatch![0];

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();

  const memberEmail = `e2e-invite-member-${Date.now()}@example.com`;
  await memberPage.goto('/');
  await memberPage.getByRole('button', { name: 'ВХОД' }).click();
  await memberPage.getByRole('button', { name: 'Регистрация' }).click();
  await memberPage.getByPlaceholder('email@example.com').fill(memberEmail);
  await memberPage.getByPlaceholder('Как вас подписать').fill('E2E Joiner');
  await memberPage.getByPlaceholder('Пароль', { exact: true }).fill(password);
  await memberPage.getByPlaceholder('Подтверждение пароля').fill(password);
  await memberPage.getByRole('checkbox').check({ force: true });
  await memberPage.getByRole('button', { name: 'Зарегистрироваться' }).click();
  await expect(memberPage.getByText('E2E Joiner')).toBeVisible();

  await memberPage.getByPlaceholder('BRTL-XXXXXX').fill(inviteCode);
  await memberPage.getByRole('button', { name: 'Присоединиться' }).click();

  await expect(
    memberPage.getByText(familyName, { exact: false }),
  ).toBeVisible();
  await expect(memberPage.getByText(seriesTitle)).toBeVisible();

  await ownerContext.close();
  await memberContext.close();
});
