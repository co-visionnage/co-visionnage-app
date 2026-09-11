'use client';

import { useEffect, useState } from 'react';

import {
  removePushSubscriptionAction,
  savePushSubscriptionAction,
} from '@/shared/actions/push-postgres';
import { Checkbox } from '@/shared/ui/lib';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replaceAll('-', '+')
    .replaceAll('_', '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.codePointAt(0)!));
}

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export const PushNotificationToggle = () => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>();

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in globalThis))
      return;
    setIsSupported(true);

    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setIsSubscribed(Boolean(subscription)))
      .catch(() => {
        // subscription state stays unknown — user can still toggle manually
      });
  }, []);

  const handleToggle = async (nextEnabled: boolean) => {
    if (!vapidPublicKey) {
      setError('Уведомления не настроены на сервере');
      return;
    }

    setIsPending(true);
    setError(undefined);

    try {
      const registration = await navigator.serviceWorker.ready;

      if (nextEnabled) {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setError('Доступ к уведомлениям не предоставлен');
          return;
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });

        const result = await savePushSubscriptionAction(
          subscription.toJSON() as {
            endpoint: string;
            keys: { p256dh: string; auth: string };
          },
        );

        if (result.error) {
          setError(result.error);
          return;
        }

        setIsSubscribed(true);
      } else {
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          await removePushSubscriptionAction(subscription.endpoint);
          await subscription.unsubscribe();
        }

        setIsSubscribed(false);
      }
    } catch {
      setError('Не удалось изменить настройку уведомлений');
    } finally {
      setIsPending(false);
    }
  };

  if (!isSupported || !vapidPublicKey) {
    return;
  }

  return (
    <label className='flex items-center justify-between gap-4 border-4 border-black bg-white p-4 font-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'>
      <span>
        Push-уведомления
        {error ? (
          <span className='mt-1 block text-xs font-bold text-red-600'>
            {error}
          </span>
        ) : undefined}
      </span>
      <Checkbox
        checked={isSubscribed}
        disabled={isPending}
        onChange={(event) => void handleToggle(event.target.checked)}
      />
    </label>
  );
};
