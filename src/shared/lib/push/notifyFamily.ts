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

export async function notifyFamily(
  client: {
    query: <Row extends Record<string, unknown>>(
      text: string,
      values?: unknown[],
    ) => Promise<{ rows: Row[] }>;
  },
  familyId: string,
  excludeUserId: string,
  payload: PushPayload,
): Promise<void> {
  if (!ensureConfigured()) return;

  const { rows } = await client.query<{
    endpoint: string;
    p256dh: string;
    auth: string;
  }>('SELECT * FROM public.get_family_push_subscriptions($1, $2)', [
    familyId,
    excludeUserId,
  ]);

  await Promise.all(
    rows.map(async (subscription) => {
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
