import webpush from 'web-push';

import { ENV } from '@/shared/config/environment';

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

let isConfigured = false;

function ensureConfigured() {
  if (isConfigured) return true;
  if (!ENV.VAPID_PUBLIC_KEY || !ENV.VAPID_PRIVATE_KEY || !ENV.VAPID_SUBJECT) {
    return false;
  }

  webpush.setVapidDetails(
    ENV.VAPID_SUBJECT,
    ENV.VAPID_PUBLIC_KEY,
    ENV.VAPID_PRIVATE_KEY,
  );
  isConfigured = true;
  return true;
}

type QueryClient = {
  query: <Row extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ) => Promise<{ rows: Row[] }>;
};

type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

async function sendToSubscriptions(
  subscriptions: PushSubscriptionRow[],
  payload: PushPayload,
): Promise<void> {
  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(payload),
        );
      } catch {
        // best-effort — a dead subscription (410/404) is pruned lazily on next subscribe, not here
      }
    }),
  );
}

export async function notifyFamily(
  client: QueryClient,
  familyId: string,
  excludeUserId: string,
  payload: PushPayload,
): Promise<void> {
  if (!ensureConfigured()) return;

  const { rows } = await client.query<PushSubscriptionRow>(
    'SELECT * FROM public.get_family_push_subscriptions($1, $2)',
    [familyId, excludeUserId],
  );

  await sendToSubscriptions(rows, payload);
}

// System variant for scheduled jobs that don't run in a logged-in user's
// request — see the SECURITY DEFINER note on get_family_push_subscriptions_system
// in database/init.sql for why this bypasses the usual membership check.
export async function notifyFamilySystem(
  client: QueryClient,
  familyId: string,
  payload: PushPayload,
): Promise<void> {
  if (!ensureConfigured()) return;

  const { rows } = await client.query<PushSubscriptionRow>(
    'SELECT * FROM public.get_family_push_subscriptions_system($1)',
    [familyId],
  );

  await sendToSubscriptions(rows, payload);
}
