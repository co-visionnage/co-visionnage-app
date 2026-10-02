import { afterAll, describe, expect, it } from 'vitest';

import {
  closePools,
  seedProfile,
  uniqueSuffix,
  withUserContext,
} from './database';

afterAll(async () => {
  await closePools();
});

// Coverage for push_subscriptions RLS (push_subscriptions_owner_only, FOR
// ALL USING/WITH CHECK user_id = current_user_id()), exercised the same way
// savePushSubscriptionAction/removePushSubscriptionAction do. Nothing
// tested this table before.

async function saveSubscription(
  userId: string,
  endpoint: string,
  p256dh = 'p256dh-key',
  auth = 'auth-key',
) {
  return withUserContext(userId, (client) =>
    client.query(
      `
        INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (endpoint) DO UPDATE
        SET p256dh = EXCLUDED.p256dh,
            auth = EXCLUDED.auth
      `,
      [userId, endpoint, p256dh, auth],
    ),
  );
}

async function removeSubscription(userId: string, endpoint: string) {
  return withUserContext(userId, (client) =>
    client.query('DELETE FROM public.push_subscriptions WHERE endpoint = $1', [
      endpoint,
    ]),
  );
}

async function getSubscription(viewerId: string, endpoint: string) {
  const result = await withUserContext(viewerId, (client) =>
    client.query<{ p256dh: string; auth: string }>(
      'SELECT p256dh, auth FROM public.push_subscriptions WHERE endpoint = $1',
      [endpoint],
    ),
  );
  return result.rows[0];
}

describe('push_subscriptions RLS', () => {
  it('lets a user register their own subscription', async () => {
    const user = await seedProfile('User');
    const endpoint = `https://push.example.com/${uniqueSuffix()}`;

    await saveSubscription(user.id, endpoint);

    expect(await getSubscription(user.id, endpoint)).toMatchObject({
      p256dh: 'p256dh-key',
    });
  });

  it('lets a user update their own subscription keys via re-registering', async () => {
    const user = await seedProfile('User');
    const endpoint = `https://push.example.com/${uniqueSuffix()}`;

    await saveSubscription(user.id, endpoint, 'old-key');
    await saveSubscription(user.id, endpoint, 'new-key');

    expect(await getSubscription(user.id, endpoint)).toMatchObject({
      p256dh: 'new-key',
    });
  });

  it("rejects a different user re-registering someone else's endpoint", async () => {
    const owner = await seedProfile('Owner');
    const attacker = await seedProfile('Attacker');
    const endpoint = `https://push.example.com/${uniqueSuffix()}`;

    await saveSubscription(owner.id, endpoint);

    // The ON CONFLICT DO UPDATE path is still an UPDATE under RLS -- the
    // attacker's session can't satisfy USING(user_id = current_user_id())
    // against the owner's row, so this must fail rather than silently
    // hijacking the endpoint (which would misdirect the owner's family
    // notifications to the attacker's device).
    await expect(saveSubscription(attacker.id, endpoint)).rejects.toThrow(
      /row-level security/i,
    );

    expect(await getSubscription(owner.id, endpoint)).toMatchObject({
      p256dh: 'p256dh-key',
    });
  });

  it('lets a user remove their own subscription', async () => {
    const user = await seedProfile('User');
    const endpoint = `https://push.example.com/${uniqueSuffix()}`;
    await saveSubscription(user.id, endpoint);

    await removeSubscription(user.id, endpoint);

    expect(await getSubscription(user.id, endpoint)).toBeUndefined();
  });

  it("does not let a different user remove someone else's subscription", async () => {
    const owner = await seedProfile('Owner');
    const outsider = await seedProfile('Outsider');
    const endpoint = `https://push.example.com/${uniqueSuffix()}`;
    await saveSubscription(owner.id, endpoint);

    // A zero-row DELETE under RLS is not an error.
    await removeSubscription(outsider.id, endpoint);

    expect(await getSubscription(owner.id, endpoint)).toBeDefined();
  });
});
