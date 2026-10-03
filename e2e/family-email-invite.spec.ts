import { expect, test } from '@playwright/test';

import { linkTo, waitForLetter } from './support/mail';
import {
  createFamilyThroughUi,
  newDevice,
  registerThroughApi,
  uniqueEmail,
} from './support/users';

test('an owner invites by email; the invitee follows the letter link and joins the family', async ({
  page,
  browser,
}) => {
  const ownerEmail = uniqueEmail('e2e-inviter');
  const inviteeEmail = uniqueEmail('e2e-invitee');
  const familyName = `E2E Letter Family ${Date.now()}`;

  await registerThroughApi(page, { email: ownerEmail, name: 'E2E Owner' });
  await createFamilyThroughUi(page, familyName);

  // Invite from the members dialog.
  await page.getByRole('button', { name: 'УЧАСТНИКИ' }).click();
  const invitations = page.getByTestId('family-invitations');
  await invitations.getByLabel('Email для приглашения').fill(inviteeEmail);
  await invitations.getByRole('button', { name: 'Пригласить' }).click();
  await expect(
    invitations.getByText(`Приглашение отправлено на ${inviteeEmail}`),
  ).toBeVisible();
  await expect(invitations.getByText(inviteeEmail).last()).toBeVisible();

  // The invitee gets a letter with the family name and a link.
  const letter = await waitForLetter(inviteeEmail, {
    subject: 'приглашает вас в семью',
  });
  expect(letter.subject).toContain(familyName);
  const link = linkTo(letter, '/invite');

  const invitee = await newDevice(browser);

  // Signed out, the invitation page explains what to do instead of joining.
  await invitee.page.goto(link);
  await expect(invitee.page.getByText(familyName)).toBeVisible();
  await expect(
    invitee.page.getByRole('link', { name: 'Войти или зарегистрироваться' }),
  ).toBeVisible();

  await registerThroughApi(invitee.page, {
    email: inviteeEmail,
    name: 'E2E Invitee',
  });
  await invitee.page.goto(link);
  await invitee.page.getByRole('button', { name: 'Присоединиться' }).click();

  await expect(invitee.page).toHaveURL('/');
  await expect(
    invitee.page.getByText(familyName, { exact: false }),
  ).toBeVisible();

  // The invitation is spent: the same link no longer works...
  await invitee.page.goto(link);
  await expect(invitee.page.getByRole('alert')).toBeVisible();

  // ...and the owner sees a new member and no pending invitation.
  await page.reload();
  await page.getByRole('button', { name: 'УЧАСТНИКИ' }).click();
  await expect(page.getByText('E2E Invitee')).toBeVisible();
  await expect(
    page.getByTestId('family-invitations').getByRole('listitem'),
  ).toHaveCount(0);

  await invitee.context.close();
});

test('a pending invitation can be revoked, which kills its link', async ({
  page,
  browser,
}) => {
  const inviteeEmail = uniqueEmail('e2e-revoked');

  await registerThroughApi(page, {
    email: uniqueEmail('e2e-inviter-revoke'),
    name: 'E2E Revoker',
  });
  await createFamilyThroughUi(page, `E2E Revoke Family ${Date.now()}`);

  await page.getByRole('button', { name: 'УЧАСТНИКИ' }).click();
  const invitations = page.getByTestId('family-invitations');
  await invitations.getByLabel('Email для приглашения').fill(inviteeEmail);
  await invitations.getByRole('button', { name: 'Пригласить' }).click();
  await expect(invitations.getByRole('listitem')).toHaveCount(1);

  const letter = await waitForLetter(inviteeEmail, {
    subject: 'приглашает вас в семью',
  });
  const link = linkTo(letter, '/invite');

  await invitations.getByRole('button', { name: 'Отозвать' }).click();
  await expect(invitations.getByRole('listitem')).toHaveCount(0);

  const invitee = await newDevice(browser);
  await invitee.page.goto(link);
  await expect(invitee.page.getByRole('alert')).toBeVisible();
  await invitee.context.close();
});

test('inviting again re-sends the letter instead of creating a second invitation', async ({
  page,
}) => {
  const inviteeEmail = uniqueEmail('e2e-twice');

  await registerThroughApi(page, {
    email: uniqueEmail('e2e-inviter-twice'),
    name: 'E2E Twice',
  });
  await createFamilyThroughUi(page, `E2E Twice Family ${Date.now()}`);

  await page.getByRole('button', { name: 'УЧАСТНИКИ' }).click();
  const invitations = page.getByTestId('family-invitations');

  for (let attempt = 0; attempt < 2; attempt++) {
    await invitations.getByLabel('Email для приглашения').fill(inviteeEmail);
    await invitations.getByRole('button', { name: 'Пригласить' }).click();
    await waitForLetter(inviteeEmail, {
      subject: 'приглашает вас в семью',
      skip: attempt,
    });
  }

  await expect(invitations.getByRole('listitem')).toHaveCount(1);
});
