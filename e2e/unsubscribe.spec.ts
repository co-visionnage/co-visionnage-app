import { expect, test } from '@playwright/test';

import { linkTo, waitForLetter } from './support/mail';
import {
  createFamilyThroughUi,
  newDevice,
  pageAlert,
  registerThroughApi,
  uniqueEmail,
} from './support/users';

// A letter about a new series goes to the other family members whose email
// is verified. Returns the page of such a member, already in the family.
async function familyWithVerifiedMember(
  ownerPage: import('@playwright/test').Page,
  browser: import('@playwright/test').Browser,
  memberEmail: string,
) {
  const familyName = `E2E Mail Family ${Date.now()}`;
  await registerThroughApi(ownerPage, {
    email: uniqueEmail('e2e-mail-owner'),
    name: 'E2E MailOwner',
  });
  await createFamilyThroughUi(ownerPage, familyName);

  const codeButtonText = await ownerPage
    .getByRole('button', { name: /Код:/ })
    .textContent();
  const inviteCode = codeButtonText?.match(/BRTL-[A-Z0-9]{6}/)?.[0] ?? '';
  expect(inviteCode).not.toBe('');

  const member = await newDevice(browser);
  await registerThroughApi(member.page, {
    email: memberEmail,
    name: 'E2E MailMember',
  });

  const verification = await waitForLetter(memberEmail, {
    subject: 'Подтвердите email',
  });
  await member.page.goto(linkTo(verification, '/verify-email'));
  await expect(
    member.page.getByText('Email подтверждён. Спасибо!'),
  ).toBeVisible();

  await member.page.goto('/');
  await member.page.getByPlaceholder('BRTL-XXXXXX').fill(inviteCode);
  await member.page.getByRole('button', { name: 'Присоединиться' }).click();
  await expect(
    member.page.getByText(familyName, { exact: false }),
  ).toBeVisible();

  return member;
}

async function addSeries(page: import('@playwright/test').Page, title: string) {
  await page.getByRole('button', { name: 'ДОБАВИТЬ СЕРИАЛ!' }).click();
  await page.getByRole('dialog').getByPlaceholder('ВВЕДИ НАЗВАНИЕ').fill(title);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'ДОБАВИТЬ!' })
    .click();
  await expect(page.getByText(title)).toBeVisible();
}

test('the new-series letter carries working unsubscribe links, and unsubscribing stops further letters', async ({
  page,
  browser,
}) => {
  const memberEmail = uniqueEmail('e2e-unsub');
  const member = await familyWithVerifiedMember(page, browser, memberEmail);

  const firstTitle = `E2E Mailed Show ${Date.now()}`;
  await addSeries(page, firstTitle);

  const letter = await waitForLetter(memberEmail, { subject: firstTitle });

  // RFC 8058 one-click headers are present for mail clients.
  expect(letter.headers?.['List-Unsubscribe']).toContain('/api/v1/unsubscribe');
  expect(letter.headers?.['List-Unsubscribe-Post']).toBe(
    'List-Unsubscribe=One-Click',
  );

  // The page link only asks; nothing happens until the button is pressed.
  await member.page.goto(linkTo(letter, '/unsubscribe'));
  await member.page.getByRole('button', { name: 'Отписаться' }).click();
  await expect(member.page.getByRole('status')).toContainText(
    'Новый сериал в списке',
  );

  // The preference is now off in the account settings.
  await member.page.goto('/settings');
  await expect(
    member.page.getByLabel('Новый сериал в списке: почта'),
  ).not.toBeChecked();

  // A later series produces no letter for the unsubscribed member, while the
  // verification letter that came earlier proves the mailbox works.
  const secondTitle = `E2E Silent Show ${Date.now()}`;
  await addSeries(page, secondTitle);
  await page.waitForTimeout(3000);
  const response = await fetch(
    `http://localhost:${process.env.FAKE_RESEND_PORT ?? 18_025}/_mailbox?to=${encodeURIComponent(memberEmail)}`,
  );
  const letters = (await response.json()) as Array<{ subject: string }>;
  expect(letters.some((item) => item.subject.includes(secondTitle))).toBe(
    false,
  );

  await member.context.close();
});

test('the unsubscribe page rejects a broken link and never unsubscribes on open', async ({
  page,
}) => {
  await page.goto('/unsubscribe');
  await expect(pageAlert(page)).toContainText('нет кода отписки');

  await page.goto('/unsubscribe?token=garbage');
  await page.getByRole('button', { name: 'Отписаться' }).click();
  await expect(pageAlert(page)).toBeVisible();
});
