'use client';

import { useEffect, useState } from 'react';

import { fetchJson } from '@/shared/lib/fetchJson';
import { CATEGORY_LABELS } from './categoryLabels';
import {
  errorClass,
  primaryButtonClass,
  sectionClass,
  sectionTitleClass,
} from './styles';

type Preference = {
  category: string;
  push: boolean;
  email: boolean;
  emailSupported: boolean;
};

/** Матрица «тип события × push/почта»; сохраняется целиком одной кнопкой. */
export function NotificationPreferences() {
  const [preferences, setPreferences] = useState<Preference[]>();
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void fetchJson<{ preferences: Preference[] }>(
      '/api/v1/notification-preferences',
    ).then((result) => {
      if (result.ok) {
        setPreferences(result.data.preferences);
      } else {
        setError(result.error);
      }
    });
  }, []);

  function toggle(category: string, channel: 'push' | 'email') {
    setSaved(false);
    setPreferences((current) =>
      current?.map((preference) =>
        preference.category === category
          ? { ...preference, [channel]: !preference[channel] }
          : preference,
      ),
    );
  }

  async function save() {
    if (!preferences) return;

    setPending(true);
    setError('');

    const result = await fetchJson('/api/v1/notification-preferences', {
      method: 'PUT',
      body: {
        preferences: preferences.map(({ category, push, email }) => ({
          category,
          push,
          email,
        })),
      },
    });

    if (result.ok) {
      setSaved(true);
    } else {
      setError(result.error);
    }

    setPending(false);
  }

  return (
    <section aria-labelledby='notifications-title' className={sectionClass}>
      <h2 className={sectionTitleClass} id='notifications-title'>
        Уведомления
      </h2>

      {error ? (
        <p className={errorClass} role='alert'>
          {error}
        </p>
      ) : undefined}

      {preferences === undefined && !error ? (
        <p className='font-bold text-gray-500'>Загружаем...</p>
      ) : undefined}

      {preferences ? (
        <>
          <table className='w-full text-left'>
            <thead>
              <tr className='border-b-4 border-black text-sm uppercase'>
                <th className='py-2'>Событие</th>
                <th className='w-20 py-2 text-center'>Push</th>
                <th className='w-20 py-2 text-center'>Почта</th>
              </tr>
            </thead>
            <tbody>
              {preferences.map((preference) => {
                const label =
                  CATEGORY_LABELS[preference.category] ?? preference.category;

                return (
                  <tr
                    key={preference.category}
                    className='border-b-2 border-black'
                  >
                    <td className='py-2 font-bold'>{label}</td>
                    <td className='text-center'>
                      <input
                        aria-label={`${label}: push`}
                        checked={preference.push}
                        className='h-5 w-5 accent-black'
                        type='checkbox'
                        onChange={() => toggle(preference.category, 'push')}
                      />
                    </td>
                    <td className='text-center'>
                      <input
                        aria-label={`${label}: почта`}
                        checked={preference.email}
                        className='h-5 w-5 accent-black disabled:opacity-30'
                        disabled={!preference.emailSupported}
                        title={
                          preference.emailSupported
                            ? undefined
                            : 'По этому событию письма не отправляются'
                        }
                        type='checkbox'
                        onChange={() => toggle(preference.category, 'email')}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <button
            className={`${primaryButtonClass} mt-4 w-full`}
            disabled={pending}
            onClick={() => void save()}
          >
            {pending ? 'Сохраняем...' : 'Сохранить'}
          </button>
          {saved ? (
            <p className='mt-2 font-bold' role='status'>
              Сохранено
            </p>
          ) : undefined}
        </>
      ) : undefined}
    </section>
  );
}
